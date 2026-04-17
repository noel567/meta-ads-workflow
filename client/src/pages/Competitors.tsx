import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  Plus, Trash2, RefreshCw, Users, Zap, Clock, CheckCircle2,
  AlertCircle, Play, Eye, TrendingUp, Globe, Activity
} from "lucide-react";

const COUNTRIES = [
  { code: "DE", label: "Deutschland" },
  { code: "AT", label: "Österreich" },
  { code: "CH", label: "Schweiz" },
  { code: "US", label: "USA" },
  { code: "GB", label: "UK" },
  { code: "FR", label: "Frankreich" },
  { code: "IT", label: "Italien" },
  { code: "ES", label: "Spanien" },
  { code: "NL", label: "Niederlande" },
];

const LANGUAGES = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "Englisch" },
  { code: "fr", label: "Französisch" },
  { code: "it", label: "Italienisch" },
  { code: "es", label: "Spanisch" },
  { code: "nl", label: "Niederländisch" },
];

export default function Competitors() {
  const { user, loading, isAuthenticated } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [scanningId, setScanningId] = useState<number | null>(null);
  const [scanningAll, setScanningAll] = useState(false);

  const [form, setForm] = useState({
    name: "",
    pageId: "",
    pageName: "",
    country: "DE",
    language: "de",
    notes: "",
  });

  const { data: competitors, refetch } = trpc.competitors.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: scanLogs } = trpc.competitors.getScanLogs.useQuery(undefined, { enabled: isAuthenticated });

  const createMutation = trpc.competitors.create.useMutation({
    onSuccess: () => {
      toast.success("Konkurrent hinzugefügt");
      setAddOpen(false);
      setForm({ name: "", pageId: "", pageName: "", country: "DE", language: "de", notes: "" });
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.competitors.delete.useMutation({
    onSuccess: () => { toast.success("Konkurrent entfernt"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = trpc.competitors.update.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });

  const scanMutation = trpc.competitors.scanAds.useMutation({
    onSuccess: (data: { found: number }, _vars: any) => {
      setScanningId(null);
      toast.success(`Scan abgeschlossen: ${data.found} Ads gefunden`);
      refetch();
    },
    onError: (e: any) => { setScanningId(null); toast.error(e.message); },
  });

  const scanAllMutation = trpc.automation.runScan.useMutation({
    onSuccess: (data: any) => {
      setScanningAll(false);
      toast.success(`Alle ${data.scanned ?? 0} Konkurrenten gescannt – ${data.totalNewAds ?? 0} neue Ads gefunden`);
      refetch();
    },
    onError: (e: any) => { setScanningAll(false); toast.error(e.message); },
  });

  const handleScan = (id: number) => {
    setScanningId(id);
    const competitor = competitors?.find(c => c.id === id);
    scanMutation.mutate({ competitorId: id, query: competitor?.pageName || competitor?.name || "ads" });
  };

  const handleScanAll = () => {
    setScanningAll(true);
    scanAllMutation.mutate();
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

  const activeCount = competitors?.filter(c => c.isActive).length || 0;
  const totalAds = competitors?.reduce((sum, c) => sum + (c.totalAdsFound || 0), 0) || 0;
  const newAds = competitors?.reduce((sum, c) => sum + (c.newAdsSinceLastScan || 0), 0) || 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Konkurrenten-Monitor</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Verfolge Konkurrenten täglich und extrahiere automatisch ihre Ad-Skripte
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleScanAll}
              disabled={scanningAll || activeCount === 0}
              className="gap-2"
            >
              {scanningAll ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Alle scannen
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Konkurrent hinzufügen
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Neuer Konkurrent</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      placeholder="z.B. Nike, Adidas, Konkurrent GmbH"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Facebook Page ID</Label>
                      <Input
                        placeholder="123456789"
                        value={form.pageId}
                        onChange={e => setForm(f => ({ ...f, pageId: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Page Name (für Suche)</Label>
                      <Input
                        placeholder="Nike Official"
                        value={form.pageName}
                        onChange={e => setForm(f => ({ ...f, pageName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Land</Label>
                      <Select value={form.country} onValueChange={v => setForm(f => ({ ...f, country: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Ad-Sprache</Label>
                      <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notizen</Label>
                    <Textarea
                      placeholder="Besonderheiten, Fokus-Themen..."
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createMutation.mutate(form)}
                    disabled={!form.name || createMutation.isPending}
                  >
                    {createMutation.isPending ? "Wird hinzugefügt..." : "Hinzufügen"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{activeCount}</p>
                  <p className="text-xs text-muted-foreground">Aktive Konkurrenten</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{totalAds}</p>
                  <p className="text-xs text-muted-foreground">Ads insgesamt</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{newAds}</p>
                  <p className="text-xs text-muted-foreground">Neue Ads (letzter Scan)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Competitors List */}
        <div className="space-y-3">
          {!competitors || competitors.length === 0 ? (
            <Card className="bg-card border-border border-dashed">
              <CardContent className="py-12 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Noch keine Konkurrenten</p>
                  <p className="text-xs text-muted-foreground mt-1">Füge Konkurrenten hinzu, um ihre Ads täglich zu überwachen</p>
                </div>
                <Button size="sm" onClick={() => setAddOpen(true)} className="gap-2 mt-1">
                  <Plus className="w-4 h-4" />
                  Ersten Konkurrenten hinzufügen
                </Button>
              </CardContent>
            </Card>
          ) : (
            competitors.map(competitor => (
              <Card key={competitor.id} className={`bg-card border-border transition-colors ${!competitor.isActive ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${competitor.isActive ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground text-sm">{competitor.name}</span>
                          {competitor.pageName && competitor.pageName !== competitor.name && (
                            <span className="text-xs text-muted-foreground">({competitor.pageName})</span>
                          )}
                          <Badge variant="outline" className="text-xs py-0">
                            <Globe className="w-3 h-3 mr-1" />
                            {competitor.country}
                          </Badge>
                          <Badge variant="outline" className="text-xs py-0">{competitor.language}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{competitor.totalAdsFound || 0} Ads gefunden</span>
                          {competitor.newAdsSinceLastScan > 0 && (
                            <span className="text-emerald-400">+{competitor.newAdsSinceLastScan} neu</span>
                          )}
                          {competitor.lastScannedAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(competitor.lastScannedAt).toLocaleDateString("de-DE")}
                            </span>
                          )}
                          {competitor.notes && (
                            <span className="truncate max-w-[200px]">{competitor.notes}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleScan(competitor.id)}
                        disabled={scanningId === competitor.id || !competitor.isActive}
                        className="gap-1.5 h-8"
                      >
                        {scanningId === competitor.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                        Scannen
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleMutation.mutate({ id: competitor.id, isActive: !competitor.isActive })}
                        className="h-8 w-8 p-0"
                        title={competitor.isActive ? "Deaktivieren" : "Aktivieren"}
                      >
                        {competitor.isActive ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate({ id: competitor.id })}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Scan Logs */}
        {scanLogs && scanLogs.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Letzte Scan-Aktivitäten</h2>
            <div className="space-y-2">
              {scanLogs.slice(0, 8).map(log => (
                <div key={log.id} className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${log.status === "completed" ? "bg-emerald-400" : log.status === "failed" ? "bg-red-400" : "bg-amber-400 animate-pulse"}`} />
                    <span className="text-foreground">{log.competitorName || "Alle"}</span>
                    {log.status === "completed" && (
                      <span className="text-muted-foreground">{log.adsFound} Ads, {log.newAds} neu</span>
                    )}
                    {log.status === "failed" && (
                      <span className="text-red-400">{log.errorMessage?.substring(0, 50)}</span>
                    )}
                  </div>
                  <span className="text-muted-foreground">
                    {new Date(log.startedAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
