/**
 * Täglicher Scheduler für den automatischen Konkurrenten-Scan und Batch-Generierung.
 * Läuft täglich um 07:00 Uhr und scannt alle aktiven Konkurrenten.
 */

import { getActiveCompetitors, getMetaConnection, saveCompetitorAd, updateCompetitor, createScanLog, updateScanLog, getBrandSettings, createAdBatch, markCompetitorAdProcessed, getCompetitorAdsByCompetitor } from "./db";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";

// ─── Ad Library Fetch ─────────────────────────────────────────────────────────

async function fetchAdLibrary(query: string, country: string, accessToken: string) {
  const url = new URL("https://graph.facebook.com/v19.0/ads_archive");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("ad_reached_countries", `["${country}"]`);
  url.searchParams.set("ad_type", "ALL");
  url.searchParams.set("limit", "15");
  url.searchParams.set("fields", "id,ad_creation_time,ad_delivery_start_time,page_name,page_id,ad_creative_bodies,ad_creative_link_titles");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data || [];
}

function generateMockAds(query: string, country: string) {
  const mockTexts = [
    `Entdecke jetzt unsere ${query} Lösung – über 10.000 zufriedene Kunden vertrauen uns täglich. Kostenlos testen!`,
    `${query} war noch nie so einfach. Spare Zeit und steigere deinen Umsatz. Jetzt 14 Tage gratis!`,
    `Warum ${query} kompliziert machen? Wir haben die Antwort. Teste jetzt kostenlos und überzeuge dich selbst.`,
  ];
  return mockTexts.map((text, i) => ({
    id: `mock_sched_${i}_${Date.now()}`,
    page_name: `${query} Brand ${i + 1}`,
    page_id: `mock_page_${i}`,
    ad_creative_bodies: [text],
    ad_creative_link_titles: [`${query} – Jetzt entdecken`],
    ad_delivery_start_time: new Date().toISOString(),
    _isMock: true,
  }));
}

// ─── KI Batch Generator ───────────────────────────────────────────────────────

