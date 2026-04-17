import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import {
  getMetaConnection, upsertMetaConnection, deleteMetaConnection,
  getCampaigns, upsertCampaigns, deleteCampaignsByUser,
  getAds, upsertAds, deleteAdsByUser,
  getCompetitorAds, saveCompetitorAd, deleteCompetitorAd, markCompetitorAdProcessed,
  getTranscripts, getTranscriptById, createTranscript, updateTranscript, deleteTranscript,
  getDocuments, createDocument, updateDocument, deleteDocument,
  getCompetitors, getCompetitorById, createCompetitor, updateCompetitor, deleteCompetitor, getActiveCompetitors,
  getAdBatches, getAdBatchById, createAdBatch, updateAdBatch, deleteAdBatch,
  getBrandSettings, upsertBrandSettings,
  getGoogleDriveConnection, upsertGoogleDriveConnection, deleteGoogleDriveConnection,
  getScanLogs, createScanLog, updateScanLog,
} from "./db";
import { runDailyScan, startScheduler } from "./scheduler";

// ─── Meta API Helper ──────────────────────────────────────────────────────────

async function fetchMetaAPI(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/v19.0${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Meta API error");
  return data;
}

// ─── Ad Library API Helper ────────────────────────────────────────────────────

async function searchAdLibrary(query: string, country: string, limit = 20, accessToken?: string) {
  const url = new URL("https://graph.facebook.com/v19.0/ads_archive");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("ad_reached_countries", `["${country}"]`);
  url.searchParams.set("ad_type", "ALL");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields",
    "id,ad_creation_time,ad_delivery_start_time,ad_delivery_stop_time,ad_snapshot_url,page_name,page_id,ad_creative_bodies,ad_creative_link_captions,ad_creative_link_descriptions,ad_creative_link_titles,currency,impressions,spend"
  );
  const token = accessToken || process.env.META_AD_LIBRARY_TOKEN || "";
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Ad Library API error");
  return data;
}

// ─── Google Drive Helper ──────────────────────────────────────────────────────

async function createGoogleDriveFolder(accessToken: string, name: string, parentId?: string) {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Google Drive error");
  return data as { id: string; name: string; webViewLink?: string };
}

async function uploadGoogleDriveFile(accessToken: string, name: string, content: string, folderId?: string) {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.document",
  };
  if (folderId) metadata.parents = [folderId];

  const boundary = "batch_boundary_xyz";
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    content,
    `--${boundary}--`,
  ].join("\r\n");

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Google Drive upload error");
  return data as { id: string; name: string; webViewLink?: string };
}

