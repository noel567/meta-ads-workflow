import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Key, Plus, Trash2, Copy, Check, ExternalLink, Eye, EyeOff, Shield } from "lucide-react";

export default function ApiKeys() {
  const [newKeyName, setNewKeyName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<{ key: string; name: string } | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revokeId, setRevokeId] = useState<number | null>(null);

  const { data: keys = [], refetch } = trpc.apiKeys.list.useQuery();

  const createMutation = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      setNewKeyResult({ key: data.key, name: data.name });
      setNewKeyName("");
      refetch();
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });

  const revokeMutation = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => {
      toast.success("API-Key widerrufen");
      setRevokeId(null);
      refetch();
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });

  function handleCreate() {
    if (!newKeyName.trim()) return;
    createMutation.mutate({ name: newKeyName.trim() });
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setCopiedKey(true);
    toast.success("API-Key kopiert");
    setTimeout(() => setCopiedKey(false), 2000);
  }

  const baseUrl = window.location.origin;

  const endpoints = [
    { method: "GET", path: "/api/v1/me", desc: "Eigene Key-Infos" },
    { method: "GET", path: "/api/v1/campaigns", desc: "Alle Meta-Kampagnen" },
    { method: "GET", path: "/api/v1/ads", desc: "Alle Meta-Ads" },
    { method: "GET", path: "/api/v1/competitors", desc: "Konkurrenten" },
    { method: "GET", path: "/api/v1/competitor-ads", desc: "Konkurrenz-Ads" },
    { method: "GET", path: "/api/v1/batches", desc: "Ad-Batches" },
    { method: "GET", path: "/api/v1/transcripts", desc: "Transkripte" },
    { method: "GET", path: "/api/v1/budget-rules", desc: "Budget-Regeln" },
    { method: "GET", path: "/api/v1/budget-rule-executions", desc: "Regelausführungen" },
    { method: "GET", path: "/api/v1/heygen-videos", desc: "HeyGen-Videos" },
    { method: "GET", path: "/api/v1/video-research", desc: "Video Research" },
    { method: "GET", path: "/api/v1/telegram-posts", desc: "Telegram-Posts" },
    { method: "GET", path: "/api/v1/drive-uploads", desc: "Drive-Uploads" },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Key className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">API-Keys</h1>
            <p className="text-muted-foreground text-sm">
              Erstelle API-Keys für externe Dienste wie Operclaw
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Neuer API-Key
        </Button>
      </div>

      {/* Aktive Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-400" />
            Aktive API-Keys
          </CardTitle>
          <CardDescription>
            Jeder Key gewährt Lesezugriff auf alle deine Daten. Gib Keys nur an vertrauenswürdige Dienste weiter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Noch keine API-Keys erstellt.</p>
              <p className="text-sm mt-1">Klicke auf "Neuer API-Key" um loszulegen.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{k.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{k.keyPreview}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <Badge variant="outline" className="text-green-400 border-green-400/30 bg-green-400/10">
                        Aktiv
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        Erstellt: {new Date(k.createdAt).toLocaleDateString("de-CH")}
                      </p>
                      {k.lastUsedAt && (
                        <p className="text-xs text-muted-foreground">
                          Zuletzt: {new Date(k.lastUsedAt).toLocaleDateString("de-CH")}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRevokeId(k.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API-Dokumentation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-blue-400" />
            API-Dokumentation
          </CardTitle>
          <CardDescription>
            Basis-URL: <code className="text-xs bg-muted px-1 py-0.5 rounded">{baseUrl}/api/v1</code>
            <br />
            Authentifizierung: <code className="text-xs bg-muted px-1 py-0.5 rounded">Authorization: Bearer &lt;api_key&gt;</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">Alle Endpunkte geben JSON zurück: <code className="bg-muted px-1 rounded">{"{ ok: true, data: [...] }"}</code></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {endpoints.map((ep) => (
                <div key={ep.path} className="flex items-center gap-2 p-2 rounded border border-border bg-muted/20 text-xs">
                  <Badge variant="outline" className="text-green-400 border-green-400/30 shrink-0 text-[10px]">
                    {ep.method}
                  </Badge>
                  <code className="text-blue-400 truncate">{ep.path}</code>
                  <span className="text-muted-foreground shrink-0 hidden sm:block">— {ep.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Beispiel-Request */}
          <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Beispiel-Request (curl):</p>
            <pre className="text-xs text-green-400 overflow-x-auto whitespace-pre-wrap break-all">
{`curl -H "Authorization: Bearer maw_xxxx..." \\
  ${baseUrl}/api/v1/campaigns`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Dialog: Neuen Key erstellen */}
      <Dialog open={createDialogOpen} onOpenChange={(o) => { setCreateDialogOpen(o); if (!o) setNewKeyResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen API-Key erstellen</DialogTitle>
            <DialogDescription>
              Gib dem Key einen Namen (z.B. "Operclaw") um ihn später identifizieren zu können.
            </DialogDescription>
          </DialogHeader>

          {!newKeyResult ? (
            <>
              <div className="space-y-3 py-2">
                <Input
                  placeholder="z.B. Operclaw, Zapier, n8n..."
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Abbrechen</Button>
                <Button
                  onClick={handleCreate}
                  disabled={!newKeyName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? "Erstelle..." : "Erstellen"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-sm font-medium text-green-400 mb-1">✓ API-Key erstellt: {newKeyResult.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Kopiere den Key jetzt — er wird nur einmal angezeigt und kann danach nicht mehr eingesehen werden.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Dein API-Key:</label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        readOnly
                        value={keyVisible ? newKeyResult.key : "•".repeat(40)}
                        className="font-mono text-xs pr-10"
                      />
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setKeyVisible(!keyVisible)}
                      >
                        {keyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyKey(newKeyResult.key)}
                    >
                      {copiedKey ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setCreateDialogOpen(false); setNewKeyResult(null); }}>
                  Fertig
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Key widerrufen */}
      <AlertDialog open={revokeId !== null} onOpenChange={(o) => !o && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>API-Key widerrufen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Key wird sofort deaktiviert. Dienste die diesen Key verwenden verlieren sofort den Zugriff. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => revokeId !== null && revokeMutation.mutate({ id: revokeId })}
            >
              Widerrufen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
