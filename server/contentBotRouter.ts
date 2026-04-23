import { z } from "zod";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { contentPosts, contentBotSettings } from "../drizzle/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { storagePut } from "./storage";

// --- Types ---
type PostType = "mindset" | "recap" | "social_proof" | "scarcity" | "evening_recap" | "quote";

// --- Telegram Helper ---
async function sendTelegramMessage(text: string): Promise<string | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = await res.json() as any;
    if (data.ok) return String(data.result.message_id);
    console.error("[ContentBot] Telegram error:", data);
    return null;
  } catch (e) {
    console.error("[ContentBot] Telegram send failed:", e);
    return null;
  }
}

/**
 * Generiert einen einzigartigen Hintergrund via DALL-E 3.
 * Gibt die URL des generierten Bildes zurück (temporäre OpenAI URL, 1h gültig).
 */
async function generateDallE3Background(quote: string, author: string): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.warn("[ContentBot] OPENAI_API_KEY nicht gesetzt – DALL-E 3 übersprungen");
    return null;
  }

  // Prompt: Dramatischer Finanz-/Trading-Hintergrund, passend zum Zitat
  const prompt = `A dramatic, cinematic financial trading background image for a motivational quote by ${author}. 
Dark, moody atmosphere with deep blacks and dark navy blues. 
Subtle golden light rays streaming through, suggesting wealth and opportunity. 
Abstract elements: blurred stock market charts, candlestick patterns, city skyline at night, 
golden particles floating in the air. 
Premium luxury aesthetic, high contrast, photorealistic. 
No text, no people, no faces. 
1:1 square format. Ultra-high quality.`;

  try {
    console.log("[ContentBot] DALL-E 3 Hintergrund wird generiert...");
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",
        style: "vivid",
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) {
      console.error("[ContentBot] DALL-E 3 API Fehler:", data);
      return null;
    }
    const url = data.data?.[0]?.url;
    if (!url) {
      console.error("[ContentBot] DALL-E 3: Keine URL in Antwort", data);
      return null;
    }
    console.log("[ContentBot] DALL-E 3 Hintergrund generiert ✅");
    return url;
  } catch (e) {
    console.error("[ContentBot] DALL-E 3 Fehler:", e);
    return null;
  }
}

/** Generiert ein Quote-Bild via Python/Pillow und gibt den Pfad zurueck */
function createQuoteImageFile(quote: string, author: string, backgroundUrl?: string): string {
  const imgPath = join(tmpdir(), `quote_${Date.now()}.png`);
  const scriptPath = join(__dirname, "createQuoteImage.py");
  if (!existsSync(scriptPath)) {
    throw new Error(`Quote-Image-Script nicht gefunden: ${scriptPath}`);
  }
  // Sonderzeichen escapen
  const quoteSafe = quote.replace(/"/g, '\\"');
  const authorSafe = author.replace(/"/g, '\\"');
  const bgArg = backgroundUrl ? ` --background_url "${backgroundUrl}"` : "";
  execSync(`python3 "${scriptPath}" "${quoteSafe}" "${authorSafe}" "${imgPath}"${bgArg}`, {
    timeout: 30000,
  });
  return imgPath;
}

/** Sendet ein Bild-File als Foto an Telegram */
async function sendTelegramPhoto(imgPath: string, caption: string): Promise<string | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return null;
  try {
    const imgBuffer = readFileSync(imgPath);
    const boundary = `----FormBoundary${Date.now()}`;
    const CRLF = "\r\n";
    const captionPart = caption
      ? `--${boundary}${CRLF}Content-Disposition: form-data; name="parse_mode"${CRLF}${CRLF}HTML${CRLF}` +
        `--${boundary}${CRLF}Content-Disposition: form-data; name="caption"${CRLF}${CRLF}${caption}${CRLF}`
      : "";
    const textPart = Buffer.from(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="chat_id"${CRLF}${CRLF}${chatId}${CRLF}` +
      captionPart
    );
    const photoHeader = Buffer.from(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="photo"; filename="quote.png"${CRLF}Content-Type: image/png${CRLF}${CRLF}`
    );
    const closing = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
    const body = Buffer.concat([textPart, photoHeader, imgBuffer, closing]);
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length.toString(),
      },
      body,
    });
    const data = await res.json() as any;
    if (data.ok) return String(data.result.message_id);
    console.error("[ContentBot] Telegram sendPhoto error:", data);
    return null;
  } catch (e) {
    console.error("[ContentBot] Telegram sendPhoto failed:", e);
    return null;
  }
}

