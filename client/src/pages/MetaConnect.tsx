import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Loader2,
  Plug,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MetaConnect() {
  const utils = trpc.useUtils();
  const { data: connection, isLoading: loadingConn } = trpc.meta.getConnection.useQuery();

  const [accessToken, setAccessToken] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [appId, setAppId] = useState("");

  const connectMutation = trpc.meta.connect.useMutation({
    onSuccess: (data) => {
      toast.success(`Verbunden mit "${data.adAccountName}"`);
      utils.meta.getConnection.invalidate();
      utils.dashboard.stats.invalidate();
      setAccessToken("");
      setAdAccountId("");
      setAppId("");
    },
    onError: (err) => toast.error(err.message),
  });

  const disconnectMutation = trpc.meta.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Meta Verbindung getrennt");
      utils.meta.getConnection.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const syncCampaignsMutation = trpc.meta.syncCampaigns.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} Kampagnen synchronisiert`);
      utils.analytics.getCampaigns.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const syncAdsMutation = trpc.meta.syncAds.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} Ads synchronisiert`);
      utils.analytics.getAds.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleConnect = () => {
    if (!accessToken.trim() || !adAccountId.trim()) {
      toast.error("Bitte Access Token und Ad Account ID eingeben");
      return;
    }
    connectMutation.mutate({ accessToken, adAccountId, appId: appId || undefined });
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Meta Verbindung</h1>
          <p className="text-sm text-muted-foreground">
            Verbinde deinen Meta Ads Manager über die Marketing API.
          </p>
        </div>

        {/* Connection Status */}
        {loadingConn ? (
          <Card className="bg-card border-border/50 mb-6">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Verbindungsstatus wird geladen...</span>
              </div>
            </CardContent>
          </Card>
        ) : connection ? (
          <Card className="bg-card border-emerald-500/30 mb-6">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Verbunden</p>
                    <p className="text-xs text-muted-foreground">
                      {connection.adAccountName || connection.adAccountId}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="badge-active">Aktiv</Badge>
              </div>

              {/* Sync Actions */}
              <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => syncCampaignsMutation.mutate()}
                  disabled={syncCampaignsMutation.isPending}
                  className="border-border/50"
                >
                  {syncCampaignsMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  )}
                  Kampagnen sync
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => syncAdsMutation.mutate()}
                  disabled={syncAdsMutation.isPending}
                  className="border-border/50"
                >
                  {syncAdsMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  )}
                  Ads sync (30d)
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : (
                    <Unplug className="h-3.5 w-3.5 mr-2" />
                  )}
                  Trennen
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Alert className="mb-6 border-amber-500/30 bg-amber-500/5">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-300/80 text-sm">
              Noch keine Verbindung. Verbinde deinen Meta Ad Account, um Kampagnen und Ads zu analysieren.
            </AlertDescription>
          </Alert>
        )}

        {/* Connect Form */}
        {!connection && (
          <Card className="bg-card border-border/50 mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Plug className="h-4 w-4 text-primary" />
                Meta Marketing API verbinden
              </CardTitle>
              <CardDescription>
                Gib deinen Access Token und die Ad Account ID ein.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accessToken" className="text-sm">
                  Access Token <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="accessToken"
                  type="password"
                  placeholder="EAAxxxxxxxxxxxxxxxx..."
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="bg-input border-border/50 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Dein Meta User Access Token oder System User Token mit ads_read Berechtigung.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adAccountId" className="text-sm">
                  Ad Account ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="adAccountId"
                  placeholder="123456789 oder act_123456789"
                  value={adAccountId}
                  onChange={(e) => setAdAccountId(e.target.value)}
                  className="bg-input border-border/50 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Zu finden im Meta Business Manager unter "Ad Accounts".
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appId" className="text-sm">
                  App ID <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="appId"
                  placeholder="123456789"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  className="bg-input border-border/50 font-mono text-sm"
                />
              </div>

              <Button
                onClick={handleConnect}
                disabled={connectMutation.isPending || !accessToken || !adAccountId}
                className="w-full"
              >
                {connectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plug className="h-4 w-4 mr-2" />
                )}
                Verbinden & validieren
              </Button>
            </CardContent>
          </Card>
        )}

        {/* How to get credentials */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Wie erhalte ich meine Zugangsdaten?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                step: "1",
                title: "Meta for Developers öffnen",
                desc: "Gehe zu developers.facebook.com und erstelle eine App (Typ: Business).",
                link: "https://developers.facebook.com",
              },
              {
                step: "2",
                title: "Marketing API aktivieren",
                desc: "Füge das Produkt 'Marketing API' zu deiner App hinzu.",
                link: null,
              },
              {
                step: "3",
                title: "Access Token generieren",
                desc: "Nutze den Graph API Explorer, um einen Token mit ads_read, ads_management Berechtigung zu erstellen.",
                link: "https://developers.facebook.com/tools/explorer",
              },
              {
                step: "4",
                title: "Ad Account ID finden",
                desc: "Im Meta Business Manager unter Einstellungen → Ad Accounts findest du deine Account ID.",
                link: "https://business.facebook.com/settings/ad-accounts",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">{item.step}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
