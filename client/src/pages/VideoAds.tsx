import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import {
  Video, Plus, Loader2, RefreshCw, Play, ExternalLink,
  Wand2, FileText, Zap, Trash2, CheckCircle2, Clock, AlertCircle
} from "lucide-react";

const STATUS_CONFIG = {
  draft:      { label: "Entwurf",        color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",   icon: FileText },
  generating: { label: "Generiert...",   color: "bg-blue-500/20 text-blue-400 border-blue-500/30",   icon: Loader2 },
  ready:      { label: "Bereit",         color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
  failed:     { label: "Fehler",         color: "bg-red-500/20 text-red-400 border-red-500/30",       icon: AlertCircle },
  approved:   { label: "Genehmigt",      color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: CheckCircle2 },
} as const;

type VideoStatus = keyof typeof STATUS_CONFIG;

const EMOTION_LABELS: Record<string, string> = {
  fomo: "😰 FOMO",
  pain: "😤 Schmerz",
  curiosity: "🤔 Neugier",
  authority: "💼 Autorität",
  social_proof: "👥 Social Proof",
};

type VideoAd = {
  id: number; title: string; hook: string | null; body: string | null;
  cta: string | null; fullScript: string | null; status: string;
  videoUrl: string | null; heygenVideoId: string | null; aspectRatio: string;
  avatarId: string | null; voiceId: string | null;
  createdAt: Date;
};

type GeneratedScript = {
  hook1: string; hook2: string; hook3: string; body: string; cta: string; raw: string;
};

export default function VideoAds() {
  const utils = trpc.useUtils();
  const { data: videos, isLoading } = trpc.videoAds.list.useQuery();

  const generateScriptMutation = trpc.videoAds.generateScript.useMutation({
    onSuccess: (data) => {
      setGeneratedScript(data);
      toast.success("Skript generiert!");
    },
    onError: (e) => toast.error(e.message),
  });

  const createMutation = trpc.videoAds.create.useMutation({
    onSuccess: () => {
      utils.videoAds.list.invalidate();
      toast.success("Video Ad erstellt!");
      setCreateDialog(false);
      setGeneratedScript(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const generateVideoMutation = trpc.videoAds.generateVideo.useMutation({
    onSuccess: () => {
      utils.videoAds.list.invalidate();
      toast.success("Video-Generierung gestartet! Dauert ca. 2–5 Minuten.");
    },
    onError: (e) => toast.error(e.message),
  });

  const checkStatusQuery = trpc.videoAds.checkStatus;
  const checkStatusFn = async (id: number) => {
    // Use refetch pattern via invalidate
    utils.videoAds.list.invalidate();
    toast.info("Status wird aktualisiert...");
  };

  const deleteMutation = trpc.videoAds.delete.useMutation({
    onSuccess: () => { utils.videoAds.list.invalidate(); toast.success("Gelöscht!"); },
    onError: (e) => toast.error(e.message),
  });

  const dailyBatchMutation = trpc.videoAds.generateDailyBatch.useMutation({
    onSuccess: (data) => {
      utils.videoAds.list.invalidate();
      toast.success(`Daily Batch erstellt: ${data.createdIds.length} Skripte`);
    },
    onError: (e) => toast.error(e.message),
  });

  const [createDialog, setCreateDialog] = useState(false);
  const [scriptDialog, setScriptDialog] = useState(false);
  const [genAngle, setGenAngle] = useState("");
  const [genEmotion, setGenEmotion] = useState<"fomo" | "pain" | "curiosity" | "authority" | "social_proof">("pain");
  const [genLang, setGenLang] = useState<"de" | "en">("de");
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [selectedHook, setSelectedHook] = useState<"hook1" | "hook2" | "hook3">("hook1");
  const [title, setTitle] = useState("");
  const [customHook, setCustomHook] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [customCta, setCustomCta] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<VideoAd | null>(null);

  const openCreateFromScript = () => {
    if (!generatedScript) return;
    setCustomHook(generatedScript[selectedHook]);
    setCustomBody(generatedScript.body);
    setCustomCta(generatedScript.cta);
    setScriptDialog(false);
    setCreateDialog(true);
  };

  const readyCount = videos?.filter(v => v.status === "ready").length ?? 0;
  const generatingCount = videos?.filter(v => v.status === "generating").length ?? 0;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Video className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Video Ads</h1>
              <p className="text-sm text-muted-foreground">
                {videos?.length ?? 0} Videos · {readyCount} bereit · {generatingCount} in Generierung
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => dailyBatchMutation.mutate({ avatarId: "Livio_sitting_public", voiceId: "2d5b0e6cf36f460aa7fc47e3eee4ba54" })}
              disabled={dailyBatchMutation.isPending}
            >
              {dailyBatchMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Daily Batch (3 Hooks)
            </Button>
            <Button variant="outline" size="sm" onClick={() => setScriptDialog(true)}>
              <Wand2 className="h-4 w-4 mr-2" />
              Skript generieren
            </Button>
            <Button size="sm" onClick={() => { setCustomHook(""); setCustomBody(""); setCustomCta(""); setCreateDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Manuell erstellen
            </Button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 rounded-xl bg-violet-500/5 border border-violet-500/20 text-sm text-muted-foreground">
          <strong className="text-foreground">Workflow:</strong> Skript generieren → Hook auswählen → Video mit HeyGen (Livio-Klon, 9:16) produzieren → Du prüfst → Zu Meta hochladen. Niemals automatisch veröffentlichen.
        </div>

        {/* Videos Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-48 rounded-xl bg-card animate-pulse" />)}
          </div>
        ) : !videos || videos.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Video className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="font-medium">Noch keine Video Ads</p>
            <p className="text-sm mt-1">Generiere ein Skript oder starte den Daily Batch</p>
            <div className="flex gap-2 justify-center mt-4">
              <Button variant="outline" onClick={() => setScriptDialog(true)}>
                <Wand2 className="h-4 w-4 mr-2" /> Skript generieren
              </Button>
              <Button onClick={() => dailyBatchMutation.mutate({ avatarId: "Livio_sitting_public", voiceId: "2d5b0e6cf36f460aa7fc47e3eee4ba54" })}>
                <Zap className="h-4 w-4 mr-2" /> Daily Batch starten
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {videos.map((video) => {
              const status = (video.status as VideoStatus) ?? "draft";
              const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
              const Icon = cfg.icon;
              return (
                <Card
                  key={video.id}
                  className="bg-card/50 border-border/50 hover:border-border transition-colors cursor-pointer"
                  onClick={() => setSelectedVideo(video as unknown as VideoAd)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-medium line-clamp-1">{video.title}</CardTitle>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border shrink-0 ${cfg.color}`}>
                        <Icon className={`h-3 w-3 ${status === "generating" ? "animate-spin" : ""}`} />
                        {cfg.label}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {video.hook && (
                        <div className="p-2 rounded-lg bg-violet-500/5 border border-violet-500/20">
                          <p className="text-[10px] text-violet-400 font-medium mb-0.5">HOOK</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{video.hook}</p>
                        </div>
                      )}
                      {video.cta && (
                        <div className="p-2 rounded-lg bg-accent/30">
                          <p className="text-[10px] text-muted-foreground font-medium mb-0.5">CTA</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{video.cta}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline" className="text-[10px]">{video.aspectRatio}</Badge>
                      {video.videoUrl && (
                        <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">
                            <Play className="h-3 w-3 mr-1" /> Abspielen
                          </Button>
                        </a>
                      )}
                      {video.status === "generating" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2"
                          onClick={(e) => { e.stopPropagation(); checkStatusFn(video.id); }}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Status prüfen
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Script Generator Dialog */}
      <Dialog open={scriptDialog} onOpenChange={setScriptDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-violet-400" />
              KI Skript Generator
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Emotion/Tonalität</label>
                <Select value={genEmotion} onValueChange={(v) => setGenEmotion(v as typeof genEmotion)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EMOTION_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Sprache</label>
                <Select value={genLang} onValueChange={(v) => setGenLang(v as "de" | "en")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                    <SelectItem value="en">🇬🇧 Englisch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Spezifischer Winkel (optional)</label>
              <Input
                value={genAngle}
                onChange={(e) => setGenAngle(e.target.value)}
                placeholder="z.B. Trader der 3 Monate verloren hat und jetzt gewinnt..."
              />
            </div>
            <Button
              onClick={() => generateScriptMutation.mutate({ angle: genAngle || undefined, targetEmotion: genEmotion, language: genLang })}
              disabled={generateScriptMutation.isPending}
            >
              {generateScriptMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generiert...</>
              ) : (
                <><Wand2 className="h-4 w-4 mr-2" /> Skript generieren</>
              )}
            </Button>

            {generatedScript && (
              <div className="flex flex-col gap-3 mt-2">
                <p className="text-sm font-medium">Generiertes Skript – Hook auswählen:</p>
                {(["hook1", "hook2", "hook3"] as const).map((hk, i) => (
                  <div
                    key={hk}
                    className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedHook === hk
                        ? "border-violet-500/50 bg-violet-500/10"
                        : "border-border/50 bg-accent/20 hover:border-border"
                    }`}
                    onClick={() => setSelectedHook(hk)}
                  >
                    <p className="text-[10px] text-violet-400 font-medium mb-1">HOOK {i + 1}</p>
                    <p className="text-sm">{generatedScript[hk]}</p>
                  </div>
                ))}
                <div className="p-3 rounded-xl border border-border/50 bg-accent/20">
                  <p className="text-[10px] text-muted-foreground font-medium mb-1">BODY</p>
                  <p className="text-sm text-muted-foreground">{generatedScript.body}</p>
                </div>
                <div className="p-3 rounded-xl border border-border/50 bg-accent/20">
                  <p className="text-[10px] text-muted-foreground font-medium mb-1">CTA</p>
                  <p className="text-sm text-muted-foreground">{generatedScript.cta}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScriptDialog(false)}>Schließen</Button>
            {generatedScript && (
              <Button onClick={openCreateFromScript}>
                <Plus className="h-4 w-4 mr-2" /> Video erstellen
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Video Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-4 w-4 text-violet-400" />
              Video Ad erstellen
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto flex flex-col gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Titel</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Hook Test #1 – FOMO" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Hook</label>
              <Textarea value={customHook} onChange={(e) => setCustomHook(e.target.value)} placeholder="Hook-Text..." className="min-h-[60px] text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Body</label>
              <Textarea value={customBody} onChange={(e) => setCustomBody(e.target.value)} placeholder="Hauptteil..." className="min-h-[100px] text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">CTA</label>
              <Textarea value={customCta} onChange={(e) => setCustomCta(e.target.value)} placeholder="Call-to-Action..." className="min-h-[60px] text-sm" />
            </div>
            <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/20 text-xs text-muted-foreground">
              Das Video wird mit dem Livio-Klon in HeyGen als 9:16 (Reels/Stories) produziert. Du siehst das Ergebnis zuerst – nichts wird automatisch veröffentlicht.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>Abbrechen</Button>
            <Button
              onClick={() => createMutation.mutate({ title, hook: customHook, body: customBody, cta: customCta })}
              disabled={!title || !customHook || !customBody || !customCta || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Detail Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={(o) => { if (!o) setSelectedVideo(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-4 w-4 text-violet-400" />
              {selectedVideo?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedVideo && (
            <div className="flex-1 overflow-auto flex flex-col gap-3">
              {/* Status */}
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const status = (selectedVideo.status as VideoStatus) ?? "draft";
                  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
                  const Icon = cfg.icon;
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${cfg.color}`}>
                      <Icon className={`h-3.5 w-3.5 ${status === "generating" ? "animate-spin" : ""}`} />
                      {cfg.label}
                    </span>
                  );
                })()}
                <Badge variant="outline" className="text-xs">{selectedVideo.aspectRatio}</Badge>
              </div>

              {/* Script */}
              <div className="space-y-2">
                {selectedVideo.hook && (
                  <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/20">
                    <p className="text-[10px] text-violet-400 font-medium mb-1">HOOK</p>
                    <p className="text-sm">{selectedVideo.hook}</p>
                  </div>
                )}
                {selectedVideo.body && (
                  <div className="p-3 rounded-xl bg-accent/20 border border-border/30">
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">BODY</p>
                    <p className="text-sm text-muted-foreground">{selectedVideo.body}</p>
                  </div>
                )}
                {selectedVideo.cta && (
                  <div className="p-3 rounded-xl bg-accent/20 border border-border/30">
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">CTA</p>
                    <p className="text-sm text-muted-foreground">{selectedVideo.cta}</p>
                  </div>
                )}
              </div>

              {/* Video Player */}
              {selectedVideo.videoUrl && (
                <div className="rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-64 mx-auto">
                  <video src={selectedVideo.videoUrl} controls className="w-full h-full object-contain" />
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {selectedVideo.status === "draft" && (
                  <Button
                    size="sm"
                    onClick={() => generateVideoMutation.mutate({ id: selectedVideo.id, avatarId: selectedVideo.avatarId ?? "Livio_sitting_public", voiceId: selectedVideo.voiceId ?? "2d5b0e6cf36f460aa7fc47e3eee4ba54" })}
                    disabled={generateVideoMutation.isPending}
                  >
                    {generateVideoMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Video className="h-4 w-4 mr-2" />
                    )}
                    HeyGen Video generieren
                  </Button>
                )}
                {selectedVideo.status === "generating" && (
                  <Button
                    size="sm"
                    variant="outline"
                     onClick={() => checkStatusFn(selectedVideo.id)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Status prüfen
                  </Button>
                )}
                {selectedVideo.videoUrl && (
                  <a href={selectedVideo.videoUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline">
                      <ExternalLink className="h-4 w-4 mr-2" /> Video öffnen
                    </Button>
                  </a>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => { deleteMutation.mutate({ id: selectedVideo.id }); setSelectedVideo(null); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Löschen
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
