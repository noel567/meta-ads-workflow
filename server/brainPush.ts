/**
 * brainPush.ts
 * Sendet strukturierte Daten aus dem Meta Ads Workflow an den VPS Nexus Brain.
 * Datenfluss: Meta Ads Workflow → POST /api/brain/ingest → VPS Knowledge Graph
 */

const BRAIN_URL = process.env.BRAIN_INGEST_URL || "http://72.62.35.65:3000/api/brain/ingest";
const BRAIN_TOKEN = process.env.BRAIN_INGEST_TOKEN || "easysignals-brain-2026";

export interface BrainNode {
  id: string;
  type: string;
  label: string;
  color?: string;
  [key: string]: unknown;
}

export interface BrainLink {
  source: string;
  target: string;
  label?: string;
}

export interface BrainPushPayload {
  source: string;
  nodes: BrainNode[];
  links?: BrainLink[];
}

/**
 * Sendet Nodes an den VPS Brain Knowledge Graph.
 * Fire-and-forget – wirft keine Fehler, damit der Hauptfluss nicht unterbrochen wird.
 */
export async function pushToBrain(payload: BrainPushPayload): Promise<void> {
  try {
    const res = await fetch(BRAIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-brain-token": BRAIN_TOKEN,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000), // 8s timeout
    });
    if (!res.ok) {
      console.warn("[BrainPush] Failed:", res.status, await res.text().catch(() => ""));
    } else {
      const data = await res.json() as { added?: number; updated?: number; total_nodes?: number };
      console.log(`[BrainPush] ✅ ${payload.source}: +${data.added ?? 0} nodes, ~${data.updated ?? 0} updated (total: ${data.total_nodes ?? "?"})`);
    }
  } catch (err) {
    // Nicht-kritisch: Brain Push darf fehlschlagen ohne den Hauptfluss zu stören
    console.warn("[BrainPush] Error (non-critical):", (err as Error).message);
  }
}

// ─── Convenience-Funktionen für spezifische Events ───────────────────────────

/** Sendet eine neu generierte Image Ad an den Brain */
export async function pushImageAdToBrain(ad: {
  id: number;
  headline: string;
  template: string;
  imageUrl: string;
  status: string;
  createdAt?: Date;
}): Promise<void> {
  await pushToBrain({
    source: "meta-ads-workflow",
    nodes: [
      {
        id: `image-ad-${ad.id}`,
        type: "image_ad",
        label: ad.headline,
        template: ad.template,
        imageUrl: ad.imageUrl,
        status: ad.status,
        createdAt: ad.createdAt?.toISOString() ?? new Date().toISOString(),
        color: "#8b5cf6",
      },
    ],
    links: [
      { source: "meta-ads-workflow", target: `image-ad-${ad.id}`, label: "generated" },
    ],
  });
}

/** Sendet ein Video Ad Skript an den Brain */
export async function pushVideoAdToBrain(ad: {
  id: number;
  hook: string;
  status: string;
  heygenVideoId?: string | null;
  createdAt?: Date;
}): Promise<void> {
  await pushToBrain({
    source: "meta-ads-workflow",
    nodes: [
      {
        id: `video-ad-${ad.id}`,
        type: "video_ad",
        label: ad.hook.slice(0, 80),
        status: ad.status,
        heygenVideoId: ad.heygenVideoId ?? null,
        createdAt: ad.createdAt?.toISOString() ?? new Date().toISOString(),
        color: "#3b82f6",
      },
    ],
    links: [
      { source: "meta-ads-workflow", target: `video-ad-${ad.id}`, label: "generated" },
    ],
  });
}

/** Sendet Performance-Snapshot an den Brain (täglich nach Sync) */
export async function pushPerformanceToBrain(stats: {
  totalAds: number;
  winners: number;
  avgCtr: number;
  totalSpend: number;
  topAd?: { headline: string; ctr: number } | null;
}): Promise<void> {
  const now = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  await pushToBrain({
    source: "meta-ads-workflow",
    nodes: [
      {
        id: `perf-snapshot-${now}`,
        type: "metric",
        label: `Meta Ads Performance ${now}`,
        totalAds: stats.totalAds,
        winners: stats.winners,
        avgCtr: `${stats.avgCtr.toFixed(2)}%`,
        totalSpend: `CHF ${stats.totalSpend.toFixed(0)}`,
        topAd: stats.topAd?.headline ?? "–",
        topAdCtr: stats.topAd ? `${stats.topAd.ctr.toFixed(2)}%` : "–",
        color: "#34d399",
      },
    ],
    links: [
      { source: "meta-ads-workflow", target: `perf-snapshot-${now}`, label: "performance" },
    ],
  });
}

/** Sendet eine Meta-KI-Analyse an den Brain */
export async function pushAnalysisToBrain(analysis: {
  id: number;
  summary: string;
  recommendations: string[];
  createdAt?: Date;
}): Promise<void> {
  const date = (analysis.createdAt ?? new Date()).toISOString().split("T")[0];
  await pushToBrain({
    source: "meta-ads-workflow",
    nodes: [
      {
        id: `meta-analysis-${analysis.id}`,
        type: "agent",
        label: `Meta Analyse ${date}`,
        summary: analysis.summary.slice(0, 200),
        recommendations: analysis.recommendations.slice(0, 3).join(" | "),
        color: "#f59e0b",
      },
    ],
    links: [
      { source: "meta-ads-workflow", target: `meta-analysis-${analysis.id}`, label: "analysis" },
    ],
  });
}
