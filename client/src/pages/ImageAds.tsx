import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Image, Plus, Trash2, Upload, Loader2, CheckCircle2, Trophy,
  Pause, TestTube2, ExternalLink, Tag, LayoutGrid, List, Sparkles,
  Layout, Newspaper, SplitSquareHorizontal, Star, ChevronRight,
} from "lucide-react";

const STATUS_CONFIG = {
  draft:   { label: "Entwurf",   color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
  testing: { label: "Im Test",   color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  active:  { label: "Aktiv",     color: "bg-green-500/20 text-green-400 border-green-500/30" },
  paused:  { label: "Pausiert",  color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  winner:  { label: "Gewinner",  color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
} as const;

type AdStatus = keyof typeof STATUS_CONFIG;

const STYLE_LABELS: Record<string, { label: string; emoji: string; desc: string }> = {
  luxury:            { label: "Luxury Lifestyle", emoji: "🏙️", desc: "Gold & Schwarz, Premium-Feeling" },
  trading_lifestyle: { label: "Trading Setup",    emoji: "📊", desc: "Grün & Dunkel, Charts & Setup" },
  results_proof:     { label: "Results & Proof",  emoji: "📈", desc: "Social Proof, Zahlen & Ergebnisse" },
  dark_premium:      { label: "Dark Premium",     emoji: "🌑", desc: "Minimalistisch, High-Contrast" },
};

const TEMPLATE_CONFIG: Record<string, { label: string; desc: string; icon: React.ReactNode }> = {
  fredtrading: { label: "FredTrading",  desc: "Foto rechts, Text + Bullets links", icon: <Layout className="h-4 w-4" /> },
  news:        { label: "News-Stil",    desc: "Vollbild-Foto + Text unten",        icon: <Newspaper className="h-4 w-4" /> },
  split:       { label: "Split",        desc: "50/50 Foto | Text",                 icon: <SplitSquareHorizontal className="h-4 w-4" /> },
  luxury:      { label: "Luxury",       desc: "Zentriert, Gold-Rahmen, elegant",   icon: <Star className="h-4 w-4" /> },
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
      toast.success("Image Ad generiert! Composite-Bild mit Headline-Overlay erstellt.");
      setGenerateDialog(false);
      resetForm();
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

  // Form state
  const [generateDialog, setGenerateDialog] = useState(false);
  const [genTitle, setGenTitle] = useState("");
  const [genStyle, setGenStyle] = useState<"luxury" | "trading_lifestyle" | "results_proof" | "dark_premium">("trading_lifestyle");
  const [genTemplate, setGenTemplate] = useState<"fredtrading" | "news" | "split" | "luxury">("fredtrading");
  const [genHeadline, setGenHeadline] = useState("");
  const [genSubheadline, setGenSubheadline] = useState("");
  const [genBullets, setGenBullets] = useState(["", "", ""]);
  const [genCta, setGenCta] = useState("Jetzt kostenlos starten");
  const [genPrompt, setGenPrompt] = useState("");
  const [aiAssist, setAiAssist] = useState(true);

  const resetForm = () => {
    setGenTitle(""); setGenHeadline(""); setGenSubheadline("");
    setGenBullets(["", "", ""]); setGenCta("Jetzt kostenlos starten");
    setGenPrompt(""); setAiAssist(true);
  };

  // Detail dialog
  const [selectedAd, setSelectedAd] = useState<AdWithHeadlines | null>(null);
  const [newHeadline, setNewHeadline] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "list">("list");

  // Board drag
  const updatePositionMutation = trpc.imageAds.updatePosition.useMutation();
  const boardRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ id: number; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent, ad: AdWithHeadlines) => {
    e.preventDefault();
    dragging.current = { id: ad.id, startX: e.clientX, startY: e.clientY, origX: ad.boardX ?? 0, origY: ad.boardY ?? 0 };
    const handleMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - dragging.current.startX;
      const dy = ev.clientY - dragging.current.startY;
      const el = document.getElementById(`ad-card-${dragging.current.id}`);
      if (el) { el.style.left = `${dragging.current.origX + dx}px`; el.style.top = `${dragging.current.origY + dy}px`; }
    };
    const handleUp = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - dragging.current.startX;
      const dy = ev.clientY - dragging.current.startY;
      updatePositionMutation.mutate({ id: dragging.current.id, x: Math.max(0, dragging.current.origX + dx), y: Math.max(0, dragging.current.origY + dy) });
      dragging.current = null;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [updatePositionMutation]);

  const statusGroups = ["draft", "testing", "active", "paused", "winner"] as AdStatus[];

  const handleGenerate = () => {
    if (!genTitle || !genHeadline) return;
    const bullets = genBullets.filter(b => b.trim());
    generateMutation.mutate({
      title: genTitle,
      style: genStyle,
      template: genTemplate,
      headline: genHeadline,
      subheadline: genSubheadline || undefined,
      bullets: bullets.length > 0 ? bullets : undefined,
      cta: genCta || undefined,
      customPrompt: genPrompt || undefined,
      generateHeadlines: true,
    });
  };

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
              <p className="text-xs text-muted-foreground">{ads?.length ?? 0} Ads · Composite Ad Generator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "board" ? "list" : "board")}>
              {viewMode === "board" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </Button>
            <Button size="sm" onClick={() => setGenerateDialog(true)} className="bg-pink-600 hover:bg-pink-700">
              <Sparkles className="h-4 w-4 mr-2" />
              Composite Ad erstellen
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
              <span className="text-xs text-muted-foreground">{ads?.filter(a => a.boardStatus === s).length ?? 0}</span>
            </div>
          ))}
        </div>

        {/* Board / List */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !ads || ads.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
            <div className="w-24 h-24 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
              <Sparkles className="h-12 w-12 text-pink-400/50" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg">Noch keine Image Ads</p>
              <p className="text-sm mt-1 max-w-xs">Erstelle deine erste Composite Ad – Livio-Foto + Headline + Bullets direkt auf dem Bild</p>
            </div>
            <Button onClick={() => setGenerateDialog(true)} className="bg-pink-600 hover:bg-pink-700">
              <Sparkles className="h-4 w-4 mr-2" /> Erste Ad erstellen
            </Button>
          </div>
        ) : viewMode === "board" ? (
          // BOARD VIEW
          <div ref={boardRef} className="flex-1 relative overflow-auto bg-[radial-gradient(circle_at_1px_1px,oklch(0.3_0.01_250)_1px,transparent_0)] bg-[size:32px_32px]" style={{ minHeight: 600 }}>
            {ads.map((ad) => {
              const status = (ad.boardStatus as AdStatus) ?? "draft";
              const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
              const x = ad.boardX ?? (Math.random() * 600);
              const y = ad.boardY ?? (Math.random() * 400);
              return (
                <div key={ad.id} id={`ad-card-${ad.id}`} className="absolute w-56 cursor-grab active:cursor-grabbing select-none" style={{ left: x, top: y }} onMouseDown={(e) => handleDragStart(e, ad as AdWithHeadlines)}>
                  <Card className="bg-card/90 border-border/50 shadow-lg hover:shadow-xl transition-shadow backdrop-blur-sm">
                    <div className="relative h-44 rounded-t-lg overflow-hidden bg-zinc-900 cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedAd(ad as AdWithHeadlines); }}>
                      {ad.imageUrl ? (
                        <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Image className="h-8 w-8 text-muted-foreground/30" /></div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] border ${cfg.color}`}>{cfg.label}</span>
                      </div>
                    </div>
                    <CardContent className="p-2.5">
                      <p className="text-xs font-medium truncate mb-1">{ad.title}</p>
                      <p className="text-[10px] text-muted-foreground mb-2">{STYLE_LABELS[ad.style]?.emoji} {STYLE_LABELS[ad.style]?.label ?? ad.style}</p>
                      {(ad as AdWithHeadlines).headlines.slice(0, 1).map(h => (
                        <div key={h.id} className="text-[10px] text-muted-foreground/70 truncate flex items-center gap-1 mb-0.5">
                          <Tag className="h-2.5 w-2.5 shrink-0" />{h.text}
                        </div>
                      ))}
                      <Select value={ad.boardStatus} onValueChange={(v) => updateStatusMutation.mutate({ id: ad.id, status: v as AdStatus })}>
                        <SelectTrigger className="h-6 text-[10px] mt-2 px-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {statusGroups.map(s => (<SelectItem key={s} value={s} className="text-xs">{STATUS_CONFIG[s].label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        ) : (
          // LIST VIEW – Größere Cards mit Composite-Bild
          <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {ads.map((ad) => {
                const status = (ad.boardStatus as AdStatus) ?? "draft";
                const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
                return (
                  <Card key={ad.id} className="bg-card/50 border-border/50 hover:border-pink-500/30 transition-all cursor-pointer group overflow-hidden" onClick={() => setSelectedAd(ad as AdWithHeadlines)}>
                    {/* Ad Image – 1:1 Aspect Ratio */}
                    <div className="relative aspect-square overflow-hidden bg-zinc-900">
                      {ad.imageUrl ? (
                        <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                      )}
                      {/* Status Badge */}
                      <div className="absolute top-3 left-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border backdrop-blur-sm ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      {/* Meta Badge */}
                      {ad.metaUploadStatus === "uploaded" && (
                        <div className="absolute top-3 right-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 backdrop-blur-sm">Meta ✓</span>
                        </div>
                      )}
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button size="sm" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Details
                        </Button>
                      </div>
                    </div>
                    {/* Card Footer */}
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{ad.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{STYLE_LABELS[ad.style]?.emoji} {STYLE_LABELS[ad.style]?.label ?? ad.style}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                      </div>
                      {/* Headline Preview */}
                      {(ad as AdWithHeadlines).headlines[0] && (
                        <div className="mt-2 p-2 rounded-md bg-accent/30 border border-border/30">
                          <p className="text-xs text-muted-foreground truncate">
                            <Tag className="h-3 w-3 inline mr-1" />
                            {(ad as AdWithHeadlines).headlines[0].text}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ============ GENERATE DIALOG ============ */}
      <Dialog open={generateDialog} onOpenChange={(o) => { setGenerateDialog(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-pink-400" />
              Composite Ad erstellen
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Livio-Foto + Headline + Bullets werden direkt auf dem Bild gerendert – kein generiertes Gesicht, echtes Foto.
            </p>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Linke Spalte */}
            <div className="flex flex-col gap-3">
              {/* Titel */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Ad-Titel (intern)</label>
                <Input value={genTitle} onChange={(e) => setGenTitle(e.target.value)} placeholder="z.B. Trading Hook Test #1" />
              </div>

              {/* Headline – PFLICHTFELD */}
              <div>
                <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                  Headline <span className="text-pink-400">*</span>
                  <span className="text-muted-foreground font-normal ml-1">(erscheint groß auf dem Bild)</span>
                </label>
                <Input
                  value={genHeadline}
                  onChange={(e) => setGenHeadline(e.target.value)}
                  placeholder="z.B. KOSTENLOSER TRADING KURS"
                  className="font-semibold"
                  maxLength={80}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">{genHeadline.length}/80 Zeichen</p>
              </div>

              {/* Subheadline */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Subheadline <span className="text-muted-foreground/60">(optional – KI füllt aus)</span>
                </label>
                <Input
                  value={genSubheadline}
                  onChange={(e) => setGenSubheadline(e.target.value)}
                  placeholder="z.B. Lerne in nur einem Abend wie du..."
                  maxLength={120}
                />
              </div>

              {/* Bullets */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Bullet Points <span className="text-muted-foreground/60">(optional – KI füllt aus)</span>
                </label>
                {genBullets.map((b, i) => (
                  <Input
                    key={i}
                    value={b}
                    onChange={(e) => { const nb = [...genBullets]; nb[i] = e.target.value; setGenBullets(nb); }}
                    placeholder={`Bullet ${i + 1}: z.B. Profitable Trades`}
                    className="mb-1.5 text-sm"
                    maxLength={60}
                  />
                ))}
              </div>

              {/* CTA */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Call to Action Button</label>
                <Input
                  value={genCta}
                  onChange={(e) => setGenCta(e.target.value)}
                  placeholder="z.B. Jetzt kostenlos starten"
                  maxLength={50}
                />
              </div>
            </div>

            {/* Rechte Spalte */}
            <div className="flex flex-col gap-3">
              {/* Template */}
              <div>
                <label className="text-xs font-medium mb-1 block">Layout-Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TEMPLATE_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setGenTemplate(key as typeof genTemplate)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${genTemplate === key ? "border-pink-500 bg-pink-500/10" : "border-border/50 hover:border-border"}`}
                    >
                      <div className={`flex items-center gap-1.5 mb-1 ${genTemplate === key ? "text-pink-400" : "text-muted-foreground"}`}>
                        {cfg.icon}
                        <span className="text-xs font-semibold">{cfg.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{cfg.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stil */}
              <div>
                <label className="text-xs font-medium mb-1 block">Farbschema / Stil</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {Object.entries(STYLE_LABELS).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setGenStyle(key as typeof genStyle)}
                      className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${genStyle === key ? "border-pink-500 bg-pink-500/10" : "border-border/50 hover:border-border"}`}
                    >
                      <span className="text-base">{cfg.emoji}</span>
                      <div>
                        <p className={`text-xs font-medium ${genStyle === key ? "text-pink-400" : ""}`}>{cfg.label}</p>
                        <p className="text-[10px] text-muted-foreground">{cfg.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Info Box */}
              <div className="p-3 rounded-lg bg-pink-500/5 border border-pink-500/20 text-xs text-muted-foreground">
                <p className="font-medium text-pink-400 mb-1">Was passiert:</p>
                <p>1. Livio-Foto wird geladen</p>
                <p>2. Composite-Bild wird gerendert (Foto + Text-Overlay)</p>
                <p>3. KI generiert fehlende Subheadline/Bullets automatisch</p>
                <p className="mt-1 text-[10px]">Dauert ca. 5–10 Sekunden</p>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => { setGenerateDialog(false); resetForm(); }}>Abbrechen</Button>
            <Button
              onClick={handleGenerate}
              disabled={!genTitle || !genHeadline || generateMutation.isPending}
              className="bg-pink-600 hover:bg-pink-700"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Rendert Composite Ad...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Composite Ad erstellen</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ AD DETAIL DIALOG ============ */}
      <Dialog open={!!selectedAd} onOpenChange={(o) => { if (!o) setSelectedAd(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="h-4 w-4 text-pink-400" />
              {selectedAd?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedAd && (
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Composite Ad Bild – groß */}
                <div className="relative rounded-xl overflow-hidden bg-zinc-900 aspect-square">
                  {selectedAd.imageUrl ? (
                    <img src={selectedAd.imageUrl} alt={selectedAd.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Rechte Seite: Actions + Headlines */}
                <div className="flex flex-col gap-3">
                  {/* Status + Stil */}
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={selectedAd.boardStatus}
                      onValueChange={(v) => {
                        updateStatusMutation.mutate({ id: selectedAd.id, status: v as AdStatus });
                        setSelectedAd({ ...selectedAd, boardStatus: v });
                      }}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statusGroups.map(s => (<SelectItem key={s} value={s} className="text-xs">{STATUS_CONFIG[s].label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Badge variant="outline" className="text-xs">{STYLE_LABELS[selectedAd.style]?.emoji} {STYLE_LABELS[selectedAd.style]?.label ?? selectedAd.style}</Badge>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2">
                    {selectedAd.imageUrl && (
                      <a href={selectedAd.imageUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="w-full h-8 text-xs">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Bild in voller Größe öffnen
                        </Button>
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs"
                      onClick={() => uploadToMetaMutation.mutate({ id: selectedAd.id, adAccountId: "act_1093241318940799" })}
                      disabled={uploadToMetaMutation.isPending || selectedAd.metaUploadStatus === "uploaded"}
                    >
                      {uploadToMetaMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                      {selectedAd.metaUploadStatus === "uploaded" ? "Auf Meta hochgeladen ✓" : "Zu Meta hochladen"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs text-destructive hover:text-destructive"
                      onClick={() => { deleteMutation.mutate({ id: selectedAd.id }); setSelectedAd(null); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Löschen
                    </Button>
                  </div>

                  {/* Headlines */}
                  <div>
                    <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      Headlines & Texte ({selectedAd.headlines.length})
                    </p>
                    <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {selectedAd.headlines.map((h, i) => (
                        <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-border/30">
                          <span className="text-[10px] text-muted-foreground/50 w-4 shrink-0">#{i + 1}</span>
                          <span className="text-xs flex-1">{h.text}</span>
                          <Select value={h.status} onValueChange={(v) => updateHeadlineStatusMutation.mutate({ id: h.id, status: v as AdStatus })}>
                            <SelectTrigger className="w-24 h-6 text-[10px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {statusGroups.map(s => (<SelectItem key={s} value={s} className="text-xs">{STATUS_CONFIG[s].label}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    {/* Add headline */}
                    <div className="flex gap-2 mt-2">
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
                      <Button size="sm" variant="outline" className="h-8" onClick={() => newHeadline.trim() && addHeadlineMutation.mutate({ imageAdId: selectedAd.id, text: newHeadline.trim() })}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
