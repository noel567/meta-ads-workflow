/**
 * Täglicher Scheduler für den automatischen Konkurrenten-Scan und Batch-Generierung.
 * Läuft täglich um 07:00 Uhr und scannt alle aktiven Konkurrenten.
 */

import { getActiveCompetitors, getMetaConnection, saveCompetitorAd, updateCompetitor, createScanLog, updateScanLog, getBrandSettings, createAdBatch, markCompetitorAdProcessed, getCompetitorAdsByCompetitor, getGoogleDriveConnection, updateAdBatch, createDocument, getTelegramSettings, createTelegramPost, updateTelegramPost, getDb } from "./db";
import { saveInsights, saveAiAnalysis, getLatestAiAnalysis } from "./metaInsightsDb";
import { runAllBudgetRules } from "./budgetRulesRouter";
import { runContentBotScheduler } from "./contentBotRouter";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { imageAds, videoAds, adHeadlines, knowledgeFiles } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";


// ─── Daily Telegram Post ─────────────────────────────────────────────────────

const TELEGRAM_SYSTEM_PROMPT = `Du bist der Content-Operator von EasySignals, einer exklusiven Trading-Marke aus der Schweiz (DACH-Fokus).

EasySignals Content Operating System (COS) – Kern-Regeln:
- EasySignals steht für: Community, Status, Führung, Resultate, Struktur, System, Komfort, Exklusivität
- Zielgruppe: DACH-Trader (25-45), die Klarheit, System und Resultate suchen
- Persona: Livio, Gründer EasySignals – direkt, authentisch, kein Agentur-Blabla
- Telegram ist: Community-Bindung, Führung, Vertrauensaufbau, Markt-Kommunikation, Hype, Proof, Kultur, Conversion
- Posts sollen klingen als kämen sie direkt von Livio – nicht von einer anonymen Brand

Sprache:
- Berndeutsch / Schweizerdeutsch – echtes, natürliches, lokales Berndeutsch (NICHT Hochdeutsch mit Schweizer Wörtern, NICHT Zürideutsch)
- Tonalität: direkt, emotional, klar, stark, modern, hochwertig, präzise, community-nah

Vermeide:
- generische Standard-Copy, langweilige Motivationssprüche, KI-Haftigkeit
- unnatürliches Schweizerdeutsch, zu viele Gedankenstriche, leblose Sprache
- trockenen Finanzsprech, zu viel Theorie

Post-Kategorien:
1. Trust-Posts: Verlusttage einordnen, realistische Erwartungen, Marktphasen erklären, Geduld, Disziplin
2. Proof-Posts: Resultate, Screenshots, Auszahlungen, Community-Erfolge, Feedback
3. Conversion-Posts: Challenge-Plätze, Warteliste, LAT-System, Reminder, Sonderzugang
4. Community-Posts: Umfragen, Fragen, Behind-the-scenes, persönliche Worte, Gruppenaktivierung
5. Hype-Posts: etwas kommt, limitierte Plätze, Countdowns, Ankündigungen, nur für wenige
6. Education-Posts: CRV, Trefferquote, Seitwärtsphase, Gold-Markt, Mindset, Anfängerfehler

Struktur pro Post:
- Ziel klar definieren
- Haupttext: 3-6 Zeilen, direkt, stark, kein Fülltext
- 1-2 passende Emojis
- optional: kurzer CTA`;

const TELEGRAM_CONTENT_TYPES = [
  { type: "tip" as const, label: "Trading-Tipp", prompt: "Schreib einen praktischen Trading-Tipp auf Berndeutsch. Konkret, umsetzbar, kein Blabla. Mit 1-2 passenden Emojis." },
  { type: "insight" as const, label: "Markt-Insight", prompt: "Schreib einen Markt-Insight über Gold (XAUUSD) auf Berndeutsch. Zeig Expertise ohne Theorie-Overload." },
  { type: "motivation" as const, label: "Motivation", prompt: "Schreib einen starken Motivationspost auf Berndeutsch. Bezug auf Trading, Disziplin, System. Kurz und kraftvoll." },
  { type: "market_update" as const, label: "Marktupdate", prompt: "Schreib ein kurzes Marktupdate auf Berndeutsch. Gold/XAUUSD Fokus." },
  { type: "signal_preview" as const, label: "Signal-Preview", prompt: "Schreib einen FOMO-starken Signal-Preview Post auf Berndeutsch. Community-Building. Exklusivität." },
  { type: "education" as const, label: "Education", prompt: "Schreib einen Education-Post auf Berndeutsch. Erkläre ein Trading-Konzept einfach und direkt." },
  { type: "social_proof" as const, label: "Social Proof", prompt: "Schreib einen Social-Proof Post auf Berndeutsch. Trust aufbauen ohne Scam-Feeling." },
];

