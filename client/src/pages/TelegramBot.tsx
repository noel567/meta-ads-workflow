import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Send, Sparkles, Trash2, RefreshCw, Settings, CheckCircle2,
  XCircle, Clock, Image as ImageIcon, MessageSquare, Zap
} from "lucide-react";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  tip: "💡 Trading-Tipp",
  insight: "📊 Markt-Insight",
  motivation: "🔥 Motivation",
  market_update: "📈 Marktupdate",
  signal_preview: "⚡ Signal-Preview",
  education: "🎓 Education",
  social_proof: "🏆 Social Proof",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  sent: "bg-green-500/20 text-green-400 border-green-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  scheduled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export default function TelegramBot() {
  const [selectedContentType, setSelectedContentType] = useState<string>("random");
  const [customTopic, setCustomTopic] = useState("");
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsHour, setSettingsHour] = useState(9);
  const [settingsMinute, setSettingsMinute] = useState(0);
  const [settingsActive, setSettingsActive] = useState(true);
  const [settingsEmoji, setSettingsEmoji] = useState(true);

  const utils = trpc.useUtils();

  const { data: posts = [], isLoading: postsLoading } = trpc.telegram.getPosts.useQuery();
  const { data: settings } = trpc.telegram.getSettings.useQuery();

  // Sync settings to local state when loaded
  useState(() => {
    if (settings) {
      setSettingsHour((settings as any).postingTimeHour ?? 9);
      setSettingsMinute((settings as any).postingTimeMinute ?? 0);
      setSettingsActive((settings as any).isActive ?? true);
      setSettingsEmoji((settings as any).includeEmoji ?? true);
    }
  });

  const generatePost = trpc.telegram.generatePost.useMutation({
    onSuccess: () => {
      utils.telegram.getPosts.invalidate();
      toast.success("✅ Post generiert! Bereit zum Senden.");
      setCustomTopic("");
    },
    onError: (e) => toast.error(e.message),
  });

  const sendPost = trpc.telegram.sendPost.useMutation({
    onSuccess: () => {
      utils.telegram.getPosts.invalidate();
      toast.success("🚀 Post wurde erfolgreich in Telegram gepostet!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePost = trpc.telegram.updatePost.useMutation({
    onSuccess: () => {
      utils.telegram.getPosts.invalidate();
      setEditingPostId(null);
      toast.success("✅ Gespeichert");
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePost = trpc.telegram.deletePost.useMutation({
    onSuccess: () => {
      utils.telegram.getPosts.invalidate();
      toast.success("🗑️ Gelöscht");
    },
    onError: (e) => toast.error(e.message),
  });

  const saveSettings = trpc.telegram.saveSettings.useMutation({
    onSuccess: () => {
      utils.telegram.getSettings.invalidate();
      toast.success("✅ Einstellungen gespeichert");
      setShowSettings(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const testConnection = trpc.telegram.testConnection.useMutation({
    onSuccess: (d) => toast.success(`✅ Verbindung OK – Bot: @${d.botName} | Chat: ${d.chatId}`),
    onError: (e) => toast.error(`❌ Verbindung fehlgeschlagen: ${e.message}`),
  });

  const runDailyPost = trpc.telegram.runDailyPost.useMutation({
    onSuccess: (d: any) => {
      utils.telegram.getPosts.invalidate();
      if (d.skipped) {
        toast.info(`⏭️ Übersprungen: ${d.reason}`);
      } else {
        toast.success("🤖 Täglicher Post generiert und gesendet!");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const draftPosts = posts.filter((p: any) => p.status === "draft");
  const sentPosts = posts.filter((p: any) => p.status === "sent");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-400" />
            Telegram Content Bot
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            KI generiert täglich EasySignals-Posts auf Berndeutsch – Bild + Text, direkt in deine Gruppe.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => testConnection.mutate()} disabled={testConnection.isPending}>
            <Zap className="w-4 h-4 mr-1" />
            {testConnection.isPending ? "Teste..." : "Bot testen"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="w-4 h-4 mr-1" />
            Einstellungen
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="text-base">Auto-Post Einstellungen</CardTitle>
            <CardDescription>Täglich um diese Uhrzeit wird automatisch ein Post generiert und gesendet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label>Uhrzeit:</Label>
                <Input
                  type="number" min={0} max={23} value={settingsHour}
                  onChange={e => setSettingsHour(Number(e.target.value))}
                  className="w-16 text-center"
                />
                <span className="text-muted-foreground">:</span>
                <Input
                  type="number" min={0} max={59} value={settingsMinute}
                  onChange={e => setSettingsMinute(Number(e.target.value))}
                  className="w-16 text-center"
                />
                <span className="text-muted-foreground text-sm">Uhr (Schweizer Zeit)</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={settingsActive} onCheckedChange={setSettingsActive} />
              <Label>Auto-Post aktiv</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={settingsEmoji} onCheckedChange={setSettingsEmoji} />
              <Label>Emojis verwenden</Label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveSettings.mutate({ postingTimeHour: settingsHour, postingTimeMinute: settingsMinute, isActive: settingsActive, includeEmoji: settingsEmoji })} disabled={saveSettings.isPending}>
                {saveSettings.isPending ? "Speichert..." : "Speichern"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowSettings(false)}>Abbrechen</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-foreground">{draftPosts.length}</div>
            <div className="text-xs text-muted-foreground">Entwürfe</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-400">{sentPosts.length}</div>
            <div className="text-xs text-muted-foreground">Gesendet</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-400">
              {settings ? `${String(settingsHour).padStart(2, "0")}:${String(settingsMinute).padStart(2, "0")}` : "09:00"}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Täglicher Auto-Post
              {settingsActive ? <span className="text-green-400 ml-1">● aktiv</span> : <span className="text-red-400 ml-1">● inaktiv</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            Neuen Post generieren
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3 flex-wrap">
            <Select value={selectedContentType} onValueChange={setSelectedContentType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Content-Typ (zufällig)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="random">🎲 Zufällig</SelectItem>
                {Object.entries(CONTENT_TYPE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Optionales Thema (z.B. 'Gold bricht ATH')"
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              className="flex-1 min-w-48"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => generatePost.mutate({ contentType: (selectedContentType === 'random' ? undefined : selectedContentType) as any, customTopic: customTopic || undefined })}
              disabled={generatePost.isPending}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generatePost.isPending ? "Generiert... (~20s)" : "Post generieren"}
            </Button>
            <Button
              variant="outline"
              onClick={() => runDailyPost.mutate()}
              disabled={runDailyPost.isPending}
            >
              <Zap className="w-4 h-4 mr-2" />
              {runDailyPost.isPending ? "Läuft..." : "Jetzt täglichen Post senden"}
            </Button>
          </div>
          {generatePost.isPending && (
            <p className="text-xs text-muted-foreground animate-pulse">
              KI schreibt Berndeutsch-Text + generiert passendes Bild...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Draft Posts */}
      {draftPosts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Entwürfe – bereit zum Senden</h2>
          {draftPosts.map((post: any) => (
            <Card key={post.id} className="border-yellow-500/20">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={STATUS_COLORS[post.status]}>
                      {post.status === "draft" ? "Entwurf" : post.status}
                    </Badge>
                    {post.contentType && (
                      <Badge variant="outline" className="text-xs">
                        {CONTENT_TYPE_LABELS[post.contentType] ?? post.contentType}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(post.createdAt).toLocaleString("de-CH")}
                    </span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => sendPost.mutate({ id: post.id })}
                      disabled={sendPost.isPending}
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <Send className="w-3 h-3 mr-1" />
                      {sendPost.isPending ? "Sendet..." : "Senden"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditingPostId(post.id); setEditText(post.textContent); }}>
                      Bearbeiten
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deletePost.mutate({ id: post.id })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Image Preview */}
                {post.imageUrl && (
                  <div className="rounded-lg overflow-hidden max-w-sm">
                    <img src={post.imageUrl} alt="Post Bild" className="w-full h-40 object-cover" />
                  </div>
                )}
                {!post.imageUrl && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ImageIcon className="w-3 h-3" />
                    Kein Bild generiert
                  </div>
                )}

                {/* Text */}
                {editingPostId === post.id ? (
                  <div className="space-y-2">
                    <Textarea value={editText} onChange={e => setEditText(e.target.value)} rows={5} className="text-sm" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updatePost.mutate({ id: post.id, textContent: editText })} disabled={updatePost.isPending}>
                        Speichern
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingPostId(null)}>Abbrechen</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{post.textContent}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sent Posts History */}
      {sentPosts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Verlauf – gesendet</h2>
          {sentPosts.slice(0, 10).map((post: any) => (
            <Card key={post.id} className="border-green-500/10 opacity-80">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start gap-3">
                  {post.imageUrl && (
                    <img src={post.imageUrl} alt="" className="w-16 h-16 rounded object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                      <span className="text-xs text-green-400">Gesendet</span>
                      {post.contentType && (
                        <span className="text-xs text-muted-foreground">{CONTENT_TYPE_LABELS[post.contentType] ?? post.contentType}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {post.sentAt ? new Date(post.sentAt).toLocaleString("de-CH") : ""}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{post.textContent}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deletePost.mutate({ id: post.id })} className="shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!postsLoading && posts.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-10 pb-10 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Noch keine Posts generiert.</p>
            <p className="text-muted-foreground text-xs mt-1">Klicke auf "Post generieren" um loszulegen.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
