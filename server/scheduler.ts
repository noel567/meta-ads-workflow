/**
 * Täglicher Scheduler für den automatischen Konkurrenten-Scan und Batch-Generierung.
 * Läuft täglich um 07:00 Uhr und scannt alle aktiven Konkurrenten.
 */

import { getActiveCompetitors, getMetaConnection, saveCompetitorAd, updateCompetitor, createScanLog, updateScanLog, getBrandSettings, createAdBatch, markCompetitorAdProcessed, getCompetitorAdsByCompetitor, getGoogleDriveConnection, updateAdBatch, createDocument, getTelegramSettings, createTelegramPost, updateTelegramPost } from "./db";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";


// ─── Daily Telegram Post ─────────────────────────────────────────────────────

const TELEGRAM_SYSTEM_PROMPT = `Du bist der Content-Operator von EasySignals, einer exklusiven Trading-Marke aus der Schweiz (DACH-Fokus).
EasySignals steht für: Community, Status, Führung, Resultate, Struktur, System, Komfort, Exklusivität.
Sprache für Telegram: Berndeutsch / Schweizerdeutsch – echtes, natürliches, lokales Berndeutsch.
Tonalität: direkt, emotional, klar, stark, modern, hochwertig, präzise, community-nah.
Vermeide: generische Standard-Copy, langweilige Motivationssprüche, KI-Haftigkeit.`;

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

export async function sendTelegramDirectPost() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
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

    // Telegram daily post: run at 07:00 UTC (09:00 CEST) – after the scan
    if (hour === 7 && minute >= 5 && minute < 10) {
      console.log(`[Scheduler] Running daily Telegram post for user ${userId}...`);
      try {
        await runDailyTelegramPost(userId);
        console.log(`[Scheduler] Daily Telegram post completed.`);
      } catch (e) {
        console.error(`[Scheduler] Daily Telegram post failed:`, e);
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
