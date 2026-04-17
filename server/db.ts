import { eq, desc, and, isNull, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  metaConnections,
  InsertMetaConnection,
  campaigns,
  InsertCampaign,
  ads,
  InsertAd,
  competitorAds,
  InsertCompetitorAd,
  transcripts,
  InsertTranscript,
  documents,
  InsertDocument,
  competitors,
  InsertCompetitor,
  adBatches,
  InsertAdBatch,
  brandSettings,
  InsertBrandSettings,
  googleDriveConnections,
  InsertGoogleDriveConnection,
  scanLogs,
  InsertScanLog,
  heygenVideos,
  InsertHeygenVideo,
  HeygenVideo,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Meta Connections ─────────────────────────────────────────────────────────

export async function getMetaConnection(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(metaConnections)
    .where(and(eq(metaConnections.userId, userId), eq(metaConnections.isActive, true)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertMetaConnection(data: InsertMetaConnection) {
  const db = await getDb();
  if (!db) return;
  await db.update(metaConnections).set({ isActive: false }).where(eq(metaConnections.userId, data.userId));
  await db.insert(metaConnections).values({ ...data, isActive: true });
}

export async function deleteMetaConnection(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(metaConnections).set({ isActive: false }).where(eq(metaConnections.userId, userId));
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export async function getCampaigns(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campaigns).where(eq(campaigns.userId, userId)).orderBy(desc(campaigns.createdAt));
}

export async function upsertCampaigns(userId: number, data: InsertCampaign[]) {
  const db = await getDb();
  if (!db) return;
  for (const campaign of data) {
    await db.insert(campaigns).values({ ...campaign, userId }).onDuplicateKeyUpdate({ set: { ...campaign, syncedAt: new Date() } });
  }
}

export async function deleteCampaignsByUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(campaigns).where(eq(campaigns.userId, userId));
}

// ─── Ads ──────────────────────────────────────────────────────────────────────

export async function getAds(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ads).where(eq(ads.userId, userId)).orderBy(desc(ads.createdAt));
}

export async function upsertAds(userId: number, data: InsertAd[]) {
  const db = await getDb();
  if (!db) return;
  for (const ad of data) {
    await db.insert(ads).values({ ...ad, userId }).onDuplicateKeyUpdate({ set: { ...ad, syncedAt: new Date() } });
  }
}

export async function deleteAdsByUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(ads).where(eq(ads.userId, userId));
}

// ─── Competitor Ads ───────────────────────────────────────────────────────────

export async function getCompetitorAds(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(competitorAds).where(eq(competitorAds.userId, userId)).orderBy(desc(competitorAds.savedAt));
}

export async function getCompetitorAdsByCompetitor(userId: number, competitorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(competitorAds)
    .where(and(eq(competitorAds.userId, userId), eq(competitorAds.competitorId, competitorId)))
    .orderBy(desc(competitorAds.savedAt));
}

export async function saveCompetitorAd(data: InsertCompetitorAd) {
  const db = await getDb();
  if (!db) return;
  await db.insert(competitorAds).values(data);
}

export async function markCompetitorAdProcessed(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(competitorAds).set({ isProcessed: true }).where(eq(competitorAds.id, id));
}

export async function deleteCompetitorAd(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(competitorAds).where(and(eq(competitorAds.id, id), eq(competitorAds.userId, userId)));
}

// ─── Transcripts ──────────────────────────────────────────────────────────────

export async function getTranscripts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transcripts).where(eq(transcripts.userId, userId)).orderBy(desc(transcripts.updatedAt));
}

