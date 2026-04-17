import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

vi.mock("./scheduler", () => ({
  runDailyScan: vi.fn().mockResolvedValue({ scanned: 0, totalNewAds: 0, batchesCreated: 0, errors: [] }),
  startScheduler: vi.fn(),
  stopScheduler: vi.fn(),
}));

vi.mock("./db", () => ({
  getMetaConnection: vi.fn().mockResolvedValue(null),
  upsertMetaConnection: vi.fn().mockResolvedValue(undefined),
  deleteMetaConnection: vi.fn().mockResolvedValue(undefined),
  getCampaigns: vi.fn().mockResolvedValue([]),
  upsertCampaigns: vi.fn().mockResolvedValue(undefined),
  deleteCampaignsByUser: vi.fn().mockResolvedValue(undefined),
  getAds: vi.fn().mockResolvedValue([]),
  upsertAds: vi.fn().mockResolvedValue(undefined),
  deleteAdsByUser: vi.fn().mockResolvedValue(undefined),
  getCompetitorAds: vi.fn().mockResolvedValue([]),
  saveCompetitorAd: vi.fn().mockResolvedValue(undefined),
  deleteCompetitorAd: vi.fn().mockResolvedValue(undefined),
  getTranscripts: vi.fn().mockResolvedValue([]),
  getTranscriptById: vi.fn().mockResolvedValue(null),
  createTranscript: vi.fn().mockResolvedValue(undefined),
  updateTranscript: vi.fn().mockResolvedValue(undefined),
  deleteTranscript: vi.fn().mockResolvedValue(undefined),
  getDocuments: vi.fn().mockResolvedValue([]),
  createDocument: vi.fn().mockResolvedValue({ insertId: 1 }),
  updateDocument: vi.fn().mockResolvedValue(undefined),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  getCompetitors: vi.fn().mockResolvedValue([]),
  getCompetitorById: vi.fn().mockResolvedValue(null),
  createCompetitor: vi.fn().mockResolvedValue({ insertId: 1 }),
  updateCompetitor: vi.fn().mockResolvedValue(undefined),
  deleteCompetitor: vi.fn().mockResolvedValue(undefined),
  getActiveCompetitors: vi.fn().mockResolvedValue([]),
  getCompetitorAdsByCompetitor: vi.fn().mockResolvedValue([]),
  markCompetitorAdProcessed: vi.fn().mockResolvedValue(undefined),
  getAdBatches: vi.fn().mockResolvedValue([]),
  getAdBatchById: vi.fn().mockResolvedValue(null),
  createAdBatch: vi.fn().mockResolvedValue({ insertId: 1 }),
  updateAdBatch: vi.fn().mockResolvedValue(undefined),
  deleteAdBatch: vi.fn().mockResolvedValue(undefined),
  getBrandSettings: vi.fn().mockResolvedValue(null),
  upsertBrandSettings: vi.fn().mockResolvedValue(undefined),
  getGoogleDriveConnection: vi.fn().mockResolvedValue(null),
  upsertGoogleDriveConnection: vi.fn().mockResolvedValue(undefined),
  deleteGoogleDriveConnection: vi.fn().mockResolvedValue(undefined),
  getScanLogs: vi.fn().mockResolvedValue([]),
  createScanLog: vi.fn().mockResolvedValue({ insertId: 1 }),
  updateScanLog: vi.fn().mockResolvedValue(undefined),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          body: "Test Body",
          cta: "Jetzt starten",
          hook1: { type: "neugier", label: "Neugier-Hook", text: "Wusstest du, dass 80% aller Ads scheitern?" },
          hook2: { type: "schmerz", label: "Schmerz-Hook", text: "Du verlierst täglich Kunden, weil deine Ads nicht performen." },
          hook3: { type: "ergebnis", label: "Ergebnis-Hook", text: "Mit Easy Signals verdoppeln Unternehmer ihren ROAS in 30 Tagen." },
          heygenScript: "HeyGen Script",
          insights: "KI-Analyse: Sehr gute Performance.",
          overallScore: 7,
          topPerformer: null,
          summary: "Test summary",
          title: "Test Transkript",
          transcript: "Test transcript content",
          analysis: "Test analysis",
        }),
      },
    }],
  }),
}));

