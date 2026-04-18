import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startScheduler, runDailyScan } from "../scheduler";
import { registerGoogleOAuthRoutes } from "../googleOAuthRoutes";
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
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
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

  // Public Telegram test endpoint (no auth required, for owner testing)
  app.post("/api/telegram/test", async (_req, res) => {
    try {
      const { sendTelegramDirectPost } = await import("../scheduler");
      const result = await sendTelegramDirectPost();
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
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

  // Start daily scheduler for owner
  if (ENV.ownerOpenId) {
    // We need the owner's userId – start scheduler lazily after first login
    // The scheduler is also triggerable via tRPC (system.triggerDailyScan)
    console.log("[Scheduler] Ready – will start after owner login");
  }
}

startServer().catch(console.error);
