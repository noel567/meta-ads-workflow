import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "./auth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startScheduler, runDailyScan } from "../scheduler";
import { registerGoogleOAuthRoutes } from "../googleOAuthRoutes";
import { createExternalApiRouter } from "../externalApiRoutes";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Email OTP Auth routes
  registerAuthRoutes(app);
  // Google Drive OAuth routes
  registerGoogleOAuthRoutes(app);
  // Public Telegram getUpdates endpoint to discover chat IDs
  app.get("/api/telegram/get-updates", async (_req, res) => {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) { res.status(500).json({ error: "TELEGRAM_BOT_TOKEN nicht gesetzt" }); return; }
      const r = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=10`, { method: "GET" });
      const data = await r.json() as any;
      // Extract unique chats
      const chats = (data.result || []).map((u: any) => ({
        chat_id: u.message?.chat?.id || u.channel_post?.chat?.id,
        title: u.message?.chat?.title || u.channel_post?.chat?.title || u.message?.chat?.username,
        type: u.message?.chat?.type || u.channel_post?.chat?.type,
        text: u.message?.text || u.channel_post?.text,
      })).filter((c: any) => c.chat_id);
      res.json({ ok: data.ok, chats, raw: data.result?.slice(0, 3) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Simple text-only ping endpoint for debugging
  app.post("/api/telegram/ping", async (req, res) => {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = (req.body as any)?.chatId || process.env.TELEGRAM_CHAT_ID;
      if (!botToken) { res.status(500).json({ error: "No bot token" }); return; }
      const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "🟢 EasySignals Bot Test – Verbindung erfolgreich!" }),
      });
      const data = await r.json() as any;
      res.json({ ok: data.ok, description: data.description, chat_id: chatId, result: data.result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public Telegram test endpoint (no auth required, for owner testing)
  app.post("/api/telegram/test", async (req, res) => {
    try {
      const { sendTelegramDirectPost } = await import("../scheduler");
      const chatIdOverride = (req.body as any)?.chatId as string | undefined;
      const result = await sendTelegramDirectPost(chatIdOverride);
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Chrome Extension: Ad Library Save Endpoint
  // Empfängt Ads von der Chrome Extension und speichert sie in der Video Research Pipeline
  app.post("/api/ads-library/save", async (req, res) => {
    // CORS für Extension erlauben
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    try {
      const body = req.body as any;
      const { sourceUrl, platform, competitorName, adText, adId, pageId, imageUrl, adLibraryUrl, language, notes } = body;

      if (!sourceUrl && !adLibraryUrl) {
        res.status(400).json({ error: "sourceUrl oder adLibraryUrl erforderlich" });
        return;
      }

      const { createVideoResearch } = await import("../db");

      // Nutze adLibraryUrl als sourceUrl wenn kein direktes Video vorhanden
      const finalUrl = sourceUrl || adLibraryUrl;

      // Notizen zusammenbauen
      const notesParts: string[] = [];
      if (adText) notesParts.push(`Ad-Text: ${adText.slice(0, 500)}`);
      if (adId) notesParts.push(`Ad-ID: ${adId}`);
      if (pageId) notesParts.push(`Page-ID: ${pageId}`);
      if (imageUrl) notesParts.push(`Bild-URL: ${imageUrl}`);
      if (notes) notesParts.push(notes);

      // Wir speichern ohne userId (public endpoint) – userId = 0 als Platzhalter
      // In Produktion: Auth-Token aus Extension verwenden
      const id = await createVideoResearch({
        userId: 1, // Default owner user
        sourceUrl: finalUrl,
        platform: platform || "facebook",
        competitorName: competitorName || null,
        competitorId: null,
        language: language || "de",
        notes: notesParts.join(" | ") || null,
        status: "pending",
      });

      console.log(`[Extension] Ad gespeichert: ${competitorName || "Unbekannt"} | ${finalUrl.slice(0, 80)}`);

      res.json({
        success: true,
        id,
        message: `Ad von "${competitorName || "Unbekannt"}" in Video Research gespeichert`,
        videoResearchUrl: "/video-research",
      });
    } catch (err: any) {
      console.error("[Extension] Save error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // CORS preflight für Extension
  app.options("/api/ads-library/save", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(200).end();
  });

  // External REST API v1 (API-Key authenticated)
  app.use("/api/v1", createExternalApiRouter());

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "EasySignals Meta Ads Workflow" });
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Start daily scheduler for owner automatically
  if (ENV.ownerOpenId) {
    // Look up the owner's DB userId by openId and start scheduler
    setTimeout(async () => {
      try {
        const { getDb } = await import("../db");
        const { users } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) { console.log("[Scheduler] DB not ready, skipping auto-start"); return; }
        const rows = await db.select().from(users).where(eq(users.openId, ENV.ownerOpenId!)).limit(1);
        if (rows[0]) {
          startScheduler(rows[0].id);
          console.log(`[Scheduler] Auto-started for owner userId=${rows[0].id}`);
        } else {
          console.log("[Scheduler] Owner not found in DB yet – will start after first login");
        }
      } catch (e) {
        console.error("[Scheduler] Auto-start failed:", e);
      }
    }, 5000); // 5s delay to let DB connection stabilize
  }
}

startServer().catch(console.error);
