import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  BarChart3,
  Brain,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const DATE_PRESETS = [
  { value: "today", label: "Heute" },
  { value: "yesterday", label: "Gestern" },
  { value: "last_7d", label: "Letzte 7 Tage" },
  { value: "last_14d", label: "Letzte 14 Tage" },
  { value: "last_30d", label: "Letzte 30 Tage" },
  { value: "last_90d", label: "Letzte 90 Tage" },
  { value: "maximum", label: "Gesamte Laufzeit" },
] as const;
type DatePreset = typeof DATE_PRESETS[number]["value"];
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Streamdown } from "streamdown";
import { useLocation } from "wouter";

function KpiCard({
  label,
  value,
  unit = "",
  trend,
  color = "primary",
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "text-primary",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    cyan: "text-cyan-400",
    violet: "text-violet-400",
  };
  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">{label}</p>
        <div className="flex items-end gap-2">
          <span className={`text-2xl font-semibold ${colorMap[color] || colorMap.primary}`}>
            {value}
          </span>
          {unit && <span className="text-sm text-muted-foreground mb-0.5">{unit}</span>}
          {trend === "up" && <TrendingUp className="h-4 w-4 text-emerald-400 mb-0.5" />}
          {trend === "down" && <TrendingDown className="h-4 w-4 text-rose-400 mb-0.5" />}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const s = status.toUpperCase();
  if (s === "ACTIVE") return <span className="badge-active text-xs px-2 py-0.5 rounded-full font-medium">Aktiv</span>;
  if (s === "PAUSED") return <span className="badge-paused text-xs px-2 py-0.5 rounded-full font-medium">Pausiert</span>;
  return <span className="badge-archived text-xs px-2 py-0.5 rounded-full font-medium">{status}</span>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-xl">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} className="text-sm font-medium" style={{ color: p.color }}>
            {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const [, setLocation] = useLocation();
  const [showInsights, setShowInsights] = useState(false);
  const [expandedAd, setExpandedAd] = useState<number | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("last_30d");

  const { data: campaigns, isLoading: loadingCampaigns } = trpc.analytics.getCampaigns.useQuery();
  const { data: ads, isLoading: loadingAds } = trpc.analytics.getAds.useQuery();
  const { data: connection } = trpc.meta.getConnection.useQuery();

  const insightsMutation = trpc.analytics.getAIInsights.useMutation({
    onSuccess: () => setShowInsights(true),
    onError: (err) => toast.error(err.message),
  });

  const syncCampaignsMutation = trpc.meta.syncCampaigns.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.synced} Kampagnen synchronisiert (${DATE_PRESETS.find(p => p.value === datePreset)?.label})`);
    },
    onError: (err) => toast.error(err.message),
  });

  const syncAdsMutation = trpc.meta.syncAds.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.synced} Ads synchronisiert`);
    },
    onError: (err) => toast.error(err.message),
  });

  const utils = trpc.useUtils();

  const handleSync = async () => {
    await syncCampaignsMutation.mutateAsync({ datePreset });
    await syncAdsMutation.mutateAsync({ datePreset });
    utils.analytics.getCampaigns.invalidate();
    utils.analytics.getAds.invalidate();
  };

  // Aggregate KPIs
  const totalSpend = ads?.reduce((s, a) => s + (a.spend || 0), 0) ?? 0;
  const totalImpressions = ads?.reduce((s, a) => s + (a.impressions || 0), 0) ?? 0;
  const totalClicks = ads?.reduce((s, a) => s + (a.clicks || 0), 0) ?? 0;
  const avgCTR = ads && ads.filter(a => a.ctr).length > 0
    ? ads.reduce((s, a) => s + (a.ctr || 0), 0) / ads.filter(a => a.ctr).length
    : 0;
  const avgCPC = ads && ads.filter(a => a.cpc).length > 0
    ? ads.reduce((s, a) => s + (a.cpc || 0), 0) / ads.filter(a => a.cpc).length
    : 0;
  const avgROAS = ads && ads.filter(a => a.roas).length > 0
    ? ads.reduce((s, a) => s + (a.roas || 0), 0) / ads.filter(a => a.roas).length
    : 0;

  // Chart data – top 8 ads by spend
  const chartData = (ads || [])
    .filter(a => a.spend && a.spend > 0)
    .sort((a, b) => (b.spend || 0) - (a.spend || 0))
    .slice(0, 8)
    .map(a => ({
      name: a.name.length > 20 ? a.name.slice(0, 20) + "…" : a.name,
      Ausgaben: parseFloat((a.spend || 0).toFixed(2)),
      CTR: parseFloat((a.ctr || 0).toFixed(2)),
      ROAS: parseFloat((a.roas || 0).toFixed(2)),
    }));

  const CHART_COLORS = [
    "oklch(0.65 0.18 260)",
    "oklch(0.72 0.15 200)",
    "oklch(0.68 0.16 140)",
    "oklch(0.70 0.18 50)",
    "oklch(0.62 0.20 320)",
    "oklch(0.65 0.18 260)",
    "oklch(0.72 0.15 200)",
    "oklch(0.68 0.16 140)",
  ];

  if (!connection) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Keine Verbindung</h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Verbinde zuerst deinen Meta Ads Manager, um deine Kampagnen und Ads zu analysieren.
            </p>
            <Button size="sm" onClick={() => setLocation("/connect")}>
              Meta verbinden
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">Ads Performance</h1>
            <p className="text-sm text-muted-foreground">
              {DATE_PRESETS.find(p => p.value === datePreset)?.label} · {connection.adAccountName}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncCampaignsMutation.isPending || syncAdsMutation.isPending}
              className="border-border/50"
            >
              {(syncCampaignsMutation.isPending || syncAdsMutation.isPending) ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
              )}
              Sync
            </Button>
            <Button
              size="sm"
              onClick={() => insightsMutation.mutate()}
              disabled={insightsMutation.isPending || !ads?.length}
            >
              {insightsMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <Brain className="h-3.5 w-3.5 mr-2" />
              )}
              KI-Analyse
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {loadingAds ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-card border-border/50">
                <CardContent className="p-5">
                  <Skeleton className="h-3 w-16 mb-2" />
                  <Skeleton className="h-7 w-20" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <KpiCard label="Ausgaben" value={`€${totalSpend.toFixed(2)}`} color="primary" />
              <KpiCard label="Impressionen" value={totalImpressions.toLocaleString("de-DE")} color="violet" />
              <KpiCard label="Klicks" value={totalClicks.toLocaleString("de-DE")} color="cyan" />
              <KpiCard label="Ø CTR" value={avgCTR.toFixed(2)} unit="%" color="emerald" />
              <KpiCard label="Ø CPC" value={`€${avgCPC.toFixed(2)}`} color="amber" />
              <KpiCard label="Ø ROAS" value={avgROAS > 0 ? `${avgROAS.toFixed(2)}x` : "—"} color="rose" />
            </>
          )}
        </div>

        {/* AI Insights */}
        {showInsights && insightsMutation.data && (
          <Card className="bg-card border-primary/30 mb-8">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  KI-Analyse & Optimierungsvorschläge
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowInsights(false)} className="h-7 w-7 p-0">
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm prose-invert max-w-none">
                <Streamdown>{String(insightsMutation.data.insights)}</Streamdown>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <Card className="bg-card border-border/50 mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Top Ads nach Ausgaben
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.015 250)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "oklch(0.55 0.015 250)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "oklch(0.55 0.015 250)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Ausgaben" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Campaigns */}
        {!loadingCampaigns && campaigns && campaigns.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Kampagnen ({campaigns.length})
            </h2>
            <div className="space-y-2">
              {campaigns.map((c) => (
                <Card key={c.id} className="bg-card border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <BarChart3 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.objective || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {c.dailyBudget && (
                          <span className="text-xs text-muted-foreground">
                            €{c.dailyBudget.toFixed(2)}/Tag
                          </span>
                        )}
                        <StatusBadge status={c.status} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Ads Table */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Ads {ads ? `(${ads.length})` : ""}
          </h2>

          {loadingAds ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="bg-card border-border/50">
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !ads || ads.length === 0 ? (
            <Card className="bg-card border-dashed border-border/50">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Keine Ads gefunden. Klicke auf "Sync", um deine Ads zu laden.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {ads.map((ad) => (
                <Card
                  key={ad.id}
                  className="bg-card border-border/50 hover:border-border cursor-pointer transition-all"
                  onClick={() => setExpandedAd(expandedAd === ad.id ? null : ad.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{ad.name}</p>
                          <p className="text-xs text-muted-foreground">{ad.adsetName || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 ml-4">
                        <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
                          <span>€{(ad.spend || 0).toFixed(2)}</span>
                          <span>{(ad.ctr || 0).toFixed(2)}% CTR</span>
                          <span>€{(ad.cpc || 0).toFixed(2)} CPC</span>
                          {ad.roas && <span className="text-emerald-400">{ad.roas.toFixed(2)}x ROAS</span>}
                        </div>
                        <StatusBadge status={ad.status} />
                        {expandedAd === ad.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {expandedAd === ad.id && (
                      <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Impressionen</p>
                          <p className="text-sm font-medium">{(ad.impressions || 0).toLocaleString("de-DE")}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Reichweite</p>
                          <p className="text-sm font-medium">{(ad.reach || 0).toLocaleString("de-DE")}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Klicks</p>
                          <p className="text-sm font-medium">{(ad.clicks || 0).toLocaleString("de-DE")}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">CPM</p>
                          <p className="text-sm font-medium">€{(ad.cpm || 0).toFixed(2)}</p>
                        </div>
                        {ad.adText && (
                          <div className="col-span-2 md:col-span-4">
                            <p className="text-xs text-muted-foreground mb-1">Ad Text</p>
                            <p className="text-sm text-foreground/80 line-clamp-3">{ad.adText}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
