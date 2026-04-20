/**
 * Drive → Meta Video-Upload Router
 * Listet Videos aus dem Google Drive Ordner 01_Video_Ads auf
 * und lädt sie zu Meta Ads als Ad-Videos hoch.
 */
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { driveMetaUploads, googleDriveConnections } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { getValidAccessToken } from "./googleDriveOAuth";
import { z } from "zod";

const DRIVE_FOLDER_ID = "1ywN_lDHCkgWT4uL5sr4pmyEMzAnpx1oe"; // 01_Video_Ads
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const META_BASE = "https://graph.facebook.com/v19.0";
const META_TOKEN = process.env.META_ACCESS_TOKEN ?? "";
const AD_ACCOUNT = "act_1093241318940799";

// ─── Drive: Videos im Ordner auflisten ───────────────────────────────────────
async function listDriveVideos(accessToken: string): Promise<Array<{
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  thumbnailLink?: string;
  webViewLink?: string;
}>> {
  const query = `"${DRIVE_FOLDER_ID}" in parents and trashed=false`;
  const fields = "files(id,name,mimeType,size,createdTime,thumbnailLink,webViewLink)";
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=100&orderBy=createdTime+desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive API Fehler: ${err}`);
  }

  const data = await res.json() as { files: any[] };
  return (data.files ?? []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType ?? "video/mp4",
    size: parseInt(f.size ?? "0"),
    createdTime: f.createdTime,
    thumbnailLink: f.thumbnailLink,
    webViewLink: f.webViewLink,
  }));
}

// ─── Drive: Datei als Buffer herunterladen ────────────────────────────────────
async function downloadDriveFile(fileId: string, accessToken: string): Promise<Buffer> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive Download Fehler: ${err}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Meta: Video hochladen ────────────────────────────────────────────────────
async function uploadVideoToMeta(
  videoBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ videoId: string }> {
  // Meta Video Upload via multipart/form-data
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(videoBuffer)], { type: mimeType });
  formData.append("source", blob, fileName);
  formData.append("title", fileName.replace(/\.[^.]+$/, ""));
  formData.append("access_token", META_TOKEN);

  const res = await fetch(`${META_BASE}/${AD_ACCOUNT}/advideos`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meta Video Upload Fehler: ${err}`);
  }

  const data = await res.json() as { id?: string; error?: { message: string } };
  if (data.error) throw new Error(`Meta API Fehler: ${data.error.message}`);
  if (!data.id) throw new Error("Meta hat keine Video-ID zurückgegeben");

  return { videoId: data.id };
}

// ─── Meta: Video-Status abrufen ───────────────────────────────────────────────
async function getMetaVideoStatus(videoId: string): Promise<{
  status: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
}> {
  const res = await fetch(
    `${META_BASE}/${videoId}?fields=status,title,description,thumbnails&access_token=${META_TOKEN}`
  );

  if (!res.ok) return { status: "unknown" };

  const data = await res.json() as any;
  return {
    status: data.status?.video_status ?? "unknown",
    title: data.title,
    description: data.description,
    thumbnailUrl: data.thumbnails?.data?.[0]?.uri,
  };
}

