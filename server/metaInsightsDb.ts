import { getDb } from "./db";
import { metaAdInsights, metaAiAnalyses } from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// ─── Meta Ad Insights ─────────────────────────────────────────────────────────

export async function saveInsights(userId: number, rows: typeof metaAdInsights.$inferInsert[]) {
  if (!rows.length) return;
  const db = await getDb();
  if (!db) return;
  const preset = rows[0].datePreset ?? "last_7d";
  const level = rows[0].level ?? "campaign";
  await db.delete(metaAdInsights)
    .where(and(
      eq(metaAdInsights.userId, userId),
      eq(metaAdInsights.datePreset, preset),
      sql`${metaAdInsights.level} = ${level}`
    ));
  await db.insert(metaAdInsights).values(rows);
}

export async function getInsights(userId: number, datePreset = "last_7d", level = "campaign") {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(metaAdInsights)
    .where(and(
      eq(metaAdInsights.userId, userId),
      eq(metaAdInsights.datePreset, datePreset),
      sql`${metaAdInsights.level} = ${level}`
    ))
    .orderBy(desc(metaAdInsights.spend));
}

// ─── AI Analyses ─────────────────────────────────────────────────────────────

export async function saveAiAnalysis(data: typeof metaAiAnalyses.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(metaAiAnalyses).values(data);
}

export async function getLatestAiAnalysis(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(metaAiAnalyses)
    .where(eq(metaAiAnalyses.userId, userId))
    .orderBy(desc(metaAiAnalyses.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAiAnalysisHistory(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(metaAiAnalyses)
    .where(eq(metaAiAnalyses.userId, userId))
    .orderBy(desc(metaAiAnalyses.createdAt))
    .limit(limit);
}
