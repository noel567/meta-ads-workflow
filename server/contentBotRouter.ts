import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { contentPosts, contentBotSettings } from "../drizzle/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────
type PostType = "mindset" | "recap" | "social_proof" | "scarcity" | "evening_recap";

// ─── Telegram Helper ──────────────────────────────────────────────────────────
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

// ─── KI-Prompts pro Post-Typ ──────────────────────────────────────────────────
function getSystemPrompt(): string {
  return `Du bist Livio Swiss, Gründer von EasySignals – einem Schweizer Trading-Signal-Dienst.
Du schreibst Telegram-Posts für den EasySignals Free Channel.

STIL-REGELN (strikt einhalten):
- Jeder Gedanke bekommt eine eigene Zeile (kurze Absätze, kein Fliesstext)
- Direkte Ansprache: "du" / "ihr"
- Gelegentlich Schweizerdeutsch: "Hoi", "isch", "üsi", "CHF", "gäll"
- Emojis gezielt: 📈 (Wachstum), 🔥 (Erfolg), ✅ (TP Hit), 💰 (Profit), 🇨🇭 (Schweiz), ⚡ (Energie), 💡 (Tipp)
- Keine langen Textblöcke
- Authentisch, nicht übertrieben werblich
- Transparenz: auch Verluste werden ehrlich kommuniziert
- "Wir spielen das langfristige Game" als Mantra
- Maximal 200 Wörter pro Post`;
}

function getUserPrompt(type: PostType): string {
  const today = new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" });
  switch (type) {
    case "mindset":
      return `Schreibe einen Mindset/Motivations-Post für heute (${today}).
Thema: Trading-Psychologie, Geduld, langfristiges Denken, oder ein persönliches Learning von Livio.
Authentisch, ehrlich, nicht zu werblich. Baue Community-Gefühl auf.`;

    case "recap":
      return `Schreibe einen Morning-Recap/Marktausblick Post für heute (${today}).
Thema: Kurzer Ausblick auf den heutigen Handelstag, XAUUSD (Gold) Marktlage, was heute wichtig ist.
Zeige Expertise ohne konkrete Signale zu geben (die kommen in die VIP-Gruppe).
Erwähne, dass VIP-Mitglieder heute wieder profitieren werden.`;

    case "social_proof":
      return `Schreibe einen Social-Proof Post für heute (${today}).
Thema: Community-Erfolge, Mitglieder die profitiert haben, oder ein allgemeines Statement über die Performance.
Nutze Verknappung: Erwähne, dass die VIP-Gruppe limitiert ist.
Füge einen Call-to-Action ein: @Noel_EasySignals kontaktieren für VIP-Zugang.`;

    case "scarcity":
      return `Schreibe einen Scarcity/CTA Post für heute (${today}).
Thema: Limitierte Plätze in der VIP-Gruppe oder im LAT-System (automatisches Trading).
Erzeuge Dringlichkeit: Zeitdruck, begrenzte Plätze.
CTA: @Noel_EasySignals kontaktieren.
Erwähne: VIP-Gruppe ist 100% kostenlos (finanziert durch Broker-Partnerschaft mit IronFX).`;

    case "evening_recap":
      return `Schreibe einen Abend-Recap Post für heute (${today}).
Thema: Zusammenfassung des heutigen Handelstages, Dank an die Community, Ausblick auf morgen.
Positiver Abschluss, auch wenn es ein schwieriger Tag war (Transparenz).
Erwähne die morgigen Möglichkeiten.`;
  }
}

// ─── Post generieren ──────────────────────────────────────────────────────────
async function generatePostText(type: PostType): Promise<string> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: getSystemPrompt() },
      { role: "user", content: getUserPrompt(type) },
    ],
  });
  return (response.choices[0]?.message?.content as string) ?? "";
}

