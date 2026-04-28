import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { metaComments, metaConnections } from "../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

const META_BASE = "https://graph.facebook.com/v19.0";
const META_TOKEN = process.env.META_ACCESS_TOKEN;

async function metaFetch(path: string, token: string, opts: RequestInit = {}) {
  const url = new URL(`${META_BASE}${path}`);
  if (!url.searchParams.has("access_token")) {
    url.searchParams.set("access_token", token);
  }
  const res = await fetch(url.toString(), opts);
  const json = await res.json() as any;
  if (json.error) throw new Error(`Meta API: ${json.error.message}`);
  return json;
}

async function getToken(userId: number): Promise<string> {
  const db = await getDb();
  if (db) {
    const [conn] = await db
      .select()
      .from(metaConnections)
      .where(eq(metaConnections.userId, userId))
      .limit(1);
    if (conn?.accessToken) return conn.accessToken;
  }
  return META_TOKEN ?? "";
}

function detectSentiment(text: string): "positive" | "neutral" | "negative" {
  const lower = text.toLowerCase();
  const negWords = ["schlecht", "scam", "betrug", "fake", "lüge", "scheiß", "terrible", "awful", "fraud", "scammer", "waste", "useless", "hate", "worst", "garbage", "bullshit", "rip off", "ripoff", "nicht gut", "enttäuscht", "enttäuschend"];
  const posWords = ["super", "toll", "klasse", "danke", "great", "awesome", "love", "excellent", "perfect", "amazing", "fantastic", "brilliant", "top", "gut", "sehr gut", "empfehle", "recommend", "👍", "🔥", "💪", "❤️", "✅"];
  const negScore = negWords.filter(w => lower.includes(w)).length;
  const posScore = posWords.filter(w => lower.includes(w)).length;
  if (negScore > posScore) return "negative";
  if (posScore > negScore) return "positive";
  return "neutral";
}

