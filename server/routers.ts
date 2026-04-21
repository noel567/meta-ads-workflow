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
  createHeygenVideo, getHeygenVideos, getHeygenVideosByBatch, updateHeygenVideo, getHeygenVideoByHeygenId,
  createVideoResearch, getVideoResearchList, getVideoResearchById, updateVideoResearch, deleteVideoResearch,
  getTelegramPosts, getTelegramPostById, createTelegramPost, updateTelegramPost, deleteTelegramPost,
  getTelegramSettings, upsertTelegramSettings,
} from "./db";
import { runDailyScan, startScheduler, runDailyTelegramPost } from "./scheduler";
import { metaInsightsRouter } from "./metaInsightsRouter";
import { adCommentsRouter } from "./adCommentsRouter";
import { budgetRulesRouter } from "./budgetRulesRouter";
import { driveToMetaRouter } from "./driveToMetaRouter";
import { contentBotRouter } from "./contentBotRouter";
import { createApiKey, getApiKeysByUser, revokeApiKey } from "./db";
import { ENV } from "./_core/env";

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

// ─── Google Drive Helpers ─────────────────────────────────────────────────────

async function createGoogleDriveFolder(accessToken: string, name: string, parentId?: string) {
  const metadata: Record<string, unknown> = { name, mimeType: "application/vnd.google-apps.folder" };
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
  const metadata: Record<string, unknown> = { name, mimeType: "application/vnd.google-apps.document" };
  if (folderId) metadata.parents = [folderId];
  const boundary = "batch_boundary_xyz";
  const body = [
    `--${boundary}`, "Content-Type: application/json; charset=UTF-8", "", JSON.stringify(metadata),
    `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "", content, `--${boundary}--`,
  ].join("\r\n");
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
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
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Google Drive list error");
  return data.files as Array<{ id: string; name: string }>;
}

// ─── KI Batch Generator ───────────────────────────────────────────────────────

async function generateBatchFromAdText(
  adText: string, brandContext: string, competitorName: string, language = "de"
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
{"body":"...","cta":"...","hook1":"...","hook2":"...","hook3":"...","heygenScript":"..."}`,
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
            body: { type: "string" }, cta: { type: "string" },
            hook1: { type: "string" }, hook2: { type: "string" }, hook3: { type: "string" },
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

// ─── HeyGen Helper ────────────────────────────────────────────────────────────

const HEYGEN_BASE = "https://api.heygen.com";

async function heygenFetch(path: string, method = "GET", body?: unknown): Promise<any> {
  const apiKey = ENV.heygenApiKey;
  if (!apiKey) throw new Error("HeyGen API-Key nicht konfiguriert. Bitte in den Einstellungen hinterlegen.");
  const res = await fetch(`${HEYGEN_BASE}${path}`, {
    method,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (data.error) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
  return data;
}

// ─── Sub-Routers ──────────────────────────────────────────────────────────────

const metaRouter = router({
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
      fields: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,insights{spend,impressions,clicks,ctr,cpc,reach}",
      limit: "50",
    });
    const campaigns = (data.data || []).map((c: any) => ({
      userId: ctx.user.id,
      metaId: c.id,
      name: c.name,
      status: c.status?.toLowerCase() || "unknown",
      objective: c.objective || null,
      dailyBudget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
      lifetimeBudget: c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null,
      startTime: c.start_time ? new Date(c.start_time) : null,
      stopTime: c.stop_time ? new Date(c.stop_time) : null,
      spend: c.insights?.data?.[0]?.spend ? parseFloat(c.insights.data[0].spend) : null,
      impressions: c.insights?.data?.[0]?.impressions ? parseInt(c.insights.data[0].impressions) : null,
      clicks: c.insights?.data?.[0]?.clicks ? parseInt(c.insights.data[0].clicks) : null,
      ctr: c.insights?.data?.[0]?.ctr ? parseFloat(c.insights.data[0].ctr) : null,
      cpc: c.insights?.data?.[0]?.cpc ? parseFloat(c.insights.data[0].cpc) : null,
      reach: c.insights?.data?.[0]?.reach ? parseInt(c.insights.data[0].reach) : null,
    }));
    await upsertCampaigns(ctx.user.id, campaigns);
    return { synced: campaigns.length };
  }),
  syncAds: protectedProcedure.mutation(async ({ ctx }) => {
    const conn = await getMetaConnection(ctx.user.id);
    if (!conn) throw new Error("Keine Meta-Verbindung gefunden.");
    const campaignsData = await getCampaigns(ctx.user.id);
    let totalSynced = 0;
    for (const campaign of campaignsData.slice(0, 10)) {
      try {
        const data = await fetchMetaAPI(`/${campaign.metaId}/ads`, conn.accessToken, {
          fields: "id,name,status,creative{title,body,image_url},insights{spend,impressions,clicks,ctr,cpc,reach,actions}",
          limit: "20",
        });
        const ads = (data.data || []).map((ad: any) => {
          const insights = ad.insights?.data?.[0] || {};
          const purchaseAction = insights.actions?.find((a: any) => a.action_type === "purchase");
          const spend = insights.spend ? parseFloat(insights.spend) : null;
          const purchaseValue = purchaseAction?.value ? parseFloat(purchaseAction.value) : null;
          return {
            userId: ctx.user.id,
            campaignId: campaign.id,
            metaId: ad.id,
            name: ad.name,
            status: ad.status?.toLowerCase() || "unknown",
            adsetId: null,
            creativeTitle: ad.creative?.title || null,
            creativeBody: ad.creative?.body || null,
            creativeImageUrl: ad.creative?.image_url || null,
            spend,
            impressions: insights.impressions ? parseInt(insights.impressions) : null,
            clicks: insights.clicks ? parseInt(insights.clicks) : null,
            ctr: insights.ctr ? parseFloat(insights.ctr) : null,
            cpc: insights.cpc ? parseFloat(insights.cpc) : null,
            reach: insights.reach ? parseInt(insights.reach) : null,
            roas: spend && purchaseValue ? purchaseValue / spend : null,
          };
        });
        await upsertAds(ctx.user.id, ads);
        totalSynced += ads.length;
      } catch { /* skip failed campaigns */ }
    }
    return { synced: totalSynced };
  }),
  getCampaigns: protectedProcedure.query(async ({ ctx }) => getCampaigns(ctx.user.id)),
  getAds: protectedProcedure.query(async ({ ctx }) => getAds(ctx.user.id)),
});