export async function runDailyTelegramPost(userId: number) {
  const settings = await getTelegramSettings(userId);
  if (settings && !settings.isActive) {
    console.log("[Telegram] Auto-Post deaktiviert, überspringe.");
    return;
  }

  const types = TELEGRAM_CONTENT_TYPES;
  const selectedType = types[Math.floor(Math.random() * types.length)];

  const textResponse = await invokeLLM({
    messages: [
      { role: "system", content: TELEGRAM_SYSTEM_PROMPT },
      { role: "user", content: `${selectedType.prompt}\n\nDer Post soll 3-6 Zeilen lang sein. Direkt, stark, kein Fülltext. Für Telegram optimiert.` },
    ],
  });
  const textContent = (textResponse as any).choices?.[0]?.message?.content ?? "";

  const promptResponse = await invokeLLM({
    messages: [
      { role: "system", content: "Write a short image generation prompt (max 2 sentences) for a professional trading Telegram post. Dark theme, no text in image." },
      { role: "user", content: `Image for: ${selectedType.label}. Context: ${textContent.slice(0, 200)}` },
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

  const postId = await createTelegramPost({
    userId,
    textContent,
    imageUrl: imageUrl ?? null,
    imagePrompt,
    topic: selectedType.label,
    contentType: selectedType.type,
    status: "draft",
  });

  if (!postId) return;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (botToken && chatId) {
    try {
      let messageId: string | undefined;
      if (imageUrl) {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: textContent, parse_mode: "HTML" }),
        });
        const data = await res.json() as any;
        if (data.ok) messageId = String(data.result?.message_id);
        else throw new Error(data.description);
      } else {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: textContent, parse_mode: "HTML" }),
        });
        const data = await res.json() as any;
        if (data.ok) messageId = String(data.result?.message_id);
        else throw new Error(data.description);
      }
      await updateTelegramPost(postId, { status: "sent", sentAt: new Date(), telegramMessageId: messageId, chatId });
      console.log(`[Telegram] Daily post sent successfully (message_id: ${messageId})`);
    } catch (err: any) {
      await updateTelegramPost(postId, { status: "failed", errorMessage: err.message });
      console.error(`[Telegram] Daily post failed:`, err.message);
    }
  } else {
    console.warn("[Telegram] Bot token or chat ID not set, post saved as draft.");
  }
}


// ─── Direct Telegram Post (no userId required) ──────────────────────────────

export async function sendTelegramDirectPost(chatIdOverride?: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = chatIdOverride || process.env.TELEGRAM_CHAT_ID;
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN nicht gesetzt");
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID nicht gesetzt");

  const types = TELEGRAM_CONTENT_TYPES;
  const selectedType = types[Math.floor(Math.random() * types.length)];

  const textResponse = await invokeLLM({
    messages: [
      { role: "system", content: TELEGRAM_SYSTEM_PROMPT },
      { role: "user", content: `${selectedType.prompt}\n\nDer Post soll 3-6 Zeilen lang sein. Direkt, stark, kein Fülltext. Für Telegram optimiert.` },
    ],
  });
  const textContent = (textResponse as any).choices?.[0]?.message?.content ?? "";

  const promptResponse = await invokeLLM({
    messages: [
      { role: "system", content: "Write a short image generation prompt (max 2 sentences) for a professional trading Telegram post. Dark theme, no text in image." },
      { role: "user", content: `Image for: ${selectedType.label}. Context: ${textContent.slice(0, 200)}` },
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

  // Send to Telegram
  if (imageUrl) {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: textContent, parse_mode: "HTML" }),
    });
    const data = await res.json() as any;
    if (!data.ok) throw new Error(data.description);
    console.log(`[Telegram] Direct post sent (message_id: ${data.result?.message_id})`);
    return { messageId: data.result?.message_id, text: textContent, imageUrl, topic: selectedType.label };
  } else {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: textContent, parse_mode: "HTML" }),
    });
    const data = await res.json() as any;
    if (!data.ok) throw new Error(data.description);
    console.log(`[Telegram] Direct text post sent (message_id: ${data.result?.message_id})`);
    return { messageId: data.result?.message_id, text: textContent, topic: selectedType.label };
  }
}

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

// ─── Google Drive Helpers ────────────────────────────────────────────────────

