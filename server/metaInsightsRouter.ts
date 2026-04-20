import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { saveInsights, getInsights, saveAiAnalysis, getLatestAiAnalysis, getAiAnalysisHistory } from "./metaInsightsDb";
import { getMetaConnection } from "./db";

const META_BASE = "https://graph.facebook.com/v19.0";
const META_TOKEN = process.env.META_ACCESS_TOKEN;
const META_ACCOUNT = "act_1093241318940799";

async function metaFetch(path: string, params: Record<string, string> = {}, token?: string) {
  const url = new URL(`${META_BASE}${path}`);
  url.searchParams.set("access_token", token ?? META_TOKEN ?? "");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Meta API error: ${res.status} ${await res.text()}`);
  return res.json() as Promise<any>;
}

function extractActions(actions: any[] = []) {
  const find = (type: string) => parseFloat(actions.find(a => a.action_type === type)?.value ?? "0");
  return {
    purchases: find("purchase") + find("omni_purchase") + find("offsite_conversion.fb_pixel_purchase"),
    leads: find("lead") + find("offsite_conversion.fb_pixel_lead"),
    addToCart: find("add_to_cart") + find("omni_add_to_cart"),
    viewContent: find("view_content"),
    initiatedCheckout: find("omni_initiated_checkout"),
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const metaInsightsRouter = router({

  // Sync: Daten von Meta API holen und in DB speichern
  sync: protectedProcedure
    .input(z.object({
      datePreset: z.enum(["today", "yesterday", "last_7d", "last_14d", "last_30d", "last_90d", "maximum"]).default("last_30d"),
      level: z.enum(["campaign", "adset", "ad"]).default("campaign"),
    }))
    .mutation(async ({ ctx, input }) => {
      const conn = await getMetaConnection(ctx.user.id);
      const token = conn?.accessToken ?? META_TOKEN;
      if (!token) throw new Error("Kein Meta Access Token konfiguriert");

      const accountId = conn?.adAccountId ?? META_ACCOUNT;

      // 1. Campaigns abrufen
      const campaignsData = await metaFetch(`/${accountId}/campaigns`, {
        fields: "id,name,status,objective,daily_budget,lifetime_budget",
        limit: "100",
      }, token);

      const campaignMap: Record<string, { name: string; status: string; objective: string; dailyBudget?: number }> = {};
      for (const c of (campaignsData.data ?? [])) {
        campaignMap[c.id] = {
          name: c.name,
          status: c.status,
          objective: c.objective,
          dailyBudget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : undefined,
        };
      }

      // 2. Insights abrufen
      const insightsData = await metaFetch(`/${accountId}/insights`, {
        fields: "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type,date_start,date_stop",
        date_preset: input.datePreset,
        level: input.level,
        limit: "200",
      }, token);

      const rows = (insightsData.data ?? []).map((d: any) => {
        const { purchases, leads } = extractActions(d.actions);
        const costPerActions = d.cost_per_action_type ?? [];
        const costPerPurchase = parseFloat(costPerActions.find((a: any) => a.action_type === "purchase")?.value ?? "0");
        const costPerLead = parseFloat(costPerActions.find((a: any) => a.action_type === "lead")?.value ?? "0");
        const spend = parseFloat(d.spend ?? "0");
        const roas = spend > 0 && purchases > 0 ? (purchases * 100) / spend : 0; // simplified ROAS estimate

        const campaignInfo = campaignMap[d.campaign_id] ?? {};

        return {
          userId: ctx.user.id,
          campaignId: d.campaign_id ?? "account",
          campaignName: d.campaign_name ?? "Account",
          adsetId: d.adset_id ?? null,
          adsetName: d.adset_name ?? null,
          adId: d.ad_id ?? null,
          adName: d.ad_name ?? null,
          level: input.level as "campaign" | "adset" | "ad",
          spend,
          impressions: parseInt(d.impressions ?? "0"),
          clicks: parseInt(d.clicks ?? "0"),
          reach: parseInt(d.reach ?? "0"),
          ctr: parseFloat(d.ctr ?? "0"),
          cpc: parseFloat(d.cpc ?? "0"),
          cpm: parseFloat(d.cpm ?? "0"),
          roas,
          purchases,
          leads,
          costPerPurchase,
          costPerLead,
          frequency: parseFloat(d.frequency ?? "0"),
          status: campaignInfo.status ?? null,
          objective: campaignInfo.objective ?? null,
          dailyBudget: campaignInfo.dailyBudget ?? null,
          dateStart: d.date_start,
          dateStop: d.date_stop,
          datePreset: input.datePreset,
          rawData: d,
        };
      });

      await saveInsights(ctx.user.id, rows);

      return {
        synced: rows.length,
        datePreset: input.datePreset,
        level: input.level,
        campaigns: Object.keys(campaignMap).length,
      };
    }),

  // Insights aus DB laden
  getInsights: protectedProcedure
    .input(z.object({
      datePreset: z.string().default("last_30d"),
      level: z.string().default("campaign"),
    }))
    .query(async ({ ctx, input }) => {
      return getInsights(ctx.user.id, input.datePreset, input.level);
    }),

  // KI-Analyse starten
  analyze: protectedProcedure
    .input(z.object({
      datePreset: z.string().default("last_30d"),
      forceRefresh: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Prüfen ob bereits eine aktuelle Analyse existiert (heute)
      if (!input.forceRefresh) {
        const latest = await getLatestAiAnalysis(ctx.user.id);
        if (latest) {
          const today = new Date().toISOString().split("T")[0];
          if (latest.analysisDate === today && latest.datePreset === input.datePreset) {
            return latest;
          }
        }
      }

      const insights = await getInsights(ctx.user.id, input.datePreset, "campaign");
      if (!insights || insights.length === 0) {
        throw new Error("Keine Daten vorhanden. Bitte zuerst synchronisieren.");
      }

      const totalSpend = insights.reduce((s, i) => s + (i.spend ?? 0), 0);
      const totalPurchases = insights.reduce((s, i) => s + (i.purchases ?? 0), 0);
      const avgRoas = totalSpend > 0 ? insights.reduce((s, i) => s + (i.roas ?? 0), 0) / insights.length : 0;

      const sorted = [...insights].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
      const topBySpend = sorted.slice(0, 5);
      const topByCtr = [...insights].sort((a, b) => (b.ctr ?? 0) - (a.ctr ?? 0)).slice(0, 3);

      const dataStr = insights.map(i =>
        `Kampagne: "${i.campaignName}" | Status: ${i.status ?? "?"} | Spend: CHF ${i.spend?.toFixed(2)} | Impressionen: ${i.impressions?.toLocaleString()} | Klicks: ${i.clicks} | CTR: ${i.ctr?.toFixed(2)}% | CPC: CHF ${i.cpc?.toFixed(2)} | CPM: CHF ${i.cpm?.toFixed(2)} | Käufe: ${i.purchases} | Leads: ${i.leads} | Tagesbudget: ${i.dailyBudget ? `CHF ${i.dailyBudget}` : "k.A."}`
      ).join("\n");

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Du bist ein erfahrener Meta Ads Performance-Marketing-Analyst für EasySignals (Trading-Signale, Schweizer Markt, CHF).
Analysiere die Kampagnendaten und gib strukturierte JSON-Antworten zurück.
Sei direkt, konkret und handlungsorientiert. Verwende Schweizer Franken (CHF).`,
          },
          {
            role: "user",
            content: `Analysiere diese Meta Ads Daten (Zeitraum: ${input.datePreset}) und gib eine strukturierte JSON-Analyse zurück:

${dataStr}

Gesamt: CHF ${totalSpend.toFixed(2)} ausgegeben, ${totalPurchases} Käufe/Conversions, Ø ROAS: ${avgRoas.toFixed(2)}

Antworte NUR mit validem JSON in diesem Format:
{
  "summary": "2-3 Sätze Zusammenfassung der Performance",
  "overallScore": 7.5,
  "topPerformers": [
    {"name": "Kampagnenname", "reason": "Warum gut", "action": "Was tun", "metric": "CTR 4.2%"}
  ],
  "underperformers": [
    {"name": "Kampagnenname", "reason": "Warum schlecht", "action": "Pausieren/Anpassen", "metric": "CPC CHF 8.50"}
  ],
  "budgetRecommendations": [
    {"campaign": "Name", "currentBudget": 100, "recommendedBudget": 150, "reason": "Warum erhöhen/senken", "priority": "high"}
  ],
  "actionItems": [
    {"priority": "high", "action": "Konkrete Handlung", "campaign": "Kampagnenname oder 'Alle'", "expectedImpact": "Erwarteter Effekt"}
  ],
  "insights": [
    {"title": "Insight Titel", "description": "Beschreibung", "type": "opportunity|warning|info"}
  ]
}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "meta_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                overallScore: { type: "number" },
                topPerformers: { type: "array", items: { type: "object", properties: { name: { type: "string" }, reason: { type: "string" }, action: { type: "string" }, metric: { type: "string" } }, required: ["name", "reason", "action", "metric"], additionalProperties: false } },
                underperformers: { type: "array", items: { type: "object", properties: { name: { type: "string" }, reason: { type: "string" }, action: { type: "string" }, metric: { type: "string" } }, required: ["name", "reason", "action", "metric"], additionalProperties: false } },
                budgetRecommendations: { type: "array", items: { type: "object", properties: { campaign: { type: "string" }, currentBudget: { type: "number" }, recommendedBudget: { type: "number" }, reason: { type: "string" }, priority: { type: "string" } }, required: ["campaign", "currentBudget", "recommendedBudget", "reason", "priority"], additionalProperties: false } },
                actionItems: { type: "array", items: { type: "object", properties: { priority: { type: "string" }, action: { type: "string" }, campaign: { type: "string" }, expectedImpact: { type: "string" } }, required: ["priority", "action", "campaign", "expectedImpact"], additionalProperties: false } },
                insights: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, type: { type: "string" } }, required: ["title", "description", "type"], additionalProperties: false } },
              },
              required: ["summary", "overallScore", "topPerformers", "underperformers", "budgetRecommendations", "actionItems", "insights"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content as string;
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error("KI-Analyse konnte nicht geparst werden");
      }

      const today = new Date().toISOString().split("T")[0];
      const analysisData = {
        userId: ctx.user.id,
        analysisDate: today,
        datePreset: input.datePreset,
        summary: parsed.summary,
        topPerformers: parsed.topPerformers,
        underperformers: parsed.underperformers,
        budgetRecommendations: parsed.budgetRecommendations,
        actionItems: parsed.actionItems,
        insights: parsed.insights,
        overallScore: parsed.overallScore,
        totalSpend,
        totalRevenue: totalPurchases * 100, // rough estimate
        avgRoas,
      };

      await saveAiAnalysis(analysisData);
      return analysisData;
    }),

  // Letzte Analyse laden
  getLatestAnalysis: protectedProcedure.query(async ({ ctx }) => {
    return getLatestAiAnalysis(ctx.user.id);
  }),

  // Analyse-Historie
  getAnalysisHistory: protectedProcedure.query(async ({ ctx }) => {
    return getAiAnalysisHistory(ctx.user.id, 10);
  }),

  // Ad-Level Insights (mit Creative-Thumbnails)
  getAdInsights: protectedProcedure
    .input(z.object({
      datePreset: z.enum(["today", "yesterday", "last_7d", "last_14d", "last_30d", "last_90d", "maximum"]).default("last_30d"),
      sortBy: z.enum(["spend", "ctr", "cpc", "impressions", "leads"]).default("spend"),
    }))
    .query(async ({ ctx, input }) => {
      const conn = await getMetaConnection(ctx.user.id);
      const token = conn?.accessToken ?? META_TOKEN;
      if (!token) throw new Error("Kein Meta Access Token konfiguriert");
      const accountId = conn?.adAccountId ?? META_ACCOUNT;

      // Ad-Level Insights
      const insightsData = await metaFetch(`/${accountId}/insights`, {
        fields: "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,reach,actions,date_start,date_stop",
        date_preset: input.datePreset,
        level: "ad",
        limit: "100",
      }, token);

      const ads = insightsData.data ?? [];

      // Creative-Thumbnails parallel abrufen (max 20 um Rate-Limits zu vermeiden)
      const adsWithCreatives = await Promise.all(
        ads.slice(0, 50).map(async (ad: any) => {
          const actions = extractActions(ad.actions);
          const spend = parseFloat(ad.spend ?? "0");
          const leads = actions.leads;
          const costPerLead = leads > 0 ? spend / leads : 0;

          let thumbnailUrl: string | null = null;
          let adText: string | null = null;
          let adTitle: string | null = null;
          let creativeId: string | null = null;

          try {
            const adData = await metaFetch(`/${ad.ad_id}`, {
              fields: "creative",
            }, token);
            creativeId = adData.creative?.id ?? null;

            if (creativeId) {
              const creative = await metaFetch(`/${creativeId}`, {
                fields: "thumbnail_url,body,title",
              }, token);
              thumbnailUrl = creative.thumbnail_url ?? null;
              adText = creative.body ?? null;
              adTitle = creative.title ?? null;
            }
          } catch {
            // Creative nicht verfügbar – kein Problem
          }

          return {
            adId: ad.ad_id,
            adName: ad.ad_name,
            adsetName: ad.adset_name,
            campaignName: ad.campaign_name,
            spend,
            impressions: parseInt(ad.impressions ?? "0"),
            clicks: parseInt(ad.clicks ?? "0"),
            ctr: parseFloat(ad.ctr ?? "0"),
            cpc: parseFloat(ad.cpc ?? "0"),
            cpm: parseFloat(ad.cpm ?? "0"),
            reach: parseInt(ad.reach ?? "0"),
            leads,
            purchases: actions.purchases,
            costPerLead,
            thumbnailUrl,
            adText,
            adTitle,
            creativeId,
            dateStart: ad.date_start,
            dateStop: ad.date_stop,
          };
        })
      );

      // Sortierung
      const sorted = adsWithCreatives.sort((a, b) => {
        if (input.sortBy === "ctr") return b.ctr - a.ctr;
        if (input.sortBy === "cpc") return a.cpc - b.cpc; // niedrigster CPC = besser
        if (input.sortBy === "impressions") return b.impressions - a.impressions;
        if (input.sortBy === "leads") return b.leads - a.leads;
        return b.spend - a.spend; // default: spend
      });

      return sorted;
    }),

  // KI-Analyse auf Ad-Ebene
  analyzeAds: protectedProcedure
    .input(z.object({
      datePreset: z.enum(["today", "yesterday", "last_7d", "last_14d", "last_30d", "last_90d", "maximum"]).default("last_30d"),
    }))
    .mutation(async ({ ctx, input }) => {
      const conn = await getMetaConnection(ctx.user.id);
      const token = conn?.accessToken ?? META_TOKEN;
      if (!token) throw new Error("Kein Meta Access Token konfiguriert");
      const accountId = conn?.adAccountId ?? META_ACCOUNT;

      const insightsData = await metaFetch(`/${accountId}/insights`, {
        fields: "ad_id,ad_name,adset_name,campaign_name,spend,impressions,clicks,ctr,cpc,actions",
        date_preset: input.datePreset,
        level: "ad",
        limit: "50",
      }, token);

      const ads = (insightsData.data ?? []).map((ad: any) => {
        const actions = extractActions(ad.actions);
        const spend = parseFloat(ad.spend ?? "0");
        return {
          name: ad.ad_name,
          campaign: ad.campaign_name,
          adset: ad.adset_name,
          spend,
          impressions: parseInt(ad.impressions ?? "0"),
          ctr: parseFloat(ad.ctr ?? "0"),
          cpc: parseFloat(ad.cpc ?? "0"),
          leads: actions.leads,
          costPerLead: actions.leads > 0 ? spend / actions.leads : 0,
        };
      });

      if (ads.length === 0) return { recommendations: [], summary: "Keine Ad-Daten verfügbar." };

      const dataStr = ads.map((a: any) =>
        `"${a.name}" (${a.campaign}): CHF ${a.spend.toFixed(2)} spend, CTR ${a.ctr.toFixed(2)}%, CPC CHF ${a.cpc.toFixed(2)}, ${a.leads} Leads`
      ).join("\n");

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Du bist ein Meta Ads Creative Analyst. Antworte nur mit validem JSON." },
          {
            role: "user",
            content: `Analysiere diese Ads auf Creative-Ebene (${input.datePreset}, CHF):\n${dataStr}\n\nJSON Format:\n{"summary":"...","topCreatives":[{"name":"...","reason":"...","action":"skalieren","priority":"high"}],"weakCreatives":[{"name":"...","reason":"...","action":"pausieren","priority":"high"}],"recommendations":[{"ad":"...","recommendation":"...","expectedImpact":"..."}]}`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content as string;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : content);
      } catch {
        return { summary: content, recommendations: [], topCreatives: [], weakCreatives: [] };
      }
    }),

  // Account-Übersicht
  getAccountOverview: protectedProcedure.query(async ({ ctx }) => {
    const conn = await getMetaConnection(ctx.user.id);
    const token = conn?.accessToken ?? META_TOKEN;
    if (!token) return null;
    const accountId = conn?.adAccountId ?? META_ACCOUNT;
    try {
      const data = await metaFetch(`/${accountId}`, {
        fields: "id,name,account_status,currency,spend_cap,amount_spent,balance",
      }, token);
      return data;
    } catch {
      return null;
    }
  }),
});