const analyticsRouter = router({
  getAds: protectedProcedure.query(async ({ ctx }) => getAds(ctx.user.id)),
  getCampaigns: protectedProcedure.query(async ({ ctx }) => getCampaigns(ctx.user.id)),
  getKPIs: protectedProcedure.query(async ({ ctx }) => {
    const allAds = await getAds(ctx.user.id);
    const totalSpend = allAds.reduce((sum, ad) => sum + (ad.spend || 0), 0);
    const totalImpressions = allAds.reduce((sum, ad) => sum + (ad.impressions || 0), 0);
    const totalClicks = allAds.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
    const adsWithCtr = allAds.filter(a => a.ctr);
    const avgCTR = adsWithCtr.length > 0 ? allAds.reduce((sum, ad) => sum + (ad.ctr || 0), 0) / adsWithCtr.length : 0;
    const adsWithCpc = allAds.filter(a => a.cpc);
    const avgCPC = adsWithCpc.length > 0 ? allAds.reduce((sum, ad) => sum + (ad.cpc || 0), 0) / adsWithCpc.length : 0;
    const adsWithRoas = allAds.filter(a => a.roas);
    const avgROAS = adsWithRoas.length > 0 ? allAds.reduce((sum, ad) => sum + (ad.roas || 0), 0) / adsWithRoas.length : 0;
    return { totalSpend, totalImpressions, totalClicks, avgCTR, avgCPC, avgROAS, adCount: allAds.length };
  }),
  getAIInsights: protectedProcedure.mutation(async ({ ctx }) => {
    const allAds = await getAds(ctx.user.id);
    if (allAds.length === 0) return { insights: "Keine Ads gefunden. Bitte synchronisiere zuerst deine Meta Ads." };
    const topAds = allAds.sort((a, b) => (b.spend || 0) - (a.spend || 0)).slice(0, 10);
    const adSummary = topAds.map(ad =>
      `Ad: "${ad.name}" | Status: ${ad.status} | Spend: €${ad.spend?.toFixed(2) || "0"} | CTR: ${ad.ctr?.toFixed(2) || "0"}% | CPC: €${ad.cpc?.toFixed(2) || "0"} | ROAS: ${ad.roas?.toFixed(2) || "0"}`
    ).join("\n");
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Du bist ein erfahrener Performance-Marketing-Analyst. Analysiere die Meta Ads Performance-Daten und gib konkrete, umsetzbare Optimierungsempfehlungen auf Deutsch." },
        { role: "user", content: `Analysiere diese Meta Ads Performance-Daten und gib mir:\n1. Was performt gut und warum\n2. Was verbessert werden sollte\n3. Konkrete nächste Schritte\n\nAds-Daten:\n${adSummary}` },
      ],
    });
    return { insights: response.choices[0]?.message?.content as string || "Keine Insights verfügbar." };
  }),
});

const adLibraryRouter = router({
  search: protectedProcedure
    .input(z.object({ query: z.string().min(1), country: z.string().default("DE"), limit: z.number().default(20) }))
    .mutation(async ({ ctx, input }) => {
      const conn = await getMetaConnection(ctx.user.id);
      try {
        const data = await searchAdLibrary(input.query, input.country, input.limit, conn?.accessToken);
        return { results: data.data || [], isMock: false };
      } catch {
        return { results: generateMockAdLibraryResults(input.query, input.country), isMock: true };
      }
    }),
  saveAd: protectedProcedure
    .input(z.object({
      adId: z.string(), pageName: z.string(), pageId: z.string().optional(),
      adText: z.string().optional(), adTitle: z.string().optional(),
      adImageUrl: z.string().optional(), adSnapshotUrl: z.string().optional(),
      impressionsLower: z.number().optional(), impressionsUpper: z.number().optional(),
      startDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await saveCompetitorAd({
        userId: ctx.user.id,
        metaAdId: input.adId,
        pageName: input.pageName,
        pageId: input.pageId || null,
        adText: input.adText || null,
        headline: input.adTitle || null,
        imageUrl: input.adImageUrl || null,
        startDate: input.startDate || null,
        isProcessed: false,
        rawData: input.adSnapshotUrl ? { snapshotUrl: input.adSnapshotUrl, impressionsLower: input.impressionsLower, impressionsUpper: input.impressionsUpper } : null,
      });
      return { success: true };
    }),
  getSaved: protectedProcedure.query(async ({ ctx }) => getCompetitorAds(ctx.user.id)),
  deleteSaved: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => { await deleteCompetitorAd(input.id, ctx.user.id); return { success: true }; }),
});

const transcriptsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => getTranscripts(ctx.user.id)),
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const t = await getTranscriptById(input.id, ctx.user.id);
      return t ?? null;
    }),
  create: protectedProcedure
    .input(z.object({ title: z.string().min(1), content: z.string(), sourceId: z.number().optional(), sourceType: z.enum(["competitor_ad", "manual", "ai_generated", "batch"]).optional() }))
    .mutation(async ({ ctx, input }) => {
      await createTranscript({ userId: ctx.user.id, title: input.title, content: input.content, sourceId: input.sourceId || null, sourceType: input.sourceType || "manual" });
      return { success: true };
    }),
  update: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string().optional(), content: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { await updateTranscript(input.id, ctx.user.id, input); return { success: true }; }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => { await deleteTranscript(input.id, ctx.user.id); return { success: true }; }),
  generateFromAd: protectedProcedure
    .input(z.object({ adId: z.number().optional(), adText: z.string(), pageName: z.string().optional(), headline: z.string().optional(), language: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const sourceName = input.pageName || "Unbekannt";
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Du bist ein erfahrener Werbetexter. Erstelle ein professionelles Video-Skript auf Deutsch aus dem gegebenen Ad-Text. Das Skript soll natürlich klingen, für einen Teleprompter geeignet sein und die Kernbotschaft des Originals bewahren." },
          { role: "user", content: `Erstelle ein Video-Skript aus diesem Ad-Text von ${sourceName}:\n\n${input.adText}\n\nDas Skript soll:\n- Natürlich und authentisch klingen\n- Für einen Teleprompter formatiert sein\n- Die Kernbotschaft übertragen\n- Auf Deutsch sein (auch wenn das Original auf Englisch ist)` },
        ],
      });
      const content = response.choices[0]?.message?.content as string;
      await createTranscript({ userId: ctx.user.id, title: `Transkript: ${sourceName}`, content, sourceId: input.adId || null, sourceType: "ai_generated" });
      if (input.adId) await markCompetitorAdProcessed(input.adId);
      return { success: true, content };
    }),
});

const documentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => getDocuments(ctx.user.id)),
  export: protectedProcedure
    .input(z.object({ transcriptId: z.number(), title: z.string(), format: z.enum(["markdown", "pdf"]).default("markdown") }))
    .mutation(async ({ ctx, input }) => {
      const transcript = await getTranscriptById(input.transcriptId, ctx.user.id);
      if (!transcript) throw new Error("Transkript nicht gefunden.");
      const content = `# ${input.title}\n\n${transcript.content}\n\n---\n*Erstellt am ${new Date().toLocaleDateString("de-DE")} mit Meta Ads Creative Workflow*`;
      await createDocument({ userId: ctx.user.id, sourceId: input.transcriptId, title: input.title, content, format: input.format });
      return { success: true, content };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => { await deleteDocument(input.id, ctx.user.id); return { success: true }; }),
});

const competitorsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => getCompetitors(ctx.user.id)),
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const c = await getCompetitorById(input.id, ctx.user.id);
      return c ?? null;
    }),
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), pageId: z.string().optional(), pageName: z.string().optional(), country: z.string().optional(), language: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await createCompetitor({ userId: ctx.user.id, name: input.name, pageId: input.pageId || null, pageName: input.pageName || null, country: input.country || "DE", language: input.language || "de", notes: input.notes || null, isActive: true });
      return { success: true };
    }),
  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), pageId: z.string().optional(), isActive: z.boolean().optional(), notes: z.string().optional(), lastScannedAt: z.date().optional() }))
    .mutation(async ({ ctx, input }) => { await updateCompetitor(input.id, ctx.user.id, input); return { success: true }; }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => { await deleteCompetitor(input.id, ctx.user.id); return { success: true }; }),
  scanAds: protectedProcedure
    .input(z.object({ competitorId: z.number(), query: z.string(), country: z.string().default("DE") }))
    .mutation(async ({ ctx, input }) => {
      const competitor = await getCompetitorById(input.competitorId, ctx.user.id);
      if (!competitor) throw new Error("Konkurrent nicht gefunden.");
      const conn = await getMetaConnection(ctx.user.id);
      let results: any[];
      try {
        const data = await searchAdLibrary(input.query, input.country, 10, conn?.accessToken);
        results = data.data || [];
      } catch {
        results = generateMockAdLibraryResults(input.query, input.country);
      }
      for (const ad of results) {
        const adText = ad.ad_creative_bodies?.[0] || ad.ad_creative_link_titles?.[0] || "";
        if (!adText) continue;
        await saveCompetitorAd({
          userId: ctx.user.id,
          metaAdId: ad.id,
          pageName: competitor.name,
          pageId: competitor.pageId || null,
          adText,
          headline: ad.ad_creative_link_titles?.[0] || null,
          imageUrl: null,
          startDate: ad.ad_delivery_start_time || null,
          isProcessed: false,
          rawData: { snapshotUrl: ad.ad_snapshot_url, impressionsLower: ad.impressions?.lower_bound, impressionsUpper: ad.impressions?.upper_bound },
        });
      }
      await updateCompetitor(input.competitorId, ctx.user.id, { lastScannedAt: new Date() });
      return { found: results.length };
    }),
  getScanLogs: protectedProcedure.query(async ({ ctx }) => getScanLogs(ctx.user.id)),
});

const batchesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => getAdBatches(ctx.user.id)),
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const b = await getAdBatchById(input.id, ctx.user.id);
      return b ?? null;
    }),
  generate: protectedProcedure
    .input(z.object({ competitorAdId: z.number(), adText: z.string(), competitorName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const brand = await getBrandSettings(ctx.user.id);
      const brandContext = brand
        ? `Marke: ${brand.brandName}. ${brand.brandDescription || ""}. Zielgruppe: ${brand.targetAudience || "Unternehmer und Marketer"}. USPs: ${brand.uniqueSellingPoints || "Einfachheit, Ergebnisse, Automatisierung"}. Ton: ${brand.toneOfVoice || "professionell und direkt"}.`
        : "Easy Signals – Performance Marketing Automatisierung für Unternehmer.";
      const batch = await generateBatchFromAdText(input.adText, brandContext, input.competitorName);
      await createAdBatch({
        userId: ctx.user.id,
        title: `${input.competitorName} – ${new Date().toLocaleDateString("de-DE")}`,
        sourceAdId: input.competitorAdId,
        competitorName: input.competitorName,
        body: batch.body,
        cta: batch.cta,
        hook1: batch.hook1,
        hook2: batch.hook2,
        hook3: batch.hook3,
        heygenScript: batch.heygenScript,
        status: "ready",
      });
      return { success: true, batch };
    }),
  update: protectedProcedure
    .input(z.object({ id: z.number(), body: z.string().optional(), cta: z.string().optional(), hook1: z.string().optional(), hook2: z.string().optional(), hook3: z.string().optional(), heygenScript: z.string().optional(), status: z.enum(["draft", "ready", "exported", "used"]).optional() }))
    .mutation(async ({ ctx, input }) => { await updateAdBatch(input.id, ctx.user.id, input); return { success: true }; }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => { await deleteAdBatch(input.id, ctx.user.id); return { success: true }; }),
});

const brandRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const brand = await getBrandSettings(ctx.user.id);
    return brand ?? null;
  }),
  upsert: protectedProcedure
    .input(z.object({
      brandName: z.string().optional(), brandDescription: z.string().optional(),
      targetAudience: z.string().optional(), toneOfVoice: z.string().optional(),
      uniqueSellingPoints: z.string().optional(), callToActionDefault: z.string().optional(),
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => { await upsertBrandSettings({ userId: ctx.user.id, ...input }); return { success: true }; }),
});

const googleDriveRouter = router({
  getConnection: protectedProcedure.query(async ({ ctx }) => {
    const conn = await getGoogleDriveConnection(ctx.user.id);
    if (!conn) return null;
    return { id: conn.id, rootFolderName: conn.rootFolderName, isActive: conn.isActive, updatedAt: conn.updatedAt, connectedEmail: (conn as any).connectedEmail ?? null };
  }),
  getAuthUrl: protectedProcedure
    .input(z.object({ origin: z.string(), returnPath: z.string().optional() }))
    .query(({ input }) => {
      const redirectUri = `${input.origin}/api/google/callback`;
      const returnPath = input.returnPath ?? "/settings";
      const params = new URLSearchParams({
        client_id: ENV.googleClientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: [
          "https://www.googleapis.com/auth/drive",
          "https://www.googleapis.com/auth/userinfo.email",
        ].join(" "),
        access_type: "offline",
        prompt: "consent",
        state: Buffer.from(JSON.stringify({ ts: Date.now(), returnPath })).toString("base64"),
      });
      return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
    }),
  connect: protectedProcedure
    .input(z.object({ accessToken: z.string().min(1), refreshToken: z.string().optional(), rootFolderName: z.string().default("Easy Signals Ads") }))
    .mutation(async ({ ctx, input }) => {
      let rootFolderId: string | null = null;
      try {
        const folders = await listGoogleDriveFolders(input.accessToken);
        const existing = folders.find(f => f.name === input.rootFolderName);
        if (existing) {
          rootFolderId = existing.id;
        } else {
          const created = await createGoogleDriveFolder(input.accessToken, input.rootFolderName);
          rootFolderId = created.id;
        }
      } catch { /* ignore folder creation errors */ }
      await upsertGoogleDriveConnection({
        userId: ctx.user.id, accessToken: input.accessToken,
        refreshToken: input.refreshToken || null, rootFolderId, rootFolderName: input.rootFolderName, isActive: true,
      });
      return { success: true, rootFolderId };
    }),
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteGoogleDriveConnection(ctx.user.id);
    return { success: true };
  }),
  uploadBatch: protectedProcedure
    .input(z.object({ batchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const batch = await getAdBatchById(input.batchId, ctx.user.id);
      if (!batch) throw new Error("Batch nicht gefunden.");
      const dateStr = new Date().toISOString().split("T")[0];
      const { mkdirSync, writeFileSync, rmSync } = await import("fs");
      const { execSync: exec } = await import("child_process");
      const os = await import("os");
      const path = await import("path");
      try {
        // Write batch content to a temp file
        const tmpDir = path.join(os.tmpdir(), `easysignals_${Date.now()}`);
        mkdirSync(tmpDir, { recursive: true });
        const safeCompetitor = (batch.competitorName ?? "Unknown").replace(/[^a-zA-Z0-9_\-äöüÄÖÜ ]/g, "_");
        const fileName = `${safeCompetitor}_${dateStr}.md`;
        const filePath = path.join(tmpDir, fileName);
        const content = `# Ad Batch: ${batch.competitorName}\n\n**Datum:** ${dateStr}\n\n## Body\n${batch.body}\n\n## CTA\n${batch.cta}\n\n## Hook 1\n${batch.hook1}\n\n## Hook 2\n${batch.hook2}\n\n## Hook 3\n${batch.hook3}\n\n## HeyGen Skript\n${batch.heygenScript}`;
        writeFileSync(filePath, content, "utf-8");
        // Upload via rclone (no OAuth needed)
        const rcloneConfig = "/home/ubuntu/.gdrive-rclone.ini";
        const remotePath = `manus_google_drive:Easy Signals Ads/${dateStr}/${safeCompetitor}`;
        exec(`rclone mkdir "${remotePath}" --config "${rcloneConfig}"`, { timeout: 15000 });
        exec(`rclone copyto "${filePath}" "${remotePath}/${fileName}" --config "${rcloneConfig}"`, { timeout: 30000 });
        // Get the file link
        const fileLink = `https://drive.google.com/drive/folders/`;
        // Cleanup
        rmSync(tmpDir, { recursive: true, force: true });
        await updateAdBatch(input.batchId, ctx.user.id, { status: "exported" });
        return { success: true, fileId: fileName, webViewLink: `https://drive.google.com/drive/search?q=${encodeURIComponent(fileName)}` };
      } catch (err: any) {
        throw new Error(`Google Drive Upload fehlgeschlagen: ${err.message}`);
      }
    }),
  listFolders: protectedProcedure.query(async ({ ctx }) => {
    const conn = await getGoogleDriveConnection(ctx.user.id);
    if (!conn) return [];
    return listGoogleDriveFolders(conn.accessToken, conn.rootFolderId || undefined);
  }),
});