export async function getTranscriptById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(transcripts)
    .where(and(eq(transcripts.id, id), eq(transcripts.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createTranscript(data: InsertTranscript) {
  const db = await getDb();
  if (!db) return undefined;
  return db.insert(transcripts).values(data);
}

export async function updateTranscript(id: number, userId: number, data: Partial<InsertTranscript>) {
  const db = await getDb();
  if (!db) return;
  await db.update(transcripts).set(data).where(and(eq(transcripts.id, id), eq(transcripts.userId, userId)));
}

export async function deleteTranscript(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(transcripts).where(and(eq(transcripts.id, id), eq(transcripts.userId, userId)));
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function getDocuments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt));
}

export async function createDocument(data: InsertDocument) {
  const db = await getDb();
  if (!db) return undefined;
  return db.insert(documents).values(data);
}

export async function updateDocument(id: number, userId: number, data: Partial<InsertDocument>) {
  const db = await getDb();
  if (!db) return;
  await db.update(documents).set(data).where(and(eq(documents.id, id), eq(documents.userId, userId)));
}

export async function deleteDocument(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
}

// ─── Competitors ──────────────────────────────────────────────────────────────

export async function getCompetitors(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(competitors).where(eq(competitors.userId, userId)).orderBy(desc(competitors.createdAt));
}

export async function getCompetitorById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(competitors)
    .where(and(eq(competitors.id, id), eq(competitors.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCompetitor(data: InsertCompetitor) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(competitors).values(data);
  return result;
}

export async function updateCompetitor(id: number, userId: number, data: Partial<InsertCompetitor>) {
  const db = await getDb();
  if (!db) return;
  await db.update(competitors).set(data).where(and(eq(competitors.id, id), eq(competitors.userId, userId)));
}

export async function deleteCompetitor(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(competitors).where(and(eq(competitors.id, id), eq(competitors.userId, userId)));
}

export async function getActiveCompetitors(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(competitors)
    .where(and(eq(competitors.userId, userId), eq(competitors.isActive, true)))
    .orderBy(desc(competitors.createdAt));
}

// ─── Ad Batches ───────────────────────────────────────────────────────────────

export async function getAdBatches(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adBatches).where(eq(adBatches.userId, userId)).orderBy(desc(adBatches.generatedAt));
}

export async function getAdBatchById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(adBatches)
    .where(and(eq(adBatches.id, id), eq(adBatches.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createAdBatch(data: InsertAdBatch) {
  const db = await getDb();
  if (!db) return undefined;
  return db.insert(adBatches).values(data);
}

export async function updateAdBatch(id: number, userId: number, data: Partial<InsertAdBatch>) {
  const db = await getDb();
  if (!db) return;
  await db.update(adBatches).set(data).where(and(eq(adBatches.id, id), eq(adBatches.userId, userId)));
}

export async function deleteAdBatch(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(adBatches).where(and(eq(adBatches.id, id), eq(adBatches.userId, userId)));
}

// ─── Brand Settings ───────────────────────────────────────────────────────────

export async function getBrandSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(brandSettings).where(eq(brandSettings.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertBrandSettings(data: InsertBrandSettings) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(brandSettings)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        brandName: data.brandName,
        brandDescription: data.brandDescription,
        targetAudience: data.targetAudience,
        toneOfVoice: data.toneOfVoice,
        uniqueSellingPoints: data.uniqueSellingPoints,
        callToActionDefault: data.callToActionDefault,
        language: data.language,
      },
    });
}

// ─── Google Drive Connections ─────────────────────────────────────────────────

export async function getGoogleDriveConnection(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(googleDriveConnections)
    .where(and(eq(googleDriveConnections.userId, userId), eq(googleDriveConnections.isActive, true)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertGoogleDriveConnection(data: InsertGoogleDriveConnection) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(googleDriveConnections)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiry: data.tokenExpiry,
        rootFolderId: data.rootFolderId,
        rootFolderName: data.rootFolderName,
        isActive: true,
      },
    });
}

export async function deleteGoogleDriveConnection(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(googleDriveConnections).set({ isActive: false }).where(eq(googleDriveConnections.userId, userId));
}

// ─── Scan Logs ────────────────────────────────────────────────────────────────

export async function getScanLogs(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scanLogs).where(eq(scanLogs.userId, userId)).orderBy(desc(scanLogs.startedAt)).limit(limit);
}

export async function createScanLog(data: InsertScanLog) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(scanLogs).values(data);
  return result;
}

export async function updateScanLog(id: number, data: Partial<InsertScanLog>) {
  const db = await getDb();
  if (!db) return;
  await db.update(scanLogs).set(data).where(eq(scanLogs.id, id));
}

// ─── HeyGen Videos ────────────────────────────────────────────────────────────

export async function createHeygenVideo(data: InsertHeygenVideo): Promise<number | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(heygenVideos).values(data);
  return (result as any)[0]?.insertId as number | undefined;
}

export async function getHeygenVideos(userId: number): Promise<HeygenVideo[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(heygenVideos).where(eq(heygenVideos.userId, userId)).orderBy(desc(heygenVideos.createdAt)).limit(50);
}

export async function getHeygenVideosByBatch(userId: number, batchId: number): Promise<HeygenVideo[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(heygenVideos)
    .where(and(eq(heygenVideos.userId, userId), eq(heygenVideos.batchId, batchId)))
    .orderBy(desc(heygenVideos.createdAt));
}

export async function updateHeygenVideo(id: number, data: Partial<InsertHeygenVideo>) {
  const db = await getDb();
  if (!db) return;
  await db.update(heygenVideos).set(data).where(eq(heygenVideos.id, id));
}

export async function getHeygenVideoByHeygenId(heygenVideoId: string): Promise<HeygenVideo | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(heygenVideos).where(eq(heygenVideos.heygenVideoId, heygenVideoId)).limit(1);
  return result[0];
}

// ─── Video Research Pipeline ──────────────────────────────────────────────────
import { VideoResearch, InsertVideoResearch, videoResearch } from "../drizzle/schema";

export async function createVideoResearch(data: InsertVideoResearch): Promise<number | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(videoResearch).values(data);
  return (result as any)[0]?.insertId as number | undefined;
}

export async function getVideoResearchList(userId: number): Promise<VideoResearch[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(videoResearch).where(eq(videoResearch.userId, userId)).orderBy(desc(videoResearch.createdAt)).limit(100);
}

export async function getVideoResearchById(id: number, userId: number): Promise<VideoResearch | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(videoResearch).where(and(eq(videoResearch.id, id), eq(videoResearch.userId, userId))).limit(1);
  return result[0];
}

export async function updateVideoResearch(id: number, data: Partial<InsertVideoResearch>) {
  const db = await getDb();
  if (!db) return;
  await db.update(videoResearch).set(data).where(eq(videoResearch.id, id));
}

export async function deleteVideoResearch(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(videoResearch).where(and(eq(videoResearch.id, id), eq(videoResearch.userId, userId)));
}