async function driveCreateFolder(accessToken: string, name: string, parentId?: string): Promise<string | null> {
  try {
    // First: check if folder already exists (idempotent)
    const parentQuery = parentId ? ` and '${parentId}' in parents` : " and 'root' in parents";
    const q = `name='${name.replace(/'/g, "\\'")}'${parentQuery} and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchUrl = new URL("https://www.googleapis.com/drive/v3/files");
    searchUrl.searchParams.set("q", q);
    searchUrl.searchParams.set("fields", "files(id,name)");
    const searchRes = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const searchData = await searchRes.json();
    if (!searchData.error && searchData.files?.length > 0) {
      return searchData.files[0].id as string; // Reuse existing folder
    }

    // Create new folder if not found
    const metadata: Record<string, unknown> = { name, mimeType: "application/vnd.google-apps.folder" };
    if (parentId) metadata.parents = [parentId];
    const res = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    });
    const data = await res.json();
    if (data.error) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

async function driveUploadFile(accessToken: string, name: string, content: string, folderId?: string): Promise<{ id: string; webViewLink?: string } | null> {
  try {
    const metadata: Record<string, unknown> = { name, mimeType: "application/vnd.google-apps.document" };
    if (folderId) metadata.parents = [folderId];
    const boundary = "batch_boundary_sched";
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
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    const data = await res.json();
    if (data.error) return null;
    return data as { id: string; webViewLink?: string };
  } catch {
    return null;
  }
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

  // ─── Auto Google Drive Upload + Daily Summary ──────────────────────────────
  try {
    const driveConn = await getGoogleDriveConnection(userId);
    if (driveConn?.isActive && driveConn.accessToken) {
      const dateStr = new Date().toISOString().split("T")[0];

      // Create date folder under root
      const dateFolderId = await driveCreateFolder(driveConn.accessToken, dateStr, driveConn.rootFolderId || undefined);

      // Upload each batch to competitor subfolder
      const { getAdBatches } = await import("./db");
      const todayBatches = (await getAdBatches(userId)).filter(b => {
        const d = new Date(b.generatedAt);
        return d.toISOString().split("T")[0] === dateStr && !b.googleDriveFileId;
      });

      for (const batch of todayBatches) {
        try {
          // Create competitor subfolder under date folder
          const competitorFolderId = batch.competitorName && dateFolderId
            ? await driveCreateFolder(driveConn.accessToken, batch.competitorName, dateFolderId)
            : dateFolderId;

          const content = `# ${batch.title}\n\n## 🎯 Hook 1\n${batch.hook1}\n\n## 🎯 Hook 2\n${batch.hook2}\n\n## 🎯 Hook 3\n${batch.hook3}\n\n## 📝 Body\n${batch.body}\n\n## 🚀 CTA\n${batch.cta}\n\n---\n\n## 🤖 HeyGen Skript\n${batch.heygenScript || `${batch.hook1}\n\n${batch.body}\n\n${batch.cta}`}\n\n---\n*Automatisch generiert am ${new Date().toLocaleDateString("de-DE")} | Quelle: ${batch.competitorName || "Auto"} | Easy Signals*`;

          const file = await driveUploadFile(driveConn.accessToken, `${batch.title}.md`, content, competitorFolderId || undefined);
          if (file) {
            await updateAdBatch(batch.id, userId, { googleDriveFileId: file.id, googleDriveUrl: file.webViewLink, status: "exported" });
          }
        } catch {
          // Non-critical: continue with next batch
        }
      }

      // Create daily summary Google Doc
      if (batchesCreated > 0 && dateFolderId) {
        const summaryContent = `# Easy Signals – Täglicher Ad-Bericht ${dateStr}\n\n## Zusammenfassung\n- Gescannte Konkurrenten: ${activeCompetitors.length}\n- Neue Ads gefunden: ${totalNewAds}\n- Batches erstellt: ${batchesCreated}${errors.length > 0 ? `\n- Fehler: ${errors.length}` : ""}\n\n## Konkurrenten\n${activeCompetitors.map(c => `- **${c.name}** (${c.country})`).join("\n")}\n\n## Nächste Schritte\n1. Batches im Dashboard prüfen und bearbeiten\n2. Beste Hooks für Teleprompter-Aufnahmen auswählen\n3. HeyGen-Skripte für Avatar-Videos nutzen\n\n---\n*Automatisch erstellt von Easy Signals Ad Workflow*`;

        const summaryFile = await driveUploadFile(driveConn.accessToken, `Easy Signals – Tagesbericht ${dateStr}.md`, summaryContent, dateFolderId);
        if (summaryFile) {
          await createDocument({
            userId,
            title: `Tagesbericht ${dateStr}`,
            content: summaryContent,
            format: "markdown",
            sourceType: "analysis",
            googleDriveFileId: summaryFile.id,
            googleDriveUrl: summaryFile.webViewLink,
          });
        }
      }
    }
  } catch (driveError) {
    console.error("[Scheduler] Google Drive upload failed:", driveError);
    // Non-critical
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

  // Check every 5 minutes if it's time to run the daily scan or Telegram post
  schedulerInterval = setInterval(async () => {
    const now = new Date();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();

    // Run competitor scan at 07:00 UTC (09:00 CEST)
    if (hour === 7 && minute < 5) {
      console.log(`[Scheduler] Starting daily scan for user ${userId}...`);
      try {
        const result = await runDailyScan(userId);
        console.log(`[Scheduler] Daily scan completed:`, result);
      } catch (e) {
        console.error(`[Scheduler] Daily scan failed:`, e);
      }
    }

    // Meta Ads daily analysis at 08:00 UTC (10:00 CEST)
    if (hour === 8 && minute < 5) {
      console.log(`[Scheduler] Running daily Meta Ads analysis for user ${userId}...`);
      try {
        await runDailyMetaAnalysis(userId);
        console.log(`[Scheduler] Daily Meta Ads analysis completed.`);
      } catch (e) {
        console.error(`[Scheduler] Daily Meta Ads analysis failed:`, e);
      }
    }

    // Budget-Regeln automatisch ausführen um 08:10 UTC (10:10 CEST)
    if (hour === 8 && minute >= 10 && minute < 15) {
      console.log(`[Scheduler] Running automated budget rules...`);
      try {
        await runAllBudgetRules();
        console.log(`[Scheduler] Budget rules executed.`);
      } catch (e) {
        console.error(`[Scheduler] Budget rules execution failed:`, e);
      }
    }

    // Creative Report at 08:05 UTC (10:05 CEST) – after Meta analysis
    if (hour === 8 && minute >= 5 && minute < 10) {
      console.log(`[Scheduler] Running daily Creative Report...`);
      try {
        await runDailyCreativeReport();
        console.log(`[Scheduler] Daily Creative Report sent.`);
      } catch (e) {
        console.error(`[Scheduler] Daily Creative Report failed:`, e);
      }
    }
    // Telegram daily post: use configured posting time from DB settings
    try {
      const settings = await getTelegramSettings(userId);
      // Default: 09:05 CEST = 07:05 UTC
      const postHourUTC = settings?.postingTimeHour !== undefined
        ? ((settings.postingTimeHour - 2 + 24) % 24)  // Convert CEST (UTC+2) to UTC
        : 7;
      const postMinute = settings?.postingTimeMinute ?? 5;

      if (hour === postHourUTC && minute >= postMinute && minute < postMinute + 5) {
        console.log(`[Scheduler] Running daily Telegram post for user ${userId} (configured time: ${settings?.postingTimeHour ?? 9}:${String(settings?.postingTimeMinute ?? 5).padStart(2, '0')} CEST)...`);
        try {
          await runDailyTelegramPost(userId);
          console.log(`[Scheduler] Daily Telegram post completed.`);
        } catch (e) {
          console.error(`[Scheduler] Daily Telegram post failed:`, e);
        }
      }
    } catch (settingsErr) {
      // Fallback: run at 07:05 UTC if settings unavailable
      if (hour === 7 && minute >= 5 && minute < 10) {
        console.log(`[Scheduler] Running daily Telegram post (fallback time) for user ${userId}...`);
        try {
          await runDailyTelegramPost(userId);
        } catch (e) {
          console.error(`[Scheduler] Daily Telegram post failed:`, e);
        }
      }
    }
    // Content Bot: alle 5 Minuten prüfen ob ein Post fällig ist
    try {
      await runContentBotScheduler(userId);
    } catch (e) {
      console.error(`[Scheduler] Content Bot Scheduler failed:`, e);
    }

    // Daily Image Ad Generation at 06:00 UTC (08:00 CEST)
    if (hour === 6 && minute < 5) {
      console.log(`[Scheduler] Running daily image ad generation for user ${userId}...`);
      try {
        await runDailyImageAdGeneration(userId);
        console.log(`[Scheduler] Daily image ad generation completed.`);
      } catch (e) {
        console.error(`[Scheduler] Daily image ad generation failed:`, e);
      }
    }

    // Daily Video Ad Script Generation at 06:15 UTC (08:15 CEST)
    if (hour === 6 && minute >= 15 && minute < 20) {
      console.log(`[Scheduler] Running daily video ad script generation for user ${userId}...`);
      try {
        await runDailyVideoAdScriptGeneration(userId);
        console.log(`[Scheduler] Daily video ad script generation completed.`);
      } catch (e) {
        console.error(`[Scheduler] Daily video ad script generation failed:`, e);
      }
    }

    // Daily Performance Sync at 09:00 UTC (11:00 CEST)
    if (hour === 9 && minute < 5) {
      console.log(`[Scheduler] Running daily performance sync for user ${userId}...`);
      try {
        await runDailyPerformanceSync(userId);
        console.log(`[Scheduler] Daily performance sync completed.`);
      } catch (e) {
        console.error(`[Scheduler] Daily performance sync failed:`, e);
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

// ─── Daily Creative Report (Telegram) ──────────────────────────────────────────

export async function runDailyCreativeReport() {
  const token = process.env.META_ACCESS_TOKEN;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !botToken || !chatId) {
    console.log("[CreativeReport] Missing META_ACCESS_TOKEN, TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID – skipping.");
    return;
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });

  // 1. Ad-Level Insights abrufen (letzte 7 Tage)
  const insightsUrl = new URL(`${META_BASE}/${META_ACCOUNT}/insights`);
  insightsUrl.searchParams.set("access_token", token);
  insightsUrl.searchParams.set("level", "ad");
  insightsUrl.searchParams.set("date_preset", "last_7d");
  insightsUrl.searchParams.set("fields", "ad_id,ad_name,campaign_name,spend,impressions,clicks,ctr,cpc,reach,actions");
  insightsUrl.searchParams.set("limit", "100");

  const insightsRes = await fetch(insightsUrl.toString());
  const insightsData = await insightsRes.json() as any;
  const ads: any[] = insightsData.data ?? [];

  if (ads.length === 0) {
    console.log("[CreativeReport] No ad-level data available.");
    return;
  }

  // 2. Ads aufbereiten
  const processed = ads.map((ad: any) => {
    const actions = ad.actions ?? [];
    const leads = parseFloat(actions.find((a: any) => a.action_type === "lead")?.value ?? "0");
    const spend = parseFloat(ad.spend ?? "0");
    const clicks = parseInt(ad.clicks ?? "0");
    const ctr = parseFloat(ad.ctr ?? "0");
    const cpc = parseFloat(ad.cpc ?? "0");
    const cpl = leads > 0 ? spend / leads : 9999;
    return { adName: ad.ad_name ?? "Unbekannt", campaignName: ad.campaign_name ?? "", spend, clicks, ctr, cpc, leads, cpl };
  }).filter((ad: any) => ad.spend > 0);

  if (processed.length === 0) {
    console.log("[CreativeReport] No ads with spend found.");
    return;
  }

  // 3. Top-3 (höchste CTR) und Flop-3 (niedrigste CTR mit Mindest-Spend)
  const sorted = [...processed].sort((a: any, b: any) => b.ctr - a.ctr);
  const top3 = sorted.slice(0, 3);
  const flop3 = [...processed]
    .filter((ad: any) => ad.spend >= 5)
    .sort((a: any, b: any) => a.ctr - b.ctr)
    .slice(0, 3);

  // 4. Telegram-Nachricht formatieren
  const formatAd = (ad: any, rank: number, isTop: boolean) => {
    const emoji = isTop ? ["🥇", "🥈", "🥉"][rank] : ["🔴", "🟠", "🟡"][rank];
    const name = ad.adName.length > 35 ? ad.adName.slice(0, 32) + "..." : ad.adName;
    const action = isTop
      ? (ad.ctr > 3 ? "→ Budget erhöhen" : "→ Weiter beobachten")
      : (ad.spend > 50 ? "→ Pausieren" : "→ Anpassen oder testen");
    return `${emoji} <b>${name}</b>\nCTR: ${ad.ctr.toFixed(2)}% | CPC: CHF ${ad.cpc.toFixed(2)} | Spend: CHF ${ad.spend.toFixed(0)}${ad.leads > 0 ? ` | Leads: ${ad.leads}` : ""}\n<i>${action}</i>`;
  };

  const totalSpend = processed.reduce((s: number, a: any) => s + a.spend, 0);
  const avgCtr = processed.reduce((s: number, a: any) => s + a.ctr, 0) / processed.length;

  const message = [
    `📊 <b>Daily Creative Report – ${dateStr}</b>`,
    ``,
    `💰 Total Spend (7d): <b>CHF ${totalSpend.toFixed(0)}</b>  |  Ø CTR: <b>${avgCtr.toFixed(2)}%</b>`,
    ``,
    `🏆 <b>Top 3 Creatives</b>`,
    ...top3.map((ad: any, i: number) => formatAd(ad, i, true)),
    ``,
    `⚠️ <b>Flop 3 Creatives</b>`,
    ...flop3.map((ad: any, i: number) => formatAd(ad, i, false)),
    ``,
    `💡 <i>Top Creatives skalieren, Flops pausieren oder testen.</i>`,
  ].join("\n");

  // 5. Senden
  const sendRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
  });
  const sendData = await sendRes.json() as any;
  if (sendData.ok) {
    console.log(`[CreativeReport] Daily creative report sent (message_id: ${sendData.result?.message_id})`);
  } else {
    throw new Error(`[CreativeReport] Telegram send failed: ${sendData.description}`);
  }
}

// ─── Daily Meta Ads Analysis ──────────────────────────────────────────────────

const META_BASE = "https://graph.facebook.com/v19.0";
const META_ACCOUNT = "act_1093241318940799";

async function metaFetchScheduler(path: string, params: Record<string, string> = {}, token: string) {
  const url = new URL(`${META_BASE}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Meta API error: ${res.status}`);
  return res.json() as Promise<any>;
}

export async function runDailyMetaAnalysis(userId: number) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    console.log("[MetaAnalysis] No META_ACCESS_TOKEN configured, skipping.");
    return;
  }

  const datePreset = "last_7d";

  // 1. Insights abrufen
  const insightsData = await metaFetchScheduler(`/${META_ACCOUNT}/insights`, {
    fields: "campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,reach,actions,date_start,date_stop",
    date_preset: datePreset,
    level: "campaign",
    limit: "200",
  }, token);

  const rows = (insightsData.data ?? []).map((d: any) => {
    const actions = d.actions ?? [];
    const purchases = parseFloat(actions.find((a: any) => a.action_type === "purchase")?.value ?? "0");
    const leads = parseFloat(actions.find((a: any) => a.action_type === "lead")?.value ?? "0");
    const spend = parseFloat(d.spend ?? "0");
    return {
      userId,
      campaignId: d.campaign_id ?? "account",
      campaignName: d.campaign_name ?? "Account",
      adsetId: null as string | null,
      adsetName: null as string | null,
      adId: null as string | null,
      adName: null as string | null,
      level: "campaign" as const,
      spend,
      impressions: parseInt(d.impressions ?? "0"),
      clicks: parseInt(d.clicks ?? "0"),
      reach: parseInt(d.reach ?? "0"),
      ctr: parseFloat(d.ctr ?? "0"),
      cpc: parseFloat(d.cpc ?? "0"),
      cpm: parseFloat(d.cpm ?? "0"),
      roas: 0,
      purchases,
      leads,
      costPerPurchase: 0,
      costPerLead: 0,
      frequency: 0,
      status: null as string | null,
      objective: null as string | null,
      dailyBudget: null as number | null,
      dateStart: d.date_start,
      dateStop: d.date_stop,
      datePreset,
      rawData: d,
    };
  });

  if (rows.length === 0) {
    console.log("[MetaAnalysis] No insights data available.");
    return;
  }

  await saveInsights(userId, rows);

  // 2. KI-Analyse
  const totalSpend = rows.reduce((s: number, i: any) => s + i.spend, 0);
  const dataStr = rows.map((i: any) =>
    `"${i.campaignName}": CHF ${i.spend.toFixed(2)} spend, ${i.impressions.toLocaleString()} impressions, CTR ${i.ctr.toFixed(2)}%, CPC CHF ${i.cpc.toFixed(2)}`
  ).join("\n");

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "Du bist ein Meta Ads Analyst. Antworte nur mit validem JSON." },
      {
        role: "user",
        content: `Analysiere diese Meta Ads Daten (letzte 7 Tage, CHF):
${dataStr}
Gesamt: CHF ${totalSpend.toFixed(2)}

JSON Format:
{"summary":"...","overallScore":7.5,"topPerformers":[{"name":"...","reason":"...","action":"...","metric":"..."}],"underperformers":[{"name":"...","reason":"...","action":"...","metric":"..."}],"budgetRecommendations":[{"campaign":"...","currentBudget":0,"recommendedBudget":0,"reason":"...","priority":"high"}],"actionItems":[{"priority":"high","action":"...","campaign":"...","expectedImpact":"..."}],"insights":[{"title":"...","description":"...","type":"opportunity"}]}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content as string;
  let parsed: any;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    console.error("[MetaAnalysis] Failed to parse AI response");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  await saveAiAnalysis({
    userId,
    analysisDate: today,
    datePreset,
    summary: parsed.summary ?? "",
    topPerformers: parsed.topPerformers ?? [],
    underperformers: parsed.underperformers ?? [],
    budgetRecommendations: parsed.budgetRecommendations ?? [],
    actionItems: parsed.actionItems ?? [],
    insights: parsed.insights ?? [],
    overallScore: parsed.overallScore ?? 5,
    totalSpend,
    totalRevenue: 0,
    avgRoas: 0,
  });

  await notifyOwner({
    title: "📊 Tägliche Meta Ads Analyse",
    content: `Score: ${parsed.overallScore}/10 | CHF ${totalSpend.toFixed(0)} spend | ${rows.length} Kampagnen analysiert\n\n${parsed.summary}`,
  });

  console.log(`[MetaAnalysis] Analysis saved for ${rows.length} campaigns, score: ${parsed.overallScore}`);
}

// ─── Daily Image Ad Generation ────────────────────────────────────────────────
const LIVIO_PHOTO_URL_SCHED = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663565941002/UojQwiICNYeKudJO.webp";
const IMAGE_ADS_DRIVE_FOLDER_ID = "1mtLVYa0VS_IEBwORVX1X0NLzbv1zeKtJ"; // EasySignals — Image Ads 2026

// 10 Ad-Angles für die tägliche Generierung (Fallback falls LLM-Konzepte fehlschlagen)
const DAILY_AD_ANGLES = [
  { angle: "social_proof", headline: "2.000+ Schweizer vertrauen täglich auf EasySignals", livio: true },
  { angle: "pain", headline: "Keine Zeit für Trading? In 15 Min täglich profitieren", livio: true },
  { angle: "results", headline: "Diese Woche im VIP Channel: +1.840 CHF Gewinn", livio: false },
  { angle: "authority", headline: "Livio – Founder EasySignals – zeigt dir sein System", livio: true },
  { angle: "fomo", headline: "Die grösste Trading-Community der Schweiz – bist du dabei?", livio: true },
  { angle: "direct", headline: "SIGNAL. KOPIEREN. PROFIT. – So einfach ist EasySignals", livio: true },
  { angle: "curiosity", headline: "Das LAT-System: Wie Schweizer Trader täglich Gewinne erzielen", livio: false },
  { angle: "trust", headline: "Auch Verlusttage gibt es – aber das System funktioniert", livio: true },
  { angle: "webinar", headline: "KOSTENLOSE LIVE SESSION – Signal kopieren, Profit machen", livio: true },
  { angle: "regional", headline: "Die Nr. 1 Trading-Community im DACH-Raum", livio: false },
] as const;

async function driveUploadImage(accessToken: string, name: string, imageBuffer: Buffer, mimeType: string, folderId?: string): Promise<{ id: string; webViewLink?: string } | null> {
  try {
    const metadata: Record<string, unknown> = { name, mimeType };
    if (folderId) metadata.parents = [folderId];
    const boundary = "img_boundary_sched";
    const metaStr = JSON.stringify(metadata);
    const part1 = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaStr}\r\n`);
    const part2 = Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`);
    const part3 = Buffer.from(`\r\n--${boundary}--`);
    const body = Buffer.concat([part1, part2, imageBuffer, part3]);
    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    const data = await res.json() as any;
    if (data.error) { console.error("[DriveUploadImage] Error:", data.error.message); return null; }
    return data as { id: string; webViewLink?: string };
  } catch (e: any) {
    console.error("[DriveUploadImage] Exception:", e.message);
    return null;
  }
}

async function getDriveAccessTokenForScheduler(): Promise<string | null> {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const db = await getDb();
    if (!db) return null;
    const { googleDriveConnections } = await import("../drizzle/schema");
    const [conn] = await db.select().from(googleDriveConnections).limit(1);
    if (!conn?.refreshToken) return null;
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId || "",
        client_secret: clientSecret || "",
        refresh_token: conn.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = await resp.json() as any;
    return data.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Täglich 10 neue Image Ads generieren basierend auf Meta-Performance-Analyse
 * Läuft um 06:00 UTC (08:00 CEST) — analysiert Vortags-Kampagnen und erstellt 10 Ads
 * Lädt alle Ads in einen neuen Google Drive Ordner hoch
 */
export async function runDailyImageAdGeneration(userId: number) {
  console.log(`[DailyImageAds] Starting daily image ad generation (10 ads) for user ${userId}...`);
  const db = await getDb();
  if (!db) { console.log("[DailyImageAds] DB not available, skipping."); return; }

  // ── 1. Meta Performance-Analyse: Top-Ads der letzten Tage ────────────────
  let performanceContext = "";
  try {
    const { getAds } = await import("./db");
    const allAds = await getAds(userId);
    if (allAds.length > 0) {
      const topAds = [...allAds]
        .filter(a => (a.impressions || 0) > 100)
        .sort((a, b) => ((b.conversions || 0) - (a.conversions || 0)) || ((b.ctr || 0) - (a.ctr || 0)))
        .slice(0, 5);
      if (topAds.length > 0) {
        performanceContext = `Top-performing Ads:\n` + topAds.map(a =>
          `- "${a.name}": ${a.conversions || 0} Conversions, CTR ${((a.ctr || 0) * 100).toFixed(2)}%, Spend CHF ${(a.spend || 0).toFixed(0)}, Headline: "${a.headline || 'n/a'}"`
        ).join("\n");
        console.log(`[DailyImageAds] Performance context: ${topAds.length} top ads found`);
      }
    }
  } catch (e: any) {
    console.log(`[DailyImageAds] Could not load performance data: ${e.message}`);
  }

  // ── 2. Knowledge Context ──────────────────────────────────────────────────
  const kfFiles = await db.select().from(knowledgeFiles).where(eq(knowledgeFiles.userId, userId));
  const knowledgeContext = kfFiles.map((f) => `${f.title}:\n${f.content.slice(0, 400)}`).join("\n\n");

  // ── 3. LLM: 10 Ad-Konzepte basierend auf Performance generieren ──────────
  let adConcepts: Array<{ title: string; angle: string; headline: string; livio: boolean }> = [];
  try {
    const conceptsResp = await invokeLLM({
      messages: [
        { role: "system", content: `Du bist ein Meta Ads Creative Strategist für EasySignals (Schweizer Trading-Community, DACH-Fokus). Basierend auf der Performance der letzten Tage und dem Brand-Kontext, erstelle 10 konkrete Image Ad Konzepte. Jedes Konzept hat: title (max 8 Wörter), angle (social_proof/pain/results/authority/fomo/direct/curiosity/trust/webinar/regional), headline (max 12 Wörter, auf Deutsch), livio (bool: ob Livio im Bild sein soll). Antworte als JSON: {"ads":[{"title":"...","angle":"...","headline":"...","livio":true}]}` },
        { role: "user", content: `${performanceContext}\n\nBrand-Kontext:\n${knowledgeContext.slice(0, 1000)}` },
      ],
    });
    const raw = (conceptsResp as any).choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw.includes("{") ? raw : `{"ads":${raw}}`);
    adConcepts = (parsed.ads || parsed).slice(0, 10);
  } catch (e: any) {
    console.log(`[DailyImageAds] LLM concept generation failed, using fallback: ${e.message}`);
  }
  if (adConcepts.length < 10) {
    adConcepts = DAILY_AD_ANGLES.map(a => ({ title: a.headline.slice(0, 60), angle: a.angle, headline: a.headline, livio: a.livio }));
  }

  // ── 4. Google Drive Ordner für heute erstellen ───────────────────────────
  const driveAccessToken = await getDriveAccessTokenForScheduler();
  const today = new Date().toISOString().split("T")[0];
  let dailyFolderId: string | null = null;
  if (driveAccessToken) {
    try {
      dailyFolderId = await driveCreateFolder(driveAccessToken, `${today}_Daily-AI-Image-Ads`, IMAGE_ADS_DRIVE_FOLDER_ID);
      console.log(`[DailyImageAds] Drive folder created: ${today}_Daily-AI-Image-Ads (${dailyFolderId})`);
    } catch (e: any) {
      console.log(`[DailyImageAds] Could not create Drive folder: ${e.message}`);
    }
  }

  // ── 5. 10 Ads generieren ─────────────────────────────────────────────────
  const results: Array<{ id: number; title: string; angle: string; driveUrl?: string }> = [];
  for (let i = 0; i < Math.min(adConcepts.length, 10); i++) {
    const concept = adConcepts[i];
    try {
      const livioDesc = concept.livio
        ? `Livio (young Swiss man, 25 years old, curly dark hair, beard, wearing black EasySignals polo shirt with white arrow logo) holding a smartphone showing the EasySignals app with green profit charts. Polaroid photo of Livio in corner labeled "LIVIO – Founder EasySignals".`
        : `Smartphone showing EasySignals app with green profit charts and trading signals. EasySignals logo visible.`;

      const prompt = `Professional high-converting Meta/Instagram image ad, 4:5 portrait ratio. Dark navy blue background with subtle purple/blue gradient glow. Large bold white uppercase headline at top: "${concept.headline.toUpperCase()}". ${livioDesc} Two bullet points highlighting key benefits (no experience needed, 2000+ members, 15 min per day). Currency icons (dollar, euro, bitcoin) in green circles at bottom right. EasySignals branding. Clean direct-response fintech advertising style. High contrast, professional studio quality.`;

      const originalImages = concept.livio ? [{ url: LIVIO_PHOTO_URL_SCHED, mimeType: "image/webp" as const }] : undefined;
      const { url: imageUrl } = await generateImage({ prompt, originalImages });
      if (!imageUrl) throw new Error("Bild-URL leer");

      // Upload to S3
      const imgResp = await fetch(imageUrl);
      const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
      const suffix = Math.random().toString(36).slice(2, 8);
      const { url: s3Url } = await storagePut(`image-ads/${userId}-daily-${today}-${i + 1}-${suffix}.jpg`, imgBuffer, "image/jpeg");

      // Save to DB
      const [inserted] = await db.insert(imageAds).values({
        userId,
        title: concept.title.slice(0, 255),
        style: "dark_premium" as const,
        prompt,
        imageUrl: s3Url,
        boardStatus: "draft" as const,
        metaUploadStatus: "none" as const,
        boardX: Math.floor(Math.random() * 800),
        boardY: Math.floor(Math.random() * 600),
      }).$returningId();

      // Save headline to DB
      await db.insert(adHeadlines).values({
        userId,
        imageAdId: inserted.id,
        text: concept.headline.slice(0, 512),
        status: "draft",
        tested: false,
      });

      // Upload to Google Drive
      let driveUrl: string | undefined;
      if (driveAccessToken && dailyFolderId) {
        const safeName = concept.title.slice(0, 40).replace(/[^a-zA-Z0-9äöüÄÖÜ ]/g, "").trim();
        const file = await driveUploadImage(
          driveAccessToken,
          `${String(i + 1).padStart(2, "0")}_${concept.angle}_${safeName}.jpg`,
          imgBuffer,
          "image/jpeg",
          dailyFolderId
        );
        if (file?.webViewLink) driveUrl = file.webViewLink;
      }

      results.push({ id: inserted.id, title: concept.title, angle: concept.angle, driveUrl });
      console.log(`[DailyImageAds] Ad ${i + 1}/10 created: "${concept.title}" (${concept.angle})${driveUrl ? " → Drive" : ""}`);

      // Small delay between generations to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    } catch (e: any) {
      console.error(`[DailyImageAds] Failed to generate ad ${i + 1}: ${e.message}`);
    }
  }

  // ── 6. Summary Notification ───────────────────────────────────────────────
  const driveLink = dailyFolderId ? `\nGoogle Drive: https://drive.google.com/drive/folders/${dailyFolderId}` : "";
  await notifyOwner({
    title: `🎨 ${results.length}/10 tägliche Image Ads generiert`,
    content: `Datum: ${today}\n${performanceContext ? "Basierend auf Meta Performance-Analyse." : "Ohne Performance-Daten."}\n\nAds:\n${results.map((r, i) => `${i + 1}. ${r.title} (${r.angle})`).join("\n")}${driveLink}\n\nAd-Board: https://metaadsflow-4xe4vzjf.manus.space/image-ads`,
  });

  console.log(`[DailyImageAds] Completed: ${results.length}/10 ads generated, ${results.filter(r => r.driveUrl).length} uploaded to Drive.`);
  return results;
}

