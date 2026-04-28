import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Unplug,
  Facebook,
  ShieldCheck,
  MessageSquare,
  BarChart2,
  Eye,
  Users,
  Instagram,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation } from "wouter";

const PERMISSIONS = [
  { icon: BarChart2, label: "ads_management", desc: "Kampagnen & Ads verwalten" },
  { icon: Eye, label: "ads_read", desc: "Ad-Performance lesen" },
  { icon: MessageSquare, label: "pages_read_engagement", desc: "Kommentare & Reaktionen lesen" },
  { icon: ShieldCheck, label: "pages_manage_engagement", desc: "Kommentare beantworten & verstecken" },
  { icon: Users, label: "pages_show_list", desc: "Verbundene Seiten anzeigen" },
  { icon: Instagram, label: "instagram_basic", desc: "Instagram-Konto verknüpfen" },
  { icon: MessageSquare, label: "instagram_manage_comments", desc: "Instagram-Kommentare verwalten" },
];

export default function MetaConnect() {
  const utils = trpc.useUtils();
  const [location] = useLocation();
  const { data: connection, isLoading: loadingConn } = trpc.meta.getConnection.useQuery();
  const [oauthStatus, setOauthStatus] = useState<{ connected: boolean; pageName?: string; adAccountName?: string; scopes?: string } | null>(null);
  const [checkingOAuth, setCheckingOAuth] = useState(false);

  // Account selection state
  const [choosingAccount, setChoosingAccount] = useState(false);
  const [pendingData, setPendingData] = useState("");
  const [availableAccounts, setAvailableAccounts] = useState<{id: string; name: string}[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);

  // Check OAuth status on mount + after redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const page = params.get("page");
    const account = params.get("account");
    if (success === "1") {
      toast.success(`✅ Meta verbunden! Seite: ${page || "–"}, Account: ${account || "–"}`);
      window.history.replaceState({}, "", "/connect");
      utils.meta.getConnection.invalidate();
    }
    const error = params.get("error");
    if (error) {
      toast.error(`Fehler beim Verbinden: ${decodeURIComponent(error)}`);
      window.history.replaceState({}, "", "/connect");
    }
    // Account selection mode
    const choose = params.get("choose");
    const pending = params.get("pending");
    if (choose === "1" && pending) {
      try {
        const data = JSON.parse(atob(pending.replace(/-/g, "+").replace(/_/g, "/")));
        setAvailableAccounts(data.allAccounts || []);
        setPendingData(pending);
        setSelectedAccountId(data.allAccounts?.[0]?.id || "");
        setChoosingAccount(true);
        window.history.replaceState({}, "", "/connect");
      } catch { toast.error("Fehler beim Laden der Accounts"); }
    }
  }, [location]);

  const handleSaveAccount = async () => {
    if (!selectedAccountId || !pendingData) return;
    setSavingAccount(true);
    try {
      const res = await fetch("/api/meta/oauth/select-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pending: pendingData, adAccountId: selectedAccountId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`✅ Verbunden mit: ${data.adAccountName}`);
      setChoosingAccount(false);
      utils.meta.getConnection.invalidate();
      // Refresh OAuth status
      fetch("/api/meta/oauth/status").then(r => r.json()).then(d => setOauthStatus(d));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingAccount(false);
    }
  };

  // Fetch live OAuth status
  useEffect(() => {
    setCheckingOAuth(true);
    fetch("/api/meta/oauth/status")
      .then((r) => r.json())
      .then((d) => setOauthStatus(d))
      .catch(() => setOauthStatus({ connected: false }))
      .finally(() => setCheckingOAuth(false));
  }, [connection]);

  const handleOAuthConnect = () => {
    const origin = window.location.origin;
    window.location.href = `/api/meta/oauth/start?origin=${encodeURIComponent(origin)}`;
  };

  const disconnectMutation = trpc.meta.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Meta Verbindung getrennt");
      utils.meta.getConnection.invalidate();
      setOauthStatus({ connected: false });
    },
    onError: (err) => toast.error(err.message),
  });

  const syncCampaignsMutation = trpc.meta.syncCampaigns.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.synced} Kampagnen synchronisiert`);
      utils.analytics.getCampaigns.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const syncAdsMutation = trpc.meta.syncAds.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.synced} Ads synchronisiert`);
      utils.analytics.getAds.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const isConnected = oauthStatus?.connected || !!connection;
  const grantedScopes = oauthStatus?.scopes?.split(",").filter(Boolean) ?? [];

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Meta Verbindung</h1>
          <p className="text-sm text-muted-foreground">
            Verbinde Facebook & Instagram über OAuth – alle Berechtigungen werden automatisch angefordert.
          </p>
        </div>

        {/* Status Card */}
        {loadingConn || checkingOAuth ? (
          <Card className="bg-card border-border/50 mb-6">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Verbindungsstatus wird geprüft...</span>
              </div>
            </CardContent>
          </Card>
        ) : isConnected ? (
          <Card className="bg-card border-emerald-500/30 mb-6">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Verbunden</p>
                    <p className="text-xs text-muted-foreground">
                      {oauthStatus?.pageName && `Seite: ${oauthStatus.pageName} · `}
                      {oauthStatus?.adAccountName || connection?.adAccountName || connection?.adAccountId}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">Aktiv</Badge>
              </div>

              {/* Granted Scopes */}
              {grantedScopes.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Erteilte Berechtigungen:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {grantedScopes.map((scope) => (
                      <Badge key={scope} variant="secondary" className="text-xs font-mono">
                        ✓ {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 border-t border-border/50 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => syncCampaignsMutation.mutate()} disabled={syncCampaignsMutation.isPending} className="border-border/50">
                  {syncCampaignsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
                  Kampagnen sync
                </Button>
                <Button size="sm" variant="outline" onClick={() => syncAdsMutation.mutate()} disabled={syncAdsMutation.isPending} className="border-border/50">
                  {syncAdsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
                  Ads sync (30d)
                </Button>
                <Button size="sm" variant="outline" onClick={handleOAuthConnect} className="border-border/50">
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  Neu verbinden
                </Button>
                <Button size="sm" variant="ghost" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending} className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto">
                  {disconnectMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Unplug className="h-3.5 w-3.5 mr-2" />}
                  Trennen
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Alert className="mb-6 border-amber-500/30 bg-amber-500/5">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-300/80 text-sm">
              Noch nicht verbunden. Klicke unten auf "Mit Meta verbinden" um alle Berechtigungen zu erteilen.
            </AlertDescription>
          </Alert>
        )}

        {/* Account Selection Dialog */}
        {choosingAccount && (
          <Card className="bg-card border-primary/30 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />
                Ad Account auswählen
              </CardTitle>
              <CardDescription>
                Wähle den Ad Account den du mit dieser App verbinden möchtest.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {availableAccounts.map((acc) => (
                <div
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedAccountId === acc.id
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/50 hover:border-border"
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                    selectedAccountId === acc.id ? "border-primary" : "border-muted-foreground"
                  }`}>
                    {selectedAccountId === acc.id && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{acc.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{acc.id}</p>
                  </div>
                </div>
              ))}
              <Button
                onClick={handleSaveAccount}
                disabled={!selectedAccountId || savingAccount}
                className="w-full mt-2"
              >
                {savingAccount ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Diesen Account verbinden
              </Button>
            </CardContent>
          </Card>
        )}

        {/* OAuth Connect Button */}
        {!isConnected && !choosingAccount && (
          <Card className="bg-card border-border/50 mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Facebook className="h-4 w-4 text-[#1877F2]" />
                Mit Meta verbinden (OAuth)
              </CardTitle>
              <CardDescription>
                Ein Klick – du wirst zu Facebook weitergeleitet und kannst alle Berechtigungen erteilen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleOAuthConnect} className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" size="lg">
                <Facebook className="h-4 w-4 mr-2" />
                Mit Meta verbinden
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Du wirst zu Facebook weitergeleitet. Bitte melde dich mit deinem Business-Account an.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Permissions Overview */}
        <Card className="bg-card border-border/50 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Angeforderte Berechtigungen
            </CardTitle>
            <CardDescription className="text-xs">
              Diese Berechtigungen werden beim Verbinden angefordert, damit alle Funktionen verfügbar sind.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {PERMISSIONS.map(({ icon: Icon, label, desc }) => {
                const granted = grantedScopes.includes(label);
                return (
                  <div key={label} className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${granted ? "bg-emerald-400/10 border border-emerald-400/20" : "bg-muted/50 border border-border/50"}`}>
                      <Icon className={`h-4 w-4 ${granted ? "text-emerald-400" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-mono font-medium">{label}</p>
                        {granted && <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 text-xs py-0">✓ Erteilt</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Requirements */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Voraussetzungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { step: "1", title: "Meta App erstellen", desc: "Erstelle eine App unter developers.facebook.com (Typ: Business).", link: "https://developers.facebook.com" },
              { step: "2", title: "META_APP_ID & META_APP_SECRET setzen", desc: "Trage App ID und App Secret in den Einstellungen → Secrets ein.", link: null },
              { step: "3", title: "Redirect URI konfigurieren", desc: `Füge folgende URI in deiner Meta App unter OAuth-Einstellungen hinzu: ${window.location.origin}/api/meta/oauth/callback`, link: null },
              { step: "4", title: "Mit Meta verbinden", desc: "Klicke oben auf 'Mit Meta verbinden' und erteile alle Berechtigungen.", link: null },
            ].map((item) => (
              <div key={item.step} className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">{item.step}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 break-all">{item.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
