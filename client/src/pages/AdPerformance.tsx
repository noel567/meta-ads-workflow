import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp,
  Trophy,
  Zap,
  DollarSign,
  RefreshCw,
  BarChart2,
  Target,
  Award,
  Image,
  Video,
  Play,
} from "lucide-react";
import { toast } from "sonner";

const DATE_PRESETS = [
  { value: "today", label: "Heute" },
  { value: "yesterday", label: "Gestern" },
  { value: "last_7d", label: "Letzte 7 Tage" },
  { value: "last_14d", label: "Letzte 14 Tage" },
  { value: "last_30d", label: "Letzte 30 Tage" },
  { value: "last_90d", label: "Letzte 90 Tage" },
  { value: "maximum", label: "Gesamte Laufzeit" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  testing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  winner: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  testing: "Getestet",
  active: "Aktiv",
  paused: "Pausiert",
  winner: "Gewinner",
};

export default function AdPerformance() {
  const [syncing, setSyncing] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [syncingPerf, setSyncingPerf] = useState(false);
  const [datePreset, setDatePreset] = useState<"today" | "yesterday" | "last_7d" | "last_14d" | "last_30d" | "last_90d" | "maximum">("last_30d");

  const { data: overview, refetch } = trpc.imageAds.getPerformanceOverview.useQuery({ datePreset });
  const { data: allAds } = trpc.imageAds.list.useQuery();

  const syncMutation = trpc.imageAds.syncPerformance.useMutation({
    onSuccess: (data) => {
      toast.success(`Performance synchronisiert: ${data.message}`);
      refetch();
    },
    onError: (e) => toast.error(`Sync Fehler: ${e.message}`),
    onSettled: () => setSyncing(false),
  });

  const dailyImageMutation = trpc.automation.runDailyImageAds.useMutation({
    onSuccess: (data: any) => {
      toast.success(data?.title ? `Image Ad "${data.title}" generiert!` : "Image Ad Generierung gestartet");
      refetch();
    },
    onError: (e) => toast.error(`Image Ad Fehler: ${e.message}`),
    onSettled: () => setGeneratingImage(false),
  });

  const dailyVideoMutation = trpc.automation.runDailyVideoScript.useMutation({
    onSuccess: (data: any) => {
      toast.success(data?.title ? `Video-Skript "${data.title}" generiert!` : "Video-Skript Generierung gestartet");
    },
    onError: (e) => toast.error(`Video-Skript Fehler: ${e.message}`),
    onSettled: () => setGeneratingVideo(false),
  });

  const dailyPerfMutation = trpc.automation.runDailyPerfSync.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Performance Sync: ${data?.synced ?? 0} Ads synchronisiert${data?.winners ? `, ${data.winners} Gewinner` : ""}`);
      refetch();
    },
    onError: (e) => toast.error(`Performance Sync Fehler: ${e.message}`),
    onSettled: () => setSyncingPerf(false),
  });

  const handleSync = () => {
    setSyncing(true);
    syncMutation.mutate({ adAccountId: "act_1093241318940799" });
  };

  const handleDailyImage = () => {
    setGeneratingImage(true);
    dailyImageMutation.mutate();
  };

  const handleDailyVideo = () => {
    setGeneratingVideo(true);
    dailyVideoMutation.mutate();
  };

  const handleDailyPerfSync = () => {
    setSyncingPerf(true);
    dailyPerfMutation.mutate();
  };

  const winnerAds = allAds?.filter(a => a.boardStatus === "winner") ?? [];
  const activeAds = allAds?.filter(a => a.boardStatus === "active") ?? [];
  const testingAds = allAds?.filter(a => a.boardStatus === "testing") ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-amber-400" />
            Ad Performance
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Übersicht deiner Meta Ads Performance – CTR, Spend, Gewinner
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as typeof datePreset)}>
            <SelectTrigger className="w-44 bg-[#1a1a2e] border-[#2a2a4a] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-[#2a2a4a]">
              {DATE_PRESETS.map(p => (
                <SelectItem key={p.value} value={p.value} className="text-white hover:bg-[#2a2a4a]">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Synchronisiere..." : "Performance Sync"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Gesamt Ads</p>
                <p className="text-2xl font-bold text-white">{overview?.total ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Gewinner</p>
                <p className="text-2xl font-bold text-amber-400">{overview?.winners ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Ø CTR</p>
                <p className="text-2xl font-bold text-green-400">{overview?.avgCtr ?? 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Gesamt Spend <span className="text-purple-400">({DATE_PRESETS.find(p => p.value === datePreset)?.label})</span></p>
                <p className="text-2xl font-bold text-white">€{overview?.totalSpend?.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Automation Loop */}
      <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <Zap className="w-5 h-5 text-amber-400" />
            Daily Automation Loop
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1">
            Läuft täglich automatisch: 08:00 Image Ad · 08:15 Video-Skript · 11:00 Performance Sync (CEST)
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-lg bg-[#0f0f1e] border border-[#2a2a4a] space-y-2">
              <div className="flex items-center gap-2">
                <Image className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-semibold text-white">Image Ad generieren</span>
              </div>
              <p className="text-xs text-gray-400">DALL-E 3 + Livio-Foto + EasySignals-Kontext → neue Ad im Board</p>
              <Button
                onClick={handleDailyImage}
                disabled={generatingImage}
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Play className={`w-3 h-3 mr-1 ${generatingImage ? "animate-pulse" : ""}`} />
                {generatingImage ? "Generiere..." : "Jetzt ausführen"}
              </Button>
            </div>

            <div className="p-4 rounded-lg bg-[#0f0f1e] border border-[#2a2a4a] space-y-2">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-semibold text-white">Video-Skript generieren</span>
              </div>
              <p className="text-xs text-gray-400">3 Hooks + Body + CTA → neues Skript für HeyGen Livio-Klon</p>
              <Button
                onClick={handleDailyVideo}
                disabled={generatingVideo}
                size="sm"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Play className={`w-3 h-3 mr-1 ${generatingVideo ? "animate-pulse" : ""}`} />
                {generatingVideo ? "Generiere..." : "Jetzt ausführen"}
              </Button>
            </div>

            <div className="p-4 rounded-lg bg-[#0f0f1e] border border-[#2a2a4a] space-y-2">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-semibold text-white">Performance Sync</span>
              </div>
              <p className="text-xs text-gray-400">CTR, CPC, Spend von Meta API laden → Gewinner automatisch erkennen</p>
              <Button
                onClick={handleDailyPerfSync}
                disabled={syncingPerf}
                size="sm"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${syncingPerf ? "animate-spin" : ""}`} />
                {syncingPerf ? "Synchronisiere..." : "Jetzt ausführen"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performer */}
        <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Award className="w-5 h-5 text-amber-400" />
              Top Performer (nach CTR)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(overview?.topAds ?? []).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BarChart2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Noch keine Performance-Daten.</p>
                <p className="text-xs mt-1">Klicke auf "Performance Sync" um Daten zu laden.</p>
              </div>
            ) : (
              (overview?.topAds ?? []).map((ad, i) => (
                <div key={ad.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#0f0f1e] border border-[#2a2a4a]">
                  <span className="text-lg font-bold text-amber-400 w-6">#{i + 1}</span>
                  {ad.imageUrl && (
                    <img src={String(ad.imageUrl)} alt={ad.title} className="w-12 h-12 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{ad.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-green-400 font-semibold">CTR: {ad.ctr?.toFixed(2)}%</span>
                      {ad.spend && <span className="text-xs text-gray-400">Spend: €{ad.spend.toFixed(2)}</span>}
                    </div>
                  </div>
                  <Badge className={`text-xs border ${STATUS_COLORS[ad.boardStatus]}`}>
                    {STATUS_LABELS[ad.boardStatus]}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Status Übersicht */}
        <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Zap className="w-5 h-5 text-blue-400" />
              Status Übersicht
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Winner Ads */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-amber-400 font-semibold flex items-center gap-1">
                  <Trophy className="w-4 h-4" /> Gewinner
                </span>
                <span className="text-sm text-gray-400">{winnerAds.length} Ads</span>
              </div>
              {winnerAds.length === 0 ? (
                <p className="text-xs text-gray-500 italic">Noch keine Gewinner</p>
              ) : (
                <div className="space-y-1">
                  {winnerAds.slice(0, 3).map(ad => (
                    <div key={ad.id} className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                      {ad.imageUrl && <img src={String(ad.imageUrl)} alt={ad.title} className="w-8 h-8 rounded object-cover" />}
                      <span className="text-xs text-white truncate flex-1">{ad.title}</span>
                      {ad.ctr && <span className="text-xs text-amber-400 font-semibold">{ad.ctr.toFixed(2)}%</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Ads */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-green-400 font-semibold flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" /> Aktiv
                </span>
                <span className="text-sm text-gray-400">{activeAds.length} Ads</span>
              </div>
              {activeAds.length === 0 ? (
                <p className="text-xs text-gray-500 italic">Keine aktiven Ads</p>
              ) : (
                <div className="space-y-1">
                  {activeAds.slice(0, 3).map(ad => (
                    <div key={ad.id} className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/20">
                      {ad.imageUrl && <img src={String(ad.imageUrl)} alt={ad.title} className="w-8 h-8 rounded object-cover" />}
                      <span className="text-xs text-white truncate flex-1">{ad.title}</span>
                      {ad.ctr && <span className="text-xs text-green-400 font-semibold">{ad.ctr.toFixed(2)}%</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Testing Ads */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-400 font-semibold flex items-center gap-1">
                  <Target className="w-4 h-4" /> Im Test
                </span>
                <span className="text-sm text-gray-400">{testingAds.length} Ads</span>
              </div>
              {testingAds.length === 0 ? (
                <p className="text-xs text-gray-500 italic">Keine Ads im Test</p>
              ) : (
                <div className="space-y-1">
                  {testingAds.slice(0, 3).map(ad => (
                    <div key={ad.id} className="flex items-center gap-2 p-2 rounded bg-blue-500/10 border border-blue-500/20">
                      {ad.imageUrl && <img src={String(ad.imageUrl)} alt={ad.title} className="w-8 h-8 rounded object-cover" />}
                      <span className="text-xs text-white truncate flex-1">{ad.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Ads Table */}
      <Card className="bg-[#1a1a2e] border-[#2a2a4a]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Alle Ads – Performance Tabelle</CardTitle>
        </CardHeader>
        <CardContent>
          {(!allAds || allAds.length === 0) ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">Noch keine Image Ads erstellt.</p>
              <p className="text-xs mt-1">Gehe zu "Image Ads" um deine erste Ad zu generieren.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a4a] text-gray-400 text-xs">
                    <th className="text-left py-2 pr-4">Ad</th>
                    <th className="text-left py-2 pr-4">Stil</th>
                    <th className="text-right py-2 pr-4">CTR</th>
                    <th className="text-right py-2 pr-4">CPC</th>
                    <th className="text-right py-2 pr-4">Spend</th>
                    <th className="text-right py-2 pr-4">Impressionen</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allAds.map(ad => (
                    <tr key={ad.id} className="border-b border-[#1a1a2e] hover:bg-[#0f0f1e] transition-colors">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          {ad.imageUrl && (
                            <img src={String(ad.imageUrl)} alt={ad.title} className="w-8 h-8 rounded object-cover" />
                          )}
                          <span className="text-white font-medium truncate max-w-[150px]">{ad.title}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-gray-400 capitalize">{ad.style.replace("_", " ")}</td>
                      <td className="py-2 pr-4 text-right">
                        {ad.ctr ? (
                          <span className={`font-semibold ${ad.ctr > 3 ? "text-amber-400" : ad.ctr > 1.5 ? "text-green-400" : "text-gray-400"}`}>
                            {ad.ctr.toFixed(2)}%
                          </span>
                        ) : <span className="text-gray-600">–</span>}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-400">
                        {ad.cpc ? `€${ad.cpc.toFixed(2)}` : "–"}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-400">
                        {ad.spend ? `€${ad.spend.toFixed(2)}` : "–"}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-400">
                        {ad.impressions ? ad.impressions.toLocaleString() : "–"}
                      </td>
                      <td className="py-2">
                        <Badge className={`text-xs border ${STATUS_COLORS[ad.boardStatus]}`}>
                          {STATUS_LABELS[ad.boardStatus]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