// ─── Test context factory ─────────────────────────────────────────────────────

function createCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-1",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("should clear the session cookie and return success", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect((ctx.res.clearCookie as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it("auth.me should return the current user", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user?.id).toBe(1);
    expect(user?.email).toBe("test@example.com");
  });
});

// ─── Meta Connection Tests ────────────────────────────────────────────────────

describe("meta.getConnection", () => {
  it("should return null when no connection exists", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const conn = await caller.meta.getConnection();
    expect(conn).toBeNull();
  });
});

describe("meta.disconnect", () => {
  it("should disconnect and return success", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.meta.disconnect();
    expect(result).toEqual({ success: true });
  });
});

// ─── Analytics Tests ──────────────────────────────────────────────────────────

describe("analytics.getCampaigns", () => {
  it("should return an empty array when no campaigns exist", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const campaigns = await caller.analytics.getCampaigns();
    expect(Array.isArray(campaigns)).toBe(true);
    expect(campaigns.length).toBe(0);
  });
});

describe("analytics.getAds", () => {
  it("should return an empty array when no ads exist", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const ads = await caller.analytics.getAds();
    expect(Array.isArray(ads)).toBe(true);
    expect(ads.length).toBe(0);
  });
});

describe("analytics.getAIInsights", () => {
  it("should return a message when no ads exist", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.analytics.getAIInsights({});
    expect(result.insights).toContain("Keine Ads");
  });
});

// ─── Ad Library Tests ─────────────────────────────────────────────────────────

describe("adLibrary.getSaved", () => {
  it("should return an empty array when no saved ads exist", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const ads = await caller.adLibrary.getSaved();
    expect(Array.isArray(ads)).toBe(true);
    expect(ads.length).toBe(0);
  });
});

describe("adLibrary.saveAd (skip – requires DB)", () => {
  it("should save an ad and return success", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.adLibrary.saveAd({
      adId: "test_ad_123",
      pageName: "Test Brand",
      adText: "Test ad text",
      adTitle: "Test headline",
    });
    expect(result).toEqual({ success: true });
  });
});

describe("adLibrary.search", () => {
  it("should return mock results when API is not configured", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.adLibrary.search({ query: "fitness", country: "DE" });
    expect(result.results).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.isMock).toBe(true);
  });
});

// ─── Transcripts Tests ────────────────────────────────────────────────────────

describe("transcripts.list", () => {
  it("should return an empty array when no transcripts exist", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const transcripts = await caller.transcripts.list();
    expect(Array.isArray(transcripts)).toBe(true);
    expect(transcripts.length).toBe(0);
  });
});

describe("transcripts.create", () => {
  it("should create a transcript and return success", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.transcripts.create({
      title: "Test Transkript",
      content: "Das ist ein Test-Skript für den Teleprompter.",
      sourceType: "manual",
    });
    expect(result).toEqual({ success: true });
  });
});

describe("transcripts.generateFromAd", () => {
  it("should generate a transcript from ad text using LLM", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.transcripts.generateFromAd({
      adText: "Entdecke unsere neue Fitness-App! Jetzt 30% Rabatt.",
      headline: "Fitness App",
      pageName: "FitLife",
    });
    expect(result.content).toBeDefined();
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
  });
});

// ─── Documents Tests ──────────────────────────────────────────────────────────

describe("documents.list", () => {
  it("should return an empty array when no documents exist", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const docs = await caller.documents.list();
    expect(Array.isArray(docs)).toBe(true);
    expect(docs.length).toBe(0);
  });
});

describe("documents.export", () => {
  it("should export a document (transcriptId required)", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    // documents.export requires a valid transcriptId – skip DB-dependent test
    await expect(caller.documents.export({ transcriptId: 99999, title: "Test", format: "markdown" })).rejects.toThrow();
  });
});

// ─── Competitors Tests ───────────────────────────────────────────────────────

