/**
 * External REST API — /api/v1/
 * Authenticated via Bearer token (API key) in Authorization header.
 * All endpoints return JSON and are scoped to the key owner's data.
 */
import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import {
  getApiKeyByHash,
  updateApiKeyLastUsed,
  getCampaigns,
  getAds,
  getCompetitors,
  getCompetitorAds,
  getAdBatches,
  getTranscripts,
  createCompetitor,
  deleteCompetitor,
  getBrandSettings,
} from "./db";
import { getDb } from "./db";
import {
  transcripts,
  adBatches,
  heygenVideos,
  telegramPosts,
  budgetRules,
  ruleExecutions,
  driveMetaUploads,
  videoResearch,
  competitors,
} from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { runAllBudgetRules } from "./budgetRulesRouter";
import { runDailyScan } from "./scheduler";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

function json200(res: Response, data: unknown) {
  return res.status(200).json({ ok: true, data });
}

function jsonError(res: Response, status: number, message: string) {
  return res.status(status).json({ ok: false, error: message });
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────

async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonError(res, 401, "Missing or invalid Authorization header. Use: Authorization: Bearer <api_key>");
  }
  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) return jsonError(res, 401, "Empty API key");

  const keyHash = hashKey(rawKey);
  const apiKey = await getApiKeyByHash(keyHash);
  if (!apiKey) return jsonError(res, 401, "Invalid or revoked API key");

  // Update last used timestamp (fire and forget)
  updateApiKeyLastUsed(apiKey.id).catch(() => {});

  (req as any).apiUserId = apiKey.userId;
  (req as any).apiKeyId = apiKey.id;
  (req as any).apiKeyName = apiKey.name;
  next();
}