const automationRouter = router({
  runScan: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await runDailyScan(ctx.user.id);
    return result;
  }),
  startScheduler: protectedProcedure.mutation(async ({ ctx }) => {
    startScheduler(ctx.user.id);
    return { success: true, message: "Täglicher Scan-Scheduler gestartet (07:00 UTC)." };
  }),
  getScanLogs: protectedProcedure.query(async ({ ctx }) => getScanLogs(ctx.user.id, 20)),
});

const dashboardRouter = router({
  getStats: protectedProcedure.query(async ({ ctx }) => {
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
});

const heygenRouter = router({
  getAvatars: protectedProcedure.query(async () => {
    const data = await heygenFetch("/v2/avatars");
    const avatars = data?.data?.avatars ?? [];
    return avatars.map((a: any) => ({
      id: a.avatar_id as string,
      name: (a.avatar_name ?? a.avatar_id) as string,
      previewImageUrl: (a.preview_image_url ?? null) as string | null,
      previewVideoUrl: (a.preview_video_url ?? null) as string | null,
    }));
  }),
  getVoices: protectedProcedure.query(async () => {
    const data = await heygenFetch("/v2/voices");
    const voices = data?.data?.voices ?? [];
    return voices.map((v: any) => ({
      id: v.voice_id as string,
      name: (v.name ?? v.voice_id) as string,
      language: (v.language ?? "en") as string,
      gender: (v.gender ?? null) as string | null,
      preview_audio: (v.preview_audio ?? null) as string | null,
    }));
  }),
  createVideo: protectedProcedure
    .input(z.object({
      script: z.string().min(1).max(5000),
      avatarId: z.string(),
      avatarName: z.string().optional(),
      voiceId: z.string(),
      voiceName: z.string().optional(),
      title: z.string().optional(),
      batchId: z.number().optional(),
      aspectRatio: z.enum(["16:9", "9:16"]).default("9:16"),
    }))
    .mutation(async ({ ctx, input }) => {
      const body = {
        title: input.title ?? "Easy Signals Ad",
        avatar_id: input.avatarId,
        script: input.script,
        voice_id: input.voiceId,
        resolution: "1080p",
        aspect_ratio: input.aspectRatio,
        voice_settings: { speed: 1, pitch: 0 },
      };
      const data = await heygenFetch("/v2/videos", "POST", body);
      const heygenVideoId = data?.data?.video_id as string;
      if (!heygenVideoId) throw new Error("HeyGen hat keine Video-ID zurückgegeben.");
      await createHeygenVideo({
        userId: ctx.user.id,
        batchId: input.batchId ?? null,
        heygenVideoId,
        title: input.title ?? "Easy Signals Ad",
        script: input.script,
        avatarId: input.avatarId,
        avatarName: input.avatarName ?? null,
        voiceId: input.voiceId,
        voiceName: input.voiceName ?? null,
        status: "pending",
      });
      return { heygenVideoId, message: "Video wird erstellt. Status kann abgerufen werden." };
    }),
  getVideoStatus: protectedProcedure
    .input(z.object({ heygenVideoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const data = await heygenFetch(`/v1/video_status.get?video_id=${input.heygenVideoId}`);
      const status = (data?.data?.status as string) ?? "pending";
      const videoUrl = data?.data?.video_url as string | undefined;
      const thumbnailUrl = data?.data?.thumbnail_url as string | undefined;
      const duration = data?.data?.duration as number | undefined;
      const errorMsg = data?.data?.error as string | undefined;
      const dbRecord = await getHeygenVideoByHeygenId(input.heygenVideoId);
      if (dbRecord) {
        await updateHeygenVideo(dbRecord.id, {
          status: status as any,
          videoUrl: videoUrl ?? null,
          thumbnailUrl: thumbnailUrl ?? null,
          duration: duration ?? null,
          errorMessage: errorMsg ?? null,
        });
      }
      return { status, videoUrl, thumbnailUrl, duration, error: errorMsg };
    }),
  getVideos: protectedProcedure.query(async ({ ctx }) => getHeygenVideos(ctx.user.id) as Promise<any[]>),
  getVideosByBatch: protectedProcedure
    .input(z.object({ batchId: z.number() }))
    .query(async ({ ctx, input }) => getHeygenVideosByBatch(ctx.user.id, input.batchId) as Promise<any[]>),
  testConnection: protectedProcedure.query(async () => {
    const data = await heygenFetch("/v2/user/remaining_quota");
    const quota = (data?.data?.remaining_quota as number) ?? 0;
    return { connected: true, remainingQuota: quota };
  }),
});

// ─── Hooks Router ───────────────────────────────────────────────────────────

const hooksRouter = router({
  generate: protectedProcedure
    .input(z.object({
      scriptText: z.string().min(10, "Skript muss mindestens 10 Zeichen haben"),
      context: z.string().optional(), // z.B. "Easy Signals – Automatisierungssoftware für Marketer"
      language: z.string().default("de"),
    }))
    .mutation(async ({ ctx, input }) => {
      const brand = await getBrandSettings(ctx.user.id);
      const brandContext = brand
        ? `Marke: ${brand.brandName}. ${brand.brandDescription || ""}. Zielgruppe: ${brand.targetAudience || "Unternehmer und Marketer"}. USPs: ${brand.uniqueSellingPoints || "Einfachheit, Ergebnisse, Automatisierung"}. Ton: ${brand.toneOfVoice || "professionell und direkt"}.`
        : input.context || "Easy Signals – Performance-Marketing-Automatisierung für Unternehmer.";

      const langInstruction = input.language === "de"
        ? "Antworte ausschließlich auf Deutsch."
        : `Respond in ${input.language}.`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Du bist ein erstklassiger Performance-Marketing-Copywriter. ${langInstruction}
Deine Aufgabe: Erstelle für das folgende Anzeigenskript genau 3 verschiedene, starke Hooks.

Jeder Hook hat einen anderen Ansatz:
1. NEUGIER-HOOK: Weckt Neugier durch eine überraschende Frage oder Aussage (1-2 Sätze)
2. SCHMERZ-HOOK: Spricht ein konkretes Problem oder einen Schmerz der Zielgruppe an (1-2 Sätze)
3. ERGEBNIS-HOOK: Zeigt eine konkrete Transformation oder ein messbares Ergebnis (1-2 Sätze)

Regeln:
- Jeder Hook muss sofort Aufmerksamkeit erzeugen (erste 3 Sekunden entscheidend)
- Hooks sind für Video-Ads optimiert (direkte Ansprache, kurz, prägnant)
- Hooks müssen zum Skript-Inhalt passen und nahtlos in den Body übergehen
- Branding: ${brandContext}

Antworte NUR im folgenden JSON-Format:
{"hook1":{"type":"neugier","label":"Neugier-Hook","text":"..."},"hook2":{"type":"schmerz","label":"Schmerz-Hook","text":"..."},"hook3":{"type":"ergebnis","label":"Ergebnis-Hook","text":"..."}}`
          },
          {
            role: "user",
            content: `Anzeigenskript:\n${input.scriptText}\n\nErstelle jetzt die 3 Hooks.`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "hooks_result",
            strict: true,
            schema: {
              type: "object",
              properties: {
                hook1: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    label: { type: "string" },
                    text: { type: "string" },
                  },
                  required: ["type", "label", "text"],
                  additionalProperties: false,
                },
                hook2: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    label: { type: "string" },
                    text: { type: "string" },
                  },
                  required: ["type", "label", "text"],
                  additionalProperties: false,
                },
                hook3: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    label: { type: "string" },
                    text: { type: "string" },
                  },
                  required: ["type", "label", "text"],
                  additionalProperties: false,
                },
              },
              required: ["hook1", "hook2", "hook3"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("KI-Antwort war leer");
      const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      return {
        hooks: [
          { ...parsed.hook1, index: 1 },
          { ...parsed.hook2, index: 2 },
          { ...parsed.hook3, index: 3 },
        ] as Array<{ type: string; label: string; text: string; index: number }>,
        scriptText: input.scriptText,
        generatedAt: new Date().toISOString(),
      };
    }),
});

// ─── Video Research Router ──────────────────────────────────────────────────
const videoResearchRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getVideoResearchList(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return getVideoResearchById(input.id, ctx.user.id);
    }),

  submit: protectedProcedure
    .input(z.object({
      sourceUrl: z.string().url(),
      platform: z.enum(["facebook", "instagram", "youtube", "tiktok", "other"]).default("facebook"),
      competitorName: z.string().optional(),
      competitorId: z.number().optional(),
      language: z.string().default("de"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createVideoResearch({
        userId: ctx.user.id,
        sourceUrl: input.sourceUrl,
        platform: input.platform,
        competitorName: input.competitorName ?? null,
        competitorId: input.competitorId ?? null,
        language: input.language,
        notes: input.notes ?? null,
        status: "pending",
      });
      return { id, status: "pending" };
    }),

  process: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const item = await getVideoResearchById(input.id, ctx.user.id);
      if (!item) throw new Error("Video Research nicht gefunden.");

      // Step 1: Download video via yt-dlp
      await updateVideoResearch(input.id, { status: "downloading" });
      const { execSync } = await import("child_process");
      const { mkdirSync, existsSync, readFileSync, rmSync } = await import("fs");
      const os = await import("os");
      const path = await import("path");
      const { storagePut } = await import("./storage");

      const tmpDir = path.join(os.tmpdir(), `vr_${input.id}_${Date.now()}`);
      mkdirSync(tmpDir, { recursive: true });
      let videoPath: string | null = null;
      let s3Url: string | null = null;
      let s3Key: string | null = null;

      try {
        // Try yt-dlp download
        const outputTemplate = path.join(tmpDir, "video.%(ext)s");
        try {
          execSync(
            `yt-dlp --no-playlist --max-filesize 50m -o "${outputTemplate}" "${item.sourceUrl}"`,
            { timeout: 120000, stdio: "pipe" }
          );
          // Find downloaded file
          const files = require("fs").readdirSync(tmpDir);
          const videoFile = files.find((f: string) => f.startsWith("video."));
          if (videoFile) {
            videoPath = path.join(tmpDir, videoFile);
            // Upload to S3
            const fileBuffer = readFileSync(videoPath);
            const ext = path.extname(videoFile);
            const dateStr = new Date().toISOString().split("T")[0];
            const safeComp = (item.competitorName ?? "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
            s3Key = `video-research/${dateStr}/${safeComp}_${input.id}${ext}`;
            const mimeMap: Record<string, string> = { ".mp4": "video/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska" };
            const mime = mimeMap[ext] || "video/mp4";
            const uploaded = await storagePut(s3Key, fileBuffer, mime);
            s3Url = uploaded.url;
          }
        } catch (dlErr: any) {
          // Download failed – continue with URL-based transcription
          console.warn("[VideoResearch] yt-dlp failed:", dlErr.message?.slice(0, 200));
        }

        await updateVideoResearch(input.id, { status: "transcribing", s3Key, s3Url });

        // Step 2: Transcribe via Whisper
        const { transcribeAudio } = await import("./_core/voiceTranscription");
        let transcript = "";
        let transcriptHook = "";
        let transcriptBody = "";
        let transcriptCta = "";

        const audioSource = s3Url || item.sourceUrl;
        try {
          const result = await transcribeAudio({ audioUrl: audioSource, language: item.language ?? "de" });
          transcript = (result as any).text || "";
        } catch (transcribeErr: any) {
          console.warn("[VideoResearch] Whisper failed:", transcribeErr.message?.slice(0, 200));
          transcript = "[Transkription nicht verfügbar – Video-URL nicht direkt zugänglich]";
        }

        // Step 3: Parse Hook/Body/CTA from transcript via LLM
        if (transcript && !transcript.startsWith("[")) {
          const parseRes = await invokeLLM({
            messages: [
              { role: "system", content: "Du bist ein Expert für Performance-Marketing. Analysiere das folgende Video-Transkript und extrahiere strukturiert: Hook (erste 5-10 Sekunden), Body (Hauptinhalt) und CTA (Call-to-Action am Ende). Antworte als JSON." },
              { role: "user", content: `Transkript:\n${transcript}` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "transcript_parts",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    hook: { type: "string", description: "Die ersten 5-10 Sekunden / der Hook" },
                    body: { type: "string", description: "Der Hauptinhalt der Ad" },
                    cta: { type: "string", description: "Der Call-to-Action am Ende" },
                  },
                  required: ["hook", "body", "cta"],
                  additionalProperties: false,
                },
              },
            },
          });
          try {
            const parsed = JSON.parse(parseRes.choices[0].message.content as string);
            transcriptHook = parsed.hook || "";
            transcriptBody = parsed.body || "";
            transcriptCta = parsed.cta || "";
          } catch { /* ignore parse errors */ }
        }

        await updateVideoResearch(input.id, {
          status: "analyzing",
          transcript,
          transcriptHook,
          transcriptBody,
          transcriptCta,
        });

        // Step 4: Analyze the ad
        const analysisRes = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Du bist ein Expert für Performance Creative Strategy im Trading/Finance-Bereich (DACH-Markt). 
Analysiere diese Konkurrenz-Ad für EasySignals (Trading-Signale, XAUUSD/Gold, Schweiz/DACH).
Du arbeitest nach dem EasySignals Content Operating System: direkt, emotional, hochwertig, conversion-orientiert.
Antworte als JSON.`,
            },
            {
              role: "user",
              content: `Konkurrent: ${item.competitorName || "Unbekannt"}\nPlattform: ${item.platform}\nURL: ${item.sourceUrl}\n\nTranskript:\n${transcript || "[nicht verfügbar]"}\n\nAnalysiere diese Ad vollständig.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "ad_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  angle: { type: "string", description: "Der psychologische Angle (z.B. Anti-Scam, FOMO, Proof, Komfort)" },
                  targetAudience: { type: "string", description: "Zielgruppe und deren Hauptproblem" },
                  mechanic: { type: "string", description: "Psychologische Mechanik und Struktur der Ad" },
                  offerStructure: { type: "string", description: "Wie das Angebot präsentiert wird" },
                  whyItWorks: { type: "string", description: "Warum diese Ad wahrscheinlich funktioniert" },
                  visualPattern: { type: "string", description: "Visuelle Struktur, Schnittlogik, On-Screen-Text (soweit erkennbar)" },
                },
                required: ["angle", "targetAudience", "mechanic", "offerStructure", "whyItWorks", "visualPattern"],
                additionalProperties: false,
              },
            },
          },
        });

        let analysis = { angle: "", targetAudience: "", mechanic: "", offerStructure: "", whyItWorks: "", visualPattern: "" };
        try {
          analysis = JSON.parse(analysisRes.choices[0].message.content as string);
        } catch { /* ignore */ }

        await updateVideoResearch(input.id, {
          status: "adapting",
          analysisAngle: analysis.angle,
          analysisTargetAudience: analysis.targetAudience,
          analysisMechanic: analysis.mechanic,
          analysisOfferStructure: analysis.offerStructure,
          analysisWhyItWorks: analysis.whyItWorks,
          analysisVisualPattern: analysis.visualPattern,
        });

        // Step 5: Generate EasySignals adaptations
        const adaptRes = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Du bist das EasySignals Content Operating System.
EasySignals ist eine Trading-Marke (XAUUSD/Gold, DACH/Schweiz) von Livio Glausen.
Kernangebote: Signalgruppe, LAT-System (Auto-Copy-Trading), Prop-Firm Passing Service, Coaching.
Zielgruppen: Anfänger mit Scam-Angst, Leute mit wenig Zeit, frustrierte Trader, Prop-Firm-Interessenten.
Tonalität: direkt, emotional, hochwertig, conversion-orientiert, sprechbar, nicht wie Standard-KI.
Naming Convention: ES_[Bereich]_[Angle]_[Thema]_[Sprache]_[Format]_V1
Drive-Struktur: 03_Competitor_Research/04_EasySignals_Adaptations/
Liefere vollständige EasySignals-Adaptionen als JSON.`,
            },
            {
              role: "user",
              content: `Konkurrent: ${item.competitorName || "Unbekannt"}\nAngle: ${analysis.angle}\nTranskript: ${transcript || "[nicht verfügbar]"}\n\nErstelle vollständige EasySignals-Adaptionen.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "easysignals_adaptation",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  hook1: { type: "string", description: "Hook 1: Neugier/Curiosity" },
                  hook2: { type: "string", description: "Hook 2: Pain/Problem" },
                  hook3: { type: "string", description: "Hook 3: Ergebnis/Transformation" },
                  body: { type: "string", description: "Body (3-5 Sätze, sprechbar, kameraoptimiert)" },
                  cta: { type: "string", description: "Call-to-Action" },
                  heygenScript: { type: "string", description: "Vollständiges HeyGen-Avatar-Skript (Hook 1 + Body + CTA mit [PAUSE]-Markierungen)" },
                  telegramPost: { type: "string", description: "Telegram-Post-Version (authentisch, wie von Livio direkt)" },
                  nanaBananaPrompt: { type: "string", description: "Nano-Banana-Bildprompt für passendes Visual" },
                  fileName: { type: "string", description: "Dateiname nach Naming Convention ES_AD_..." },
                  driveFolderPath: { type: "string", description: "Drive-Ordnerpfad z.B. 03_Competitor_Research/04_EasySignals_Adaptations/" },
                },
                required: ["hook1", "hook2", "hook3", "body", "cta", "heygenScript", "telegramPost", "nanaBananaPrompt", "fileName", "driveFolderPath"],
                additionalProperties: false,
              },
            },
          },
        });

        let adapt = { hook1: "", hook2: "", hook3: "", body: "", cta: "", heygenScript: "", telegramPost: "", nanaBananaPrompt: "", fileName: "", driveFolderPath: "" };
        try {
          adapt = JSON.parse(adaptRes.choices[0].message.content as string);
        } catch { /* ignore */ }

        await updateVideoResearch(input.id, {
          status: "completed",
          adaptHook1: adapt.hook1,
          adaptHook2: adapt.hook2,
          adaptHook3: adapt.hook3,
          adaptBody: adapt.body,
          adaptCta: adapt.cta,
          adaptHeygenScript: adapt.heygenScript,
          adaptTelegramPost: adapt.telegramPost,
          adaptNanaBananaPrompt: adapt.nanaBananaPrompt,
          fileName: adapt.fileName,
          driveFolderPath: adapt.driveFolderPath,
        });

        // Cleanup temp files
        try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }

        return { success: true, id: input.id, status: "completed" };
      } catch (err: any) {
        await updateVideoResearch(input.id, { status: "failed", errorMessage: err.message?.slice(0, 500) });
        try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
        throw new Error(`Pipeline fehlgeschlagen: ${err.message}`);
      }
    }),

  exportToDrive: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const item = await getVideoResearchById(input.id, ctx.user.id);
      if (!item) throw new Error("Video Research nicht gefunden.");
      if (item.status !== "completed") throw new Error("Pipeline noch nicht abgeschlossen.");

      const { execSync } = await import("child_process");
      const { mkdirSync, writeFileSync, rmSync } = await import("fs");
      const os = await import("os");
      const path = await import("path");

      const dateStr = new Date().toISOString().split("T")[0];
      const safeComp = (item.competitorName ?? "Unknown").replace(/[^a-zA-Z0-9_\-äöüÄÖÜ ]/g, "_");
      const fileName = item.fileName || `ES_COMP_${safeComp}_${dateStr}`;

      const content = [
        `# ${fileName}`,
        `**Datum:** ${dateStr}  |  **Konkurrent:** ${item.competitorName}  |  **Plattform:** ${item.platform}`,
        `**Quelle:** ${item.sourceUrl}`,
        ``,
        `---`,
        `## Transkript`,
        item.transcript || "[nicht verfügbar]",
        ``,
        `### Hook`, item.transcriptHook || "",
        `### Body`, item.transcriptBody || "",
        `### CTA`, item.transcriptCta || "",
        ``,
        `---`,
        `## Analyse`,
        `**Angle:** ${item.analysisAngle}`,
        `**Zielgruppe:** ${item.analysisTargetAudience}`,
        `**Mechanik:** ${item.analysisMechanic}`,
        `**Offer-Struktur:** ${item.analysisOfferStructure}`,
        `**Warum es funktioniert:** ${item.analysisWhyItWorks}`,
        `**Visual-Pattern:** ${item.analysisVisualPattern}`,
        ``,
        `---`,
        `## EasySignals Adaptionen`,
        `### Hook 1 (Neugier)`, item.adaptHook1 || "",
        `### Hook 2 (Pain)`, item.adaptHook2 || "",
        `### Hook 3 (Transformation)`, item.adaptHook3 || "",
        `### Body`, item.adaptBody || "",
        `### CTA`, item.adaptCta || "",
        ``,
        `### HeyGen-Skript`, item.adaptHeygenScript || "",
        ``,
        `### Telegram-Post`, item.adaptTelegramPost || "",
        ``,
        `### Nano-Banana-Prompt`, item.adaptNanaBananaPrompt || "",
        ``,
        `---`,
        `**Dateiname:** ${fileName}`,
        `**Drive-Ordner:** ${item.driveFolderPath || "03_Competitor_Research/04_EasySignals_Adaptations/"}`,
      ].join("\n");

      const tmpDir = path.join(os.tmpdir(), `vr_export_${input.id}_${Date.now()}`);
      mkdirSync(tmpDir, { recursive: true });
      const filePath = path.join(tmpDir, `${fileName}.md`);
      writeFileSync(filePath, content, "utf-8");

      const rcloneConfig = "/home/ubuntu/.gdrive-rclone.ini";
      const drivePath = item.driveFolderPath || `03_Competitor_Research/04_EasySignals_Adaptations/${safeComp}`;
      const remotePath = `manus_google_drive:Easy Signals/${drivePath}`;

      try {
        execSync(`rclone mkdir "${remotePath}" --config "${rcloneConfig}"`, { timeout: 15000 });
        execSync(`rclone copyto "${filePath}" "${remotePath}/${fileName}.md" --config "${rcloneConfig}"`, { timeout: 30000 });
        await updateVideoResearch(input.id, {
          driveUrl: `https://drive.google.com/drive/search?q=${encodeURIComponent(fileName)}`,
        });
      } finally {
        try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }

      return { success: true, driveUrl: `https://drive.google.com/drive/search?q=${encodeURIComponent(fileName)}` };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteVideoResearch(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ─── Telegram Content Bot Router ────────────────────────────────────────────
const EASYSIGNALS_SYSTEM_PROMPT = `Du bist der Content-Operator von EasySignals, einer exklusiven Trading-Marke aus der Schweiz (DACH-Fokus).

EasySignals steht für: Community, Status, Führung, Resultate, Struktur, System, Komfort, Exklusivität.
Das Gesicht: Livio Glausen / LivioSwiss.

Kernangebote:
- Signalgruppe (kostenlose Community, Gold/XAUUSD Fokus)
- LAT System (automatisches Trade-Copying, Plug-and-Play)
- Passing Service / Prop-Firm (limitiert, FOMO, Warteliste)
- Coaching / Bootcamp (Struktur, Umsetzung, echte Regeln)

Zielgruppen: Anfänger mit Scam-Angst, Leute mit wenig Zeit, frustrierte Trader, Prop-Firm-Interessenten, Community-getriebene Menschen.

Tonalität: direkt, emotional, klar, stark, modern, hochwertig, präzise, conversion-orientiert, sprechbar, organisch, teils provokativ, community-nah.

Sprache für Telegram: Berndeutsch / Schweizerdeutsch – echtes, natürliches, lokales Berndeutsch. NICHT Hochdeutsch mit Schweizer Wörtern.

Vermeide: generische Standard-Copy, langweilige Motivationssprüche, Agentur-Blabla, trockenen Finanzsprech, KI-Haftigkeit.`;

const CONTENT_TYPES = [
  { type: "tip" as const, label: "Trading-Tipp", prompt: "Schreib einen praktischen Trading-Tipp auf Berndeutsch. Konkret, umsetzbar, kein Blabla. Mit 1-2 passenden Emojis." },
  { type: "insight" as const, label: "Markt-Insight", prompt: "Schreib einen Markt-Insight über Gold (XAUUSD) oder allgemein Trading auf Berndeutsch. Zeig Expertise ohne Theorie-Overload." },
  { type: "motivation" as const, label: "Motivation", prompt: "Schreib einen starken Motivationspost auf Berndeutsch. Nicht generisch. Bezug auf Trading, Disziplin, System. Kurz und kraftvoll." },
  { type: "market_update" as const, label: "Marktupdate", prompt: "Schreib ein kurzes Marktupdate auf Berndeutsch. Gold/XAUUSD Fokus. Zeig was gerade passiert und was das für Trader bedeutet." },
  { type: "signal_preview" as const, label: "Signal-Preview", prompt: "Schreib einen FOMO-starken Signal-Preview Post auf Berndeutsch. Zeig dass heute Signale kommen / kamen. Community-Building. Exklusivität." },
  { type: "education" as const, label: "Education", prompt: "Schreib einen Education-Post auf Berndeutsch. Erkläre ein Trading-Konzept einfach und direkt. Kein Lehrbuch-Stil." },
  { type: "social_proof" as const, label: "Social Proof", prompt: "Schreib einen Social-Proof Post auf Berndeutsch. Zeig Resultate, Community-Erfolge oder Testimonials. Trust aufbauen ohne Scam-Feeling." },
];

async function sendToTelegram(botToken: string, chatId: string, textContent: string, imageUrl?: string | null) {
  if (imageUrl) {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: textContent, parse_mode: "HTML" }),
    });
    const data = await res.json() as any;
    if (!data.ok) throw new Error(data.description ?? "Telegram API Fehler");
    return String(data.result?.message_id);
  } else {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: textContent, parse_mode: "HTML" }),
    });
    const data = await res.json() as any;
    if (!data.ok) throw new Error(data.description ?? "Telegram API Fehler");
    return String(data.result?.message_id);
  }
}

