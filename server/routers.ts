import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import {
  getMetaConnection,
  upsertMetaConnection,
  deleteMetaConnection,
  getCampaigns,
  upsertCampaigns,
  deleteCampaignsByUser,
  getAds,
  upsertAds,
  deleteAdsByUser,
  getCompetitorAds,
  saveCompetitorAd,
  deleteCompetitorAd,
  getTranscripts,
  getTranscriptById,
  createTranscript,
  updateTranscript,
  deleteTranscript,
  getDocuments,
  createDocument,
  deleteDocument,
} from "./db";

// ─── Meta API Helper ──────────────────────────────────────────────────────────

async function fetchMetaAPI(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/v19.0${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Meta API error");
  return data;
}

// ─── Ad Library API Helper ────────────────────────────────────────────────────

async function searchAdLibrary(query: string, country: string, limit = 20) {
  const url = new URL("https://graph.facebook.com/v19.0/ads_archive");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("ad_reached_countries", `["${country}"]`);
  url.searchParams.set("ad_type", "ALL");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set(
    "fields",
    "id,ad_creation_time,ad_delivery_start_time,ad_delivery_stop_time,ad_snapshot_url,page_name,page_id,ad_creative_bodies,ad_creative_link_captions,ad_creative_link_descriptions,ad_creative_link_titles,currency,impressions,spend"
  );
  // Use a public access token for Ad Library (no auth required for basic search)
  url.searchParams.set("access_token", process.env.META_AD_LIBRARY_TOKEN || "");

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Ad Library API error");
  return data;
}

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Meta Connection ────────────────────────────────────────────────────────

  meta: router({
    getConnection: protectedProcedure.query(async ({ ctx }) => {
      const conn = await getMetaConnection(ctx.user.id);
      if (!conn) return null;
      return {
        id: conn.id,
        adAccountId: conn.adAccountId,
        adAccountName: conn.adAccountName,
        appId: conn.appId,
        isActive: conn.isActive,
        createdAt: conn.createdAt,
      };
    }),

    connect: protectedProcedure
      .input(
        z.object({
          accessToken: z.string().min(1),
          adAccountId: z.string().min(1),
          appId: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Validate token by fetching account info
        const accountId = input.adAccountId.startsWith("act_")
          ? input.adAccountId
          : `act_${input.adAccountId}`;
        let accountName = accountId;
        try {
          const data = await fetchMetaAPI(`/${accountId}`, input.accessToken, {
            fields: "name,account_status",
          });
          accountName = data.name || accountId;
        } catch {
          throw new Error("Ungültiger Access Token oder Ad Account ID. Bitte überprüfe deine Zugangsdaten.");
        }

        await upsertMetaConnection({
          userId: ctx.user.id,
          accessToken: input.accessToken,
          adAccountId: accountId,
          adAccountName: accountName,
          appId: input.appId || null,
          isActive: true,
        });

        return { success: true, adAccountName: accountName };
      }),

    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      await deleteMetaConnection(ctx.user.id);
      await deleteCampaignsByUser(ctx.user.id);
      await deleteAdsByUser(ctx.user.id);
      return { success: true };
    }),

    syncCampaigns: protectedProcedure.mutation(async ({ ctx }) => {
      const conn = await getMetaConnection(ctx.user.id);
      if (!conn) throw new Error("Keine Meta-Verbindung gefunden. Bitte zuerst verbinden.");

      const data = await fetchMetaAPI(`/${conn.adAccountId}/campaigns`, conn.accessToken, {
        fields: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
        limit: "100",
      });

      const campaignData = (data.data || []).map((c: Record<string, unknown>) => ({
        userId: ctx.user.id,
        metaId: c.id as string,
        name: c.name as string,
        status: c.status as string,
        objective: c.objective as string,
        dailyBudget: c.daily_budget ? parseFloat(c.daily_budget as string) / 100 : null,
        lifetimeBudget: c.lifetime_budget ? parseFloat(c.lifetime_budget as string) / 100 : null,
        startTime: c.start_time ? new Date(c.start_time as string) : null,
        stopTime: c.stop_time ? new Date(c.stop_time as string) : null,
        rawData: c,
        syncedAt: new Date(),
      }));

      await deleteCampaignsByUser(ctx.user.id);
      if (campaignData.length > 0) {
        await upsertCampaigns(ctx.user.id, campaignData);
      }

      return { success: true, count: campaignData.length };
    }),

    syncAds: protectedProcedure.mutation(async ({ ctx }) => {
      const conn = await getMetaConnection(ctx.user.id);
      if (!conn) throw new Error("Keine Meta-Verbindung gefunden.");

      const data = await fetchMetaAPI(`/${conn.adAccountId}/ads`, conn.accessToken, {
        fields:
          "id,name,status,adset_id,adset{name},campaign_id,creative{id,title,body,call_to_action_type,thumbnail_url},insights{impressions,reach,clicks,spend,ctr,cpc,cpm,actions,action_values}",
        limit: "100",
        date_preset: "last_30d",
      });

      const adData = (data.data || []).map((a: Record<string, unknown>) => {
        const insights = (a.insights as Record<string, unknown[]> | undefined)?.data?.[0] as Record<string, unknown> | undefined;
        const creative = a.creative as Record<string, unknown> | undefined;
        const adset = a.adset as Record<string, unknown> | undefined;

        // Extract ROAS from action_values
        let roas: number | null = null;
        if (insights?.action_values) {
          const purchaseValue = (insights.action_values as Array<Record<string, string>>).find(
            (v) => v.action_type === "offsite_conversion.fb_pixel_purchase"
          );
          const spend = parseFloat((insights?.spend as string) || "0");
          if (purchaseValue && spend > 0) {
            roas = parseFloat(purchaseValue.value) / spend;
          }
        }

        return {
          userId: ctx.user.id,
          metaId: a.id as string,
          campaignMetaId: a.campaign_id as string,
          name: a.name as string,
          status: a.status as string,
          adsetName: adset?.name as string,
          impressions: insights?.impressions ? parseInt(insights.impressions as string) : null,
          reach: insights?.reach ? parseInt(insights.reach as string) : null,
          clicks: insights?.clicks ? parseInt(insights.clicks as string) : null,
          spend: insights?.spend ? parseFloat(insights.spend as string) : null,
          ctr: insights?.ctr ? parseFloat(insights.ctr as string) : null,
          cpc: insights?.cpc ? parseFloat(insights.cpc as string) : null,
          cpm: insights?.cpm ? parseFloat(insights.cpm as string) : null,
          roas,
          creativeType: creative ? "image" : null,
          thumbnailUrl: creative?.thumbnail_url as string,
          adText: creative?.body as string,
          headline: creative?.title as string,
          callToAction: creative?.call_to_action_type as string,
          rawData: a,
          syncedAt: new Date(),
        };
      });

      await deleteAdsByUser(ctx.user.id);
      if (adData.length > 0) {
        await upsertAds(ctx.user.id, adData);
      }

      return { success: true, count: adData.length };
    }),
  }),

  // ─── Analytics ──────────────────────────────────────────────────────────────

  analytics: router({
    getCampaigns: protectedProcedure.query(async ({ ctx }) => {
      return getCampaigns(ctx.user.id);
    }),

    getAds: protectedProcedure.query(async ({ ctx }) => {
      return getAds(ctx.user.id);
    }),

    getAIInsights: protectedProcedure
      .input(z.object({ adIds: z.array(z.number()).optional() }))
      .mutation(async ({ ctx, input }) => {
        const allAds = await getAds(ctx.user.id);
        const targetAds = input.adIds
          ? allAds.filter((a) => input.adIds!.includes(a.id))
          : allAds.slice(0, 10);

        if (targetAds.length === 0) {
          return { insights: "Keine Ads gefunden. Bitte synchronisiere zuerst deine Meta Ads." };
        }

        const adSummary = targetAds
          .map(
            (a) =>
              `Ad: "${a.name}" | Status: ${a.status} | Impressionen: ${a.impressions || 0} | Reichweite: ${a.reach || 0} | Klicks: ${a.clicks || 0} | Ausgaben: €${a.spend?.toFixed(2) || "0"} | CTR: ${a.ctr?.toFixed(2) || "0"}% | CPC: €${a.cpc?.toFixed(2) || "0"} | CPM: €${a.cpm?.toFixed(2) || "0"} | ROAS: ${a.roas?.toFixed(2) || "N/A"}`
          )
          .join("\n");

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "Du bist ein erfahrener Performance-Marketing-Experte für Meta Ads. Analysiere die folgenden Ad-Daten und gib strukturierte, umsetzbare Empfehlungen auf Deutsch. Formatiere deine Antwort mit klaren Abschnitten: 1) Top-Performer, 2) Verbesserungspotenzial, 3) Konkrete Handlungsempfehlungen. Sei präzise und praxisorientiert.",
            },
            {
              role: "user",
              content: `Analysiere diese Meta Ads Performance-Daten der letzten 30 Tage:\n\n${adSummary}`,
            },
          ],
        });

        return { insights: response.choices[0]?.message?.content || "Keine Analyse verfügbar." };
      }),
  }),

  // ─── Ad Library ─────────────────────────────────────────────────────────────

  adLibrary: router({
    search: protectedProcedure
      .input(
        z.object({
          query: z.string().min(1),
          country: z.string().default("DE"),
          limit: z.number().default(20),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const data = await searchAdLibrary(input.query, input.country, input.limit);
          return { results: data.data || [], paging: data.paging };
        } catch (error) {
          // Return mock data if API is not configured
          const mockAds = generateMockAdLibraryResults(input.query, input.country);
          return { results: mockAds, paging: null, isMock: true };
        }
      }),

    saveAd: protectedProcedure
      .input(
        z.object({
          metaAdId: z.string().optional(),
          pageName: z.string().optional(),
          pageId: z.string().optional(),
          adText: z.string().optional(),
          headline: z.string().optional(),
          callToAction: z.string().optional(),
          imageUrl: z.string().optional(),
          videoUrl: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          country: z.string().optional(),
          searchQuery: z.string().optional(),
          rawData: z.any().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await saveCompetitorAd({ ...input, userId: ctx.user.id });
        return { success: true };
      }),

    getSaved: protectedProcedure.query(async ({ ctx }) => {
      return getCompetitorAds(ctx.user.id);
    }),

    deleteSaved: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteCompetitorAd(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Transcripts ────────────────────────────────────────────────────────────

  transcripts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getTranscripts(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return getTranscriptById(input.id, ctx.user.id);
      }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1),
          content: z.string(),
          sourceType: z.enum(["competitor_ad", "manual", "ai_generated"]).default("manual"),
          sourceId: z.number().optional(),
          tags: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await createTranscript({ ...input, userId: ctx.user.id });
        return { success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          content: z.string().optional(),
          tags: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateTranscript(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteTranscript(input.id, ctx.user.id);
        return { success: true };
      }),

    generateFromAd: protectedProcedure
      .input(
        z.object({
          adText: z.string(),
          headline: z.string().optional(),
          pageName: z.string().optional(),
          callToAction: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "Du bist ein erfahrener Copywriter und Video-Skript-Autor. Erstelle aus dem folgenden Werbetext ein professionelles Teleprompter-Skript auf Deutsch. Das Skript soll: 1) Natürlich und authentisch klingen, 2) In klare Sätze und Absätze strukturiert sein, 3) Pausen und Betonungen durch Zeilenumbrüche andeuten, 4) Den Call-to-Action am Ende einbauen. Gib NUR das Skript zurück, keine Erklärungen.",
            },
            {
              role: "user",
              content: `Erstelle ein Teleprompter-Skript aus diesem Ad:\n\nMarke/Seite: ${input.pageName || "Unbekannt"}\nÜberschrift: ${input.headline || ""}\nAnzeigentext: ${input.adText}\nCall-to-Action: ${input.callToAction || ""}`,
            },
          ],
        });

        const content = response.choices[0]?.message?.content || "";
        return { content };
      }),
  }),

  // ─── Documents ──────────────────────────────────────────────────────────────

  documents: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getDocuments(ctx.user.id);
    }),

    export: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1),
          content: z.string().min(1),
          format: z.enum(["markdown", "pdf"]),
          sourceType: z.enum(["transcript", "analysis"]).default("transcript"),
          sourceId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await createDocument({ ...input, userId: ctx.user.id });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteDocument(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Dashboard Stats ────────────────────────────────────────────────────────

  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const [campaigns, allAds, competitorAdsData, transcriptsData, documentsData] = await Promise.all([
        getCampaigns(ctx.user.id),
        getAds(ctx.user.id),
        getCompetitorAds(ctx.user.id),
        getTranscripts(ctx.user.id),
        getDocuments(ctx.user.id),
      ]);

      const totalSpend = allAds.reduce((sum, ad) => sum + (ad.spend || 0), 0);
      const avgCTR = allAds.length > 0
        ? allAds.reduce((sum, ad) => sum + (ad.ctr || 0), 0) / allAds.filter(a => a.ctr).length
        : 0;
      const avgROAS = allAds.filter(a => a.roas).length > 0
        ? allAds.reduce((sum, ad) => sum + (ad.roas || 0), 0) / allAds.filter(a => a.roas).length
        : 0;

      return {
        campaigns: campaigns.length,
        ads: allAds.length,
        competitorAds: competitorAdsData.length,
        transcripts: transcriptsData.length,
        documents: documentsData.length,
        totalSpend,
        avgCTR: isNaN(avgCTR) ? 0 : avgCTR,
        avgROAS: isNaN(avgROAS) ? 0 : avgROAS,
        recentTranscripts: transcriptsData.slice(0, 3),
        recentAds: allAds.slice(0, 5),
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;

// ─── Mock Data Generator ─────────────────────────────────────────────────────

function generateMockAdLibraryResults(query: string, country: string) {
  const brands = [
    { name: "SportBrand GmbH", id: "123456" },
    { name: "FitLife AG", id: "234567" },
    { name: "ActiveWear Co.", id: "345678" },
    { name: "HealthFirst", id: "456789" },
    { name: "PremiumStyle", id: "567890" },
  ];

  const adTexts = [
    `Entdecke unsere neue ${query} Kollektion! Jetzt 30% Rabatt auf alle Artikel. Limitiertes Angebot – nur solange der Vorrat reicht.`,
    `${query} – Qualität, die überzeugt. Über 50.000 zufriedene Kunden vertrauen uns. Jetzt kostenlos testen!`,
    `Dein Leben. Dein Style. Unsere ${query} Produkte machen den Unterschied. Bestelle heute und erhalte kostenlosen Versand.`,
    `Neu: Die revolutionäre ${query} Lösung für deinen Alltag. Spare Zeit, spare Geld. Jetzt 14 Tage gratis!`,
    `Warum ${query} anders denken? Wir zeigen dir wie. Tausende Kunden sind bereits dabei – werde Teil der Community!`,
  ];

  return brands.map((brand, i) => ({
    id: `mock_${i}_${Date.now()}`,
    page_name: brand.name,
    page_id: brand.id,
    ad_creative_bodies: [adTexts[i % adTexts.length]],
    ad_creative_link_titles: [`${query} – Jetzt entdecken`],
    ad_creative_link_captions: ["www.example.com"],
    ad_delivery_start_time: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    ad_delivery_stop_time: null,
    ad_snapshot_url: null,
    currency: "EUR",
    impressions: { lower_bound: String(Math.floor(Math.random() * 100000)), upper_bound: String(Math.floor(Math.random() * 500000)) },
    _isMock: true,
  }));
}