function userId(req: Request): number {
  return (req as any).apiUserId as number;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function createExternalApiRouter(): Router {
  const router = Router();

  // Apply auth middleware to all routes
  router.use(apiKeyAuth);

  // ── GET /api/v1/me ──────────────────────────────────────────────────────────
  router.get("/me", async (req, res) => {
    try {
      return json200(res, {
        keyName: (req as any).apiKeyName,
        userId: userId(req),
      });
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── GET /api/v1/campaigns ───────────────────────────────────────────────────
  router.get("/campaigns", async (req, res) => {
    try {
      const data = await getCampaigns(userId(req));
      return json200(res, data);
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── GET /api/v1/ads ─────────────────────────────────────────────────────────
  router.get("/ads", async (req, res) => {
    try {
      const data = await getAds(userId(req));
      return json200(res, data);
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── GET /api/v1/competitors ─────────────────────────────────────────────────
  router.get("/competitors", async (req, res) => {
    try {
      const data = await getCompetitors(userId(req));
      return json200(res, data);
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── GET /api/v1/competitor-ads ──────────────────────────────────────────────
  router.get("/competitor-ads", async (req, res) => {
    try {
      const data = await getCompetitorAds(userId(req));
      return json200(res, data);
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── GET /api/v1/batches ─────────────────────────────────────────────────────
  router.get("/batches", async (req, res) => {
    try {
      const data = await getAdBatches(userId(req));
      return json200(res, data);
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── GET /api/v1/transcripts ─────────────────────────────────────────────────
  router.get("/transcripts", async (req, res) => {
    try {
      const data = await getTranscripts(userId(req));
      return json200(res, data);
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── GET /api/v1/budget-rules ────────────────────────────────────────────────
  router.get("/budget-rules", async (req, res) => {
    try {
      const db = await getDb();
      if (!db) return json200(res, []);
      const data = await db
        .select()
        .from(budgetRules)
        .where(eq(budgetRules.userId, userId(req)))
        .orderBy(desc(budgetRules.createdAt));
      return json200(res, data);
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── GET /api/v1/budget-rule-executions ─────────────────────────────────────
  router.get("/budget-rule-executions", async (req, res) => {
    try {
      const db = await getDb();
      if (!db) return json200(res, []);
      const data = await db
        .select()
        .from(ruleExecutions)
        .orderBy(desc(ruleExecutions.executedAt))
        .limit(200);
      return json200(res, data);
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── GET /api/v1/heygen-videos ───────────────────────────────────────────────
  router.get("/heygen-videos", async (req, res) => {
    try {
      const db = await getDb();
      if (!db) return json200(res, []);
      const data = await db
        .select()
        .from(heygenVideos)
        .where(eq(heygenVideos.userId, userId(req)))
        .orderBy(desc(heygenVideos.createdAt));
      return json200(res, data);
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── GET /api/v1/video-research ──────────────────────────────────────────────
  router.get("/video-research", async (req, res) => {
    try {
      const db = await getDb();
      if (!db) return json200(res, []);
      const data = await db
        .select()
        .from(videoResearch)
        .where(eq(videoResearch.userId, userId(req)))
        .orderBy(desc(videoResearch.createdAt));
      return json200(res, data);
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── GET /api/v1/telegram-posts ──────────────────────────────────────────────
  router.get("/telegram-posts", async (req, res) => {
    try {
      const db = await getDb();
      if (!db) return json200(res, []);
      const data = await db
        .select()
        .from(telegramPosts)
        .where(eq(telegramPosts.userId, userId(req)))
        .orderBy(desc(telegramPosts.createdAt));
      return json200(res, data);
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── GET /api/v1/drive-uploads ───────────────────────────────────────────────
  router.get("/drive-uploads", async (req, res) => {
    try {
      const db = await getDb();
      if (!db) return json200(res, []);
      const data = await db
        .select()
        .from(driveMetaUploads)
        .where(eq(driveMetaUploads.userId, userId(req)))
        .orderBy(desc(driveMetaUploads.createdAt));
      return json200(res, data);
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── POST /api/v1/competitors ─────────────────────────────────────────────────
  router.post("/competitors", async (req, res) => {
    try {
      const { name, pageId, country, language, notes } = req.body || {};
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return jsonError(res, 400, "Field 'name' is required");
      }
      const id = await createCompetitor({
        userId: userId(req),
        name: name.trim(),
        pageId: pageId?.toString().trim() || null,
        country: country?.toString().toUpperCase() || "DE",
        language: language?.toString() || "de",
        notes: notes?.toString() || null,
        isActive: true,
        totalAdsFound: 0,
        newAdsSinceLastScan: 0,
      });
      return res.status(201).json({ ok: true, data: { id } });
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── DELETE /api/v1/competitors/:id ─────────────────────────────────────────
  router.delete("/competitors/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return jsonError(res, 400, "Invalid competitor id");
      await deleteCompetitor(id, userId(req));
      return json200(res, { deleted: true, id });
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── POST /api/v1/scan ───────────────────────────────────────────────────────
  router.post("/scan", async (req, res) => {
    try {
      // Fire-and-forget: start scan in background
      runDailyScan(userId(req)).catch(() => {});
      return res.status(202).json({ ok: true, data: { message: "Scan started in background. Check /api/v1/competitors for updated lastScannedAt." } });
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── POST /api/v1/batches/generate ──────────────────────────────────────────
  router.post("/batches/generate", async (req, res) => {
    try {
      const { adId } = req.body || {};
      if (!adId) return jsonError(res, 400, "Field 'adId' is required");
      const db = await getDb();
      if (!db) return jsonError(res, 503, "Database unavailable");
      // Get the competitor ad
      const [ad] = await db
        .select()
        .from(require("../drizzle/schema").competitorAds)
        .where(and(
          eq(require("../drizzle/schema").competitorAds.id, parseInt(adId, 10)),
          eq(require("../drizzle/schema").competitorAds.userId, userId(req))
        ))
        .limit(1);
      if (!ad) return jsonError(res, 404, "Competitor ad not found");
      // Get brand settings for context
      const brand = await getBrandSettings(userId(req));
      const brandContext = brand
        ? `Firma: ${brand.brandName || "Easy Signals"}, Zielgruppe: ${brand.targetAudience || ""}, USP: ${brand.uniqueSellingPoints || ""}`
        : "Firma: Easy Signals, Produkt: KI-gestützte Meta-Ads";
      // Create batch record
      const { invokeLLM } = await import("./_core/llm");
      const langInstruction = "Antworte ausschließlich auf Deutsch.";
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Du bist ein erstklassiger Performance-Marketing-Copywriter. ${langInstruction}\nErstelle einen Ad-Batch (body, cta, hook1, hook2, hook3, heygenScript) basierend auf dem Konkurrenz-Ad.\nKontext: ${brandContext}\nAntworte NUR im JSON-Format: {"body":"...","cta":"...","hook1":"...","hook2":"...","hook3":"...","heygenScript":"..."}`,
          },
          { role: "user", content: `Konkurrenz-Ad Text:\n${ad.adText || ad.title || ""}` },
        ],
      });
      const rawContent = response.choices?.[0]?.message?.content;
      const raw = typeof rawContent === "string" ? rawContent : "{}";
      const parsed = JSON.parse(raw.replace(/```json\n?|```/g, "").trim());
      const { createAdBatch } = await import("./db");
      const batchId = await createAdBatch({
        userId: userId(req),
        title: `API Batch – ${ad.competitorName || "Unbekannt"} – ${new Date().toISOString().slice(0, 10)}`,
        sourceAdId: ad.id,
        competitorName: ad.competitorName || "Unbekannt",
        sourceAdText: ad.adText || "",
        body: parsed.body || "",
        cta: parsed.cta || "",
        hook1: parsed.hook1 || "",
        hook2: parsed.hook2 || "",
        hook3: parsed.hook3 || "",
        heygenScript: parsed.heygenScript || "",
        status: "ready",
      });
      return res.status(201).json({ ok: true, data: { id: batchId, ...parsed } });
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── POST /api/v1/budget-rules ───────────────────────────────────────────────
  router.post("/budget-rules", async (req, res) => {
    try {
      const { name, metric, condition, threshold, action, changePercent, campaignId, campaignName, lookbackDays, cooldownDays } = req.body || {};
      if (!name || !metric || !condition || threshold === undefined || !action) {
        return jsonError(res, 400, "Required fields: name, metric, condition, threshold, action");
      }
      const validMetrics = ["cpl", "ctr", "cpc", "spend", "roas"];
      const validConditions = ["gt", "lt", "gte", "lte"];
      const validActions = ["increase", "decrease", "pause", "activate"];
      if (!validMetrics.includes(metric)) return jsonError(res, 400, `metric must be one of: ${validMetrics.join(", ")}`);
      if (!validConditions.includes(condition)) return jsonError(res, 400, `condition must be one of: ${validConditions.join(", ")}`);
      if (!validActions.includes(action)) return jsonError(res, 400, `action must be one of: ${validActions.join(", ")}`);
      const db = await getDb();
      if (!db) return jsonError(res, 503, "Database unavailable");
      const [result] = await db.insert(budgetRules).values({
        userId: userId(req),
        name: name.toString().trim(),
        metric,
        condition,
        threshold: parseFloat(threshold),
        action,
        changePercent: changePercent ? parseFloat(changePercent) : null,
        campaignId: campaignId?.toString() || null,
        campaignName: campaignName?.toString() || null,
        lookbackDays: lookbackDays ? parseInt(lookbackDays, 10) : 7,
        cooldownDays: cooldownDays ? parseInt(cooldownDays, 10) : 1,
        active: true,
      });
      return res.status(201).json({ ok: true, data: { id: (result as any).insertId } });
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── PATCH /api/v1/budget-rules/:id/toggle ──────────────────────────────────
  router.patch("/budget-rules/:id/toggle", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return jsonError(res, 400, "Invalid rule id");
      const db = await getDb();
      if (!db) return jsonError(res, 503, "Database unavailable");
      const [rule] = await db
        .select()
        .from(budgetRules)
        .where(and(eq(budgetRules.id, id), eq(budgetRules.userId, userId(req))))
        .limit(1);
      if (!rule) return jsonError(res, 404, "Budget rule not found");
      await db
        .update(budgetRules)
        .set({ active: !rule.active })
        .where(eq(budgetRules.id, id));
      return json200(res, { id, active: !rule.active });
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  // ── POST /api/v1/budget-rules/run ──────────────────────────────────────────
  router.post("/budget-rules/run", async (req, res) => {
    try {
      // Fire-and-forget
      runAllBudgetRules().catch(() => {});
      return res.status(202).json({ ok: true, data: { message: "Budget rules execution started in background." } });
    } catch (e: any) {
      return jsonError(res, 500, e.message);
    }
  });

  return router;
}
