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
  getApiKeysByUser,
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
} from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

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

  return router;
}
