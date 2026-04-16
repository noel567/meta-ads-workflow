import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  BookOpen,
  FileText,
  Library,
  MonitorPlay,
  Plug,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  color = "primary",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "text-primary bg-primary/10 border-primary/20",
    emerald: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    amber: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    violet: "text-violet-400 bg-violet-400/10 border-violet-400/20",
    cyan: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  };
  const cls = colorMap[color] || colorMap.primary;

  return (
    <Card className="stat-card bg-card border-border/50 hover:border-border transition-all">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-semibold mt-1 text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`h-9 w-9 rounded-lg border flex items-center justify-center ${cls}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const quickActions = [
  {
    icon: Plug,
    label: "Meta verbinden",
    desc: "Ad Account verknüpfen",
    path: "/connect",
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
  },
  {
    icon: BarChart3,
    label: "Ads analysieren",
    desc: "KPIs & KI-Insights",
    path: "/analytics",
    color: "text-violet-400",
    bg: "bg-violet-400/10 border-violet-400/20",
  },
  {
    icon: Library,
    label: "Ad Library",
    desc: "Konkurrenten recherchieren",
    path: "/ad-library",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10 border-cyan-400/20",
  },
  {
    icon: BookOpen,
    label: "Transkripte",
    desc: "Skripte erstellen & verwalten",
    path: "/transcripts",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
  },
  {
    icon: MonitorPlay,
    label: "Teleprompter",
    desc: "Aufnahme-Vorlage starten",
    path: "/teleprompter",
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
  },
  {
    icon: FileText,
    label: "Dokumente",
    desc: "Exporte & Berichte",
    path: "/documents",
    color: "text-rose-400",
    bg: "bg-rose-400/10 border-rose-400/20",
  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: connection } = trpc.meta.getConnection.useQuery();

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            {connection ? (
              <Badge variant="outline" className="badge-active text-xs">
                Verbunden
              </Badge>
            ) : (
              <Badge variant="outline" className="badge-archived text-xs">
                Nicht verbunden
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Dein zentraler Workflow für Meta Ads Analyse und Creative-Produktion.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="bg-card border-border/50">
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-7 w-12" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <StatCard label="Kampagnen" value={stats?.campaigns ?? 0} icon={BarChart3} color="primary" />
              <StatCard label="Eigene Ads" value={stats?.ads ?? 0} icon={TrendingUp} color="violet" />
              <StatCard label="Konkurrenz-Ads" value={stats?.competitorAds ?? 0} icon={Library} color="cyan" />
              <StatCard label="Transkripte" value={stats?.transcripts ?? 0} icon={BookOpen} color="emerald" />
              <StatCard label="Dokumente" value={stats?.documents ?? 0} icon={FileText} color="amber" />
            </>
          )}
        </div>

        {/* Performance Overview */}
        {stats && stats.ads > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-card border-border/50">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Gesamtausgaben (30d)</p>
                <p className="text-2xl font-semibold mt-1">€{stats.totalSpend.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Ø CTR</p>
                <p className="text-2xl font-semibold mt-1">{stats.avgCTR.toFixed(2)}%</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Ø ROAS</p>
                <p className="text-2xl font-semibold mt-1">
                  {stats.avgROAS > 0 ? `${stats.avgROAS.toFixed(2)}x` : "—"}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Schnellzugriff
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.path}
                onClick={() => setLocation(action.path)}
                className="group flex flex-col items-center gap-3 p-4 rounded-xl border border-border/50 bg-card hover:border-border hover:bg-card/80 transition-all text-center"
              >
                <div className={`h-10 w-10 rounded-xl border flex items-center justify-center ${action.bg} transition-transform group-hover:scale-110`}>
                  <action.icon className={`h-5 w-5 ${action.color}`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground leading-tight">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Transcripts */}
        {stats && stats.recentTranscripts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Zuletzt bearbeitet
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/transcripts")} className="text-xs text-muted-foreground">
                Alle anzeigen
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {stats.recentTranscripts.map((t) => (
                <Card
                  key={t.id}
                  className="bg-card border-border/50 hover:border-border cursor-pointer transition-all"
                  onClick={() => setLocation("/transcripts")}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                        <BookOpen className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {t.content.slice(0, 80)}...
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty state when not connected */}
        {!connection && (
          <Card className="border-dashed border-border/50 bg-card/50">
            <CardContent className="p-8 text-center">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Starte deinen Workflow</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                Verbinde deinen Meta Ads Manager, um deine Kampagnen zu analysieren und KI-gestützte Optimierungsvorschläge zu erhalten.
              </p>
              <Button onClick={() => setLocation("/connect")} size="sm">
                <Plug className="h-4 w-4 mr-2" />
                Meta verbinden
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
