import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { videoAds, knowledgeFiles } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";

const HEYGEN_BASE = "https://api.heygen.com";

async function heygenFetch(path: string, method = "GET", body?: unknown): Promise<any> {
  const apiKey = ENV.heygenApiKey;
  if (!apiKey) throw new Error("HeyGen API-Key nicht konfiguriert.");
  const res = await fetch(`${HEYGEN_BASE}${path}`, {
    method,
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

export const videoAdsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    return db
      .select()
      .from(videoAds)
      .where(eq(videoAds.userId, ctx.user.id))
      .orderBy(desc(videoAds.createdAt));
  }),

  generateScript: protectedProcedure
    .input(
      z.object({
        angle: z.string().optional(),
        targetEmotion: z.enum(["fomo", "pain", "curiosity", "authority", "social_proof"]).default("pain"),
        language: z.enum(["de", "en"]).default("de"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Get knowledge context
      const kfFiles = await db
        .select()
        .from(knowledgeFiles)
        .where(eq(knowledgeFiles.userId, ctx.user.id));
      const knowledgeContext = kfFiles
        .map((f) => `${f.title}:\n${f.content.slice(0, 600)}`)
        .join("\n\n");

      const emotionMap: Record<string, string> = {
        fomo: "Angst etwas zu verpassen (FOMO)",
        pain: "Schmerz und Frustration",
        curiosity: "Neugier und Überraschung",
        authority: "Autorität und Expertise",
        social_proof: "Social Proof und Vertrauen",
      };

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Du bist ein erfahrener Meta Ads Video-Skript-Autor für EasySignals.
Erstelle ein Video-Ad-Skript für einen ${input.language === "de" ? "deutschen" : "englischen"} Markt.
Das Skript wird von Livio Swiss (25 Jahre, Gründer EasySignals) gesprochen.
Tonalität: ${emotionMap[input.targetEmotion]}

Kontext über EasySignals:
${knowledgeContext.slice(0, 2000)}

Format (STRIKT einhalten):
HOOK_1: [Hook-Text, max 15 Wörter, direkt und provokativ]
HOOK_2: [Hook-Text, max 15 Wörter, Neugier weckend]
HOOK_3: [Hook-Text, max 15 Wörter, Schmerz-basiert]
BODY: [Hauptteil, 50-80 Wörter, Problem → Lösung → Beweis]
CTA: [Call-to-Action, max 20 Wörter, klar und dringend]`,
          },
          {
            role: "user",
            content: input.angle
              ? `Erstelle ein Skript mit diesem Winkel: ${input.angle}`
              : "Erstelle ein Skript basierend auf dem EasySignals-Kontext.",
          },
        ],
      });

      const raw = (response as any).choices?.[0]?.message?.content ?? "";

      // Parse structured output
      const extract = (key: string) => {
        const match = raw.match(new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, "s"));
        return match?.[1]?.trim() ?? "";
      };

      return {
        hook1: extract("HOOK_1"),
        hook2: extract("HOOK_2"),
        hook3: extract("HOOK_3"),
        body: extract("BODY"),
        cta: extract("CTA"),
        raw,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        hook: z.string().min(1),
        body: z.string().min(1),
        cta: z.string().min(1),
        avatarId: z.string().optional(),
        voiceId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const fullScript = `${input.hook}\n\n${input.body}\n\n${input.cta}`;

      const [inserted] = await db
        .insert(videoAds)
        .values({
          userId: ctx.user.id,
          title: input.title,
          hook: input.hook,
          body: input.body,
          cta: input.cta,
          fullScript,
          avatarId: input.avatarId ?? null,
          voiceId: input.voiceId ?? null,
          status: "draft",
          aspectRatio: "9:16",
        })
        .$returningId();

      return { id: inserted.id };
    }),

  generateVideo: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        avatarId: z.string(),
        voiceId: z.string(),
        hookIndex: z.enum(["1", "2", "3"]).default("1"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const [ad] = await db
        .select()
        .from(videoAds)
        .where(and(eq(videoAds.id, input.id), eq(videoAds.userId, ctx.user.id)));
      if (!ad) throw new Error("Video Ad nicht gefunden");

      // Build script: hook + body + cta
      const script = `${ad.hook}\n\n${ad.body}\n\n${ad.cta}`;

      // Update status to generating
      await db
        .update(videoAds)
        .set({ status: "generating", avatarId: input.avatarId, voiceId: input.voiceId })
        .where(eq(videoAds.id, input.id));

      try {
        const body = {
          title: ad.title,
          avatar_id: input.avatarId,
          script,
          voice_id: input.voiceId,
          resolution: "1080p",
          aspect_ratio: "9:16",
          voice_settings: { speed: 1, pitch: 0 },
        };
        const data = await heygenFetch("/v2/videos", "POST", body);
        const heygenVideoId = data?.data?.video_id as string;
        if (!heygenVideoId) throw new Error("HeyGen hat keine Video-ID zurückgegeben.");

        await db
          .update(videoAds)
          .set({ heygenVideoId, status: "generating" })
          .where(eq(videoAds.id, input.id));

        return { heygenVideoId, message: "Video wird erstellt (~2-5 Minuten)." };
      } catch (e: any) {
        await db
          .update(videoAds)
          .set({ status: "error", errorMessage: e.message })
          .where(eq(videoAds.id, input.id));
        throw e;
      }
    }),

  checkStatus: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const [ad] = await db
        .select()
        .from(videoAds)
        .where(and(eq(videoAds.id, input.id), eq(videoAds.userId, ctx.user.id)));
      if (!ad) throw new Error("Video Ad nicht gefunden");
      if (!ad.heygenVideoId) return { status: ad.status, videoUrl: null };

      // Check HeyGen status
      const data = await heygenFetch(`/v1/video_status.get?video_id=${ad.heygenVideoId}`);
      const status = (data?.data?.status as string) ?? "pending";
      const videoUrl = data?.data?.video_url as string | undefined;
      const thumbnailUrl = data?.data?.thumbnail_url as string | undefined;

      if (status === "completed" && videoUrl) {
        await db
          .update(videoAds)
          .set({ status: "ready", videoUrl, thumbnailUrl: thumbnailUrl ?? null })
          .where(eq(videoAds.id, input.id));
      } else if (status === "failed") {
        await db
          .update(videoAds)
          .set({ status: "error", errorMessage: data?.data?.error ?? "Unbekannter Fehler" })
          .where(eq(videoAds.id, input.id));
      }

      return { status: status === "completed" ? "ready" : status, videoUrl: videoUrl ?? null, thumbnailUrl: thumbnailUrl ?? null };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .delete(videoAds)
        .where(and(eq(videoAds.id, input.id), eq(videoAds.userId, ctx.user.id)));
      return { success: true };
    }),

  generateDailyBatch: protectedProcedure
    .input(
      z.object({
        avatarId: z.string(),
        voiceId: z.string(),
        language: z.enum(["de", "en"]).default("de"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Get knowledge context
      const kfFiles = await db
        .select()
        .from(knowledgeFiles)
        .where(eq(knowledgeFiles.userId, ctx.user.id));
      const knowledgeContext = kfFiles
        .map((f) => `${f.title}:\n${f.content.slice(0, 500)}`)
        .join("\n\n");

      // Generate 3 hooks + 1 body + 1 CTA
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Du bist ein erfahrener Meta Ads Video-Skript-Autor für EasySignals.
Erstelle einen täglichen Ad-Batch: 3 verschiedene Hooks, 1 Body, 1 CTA.
Sprache: ${input.language === "de" ? "Deutsch" : "Englisch"}
Gesprochen von: Livio Swiss (25 Jahre, Gründer EasySignals)

Kontext:
${knowledgeContext.slice(0, 2000)}

Format (STRIKT):
HOOK_1: [Hook 1, max 15 Wörter]
HOOK_2: [Hook 2, max 15 Wörter]
HOOK_3: [Hook 3, max 15 Wörter]
BODY: [50-80 Wörter: Problem → Lösung → Beweis]
CTA: [max 20 Wörter: klar und dringend]`,
          },
          { role: "user", content: "Erstelle den täglichen Batch." },
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

      // Create 3 video ads (one per hook)
      const createdIds: number[] = [];
      for (const [i, hook] of [[1, hook1], [2, hook2], [3, hook3]] as [number, string][]) {
        const fullScript = `${hook}\n\n${body}\n\n${cta}`;
        const [inserted] = await db
          .insert(videoAds)
          .values({
            userId: ctx.user.id,
            title: `Daily Batch – Hook ${i} (${new Date().toLocaleDateString("de-DE")})`,
            hook,
            body,
            cta,
            fullScript,
            avatarId: input.avatarId,
            voiceId: input.voiceId,
            status: "draft",
            aspectRatio: "9:16",
          })
          .$returningId();
        createdIds.push(inserted.id);
      }

      return { createdIds, hook1, hook2, hook3, body, cta };
    }),
});