async function listGoogleDriveFolders(accessToken: string, parentId?: string) {
  const q = parentId
    ? `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("fields", "files(id,name)");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Google Drive list error");
  return data.files as Array<{ id: string; name: string }>;
}

// ─── KI Batch Generator ───────────────────────────────────────────────────────

async function generateBatchFromAdText(
  adText: string,
  brandContext: string,
  competitorName: string,
  language = "de"
): Promise<{ body: string; cta: string; hook1: string; hook2: string; hook3: string; heygenScript: string }> {
  const langInstruction = language === "de" ? "Antworte ausschließlich auf Deutsch." : `Respond in ${language}.`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Du bist ein erstklassiger Performance-Marketing-Copywriter für das Unternehmen Easy Signals. ${langInstruction}
Deine Aufgabe: Analysiere einen Konkurrenz-Ad-Text und erstelle daraus einen vollständigen Ad-Batch für Easy Signals.

Ein Batch besteht aus:
1. BODY: Das Hauptskript (3-5 Sätze, authentisch, direkte Ansprache, für Kamera-Aufnahme optimiert)
2. CTA: Ein starker Call-to-Action (1 Satz, klar und handlungsorientiert)
3. HOOK_1: Erster Hook – Neugier wecken (1-2 Sätze, Frage oder überraschende Aussage)
4. HOOK_2: Zweiter Hook – Problem/Schmerz ansprechen (1-2 Sätze, emotionaler Einstieg)
5. HOOK_3: Dritter Hook – Ergebnis/Transformation zeigen (1-2 Sätze, Ergebnis-fokussiert)
6. HEYGEN_SCRIPT: Das vollständige Skript für einen KI-Avatar (Hook1 + Body + CTA, mit [PAUSE] Markierungen für natürliche Pausen)

Kontext Easy Signals: ${brandContext}

Antworte NUR im folgenden JSON-Format:
{
  "body": "...",
  "cta": "...",
  "hook1": "...",
  "hook2": "...",
  "hook3": "...",
  "heygenScript": "..."
}`,
      },
      {
        role: "user",
        content: `Konkurrent: ${competitorName}\n\nOriginal Ad-Text:\n${adText}\n\nErstelle jetzt den Easy Signals Batch auf Basis dieses Ads.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ad_batch",
        strict: true,
        schema: {
          type: "object",
          properties: {
            body: { type: "string" },
            cta: { type: "string" },
            hook1: { type: "string" },
            hook2: { type: "string" },
            hook3: { type: "string" },
            heygenScript: { type: "string" },
          },
          required: ["body", "cta", "hook1", "hook2", "hook3", "heygenScript"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("KI-Antwort war leer");
  return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
}

// ─── Mock Data Generator ──────────────────────────────────────────────────────

function generateMockAdLibraryResults(query: string, _country: string) {
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
    impressions: {
      lower_bound: String(Math.floor(Math.random() * 100000)),
      upper_bound: String(Math.floor(Math.random() * 500000)),
    },
    _isMock: true,
  }));
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
      return { id: conn.id, adAccountId: conn.adAccountId, adAccountName: conn.adAccountName, appId: conn.appId, isActive: conn.isActive, createdAt: conn.createdAt };
    }),

    connect: protectedProcedure
      .input(z.object({ accessToken: z.string().min(1), adAccountId: z.string().min(1), appId: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const accountId = input.adAccountId.startsWith("act_") ? input.adAccountId : `act_${input.adAccountId}`;
        let accountName = accountId;
        try {
          const data = await fetchMetaAPI(`/${accountId}`, input.accessToken, { fields: "name,account_status" });
          accountName = data.name || accountId;
        } catch {
          throw new Error("Ungültiger Access Token oder Ad Account ID.");
        }
        await upsertMetaConnection({ userId: ctx.user.id, accessToken: input.accessToken, adAccountId: accountId, adAccountName: accountName, appId: input.appId || null, isActive: true });
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
      if (!conn) throw new Error("Keine Meta-Verbindung gefunden.");
      const data = await fetchMetaAPI(`/${conn.adAccountId}/campaigns`, conn.accessToken, {
        fields: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
        limit: "100",
      });
      const campaignData = (data.data || []).map((c: Record<string, unknown>) => ({
        userId: ctx.user.id, metaId: c.id as string, name: c.name as string, status: c.status as string,
        objective: c.objective as string,
        dailyBudget: c.daily_budget ? parseFloat(c.daily_budget as string) / 100 : null,
        lifetimeBudget: c.lifetime_budget ? parseFloat(c.lifetime_budget as string) / 100 : null,
        startTime: c.start_time ? new Date(c.start_time as string) : null,
        stopTime: c.stop_time ? new Date(c.stop_time as string) : null,
        rawData: c, syncedAt: new Date(),
      }));
      await deleteCampaignsByUser(ctx.user.id);
      if (campaignData.length > 0) await upsertCampaigns(ctx.user.id, campaignData);
      return { success: true, count: campaignData.length };
    }),

    syncAds: protectedProcedure.mutation(async ({ ctx }) => {
      const conn = await getMetaConnection(ctx.user.id);
      if (!conn) throw new Error("Keine Meta-Verbindung gefunden.");
      const data = await fetchMetaAPI(`/${conn.adAccountId}/ads`, conn.accessToken, {
        fields: "id,name,status,adset_id,adset{name},campaign_id,creative{id,title,body,call_to_action_type,thumbnail_url},insights{impressions,reach,clicks,spend,ctr,cpc,cpm,actions,action_values}",
        limit: "100", date_preset: "last_30d",
      });
      const adData = (data.data || []).map((a: Record<string, unknown>) => {
        const insights = (a.insights as Record<string, unknown[]> | undefined)?.data?.[0] as Record<string, unknown> | undefined;
        const creative = a.creative as Record<string, unknown> | undefined;
        const adset = a.adset as Record<string, unknown> | undefined;
        let roas: number | null = null;
        if (insights?.action_values) {
          const pv = (insights.action_values as Array<Record<string, string>>).find(v => v.action_type === "offsite_conversion.fb_pixel_purchase");
          const spend = parseFloat((insights?.spend as string) || "0");
          if (pv && spend > 0) roas = parseFloat(pv.value) / spend;
        }
        return {
          userId: ctx.user.id, metaId: a.id as string, campaignMetaId: a.campaign_id as string,
          name: a.name as string, status: a.status as string, adsetName: adset?.name as string,
          impressions: insights?.impressions ? parseInt(insights.impressions as string) : null,
          reach: insights?.reach ? parseInt(insights.reach as string) : null,
          clicks: insights?.clicks ? parseInt(insights.clicks as string) : null,
          spend: insights?.spend ? parseFloat(insights.spend as string) : null,
          ctr: insights?.ctr ? parseFloat(insights.ctr as string) : null,
          cpc: insights?.cpc ? parseFloat(insights.cpc as string) : null,
          cpm: insights?.cpm ? parseFloat(insights.cpm as string) : null,
          roas, creativeType: creative ? "image" : null,
          thumbnailUrl: creative?.thumbnail_url as string, adText: creative?.body as string,
          headline: creative?.title as string, callToAction: creative?.call_to_action_type as string,
          rawData: a, syncedAt: new Date(),
        };
      });
      await deleteAdsByUser(ctx.user.id);
      if (adData.length > 0) await upsertAds(ctx.user.id, adData);
      return { success: true, count: adData.length };
    }),
  }),

  // ─── Analytics ──────────────────────────────────────────────────────────────

  analytics: router({
    getCampaigns: protectedProcedure.query(async ({ ctx }) => getCampaigns(ctx.user.id)),
    getAds: protectedProcedure.query(async ({ ctx }) => getAds(ctx.user.id)),

    getAIInsights: protectedProcedure
      .input(z.object({ adIds: z.array(z.number()).optional() }))
      .mutation(async ({ ctx, input }) => {
        const allAds = await getAds(ctx.user.id);
        const targetAds = input.adIds ? allAds.filter(a => input.adIds!.includes(a.id)) : allAds.slice(0, 10);
        if (targetAds.length === 0) return { insights: "Keine Ads gefunden. Bitte synchronisiere zuerst deine Meta Ads." };
        const adSummary = targetAds.map(a =>
          `Ad: "${a.name}" | Status: ${a.status} | Impressionen: ${a.impressions || 0} | Reichweite: ${a.reach || 0} | Klicks: ${a.clicks || 0} | Ausgaben: €${a.spend?.toFixed(2) || "0"} | CTR: ${a.ctr?.toFixed(2) || "0"}% | CPC: €${a.cpc?.toFixed(2) || "0"} | ROAS: ${a.roas?.toFixed(2) || "N/A"}`
        ).join("\n");
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Du bist ein erfahrener Performance-Marketing-Experte für Meta Ads. Analysiere die folgenden Ad-Daten und gib strukturierte, umsetzbare Empfehlungen auf Deutsch. Formatiere deine Antwort mit klaren Abschnitten: 1) Top-Performer, 2) Verbesserungspotenzial, 3) Konkrete Handlungsempfehlungen." },
            { role: "user", content: `Analysiere diese Meta Ads Performance-Daten der letzten 30 Tage:\n\n${adSummary}` },
          ],
        });
        return { insights: response.choices[0]?.message?.content || "Keine Analyse verfügbar." };
      }),
  }),

  // ─── Ad Library ─────────────────────────────────────────────────────────────

  adLibrary: router({
    search: protectedProcedure
      .input(z.object({ query: z.string().min(1), country: z.string().default("DE"), limit: z.number().default(20) }))
      .mutation(async ({ ctx, input }) => {
        try {
          const conn = await getMetaConnection(ctx.user.id);
          const data = await searchAdLibrary(input.query, input.country, input.limit, conn?.accessToken);
          return { results: data.data || [], paging: data.paging };
        } catch {
          const mockAds = generateMockAdLibraryResults(input.query, input.country);
          return { results: mockAds, paging: null, isMock: true };
        }
      }),

    saveAd: protectedProcedure
      .input(z.object({
        metaAdId: z.string().optional(), pageName: z.string().optional(), pageId: z.string().optional(),
        adText: z.string().optional(), headline: z.string().optional(), callToAction: z.string().optional(),
        imageUrl: z.string().optional(), videoUrl: z.string().optional(), startDate: z.string().optional(),
        endDate: z.string().optional(), country: z.string().optional(), searchQuery: z.string().optional(),
        competitorId: z.number().optional(), rawData: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await saveCompetitorAd({ ...input, userId: ctx.user.id });
        return { success: true };
      }),

    getSaved: protectedProcedure.query(async ({ ctx }) => getCompetitorAds(ctx.user.id)),

    deleteSaved: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteCompetitorAd(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Transcripts ────────────────────────────────────────────────────────────

  transcripts: router({
    list: protectedProcedure.query(async ({ ctx }) => getTranscripts(ctx.user.id)),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => getTranscriptById(input.id, ctx.user.id)),

    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1), content: z.string(),
        sourceType: z.enum(["competitor_ad", "manual", "ai_generated", "batch"]).default("manual"),
        sourceId: z.number().optional(), tags: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await createTranscript({ ...input, userId: ctx.user.id });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), title: z.string().optional(), content: z.string().optional(), tags: z.string().optional() }))
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
      .input(z.object({ adText: z.string(), headline: z.string().optional(), pageName: z.string().optional(), callToAction: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Du bist ein erfahrener Copywriter und Video-Skript-Autor. Erstelle aus dem folgenden Werbetext ein professionelles Teleprompter-Skript auf Deutsch. Das Skript soll: 1) Natürlich und authentisch klingen, 2) In klare Sätze und Absätze strukturiert sein, 3) Pausen durch Zeilenumbrüche andeuten, 4) Den Call-to-Action am Ende einbauen. Gib NUR das Skript zurück." },
            { role: "user", content: `Erstelle ein Teleprompter-Skript aus diesem Ad:\n\nMarke: ${input.pageName || "Unbekannt"}\nÜberschrift: ${input.headline || ""}\nAnzeigentext: ${input.adText}\nCTA: ${input.callToAction || ""}` },
          ],
        });
        return { content: response.choices[0]?.message?.content || "" };
      }),
  }),

  // ─── Documents ──────────────────────────────────────────────────────────────

  documents: router({
    list: protectedProcedure.query(async ({ ctx }) => getDocuments(ctx.user.id)),

    export: protectedProcedure
      .input(z.object({
        title: z.string().min(1), content: z.string().min(1),
        format: z.enum(["markdown", "pdf"]),
        sourceType: z.enum(["transcript", "analysis", "batch"]).default("transcript"),
        sourceId: z.number().optional(),
      }))
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

  // ─── Competitors ─────────────────────────────────────────────────────────────

  competitors: router({
    list: protectedProcedure.query(async ({ ctx }) => getCompetitors(ctx.user.id)),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1), pageId: z.string().optional(), pageName: z.string().optional(),
        country: z.string().default("DE"), language: z.string().default("de"), notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await createCompetitor({ ...input, userId: ctx.user.id });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(), name: z.string().optional(), pageId: z.string().optional(),
        country: z.string().optional(), language: z.string().optional(),
        isActive: z.boolean().optional(), notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateCompetitor(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteCompetitor(input.id, ctx.user.id);
        return { success: true };
      }),

    scan: protectedProcedure
      .input(z.object({ competitorId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const competitor = await getCompetitorById(input.competitorId, ctx.user.id);
        if (!competitor) throw new Error("Konkurrent nicht gefunden.");

        // Create scan log
        const logResult = await createScanLog({
          userId: ctx.user.id,
          competitorId: competitor.id,
          competitorName: competitor.name,
          status: "running",
        });
        const logId = (logResult as { insertId?: number })?.insertId;

        try {
          const conn = await getMetaConnection(ctx.user.id);
          let results: ReturnType<typeof generateMockAdLibraryResults> = [];
          let isMock = false;

          try {
            const searchQuery = competitor.pageName || competitor.name;
            const data = await searchAdLibrary(searchQuery, competitor.country, 20, conn?.accessToken);
            results = data.data || [];
          } catch {
            results = generateMockAdLibraryResults(competitor.name, competitor.country);
            isMock = true;
          }

          let newAds = 0;
          for (const ad of results) {
            const adText = ad.ad_creative_bodies?.[0] || "";
            if (!adText) continue;
            await saveCompetitorAd({
              userId: ctx.user.id,
              competitorId: competitor.id,
              metaAdId: ad.id,
              pageName: ad.page_name || competitor.name,
              pageId: ad.page_id,
              adText,
              headline: ad.ad_creative_link_titles?.[0],
              startDate: ad.ad_delivery_start_time,
              country: competitor.country,
              searchQuery: competitor.name,
              rawData: ad,
              isProcessed: false,
            });
            newAds++;
          }

          await updateCompetitor(competitor.id, ctx.user.id, {
            lastScannedAt: new Date(),
            totalAdsFound: (competitor.totalAdsFound || 0) + results.length,
            newAdsSinceLastScan: newAds,
          });

          if (logId) {
            await updateScanLog(logId, {
              status: "completed",
              adsFound: results.length,
              newAds,
              completedAt: new Date(),
            });
          }

          return { success: true, adsFound: results.length, newAds, isMock };
        } catch (error) {
          if (logId) {
            await updateScanLog(logId, {
              status: "failed",
              errorMessage: error instanceof Error ? error.message : "Unbekannter Fehler",
              completedAt: new Date(),
            });
          }
          throw error;
        }
      }),

    scanAll: protectedProcedure.mutation(async ({ ctx }) => {
      const activeCompetitors = await getActiveCompetitors(ctx.user.id);
      if (activeCompetitors.length === 0) return { success: true, scanned: 0, totalNewAds: 0 };

      let totalNewAds = 0;
      const results = [];

      for (const competitor of activeCompetitors) {
        try {
          const conn = await getMetaConnection(ctx.user.id);
          let ads: ReturnType<typeof generateMockAdLibraryResults> = [];
          let isMock = false;

          try {
            const data = await searchAdLibrary(competitor.pageName || competitor.name, competitor.country, 10, conn?.accessToken);
            ads = data.data || [];
          } catch {
            ads = generateMockAdLibraryResults(competitor.name, competitor.country);
            isMock = true;
          }

          let newAds = 0;
          for (const ad of ads) {
            const adText = ad.ad_creative_bodies?.[0] || "";
            if (!adText) continue;
            await saveCompetitorAd({
              userId: ctx.user.id, competitorId: competitor.id,
              metaAdId: ad.id, pageName: ad.page_name || competitor.name,
              adText, headline: ad.ad_creative_link_titles?.[0],
              startDate: ad.ad_delivery_start_time, country: competitor.country,
              searchQuery: competitor.name, rawData: ad, isProcessed: false,
            });
            newAds++;
          }

          await updateCompetitor(competitor.id, ctx.user.id, {
            lastScannedAt: new Date(),
            totalAdsFound: (competitor.totalAdsFound || 0) + ads.length,
            newAdsSinceLastScan: newAds,
          });

          totalNewAds += newAds;
          results.push({ name: competitor.name, newAds, isMock });
        } catch (e) {
          results.push({ name: competitor.name, error: e instanceof Error ? e.message : "Fehler" });
        }
      }

      return { success: true, scanned: activeCompetitors.length, totalNewAds, results };
    }),

    getScanLogs: protectedProcedure.query(async ({ ctx }) => getScanLogs(ctx.user.id)),
  }),

  // ─── Ad Batches ──────────────────────────────────────────────────────────────

  batches: router({
    list: protectedProcedure.query(async ({ ctx }) => getAdBatches(ctx.user.id)),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => getAdBatchById(input.id, ctx.user.id)),

    generate: protectedProcedure
      .input(z.object({
        sourceAdId: z.number().optional(),
        adText: z.string().min(1),
        competitorName: z.string().optional(),
        language: z.string().default("de"),
      }))
      .mutation(async ({ ctx, input }) => {
        const brand = await getBrandSettings(ctx.user.id);
        const brandContext = brand
          ? `Marke: ${brand.brandName}. ${brand.brandDescription || ""}. Zielgruppe: ${brand.targetAudience || ""}. USPs: ${brand.uniqueSellingPoints || ""}. Ton: ${brand.toneOfVoice || "professionell und direkt"}.`
          : "Easy Signals – digitale Marketing-Lösungen für Unternehmen.";

        const batch = await generateBatchFromAdText(
          input.adText,
          brandContext,
          input.competitorName || "Unbekannt",
          input.language
        );

        const title = `Batch – ${input.competitorName || "Ad"} – ${new Date().toLocaleDateString("de-DE")}`;
        await createAdBatch({
          userId: ctx.user.id,
          title,
          sourceAdId: input.sourceAdId,
          sourceAdText: input.adText,
          competitorName: input.competitorName,
          body: batch.body,
          cta: batch.cta,
          hook1: batch.hook1,
          hook2: batch.hook2,
          hook3: batch.hook3,
          heygenScript: batch.heygenScript,
          brandContext,
          language: input.language,
          status: "ready",
        });

        return { success: true, batch };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(), title: z.string().optional(), body: z.string().optional(),
        cta: z.string().optional(), hook1: z.string().optional(), hook2: z.string().optional(),
        hook3: z.string().optional(), heygenScript: z.string().optional(),
        status: z.enum(["draft", "ready", "exported", "used"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateAdBatch(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteAdBatch(input.id, ctx.user.id);
        return { success: true };
      }),

    generateFromCompetitor: protectedProcedure
      .input(z.object({ competitorId: z.number(), maxAds: z.number().default(3) }))
      .mutation(async ({ ctx, input }) => {
        const competitorAdsData = await (async () => {
          const db = await import("./db");
          return db.getCompetitorAdsByCompetitor(ctx.user.id, input.competitorId);
        })();

        const unprocessed = competitorAdsData.filter(a => !a.isProcessed && a.adText).slice(0, input.maxAds);
        if (unprocessed.length === 0) return { success: true, batchesCreated: 0, message: "Keine unverarbeiteten Ads gefunden." };

        const brand = await getBrandSettings(ctx.user.id);
        const brandContext = brand
          ? `Marke: ${brand.brandName}. ${brand.brandDescription || ""}. Zielgruppe: ${brand.targetAudience || ""}. USPs: ${brand.uniqueSellingPoints || ""}.`
          : "Easy Signals – digitale Marketing-Lösungen.";

        let created = 0;
        for (const ad of unprocessed) {
          if (!ad.adText) continue;
          try {
            const batch = await generateBatchFromAdText(ad.adText, brandContext, ad.pageName || "Unbekannt", "de");
            await createAdBatch({
              userId: ctx.user.id,
              title: `Batch – ${ad.pageName || "Ad"} – ${new Date().toLocaleDateString("de-DE")}`,
              sourceAdId: ad.id,
              sourceAdText: ad.adText,
              competitorName: ad.pageName,
              body: batch.body, cta: batch.cta,
              hook1: batch.hook1, hook2: batch.hook2, hook3: batch.hook3,
              heygenScript: batch.heygenScript,
              brandContext, language: "de", status: "ready",
            });
            await markCompetitorAdProcessed(ad.id);
            created++;
          } catch (e) {
            console.error("Batch generation failed for ad", ad.id, e);
          }
        }

        return { success: true, batchesCreated: created };
      }),

    exportToTranscript: protectedProcedure
      .input(z.object({ batchId: z.number(), hookIndex: z.number().default(0) }))
      .mutation(async ({ ctx, input }) => {
        const batch = await getAdBatchById(input.batchId, ctx.user.id);
        if (!batch) throw new Error("Batch nicht gefunden.");

        const hooks = [batch.hook1, batch.hook2, batch.hook3];
        const selectedHook = hooks[input.hookIndex] || batch.hook1;
        const fullScript = `${selectedHook}\n\n${batch.body}\n\n${batch.cta}`;

        await createTranscript({
          userId: ctx.user.id,
          title: `${batch.title} – Hook ${input.hookIndex + 1}`,
          content: fullScript,
          sourceType: "batch",
          sourceId: batch.id,
        });

        await updateAdBatch(batch.id, ctx.user.id, { status: "exported" });
        return { success: true };
      }),
  }),

  // ─── Brand Settings ──────────────────────────────────────────────────────────

  brand: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getBrandSettings(ctx.user.id);
      return settings || {
        brandName: "Easy Signals",
        brandDescription: "",
        targetAudience: "",
        toneOfVoice: "professionell und direkt",
        uniqueSellingPoints: "",
        callToActionDefault: "Jetzt kostenlos starten",
        language: "de",
      };
    }),

    save: protectedProcedure
      .input(z.object({
        brandName: z.string().min(1).default("Easy Signals"),
        brandDescription: z.string().optional(),
        targetAudience: z.string().optional(),
        toneOfVoice: z.string().optional(),
        uniqueSellingPoints: z.string().optional(),
        callToActionDefault: z.string().optional(),
        language: z.string().default("de"),
      }))
      .mutation(async ({ ctx, input }) => {
        await upsertBrandSettings({ ...input, userId: ctx.user.id });
        return { success: true };
      }),
  }),

  // ─── Google Drive ────────────────────────────────────────────────────────────

  googleDrive: router({
    getConnection: protectedProcedure.query(async ({ ctx }) => {
      const conn = await getGoogleDriveConnection(ctx.user.id);
      if (!conn) return null;
      return { id: conn.id, rootFolderName: conn.rootFolderName, rootFolderId: conn.rootFolderId, isActive: conn.isActive, createdAt: conn.createdAt };
    }),

    connect: protectedProcedure
      .input(z.object({ accessToken: z.string().min(1), refreshToken: z.string().optional(), folderName: z.string().default("Easy Signals Ads") }))
      .mutation(async ({ ctx, input }) => {
        // Verify token and create root folder
        const aboutRes = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
          headers: { Authorization: `Bearer ${input.accessToken}` },
        });
        const about = await aboutRes.json();
        if (about.error) throw new Error("Ungültiger Google Access Token.");

        // Create root folder
        let folder;
        try {
          folder = await createGoogleDriveFolder(input.accessToken, input.folderName);
        } catch {
          throw new Error("Konnte Google Drive Ordner nicht erstellen.");
        }

        await upsertGoogleDriveConnection({
          userId: ctx.user.id,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          rootFolderId: folder.id,
          rootFolderName: input.folderName,
          isActive: true,
        });

        return { success: true, folderId: folder.id, folderName: input.folderName };
      }),

    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      await deleteGoogleDriveConnection(ctx.user.id);
      return { success: true };
    }),

    uploadBatch: protectedProcedure
      .input(z.object({ batchId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const [batch, driveConn] = await Promise.all([
          getAdBatchById(input.batchId, ctx.user.id),
          getGoogleDriveConnection(ctx.user.id),
        ]);
        if (!batch) throw new Error("Batch nicht gefunden.");
        if (!driveConn) throw new Error("Keine Google Drive Verbindung. Bitte zuerst verbinden.");

        // Create date subfolder
        const dateStr = new Date().toISOString().split("T")[0];
        let dateFolderId = driveConn.rootFolderId || undefined;
        try {
          const dateFolder = await createGoogleDriveFolder(driveConn.accessToken, dateStr, driveConn.rootFolderId || undefined);
          dateFolderId = dateFolder.id;
        } catch {
          // Folder might already exist, use root
        }

        // Format content as markdown
        const content = `# ${batch.title}

## 🎯 Hook 1
${batch.hook1}

## 🎯 Hook 2
${batch.hook2}

## 🎯 Hook 3
${batch.hook3}

## 📝 Body
${batch.body}

## 🚀 CTA
${batch.cta}

---

## 🤖 HeyGen Skript (Hook 1 + Body + CTA)
${batch.heygenScript || `${batch.hook1}\n\n${batch.body}\n\n${batch.cta}`}

---
*Generiert am ${new Date().toLocaleDateString("de-DE")} | Quelle: ${batch.competitorName || "Manuell"} | Easy Signals*`;

        const file = await uploadGoogleDriveFile(driveConn.accessToken, `${batch.title}.md`, content, dateFolderId);

        await updateAdBatch(batch.id, ctx.user.id, {
          googleDriveFileId: file.id,
          googleDriveUrl: file.webViewLink,
          status: "exported",
        });

        return { success: true, fileId: file.id, fileUrl: file.webViewLink };
      }),

    listFolders: protectedProcedure.query(async ({ ctx }) => {
      const driveConn = await getGoogleDriveConnection(ctx.user.id);
      if (!driveConn) return [];
      try {
        return await listGoogleDriveFolders(driveConn.accessToken, driveConn.rootFolderId || undefined);
      } catch {
        return [];
      }
    }),
  }),

  // ─── Automation ──────────────────────────────────────────────────────────────

  automation: router({
    triggerDailyScan: protectedProcedure.mutation(async ({ ctx }) => {
      const result = await runDailyScan(ctx.user.id);
      return result;
    }),

    startScheduler: protectedProcedure.mutation(async ({ ctx }) => {
      startScheduler(ctx.user.id);
      return { success: true };
    }),
  }),

  // ─── Dashboard Stats ────────────────────────────────────────────────────────

  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const [campaignsData, allAds, competitorAdsData, transcriptsData, documentsData, competitorsData, batchesData] = await Promise.all([
        getCampaigns(ctx.user.id),
        getAds(ctx.user.id),
        getCompetitorAds(ctx.user.id),
        getTranscripts(ctx.user.id),
        getDocuments(ctx.user.id),
        getCompetitors(ctx.user.id),
        getAdBatches(ctx.user.id),
      ]);

      const totalSpend = allAds.reduce((sum, ad) => sum + (ad.spend || 0), 0);
      const adsWithCtr = allAds.filter(a => a.ctr);
      const avgCTR = adsWithCtr.length > 0 ? allAds.reduce((sum, ad) => sum + (ad.ctr || 0), 0) / adsWithCtr.length : 0;
      const adsWithRoas = allAds.filter(a => a.roas);
      const avgROAS = adsWithRoas.length > 0 ? allAds.reduce((sum, ad) => sum + (ad.roas || 0), 0) / adsWithRoas.length : 0;

      const todayBatches = batchesData.filter(b => {
        const today = new Date();
        const batchDate = new Date(b.generatedAt);
        return batchDate.toDateString() === today.toDateString();
      });

      return {
        campaigns: campaignsData.length,
        ads: allAds.length,
        competitorAds: competitorAdsData.length,
        transcripts: transcriptsData.length,
        documents: documentsData.length,
        competitors: competitorsData.length,
        batches: batchesData.length,
        todayBatches: todayBatches.length,
        totalSpend,
        avgCTR: isNaN(avgCTR) ? 0 : avgCTR,
        avgROAS: isNaN(avgROAS) ? 0 : avgROAS,
        recentTranscripts: transcriptsData.slice(0, 3),
        recentAds: allAds.slice(0, 5),
        recentBatches: batchesData.slice(0, 3),
        activeCompetitors: competitorsData.filter(c => c.isActive).length,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
