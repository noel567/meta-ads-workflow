/**
 * Meta OAuth Flow
 * Handles Facebook/Instagram OAuth with all required permissions:
 * - ads_management, ads_read
 * - pages_read_engagement, pages_manage_engagement
 * - pages_show_list, instagram_basic, instagram_manage_comments
 */
import express from "express";
import { getDb } from "./db";
import { metaConnections } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { authenticateRequest } from "./_core/auth";

const META_APP_ID = process.env.META_APP_ID ?? "";
const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
const META_BASE = "https://graph.facebook.com/v19.0";

// All required scopes for Comment Manager + Ads
const REQUIRED_SCOPES = [
  "ads_management",
  "ads_read",
  "pages_read_engagement",
  "pages_manage_engagement",
  "pages_show_list",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_manage_comments",
  "business_management",
  "public_profile",
].join(",");

async function metaGet(path: string, token: string) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${META_BASE}${path}${sep}access_token=${token}`;
  const res = await fetch(url);
  const json = await res.json() as any;
  if (json.error) throw new Error(`Meta API: ${json.error.message}`);
  return json;
}

export function registerMetaOAuthRoutes(app: express.Application) {
  // Step 1: Redirect to Meta Login
  app.get("/api/meta/oauth/start", (req, res) => {
    const origin = (req.query.origin as string) || `${req.protocol}://${req.get("host")}`;
    const state = Buffer.from(JSON.stringify({ origin, ts: Date.now() })).toString("base64url");
    const redirectUri = `${origin}/api/meta/oauth/callback`;

    if (!META_APP_ID) {
      return res.status(500).json({ error: "META_APP_ID nicht konfiguriert. Bitte in den Einstellungen hinterlegen." });
    }

    const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    authUrl.searchParams.set("client_id", META_APP_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", REQUIRED_SCOPES);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");

    res.redirect(authUrl.toString());
  });

  // Step 2: Handle OAuth Callback
  app.get("/api/meta/oauth/callback", async (req, res) => {
    const { code, state, error: oauthError } = req.query as Record<string, string>;

    if (oauthError) {
      return res.redirect(`/meta-connect?error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state) {
      return res.redirect("/meta-connect?error=missing_params");
    }

    let origin = "";
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
      origin = decoded.origin || "";
    } catch {
      return res.redirect("/meta-connect?error=invalid_state");
    }

    if (!META_APP_ID || !META_APP_SECRET) {
      return res.redirect("/meta-connect?error=app_not_configured");
    }

    try {
      const redirectUri = `${origin}/api/meta/oauth/callback`;

      // Exchange code for user access token
      const tokenUrl = new URL(`${META_BASE}/oauth/access_token`);
      tokenUrl.searchParams.set("client_id", META_APP_ID);
      tokenUrl.searchParams.set("client_secret", META_APP_SECRET);
      tokenUrl.searchParams.set("redirect_uri", redirectUri);
      tokenUrl.searchParams.set("code", code);

      const tokenRes = await fetch(tokenUrl.toString());
      const tokenData = await tokenRes.json() as any;
      if (tokenData.error) throw new Error(tokenData.error.message);

      const userToken: string = tokenData.access_token;

      // Exchange for long-lived token
      const longLivedUrl = new URL(`${META_BASE}/oauth/access_token`);
      longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
      longLivedUrl.searchParams.set("client_id", META_APP_ID);
      longLivedUrl.searchParams.set("client_secret", META_APP_SECRET);
      longLivedUrl.searchParams.set("fb_exchange_token", userToken);

      const longRes = await fetch(longLivedUrl.toString());
      const longData = await longRes.json() as any;
      const longLivedToken: string = longData.access_token || userToken;

      // Get user info + ad accounts
      const meData = await metaGet("/me?fields=id,name", longLivedToken);
      const accountsData = await metaGet("/me/adaccounts?fields=id,name&limit=5", longLivedToken);
      const adAccount = accountsData.data?.[0];
      if (!adAccount) throw new Error("Kein Ad Account gefunden");

      // Get pages + page access tokens
      const pagesData = await metaGet("/me/accounts?fields=id,name,access_token&limit=10", longLivedToken);
      const page = pagesData.data?.[0];
      const pageToken: string = page?.access_token || longLivedToken;
      const pageId: string = page?.id || "";
      const pageName: string = page?.name || "";

      // Get granted scopes
      const permData = await metaGet("/me/permissions", longLivedToken);
      const grantedScopes = (permData.data || [])
        .filter((p: any) => p.status === "granted")
        .map((p: any) => p.permission)
        .join(",");

      // Save to DB – find user via session cookie
      const db = await getDb();
      let userId: number | null = null;
      try {
        const user = await authenticateRequest(req as any);
        userId = user.id;
      } catch {
        // Not logged in – still redirect with success, user can reconnect later
      }

      if (db && userId) {
        const [existing] = await db
          .select({ id: metaConnections.id })
          .from(metaConnections)
          .where(eq(metaConnections.userId, userId))
          .limit(1);

        if (existing) {
          await db
            .update(metaConnections)
            .set({
              accessToken: longLivedToken,
              adAccountId: adAccount.id,
              adAccountName: adAccount.name,
              pageToken,
              pageId,
              pageName,
              scopes: grantedScopes,
              isActive: true,
            })
            .where(eq(metaConnections.userId, userId));
        } else {
          await db.insert(metaConnections).values({
            userId,
            accessToken: longLivedToken,
            adAccountId: adAccount.id,
            adAccountName: adAccount.name,
            pageToken,
            pageId,
            pageName,
            scopes: grantedScopes,
            isActive: true,
          });
        }
      }

      // Redirect back to app with success
      res.redirect(`${origin}/meta-connect?success=1&page=${encodeURIComponent(pageName)}&account=${encodeURIComponent(adAccount.name)}`);
    } catch (err: any) {
      console.error("[Meta OAuth] Error:", err.message);
      res.redirect(`${origin}/meta-connect?error=${encodeURIComponent(err.message)}`);
    }
  });

  // API: Get current connection status (for tRPC alternative)
  app.get("/api/meta/oauth/status", async (req, res) => {
    try {
      const db = await getDb();
      if (!db) return res.json({ connected: false });

      let userId: number | null = null;
      try {
        const user = await authenticateRequest(req as any);
        userId = user.id;
      } catch {
        return res.json({ connected: false });
      }

      const [conn] = await db
        .select()
        .from(metaConnections)
        .where(eq(metaConnections.userId, userId!))
        .limit(1);

      if (!conn) return res.json({ connected: false });

      const scopes = (conn.scopes || "").split(",").filter(Boolean);
      const hasPageRead = scopes.includes("pages_read_engagement");
      const hasPageManage = scopes.includes("pages_manage_engagement");

      res.json({
        connected: true,
        adAccountId: conn.adAccountId,
        adAccountName: conn.adAccountName,
        pageId: conn.pageId,
        pageName: conn.pageName,
        hasPagePermissions: hasPageRead && hasPageManage,
        scopes,
      });
    } catch (err: any) {
      res.json({ connected: false, error: err.message });
    }
  });
}
