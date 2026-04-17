/**
 * Google Drive OAuth Express Routes
 * /api/google/auth    → Redirect to Google OAuth consent screen
 * /api/google/callback → Exchange code for tokens, save to DB, redirect to frontend
 */
import type { Express, Request, Response } from "express";
import { exchangeCodeForTokens } from "./googleDriveOAuth";
import { upsertGoogleDriveConnection } from "./db";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME } from "../shared/const";

function getRedirectUri(req: Request): string {
  // Use GOOGLE_REDIRECT_URI env var if set (for production/published app)
  if (ENV.googleRedirectUri) return ENV.googleRedirectUri;
  // Prefer x-forwarded headers (behind proxy) but fall back to request host
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() ?? req.protocol ?? "https";
  const host = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim() ?? req.headers.host ?? "";
  return `${proto}://${host}/api/google/callback`;
}

export function registerGoogleOAuthRoutes(app: Express): void {
  // ── Step 1: Redirect user to Google consent screen ──────────────────────────
  app.get("/api/google/auth", (req: Request, res: Response) => {
    if (!ENV.googleClientId) {
      res.status(500).json({ error: "Google Client ID not configured" });
      return;
    }

    const redirectUri = getRedirectUri(req);
    const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString("base64");

    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  // ── Step 2: Handle callback from Google ─────────────────────────────────────
  app.get("/api/google/callback", async (req: Request, res: Response) => {
    const { code, error } = req.query as { code?: string; error?: string };

    if (error || !code) {
      res.redirect(`/settings?google_error=${encodeURIComponent(error ?? "no_code")}`);
      return;
    }

    try {
      // Get user from session cookie via SDK
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.redirect("/settings?google_error=not_authenticated");
        return;
      }
      if (!user) {
        res.redirect("/settings?google_error=invalid_session");
        return;
      }

      const redirectUri = getRedirectUri(req);
      const tokens = await exchangeCodeForTokens(code, redirectUri);

      // Save tokens to database
      await upsertGoogleDriveConnection({
        userId: user.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.expiresAt,
        connectedEmail: tokens.email,
        isActive: true,
        rootFolderName: "Easy Signals Ads",
      });

      res.redirect("/settings?google_connected=true");
    } catch (err) {
      console.error("[Google OAuth] Callback error:", err);
      const msg = err instanceof Error ? err.message : "unknown_error";
      res.redirect(`/settings?google_error=${encodeURIComponent(msg)}`);
    }
  });
}