// ─── Daily Video Ad Script Generation ────────────────────────────────────────

/**
 * Täglich 3 Hooks + Body + CTA als Video-Ad-Skript generieren
 * Läuft um 06:15 UTC (08:15 CEST)
 */
export async function runDailyVideoAdScriptGeneration(userId: number) {
  console.log(`[DailyVideoAds] Starting daily video ad script generation for user ${userId}...`);
  const db = await getDb();
  if (!db) { console.log("[DailyVideoAds] DB not available, skipping."); return; }

  // Get knowledge context
  const kfFiles = await db.select().from(knowledgeFiles).where(eq(knowledgeFiles.userId, userId));
  const knowledgeContext = kfFiles.map((f) => `${f.title}:\n${f.content.slice(0, 600)}`).join("\n\n");

  const emotions = ["fomo", "pain", "curiosity", "authority", "social_proof"] as const;
  const emotion = emotions[Math.floor(Math.random() * emotions.length)];
  const emotionMap: Record<string, string> = {
    fomo: "Angst etwas zu verpassen (FOMO)",
    pain: "Schmerz und Frustration",
    curiosity: "Neugier und Überraschung",
    authority: "Autorität und Expertise",
    social_proof: "Social Proof und Vertrauen",
  };

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Du bist ein erfahrener Meta Ads Video-Skript-Autor für EasySignals.
Erstelle ein Video-Ad-Skript für den deutschen Markt.
Das Skript wird von Livio Swiss (25 Jahre, Gründer EasySignals) gesprochen.
Tonalität: ${emotionMap[emotion]}

Kontext über EasySignals:
${knowledgeContext.slice(0, 2000)}

Format (STRIKT einhalten):
HOOK_1: [Hook-Text, max 15 Wörter, direkt und provokativ]
HOOK_2: [Hook-Text, max 15 Wörter, Neugier weckend]
HOOK_3: [Hook-Text, max 15 Wörter, Schmerz-basiert]
BODY: [Hauptteil, 50-80 Wörter, Problem → Lösung → Beweis]
CTA: [Call-to-Action, max 20 Wörter, klar und dringend]`,
        },
        { role: "user", content: "Erstelle ein Skript basierend auf dem EasySignals-Kontext." },
      ],
    });

    const raw = (response as any).choices?.[0]?.message?.content ?? "";
    const extract = (key: string) => {
      const match = raw.match(new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, "s"));
      return match?.[1]?.trim() ?? "";
    };

    const hook1 = extract("HOOK_1");
    const hook2 = extract("HOOK_2");
    const hook3 = extract("HOOK_3");
    const body = extract("BODY");
    const cta = extract("CTA");

    if (!hook1 || !body || !cta) {
      throw new Error("Skript-Parsing fehlgeschlagen – unvollständige Ausgabe");
    }

    const today = new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
    const title = `Daily Script ${today} – ${emotionMap[emotion].split(" ")[0]}`;
    const fullScript = `${hook1}\n\n${body}\n\n${cta}`;

    const [inserted] = await db.insert(videoAds).values({
      userId,
      title: title.slice(0, 255),
      hook: hook1,
      body,
      cta,
      fullScript,
      status: "draft",
      aspectRatio: "9:16",
    }).$returningId();

    await notifyOwner({
      title: "🎬 Neues Video-Ad-Skript generiert",
      content: `Tägliches Video-Skript erstellt: "${title}"\n\nHook 1: ${hook1}\nHook 2: ${hook2}\nHook 3: ${hook3}\n\nVideo Ads: https://metaadsflow-4xe4vzjf.manus.space/video-ads`,
    });

    console.log(`[DailyVideoAds] Video script "${title}" created (id: ${inserted.id}).`);
    return { id: inserted.id, title, hook1, hook2, hook3, body, cta };
  } catch (e: any) {
    console.error(`[DailyVideoAds] Failed to generate video script:`, e.message);
    await notifyOwner({
      title: "⚠️ Video-Skript Generierung fehlgeschlagen",
      content: `Fehler beim Erstellen des täglichen Video-Skripts: ${e.message}`,
    });
  }
}

