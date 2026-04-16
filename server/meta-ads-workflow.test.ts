import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

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
  createDocument: vi.fn().mockResolvedValue(undefined),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "KI-Analyse: Sehr gute Performance." } }],
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

describe("adLibrary.saveAd", () => {
  it("should save an ad and return success", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.adLibrary.saveAd({
      pageName: "Test Brand",
      adText: "Test ad text",
      headline: "Test headline",
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
  it("should export a document and return success", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.documents.export({
      title: "Test Dokument",
      content: "# Test\n\nDas ist ein Test-Dokument.",
      format: "markdown",
      sourceType: "transcript",
    });
    expect(result).toEqual({ success: true });
  });
});

// ─── Dashboard Stats Tests ────────────────────────────────────────────────────

describe("dashboard.stats", () => {
  it("should return zero stats when no data exists", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.dashboard.stats();
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
