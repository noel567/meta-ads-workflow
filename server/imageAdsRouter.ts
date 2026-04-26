import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { imageAds, adHeadlines, knowledgeFiles } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";

// Livio reference photo URL for image generation
const LIVIO_PHOTO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663565941002/UojQwiICNYeKudJO.webp";

const AD_STYLE_PROMPTS: Record<string, string> = {
  luxury: `Luxury lifestyle photography. A young successful man (Livio Swiss, 25 years old, curly dark hair, beard, wearing black EasySignals polo shirt) in a high-end penthouse or luxury setting. Professional studio lighting, cinematic quality, aspirational wealth aesthetic. Gold and dark color palette.`,
  trading_lifestyle: `Professional trading setup photography. A young trader (Livio Swiss, 25 years old, curly dark hair, beard, wearing black EasySignals polo shirt) at multiple monitors showing green charts. Modern office or home setup, confident pose, success atmosphere. Dark background with green accent lights.`,
  results_proof: `Social proof marketing image. Clean minimal design with a smartphone showing trading profits, green numbers, success metrics. EasySignals branding. Dark premium background with gold accents. Professional product photography style.`,
  dark_premium: `Dark premium minimalist advertisement. Dramatic lighting, deep blacks and gold tones. A young confident man (Livio Swiss, 25 years old, curly dark hair, beard) in business casual attire. Luxury watch visible, confident posture. High contrast, editorial photography style.`,
};

