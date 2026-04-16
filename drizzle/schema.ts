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
  // KPIs
  impressions: bigint("impressions", { mode: "number" }),
  reach: bigint("reach", { mode: "number" }),
  clicks: bigint("clicks", { mode: "number" }),
  spend: float("spend"),
  ctr: float("ctr"),
  cpc: float("cpc"),
  cpm: float("cpm"),
  roas: float("roas"),
  conversions: float("conversions"),
  // Creative
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
  sourceType: mysqlEnum("sourceType", ["competitor_ad", "manual", "ai_generated"]).default("manual").notNull(),
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
  sourceType: mysqlEnum("sourceType", ["transcript", "analysis"]).default("transcript").notNull(),
  sourceId: int("sourceId"),
  fileUrl: text("fileUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
