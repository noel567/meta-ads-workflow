import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Zap, Target, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight,
  Lightbulb, ChevronRight, Loader2, Info
} from "lucide-react";
import { toast } from "sonner";

const DATE_PRESETS = [
  { value: "last_7d", label: "Letzte 7 Tage" },
  { value: "last_14d", label: "Letzte 14 Tage" },
  { value: "last_30d", label: "Letzte 30 Tage" },
  { value: "last_90d", label: "Letzte 90 Tage" },
  { value: "maximum", label: "Gesamter Zeitraum" },
];

function ScoreRing({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? "#22c55e" : score >= 5 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold" style={{ color }}>{score.toFixed(1)}</div>
        <div className="text-xs text-muted-foreground">/10</div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, trend, icon: Icon, color = "blue" }: {
  label: string; value: string; sub?: string; trend?: "up" | "down" | "neutral";
  icon: React.ElementType; color?: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400",
    green: "bg-green-500/10 text-green-400",
    amber: "bg-amber-500/10 text-amber-400",
    purple: "bg-purple-500/10 text-purple-400",
    red: "bg-red-500/10 text-red-400",
  };
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold text-white truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ml-3 flex-shrink-0 ${colors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1">
            {trend === "up" ? <ArrowUpRight className="w-3 h-3 text-green-400" /> : trend === "down" ? <ArrowDownRight className="w-3 h-3 text-red-400" /> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "high") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Hoch</Badge>;
  if (priority === "medium") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Mittel</Badge>;
  return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-xs">Niedrig</Badge>;
}

export default function MetaAdsDashboard() {
  const [datePreset, setDatePreset] = useState("last_30d");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const utils = trpc.useUtils();
  const { data: analysis, isLoading: analysisLoading } = trpc.metaInsights.getLatestAnalysis.useQuery();
  const { data: insights, isLoading: insightsLoading } = trpc.metaInsights.getInsights.useQuery({ datePreset, level: "campaign" });
  const { data: account } = trpc.metaInsights.getAccountOverview.useQuery();

  const syncMutation = trpc.metaInsights.sync.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.synced} Kampagnen synchronisiert`);
      utils.metaInsights.getInsights.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const analyzeMutation = trpc.metaInsights.analyze.useMutation({
    onSuccess: () => {
      toast.success("KI-Analyse abgeschlossen");
      utils.metaInsights.getLatestAnalysis.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncMutation.mutateAsync({ datePreset: datePreset as any, level: "campaign" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      await analyzeMutation.mutateAsync({ datePreset, forceRefresh: true });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // KPIs aus Insights berechnen
  const totalSpend = insights?.reduce((s, i) => s + (i.spend ?? 0), 0) ?? 0;
  const totalImpressions = insights?.reduce((s, i) => s + (i.impressions ?? 0), 0) ?? 0;
  const totalClicks = insights?.reduce((s, i) => s + (i.clicks ?? 0), 0) ?? 0;
  const totalPurchases = insights?.reduce((s, i) => s + (i.purchases ?? 0), 0) ?? 0;
  const avgCtr = insights?.length ? insights.reduce((s, i) => s + (i.ctr ?? 0), 0) / insights.length : 0;
  const avgCpc = insights?.length ? insights.reduce((s, i) => s + (i.cpc ?? 0), 0) / insights.filter(i => i.cpc).length : 0;

  const topCampaigns = [...(insights ?? [])].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0)).slice(0, 8);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Meta Ads Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {account ? `${account.name} · ${account.currency}` : "LGLShop · CHF"} ·{" "}
            {DATE_PRESETS.find(d => d.value === datePreset)?.label}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="w-44 bg-slate-900 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {DATE_PRESETS.map(d => (
                <SelectItem key={d.value} value={d.value} className="text-white">{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleSync} disabled={isSyncing}
            className="border-slate-700 text-white hover:bg-slate-800">
            {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Synchronisieren
          </Button>
          <Button onClick={handleAnalyze} disabled={isAnalyzing || !insights?.length}
            className="bg-blue-600 hover:bg-blue-700 text-white">
            {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            KI-Analyse
          </Button>
        </div>
      </div>

      {/* Kein Daten State */}
      {!insightsLoading && (!insights || insights.length === 0) && (
        <Card className="bg-slate-900 border-slate-800 border-dashed">
          <CardContent className="p-12 text-center">
            <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Noch keine Daten</h3>
            <p className="text-muted-foreground mb-6">Klicke auf "Synchronisieren" um deine Meta Ads Daten zu laden.</p>
            <Button onClick={handleSync} disabled={isSyncing} className="bg-blue-600 hover:bg-blue-700">
              {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Jetzt synchronisieren
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      {insights && insights.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard label="Gesamtausgaben" value={`CHF ${totalSpend.toFixed(0)}`} icon={DollarSign} color="blue" />
          <KpiCard label="Impressionen" value={totalImpressions > 1000 ? `${(totalImpressions / 1000).toFixed(1)}K` : totalImpressions.toString()} icon={BarChart3} color="purple" />
          <KpiCard label="Klicks" value={totalClicks.toLocaleString()} icon={Target} color="amber" />
          <KpiCard label="Conversions" value={totalPurchases.toFixed(0)} icon={CheckCircle2} color="green" />
          <KpiCard label="Ø CTR" value={`${avgCtr.toFixed(2)}%`} icon={TrendingUp} color={avgCtr >= 2 ? "green" : "amber"} />
          <KpiCard label="Ø CPC" value={`CHF ${avgCpc.toFixed(2)}`} icon={DollarSign} color={avgCpc <= 1 ? "green" : "red"} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KI-Analyse Panel */}
        <div className="lg:col-span-2 space-y-4">
          {analysisLoading ? (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              </CardContent>
            </Card>
          ) : analysis ? (
            <Tabs defaultValue="actions" className="space-y-4">
              <TabsList className="bg-slate-900 border border-slate-800">
                <TabsTrigger value="actions" className="data-[state=active]:bg-slate-800">To-Dos</TabsTrigger>
                <TabsTrigger value="budget" className="data-[state=active]:bg-slate-800">Budget</TabsTrigger>
                <TabsTrigger value="performers" className="data-[state=active]:bg-slate-800">Performance</TabsTrigger>
                <TabsTrigger value="insights" className="data-[state=active]:bg-slate-800">Insights</TabsTrigger>
              </TabsList>

              {/* Action Items */}
              <TabsContent value="actions">
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Konkrete To-Dos
                    </CardTitle>
                    <CardDescription>KI-generierte Handlungsempfehlungen</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {((analysis.actionItems as any[]) ?? []).map((item: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                        <PriorityBadge priority={item.priority} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium">{item.action}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="text-blue-400">{item.campaign}</span> · {item.expectedImpact}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                      </div>
                    ))}
                    {!((analysis.actionItems as any[]) ?? []).length && (
                      <p className="text-muted-foreground text-sm text-center py-4">Keine To-Dos vorhanden</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Budget Recommendations */}
              <TabsContent value="budget">
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      Budget-Empfehlungen
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {((analysis.budgetRecommendations as any[]) ?? []).map((rec: any, i: number) => {
                      const diff = rec.recommendedBudget - rec.currentBudget;
                      const isIncrease = diff > 0;
                      return (
                        <div key={i} className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-white truncate flex-1 mr-2">{rec.campaign}</p>
                            <div className={`flex items-center gap-1 text-sm font-bold ${isIncrease ? "text-green-400" : "text-red-400"}`}>
                              {isIncrease ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                              CHF {Math.abs(diff).toFixed(0)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                            <span>Aktuell: <span className="text-white">CHF {rec.currentBudget}</span></span>
                            <span>→</span>
                            <span>Empfohlen: <span className={isIncrease ? "text-green-400" : "text-red-400"}>CHF {rec.recommendedBudget}</span></span>
                            <PriorityBadge priority={rec.priority} />
                          </div>
                          <p className="text-xs text-muted-foreground">{rec.reason}</p>
                          {rec.currentBudget > 0 && (
                            <Progress value={(rec.currentBudget / Math.max(rec.currentBudget, rec.recommendedBudget)) * 100}
                              className="mt-2 h-1.5" />
                          )}
                        </div>
                      );
                    })}
                    {!((analysis.budgetRecommendations as any[]) ?? []).length && (
                      <p className="text-muted-foreground text-sm text-center py-4">Keine Budget-Empfehlungen</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Top/Under Performers */}
              <TabsContent value="performers">
                <div className="space-y-4">
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white text-base flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        Top Performer
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {((analysis.topPerformers as any[]) ?? []).map((p: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                          <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-white truncate">{p.name}</p>
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs flex-shrink-0">{p.metric}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{p.reason}</p>
                            <p className="text-xs text-green-400 mt-1">→ {p.action}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white text-base flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-400" />
                        Schwache Performer
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {((analysis.underperformers as any[]) ?? []).map((p: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-white truncate">{p.name}</p>
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs flex-shrink-0">{p.metric}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{p.reason}</p>
                            <p className="text-xs text-red-400 mt-1">→ {p.action}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Insights */}
              <TabsContent value="insights">
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      Weitere Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {((analysis.insights as any[]) ?? []).map((ins: any, i: number) => {
                      const iconMap: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
                        opportunity: { icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/5 border-green-500/20" },
                        warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/20" },
                        info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/5 border-blue-500/20" },
                      };
                      const style = iconMap[ins.type] ?? iconMap.info;
                      const Icon = style.icon;
                      return (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${style.bg}`}>
                          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${style.color}`} />
                          <div>
                            <p className="text-sm font-medium text-white">{ins.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{ins.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="bg-slate-900 border-slate-800 border-dashed">
              <CardContent className="p-8 text-center">
                <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-white mb-2">Noch keine KI-Analyse</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Synchronisiere zuerst deine Daten, dann starte die KI-Analyse.
                </p>
                <Button onClick={handleAnalyze} disabled={isAnalyzing || !insights?.length}
                  className="bg-blue-600 hover:bg-blue-700">
                  {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                  KI-Analyse starten
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Rechte Spalte: Score + Kampagnen-Tabelle */}
        <div className="space-y-4">
          {/* Performance Score */}
          {analysis && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm">Performance Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <ScoreRing score={analysis.overallScore ?? 0} />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground leading-relaxed">{analysis.summary}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      Analyse vom {new Date(analysis.createdAt).toLocaleDateString("de-CH")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Kampagnen-Tabelle */}
          {topCampaigns.length > 0 && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm">Kampagnen nach Spend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3">
                {topCampaigns.map((c, i) => {
                  const maxSpend = topCampaigns[0]?.spend ?? 1;
                  const pct = ((c.spend ?? 0) / maxSpend) * 100;
                  return (
                    <div key={c.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white truncate flex-1 mr-2" title={c.campaignName}>
                          {i + 1}. {c.campaignName.length > 28 ? c.campaignName.slice(0, 28) + "…" : c.campaignName}
                        </span>
                        <span className="text-muted-foreground flex-shrink-0">CHF {c.spend?.toFixed(0)}</span>
                      </div>
                      <Progress value={pct} className="h-1" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