// ─── Scheduled time für heute berechnen ──────────────────────────────────────
function getScheduledTime(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────
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
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  return db.select().from(contentPosts)
    .where(and(
      eq(contentPosts.userId, userId),
      gte(contentPosts.scheduledAt, start),
      lte(contentPosts.scheduledAt, end),
    ))
    .orderBy(contentPosts.scheduledAt);
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const contentBotRouter = router({
  // Einstellungen abrufen
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const settings = await getSettings(ctx.user.id);
    return settings ?? {
      autoSendMindset: false,
      autoSendRecap: false,
      autoSendSocialProof: false,
      autoSendScarcity: false,
      autoSendEveningRecap: false,
      timeMindset: "07:30",
      timeRecap: "10:00",
      timeSocialProof: "13:00",
      timeScarcity: "17:00",
      timeEveningRecap: "20:00",
    };
  }),

  // Einstellungen speichern
  updateSettings: protectedProcedure
    .input(z.object({
      autoSendMindset: z.boolean().optional(),
      autoSendRecap: z.boolean().optional(),
      autoSendSocialProof: z.boolean().optional(),
      autoSendScarcity: z.boolean().optional(),
      autoSendEveningRecap: z.boolean().optional(),
      timeMindset: z.string().optional(),
      timeRecap: z.string().optional(),
      timeSocialProof: z.string().optional(),
      timeScarcity: z.string().optional(),
      timeEveningRecap: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await upsertSettings(ctx.user.id, input);
      return { success: true };
    }),

  // Heutige Posts abrufen
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
      type: z.enum(["mindset", "recap", "social_proof", "scarcity", "evening_recap"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const settings = await getSettings(ctx.user.id);
      const timeMap: Record<PostType, string> = {
        mindset: settings?.timeMindset ?? "07:30",
        recap: settings?.timeRecap ?? "10:00",
        social_proof: settings?.timeSocialProof ?? "13:00",
        scarcity: settings?.timeScarcity ?? "17:00",
        evening_recap: settings?.timeEveningRecap ?? "20:00",
      };
      const text = await generatePostText(input.type);
      const db = await getDb();
      if (!db) throw new Error("Datenbank nicht verfügbar");
      const result = await db.insert(contentPosts).values({
        userId: ctx.user.id,
        type: input.type,
        text,
        scheduledAt: getScheduledTime(timeMap[input.type]),
        status: "pending",
      });
      const id = (result as any).insertId as number;
      return { id, text, type: input.type };
    }),

  // Alle 5 Posts für heute generieren
  generateAllToday: protectedProcedure.mutation(async ({ ctx }) => {
    const types: PostType[] = ["mindset", "recap", "social_proof", "scarcity", "evening_recap"];
    const settings = await getSettings(ctx.user.id);
    const timeMap: Record<PostType, string> = {
      mindset: settings?.timeMindset ?? "07:30",
      recap: settings?.timeRecap ?? "10:00",
      social_proof: settings?.timeSocialProof ?? "13:00",
      scarcity: settings?.timeScarcity ?? "17:00",
      evening_recap: settings?.timeEveningRecap ?? "20:00",
    };
    const db = await getDb();
    if (!db) throw new Error("Datenbank nicht verfügbar");
    const results = [];
    for (const type of types) {
      const text = await generatePostText(type);
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

  // Post jetzt senden
  sendPost: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Datenbank nicht verfügbar");
      const rows = await db.select().from(contentPosts)
        .where(and(eq(contentPosts.id, input.postId), eq(contentPosts.userId, ctx.user.id)))
        .limit(1);
      if (!rows[0]) throw new Error("Post nicht gefunden");
      const post = rows[0];
      const messageId = await sendTelegramMessage(post.text);
      if (messageId) {
        await db.update(contentPosts).set({
          status: "sent",
          sentAt: new Date(),
          telegramMessageId: messageId,
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

  // Post löschen
  deletePost: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Datenbank nicht verfügbar");
      await db.delete(contentPosts)
        .where(and(eq(contentPosts.id, input.postId), eq(contentPosts.userId, ctx.user.id)));
      return { success: true };
    }),
});

// ─── Scheduler-Funktion (wird von scheduler.ts aufgerufen) ───────────────────
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
  };
  const timeMap: Record<PostType, string> = {
    mindset: settings.timeMindset,
    recap: settings.timeRecap,
    social_proof: settings.timeSocialProof,
    scarcity: settings.timeScarcity,
    evening_recap: settings.timeEveningRecap,
  };

  // Welcher Post-Typ ist jetzt fällig? (±5 Minuten Toleranz)
  for (const [type, timeStr] of Object.entries(timeMap) as [PostType, string][]) {
    if (!autoMap[type]) continue;
    const [h, m] = timeStr.split(":").map(Number);
    const scheduled = new Date();
    scheduled.setHours(h, m, 0, 0);
    const diffMs = Math.abs(now.getTime() - scheduled.getTime());
    if (diffMs > 5 * 60 * 1000) continue; // nicht im 5-Minuten-Fenster

    // Wurde dieser Typ heute schon gesendet?
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const existing = await db.select().from(contentPosts)
      .where(and(
        eq(contentPosts.userId, userId),
        eq(contentPosts.type, type),
        eq(contentPosts.status, "sent"),
        gte(contentPosts.scheduledAt, start),
        lte(contentPosts.scheduledAt, end),
      )).limit(1);
    if (existing.length > 0) continue;

    // Generieren und senden
    console.log(`[ContentBot] Generiere ${type} Post für User ${userId}...`);
    const text = await generatePostText(type);
    const result = await db.insert(contentPosts).values({
      userId,
      type,
      text,
      scheduledAt: scheduled,
      status: "pending",
    });
    const postId = (result as any).insertId as number;
    const messageId = await sendTelegramMessage(text);
    if (messageId) {
      await db.update(contentPosts).set({ status: "sent", sentAt: new Date(), telegramMessageId: messageId })
        .where(eq(contentPosts.id, postId));
      console.log(`[ContentBot] ✅ ${type} Post gesendet (msg ${messageId})`);
    } else {
      await db.update(contentPosts).set({ status: "error", errorMessage: "Telegram-Versand fehlgeschlagen" })
        .where(eq(contentPosts.id, postId));
      console.log(`[ContentBot] ❌ ${type} Post fehlgeschlagen`);
    }
  }
}