/** Erstellt Quote-Bild und lädt es auf S3 hoch – kein Telegram-Versand */
async function generateQuoteImageUrl(quoteText: string, userId: number): Promise<string | null> {
  const quoteMatch = quoteText.match(/["\u201e\u201c]([^"\u201c\u201d]+)["\u201d\u201c]/);
  const authorMatch = quoteText.match(/[\u2014\-]\s*([A-Z][\w\s.]+)/);
  const quote = quoteMatch?.[1]?.trim() ?? quoteText.slice(0, 120);
  const author = authorMatch?.[1]?.trim() ?? "EasySignals";
  try {
    // DALL-E 3 Hintergrund generieren
    const backgroundUrl = await generateDallE3Background(quote, author);
    const imgPath = createQuoteImageFile(quote, author, backgroundUrl ?? undefined);
    const imgBuffer = readFileSync(imgPath);
    const key = `quote-images/${userId}-${Date.now()}.png`;
    const { url } = await storagePut(key, imgBuffer, "image/png");
    return url;
  } catch (e) {
    console.error("[ContentBot] generateQuoteImageUrl failed:", e);
    return null;
  }
}

/** Generiert Quote-Bild und sendet es; gibt messageId zurueck */
async function sendQuoteAsImage(quoteText: string, userId: number): Promise<{ messageId: string | null; imageUrl: string | null }> {
  // Zitat und Autor aus dem Text extrahieren (KI-generiertes Format)
  // Format: "Zitat" \n\n— Autor
  const quoteMatch = quoteText.match(/["\u201e\u201c]([^"\u201c\u201d]+)["\u201d\u201c]/);
  const authorMatch = quoteText.match(/[\u2014\-]\s*([A-Z][\w\s.]+)/);
  const quote = quoteMatch?.[1]?.trim() ?? quoteText.slice(0, 120);
  const author = authorMatch?.[1]?.trim() ?? "EasySignals";

  let imgPath: string | null = null;
  let imageUrl: string | null = null;

  try {
    // DALL-E 3 Hintergrund generieren
    const backgroundUrl = await generateDallE3Background(quote, author);
    imgPath = createQuoteImageFile(quote, author, backgroundUrl ?? undefined);
    // Bild auf S3 hochladen
    const imgBuffer = readFileSync(imgPath);
    const key = `quote-images/${userId}-${Date.now()}.png`;
    const { url } = await storagePut(key, imgBuffer, "image/png");
    imageUrl = url;

    // Nur Bild senden, kein Caption-Text
    const messageId = await sendTelegramPhoto(imgPath, "");
    return { messageId, imageUrl };
  } catch (e) {
    console.error("[ContentBot] sendQuoteAsImage failed:", e);
    // Fallback: Text senden
    const messageId = await sendTelegramMessage(quoteText);
    return { messageId, imageUrl };
  }
}

// --- KI-Prompts pro Post-Typ ----
function getSystemPrompt(): string {
  return `Du bist Livio Swiss, Gründer von EasySignals – einem Schweizer Trading-Signal-Dienst.
Du schreibst Telegram-Posts für den EasySignals Free Channel.

STIL-REGELN (strikt einhalten):
- Sprache: Hochdeutsch (kein Schweizerdeutsch, kein Dialekt)
- Jeder Gedanke bekommt eine eigene Zeile (kurze Absätze, kein Fließtext)
- Direkte Ansprache: "du" / "ihr"
- Emojis gezielt einsetzen: 📈 (Wachstum), 🔥 (Erfolg), ✅ (TP Hit), 💰 (Profit), ⚡ (Energie), 💡 (Tipp), 🎯 (Ziel)
- Keine langen Textblöcke
- Authentisch, nicht übertrieben werblich
- Transparenz: auch Verluste werden ehrlich kommuniziert
- "Wir spielen das langfristige Spiel" als Mantra
- Maximal 200 Wörter pro Post
- Satzzeichen korrekt (deutsche Anführungszeichen „“, kein Apostroph für Genitiv)`;
}

function getUserPrompt(type: PostType): string {
  const today = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  switch (type) {
    case "mindset":
      return `Schreibe einen Mindset- und Motivations-Post für heute (${today}).
Thema: Trading-Psychologie, Geduld, langfristiges Denken oder ein persönliches Learning von Livio.
Ton: authentisch, ehrlich, nicht werblich. Baue ein Gemeinschaftsgefühl auf.
Sprache: Hochdeutsch.
Format: Kurze Absätze, jeder Gedanke in einer eigenen Zeile, 2–4 Emojis.`;

    case "recap":
      return `Schreibe einen Morning-Recap und Marktausblick für heute (${today}).
Thema: Kurzer Ausblick auf den heutigen Handelstag, XAUUSD (Gold) Marktlage, was heute wichtig ist.
Zeige Expertise, ohne konkrete Signale zu nennen (diese gehen in die VIP-Gruppe).
Erwähne, dass VIP-Mitglieder heute wieder von den Signalen profitieren werden.
Sprache: Hochdeutsch.
Format: Kurze Absätze, 2–4 Emojis, klarer Abschluss mit CTA.`;

    case "social_proof":
      return `Schreibe einen Social-Proof-Post für heute (${today}).
Thema: Erfolge der Community, Mitglieder die profitiert haben, oder ein allgemeines Statement zur Performance.
Erwähne, dass die VIP-Gruppe limitierte Plätze hat.
Call-to-Action: @easysignal_de_bot kontaktieren für VIP-Zugang.
Sprache: Hochdeutsch.
Format: Kurze Absätze, 2–4 Emojis, abschließender CTA.`;

    case "scarcity":
      return `Schreibe einen Scarcity- und CTA-Post für heute (${today}).
Thema: Begrenzte Plätze in der VIP-Gruppe oder im LAT-System (automatisiertes Trading).
Erzeuge Dringlichkeit durch Zeitdruck und begrenzte Verfügbarkeit.
Call-to-Action: @easysignal_de_bot kontaktieren.
Hinweis: Die VIP-Gruppe ist 100% kostenlos (finanziert durch die Broker-Partnerschaft mit IronFX).
Sprache: Hochdeutsch.
Format: Kurze Absätze, 2–3 Emojis, klarer CTA am Ende.`;

    case "evening_recap":
      return `Schreibe einen Abend-Recap für heute (${today}).
Thema: Zusammenfassung des heutigen Handelstages, Dank an die Community, Ausblick auf morgen.
Positiver Abschluss – auch bei einem schwierigen Tag (Transparenz ist wichtig).
Erwähne die Möglichkeiten von morgen.
Sprache: Hochdeutsch.
Format: Kurze Absätze, 2–4 Emojis, warmer Abschluss.`;

    case "quote":
      return `Erstelle einen „Quote of the Day“-Post für die EasySignals Telegram-Gruppe.
Wähle ein bekanntes, inspirierendes Zitat von einem berühmten Trader, Investor oder Unternehmer (z.B. Warren Buffett, Paul Tudor Jones, Jesse Livermore, George Soros, Ray Dalio, Marty Schwartz, Ed Seykota, Mark Douglas).
Das Zitat soll auf Englisch bleiben (Original), aber der umrahmende Text ist auf Hochdeutsch.

Format (EXAKT so, keine HTML-Tags, keine Emojis im Zitat-Block selbst):
„[Zitat auf Englisch]“
— [Name des Autors]

[2–3 Sätze Kommentar auf professionellem Hochdeutsch: Warum dieses Zitat für Trader relevant ist. KEIN Dialekt, KEINE Ausrufe.]

🚀 EasySignals – Wir spielen das langfristige Spiel.`;
  }
}

function getQuoteDeduplicationNote(recentTexts: string[]): string {
  if (recentTexts.length === 0) return "";
  // Extrahiere nur die Zitat-Zeilen (Zeilen die mit „ beginnen oder nach dem Autor stehen)
  const snippets = recentTexts
    .map((t) => {
      const lines = t.split("\n").filter((l) => l.trim().length > 0);
      // Suche die Zeile mit dem Zitat („...“) oder nehme die erste inhaltliche Zeile
      const quoteLine = lines.find((l) => l.includes("„") || l.includes('"')) ?? lines[1] ?? "";
      return quoteLine.slice(0, 80).trim();
    })
    .filter(Boolean);
  if (snippets.length === 0) return "";
  return `\n\nWICHTIG: Diese Zitate wurden in den letzten 30 Tagen bereits verwendet und dürfen NICHT wiederholt werden:\n${snippets.map((s, i) => `${i + 1}. ${s}`).join("\n")}\nWähle ein komplett anderes Zitat von einem anderen Autor oder einem anderen Thema.`;
}

// --- Post generieren ---
async function generatePostText(type: PostType, userId?: number): Promise<string> {
  let userPrompt = getUserPrompt(type);

  // Duplikat-Schutz fuer Quote of the Day: letzte 30 Tage laden
  if (type === "quote" && userId !== undefined) {
    const db = await getDb();
    if (db) {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const recentQuotes = await db
        .select({ text: contentPosts.text })
        .from(contentPosts)
        .where(
          and(
            eq(contentPosts.userId, userId),
            eq(contentPosts.type, "quote"),
            gte(contentPosts.createdAt, since),
          )
        )
        .orderBy(desc(contentPosts.createdAt))
        .limit(30);
      const recentTexts = recentQuotes.map((r) => r.text);
      userPrompt += getQuoteDeduplicationNote(recentTexts);
    }
  }

  const response = await invokeLLM({
    messages: [
      { role: "system", content: getSystemPrompt() },
      { role: "user", content: userPrompt },
    ],
  });
  return (response.choices[0]?.message?.content as string) ?? "";
}
// --- Zeitzone: Europe/Zurich ----
const TZ = "Europe/Zurich";

/** Gibt das aktuelle Datum als YYYY-MM-DD in Schweizer Zeit zurück */
function zurichDateStr(date: Date = new Date()): string {
  return date.toLocaleDateString("sv-SE", { timeZone: TZ }); // sv-SE liefert ISO-Format
}

/** Baut ein Date-Objekt für "HH:MM Uhr Schweizer Zeit am gegebenen Datum" */
function zurichTimeToDate(dateStr: string, timeStr: string): Date {
  // Wir konstruieren einen ISO-String mit Offset-Berechnung via Intl
  // Trick: Erstelle ein Datum in UTC, das in Zurich-Zeit dem gewünschten Wert entspricht
  const [h, m] = timeStr.split(":").map(Number);
  // Erstelle einen Zeitstempel in Zurich-Zeit durch Intl.DateTimeFormat
  const [year, month, day] = dateStr.split("-").map(Number);
  // Nutze den UTC-Offset für Europe/Zurich zum gewünschten Zeitpunkt
  const approx = new Date(Date.UTC(year, month - 1, day, h, m, 0));
  // Berechne den tatsächlichen Zurich-Offset für diesen Zeitpunkt
  const zurichStr = approx.toLocaleString("en-US", { timeZone: TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit" });
// --- Parse zurück ---
  const [datePart, timePart] = zurichStr.split(", ");
  const [mStr, dStr, yStr] = datePart.split("/");
  const [hStr, minStr, sStr] = timePart.split(":");
  const zurichUtc = new Date(Date.UTC(
    parseInt(yStr), parseInt(mStr) - 1, parseInt(dStr),
    parseInt(hStr) % 24, parseInt(minStr), parseInt(sStr)
  ));
  // Offset = zurichUtc - approx (in ms)
  const offset = zurichUtc.getTime() - approx.getTime();
  // Korrigiertes UTC-Datum: wenn wir approx um -offset verschieben, ergibt das die Zurich-Zeit
  return new Date(approx.getTime() - offset);
}

/** Gibt ein Date-Objekt zurück, das "HH:MM Uhr heute in Schweizer Zeit" repräsentiert */
function getScheduledTime(timeStr: string): Date {
  const todayZurich = zurichDateStr();
  return zurichTimeToDate(todayZurich, timeStr);
}

// --- DB Helpers ---
async function getSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(contentBotSettings).where(eq(contentBotSettings.userId, userId)).limit(1);
  return rows[0] ?? null;
}

async function upsertSettings(userId: number, data: Partial<typeof contentBotSettings.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  const existing = await getSettings(userId);
  if (existing) {
    await db.update(contentBotSettings).set({ ...data, updatedAt: new Date() }).where(eq(contentBotSettings.userId, userId));
  } else {
    await db.insert(contentBotSettings).values({ userId, ...data, updatedAt: new Date() });
  }
}

async function getTodaysPosts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Zurich-Zeit für Datumsfilter verwenden (konsistent mit getScheduledTime)
  const todayZurich = zurichDateStr();
  const start = zurichTimeToDate(todayZurich, "00:00");
  const end = zurichTimeToDate(todayZurich, "23:59");
  return db.select().from(contentPosts)
    .where(and(
      eq(contentPosts.userId, userId),
      gte(contentPosts.scheduledAt, start),
      lte(contentPosts.scheduledAt, end),
    ))
    .orderBy(contentPosts.scheduledAt);
}

// --- Router ---
export const contentBotRouter = router({
// --- Einstellungen abrufen ---
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const settings = await getSettings(ctx.user.id);
    return settings ?? {
      autoSendMindset: false,
      autoSendRecap: false,
      autoSendSocialProof: false,
      autoSendScarcity: false,
      autoSendEveningRecap: false,
      autoSendQuote: true,
      timeMindset: "07:30",
      timeRecap: "10:00",
      timeSocialProof: "13:00",
      timeScarcity: "17:00",
      timeEveningRecap: "20:00",
      timeQuote: "09:00",
    };
  }),

// --- Einstellungen speichern ---
  updateSettings: protectedProcedure
    .input(z.object({
      autoSendMindset: z.boolean().optional(),
      autoSendRecap: z.boolean().optional(),
      autoSendSocialProof: z.boolean().optional(),
      autoSendScarcity: z.boolean().optional(),
      autoSendEveningRecap: z.boolean().optional(),
      autoSendQuote: z.boolean().optional(),
      timeMindset: z.string().optional(),
      timeRecap: z.string().optional(),
      timeSocialProof: z.string().optional(),
      timeScarcity: z.string().optional(),
      timeEveningRecap: z.string().optional(),
      timeQuote: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await upsertSettings(ctx.user.id, input);
      return { success: true };
    }),

// --- Heutige Posts abrufen ---
  getTodaysPosts: protectedProcedure.query(async ({ ctx }) => {
    return getTodaysPosts(ctx.user.id);
  }),

  // Post-History abrufen (letzte 7 Tage)
  getHistory: protectedProcedure
    .input(z.object({ days: z.number().default(7) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const since = new Date();
      since.setDate(since.getDate() - input.days);
      return db.select().from(contentPosts)
        .where(and(
          eq(contentPosts.userId, ctx.user.id),
          gte(contentPosts.createdAt, since),
        ))
        .orderBy(desc(contentPosts.createdAt))
        .limit(50);
    }),

  // Einzelnen Post generieren (ohne senden)
  generatePost: protectedProcedure
    .input(z.object({
      type: z.enum(["mindset", "recap", "social_proof", "scarcity", "evening_recap", "quote"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const settings = await getSettings(ctx.user.id);
      const timeMap: Record<PostType, string> = {
        mindset: settings?.timeMindset ?? "07:30",
        recap: settings?.timeRecap ?? "10:00",
        social_proof: settings?.timeSocialProof ?? "13:00",
        scarcity: settings?.timeScarcity ?? "17:00",
        evening_recap: settings?.timeEveningRecap ?? "20:00",
        quote: (settings as any)?.timeQuote ?? "09:00",
      };
      const text = await generatePostText(input.type, ctx.user.id);
      const db = await getDb();
      if (!db) throw new Error("Datenbank nicht verfügbar");
      // Bei Quote: Bild bereits beim Generieren erstellen für Vorschau (kein Telegram-Versand)
      let imageUrl: string | null = null;
      if (input.type === "quote") {
        imageUrl = await generateQuoteImageUrl(text, ctx.user.id);
      }
      const result = await db.insert(contentPosts).values({
        userId: ctx.user.id,
        type: input.type,
        text,
        scheduledAt: getScheduledTime(timeMap[input.type]),
        status: "pending",
        ...(imageUrl ? { imageUrl } : {}),
      });
      const id = (result as any).insertId as number;
      return { id, text, type: input.type, imageUrl };
    }),

  // Alle Posts für heute generieren
  generateAllToday: protectedProcedure.mutation(async ({ ctx }) => {
    const types: PostType[] = ["mindset", "recap", "social_proof", "scarcity", "evening_recap", "quote"];
    const settings = await getSettings(ctx.user.id);
    const timeMap: Record<PostType, string> = {
      mindset: settings?.timeMindset ?? "07:30",
      recap: settings?.timeRecap ?? "10:00",
      social_proof: settings?.timeSocialProof ?? "13:00",
      scarcity: settings?.timeScarcity ?? "17:00",
      evening_recap: settings?.timeEveningRecap ?? "20:00",
      quote: (settings as any)?.timeQuote ?? "09:00",
    };
    const db = await getDb();
    if (!db) throw new Error("Datenbank nicht verfügbar");
    const results = [];
    for (const type of types) {
      const text = await generatePostText(type, ctx.user.id);
      const result = await db.insert(contentPosts).values({
        userId: ctx.user.id,
        type,
        text,
        scheduledAt: getScheduledTime(timeMap[type]),
        status: "pending",
      });
      results.push({ id: (result as any).insertId, type, text });
    }
    return results;
  }),

// --- Post jetzt senden ---
  sendPost: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Datenbank nicht verf\u00fcgbar");
      const rows = await db.select().from(contentPosts)
        .where(and(eq(contentPosts.id, input.postId), eq(contentPosts.userId, ctx.user.id)))
        .limit(1);
      if (!rows[0]) throw new Error("Post nicht gefunden");
      const post = rows[0];

      let messageId: string | null = null;
      let imageUrl: string | null = null;

      if (post.type === "quote") {
        // Quote als Bild senden
        const result = await sendQuoteAsImage(post.text, ctx.user.id);
        messageId = result.messageId;
        imageUrl = result.imageUrl;
      } else {
        messageId = await sendTelegramMessage(post.text);
      }

      if (messageId) {
        await db.update(contentPosts).set({
          status: "sent",
          sentAt: new Date(),
          telegramMessageId: messageId,
          ...(imageUrl ? { imageUrl } : {}),
        }).where(eq(contentPosts.id, input.postId));
        return { success: true, messageId };
      } else {
        await db.update(contentPosts).set({
          status: "error",
          errorMessage: "Telegram-Versand fehlgeschlagen",
        }).where(eq(contentPosts.id, input.postId));
        return { success: false, messageId: null };
      }
    }),

  // Post-Text bearbeiten
  updatePostText: protectedProcedure
    .input(z.object({ postId: z.number(), text: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Datenbank nicht verfügbar");
      await db.update(contentPosts).set({ text: input.text })
        .where(and(eq(contentPosts.id, input.postId), eq(contentPosts.userId, ctx.user.id)));
      return { success: true };
    }),

// --- Post löschen ---
  deletePost: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Datenbank nicht verfügbar");
      await db.delete(contentPosts)
        .where(and(eq(contentPosts.id, input.postId), eq(contentPosts.userId, ctx.user.id)));
      return { success: true };
    }),

  // Scheduler-Status: nächste geplante Posts berechnen
  getSchedulerStatus: protectedProcedure.query(async ({ ctx }) => {
    const settings = await getSettings(ctx.user.id);
    const s = settings ?? {
      autoSendMindset: false, autoSendRecap: false, autoSendSocialProof: false,
      autoSendScarcity: false, autoSendEveningRecap: false, autoSendQuote: true,
      timeMindset: "07:30", timeRecap: "10:00", timeSocialProof: "13:00",
      timeScarcity: "17:00", timeEveningRecap: "20:00", timeQuote: "09:00",
    };

    const typeConfig: Array<{
      type: PostType; autoKey: string; timeKey: string;
      label: string; emoji: string;
    }> = [      { type: "mindset",       autoKey: "autoSendMindset",      timeKey: "timeMindset",      label: "Mindset",           emoji: "🧠" },
      { type: "recap",         autoKey: "autoSendRecap",        timeKey: "timeRecap",        label: "Morning Recap",     emoji: "📊" },
      { type: "social_proof",  autoKey: "autoSendSocialProof",  timeKey: "timeSocialProof",  label: "Social Proof",      emoji: "🏆" },
      { type: "scarcity",      autoKey: "autoSendScarcity",     timeKey: "timeScarcity",     label: "Scarcity/CTA",      emoji: "⚡" },
      { type: "evening_recap", autoKey: "autoSendEveningRecap", timeKey: "timeEveningRecap", label: "Evening Recap",      emoji: "🌙" },
      { type: "quote",         autoKey: "autoSendQuote",        timeKey: "timeQuote",        label: "Quote of the Day",  emoji: "💬" },
    ];

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const items = typeConfig.map((cfg) => {
      const sAny = s as Record<string, unknown>;
      const isEnabled = sAny[cfg.autoKey] as boolean;
      const timeStr = sAny[cfg.timeKey] as string;
      const todayAt = new Date(`${todayStr}T${timeStr}:00`);
      let nextAt: Date;
      if (todayAt > now) {
        nextAt = todayAt;
      } else {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        nextAt = new Date(`${tomorrow.toISOString().slice(0, 10)}T${timeStr}:00`);
      }
      const diffMs = nextAt.getTime() - now.getTime();
      const hoursUntil = Math.floor(diffMs / 3600000);
      const minutesUntil = Math.floor((diffMs % 3600000) / 60000);
      const isToday = nextAt.toISOString().slice(0, 10) === todayStr;
      return {
        type: cfg.type,
        label: cfg.label,
        emoji: cfg.emoji,
        isEnabled,
        scheduledTime: timeStr,
        nextAtMs: nextAt.getTime(),
        isToday,
        hoursUntil,
        minutesUntil,
      };
    });

    const enabledItems = items.filter((r) => r.isEnabled);
    const nextOverall = enabledItems.length > 0
      ? enabledItems.reduce((a, b) => (a.nextAtMs < b.nextAtMs ? a : b))
      : null;

    return { items, nextOverall };
  }),
});

// --- Scheduler-Funktion (wird von scheduler.ts aufgerufen) ----
export async function runContentBotScheduler(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const settings = await getSettings(userId);
  if (!settings) return;

  const now = new Date();
  const autoMap: Record<PostType, boolean> = {
    mindset: settings.autoSendMindset,
    recap: settings.autoSendRecap,
    social_proof: settings.autoSendSocialProof,
    scarcity: settings.autoSendScarcity,
    evening_recap: settings.autoSendEveningRecap,
    quote: (settings as any).autoSendQuote ?? true,
  };
  const timeMap: Record<PostType, string> = {
    mindset: settings.timeMindset,
    recap: settings.timeRecap,
    social_proof: settings.timeSocialProof,
    scarcity: settings.timeScarcity,
    evening_recap: settings.timeEveningRecap,
    quote: (settings as any).timeQuote ?? "09:00",
  };

  // Welcher Post-Typ ist jetzt fällig? (±5 Minuten Toleranz, Schweizer Zeit)
  const todayZurich = zurichDateStr(now);
// --- Tagesgrenzen in Schweizer Zeit ---
  const dayStart = zurichTimeToDate(todayZurich, "00:00");
  const dayEnd = zurichTimeToDate(todayZurich, "23:59");

  for (const [type, timeStr] of Object.entries(timeMap) as [PostType, string][]) {
    if (!autoMap[type]) continue;
    const scheduled = zurichTimeToDate(todayZurich, timeStr);
    const diffMs = Math.abs(now.getTime() - scheduled.getTime());
    if (diffMs > 5 * 60 * 1000) continue; // nicht im 5-Minuten-Fenster

    // Wurde dieser Typ heute schon gesendet? (Tagesgrenzen in Schweizer Zeit)
    const start = dayStart;
    const end = dayEnd;
    const existing = await db.select().from(contentPosts)
      .where(and(
        eq(contentPosts.userId, userId),
        eq(contentPosts.type, type),
        eq(contentPosts.status, "sent"),
        gte(contentPosts.scheduledAt, start),
        lte(contentPosts.scheduledAt, end),
      )).limit(1);
    if (existing.length > 0) continue;

// --- Generieren und senden ---
    console.log(`[ContentBot] Generiere ${type} Post für User ${userId}...`);
    const text = await generatePostText(type, userId);
    const result = await db.insert(contentPosts).values({
      userId,
      type,
      text,
      scheduledAt: scheduled,
      status: "pending",
    });
    const postId = (result as any).insertId as number;

    let messageId: string | null = null;
    let imageUrl: string | null = null;
    if (type === "quote") {
      const res = await sendQuoteAsImage(text, userId);
      messageId = res.messageId;
      imageUrl = res.imageUrl;
    } else {
      messageId = await sendTelegramMessage(text);
    }

    if (messageId) {
      await db.update(contentPosts).set({
        status: "sent", sentAt: new Date(), telegramMessageId: messageId,
        ...(imageUrl ? { imageUrl } : {}),
      }).where(eq(contentPosts.id, postId));
      console.log(`[ContentBot] \u2705 ${type} Post gesendet (msg ${messageId})`);
    } else {
      await db.update(contentPosts).set({ status: "error", errorMessage: "Telegram-Versand fehlgeschlagen" })
        .where(eq(contentPosts.id, postId));
      console.log(`[ContentBot] \u274c ${type} Post fehlgeschlagen`);
    }
  }
}
