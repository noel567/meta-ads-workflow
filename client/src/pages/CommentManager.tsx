import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  MessageSquare, RefreshCw, Sparkles, Send, EyeOff, Check,
  ThumbsUp, ThumbsDown, Minus, AlertTriangle, Loader2, X
} from "lucide-react";

type StatusFilter = "all" | "new" | "replied" | "hidden" | "ignored";
type SentimentFilter = "all" | "positive" | "neutral" | "negative";
type Tone = "friendly" | "professional" | "enthusiastic";

export default function CommentManager() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [selectedComment, setSelectedComment] = useState<any>(null);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [tone, setTone] = useState<Tone>("friendly");

  const utils = trpc.useUtils();

  const { data: stats } = trpc.commentManager.stats.useQuery(undefined, { refetchInterval: 30000 });
  const { data: listData, isLoading } = trpc.commentManager.list.useQuery(
    { status: statusFilter, sentiment: sentimentFilter, limit: 100 },
    { refetchInterval: 60000 }
  );
  const comments = listData?.comments ?? [];

  const syncMutation = trpc.commentManager.syncComments.useMutation({
    onSuccess: (data) => {
      toast.success(`Sync abgeschlossen: ${data.newComments} neue Kommentare geladen`);
      utils.commentManager.list.invalidate();
      utils.commentManager.stats.invalidate();
    },
    onError: (e) => toast.error(`Sync fehlgeschlagen: ${e.message}`),
  });

  const generateReplyMutation = trpc.commentManager.generateReply.useMutation({
    onSuccess: (data) => {
      setReplyText(data.aiReply);
      utils.commentManager.list.invalidate();
    },
    onError: (e) => toast.error(`KI-Fehler: ${e.message}`),
  });

  const sendReplyMutation = trpc.commentManager.sendReply.useMutation({
    onSuccess: () => {
      toast.success("Antwort gesendet ✅");
      setReplyDialogOpen(false);
      setSelectedComment(null);
      setReplyText("");
      utils.commentManager.list.invalidate();
      utils.commentManager.stats.invalidate();
    },
    onError: (e) => toast.error(`Senden fehlgeschlagen: ${e.message}`),
  });

  const hideMutation = trpc.commentManager.hideComment.useMutation({
    onSuccess: () => {
      toast.success("Kommentar versteckt");
      utils.commentManager.list.invalidate();
      utils.commentManager.stats.invalidate();
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const ignoreMutation = trpc.commentManager.ignoreComment.useMutation({
    onSuccess: () => {
      utils.commentManager.list.invalidate();
      utils.commentManager.stats.invalidate();
    },
  });

  const bulkHideMutation = trpc.commentManager.bulkHideNegative.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.hidden} negative Kommentare versteckt`);
      utils.commentManager.list.invalidate();
      utils.commentManager.stats.invalidate();
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  function openReplyDialog(comment: any) {
    setSelectedComment(comment);
    setReplyText(comment.aiReply ?? "");
    setReplyDialogOpen(true);
  }

  function sentimentBadge(sentiment: string) {
    if (sentiment === "positive") return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
        <ThumbsUp className="w-3 h-3" /> Positiv
      </Badge>
    );
    if (sentiment === "negative") return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
        <ThumbsDown className="w-3 h-3" /> Negativ
      </Badge>
    );
    return (
      <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 gap-1">
        <Minus className="w-3 h-3" /> Neutral
      </Badge>
    );
  }

  function statusBadge(status: string) {
    const map: Record<string, { label: string; cls: string }> = {
      new: { label: "Neu", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      replied: { label: "Beantwortet", cls: "bg-green-500/20 text-green-400 border-green-500/30" },
      hidden: { label: "Versteckt", cls: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
      ignored: { label: "Ignoriert", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    };
    const s = map[status] ?? map.new;
    return <Badge className={`${s.cls} text-xs`}>{s.label}</Badge>;
  }

  function platformBadge(platform: string) {
    return platform === "instagram"
      ? <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30 text-xs">Instagram</Badge>
      : <Badge className="bg-blue-600/20 text-blue-300 border-blue-600/30 text-xs">Facebook</Badge>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-purple-400" />
            Comment Manager
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Meta-Kommentare überwachen, KI-Antworten generieren und moderieren
          </p>
        </div>
        <div className="flex gap-2">
          {(stats?.negative ?? 0) > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => bulkHideMutation.mutate()}
              disabled={bulkHideMutation.isPending}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              {bulkHideMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
              {stats?.negative} Negative verstecken
            </Button>
          )}
          <Button
            onClick={() => syncMutation.mutate({})}
            disabled={syncMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {syncMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Kommentare laden
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: "Gesamt", value: stats.total, color: "text-white" },
            { label: "Neu", value: stats.new, color: "text-blue-400" },
            { label: "Beantwortet", value: stats.replied, color: "text-green-400" },
            { label: "Versteckt", value: stats.hidden, color: "text-gray-400" },
            { label: "Positiv", value: stats.positive, color: "text-green-400" },
            { label: "Neutral", value: stats.neutral, color: "text-gray-400" },
            { label: "Negativ", value: stats.negative, color: "text-red-400" },
          ].map((s) => (
            <Card key={s.label} className="bg-gray-800/50 border-gray-700/50">
              <CardContent className="p-3 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList className="bg-gray-800 border border-gray-700">
            <TabsTrigger value="all">Alle</TabsTrigger>
            <TabsTrigger value="new">Neu</TabsTrigger>
            <TabsTrigger value="replied">Beantwortet</TabsTrigger>
            <TabsTrigger value="hidden">Versteckt</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={sentimentFilter} onValueChange={(v) => setSentimentFilter(v as SentimentFilter)}>
          <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Sentiments</SelectItem>
            <SelectItem value="positive">Positiv</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="negative">Negativ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Kommentar-Liste */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      ) : comments.length === 0 ? (
        <Card className="bg-gray-800/50 border-gray-700/50">
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Keine Kommentare gefunden</p>
            <p className="text-gray-600 text-sm mt-1">Klicke auf "Kommentare laden" um Meta-Kommentare zu synchronisieren</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <Card
              key={comment.id}
              className={`bg-gray-800/50 border-gray-700/50 transition-all hover:border-gray-600/50 ${
                comment.sentiment === "negative" ? "border-l-2 border-l-red-500/50" :
                comment.sentiment === "positive" ? "border-l-2 border-l-green-500/50" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Meta-Info */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-white font-medium text-sm">{comment.authorName ?? "Unbekannt"}</span>
                      {sentimentBadge(comment.sentiment ?? "neutral")}
                      {statusBadge(comment.status)}
                      {platformBadge(comment.platform)}
                      {comment.adName && (
                        <span className="text-xs text-gray-500 truncate max-w-[200px]">{comment.adName}</span>
                      )}
                    </div>
                    {/* Kommentar-Text */}
                    <p className="text-gray-300 text-sm leading-relaxed">{comment.message}</p>
                    {/* Gesendete Antwort */}
                    {comment.sentReply && (
                      <div className="mt-2 pl-3 border-l-2 border-green-500/40">
                        <p className="text-xs text-gray-500 mb-1">Deine Antwort:</p>
                        <p className="text-green-300 text-sm">{comment.sentReply}</p>
                      </div>
                    )}
                    {/* Datum */}
                    <p className="text-xs text-gray-600 mt-2">
                      {comment.metaCreatedAt
                        ? new Date(comment.metaCreatedAt).toLocaleString("de-CH")
                        : new Date(comment.createdAt).toLocaleString("de-CH")}
                    </p>
                  </div>
                  {/* Aktionen */}
                  {comment.status === "new" && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => openReplyDialog(comment)}
                        className="bg-purple-600 hover:bg-purple-700 text-xs"
                      >
                        <Sparkles className="w-3 h-3 mr-1" /> KI-Antwort
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => hideMutation.mutate({ commentId: comment.id })}
                        disabled={hideMutation.isPending}
                        className="border-gray-600 text-gray-400 hover:bg-gray-700 text-xs"
                      >
                        <EyeOff className="w-3 h-3 mr-1" /> Verstecken
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => ignoreMutation.mutate({ commentId: comment.id })}
                        className="text-gray-600 hover:text-gray-400 text-xs"
                      >
                        <X className="w-3 h-3 mr-1" /> Ignorieren
                      </Button>
                    </div>
                  )}
                  {comment.status === "replied" && (
                    <Check className="w-5 h-5 text-green-400 shrink-0 mt-1" />
                  )}
                  {comment.status === "hidden" && (
                    <EyeOff className="w-5 h-5 text-gray-500 shrink-0 mt-1" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* KI-Antwort Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              KI-Antwort generieren
            </DialogTitle>
          </DialogHeader>

          {selectedComment && (
            <div className="space-y-4">
              {/* Original Kommentar */}
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">{selectedComment.authorName} schreibt:</p>
                <p className="text-gray-300 text-sm">{selectedComment.message}</p>
              </div>

              {/* Ton-Auswahl */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400 shrink-0">Ton:</span>
                <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Freundlich</SelectItem>
                    <SelectItem value="professional">Professionell</SelectItem>
                    <SelectItem value="enthusiastic">Enthusiastisch</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => generateReplyMutation.mutate({ commentId: selectedComment.id, tone })}
                  disabled={generateReplyMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700 shrink-0"
                >
                  {generateReplyMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Sparkles className="w-4 h-4" />}
                </Button>
              </div>

              {/* Antwort-Textfeld */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Antwort (bearbeitbar):</label>
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="KI-Vorschlag erscheint hier – du kannst ihn bearbeiten..."
                  className="bg-gray-800 border-gray-700 text-white resize-none min-h-[100px]"
                />
                <p className="text-xs text-gray-600 mt-1">{replyText.length} / 2000 Zeichen</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setReplyDialogOpen(false)}
              className="border-gray-700 text-gray-400"
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => {
                if (selectedComment && replyText.trim()) {
                  sendReplyMutation.mutate({ commentId: selectedComment.id, replyText });
                }
              }}
              disabled={!replyText.trim() || sendReplyMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {sendReplyMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                : <Send className="w-4 h-4 mr-1" />}
              Antwort senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