export const imageAdsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const ads = await db
      .select()
      .from(imageAds)
      .where(eq(imageAds.userId, ctx.user.id))
      .orderBy(desc(imageAds.createdAt));

    // Get headlines for each ad
    const result = await Promise.all(
      ads.map(async (ad) => {
        const headlines = await db
          .select()
          .from(adHeadlines)
          .where(eq(adHeadlines.imageAdId, ad.id));
        return { ...ad, headlines };
      })
    );
    return result;
  }),

  generate: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        style: z.enum(["luxury", "trading_lifestyle", "results_proof", "dark_premium"]),
        customPrompt: z.string().optional(),
        generateHeadlines: z.boolean().default(true),
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

      // Build image prompt
      const basePrompt = AD_STYLE_PROMPTS[input.style] ?? AD_STYLE_PROMPTS.luxury;
      const fullPrompt = input.customPrompt
        ? `${basePrompt}\n\nAdditional context: ${input.customPrompt}`
        : basePrompt;

      // Generate image
      const { url: imageUrl } = await generateImage({
        prompt: fullPrompt,
        originalImages: [{ url: LIVIO_PHOTO_URL, mimeType: "image/webp" }],
      });

      // Upload to S3
      if (!imageUrl) throw new Error("Bild-Generierung fehlgeschlagen");
      const imgResp = await fetch(imageUrl);
      const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
      const suffix = Date.now();
      const { url: s3Url } = await storagePut(
        `image-ads/${ctx.user.id}-${suffix}.jpg`,
        imgBuffer,
        "image/jpeg"
      );

      // Insert into DB
      const [inserted] = await db
        .insert(imageAds)
        .values({
          userId: ctx.user.id,
          title: input.title,
          style: input.style,
          prompt: fullPrompt,
          imageUrl: s3Url,
        })
        .$returningId();
      const adId = inserted.id;

      // Generate headlines if requested
      let headlines: string[] = [];
      if (input.generateHeadlines) {
        const hlResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Du bist ein Meta Ads Copywriter für EasySignals, einen Trading-Signal-Service.
Erstelle 5 verschiedene Headlines für eine Facebook/Instagram Ad.
Jede Headline max. 40 Zeichen. Direkt, emotional, auf Deutsch.
Antworte NUR mit den 5 Headlines, eine pro Zeile, keine Nummerierung.

Kontext:
${knowledgeContext.slice(0, 1000)}`,
            },
            {
              role: "user",
              content: `Ad-Stil: ${input.style}\nAd-Titel: ${input.title}\n\nErstelle 5 Headlines:`,
            },
          ],
        });

        const rawHeadlines =
          (hlResponse as any).choices?.[0]?.message?.content ?? "";
        headlines = rawHeadlines
          .split("\n")
          .map((h: string) => h.trim())
          .filter((h: string) => h.length > 0)
          .slice(0, 5);

        // Insert headlines
        for (const text of headlines) {
          await db.insert(adHeadlines).values({
            userId: ctx.user.id,
            imageAdId: adId,
            text,
          });
        }
      }

      return { id: adId, imageUrl: s3Url, headlines };
    }),

  updatePosition: protectedProcedure
    .input(z.object({ id: z.number(), x: z.number(), y: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .update(imageAds)
        .set({ boardX: input.x, boardY: input.y })
        .where(
          and(eq(imageAds.id, input.id), eq(imageAds.userId, ctx.user.id))
        );
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["draft", "testing", "active", "paused", "winner"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .update(imageAds)
        .set({ boardStatus: input.status })
        .where(
          and(eq(imageAds.id, input.id), eq(imageAds.userId, ctx.user.id))
        );
      return { success: true };
    }),

  updateHeadlineStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["draft", "testing", "active", "paused", "winner"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .update(adHeadlines)
        .set({ status: input.status })
        .where(
          and(
            eq(adHeadlines.id, input.id),
            eq(adHeadlines.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  addHeadline: protectedProcedure
    .input(z.object({ imageAdId: z.number(), text: z.string().min(1).max(512) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const [inserted] = await db
        .insert(adHeadlines)
        .values({
          userId: ctx.user.id,
          imageAdId: input.imageAdId,
          text: input.text,
        })
        .$returningId();
      return { id: inserted.id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .delete(adHeadlines)
        .where(eq(adHeadlines.imageAdId, input.id));
      await db
        .delete(imageAds)
        .where(
          and(eq(imageAds.id, input.id), eq(imageAds.userId, ctx.user.id))
        );
      return { success: true };
    }),

  uploadToMeta: protectedProcedure
    .input(z.object({ id: z.number(), adAccountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const [ad] = await db
        .select()
        .from(imageAds)
        .where(
          and(eq(imageAds.id, input.id), eq(imageAds.userId, ctx.user.id))
        );
      if (!ad) throw new Error("Ad nicht gefunden");
      if (!ad.imageUrl) throw new Error("Kein Bild vorhanden");

      // Mark as pending
      await db
        .update(imageAds)
        .set({ metaUploadStatus: "pending" })
        .where(eq(imageAds.id, input.id));

      try {
        // Upload image to Meta
        const metaToken = process.env.META_ACCESS_TOKEN ?? "";
        const formData = new FormData();
        
        // Download image
        const imgResp = await fetch(String(ad.imageUrl));
        const imgBlob = await imgResp.blob();
        formData.append("source", imgBlob, "ad_image.jpg");
        formData.append("access_token", metaToken);

        const uploadResp = await fetch(
          `https://graph.facebook.com/v19.0/${input.adAccountId}/adimages`,
          { method: "POST", body: formData }
        );
        const uploadData = await uploadResp.json() as any;

        if (!uploadData.images) {
          throw new Error(uploadData.error?.message ?? "Upload fehlgeschlagen");
        }

        const imageHash = Object.values(uploadData.images as Record<string, any>)[0]?.hash;

        await db
          .update(imageAds)
          .set({ metaAdId: imageHash, metaUploadStatus: "uploaded" })
          .where(eq(imageAds.id, input.id));

        return { success: true, imageHash };
      } catch (e: any) {
        await db
          .update(imageAds)
          .set({ metaUploadStatus: "error" })
          .where(eq(imageAds.id, input.id));
        throw new Error(`Meta Upload Fehler: ${e.message}`);
      }
    }),
});
