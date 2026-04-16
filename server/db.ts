import { eq, desc, and } from "drizzle-orm";
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
  // Deactivate old connections for this user
  await db
    .update(metaConnections)
    .set({ isActive: false })
    .where(eq(metaConnections.userId, data.userId));
  // Insert new connection
  await db.insert(metaConnections).values({ ...data, isActive: true });
}

export async function deleteMetaConnection(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(metaConnections)
    .set({ isActive: false })
    .where(eq(metaConnections.userId, userId));
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
    await db
      .insert(campaigns)
      .values({ ...campaign, userId })
      .onDuplicateKeyUpdate({ set: { ...campaign, syncedAt: new Date() } });
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
    await db
      .insert(ads)
      .values({ ...ad, userId })
      .onDuplicateKeyUpdate({ set: { ...ad, syncedAt: new Date() } });
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

export async function saveCompetitorAd(data: InsertCompetitorAd) {
  const db = await getDb();
  if (!db) return;
  await db.insert(competitorAds).values(data);
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
  const result = await db.insert(transcripts).values(data);
  return result;
}

export async function updateTranscript(id: number, userId: number, data: Partial<InsertTranscript>) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(transcripts)
    .set(data)
    .where(and(eq(transcripts.id, id), eq(transcripts.userId, userId)));
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

export async function deleteDocument(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
}