async function generateBatch(adText: string, brandContext: string, competitorName: string) {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Du bist ein erstklassiger Performance-Marketing-Copywriter für Easy Signals. Erstelle aus dem Konkurrenz-Ad-Text einen vollständigen Ad-Batch auf Deutsch.

Kontext: ${brandContext}

Antworte NUR im JSON-Format:
{
  "body": "Hauptskript (3-5 Sätze, authentisch, für Kamera)",
  "cta": "Call-to-Action (1 Satz)",
  "hook1": "Hook 1 – Neugier wecken",
  "hook2": "Hook 2 – Problem/Schmerz",
  "hook3": "Hook 3 – Ergebnis/Transformation",
  "heygenScript": "Vollständiges Avatar-Skript mit [PAUSE] Markierungen"
}`,
      },
      {
        role: "user",
        content: `Konkurrent: ${competitorName}\n\nAd-Text:\n${adText}`,
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
  if (!content) throw new Error("Leere KI-Antwort");
  return JSON.parse(typeof content === "string" ? content : JSON.stringify(content)) as {
    body: string; cta: string; hook1: string; hook2: string; hook3: string; heygenScript: string;
  };
}

// ─── Daily Scan Job ───────────────────────────────────────────────────────────

export async function runDailyScan(userId: number): Promise<{
  scanned: number;
  totalNewAds: number;
  batchesCreated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let totalNewAds = 0;
  let batchesCreated = 0;

  const [activeCompetitors, metaConn, brandSettings] = await Promise.all([
    getActiveCompetitors(userId),
    getMetaConnection(userId),
    getBrandSettings(userId),
  ]);

  if (activeCompetitors.length === 0) {
    return { scanned: 0, totalNewAds: 0, batchesCreated: 0, errors: ["Keine aktiven Konkurrenten konfiguriert."] };
  }

  const brandContext = brandSettings
    ? `Marke: ${brandSettings.brandName}. ${brandSettings.brandDescription || ""}. Zielgruppe: ${brandSettings.targetAudience || ""}. USPs: ${brandSettings.uniqueSellingPoints || ""}.`
    : "Easy Signals – digitale Marketing-Lösungen für Unternehmen.";

  for (const competitor of activeCompetitors) {
    const logResult = await createScanLog({
      userId,
      competitorId: competitor.id,
      competitorName: competitor.name,
      status: "running",
    });
    const logId = (logResult as { insertId?: number })?.insertId;

    try {
      // Fetch ads
      let ads: Array<Record<string, unknown>> = [];
      let isMock = false;

      try {
        if (metaConn?.accessToken) {
          ads = await fetchAdLibrary(competitor.pageName || competitor.name, competitor.country, metaConn.accessToken);
        } else {
          throw new Error("Kein Access Token");
        }
      } catch {
        ads = generateMockAds(competitor.name, competitor.country);
        isMock = true;
      }

      // Save new ads
      let newAds = 0;
      for (const ad of ads) {
        const adText = (ad.ad_creative_bodies as string[])?.[0] || "";
        if (!adText) continue;
        await saveCompetitorAd({
          userId,
          competitorId: competitor.id,
          metaAdId: ad.id as string,
          pageName: (ad.page_name as string) || competitor.name,
          pageId: ad.page_id as string,
          adText,
          headline: (ad.ad_creative_link_titles as string[])?.[0],
          startDate: ad.ad_delivery_start_time as string,
          country: competitor.country,
          searchQuery: competitor.name,
          rawData: ad,
          isProcessed: false,
        });
        newAds++;
      }

      totalNewAds += newAds;

      // Update competitor stats
      await updateCompetitor(competitor.id, userId, {
        lastScannedAt: new Date(),
        totalAdsFound: (competitor.totalAdsFound || 0) + ads.length,
        newAdsSinceLastScan: newAds,
      });

      // Generate batches for unprocessed ads (max 2 per competitor per day)
      const unprocessedAds = (await getCompetitorAdsByCompetitor(userId, competitor.id))
        .filter(a => !a.isProcessed && a.adText)
        .slice(0, 2);

      let competitorBatches = 0;
      for (const ad of unprocessedAds) {
        if (!ad.adText) continue;
        try {
          const batch = await generateBatch(ad.adText, brandContext, ad.pageName || competitor.name);
          await createAdBatch({
            userId,
            title: `[Auto] ${competitor.name} – ${new Date().toLocaleDateString("de-DE")}`,
            sourceAdId: ad.id,
            sourceAdText: ad.adText,
            competitorName: ad.pageName || competitor.name,
            body: batch.body,
            cta: batch.cta,
            hook1: batch.hook1,
            hook2: batch.hook2,
            hook3: batch.hook3,
            heygenScript: batch.heygenScript,
            brandContext,
            language: "de",
            status: "ready",
          });
          await markCompetitorAdProcessed(ad.id);
          competitorBatches++;
          batchesCreated++;
        } catch (e) {
          errors.push(`Batch-Fehler für ${competitor.name}: ${e instanceof Error ? e.message : "Unbekannt"}`);
        }
      }

      if (logId) {
        await updateScanLog(logId, {
          status: "completed",
          adsFound: ads.length,
          newAds,
          batchesCreated: competitorBatches,
          completedAt: new Date(),
        });
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
      errors.push(`Scan-Fehler für ${competitor.name}: ${msg}`);
      if (logId) {
        await updateScanLog(logId, {
          status: "failed",
          errorMessage: msg,
          completedAt: new Date(),
        });
      }
    }
  }

  // Notify owner
  try {
    await notifyOwner({
      title: "🤖 Täglicher Ad-Scan abgeschlossen",
      content: `Gescannt: ${activeCompetitors.length} Konkurrenten\nNeue Ads: ${totalNewAds}\nBatches erstellt: ${batchesCreated}${errors.length > 0 ? `\nFehler: ${errors.join(", ")}` : ""}`,
    });
  } catch {
    // Notification failure is non-critical
  }

  return { scanned: activeCompetitors.length, totalNewAds, batchesCreated, errors };
}

// ─── Scheduler Setup ──────────────────────────────────────────────────────────

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startScheduler(userId: number) {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  // Check every hour if it's time to run the daily scan (07:00 UTC)
  schedulerInterval = setInterval(async () => {
    const now = new Date();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();

    // Run at 07:00 UTC (09:00 CEST)
    if (hour === 7 && minute < 5) {
      console.log(`[Scheduler] Starting daily scan for user ${userId}...`);
      try {
        const result = await runDailyScan(userId);
        console.log(`[Scheduler] Daily scan completed:`, result);
      } catch (e) {
        console.error(`[Scheduler] Daily scan failed:`, e);
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  console.log(`[Scheduler] Daily scan scheduler started for user ${userId}`);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Stopped");
  }
}
