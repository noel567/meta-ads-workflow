import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Video, Play, FileText, Brain, Sparkles, Upload, Trash2,
  ChevronDown, ChevronUp, Copy, ExternalLink, Loader2,
  CheckCircle2, AlertCircle, Clock, Download
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:      { label: "Wartend",       color: "bg-slate-500/20 text-slate-400",   icon: <Clock className="w-3 h-3" /> },
  downloading:  { label: "Download...",   color: "bg-blue-500/20 text-blue-400",     icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  downloaded:   { label: "Heruntergeladen", color: "bg-blue-500/20 text-blue-400",   icon: <CheckCircle2 className="w-3 h-3" /> },
  transcribing: { label: "Transkription...", color: "bg-violet-500/20 text-violet-400", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  transcribed:  { label: "Transkribiert", color: "bg-violet-500/20 text-violet-400", icon: <CheckCircle2 className="w-3 h-3" /> },
  analyzing:    { label: "Analyse...",    color: "bg-amber-500/20 text-amber-400",   icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  analyzed:     { label: "Analysiert",   color: "bg-amber-500/20 text-amber-400",   icon: <CheckCircle2 className="w-3 h-3" /> },
  adapting:     { label: "Adaption...",  color: "bg-emerald-500/20 text-emerald-400", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed:    { label: "Fertig",       color: "bg-emerald-500/20 text-emerald-400", icon: <CheckCircle2 className="w-3 h-3" /> },
  failed:       { label: "Fehler",       color: "bg-red-500/20 text-red-400",        icon: <AlertCircle className="w-3 h-3" /> },
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok", other: "Andere",
};

function PipelineSteps({ status }: { status: string }) {
  const steps = [
    { key: "downloading", label: "Download" },
    { key: "transcribing", label: "Transkript" },
    { key: "analyzing", label: "Analyse" },
    { key: "adapting", label: "Adaption" },
    { key: "completed", label: "Fertig" },
  ];
  const order = ["pending", "downloading", "downloaded", "transcribing", "transcribed", "analyzing", "analyzed", "adapting", "completed", "failed"];
  const currentIdx = order.indexOf(status);

  return (
    <div className="flex items-center gap-1 mt-2">
      {steps.map((step, i) => {
        const stepIdx = order.indexOf(step.key);
        const done = currentIdx > stepIdx || status === "completed";
        const active = status === step.key || (step.key === "downloading" && status === "downloaded") ||
          (step.key === "transcribing" && status === "transcribed") ||
          (step.key === "analyzing" && status === "analyzed");
        const failed = status === "failed";
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-all ${
              failed ? "bg-red-500/10 text-red-400" :
              done ? "bg-emerald-500/20 text-emerald-400" :
              active ? "bg-blue-500/20 text-blue-400" :
              "bg-slate-800 text-slate-500"
            }`}>
              {active && !done && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
              {done && <CheckCircle2 className="w-2.5 h-2.5" />}
              {step.label}
            </div>
            {i < steps.length - 1 && <div className="w-3 h-px bg-slate-700" />}
          </div>
        );
      })}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 text-xs text-slate-400 hover:text-white"
      onClick={() => { navigator.clipboard.writeText(text); toast.success(`${label} kopiert`); }}
    >
      <Copy className="w-3 h-3" />
      Kopieren
    </Button>
  );
}

function VideoResearchCard({ item, onRefresh }: { item: any; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("transcript");

  const processMutation = trpc.videoResearch.process.useMutation({
    onSuccess: () => { toast.success("Pipeline gestartet!"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });
  const exportMutation = trpc.videoResearch.exportToDrive.useMutation({
    onSuccess: (d) => {
      toast.success(
        <div className="flex flex-col gap-1">
          <span>Zu Google Drive exportiert!</span>
          {d.driveUrl && <a href={d.driveUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">Drive öffnen →</a>}
        </div>
      );
      onRefresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.videoResearch.delete.useMutation({
    onSuccess: () => { toast.success("Gelöscht"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  const isProcessing = ["downloading", "transcribing", "analyzing", "adapting"].includes(item.status);
  const isCompleted = item.status === "completed";

  return (
    <Card className="bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                {PLATFORM_LABELS[item.platform] || item.platform}
              </Badge>
              {item.competitorName && (
                <span className="text-sm font-semibold text-white">{item.competitorName}</span>
              )}
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                {cfg.icon}
                {cfg.label}
              </span>
            </div>
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-slate-300 truncate block mt-1 max-w-md"
            >
              {item.sourceUrl}
            </a>
            <PipelineSteps status={item.status} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {item.status === "pending" && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700"
                onClick={() => processMutation.mutate({ id: item.id })}
                disabled={processMutation.isPending}
              >
                {processMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Pipeline starten
              </Button>
            )}
            {item.status === "failed" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs border-slate-700"
                onClick={() => processMutation.mutate({ id: item.id })}
                disabled={processMutation.isPending}
              >
                Erneut versuchen
              </Button>
            )}
            {isCompleted && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs border-slate-700"
                onClick={() => exportMutation.mutate({ id: item.id })}
                disabled={exportMutation.isPending}
              >
                {exportMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Drive
              </Button>
            )}
            {isCompleted && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-slate-400"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-slate-600 hover:text-red-400"
              onClick={() => deleteMutation.mutate({ id: item.id })}
              disabled={deleteMutation.isPending || isProcessing}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        {item.status === "failed" && item.errorMessage && (
          <p className="text-xs text-red-400 mt-1 bg-red-500/10 rounded p-2">{item.errorMessage}</p>
        )}
      </CardHeader>

      {isCompleted && expanded && (
        <CardContent className="pt-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-800 border border-slate-700 h-8">
              <TabsTrigger value="transcript" className="text-xs h-7 gap-1">
                <FileText className="w-3 h-3" /> Transkript
              </TabsTrigger>
              <TabsTrigger value="analysis" className="text-xs h-7 gap-1">
                <Brain className="w-3 h-3" /> Analyse
              </TabsTrigger>
              <TabsTrigger value="adaptation" className="text-xs h-7 gap-1">
                <Sparkles className="w-3 h-3" /> EasySignals
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transcript" className="mt-3 space-y-3">
              {item.transcriptHook && (
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Hook</span>
                    <CopyButton text={item.transcriptHook} label="Hook" />
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{item.transcriptHook}</p>
                </div>
              )}
              {item.transcriptBody && (
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Body</span>
                    <CopyButton text={item.transcriptBody} label="Body" />
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{item.transcriptBody}</p>
                </div>
              )}
              {item.transcriptCta && (
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">CTA</span>
                    <CopyButton text={item.transcriptCta} label="CTA" />
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{item.transcriptCta}</p>
                </div>
              )}
              {item.transcript && !item.transcriptHook && (
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Vollständiges Transkript</span>
                    <CopyButton text={item.transcript} label="Transkript" />
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{item.transcript}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="analysis" className="mt-3 space-y-3">
              {[
                { key: "analysisAngle", label: "Angle / Psychologischer Trigger", color: "text-amber-400" },
                { key: "analysisTargetAudience", label: "Zielgruppe", color: "text-blue-400" },
                { key: "analysisMechanic", label: "Mechanik & Struktur", color: "text-violet-400" },
                { key: "analysisOfferStructure", label: "Offer-Struktur", color: "text-emerald-400" },
                { key: "analysisWhyItWorks", label: "Warum es funktioniert", color: "text-rose-400" },
                { key: "analysisVisualPattern", label: "Visual-Pattern & Schnitt", color: "text-slate-400" },
              ].map(({ key, label, color }) => item[key] && (
                <div key={key} className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</span>
                    <CopyButton text={item[key]} label={label} />
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{item[key]}</p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="adaptation" className="mt-3 space-y-3">
              <div className="grid grid-cols-1 gap-3">
                {[
                  { key: "adaptHook1", label: "Hook 1 – Neugier", color: "text-amber-400" },
                  { key: "adaptHook2", label: "Hook 2 – Pain/Problem", color: "text-red-400" },
                  { key: "adaptHook3", label: "Hook 3 – Transformation", color: "text-emerald-400" },
                ].map(({ key, label, color }) => item[key] && (
                  <div key={key} className="bg-slate-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</span>
                      <CopyButton text={item[key]} label={label} />
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">{item[key]}</p>
                  </div>
                ))}
              </div>
              {item.adaptBody && (
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Body</span>
                    <CopyButton text={item.adaptBody} label="Body" />
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{item.adaptBody}</p>
                </div>
              )}
              {item.adaptCta && (
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">CTA</span>
                    <CopyButton text={item.adaptCta} label="CTA" />
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{item.adaptCta}</p>
                </div>
              )}
              {item.adaptHeygenScript && (
                <div className="bg-gradient-to-r from-violet-500/10 to-blue-500/10 border border-violet-500/20 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-violet-400 uppercase tracking-wide">HeyGen Avatar-Skript</span>
                    <CopyButton text={item.adaptHeygenScript} label="HeyGen-Skript" />
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{item.adaptHeygenScript}</p>
                </div>
              )}
              {item.adaptTelegramPost && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Telegram-Post</span>
                    <CopyButton text={item.adaptTelegramPost} label="Telegram-Post" />
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{item.adaptTelegramPost}</p>
                </div>
              )}
              {item.adaptNanaBananaPrompt && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Nano-Banana Bildprompt</span>
                    <CopyButton text={item.adaptNanaBananaPrompt} label="Nano-Banana-Prompt" />
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{item.adaptNanaBananaPrompt}</p>
                </div>
              )}
              {item.fileName && (
                <div className="bg-slate-800/30 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block">Dateiname</span>
                    <span className="text-sm font-mono text-slate-300">{item.fileName}.md</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Drive-Ordner</span>
                    <span className="text-xs font-mono text-slate-400">{item.driveFolderPath}</span>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}

export default function VideoResearch() {
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<"facebook" | "instagram" | "youtube" | "tiktok" | "other">("facebook");
  const [competitorName, setCompetitorName] = useState("");
  const [notes, setNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterCompetitor, setFilterCompetitor] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");

  const { data: items = [], refetch, isLoading } = trpc.videoResearch.list.useQuery();
  const { data: competitors = [] } = trpc.competitors.list.useQuery();

  const submitMutation = trpc.videoResearch.submit.useMutation({
    onSuccess: async (data) => {
      toast.success("Video eingereicht! Klicke auf 'Pipeline starten' um zu beginnen.");
      setUrl("");
      setCompetitorName("");
      setNotes("");
      await refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!url.trim()) { toast.error("Bitte eine URL eingeben"); return; }
    submitMutation.mutate({
      sourceUrl: url.trim(),
      platform,
      competitorName: competitorName.trim() || undefined,
      language: "de",
      notes: notes.trim() || undefined,
    });
  };

  const filtered = items.filter((i: any) => {
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (filterPlatform !== "all" && i.platform !== filterPlatform) return false;
    if (filterCompetitor !== "all" && (i.competitorName || "") !== filterCompetitor) return false;
    if (filterDate !== "all") {
      const created = new Date(i.createdAt);
      const now = new Date();
      if (filterDate === "today") {
        if (created.toDateString() !== now.toDateString()) return false;
      } else if (filterDate === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (created < weekAgo) return false;
      } else if (filterDate === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (created < monthAgo) return false;
      }
    }
    return true;
  });

  // Unique competitors and platforms from data
  const uniqueCompetitors = Array.from(new Set(items.map((i: any) => i.competitorName).filter(Boolean))) as string[];
  const usedPlatforms = Array.from(new Set(items.map((i: any) => i.platform).filter(Boolean))) as string[];
  const stats = {
    total: items.length,
    completed: items.filter((i: any) => i.status === "completed").length,
    processing: items.filter((i: any) => ["downloading", "transcribing", "analyzing", "adapting"].includes(i.status)).length,
    failed: items.filter((i: any) => i.status === "failed").length,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Video className="w-6 h-6 text-blue-400" />
            Video Research Pipeline
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Konkurrenz-Videos erfassen → Transkribieren → Analysieren → EasySignals-Adaptionen erstellen
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Gesamt", value: stats.total, color: "text-slate-300" },
          { label: "Fertig", value: stats.completed, color: "text-emerald-400" },
          { label: "In Arbeit", value: stats.processing, color: "text-blue-400" },
          { label: "Fehler", value: stats.failed, color: "text-red-400" },
        ].map(s => (
          <Card key={s.label} className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-3 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submit Form */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="w-4 h-4 text-blue-400" />
            Neue Konkurrenz-Ad einreichen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Video-URL (Facebook Ad Library, YouTube, TikTok, Instagram...)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
            <Select value={platform} onValueChange={(v) => setPlatform(v as any)}>
              <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {Object.entries(PLATFORM_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v} className="text-slate-200">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <Input
              placeholder="Konkurrent (z.B. Fredtrading original)"
              value={competitorName}
              onChange={(e) => setCompetitorName(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 flex-1"
            />
            <Input
              placeholder="Notizen (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 flex-1"
            />
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-300">Pipeline-Ablauf:</p>
            <p>1. <strong className="text-blue-400">Download</strong> – yt-dlp lädt das Video herunter (Facebook, YouTube, TikTok, Instagram)</p>
            <p>2. <strong className="text-violet-400">Transkription</strong> – Whisper AI extrahiert den gesprochenen Text</p>
            <p>3. <strong className="text-amber-400">Analyse</strong> – KI analysiert Hook, Body, CTA, Mechanik, Zielgruppe und Offer-Struktur</p>
            <p>4. <strong className="text-emerald-400">EasySignals-Adaption</strong> – 3 Hooks, Body, CTA, HeyGen-Skript, Telegram-Post, Nano-Banana-Prompt</p>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending || !url.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Video einreichen
          </Button>
        </CardContent>
      </Card>

      {/* Filter */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-slate-900/40 border border-slate-800 rounded-lg p-3">
          <span className="text-xs font-medium text-slate-400">Filter:</span>

          {/* Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Status:</span>
            <div className="flex gap-1">
              {["all", "pending", "completed", "failed"].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterStatus === s
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {s === "all" ? "Alle" : STATUS_CONFIG[s]?.label || s}
                </button>
              ))}
            </div>
          </div>

          {/* Platform */}
          {usedPlatforms.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Plattform:</span>
              <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                <SelectTrigger className="h-7 w-32 bg-slate-800 border-slate-700 text-xs text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="all" className="text-slate-200 text-xs">Alle</SelectItem>
                  {usedPlatforms.map(p => (
                    <SelectItem key={p} value={p} className="text-slate-200 text-xs">{PLATFORM_LABELS[p] || p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Competitor */}
          {uniqueCompetitors.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Konkurrent:</span>
              <Select value={filterCompetitor} onValueChange={setFilterCompetitor}>
                <SelectTrigger className="h-7 w-40 bg-slate-800 border-slate-700 text-xs text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="all" className="text-slate-200 text-xs">Alle</SelectItem>
                  {uniqueCompetitors.map(c => (
                    <SelectItem key={c} value={c} className="text-slate-200 text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Zeitraum:</span>
            <Select value={filterDate} onValueChange={setFilterDate}>
              <SelectTrigger className="h-7 w-28 bg-slate-800 border-slate-700 text-xs text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                <SelectItem value="all" className="text-slate-200 text-xs">Alle</SelectItem>
                <SelectItem value="today" className="text-slate-200 text-xs">Heute</SelectItem>
                <SelectItem value="week" className="text-slate-200 text-xs">Diese Woche</SelectItem>
                <SelectItem value="month" className="text-slate-200 text-xs">Dieser Monat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset */}
          {(filterStatus !== "all" || filterPlatform !== "all" || filterCompetitor !== "all" || filterDate !== "all") && (
            <button
              onClick={() => { setFilterStatus("all"); setFilterPlatform("all"); setFilterCompetitor("all"); setFilterDate("all"); }}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors ml-auto"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-slate-900/40 border-slate-800 border-dashed">
          <CardContent className="py-12 text-center">
            <Video className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              {items.length === 0
                ? "Noch keine Videos eingereicht. Füge oben eine Konkurrenz-Ad-URL ein."
                : "Keine Videos mit diesem Filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item: any) => (
            <VideoResearchCard key={item.id} item={item} onRefresh={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
