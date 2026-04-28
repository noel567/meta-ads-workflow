/**
 * Meta OAuth Flow
 * Permissions: Read-only für Ads + Kommentar-Verwaltung
 * - ads_read (Ads & Kampagnen lesen)
 * - pages_read_engagement (Kommentare & Reaktionen lesen)
 * - pages_manage_engagement (Kommentare beantworten & verstecken)
 * - pages_show_list, pages_manage_metadata, business_management
 * KEIN ads_management (keine Schreibrechte auf Ads)
 */
import express from "express";
import { getDb } from "./db";
import { metaConnections } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { authenticateRequest } from "./_core/auth";

const META_APP_ID = process.env.META_APP_ID ?? "";
const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
const META_BASE = "https://graph.facebook.com/v19.0";

// Scopes: Read-only für Ads + Kommentar-Verwaltung.
// Kein ads_management – die App darf Ads nur lesen, nicht erstellen/ändern.
const REQUIRED_SCOPES = [
  "ads_read",                   // Ads & Kampagnen lesen
  "pages_read_engagement",      // Kommentare & Reaktionen lesen
  "pages_show_list",            // Verbundene Seiten anzeigen
  "business_management",        // Business-Account-Zugriff
  "public_profile",             // Basis-Profil
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
      return res.redirect(`/connect?error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state) {
      return res.redirect("/connect?error=missing_params");
    }

    let origin = "";
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
      origin = decoded.origin || "";
    } catch {
      return res.redirect("/connect?error=invalid_state");
    }

    if (!META_APP_ID || !META_APP_SECRET) {
      return res.redirect("/connect?error=app_not_configured");
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

      // Get user info + ALL ad accounts (up to 25)
      const accountsData = await metaGet("/me/adaccounts?fields=id,name&limit=25", longLivedToken);
      const allAccounts: {id: string, name: string}[] = accountsData.data ?? [];

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

      // Store token + pages in session for account selection step
      (req as any).session = (req as any).session || {};
      (req as any).session.metaPending = {
        longLivedToken,
        pageToken,
        pageId,
        pageName,
        grantedScopes,
        allAccounts,
      };

      if (allAccounts.length === 0) throw new Error("Kein Ad Account gefunden. Bitte mit dem richtigen Business-Account anmelden.");

      // If only one account, save directly
      if (allAccounts.length === 1) {
        const adAccount = allAccounts[0];
        const db = await getDb();
        let userId: number | null = null;
        try { const user = await authenticateRequest(req as any); userId = user.id; } catch {}
        if (db && userId) {
          const [existing] = await db.select({ id: metaConnections.id }).from(metaConnections).where(eq(metaConnections.userId, userId)).limit(1);
          if (existing) {
            await db.update(metaConnections).set({ accessToken: longLivedToken, adAccountId: adAccount.id, adAccountName: adAccount.name, pageToken, pageId, pageName, scopes: grantedScopes, isActive: true }).where(eq(metaConnections.userId, userId));
          } else {
            await db.insert(metaConnections).values({ userId, accessToken: longLivedToken, adAccountId: adAccount.id, adAccountName: adAccount.name, pageToken, pageId, pageName, scopes: grantedScopes, isActive: true });
          }
        }
        return res.redirect(`${origin}/connect?success=1&page=${encodeURIComponent(pageName)}&account=${encodeURIComponent(adAccount.name)}`);
      }

      // Multiple accounts – redirect to selection page with token in query (short-lived, base64)
      const pendingData = Buffer.from(JSON.stringify({ longLivedToken, pageToken, pageId, pageName, grantedScopes, allAccounts })).toString("base64url");
      res.redirect(`${origin}/connect?choose=1&pending=${pendingData}`);
    } catch (err: any) {
      console.error("[Meta OAuth] Error:", err.message);
      res.redirect(`${origin}/connect?error=${encodeURIComponent(err.message)}`);
    }
  });

  // API: Select ad account after OAuth (POST)
  app.post("/api/meta/oauth/select-account", async (req, res) => {
    try {
      const { pending, adAccountId } = req.body as { pending: string; adAccountId: string };
      if (!pending || !adAccountId) return res.status(400).json({ error: "Missing params" });

      const data = JSON.parse(Buffer.from(pending, "base64url").toString());
      const { longLivedToken, pageToken, pageId, pageName, grantedScopes, allAccounts } = data;

      const adAccount = allAccounts.find((a: any) => a.id === adAccountId);
      if (!adAccount) return res.status(400).json({ error: "Account nicht gefunden" });

      const db = await getDb();
      if (!db) return res.status(500).json({ error: "DB nicht verfügbar" });

      let userId: number | null = null;
      try { const user = await authenticateRequest(req as any); userId = user.id; } catch {}
      if (!userId) return res.status(401).json({ error: "Nicht eingeloggt" });

      const [existing] = await db.select({ id: metaConnections.id }).from(metaConnections).where(eq(metaConnections.userId, userId)).limit(1);
      if (existing) {
        await db.update(metaConnections).set({ accessToken: longLivedToken, adAccountId: adAccount.id, adAccountName: adAccount.name, pageToken, pageId, pageName, scopes: grantedScopes, isActive: true }).where(eq(metaConnections.userId, userId));
      } else {
        await db.insert(metaConnections).values({ userId, accessToken: longLivedToken, adAccountId: adAccount.id, adAccountName: adAccount.name, pageToken, pageId, pageName, scopes: grantedScopes, isActive: true });
      }

      res.json({ success: true, adAccountName: adAccount.name, pageName });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
        .where(and(eq(metaConnections.userId, userId!), eq(metaConnections.isActive, true)))
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