export const commentManagerRouter = router({
  // Kommentare von Meta laden und in DB speichern
  syncComments: protectedProcedure
    .input(z.object({
      adAccountId: z.string().optional(),
      limit: z.number().min(1).max(200).default(50),
    }))
    .mutation(async ({ ctx, input }) => {
      const token = await getToken(ctx.user.id);
      if (!token) throw new Error("Kein Meta Access Token konfiguriert");
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");

      // Ad Account ID ermitteln
      let adAccountId = input.adAccountId;
      if (!adAccountId) {
        const meData = await metaFetch("/me/adaccounts?fields=id,name&limit=5", token);
        if (!meData.data?.length) throw new Error("Kein Ad Account gefunden");
        adAccountId = meData.data[0].id;
      }

      // Aktive Ads mit Posts laden
      const adsData = await metaFetch(
        `/${adAccountId}/ads?fields=id,name,creative{object_story_id},status&limit=${input.limit}&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]`,
        token
      );
      const ads = adsData.data ?? [];

      let totalSynced = 0;
      let totalNew = 0;

      for (const ad of ads.slice(0, 20)) {
        const postId = ad.creative?.object_story_id;
        if (!postId) continue;

        try {
          // Kommentare für diesen Post laden
          const commentsData = await metaFetch(
            `/${postId}/comments?fields=id,message,from,created_time,can_hide&limit=50`,
            token
          );
          const comments = commentsData.data ?? [];

          for (const comment of comments) {
            if (!comment.message) continue;
            totalSynced++;

            // Prüfen ob bereits in DB
            const existing = await db
              .select({ id: metaComments.id })
              .from(metaComments)
              .where(eq(metaComments.commentId, comment.id))
              .limit(1);

            if (existing.length > 0) continue;

            // Sentiment erkennen
            const sentiment = detectSentiment(comment.message);

            // Plattform erkennen (Instagram posts haben "_" im postId)
            const platform = postId.includes("_") ? "facebook" : "instagram";

            await db.insert(metaComments).values({
              userId: ctx.user.id,
              commentId: comment.id,
              postId: postId,
              adId: ad.id,
              adName: ad.name,
              platform,
              authorName: comment.from?.name ?? "Unbekannt",
              authorId: comment.from?.id,
              message: comment.message,
              sentiment,
              status: "new",
              metaCreatedAt: comment.created_time ? new Date(comment.created_time) : null,
            });
            totalNew++;
          }
        } catch {
          // Einzelne Ad-Fehler ignorieren
        }
      }

      return { synced: totalSynced, newComments: totalNew };
    }),

  // Alle Kommentare aus DB laden
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["all", "new", "replied", "hidden", "ignored"]).default("all"),
      sentiment: z.enum(["all", "positive", "neutral", "negative"]).default("all"),
      limit: z.number().min(1).max(200).default(100),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { comments: [], total: 0 };

      const conditions = [eq(metaComments.userId, ctx.user.id)];
      if (input.status !== "all") conditions.push(eq(metaComments.status, input.status));
      if (input.sentiment !== "all") conditions.push(eq(metaComments.sentiment, input.sentiment));

      const comments = await db
        .select()
        .from(metaComments)
        .where(and(...conditions))
        .orderBy(desc(metaComments.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return { comments, total: comments.length };
    }),

  // KI-Antwortvorschlag generieren
  generateReply: protectedProcedure
    .input(z.object({
      commentId: z.number(),
      tone: z.enum(["friendly", "professional", "enthusiastic"]).default("friendly"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");

      const [comment] = await db
        .select()
        .from(metaComments)
        .where(and(eq(metaComments.id, input.commentId), eq(metaComments.userId, ctx.user.id)))
        .limit(1);

      if (!comment) throw new Error("Kommentar nicht gefunden");

      const toneInstructions = {
        friendly: "freundlich, persönlich und herzlich",
        professional: "professionell, sachlich und kompetent",
        enthusiastic: "enthusiastisch, motivierend und energetisch",
      };

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Du bist der Social Media Manager von EasySignals, einem automatisierten Trading-Signal-Service. 
Deine Aufgabe ist es, auf Kommentare unter Meta-Werbeanzeigen zu antworten.
Ton: ${toneInstructions[input.tone]}
Sprache: Antworte in der gleichen Sprache wie der Kommentar (Deutsch oder Englisch).
Regeln:
- Maximal 2-3 Sätze
- Keine Emojis ausser am Ende (max 1)
- Immer den Namen des Kommentators ansprechen wenn bekannt
- Bei negativen Kommentaren: empathisch, lösungsorientiert, nie defensiv
- Bei Fragen: kurz antworten und auf den Support verweisen
- Nie Preise oder konkrete Zahlen nennen
- Marke: EasySignals`,
          },
          {
            role: "user",
            content: `Kommentar von ${comment.authorName ?? "einem Nutzer"}: "${comment.message}"
            
Ad: ${comment.adName ?? "EasySignals Werbeanzeige"}
Sentiment: ${comment.sentiment}

Erstelle eine passende Antwort:`,
          },
        ],
      });

      const aiReply = (response as any).choices?.[0]?.message?.content?.trim() ?? "";

      // KI-Antwort in DB speichern
      await db
        .update(metaComments)
        .set({ aiReply })
        .where(eq(metaComments.id, input.commentId));

      return { aiReply };
    }),

  // Antwort senden (via Meta API)
  sendReply: protectedProcedure
    .input(z.object({
      commentId: z.number(),
      replyText: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");

      const [comment] = await db
        .select()
        .from(metaComments)
        .where(and(eq(metaComments.id, input.commentId), eq(metaComments.userId, ctx.user.id)))
        .limit(1);

      if (!comment) throw new Error("Kommentar nicht gefunden");

      const token = await getToken(ctx.user.id);
      if (!token) throw new Error("Kein Meta Access Token");

      // Antwort via Meta API senden
      await metaFetch(`/${comment.commentId}/comments`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input.replyText }),
      });

      // Status in DB aktualisieren
      await db
        .update(metaComments)
        .set({
          status: "replied",
          sentReply: input.replyText,
          repliedAt: new Date(),
        })
        .where(eq(metaComments.id, input.commentId));

      return { success: true };
    }),

  // Kommentar verstecken
  hideComment: protectedProcedure
    .input(z.object({ commentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");

      const [comment] = await db
        .select()
        .from(metaComments)
        .where(and(eq(metaComments.id, input.commentId), eq(metaComments.userId, ctx.user.id)))
        .limit(1);

      if (!comment) throw new Error("Kommentar nicht gefunden");

      const token = await getToken(ctx.user.id);
      if (!token) throw new Error("Kein Meta Access Token");

      // Kommentar via Meta API verstecken
      await metaFetch(`/${comment.commentId}`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_hidden: true }),
      });

      await db
        .update(metaComments)
        .set({ status: "hidden", hiddenAt: new Date() })
        .where(eq(metaComments.id, input.commentId));

      return { success: true };
    }),

  // Kommentar ignorieren (nur in DB markieren)
  ignoreComment: protectedProcedure
    .input(z.object({ commentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      await db
        .update(metaComments)
        .set({ status: "ignored" })
        .where(and(eq(metaComments.id, input.commentId), eq(metaComments.userId, ctx.user.id)));
      return { success: true };
    }),

  // Bulk: alle negativen Kommentare verstecken
  bulkHideNegative: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const token = await getToken(ctx.user.id);
      if (!token) throw new Error("Kein Meta Access Token");

      const negComments = await db
        .select()
        .from(metaComments)
        .where(
          and(
            eq(metaComments.userId, ctx.user.id),
            eq(metaComments.sentiment, "negative"),
            eq(metaComments.status, "new")
          )
        );

      let hidden = 0;
      for (const comment of negComments) {
        try {
          await metaFetch(`/${comment.commentId}`, token, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_hidden: true }),
          });
          await db
            .update(metaComments)
            .set({ status: "hidden", hiddenAt: new Date() })
            .where(eq(metaComments.id, comment.id));
          hidden++;
        } catch {
          // Einzelne Fehler ignorieren
        }
      }
      return { hidden };
    }),

  // Stats: Übersicht
  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { total: 0, new: 0, replied: 0, hidden: 0, positive: 0, neutral: 0, negative: 0 };

    const all = await db
      .select()
      .from(metaComments)
      .where(eq(metaComments.userId, ctx.user.id));

    return {
      total: all.length,
      new: all.filter(c => c.status === "new").length,
      replied: all.filter(c => c.status === "replied").length,
      hidden: all.filter(c => c.status === "hidden").length,
      ignored: all.filter(c => c.status === "ignored").length,
      positive: all.filter(c => c.sentiment === "positive").length,
      neutral: all.filter(c => c.sentiment === "neutral").length,
      negative: all.filter(c => c.sentiment === "negative").length,
    };
  }),
});
