import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  Image, Plus, Trash2, Upload, Loader2, CheckCircle2, Trophy,
  Pause, TestTube2, FileEdit, ExternalLink, Tag, LayoutGrid, List
} from "lucide-react";

const STATUS_CONFIG = {
  draft:   { label: "Entwurf",   color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
  testing: { label: "Im Test",   color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  active:  { label: "Aktiv",     color: "bg-green-500/20 text-green-400 border-green-500/30" },
  paused:  { label: "Pausiert",  color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  winner:  { label: "Gewinner",  color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
} as const;

type AdStatus = keyof typeof STATUS_CONFIG;

const STYLE_LABELS: Record<string, string> = {
  luxury: "Luxury Lifestyle",
  trading_lifestyle: "Trading Setup",
  results_proof: "Results & Proof",
  dark_premium: "Dark Premium",
};

type AdWithHeadlines = {
  id: number; title: string; style: string; imageUrl: string | null;
  boardStatus: string; boardX: number | null; boardY: number | null;
  metaUploadStatus: string | null; metaAdId: string | null; createdAt: Date;
  headlines: { id: number; text: string; status: string }[];
};

export default function ImageAds() {
  const utils = trpc.useUtils();
  const { data: ads, isLoading } = trpc.imageAds.list.useQuery();

  const generateMutation = trpc.imageAds.generate.useMutation({
    onSuccess: () => {
      utils.imageAds.list.invalidate();
      toast.success("Image Ad generiert!");
      setGenerateDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMutation = trpc.imageAds.updateStatus.useMutation({
    onSuccess: () => utils.imageAds.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.imageAds.delete.useMutation({
    onSuccess: () => { utils.imageAds.list.invalidate(); toast.success("Gelöscht!"); },
    onError: (e) => toast.error(e.message),
  });

  const uploadToMetaMutation = trpc.imageAds.uploadToMeta.useMutation({
    onSuccess: () => { utils.imageAds.list.invalidate(); toast.success("Zu Meta hochgeladen!"); },
    onError: (e) => toast.error(e.message),
  });

  const addHeadlineMutation = trpc.imageAds.addHeadline.useMutation({
    onSuccess: () => { utils.imageAds.list.invalidate(); setNewHeadline(""); },
    onError: (e) => toast.error(e.message),
  });

  const updateHeadlineStatusMutation = trpc.imageAds.updateHeadlineStatus.useMutation({
    onSuccess: () => utils.imageAds.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const [generateDialog, setGenerateDialog] = useState(false);
  const [genTitle, setGenTitle] = useState("");
  const [genStyle, setGenStyle] = useState<"luxury" | "trading_lifestyle" | "results_proof" | "dark_premium">("luxury");
  const [genPrompt, setGenPrompt] = useState("");
  const [selectedAd, setSelectedAd] = useState<AdWithHeadlines | null>(null);
  const [newHeadline, setNewHeadline] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  // Board drag state
  const updatePositionMutation = trpc.imageAds.updatePosition.useMutation();
  const boardRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ id: number; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent, ad: AdWithHeadlines) => {
    e.preventDefault();
    dragging.current = {
      id: ad.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: ad.boardX ?? 0,
      origY: ad.boardY ?? 0,
    };
    const handleMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - dragging.current.startX;
      const dy = ev.clientY - dragging.current.startY;
      const el = document.getElementById(`ad-card-${dragging.current.id}`);
      if (el) {
        el.style.left = `${dragging.current.origX + dx}px`;
        el.style.top = `${dragging.current.origY + dy}px`;
      }
    };
    const handleUp = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - dragging.current.startX;
      const dy = ev.clientY - dragging.current.startY;
      const newX = Math.max(0, dragging.current.origX + dx);
      const newY = Math.max(0, dragging.current.origY + dy);
      updatePositionMutation.mutate({ id: dragging.current.id, x: newX, y: newY });
      dragging.current = null;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [updatePositionMutation]);

  const statusGroups = ["draft", "testing", "active", "paused", "winner"] as AdStatus[];

  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
              <Image className="h-4 w-4 text-pink-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Image Ads Board</h1>
              <p className="text-xs text-muted-foreground">{ads?.length ?? 0} Ads · Visuelles Ad-Board</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === "board" ? "list" : "board")}
            >
              {viewMode === "board" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </Button>
            <Button size="sm" onClick={() => setGenerateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Image Ad generieren
            </Button>
          </div>
        </div>

        {/* Status Legend */}
        <div className="flex items-center gap-3 px-6 py-2 border-b border-border/30 shrink-0 overflow-x-auto">
          {statusGroups.map(s => (
            <div key={s} className="flex items-center gap-1.5 shrink-0">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${STATUS_CONFIG[s].color}`}>
                {STATUS_CONFIG[s].label}
              </span>
              <span className="text-xs text-muted-foreground">
                {ads?.filter(a => a.boardStatus === s).length ?? 0}
              </span>
            </div>
          ))}
        </div>

        {/* Board / List */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !ads || ads.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Image className="h-16 w-16 mb-4 opacity-20" />
            <p className="font-medium">Noch keine Image Ads</p>
            <p className="text-sm mt-1">Generiere deine erste Ad mit KI + deinem Gesicht</p>
            <Button className="mt-4" onClick={() => setGenerateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> Erste Ad generieren
            </Button>
          </div>
        ) : viewMode === "board" ? (
          // BOARD VIEW
          <div
            ref={boardRef}
            className="flex-1 relative overflow-auto bg-[radial-gradient(circle_at_1px_1px,oklch(0.3_0.01_250)_1px,transparent_0)] bg-[size:32px_32px]"
            style={{ minHeight: 600 }}
          >
            {ads.map((ad) => {
              const status = (ad.boardStatus as AdStatus) ?? "draft";
              const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
              const x = ad.boardX ?? (Math.random() * 600);
              const y = ad.boardY ?? (Math.random() * 400);
              return (
                <div
                  key={ad.id}
                  id={`ad-card-${ad.id}`}
                  className="absolute w-52 cursor-grab active:cursor-grabbing select-none"
                  style={{ left: x, top: y }}
                  onMouseDown={(e) => handleDragStart(e, ad as AdWithHeadlines)}
                >
                  <Card className="bg-card/90 border-border/50 shadow-lg hover:shadow-xl transition-shadow backdrop-blur-sm">
                    {/* Image */}
                    <div
                      className="relative h-40 rounded-t-lg overflow-hidden bg-zinc-900 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setSelectedAd(ad as AdWithHeadlines); }}
                    >
                      {ad.imageUrl ? (
                        <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] border ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                    <CardContent className="p-2.5">
                      <p className="text-xs font-medium truncate mb-1">{ad.title}</p>
                      <p className="text-[10px] text-muted-foreground mb-2">{STYLE_LABELS[ad.style] ?? ad.style}</p>
                      {/* Headlines preview */}
                      {(ad as AdWithHeadlines).headlines.slice(0, 2).map(h => (
                        <div key={h.id} className="text-[10px] text-muted-foreground/70 truncate flex items-center gap-1 mb-0.5">
                          <Tag className="h-2.5 w-2.5 shrink-0" />
                          {h.text}
                        </div>
                      ))}
                      {/* Status selector */}
                      <Select
                        value={ad.boardStatus}
                        onValueChange={(v) => updateStatusMutation.mutate({ id: ad.id, status: v as AdStatus })}
                      >
                        <SelectTrigger className="h-6 text-[10px] mt-2 px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusGroups.map(s => (
                            <SelectItem key={s} value={s} className="text-xs">{STATUS_CONFIG[s].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        ) : (
          // LIST VIEW
          <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ads.map((ad) => {
                const status = (ad.boardStatus as AdStatus) ?? "draft";
                const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
                return (
                  <Card
                    key={ad.id}
                    className="bg-card/50 border-border/50 hover:border-border transition-colors cursor-pointer"
                    onClick={() => setSelectedAd(ad as AdWithHeadlines)}
                  >
                    <div className="relative h-48 rounded-t-lg overflow-hidden bg-zinc-900">
                      {ad.imageUrl ? (
                        <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      {ad.metaUploadStatus === "uploaded" && (
                        <div className="absolute top-2 right-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            Meta ✓
                          </span>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium truncate">{ad.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{STYLE_LABELS[ad.style] ?? ad.style}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(ad as AdWithHeadlines).headlines.slice(0, 3).map(h => (
                          <span key={h.id} className="text-[10px] bg-accent/50 px-1.5 py-0.5 rounded truncate max-w-full">
                            {h.text}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Generate Dialog */}
      <Dialog open={generateDialog} onOpenChange={setGenerateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="h-4 w-4 text-pink-400" />
              Image Ad generieren
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Titel</label>
              <Input value={genTitle} onChange={(e) => setGenTitle(e.target.value)} placeholder="z.B. Luxury Hook Test #1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Stil</label>
              <Select value={genStyle} onValueChange={(v) => setGenStyle(v as typeof genStyle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="luxury">🏙️ Luxury Lifestyle</SelectItem>
                  <SelectItem value="trading_lifestyle">📊 Trading Setup</SelectItem>
                  <SelectItem value="results_proof">📈 Results & Proof</SelectItem>
                  <SelectItem value="dark_premium">🌑 Dark Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Zusätzlicher Kontext (optional)</label>
              <Textarea
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                placeholder="z.B. zeige Handelsgewinne auf dem Smartphone..."
                className="min-h-[80px] text-sm"
              />
            </div>
            <div className="p-3 rounded-lg bg-pink-500/5 border border-pink-500/20 text-xs text-muted-foreground">
              KI generiert das Bild mit deinem Gesicht (Livio) + EasySignals-Kontext + 5 Headlines automatisch. Dauert ca. 20–30 Sekunden.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialog(false)}>Abbrechen</Button>
            <Button
              onClick={() => generateMutation.mutate({ title: genTitle, style: genStyle, customPrompt: genPrompt || undefined, generateHeadlines: true })}
              disabled={!genTitle || generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generiert...</>
              ) : (
                <><Image className="h-4 w-4 mr-2" /> Generieren</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ad Detail Dialog */}
      <Dialog open={!!selectedAd} onOpenChange={(o) => { if (!o) setSelectedAd(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="h-4 w-4 text-pink-400" />
              {selectedAd?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedAd && (
            <div className="flex-1 overflow-auto flex flex-col gap-4">
              {/* Image */}
              <div className="relative rounded-xl overflow-hidden bg-zinc-900 aspect-square max-h-64 mx-auto w-full">
                {selectedAd.imageUrl ? (
                  <img src={selectedAd.imageUrl} alt={selectedAd.title} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              {/* Meta & Status */}
              <div className="flex flex-wrap gap-2 items-center">
                <Select
                  value={selectedAd.boardStatus}
                  onValueChange={(v) => {
                    updateStatusMutation.mutate({ id: selectedAd.id, status: v as AdStatus });
                    setSelectedAd({ ...selectedAd, boardStatus: v });
                  }}
                >
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusGroups.map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{STATUS_CONFIG[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="text-xs">{STYLE_LABELS[selectedAd.style] ?? selectedAd.style}</Badge>
                {selectedAd.imageUrl && (
                  <a href={selectedAd.imageUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="h-8 text-xs">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Bild öffnen
                    </Button>
                  </a>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => uploadToMetaMutation.mutate({ id: selectedAd.id, adAccountId: "act_1093241318940799" })}
                  disabled={uploadToMetaMutation.isPending || selectedAd.metaUploadStatus === "uploaded"}
                >
                  {uploadToMetaMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 mr-1" />
                  )}
                  {selectedAd.metaUploadStatus === "uploaded" ? "Auf Meta ✓" : "Zu Meta hochladen"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs text-destructive hover:text-destructive"
                  onClick={() => { deleteMutation.mutate({ id: selectedAd.id }); setSelectedAd(null); }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Löschen
                </Button>
              </div>

              {/* Headlines */}
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  Headlines ({selectedAd.headlines.length})
                </p>
                <div className="flex flex-col gap-1.5">
                  {selectedAd.headlines.map(h => (
                    <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-border/30">
                      <span className="text-sm flex-1">{h.text}</span>
                      <Select
                        value={h.status}
                        onValueChange={(v) => updateHeadlineStatusMutation.mutate({ id: h.id, status: v as AdStatus })}
                      >
                        <SelectTrigger className="w-28 h-6 text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusGroups.map(s => (
                            <SelectItem key={s} value={s} className="text-xs">{STATUS_CONFIG[s].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  {/* Add headline */}
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={newHeadline}
                      onChange={(e) => setNewHeadline(e.target.value)}
                      placeholder="Neue Headline hinzufügen..."
                      className="text-sm h-8"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newHeadline.trim()) {
                          addHeadlineMutation.mutate({ imageAdId: selectedAd.id, text: newHeadline.trim() });
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => newHeadline.trim() && addHeadlineMutation.mutate({ imageAdId: selectedAd.id, text: newHeadline.trim() })}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
