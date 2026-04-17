import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  BarChart3, Users, Sparkles, BookOpen, MonitorPlay, HardDrive,
  Zap, ArrowRight, TrendingUp, Clock, CheckCircle2, AlertCircle,
  Play, RefreshCw, FileText, Target
} from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [runningDailyScan, setRunningDailyScan] = useState(false);

  const { data: stats, refetch } = trpc.dashboard.getStats.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: metaConn } = trpc.meta.getConnection.useQuery(undefined, { enabled: isAuthenticated });
  const { data: driveConn } = trpc.googleDrive.getConnection.useQuery(undefined, { enabled: isAuthenticated });

  const dailyScanMutation = trpc.automation.runScan.useMutation({
    onSuccess: (data) => {
      setRunningDailyScan(false);
      toast.success(
        `Scan abgeschlossen: ${(data as any).scanned ?? 0} Konkurrenten, ${(data as any).totalNewAds ?? 0} neue Ads, ${(data as any).batchesCreated ?? 0} Batches erstellt`
      );
      refetch();
    },
    onError: (e) => { setRunningDailyScan(false); toast.error(e.message); },
  });

  const handleDailyScan = () => {
    setRunningDailyScan(true);
    dailyScanMutation.mutate();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Bitte anmelden um fortzufahren.</p>
          <Button onClick={() => window.location.href = getLoginUrl()}>Anmelden</Button>
        </div>
      </DashboardLayout>
    );
  }

  const quickActions = [
    {
      icon: Users,
      label: "Konkurrenten scannen",
      description: "Alle aktiven Konkurrenten nach neuen Ads durchsuchen",
      path: "/competitors",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      icon: Sparkles,
      label: "Batch generieren",
      description: "KI erstellt Body + CTA + 3 Hooks aus einem Ad",
      path: "/batches",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: MonitorPlay,
      label: "Teleprompter",
      description: "Skript auswählen und direkt aufnehmen",
      path: "/teleprompter",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      icon: BarChart3,
      label: "Ads analysieren",
      description: "KI-Insights zu deinen laufenden Kampagnen",
      path: "/analytics",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Guten Morgen{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Dein täglicher Ad-Produktions-Workflow – von Konkurrenz-Analyse bis HeyGen-Skript
            </p>
          </div>
          <Button
            onClick={handleDailyScan}
            disabled={runningDailyScan}
            className="gap-2"
            size="sm"
          >
            {runningDailyScan ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Scannt...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Täglichen Scan starten
              </>
            )}
          </Button>
        </div>

        {/* Connection Status */}
        <div className="flex gap-3 flex-wrap">
          <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${metaConn ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-muted/30 border-border text-muted-foreground"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${metaConn ? "bg-emerald-400" : "bg-muted-foreground"}`} />
            Meta Ads {metaConn ? `verbunden (${metaConn.adAccountName})` : "nicht verbunden"}
          </div>
          <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${driveConn ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-muted/30 border-border text-muted-foreground"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${driveConn ? "bg-emerald-400" : "bg-muted-foreground"}`} />
            Google Drive {driveConn ? `verbunden (${driveConn.rootFolderName})` : "nicht verbunden"}
          </div>
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border bg-primary/5 border-primary/20 text-primary">
            <Clock className="w-3 h-3" />
            Täglicher Auto-Scan: 09:00 Uhr
          </div>
        </div>

        {/* KPI Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{stats.activeCompetitors}</p>
                    <p className="text-xs text-muted-foreground">Aktive Konkurrenten</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Target className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{stats.competitorAds}</p>
                    <p className="text-xs text-muted-foreground">Konkurrenz-Ads</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{stats.batches}</p>
                    <p className="text-xs text-muted-foreground">
                      Batches
                      {stats.todayBatches > 0 && (
                        <span className="ml-1 text-emerald-400">+{stats.todayBatches} heute</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{stats.transcripts}</p>
                    <p className="text-xs text-muted-foreground">Transkripte</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Meta Ads Performance */}
        {stats && stats.ads > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Gesamtausgaben (30 Tage)</p>
                <p className="text-xl font-semibold text-foreground">€{stats.totalSpend.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Ø CTR</p>
                <p className="text-xl font-semibold text-foreground">{stats.avgCTR.toFixed(2)}%</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Ø ROAS</p>
                <p className="text-xl font-semibold text-foreground">{stats.avgROAS > 0 ? stats.avgROAS.toFixed(2) : "–"}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Schnellzugriff</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map(action => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="text-left p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:bg-card/80 transition-all group"
              >
                <div className={`w-9 h-9 rounded-lg ${action.bg} flex items-center justify-center mb-3`}>
                  <action.icon className={`w-4 h-4 ${action.color}`} />
                </div>
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{action.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{action.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Workflow Steps */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Täglicher Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-0 overflow-x-auto pb-2">
              {[
                { step: "1", label: "Konkurrenten scannen", icon: Users, desc: "Neue Ads täglich automatisch", color: "text-blue-400" },
                { step: "2", label: "Transkript extrahieren", icon: FileText, desc: "KI analysiert Ad-Texte", color: "text-amber-400" },
                { step: "3", label: "Batch generieren", icon: Sparkles, desc: "Body + CTA + 3 Hooks", color: "text-primary" },
                { step: "4", label: "HeyGen Skript", icon: Play, desc: "Avatar-Video erstellen", color: "text-purple-400" },
                { step: "5", label: "Teleprompter", icon: MonitorPlay, desc: "Selbst aufnehmen", color: "text-emerald-400" },
                { step: "6", label: "Google Drive", icon: HardDrive, desc: "Automatisch ablegen", color: "text-rose-400" },
              ].map((item, i, arr) => (
                <div key={item.step} className="flex items-center flex-shrink-0">
                  <div className="flex flex-col items-center gap-2 w-28">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40 mx-1 flex-shrink-0 -mt-4" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Batches */}
        {stats && stats.recentBatches && stats.recentBatches.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground">Neueste Batches</h2>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate("/batches")}>
                Alle anzeigen <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="space-y-2">
              {stats.recentBatches.map((batch: { id: number; title: string; status: string | null; competitorName?: string | null; generatedAt: Date }) => (
                <div key={batch.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{batch.title}</p>
                      {batch.competitorName && (
                        <p className="text-xs text-muted-foreground">von {batch.competitorName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={`text-xs py-0 ${batch.status === "ready" ? "bg-primary/10 text-primary" : batch.status === "exported" ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                      {batch.status === "ready" ? "Bereit" : batch.status === "exported" ? "Exportiert" : batch.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(batch.generatedAt).toLocaleDateString("de-DE")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Setup Checklist */}
        {(!metaConn || !driveConn || (stats && stats.competitors === 0)) && (
          <Card className="bg-card border-border border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Setup-Checkliste</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { done: !!metaConn, label: "Meta Ads Manager verbinden", path: "/connect" },
                { done: !!driveConn, label: "Google Drive verbinden", path: "/settings" },
                { done: stats ? stats.competitors > 0 : false, label: "Ersten Konkurrenten hinzufügen", path: "/competitors" },
                { done: stats ? stats.batches > 0 : false, label: "Ersten Batch generieren", path: "/batches" },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => !item.done && navigate(item.path)}
                  className={`w-full flex items-center gap-3 text-left text-sm py-1.5 ${item.done ? "cursor-default" : "hover:text-primary"}`}
                >
                  {item.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-muted-foreground/40 flex-shrink-0" />
                  )}
                  <span className={item.done ? "text-muted-foreground line-through" : "text-foreground"}>
                    {item.label}
                  </span>
                  {!item.done && <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground" />}
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
