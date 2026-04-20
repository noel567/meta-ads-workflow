/**
 * Google Drive OAuth 2.0 Handler
 * Handles the full OAuth flow: auth URL generation, callback, token refresh, and Drive API calls.
 */
import { ENV } from "./_core/env";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",           // Vollzugriff: alle Dateien lesen + schreiben
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

// ─── OAuth URL ────────────────────────────────────────────────────────────────

export function getGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// ─── Exchange code for tokens ─────────────────────────────────────────────────

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!data.access_token) throw new Error("No access_token in Google response");
  if (!data.refresh_token) throw new Error("No refresh_token – make sure prompt=consent was set");

  // Get user email
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const userInfo = await userRes.json() as { email?: string };

  const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    email: userInfo.email ?? "",
  };
}

// ─── Refresh access token ─────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token refresh failed: ${err}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000);

  return { accessToken: data.access_token, expiresAt };
}

// ─── Get valid access token (auto-refresh if expired) ────────────────────────

export async function getValidAccessToken(connection: {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date | null;
}): Promise<string> {
  const now = new Date();
  const isExpired = !connection.tokenExpiresAt || connection.tokenExpiresAt <= now;

  if (!isExpired) return connection.accessToken;

  const { accessToken } = await refreshAccessToken(connection.refreshToken);
  return accessToken;
}

// ─── Drive API helpers ────────────────────────────────────────────────────────

export async function findOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string> {
  // Search for existing folder
  const query = parentId
    ? `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`;

  const searchRes = await fetch(
    `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!searchRes.ok) throw new Error(`Drive search failed: ${await searchRes.text()}`);

  const searchData = await searchRes.json() as { files: Array<{ id: string; name: string }> };

  if (searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createBody: Record<string, unknown> = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) createBody.parents = [parentId];

  const createRes = await fetch(`${GOOGLE_DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createBody),
  });

  if (!createRes.ok) throw new Error(`Drive folder creation failed: ${await createRes.text()}`);

  const created = await createRes.json() as { id: string };
  return created.id;
}

export async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  content: string,
  mimeType: string,
  folderId: string
): Promise<{ id: string; webViewLink: string }> {
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType,
  };

  const boundary = "-------314159265358979323846";
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    "",
    content,
    `--${boundary}--`,
  ].join("\r\n");

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary="${boundary}"`,
      },
      body,
    }
  );

  if (!uploadRes.ok) throw new Error(`Drive upload failed: ${await uploadRes.text()}`);

  return await uploadRes.json() as { id: string; webViewLink: string };
}

export async function uploadBatchToDrive(
  connection: { accessToken: string; refreshToken: string; tokenExpiresAt: Date | null; rootFolderName: string },
  batch: {
    competitorName: string;
    title: string;
    body: string;
    cta: string;
    hook1: string;
    hook2: string;
    hook3: string;
    createdAt: Date;
  }
): Promise<{ fileId: string; webViewLink: string; folderPath: string }> {
  const accessToken = await getValidAccessToken(connection);
  const rootFolderName = connection.rootFolderName || "Easy Signals Ads";

  // Build folder structure: Root / YYYY-MM-DD / Competitor
  const dateStr = batch.createdAt.toISOString().split("T")[0];
  const rootId = await findOrCreateFolder(accessToken, rootFolderName);
  const dateId = await findOrCreateFolder(accessToken, dateStr, rootId);
  const competitorId = await findOrCreateFolder(accessToken, batch.competitorName, dateId);

  // Format content as Markdown
  const content = `# ${batch.title}

**Erstellt am:** ${batch.createdAt.toLocaleDateString("de-DE")}
**Konkurrent:** ${batch.competitorName}

---

## 🎣 Hook 1 (Neugier)
${batch.hook1}

## 😣 Hook 2 (Schmerz)
${batch.hook2}

## 🏆 Hook 3 (Ergebnis)
${batch.hook3}

---

## 📝 Body
${batch.body}

---

## 🎯 CTA
${batch.cta}

---

*Generiert von Easy Signals Ad Workflow*
`;

  const fileName = `${batch.title.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, "").trim()}.md`;
  const { id: fileId, webViewLink } = await uploadFileToDrive(
    accessToken,
    fileName,
    content,
    "text/plain",
    competitorId
  );

  return {
    fileId,
    webViewLink,
    folderPath: `${rootFolderName}/${dateStr}/${batch.competitorName}`,
  };
}
