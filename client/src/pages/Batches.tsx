import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import HookGenerator from "@/components/HookGenerator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  Sparkles, Copy, Trash2, FileText, Video, Upload, CheckCircle2,
  ChevronDown, ChevronUp, Zap, Clock, ExternalLink, BookOpen, Pencil, Save, X,
  Play, Loader2, CheckCircle, AlertCircle
} from "lucide-react";
import { useLocation } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  ready: "bg-primary/10 text-primary",
  exported: "bg-emerald-500/10 text-emerald-400",
  used: "bg-purple-500/10 text-purple-400",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  ready: "Bereit",
  exported: "Exportiert",
  used: "Verwendet",
};

export default function Batches() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [adText, setAdText] = useState("");
  const [competitorName, setCompetitorName] = useState("");
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ body: string; cta: string; hook1: string; hook2: string; hook3: string; heygenScript: string }>({ body: "", cta: "", hook1: "", hook2: "", hook3: "", heygenScript: "" });

  // HeyGen state
  const [heygenDialogOpen, setHeygenDialogOpen] = useState(false);
  const [heygenBatch, setHeygenBatch] = useState<{ id: number; title: string; script: string } | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState("");
  const [selectedAvatarName, setSelectedAvatarName] = useState("");
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [selectedVoiceName, setSelectedVoiceName] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [videoStatusId, setVideoStatusId] = useState<string | null>(null);

  const { data: batches, refetch } = trpc.batches.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: driveConnection } = trpc.googleDrive.getConnection.useQuery(undefined, { enabled: isAuthenticated });

  // HeyGen queries
  const { data: avatars, isLoading: avatarsLoading } = trpc.heygen.getAvatars.useQuery(undefined, { enabled: heygenDialogOpen && isAuthenticated });
  const { data: voices, isLoading: voicesLoading } = trpc.heygen.getVoices.useQuery(undefined, { enabled: heygenDialogOpen && isAuthenticated });
  const { data: videoStatus, refetch: refetchStatus } = trpc.heygen.getVideoStatus.useQuery(
    { heygenVideoId: videoStatusId! },
    { enabled: !!videoStatusId && isAuthenticated, refetchInterval: videoStatusId ? 5000 : false }
  );

  const generateMutation = trpc.batches.generate.useMutation({
    onSuccess: () => {
      toast.success("Batch erfolgreich generiert!");
      setGenerateOpen(false);
      setAdText("");
      setCompetitorName("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.batches.delete.useMutation({
    onSuccess: () => { toast.success("Batch gelöscht"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const exportTranscriptMutation = trpc.transcripts.create.useMutation({
    onSuccess: () => {
      toast.success("Als Transkript gespeichert – jetzt im Teleprompter verfügbar!");
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = trpc.batches.update.useMutation({
    onSuccess: () => {
      toast.success("Batch gespeichert!");
      setEditingId(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const createVideoMutation = trpc.heygen.createVideo.useMutation({
    onSuccess: (data) => {
      toast.success("Video wird bei HeyGen erstellt! Status wird automatisch aktualisiert.");
      setVideoStatusId(data.heygenVideoId);
      setHeygenDialogOpen(false);
      refetch();
    },
    onError: (e) => toast.error(`HeyGen Fehler: ${e.message}`),
  });

  const openHeygenDialog = (batch: { id: number; title: string; heygenScript?: string | null; hook1?: string | null; body?: string | null; cta?: string | null }) => {
    const script = batch.heygenScript || `${batch.hook1 || ""}

${batch.body || ""}

${batch.cta || ""}`;
    setHeygenBatch({ id: batch.id, title: batch.title, script });
    setSelectedAvatarId("");
    setSelectedAvatarName("");
    setSelectedVoiceId("");
    setSelectedVoiceName("");
    setHeygenDialogOpen(true);
  };

  const uploadDriveMutation = trpc.googleDrive.uploadBatch.useMutation({
    onSuccess: (data) => {
      setUploadingId(null);
      toast.success(
        <div className="flex flex-col gap-1">
          <span>Zu Google Drive hochgeladen!</span>
          {data.webViewLink && (
            <a href={data.webViewLink} target="_blank" rel="noopener noreferrer" className="text-xs underline">
              Datei öffnen →
            </a>
          )}
        </div>
      );
      refetch();
    },
    onError: (e) => { setUploadingId(null); toast.error(e.message); },
  });

  const startEdit = (batch: { id: number; body?: string | null; cta?: string | null; hook1?: string | null; hook2?: string | null; hook3?: string | null; heygenScript?: string | null }) => {
    setEditingId(batch.id);
    setEditForm({
      body: batch.body || "",
      cta: batch.cta || "",
      hook1: batch.hook1 || "",
      hook2: batch.hook2 || "",
      hook3: batch.hook3 || "",
      heygenScript: batch.heygenScript || "",
    });
  };

  const saveEdit = (id: number) => {
    updateMutation.mutate({ id, ...editForm });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopiert!`);
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

  const readyBatches = batches?.filter(b => b.status === "ready").length || 0;
  const exportedBatches = batches?.filter(b => b.status === "exported").length || 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Ad-Batch Generator</h1>
            <p className="text-sm text-muted-foreground mt-1">
              KI generiert automatisch Body + CTA + 3 Hooks im Easy Signals Stil
            </p>
          </div>
          <Button onClick={() => setGenerateOpen(true)} className="gap-2">
            <Sparkles className="w-4 h-4" />
            Neuen Batch generieren
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{batches?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Batches gesamt</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{readyBatches}</p>
                  <p className="text-xs text-muted-foreground">Bereit zur Nutzung</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{exportedBatches}</p>
                  <p className="text-xs text-muted-foreground">Exportiert</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Batches List */}
        <div className="space-y-3">
          {!batches || batches.length === 0 ? (
            <Card className="bg-card border-border border-dashed">
              <CardContent className="py-12 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Noch keine Batches</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Generiere deinen ersten Batch aus einem Konkurrenz-Ad oder manuell
                  </p>
                </div>
                <Button size="sm" onClick={() => setGenerateOpen(true)} className="gap-2 mt-1">
                  <Sparkles className="w-4 h-4" />
                  Ersten Batch generieren
                </Button>
              </CardContent>
            </Card>
          ) : (
            batches.map(batch => (
              <Card key={batch.id} className="bg-card border-border">
                <CardContent className="p-4">
                  {/* Batch Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground text-sm">{batch.title}</span>
                          <Badge className={`text-xs py-0 px-2 ${STATUS_COLORS[batch.status || "draft"]}`}>
                            {STATUS_LABELS[batch.status || "draft"]}
                          </Badge>
                          {batch.competitorName && (
                            <span className="text-xs text-muted-foreground">von {batch.competitorName}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(batch.generatedAt).toLocaleDateString("de-DE")}
                          </span>
                          {batch.language && <span>{batch.language.toUpperCase()}</span>}
                          {batch.googleDriveUrl && (
                            <a href={batch.googleDriveUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-emerald-400 hover:underline">
                              <ExternalLink className="w-3 h-3" />
                              Google Drive
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* HeyGen Video erstellen */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                        onClick={() => openHeygenDialog(batch)}
                        title="Video mit HeyGen Avatar erstellen"
                      >
                        <Video className="w-3.5 h-3.5" />
                        HeyGen
                      </Button>
                      {/* Export to Teleprompter */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => exportTranscriptMutation.mutate({ title: `${batch.title} – Teleprompter`, content: batch.hook1 || batch.body || "", sourceType: "batch", sourceId: batch.id })}
                        disabled={exportTranscriptMutation.isPending}
                        title="Als Transkript speichern (Hook 1)"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Teleprompter
                      </Button>
                      {/* Upload to Drive */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => {
                          setUploadingId(batch.id);
                          uploadDriveMutation.mutate({ batchId: batch.id });
                        }}
                        disabled={uploadingId === batch.id}
                        title="Zu Google Drive hochladen"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Drive
                      </Button>
                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => editingId === batch.id ? setEditingId(null) : startEdit(batch)}
                        title="Batch bearbeiten"
                      >
                        {editingId === batch.id ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                      </Button>
                      {/* Expand */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setExpandedId(expandedId === batch.id ? null : batch.id)}
                      >
                        {expandedId === batch.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate({ id: batch.id })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Edit Form */}
                  {editingId === batch.id && (
                    <div className="mt-4 border-t border-border pt-4 space-y-3">
                      <p className="text-xs font-medium text-primary">Batch bearbeiten</p>
                      {([
                        { key: "hook1", label: "Hook 1 – Neugier" },
                        { key: "hook2", label: "Hook 2 – Problem/Schmerz" },
                        { key: "hook3", label: "Hook 3 – Ergebnis" },
                        { key: "body", label: "Body" },
                        { key: "cta", label: "CTA" },
                        { key: "heygenScript", label: "HeyGen Skript" },
                      ] as const).map(({ key, label }) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{label}</Label>
                          <Textarea
                            value={editForm[key]}
                            onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                            rows={key === "body" || key === "heygenScript" ? 4 : 2}
                            className="text-sm resize-none"
                          />
                        </div>
                      ))}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => saveEdit(batch.id)}
                          disabled={updateMutation.isPending}
                        >
                          <Save className="w-3.5 h-3.5" />
                          {updateMutation.isPending ? "Speichert..." : "Speichern"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Abbrechen</Button>
                      </div>
                    </div>
                  )}

                  {/* Expanded Content */}
                  {expandedId === batch.id && (
                    <div className="mt-4 border-t border-border pt-4">
                      <Tabs defaultValue="hooks">
                        <TabsList className="h-8 mb-4">
                          <TabsTrigger value="hooks" className="text-xs">3 Hooks</TabsTrigger>
                          <TabsTrigger value="body" className="text-xs">Body</TabsTrigger>
                          <TabsTrigger value="cta" className="text-xs">CTA</TabsTrigger>
                          <TabsTrigger value="heygen" className="text-xs">HeyGen Skript</TabsTrigger>
                          <TabsTrigger value="hookgen" className="text-xs text-primary">✦ Neue Hooks</TabsTrigger>
                          {batch.sourceAdText && <TabsTrigger value="source" className="text-xs">Quelle</TabsTrigger>}
                        </TabsList>

                        <TabsContent value="hooks" className="space-y-3 mt-0">
                          {[
                            { label: "Hook 1 – Neugier", text: batch.hook1, index: 0 },
                            { label: "Hook 2 – Problem/Schmerz", text: batch.hook2, index: 1 },
                            { label: "Hook 3 – Ergebnis/Transformation", text: batch.hook3, index: 2 },
                          ].map(({ label, text, index }) => (
                            <div key={index} className="rounded-lg bg-muted/30 border border-border p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-primary">{label}</span>
                                <div className="flex gap-1.5">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => copyToClipboard(text || "", label)}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs px-2 gap-1"
                                    onClick={() => exportTranscriptMutation.mutate({ title: `${batch.title} – Hook ${index + 1}`, content: text || "", sourceType: "batch", sourceId: batch.id })}
                                  >
                                    <BookOpen className="w-3 h-3" />
                                    Teleprompter
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm text-foreground leading-relaxed">{text}</p>
                            </div>
                          ))}
                        </TabsContent>

                        <TabsContent value="body" className="mt-0">
                          <div className="rounded-lg bg-muted/30 border border-border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-muted-foreground">Body</span>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(batch.body || "", "Body")}>
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{batch.body}</p>
                          </div>
                        </TabsContent>

                        <TabsContent value="cta" className="mt-0">
                          <div className="rounded-lg bg-muted/30 border border-border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-muted-foreground">Call-to-Action</span>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(batch.cta || "", "CTA")}>
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed font-medium">{batch.cta}</p>
                          </div>
                        </TabsContent>

                        <TabsContent value="heygen" className="mt-0">
                          <div className="rounded-lg bg-muted/30 border border-border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="text-xs font-medium text-purple-400">HeyGen Avatar Skript</span>
                                <p className="text-xs text-muted-foreground">Direkt senden oder manuell kopieren – [PAUSE] = natürliche Pausen</p>
                              </div>
                              <div className="flex gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1.5 text-xs px-2"
                                  onClick={() => copyToClipboard(batch.heygenScript || `${batch.hook1}\n\n${batch.body}\n\n${batch.cta}`, "HeyGen Skript")}
                                >
                                  <Copy className="w-3 h-3" />
                                  Kopieren
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 gap-1.5 text-xs px-2 bg-purple-600 hover:bg-purple-700 text-white"
                                  onClick={() => openHeygenDialog(batch)}
                                >
                                  <Play className="w-3 h-3" />
                                  Video erstellen
                                </Button>
                              </div>
                            </div>
                            <pre className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                              {batch.heygenScript || `${batch.hook1}\n\n${batch.body}\n\n${batch.cta}`}
                            </pre>
                          </div>
                          <div className="mt-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                            <p className="text-xs text-purple-300 font-medium mb-2">🎬 Direkt an HeyGen senden</p>
                            <p className="text-xs text-muted-foreground mb-2">Klicke auf "Video erstellen" um Avatar und Stimme auszuwählen und das Video direkt zu generieren.</p>
                            <Button
                              size="sm"
                              className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                              onClick={() => openHeygenDialog(batch)}
                            >
                              <Video className="w-3.5 h-3.5" />
                              An HeyGen senden
                            </Button>
                          </div>
                        </TabsContent>

                        <TabsContent value="hookgen" className="mt-0">
                          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                            <div className="flex items-center gap-2 mb-4">
                              <Sparkles className="w-4 h-4 text-primary" />
                              <span className="text-sm font-semibold">Neue Hooks generieren</span>
                              <span className="text-xs text-muted-foreground">– KI erstellt 3 frische Hooks für diesen Batch</span>
                            </div>
                            <HookGenerator
                              initialScript={`${batch.hook1 || ""}\n\n${batch.body || ""}\n\n${batch.cta || ""}`}
                              scriptEditable={false}
                              compact
                            />
                          </div>
                        </TabsContent>

                        {batch.sourceAdText && (
                          <TabsContent value="source" className="mt-0">
                            <div className="rounded-lg bg-muted/30 border border-border p-3">
                              <span className="text-xs font-medium text-muted-foreground block mb-2">Original Konkurrenz-Ad</span>
                              <p className="text-sm text-muted-foreground leading-relaxed">{batch.sourceAdText}</p>
                            </div>
                          </TabsContent>
                        )}
                      </Tabs>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* HeyGen Video Dialog */}
        <Dialog open={heygenDialogOpen} onOpenChange={setHeygenDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="w-4 h-4 text-purple-400" />
                Video mit HeyGen erstellen
              </DialogTitle>
            </DialogHeader>
            {heygenBatch && (
              <div className="space-y-4 pt-2">
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                  <p className="text-xs font-medium text-purple-300 mb-1">{heygenBatch.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-3">{heygenBatch.script}</p>
                </div>

                {/* Avatar Auswahl */}
                <div className="space-y-2">
                  <Label className="text-sm">Avatar auswählen</Label>
                  {avatarsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> Avatare werden geladen...
                    </div>
                  ) : avatars && avatars.length > 0 ? (
                    <Select value={selectedAvatarId} onValueChange={(v: string) => {
                      setSelectedAvatarId(v);
                      setSelectedAvatarName(avatars!.find((a: { id: string; name: string }) => a.id === v)?.name || v);
                    }}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Avatar wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {avatars!.map((a: { id: string; name: string }) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <p className="text-xs text-muted-foreground">Kein HeyGen API-Key hinterlegt oder keine Avatare verfügbar.</p>
                      <p className="text-xs text-muted-foreground mt-1">Bitte HeyGen API-Key in den Einstellungen eintragen.</p>
                    </div>
                  )}
                </div>

                {/* Stimme Auswahl */}
                <div className="space-y-2">
                  <Label className="text-sm">Stimme auswählen</Label>
                  {voicesLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> Stimmen werden geladen...
                    </div>
                  ) : voices && voices.length > 0 ? (
                    <Select value={selectedVoiceId} onValueChange={(v: string) => {
                      setSelectedVoiceId(v);
                      setSelectedVoiceName(voices!.find((vo: { id: string; name: string }) => vo.id === v)?.name || v);
                    }}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Stimme wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {voices!.map((v: { id: string; name: string; language?: string; gender?: string | null }) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name} {v.language ? `(${v.language})` : ""} {v.gender ? `· ${v.gender}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground">Keine Stimmen verfügbar.</p>
                  )}
                </div>

                {/* Format */}
                <div className="space-y-2">
                  <Label className="text-sm">Format</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={aspectRatio === "9:16" ? "default" : "outline"}
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => setAspectRatio("9:16")}
                    >
                      9:16 (Vertikal / Reels)
                    </Button>
                    <Button
                      variant={aspectRatio === "16:9" ? "default" : "outline"}
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => setAspectRatio("16:9")}
                    >
                      16:9 (Horizontal)
                    </Button>
                  </div>
                </div>

                <Button
                  className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => createVideoMutation.mutate({
                    script: heygenBatch.script,
                    avatarId: selectedAvatarId,
                    avatarName: selectedAvatarName,
                    voiceId: selectedVoiceId,
                    voiceName: selectedVoiceName,
                    title: heygenBatch.title,
                    batchId: heygenBatch.id,
                    aspectRatio,
                  })}
                  disabled={!selectedAvatarId || !selectedVoiceId || createVideoMutation.isPending}
                >
                  {createVideoMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Video wird gesendet...</>
                  ) : (
                    <><Play className="w-4 h-4" /> Video bei HeyGen erstellen</>
                  )}
                </Button>

                {/* Video Status */}
                {videoStatusId && videoStatus && (
                  <div className={`p-3 rounded-lg border ${
                    videoStatus.status === "completed" ? "bg-emerald-500/10 border-emerald-500/30" :
                    videoStatus.status === "failed" ? "bg-red-500/10 border-red-500/30" :
                    "bg-primary/5 border-primary/20"
                  }`}>
                    <div className="flex items-center gap-2">
                      {videoStatus.status === "completed" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> :
                       videoStatus.status === "failed" ? <AlertCircle className="w-4 h-4 text-red-400" /> :
                       <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                      <span className="text-xs font-medium">
                        {videoStatus.status === "completed" ? "Video fertig!" :
                         videoStatus.status === "failed" ? "Fehler beim Erstellen" :
                         videoStatus.status === "processing" ? "Video wird verarbeitet..." :
                         "Video in Warteschlange..."}
                      </span>
                    </div>
                    {videoStatus.videoUrl && (
                      <a
                        href={videoStatus.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Video öffnen
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Generate Dialog */}
        <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Neuen Batch generieren
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs text-muted-foreground">
                  Die KI analysiert den Ad-Text und erstellt automatisch <strong className="text-foreground">1 Body + 1 CTA + 3 Hooks</strong> im Easy Signals Stil – inklusive HeyGen-Skript.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Konkurrent / Quelle</Label>
                <Input
                  placeholder="z.B. Nike, Konkurrent GmbH..."
                  value={competitorName}
                  onChange={e => setCompetitorName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Original Ad-Text *</Label>
                <Textarea
                  placeholder="Füge hier den Ad-Text des Konkurrenten ein – auch in anderen Sprachen, die KI übersetzt und adaptiert automatisch..."
                  value={adText}
                  onChange={e => setAdText(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Funktioniert auch mit fremdsprachigen Ads – die KI übersetzt und passt den Stil an Easy Signals an.
                </p>
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => generateMutation.mutate({ adText, competitorAdId: 0, competitorName: competitorName || "Unbekannt" })}
                disabled={!adText.trim() || generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    KI generiert Batch...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Batch generieren
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