// ─── tRPC Router ─────────────────────────────────────────────────────────────
export const driveToMetaRouter = router({

  // Videos im Drive-Ordner auflisten
  listVideos: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB nicht verfügbar");

    // Google Drive Verbindung holen
    const connections = await db.select().from(googleDriveConnections)
      .where(and(eq(googleDriveConnections.userId, ctx.user.id), eq(googleDriveConnections.isActive, true)))
      .limit(1);

    if (connections.length === 0) {
      return { connected: false, videos: [], uploads: [] };
    }

    const conn = connections[0];
    const accessToken = await getValidAccessToken({
      accessToken: conn.accessToken,
      refreshToken: conn.refreshToken ?? "",
      tokenExpiresAt: conn.tokenExpiry ?? null,
    });

    // Videos aus Drive holen
    const videos = await listDriveVideos(accessToken);

    // Bisherige Uploads aus DB holen
    const uploads = await db.select().from(driveMetaUploads)
      .where(eq(driveMetaUploads.userId, ctx.user.id))
      .orderBy(desc(driveMetaUploads.createdAt))
      .limit(100);

    return { connected: true, videos, uploads };
  }),

  // Video von Drive zu Meta hochladen
  uploadToMeta: protectedProcedure
    .input(z.object({
      driveFileId: z.string(),
      fileName: z.string(),
      mimeType: z.string().default("video/mp4"),
      fileSizeBytes: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validierung: erlaubte Video-Formate
      const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/mpeg", "video/webm", "video/3gpp"];
      if (!ALLOWED_TYPES.includes(input.mimeType) && !input.mimeType.startsWith("video/")) {
        throw new Error(`Nicht unterstütztes Dateiformat: ${input.mimeType}. Erlaubt: MP4, MOV, AVI, MPEG, WebM`);
      }
      // Validierung: max. 4 GB (Meta-Limit)
      const MAX_SIZE = 4 * 1024 * 1024 * 1024;
      if (input.fileSizeBytes && input.fileSizeBytes > MAX_SIZE) {
        throw new Error(`Datei zu groß: ${(input.fileSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB. Meta-Limit: 4 GB`);
      }
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");

      // Upload-Eintrag anlegen
      const [inserted] = await db.insert(driveMetaUploads).values({
        userId: ctx.user.id,
        driveFileId: input.driveFileId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        status: "downloading",
      });

      const uploadId = (inserted as any).insertId as number;

      try {
        // Google Drive Verbindung holen
        const connections = await db.select().from(googleDriveConnections)
          .where(and(eq(googleDriveConnections.userId, ctx.user.id), eq(googleDriveConnections.isActive, true)))
          .limit(1);

        if (connections.length === 0) {
          await db.update(driveMetaUploads)
            .set({ status: "error", errorMessage: "Keine Google Drive Verbindung", updatedAt: new Date() })
            .where(eq(driveMetaUploads.id, uploadId));
          throw new Error("Keine Google Drive Verbindung");
        }

        const conn = connections[0];
        const accessToken = await getValidAccessToken({
          accessToken: conn.accessToken,
          refreshToken: conn.refreshToken ?? "",
          tokenExpiresAt: conn.tokenExpiry ?? null,
        });

        // Video von Drive herunterladen
        const videoBuffer = await downloadDriveFile(input.driveFileId, accessToken);

        // Status auf "uploading" setzen
        await db.update(driveMetaUploads)
          .set({ status: "uploading", updatedAt: new Date() })
          .where(eq(driveMetaUploads.id, uploadId));

        // Video zu Meta hochladen
        const { videoId } = await uploadVideoToMeta(videoBuffer, input.fileName, input.mimeType);

        // Erfolg in DB speichern
        await db.update(driveMetaUploads)
          .set({
            status: "processing",
            metaVideoId: videoId,
            metaVideoTitle: input.fileName.replace(/\.[^.]+$/, ""),
            updatedAt: new Date(),
          })
          .where(eq(driveMetaUploads.id, uploadId));

        return { success: true, uploadId, metaVideoId: videoId };

      } catch (err: any) {
        await db.update(driveMetaUploads)
          .set({ status: "error", errorMessage: err.message, updatedAt: new Date() })
          .where(eq(driveMetaUploads.id, uploadId));
        throw err;
      }
    }),

  // Upload-Status eines Meta-Videos aktualisieren
  refreshStatus: protectedProcedure
    .input(z.object({ uploadId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");

      const uploads = await db.select().from(driveMetaUploads)
        .where(and(eq(driveMetaUploads.id, input.uploadId), eq(driveMetaUploads.userId, ctx.user.id)))
        .limit(1);

      if (uploads.length === 0) throw new Error("Upload nicht gefunden");

      const upload = uploads[0];
      if (!upload.metaVideoId) return { status: upload.status };

      const metaStatus = await getMetaVideoStatus(upload.metaVideoId);

      // Meta video_status: 'processing' | 'ready' | 'error' | 'unknown'
      let newStatus: "processing" | "ready" | "error" = "processing";
      if (metaStatus.status === "ready") newStatus = "ready";
      else if (metaStatus.status === "error" || metaStatus.status === "unknown") newStatus = "error";

      await db.update(driveMetaUploads)
        .set({
          status: newStatus,
          errorMessage: newStatus === "error" ? `Meta-Status: ${metaStatus.status}` : null,
          updatedAt: new Date(),
        })
        .where(eq(driveMetaUploads.id, input.uploadId));

      return { status: newStatus, metaStatus: metaStatus.status };
    }),

  // Upload-Liste des Users
  getUploads: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(driveMetaUploads)
      .where(eq(driveMetaUploads.userId, ctx.user.id))
      .orderBy(desc(driveMetaUploads.createdAt))
      .limit(100);
  }),
});