// ─── Daily Performance Sync ───────────────────────────────────────────────────

/**
 * Täglich Performance-Daten von Meta API synchronisieren
 * Läuft um 09:00 UTC (11:00 CEST)
 */
export async function runDailyPerformanceSync(userId: number) {
  console.log(`[DailyPerformanceSync] Starting daily performance sync for user ${userId}...`);
  const db = await getDb();
  if (!db) { console.log("[DailyPerformanceSync] DB not available, skipping."); return; }

  const metaToken = process.env.META_ACCESS_TOKEN ?? "";
  const adAccountId = "act_1093241318940799";
  if (!metaToken) { console.log("[DailyPerformanceSync] META_ACCESS_TOKEN nicht gesetzt, überspringe."); return; }

  // Alle hochgeladenen Image Ads laden
  const ads = await db
    .select()
    .from(imageAds)
    .where(eq(imageAds.userId, userId));

  const uploadedAds = ads.filter(a => a.metaUploadStatus === "uploaded" && a.metaAdId);
  if (uploadedAds.length === 0) {
    console.log("[DailyPerformanceSync] Keine hochgeladenen Ads gefunden.");
    return;
  }

  let synced = 0;
  let winners = 0;

  for (const ad of uploadedAds) {
    try {
      const insightsUrl = `https://graph.facebook.com/v19.0/${adAccountId}/insights?fields=impressions,clicks,spend,ctr,cpc&date_preset=last_30d&access_token=${metaToken}`;
      const resp = await fetch(insightsUrl);
      const data = await resp.json() as any;
      if (data.data && data.data.length > 0) {
        const insight = data.data[0];
        const newCtr = parseFloat(insight.ctr ?? "0");
        const isWinner = newCtr > 3;
        await db.update(imageAds).set({
          impressions: parseInt(insight.impressions ?? "0"),
          spend: parseFloat(insight.spend ?? "0"),
          ctr: newCtr,
          cpc: parseFloat(insight.cpc ?? "0"),
          boardStatus: isWinner ? "winner" : ad.boardStatus,
        }).where(eq(imageAds.id, ad.id));
        synced++;
        if (isWinner) winners++;
      }
    } catch (e) {
      console.error(`[DailyPerformanceSync] Fehler für Ad ${ad.id}:`, e);
    }
  }

  if (synced > 0) {
    await notifyOwner({
      title: "📊 Performance Sync abgeschlossen",
      content: `${synced} Ads synchronisiert${winners > 0 ? `, ${winners} neue Gewinner (CTR > 3%) erkannt` : ""}.\nAd Performance: https://metaadsflow-4xe4vzjf.manus.space/ad-performance`,
    });
  }

  console.log(`[DailyPerformanceSync] ${synced} Ads synced, ${winners} winners detected.`);
  return { synced, winners };
}