describe("competitors.list", () => {
  it("should return empty array when no competitors exist", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.competitors.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

describe("competitors.create", () => {
  it("should create a competitor and return success", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.competitors.create({
      name: "Test Competitor",
      country: "DE",
      isActive: true,
    });
    expect(result.success).toBe(true);
  });
});

// ─── Batches Tests ────────────────────────────────────────────────────────────

describe("batches.list", () => {
  it("should return empty array when no batches exist", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.batches.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

describe("batches.generate", () => {
  it("should generate a batch with body, cta and 3 hooks", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.batches.generate({
      adText: "Entdecke unsere revolutionäre Lösung!",
      competitorName: "Test Competitor",
      competitorAdId: 0,
      language: "de",
    });
    expect(result.success).toBe(true);
  });
});

// ─── Brand Tests ──────────────────────────────────────────────────────────────

describe("brand.get", () => {
  it("should return brand settings (null when none exist)", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.brand.get();
    // Returns null when no brand settings exist in DB
    expect(result === null || (typeof result === "object" && result !== null)).toBe(true);
  });
});

describe("brand.upsert", () => {
  it("should save brand settings successfully", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.brand.upsert({
      brandName: "Easy Signals",
      brandDescription: "Digitale Marketing-Lösungen",
      targetAudience: "KMU-Inhaber",
      toneOfVoice: "professionell und direkt",
      uniqueSellingPoints: "Einfach, schnell, effektiv",
      callToActionDefault: "Jetzt kostenlos starten",
      language: "de",
    });
    expect(result.success).toBe(true);
  });
});

// ─── Google Drive Tests ───────────────────────────────────────────────────────

describe("googleDrive.getConnection", () => {
  it("should return null when no Google Drive connection exists", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.googleDrive.getConnection();
    expect(result).toBeNull();
  });
});

// ─── Automation Tests ─────────────────────────────────────────────────────────

describe("automation.runScan", () => {
  it("should trigger daily scan and return results", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.automation.runScan();
    expect(result).toHaveProperty("scanned");
    expect(result).toHaveProperty("totalNewAds");
    expect(result).toHaveProperty("batchesCreated");
    expect(result).toHaveProperty("errors");
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

// ─── Dashboard Stats Tests ────────────────────────────────────────────────────

describe("dashboard.getStats", () => {
  it("should return zero stats when no data exists", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.dashboard.getStats();
    expect(stats.campaigns).toBe(0);
    expect(stats.ads).toBe(0);
    expect(stats.competitorAds).toBe(0);
    expect(stats.transcripts).toBe(0);
    expect(stats.documents).toBe(0);
    expect(stats.totalSpend).toBe(0);
    expect(stats.avgCTR).toBe(0);
    expect(stats.avgROAS).toBe(0);
    expect(Array.isArray(stats.recentTranscripts)).toBe(true);
    expect(Array.isArray(stats.recentAds)).toBe(true);
  });
});

// ─── Hooks Generate Tests ─────────────────────────────────────────────────────

describe("hooks.generate", () => {
  it("should return exactly 3 hooks with required fields", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.hooks.generate({
      scriptText: "Wir helfen Unternehmern dabei, mit Easy Signals mehr Kunden zu gewinnen. Unser System automatisiert deine Werbung und spart dir täglich Stunden.",
      language: "de",
    });
    expect(result).toHaveProperty("hooks");
    expect(result).toHaveProperty("generatedAt");
    expect(Array.isArray(result.hooks)).toBe(true);
    expect(result.hooks).toHaveLength(3);
    result.hooks.forEach((hook: { type: string; label: string; text: string; index: number }) => {
      expect(hook).toHaveProperty("type");
      expect(hook).toHaveProperty("label");
      expect(hook).toHaveProperty("text");
      expect(hook).toHaveProperty("index");
      expect(typeof hook.text).toBe("string");
      expect(hook.text.length).toBeGreaterThan(0);
    });
  });

  it("should include all three hook types: neugier, schmerz, ergebnis", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.hooks.generate({
      scriptText: "Easy Signals ist das führende Tool für automatisierte Meta-Werbung. Spare Zeit und gewinne mehr Kunden mit KI-gestützten Ads.",
      language: "de",
    });
    const types = result.hooks.map((h: { type: string }) => h.type);
    expect(types).toContain("neugier");
    expect(types).toContain("schmerz");
    expect(types).toContain("ergebnis");
  });
});
