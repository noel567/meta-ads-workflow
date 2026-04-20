import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { adComments } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export const adCommentsRouter = router({

  // Kommentare für eine Ad laden
  list: protectedProcedure
    .input(z.object({ adId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(adComments)
        .where(
          and(
            eq(adComments.userId, ctx.user.id),
            eq(adComments.adId, input.adId)
          )
        )
        .orderBy(desc(adComments.createdAt));
    }),

  // Kommentar hinzufügen
  add: protectedProcedure
    .input(z.object({
      adId: z.string(),
      adName: z.string().optional(),
      campaignName: z.string().optional(),
      text: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const result = await db.insert(adComments).values({
        userId: ctx.user.id,
        adId: input.adId,
        adName: input.adName ?? null,
        campaignName: input.campaignName ?? null,
        text: input.text,
      });
      return { id: Number((result as any).insertId), success: true };
    }),

  // Kommentar löschen
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      await db
        .delete(adComments)
        .where(
          and(
            eq(adComments.id, input.id),
            eq(adComments.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),
});
