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
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
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
  connectedEmail: varchar("connectedEmail", { length: 320 }),
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

// ─── HeyGen Videos ────────────────────────────────────────────────────────────
export const heygenVideos = mysqlTable("heygen_videos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  batchId: int("batchId"),
  heygenVideoId: varchar("heygenVideoId", { length: 128 }).notNull(),
  title: varchar("title", { length: 255 }),
  script: text("script"),
  avatarId: varchar("avatarId", { length: 128 }),
  avatarName: varchar("avatarName", { length: 255 }),
  voiceId: varchar("voiceId", { length: 128 }),
  voiceName: varchar("voiceName", { length: 255 }),
  status: mysqlEnum("status", ["pending", "waiting", "processing", "completed", "failed"]).default("pending").notNull(),
  videoUrl: text("videoUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  duration: float("duration"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type HeygenVideo = typeof heygenVideos.$inferSelect;
export type InsertHeygenVideo = typeof heygenVideos.$inferInsert;

// ─── Video Research Pipeline ──────────────────────────────────────────────────
export const videoResearch = mysqlTable("video_research", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Source info
  sourceUrl: text("sourceUrl").notNull(),
  platform: mysqlEnum("platform", ["facebook", "instagram", "youtube", "tiktok", "other"]).default("facebook").notNull(),
  competitorName: varchar("competitorName", { length: 255 }),
  competitorId: int("competitorId"),
  // File storage
  s3Key: text("s3Key"),
  s3Url: text("s3Url"),
  // Pipeline status
  status: mysqlEnum("status", ["pending", "downloading", "downloaded", "transcribing", "transcribed", "analyzing", "analyzed", "adapting", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  // Transcript
  transcript: text("transcript"),
  transcriptHook: text("transcriptHook"),
  transcriptBody: text("transcriptBody"),
  transcriptCta: text("transcriptCta"),
  // Analysis
  analysisAngle: varchar("analysisAngle", { length: 255 }),
  analysisTargetAudience: text("analysisTargetAudience"),
  analysisMechanic: text("analysisMechanic"),
  analysisOfferStructure: text("analysisOfferStructure"),
  analysisWhyItWorks: text("analysisWhyItWorks"),
  analysisVisualPattern: text("analysisVisualPattern"),
  // EasySignals Adaptation
  adaptHook1: text("adaptHook1"),
  adaptHook2: text("adaptHook2"),
  adaptHook3: text("adaptHook3"),
  adaptBody: text("adaptBody"),
  adaptCta: text("adaptCta"),
  adaptHeygenScript: text("adaptHeygenScript"),
  adaptTelegramPost: text("adaptTelegramPost"),
  adaptNanaBananaPrompt: text("adaptNanaBananaPrompt"),
  // Naming & Drive
  fileName: varchar("fileName", { length: 512 }),
  driveFolderPath: varchar("driveFolderPath", { length: 512 }),
  driveFileId: varchar("driveFileId", { length: 255 }),
  driveUrl: text("driveUrl"),
  // Metadata
  adLibraryId: varchar("adLibraryId", { length: 128 }),
  language: varchar("language", { length: 16 }).default("de"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VideoResearch = typeof videoResearch.$inferSelect;
export type InsertVideoResearch = typeof videoResearch.$inferInsert;

// ─── Telegram Content Bot ─────────────────────────────────────────────────────
export const telegramPosts = mysqlTable("telegram_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Content
  textContent: text("textContent").notNull(),
  imageUrl: text("imageUrl"),
  imagePrompt: text("imagePrompt"),
  // Topic / Theme
  topic: varchar("topic", { length: 255 }),
  contentType: mysqlEnum("contentType", ["tip", "insight", "motivation", "market_update", "signal_preview", "education", "social_proof"]).default("tip").notNull(),
  // Status
  status: mysqlEnum("status", ["draft", "scheduled", "sent", "failed"]).default("draft").notNull(),
  errorMessage: text("errorMessage"),
  // Telegram response
  telegramMessageId: varchar("telegramMessageId", { length: 64 }),
  chatId: varchar("chatId", { length: 64 }),
  // Scheduling
  scheduledAt: timestamp("scheduledAt"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TelegramPost = typeof telegramPosts.$inferSelect;
export type InsertTelegramPost = typeof telegramPosts.$inferInsert;

export const telegramSettings = mysqlTable("telegram_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // Posting schedule
  postingTimeHour: int("postingTimeHour").default(9).notNull(),   // 0-23
  postingTimeMinute: int("postingTimeMinute").default(0).notNull(), // 0-59
  isActive: boolean("isActive").default(true).notNull(),
  // Content preferences
  defaultLanguage: varchar("defaultLanguage", { length: 8 }).default("de").notNull(),
  includeEmoji: boolean("includeEmoji").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TelegramSettings = typeof telegramSettings.$inferSelect;
export type InsertTelegramSettings = typeof telegramSettings.$inferInsert;

// ─── Meta Ads Analytics ───────────────────────────────────────────────────────

export const metaAdInsights = mysqlTable("meta_ad_insights", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Identifiers
  campaignId: varchar("campaignId", { length: 64 }).notNull(),
  campaignName: varchar("campaignName", { length: 255 }).notNull(),
  adsetId: varchar("adsetId", { length: 64 }),
  adsetName: varchar("adsetName", { length: 255 }),
  adId: varchar("adId", { length: 64 }),
  adName: varchar("adName", { length: 255 }),
  level: mysqlEnum("level", ["account", "campaign", "adset", "ad"]).default("campaign").notNull(),
  // KPIs
  spend: float("spend").default(0),
  impressions: bigint("impressions", { mode: "number" }).default(0),
  clicks: bigint("clicks", { mode: "number" }).default(0),
  reach: bigint("reach", { mode: "number" }).default(0),
  ctr: float("ctr").default(0),
  cpc: float("cpc").default(0),
  cpm: float("cpm").default(0),
  roas: float("roas").default(0),
  purchases: float("purchases").default(0),
  leads: float("leads").default(0),
  costPerPurchase: float("costPerPurchase").default(0),
  costPerLead: float("costPerLead").default(0),
  frequency: float("frequency").default(0),
  // Status
  status: varchar("status", { length: 32 }),
  objective: varchar("objective", { length: 64 }),
  dailyBudget: float("dailyBudget"),
  // Period
  dateStart: varchar("dateStart", { length: 16 }).notNull(),
  dateStop: varchar("dateStop", { length: 16 }).notNull(),
  datePreset: varchar("datePreset", { length: 32 }),
  // Raw
  rawData: json("rawData"),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});

export type MetaAdInsight = typeof metaAdInsights.$inferSelect;
export type InsertMetaAdInsight = typeof metaAdInsights.$inferInsert;

// KI-Analyse Ergebnisse (täglich)
export const metaAiAnalyses = mysqlTable("meta_ai_analyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  analysisDate: varchar("analysisDate", { length: 16 }).notNull(), // YYYY-MM-DD
  datePreset: varchar("datePreset", { length: 32 }).default("last_7d"),
  // KI Output
  summary: text("summary"),                    // Kurze Zusammenfassung
  topPerformers: json("topPerformers"),         // Array von Top-Kampagnen
  underperformers: json("underperformers"),     // Array von schwachen Kampagnen
  budgetRecommendations: json("budgetRecommendations"), // Budget-Empfehlungen
  actionItems: json("actionItems"),             // Konkrete To-Dos
  insights: json("insights"),                  // Weitere Insights
  overallScore: float("overallScore"),          // 0-10 Performance Score
  totalSpend: float("totalSpend"),
  totalRevenue: float("totalRevenue"),
  avgRoas: float("avgRoas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MetaAiAnalysis = typeof metaAiAnalyses.$inferSelect;
export type InsertMetaAiAnalysis = typeof metaAiAnalyses.$inferInsert;

// Ad Comments (Creative Detail Ansicht)
export const adComments = mysqlTable("ad_comments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  adId: varchar("adId", { length: 64 }).notNull(),       // Meta Ad ID
  adName: text("adName"),                                 // Ad-Name für Anzeige
  campaignName: text("campaignName"),
  text: text("text").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AdComment = typeof adComments.$inferSelect;
export type InsertAdComment = typeof adComments.$inferInsert;

// ─── Automatische Budget-Regeln ──────────────────────────────────────────────
export const budgetRules = mysqlTable("budget_rules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  metric: varchar("metric", { length: 32 }).notNull(),        // cpl, ctr, cpc, spend, roas
  condition: varchar("condition", { length: 8 }).notNull(),   // gt, lt, gte, lte
  threshold: float("threshold").notNull(),
  action: varchar("action", { length: 16 }).notNull(),        // increase, decrease, pause, activate
  changePercent: float("changePercent"),
  maxBudgetCents: int("maxBudgetCents"),
  minBudgetCents: int("minBudgetCents"),
  campaignId: varchar("campaignId", { length: 32 }),
  campaignName: varchar("campaignName", { length: 256 }),
  lookbackDays: int("lookbackDays").default(7).notNull(),
  cooldownDays: int("cooldownDays").default(1).notNull(),
  lastExecutedAt: timestamp("lastExecutedAt"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type BudgetRule = typeof budgetRules.$inferSelect;
export type InsertBudgetRule = typeof budgetRules.$inferInsert;

export const ruleExecutions = mysqlTable("rule_executions", {
  id: int("id").autoincrement().primaryKey(),
  ruleId: int("ruleId").notNull(),
  ruleName: varchar("ruleName", { length: 128 }),
  executedAt: timestamp("executedAt").defaultNow().notNull(),
  triggered: boolean("triggered").notNull(),
  campaignId: varchar("campaignId", { length: 32 }),
  campaignName: varchar("campaignName", { length: 256 }),
  metricValue: float("metricValue"),
  oldBudgetCents: int("oldBudgetCents"),
  newBudgetCents: int("newBudgetCents"),
  reason: text("reason"),
  success: boolean("success").default(true).notNull(),
  errorMessage: text("errorMessage"),
});
export type RuleExecution = typeof ruleExecutions.$inferSelect;
export type InsertRuleExecution = typeof ruleExecutions.$inferInsert;

// ─── Drive → Meta Video-Uploads ──────────────────────────────────────────────
export const driveMetaUploads = mysqlTable("drive_meta_uploads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  driveFileId: varchar("driveFileId", { length: 255 }).notNull(),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  fileSizeBytes: bigint("fileSizeBytes", { mode: "number" }),
  mimeType: varchar("mimeType", { length: 128 }),
  metaVideoId: varchar("metaVideoId", { length: 64 }),
  metaVideoTitle: varchar("metaVideoTitle", { length: 256 }),
  status: mysqlEnum("status", ["pending", "downloading", "uploading", "processing", "ready", "error"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type DriveMetaUpload = typeof driveMetaUploads.$inferSelect;
export type InsertDriveMetaUpload = typeof driveMetaUploads.$inferInsert;

// ─── External API Keys ────────────────────────────────────────────────────────
export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  keyHash: varchar("keyHash", { length: 64 }).notNull(),
  keyPreview: varchar("keyPreview", { length: 32 }).notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// ─── Telegram Content Bot ─────────────────────────────────────────────────────
export const contentPosts = mysqlTable("content_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["mindset", "recap", "social_proof", "scarcity", "evening_recap", "quote"]).notNull(),
  text: text("text").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  sentAt: timestamp("sentAt"),
  status: mysqlEnum("status", ["pending", "sent", "error", "skipped"]).default("pending").notNull(),
  telegramMessageId: varchar("telegramMessageId", { length: 64 }),
  imageUrl: text("imageUrl"),
  dalleBackgroundUrl: text("dalleBackgroundUrl"),
  backgroundStyle: varchar("backgroundStyle", { length: 32 }),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ContentPost = typeof contentPosts.$inferSelect;
export type InsertContentPost = typeof contentPosts.$inferInsert;

export const contentBotSettings = mysqlTable("content_bot_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  autoSendMindset: boolean("autoSendMindset").default(false).notNull(),
  autoSendRecap: boolean("autoSendRecap").default(false).notNull(),
  autoSendSocialProof: boolean("autoSendSocialProof").default(false).notNull(),
  autoSendScarcity: boolean("autoSendScarcity").default(false).notNull(),
  autoSendEveningRecap: boolean("autoSendEveningRecap").default(false).notNull(),
  autoSendQuote: boolean("autoSendQuote").default(true).notNull(),
  timeMindset: varchar("timeMindset", { length: 5 }).default("07:30").notNull(),
  timeRecap: varchar("timeRecap", { length: 5 }).default("10:00").notNull(),
  timeSocialProof: varchar("timeSocialProof", { length: 5 }).default("13:00").notNull(),
  timeScarcity: varchar("timeScarcity", { length: 5 }).default("17:00").notNull(),
  timeEveningRecap: varchar("timeEveningRecap", { length: 5 }).default("20:00").notNull(),
  timeQuote: varchar("timeQuote", { length: 5 }).default("09:00").notNull(),
  defaultBackgroundStyle: varchar("defaultBackgroundStyle", { length: 32 }).default("trading").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type ContentBotSettings = typeof contentBotSettings.$inferSelect;
export type InsertContentBotSettings = typeof contentBotSettings.$inferInsert;

// ── Password Reset Tokens ──────────────────────────────────────────────────────
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ─── Knowledge Files (EasySignals Wissensbasis) ───────────────────────────────
export const knowledgeFiles = mysqlTable("knowledge_files", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  slug: varchar("slug", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  lastExpandedAt: timestamp("lastExpandedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type KnowledgeFile = typeof knowledgeFiles.$inferSelect;
export type InsertKnowledgeFile = typeof knowledgeFiles.$inferInsert;

// ─── Image Ads (AI-generierte Werbeanzeigen) ──────────────────────────────────
export const imageAds = mysqlTable("image_ads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  style: mysqlEnum("style", ["luxury", "trading_lifestyle", "results_proof", "dark_premium"]).default("luxury").notNull(),
  prompt: text("prompt"),
  imageUrl: text("imageUrl"),
  driveFileId: varchar("driveFileId", { length: 255 }),
  driveUrl: text("driveUrl"),
  metaAdId: varchar("metaAdId", { length: 64 }),
  metaUploadStatus: mysqlEnum("metaUploadStatus", ["none", "pending", "uploaded", "error"]).default("none").notNull(),
  // Board position
  boardX: int("boardX").default(0).notNull(),
  boardY: int("boardY").default(0).notNull(),
  boardStatus: mysqlEnum("boardStatus", ["draft", "testing", "active", "paused", "winner"]).default("draft").notNull(),
  // Performance (from Meta)
  ctr: float("ctr"),
  cpc: float("cpc"),
  spend: float("spend"),
  impressions: bigint("impressions", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ImageAd = typeof imageAds.$inferSelect;
export type InsertImageAd = typeof imageAds.$inferInsert;

// ─── Ad Headlines (Verbindungen zum Ad-Board) ─────────────────────────────────
export const adHeadlines = mysqlTable("ad_headlines", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  imageAdId: int("imageAdId").notNull(),
  text: varchar("text", { length: 512 }).notNull(),
  status: mysqlEnum("status", ["draft", "testing", "active", "paused", "winner"]).default("draft").notNull(),
  tested: boolean("tested").default(false).notNull(),
  ctr: float("ctr"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AdHeadline = typeof adHeadlines.$inferSelect;
export type InsertAdHeadline = typeof adHeadlines.$inferInsert;

// ─── Video Ads (HeyGen-generierte Videos) ─────────────────────────────────────
export const videoAds = mysqlTable("video_ads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  hook: text("hook").notNull(),
  body: text("body").notNull(),
  cta: text("cta").notNull(),
  fullScript: text("fullScript"),
  avatarId: varchar("avatarId", { length: 128 }),
  voiceId: varchar("voiceId", { length: 128 }),
  heygenVideoId: varchar("heygenVideoId", { length: 128 }),
  videoUrl: text("videoUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  driveFileId: varchar("driveFileId", { length: 255 }),
  driveUrl: text("driveUrl"),
  status: mysqlEnum("status", ["draft", "generating", "ready", "error"]).default("draft").notNull(),
  errorMessage: text("errorMessage"),
  aspectRatio: varchar("aspectRatio", { length: 8 }).default("9:16").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type VideoAd = typeof videoAds.$inferSelect;
export type InsertVideoAd = typeof videoAds.$inferInsert;
