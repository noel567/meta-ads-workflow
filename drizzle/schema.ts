import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  boolean,
  json,
  bigint,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Meta API Connection
export const metaConnections = mysqlTable("meta_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  accessToken: text("accessToken").notNull(),
  adAccountId: varchar("adAccountId", { length: 64 }).notNull(),
  adAccountName: varchar("adAccountName", { length: 255 }),
  appId: varchar("appId", { length: 64 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MetaConnection = typeof metaConnections.$inferSelect;
export type InsertMetaConnection = typeof metaConnections.$inferInsert;

// Campaigns Cache
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  metaId: varchar("metaId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }),
  objective: varchar("objective", { length: 64 }),
  dailyBudget: float("dailyBudget"),
  lifetimeBudget: float("lifetimeBudget"),
  startTime: timestamp("startTime"),
  stopTime: timestamp("stopTime"),
  rawData: json("rawData"),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// Ads Cache with KPIs
export const ads = mysqlTable("ads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  campaignId: int("campaignId"),
  metaId: varchar("metaId", { length: 64 }).notNull(),
  campaignMetaId: varchar("campaignMetaId", { length: 64 }),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }),
  adsetName: varchar("adsetName", { length: 255 }),
  impressions: bigint("impressions", { mode: "number" }),
  reach: bigint("reach", { mode: "number" }),
  clicks: bigint("clicks", { mode: "number" }),
  spend: float("spend"),
  ctr: float("ctr"),
  cpc: float("cpc"),
  cpm: float("cpm"),
  roas: float("roas"),
  conversions: float("conversions"),
  creativeType: varchar("creativeType", { length: 32 }),
  thumbnailUrl: text("thumbnailUrl"),
  adText: text("adText"),
  headline: varchar("headline", { length: 512 }),
  callToAction: varchar("callToAction", { length: 64 }),
  rawData: json("rawData"),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Ad = typeof ads.$inferSelect;
export type InsertAd = typeof ads.$inferInsert;

// Competitor Ads from Ad Library
export const competitorAds = mysqlTable("competitor_ads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  competitorId: int("competitorId"),
  metaAdId: varchar("metaAdId", { length: 64 }),
  pageName: varchar("pageName", { length: 255 }),
  pageId: varchar("pageId", { length: 64 }),
  adText: text("adText"),
  headline: text("headline"),
  callToAction: varchar("callToAction", { length: 64 }),
  imageUrl: text("imageUrl"),
  videoUrl: text("videoUrl"),
  startDate: varchar("startDate", { length: 32 }),
  endDate: varchar("endDate", { length: 32 }),
  country: varchar("country", { length: 8 }),
  searchQuery: varchar("searchQuery", { length: 255 }),
  detectedLanguage: varchar("detectedLanguage", { length: 16 }),
  isProcessed: boolean("isProcessed").default(false).notNull(),
  rawData: json("rawData"),
  savedAt: timestamp("savedAt").defaultNow().notNull(),
});

export type CompetitorAd = typeof competitorAds.$inferSelect;
export type InsertCompetitorAd = typeof competitorAds.$inferInsert;

// Transcripts
export const transcripts = mysqlTable("transcripts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  sourceType: mysqlEnum("sourceType", ["competitor_ad", "manual", "ai_generated", "batch"]).default("manual").notNull(),
  sourceId: int("sourceId"),
  tags: varchar("tags", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transcript = typeof transcripts.$inferSelect;
export type InsertTranscript = typeof transcripts.$inferInsert;

// Exported Documents
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  format: mysqlEnum("format", ["markdown", "pdf"]).default("markdown").notNull(),
  sourceType: mysqlEnum("sourceType", ["transcript", "analysis", "batch"]).default("transcript").notNull(),
  sourceId: int("sourceId"),
  fileUrl: text("fileUrl"),
  googleDriveFileId: varchar("googleDriveFileId", { length: 255 }),
  googleDriveUrl: text("googleDriveUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ─── NEW: Competitors (tracked brands/pages) ─────────────────────────────────

export const competitors = mysqlTable("competitors", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  pageId: varchar("pageId", { length: 64 }),
  pageName: varchar("pageName", { length: 255 }),
  country: varchar("country", { length: 8 }).default("DE").notNull(),
  language: varchar("language", { length: 16 }).default("de"),
  isActive: boolean("isActive").default(true).notNull(),
  lastScannedAt: timestamp("lastScannedAt"),
  totalAdsFound: int("totalAdsFound").default(0).notNull(),
  newAdsSinceLastScan: int("newAdsSinceLastScan").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Competitor = typeof competitors.$inferSelect;
export type InsertCompetitor = typeof competitors.$inferInsert;

// ─── NEW: Scan Logs ───────────────────────────────────────────────────────────

export const scanLogs = mysqlTable("scan_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  competitorId: int("competitorId"),
  competitorName: varchar("competitorName", { length: 255 }),
  adsFound: int("adsFound").default(0).notNull(),
  newAds: int("newAds").default(0).notNull(),
  batchesCreated: int("batchesCreated").default(0).notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type ScanLog = typeof scanLogs.$inferSelect;
export type InsertScanLog = typeof scanLogs.$inferInsert;

// ─── NEW: Ad Batches (Body + CTA + 3 Hooks) ──────────────────────────────────

export const adBatches = mysqlTable("ad_batches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  sourceAdId: int("sourceAdId"),
  sourceAdText: text("sourceAdText"),
  competitorName: varchar("competitorName", { length: 255 }),
  // Core content
  body: text("body").notNull(),
  cta: text("cta").notNull(),
  hook1: text("hook1").notNull(),
  hook2: text("hook2").notNull(),
  hook3: text("hook3").notNull(),
  // HeyGen formatted scripts
  heygenScript: text("heygenScript"),
  // Metadata
  status: mysqlEnum("status", ["draft", "ready", "exported", "used"]).default("draft").notNull(),
  language: varchar("language", { length: 16 }).default("de"),
  brandContext: text("brandContext"),
  googleDriveFileId: varchar("googleDriveFileId", { length: 255 }),
  googleDriveUrl: text("googleDriveUrl"),
  transcriptId: int("transcriptId"),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdBatch = typeof adBatches.$inferSelect;
export type InsertAdBatch = typeof adBatches.$inferInsert;

// ─── NEW: Google Drive Connection ─────────────────────────────────────────────

export const googleDriveConnections = mysqlTable("google_drive_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  tokenExpiry: timestamp("tokenExpiry"),
  rootFolderId: varchar("rootFolderId", { length: 255 }),
  rootFolderName: varchar("rootFolderName", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GoogleDriveConnection = typeof googleDriveConnections.$inferSelect;
export type InsertGoogleDriveConnection = typeof googleDriveConnections.$inferInsert;

// ─── NEW: Brand Settings (Easy Signals context) ───────────────────────────────

export const brandSettings = mysqlTable("brand_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  brandName: varchar("brandName", { length: 255 }).default("Easy Signals").notNull(),
  brandDescription: text("brandDescription"),
  targetAudience: text("targetAudience"),
  toneOfVoice: varchar("toneOfVoice", { length: 128 }),
  uniqueSellingPoints: text("uniqueSellingPoints"),
  callToActionDefault: varchar("callToActionDefault", { length: 255 }),
  language: varchar("language", { length: 16 }).default("de").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrandSettings = typeof brandSettings.$inferSelect;
export type InsertBrandSettings = typeof brandSettings.$inferInsert;