async function generateTelegramContent(contentType?: string, customTopic?: string) {
  const types = CONTENT_TYPES;
  const selectedType = contentType
    ? types.find(t => t.type === contentType) ?? types[Math.floor(Math.random() * types.length)]
    : types[Math.floor(Math.random() * types.length)];
  const topicHint = customTopic ? `\n\nThema des Posts: ${customTopic}` : "";

  const textResponse = await invokeLLM({
    messages: [
      { role: "system", content: EASYSIGNALS_SYSTEM_PROMPT },
      { role: "user", content: `${selectedType.prompt}${topicHint}\n\nDer Post soll 3-6 Zeilen lang sein. Direkt, stark, kein Fülltext. Für Telegram optimiert. Kein Hashtag-Spam.` },
    ],
  });
  const textContent = (textResponse as any).choices?.[0]?.message?.content ?? "";

  const promptResponse = await invokeLLM({
    messages: [
      { role: "system", content: "You are an expert at writing image generation prompts for trading content. Write concise, visual, professional prompts." },
      { role: "user", content: `Create a short image generation prompt (max 2 sentences) for a Telegram post about: ${selectedType.label}. Professional, modern, dark theme, trading/finance aesthetic. No text in image. Context: ${textContent.slice(0, 200)}` },
    ],
  });
  const imagePrompt = (promptResponse as any).choices?.[0]?.message?.content ?? "professional trading chart dark theme";

  let imageUrl: string | undefined;
  try {
    const { generateImage } = await import("./_core/imageGeneration");
    const result = await generateImage({ prompt: imagePrompt });
    imageUrl = result.url;
  } catch (imgErr: any) {
    console.warn("[Telegram] Image generation failed:", imgErr.message?.slice(0, 100));
  }

  return { textContent, imageUrl, imagePrompt, selectedType };
}

const telegramRouter = router({
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    return await getTelegramSettings(ctx.user.id) ?? {
      postingTimeHour: 9, postingTimeMinute: 0, isActive: true, defaultLanguage: "de", includeEmoji: true,
    };
  }),

  saveSettings: protectedProcedure
    .input(z.object({
      postingTimeHour: z.number().min(0).max(23),
      postingTimeMinute: z.number().min(0).max(59),
      isActive: z.boolean(),
      includeEmoji: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await upsertTelegramSettings({ userId: ctx.user.id, ...input, defaultLanguage: "de" });
      return { success: true };
    }),

  getPosts: protectedProcedure.query(async ({ ctx }) => {
    return await getTelegramPosts(ctx.user.id, 50);
  }),

  generatePost: protectedProcedure
    .input(z.object({
      contentType: z.enum(["tip", "insight", "motivation", "market_update", "signal_preview", "education", "social_proof"]).optional(),
      customTopic: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { textContent, imageUrl, imagePrompt, selectedType } = await generateTelegramContent(input.contentType, input.customTopic);
      const postId = await createTelegramPost({
        userId: ctx.user.id, textContent, imageUrl: imageUrl ?? null, imagePrompt,
        topic: input.customTopic ?? selectedType.label, contentType: selectedType.type, status: "draft",
      });
      return { id: postId, textContent, imageUrl, imagePrompt, contentType: selectedType.type };
    }),

  sendPost: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const post = await getTelegramPostById(input.id, ctx.user.id);
      if (!post) throw new Error("Post nicht gefunden");
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!botToken || !chatId) throw new Error("Telegram Bot Token oder Chat ID nicht konfiguriert");
      try {
        const messageId = await sendToTelegram(botToken, chatId, post.textContent, post.imageUrl);
        await updateTelegramPost(input.id, { status: "sent", sentAt: new Date(), telegramMessageId: messageId, chatId });
        return { success: true, messageId };
      } catch (err: any) {
        await updateTelegramPost(input.id, { status: "failed", errorMessage: err.message });
        throw new Error(`Telegram-Versand fehlgeschlagen: ${err.message}`);
      }
    }),

  updatePost: protectedProcedure
    .input(z.object({ id: z.number(), textContent: z.string(), imageUrl: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await updateTelegramPost(input.id, { textContent: input.textContent, imageUrl: input.imageUrl ?? null, status: "draft" });
      return { success: true };
    }),

  deletePost: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteTelegramPost(input.id, ctx.user.id);
      return { success: true };
    }),

  runDailyPost: protectedProcedure.mutation(async ({ ctx }) => {
    const settings = await getTelegramSettings(ctx.user.id);
    if (settings && !settings.isActive) return { skipped: true, reason: "Auto-Post deaktiviert" };
    const { textContent, imageUrl, imagePrompt, selectedType } = await generateTelegramContent();
    const postId = await createTelegramPost({
      userId: ctx.user.id, textContent, imageUrl: imageUrl ?? null, imagePrompt,
      topic: selectedType.label, contentType: selectedType.type, status: "draft",
    });
    if (!postId) return { skipped: true, reason: "DB-Fehler" };
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (botToken && chatId) {
      try {
        const messageId = await sendToTelegram(botToken, chatId, textContent, imageUrl);
        await updateTelegramPost(postId, { status: "sent", sentAt: new Date(), telegramMessageId: messageId, chatId });
      } catch (err: any) {
        await updateTelegramPost(postId, { status: "failed", errorMessage: err.message });
      }
    }
    return { success: true, postId, textContent, imageUrl };
  }),

  testConnection: protectedProcedure.mutation(async () => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN nicht gesetzt");
    if (!chatId) throw new Error("TELEGRAM_CHAT_ID nicht gesetzt");
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await res.json() as any;
    if (!data.ok) throw new Error(data.description ?? "Bot nicht erreichbar");
    return { ok: true, botName: data.result?.username, chatId };
  }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  meta: metaRouter,
  analytics: analyticsRouter,
  adLibrary: adLibraryRouter,
  transcripts: transcriptsRouter,
  documents: documentsRouter,
  competitors: competitorsRouter,
  batches: batchesRouter,
  brand: brandRouter,
  googleDrive: googleDriveRouter,
  automation: automationRouter,
  dashboard: dashboardRouter,
  heygen: heygenRouter,
  hooks: hooksRouter,
  videoResearch: videoResearchRouter,
  telegram: telegramRouter,
  metaInsights: metaInsightsRouter,
  adComments: adCommentsRouter,
  budgetRules: budgetRulesRouter,
  driveToMeta: driveToMetaRouter,
  contentBot: contentBotRouter,
  apiKeys: router({
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        const crypto = await import("crypto");
        const rawKey = `maw_${crypto.randomBytes(32).toString("hex")}`;
        const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
        const keyPreview = `${rawKey.slice(0, 12)}...${rawKey.slice(-6)}`;
        const id = await createApiKey({ userId: ctx.user.id, name: input.name, keyHash, keyPreview });
        return { id, name: input.name, key: rawKey, keyPreview };
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      return getApiKeysByUser(ctx.user.id);
    }),
    revoke: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await revokeApiKey(input.id, ctx.user.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
