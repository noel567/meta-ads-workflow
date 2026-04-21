import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Bot,
  Send,
  RefreshCw,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Settings2,
  History,
  CalendarDays,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type PostType = "mindset" | "recap" | "social_proof" | "scarcity" | "evening_recap";

const POST_TYPE_CONFIG: Record<PostType, { label: string; emoji: string; defaultTime: string; description: string }> = {
  mindset: {
    label: "Mindset",
    emoji: "🧠",
    defaultTime: "07:30",
    description: "Motivations- & Mindset-Post",
  },
  recap: {
    label: "Morning Recap",
    emoji: "📊",
    defaultTime: "10:00",
    description: "Marktausblick & Morning Recap",
  },
  social_proof: {
    label: "Social Proof",
    emoji: "🏆",
    defaultTime: "13:00",
    description: "Community-Erfolge & Social Proof",
  },
  scarcity: {
    label: "Scarcity / CTA",
    emoji: "⚡",
    defaultTime: "17:00",
    description: "Verknappung & Call-to-Action",
  },
  evening_recap: {
    label: "Evening Recap",
    emoji: "🌙",
    defaultTime: "20:00",
    description: "Abend-Zusammenfassung",
  },
};

const POST_TYPES: PostType[] = ["mindset", "recap", "social_proof", "scarcity", "evening_recap"];

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "sent") return (
    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1">
      <CheckCircle2 className="h-3 w-3" /> Gesendet
    </Badge>
  );
  if (status === "error") return (
    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1">
      <XCircle className="h-3 w-3" /> Fehler
    </Badge>
  );
  return (
    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1">
      <Clock className="h-3 w-3" /> Ausstehend
    </Badge>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCard({
  type,
  post,
  onGenerate,
  onSend,
  onDelete,
  isGenerating,
}: {
  type: PostType;
  post?: { id: number; text: string; status: string; scheduledAt: Date | string; sentAt?: Date | string | null };
  onGenerate: (type: PostType) => void;
  onSend: (postId: number) => void;
  onDelete: (postId: number) => void;
  isGenerating: boolean;
}) {
  const config = POST_TYPE_CONFIG[type];
  const [editText, setEditText] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const updateMutation = trpc.contentBot.updatePostText.useMutation({
    onSuccess: () => {
      toast.success("Text gespeichert");
      setEditText(null);
      utils.contentBot.getTodaysPosts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const scheduledTime = post?.scheduledAt
    ? new Date(post.scheduledAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })
    : config.defaultTime;

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{config.emoji}</span>
            <div>
              <CardTitle className="text-sm font-semibold">{config.label}</CardTitle>
              <p className="text-xs text-muted-foreground">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> {scheduledTime}
            </span>
            {post && <StatusBadge status={post.status} />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!post ? (
          <div className="flex flex-col items-center justify-center py-6 gap-3 border border-dashed border-border/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Noch kein Post generiert</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onGenerate(type)}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Generieren
            </Button>
          </div>
        ) : (
          <>
            {editText !== null ? (
              <div className="space-y-2">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[120px] text-sm font-mono resize-none bg-background/50"
                  placeholder="Post-Text..."
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => updateMutation.mutate({ postId: post.id, text: editText })}
                    disabled={updateMutation.isPending}
                    className="gap-1"
                  >
                    {updateMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                    Speichern
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditText(null)}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="text-sm whitespace-pre-wrap bg-background/30 rounded-lg p-3 border border-border/30 cursor-pointer hover:border-border/60 transition-colors min-h-[80px]"
                onClick={() => setEditText(post.text)}
                title="Klicken zum Bearbeiten"
              >
                {post.text}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {post.status !== "sent" && (
                <Button
                  size="sm"
                  onClick={() => onSend(post.id)}
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Send className="h-3.5 w-3.5" />
                  Jetzt senden
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onGenerate(type)}
                disabled={isGenerating}
                className="gap-1.5"
              >
                {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Neu generieren
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(post.id)}
                className="gap-1.5 text-destructive hover:text-destructive ml-auto"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {post.status === "sent" && post.sentAt && (
              <p className="text-xs text-muted-foreground">
                Gesendet um {new Date(post.sentAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel() {
  const { data: settings, isLoading } = trpc.contentBot.getSettings.useQuery();
  const utils = trpc.useUtils();

  // Local time state – initialised from server data once loaded
  const [localTimes, setLocalTimes] = useState<Record<string, string>>({});
  const [savingTime, setSavingTime] = useState<string | null>(null);

  // Sync local state when server data arrives
  const settingsRef = settings;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const [_synced] = useState(() => {
    // Initial value is set lazily – will be overridden by the effect below
    return false;
  });
  // Use a ref to avoid stale closure issues
  const [_initDone, setInitDone] = useState(false);
  if (!_initDone && settingsRef) {
    setLocalTimes({
      timeMindset: settingsRef.timeMindset ?? "07:30",
      timeRecap: settingsRef.timeRecap ?? "10:00",
      timeSocialProof: settingsRef.timeSocialProof ?? "13:00",
      timeScarcity: settingsRef.timeScarcity ?? "17:00",
      timeEveningRecap: settingsRef.timeEveningRecap ?? "20:00",
    });
    setInitDone(true);
  }

  const updateMutation = trpc.contentBot.updateSettings.useMutation({
    onSuccess: (_data, variables) => {
      const timeKey = Object.keys(variables).find((k) => k.startsWith("time"));
      if (timeKey) {
        toast.success(`Uhrzeit gespeichert`);
        setSavingTime(null);
      } else {
        toast.success("Einstellungen gespeichert");
      }
      utils.contentBot.getSettings.invalidate();
      utils.contentBot.getTodaysPosts.invalidate();
    },
    onError: (e) => {
      toast.error(e.message);
      setSavingTime(null);
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const handleToggle = (key: string, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  const handleTimeChange = (timeKey: string, value: string) => {
    setLocalTimes((prev) => ({ ...prev, [timeKey]: value }));
  };

  const handleTimeBlur = (timeKey: string) => {
    const value = localTimes[timeKey];
    if (!value) return;
    // Validate HH:MM format
    if (!/^\d{2}:\d{2}$/.test(value)) return;
    setSavingTime(timeKey);
    updateMutation.mutate({ [timeKey]: value });
  };

  const autoSendItems = [
    { key: "autoSendMindset", label: "Mindset", emoji: "🧠", timeKey: "timeMindset", description: "Motivations-Post" },
    { key: "autoSendRecap", label: "Morning Recap", emoji: "📊", timeKey: "timeRecap", description: "Marktausblick" },
    { key: "autoSendSocialProof", label: "Social Proof", emoji: "🏆", timeKey: "timeSocialProof", description: "Community-Erfolge" },
    { key: "autoSendScarcity", label: "Scarcity / CTA", emoji: "⚡", timeKey: "timeScarcity", description: "Verknappung & CTA" },
    { key: "autoSendEveningRecap", label: "Evening Recap", emoji: "🌙", timeKey: "timeEveningRecap", description: "Abend-Zusammenfassung" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/50 bg-card/50 p-4 space-y-1">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          Auto-Send & Posting-Zeiten
        </h3>
        <p className="text-xs text-muted-foreground">
          Lege die Uhrzeit pro Post-Typ fest und aktiviere Auto-Send. Der Scheduler prüft alle 5 Minuten ob ein Post fällig ist (±5 Min Toleranz).
        </p>
      </div>

      <div className="space-y-3">
        {autoSendItems.map((item) => {
          const isEnabled = settings?.[item.key as keyof typeof settings] as boolean ?? false;
          const currentTime = localTimes[item.timeKey] ?? (settings?.[item.timeKey as keyof typeof settings] as string ?? "");
          const isSavingThis = savingTime === item.timeKey;
          return (
            <Card key={item.key} className="border-border/50 bg-card/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  {/* Emoji + Label */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xl shrink-0">{item.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>

                  {/* Time input */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                      <input
                        type="time"
                        value={currentTime}
                        onChange={(e) => handleTimeChange(item.timeKey, e.target.value)}
                        onBlur={() => handleTimeBlur(item.timeKey)}
                        className="h-8 w-[110px] rounded-md border border-border/60 bg-background/60 px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors hover:border-border cursor-text"
                        disabled={isSavingThis}
                      />
                      {isSavingThis && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-md">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">Uhr</span>
                  </div>

                  {/* Divider */}
                  <div className="hidden sm:block h-6 w-px bg-border/50 shrink-0" />

                  {/* Auto-Send toggle */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Label htmlFor={item.key} className="text-xs text-muted-foreground cursor-pointer select-none">
                      {isEnabled ? (
                        <span className="text-emerald-400 font-medium">Auto</span>
                      ) : (
                        <span>Manuell</span>
                      )}
                    </Label>
                    <Switch
                      id={item.key}
                      checked={isEnabled}
                      onCheckedChange={(v) => handleToggle(item.key, v)}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <p className="text-xs text-amber-400">
          <strong>Hinweis:</strong> Posts gehen direkt in den Telegram-Kanal (TELEGRAM_CHAT_ID). Du kannst sie von dort manuell in den Hauptkanal weiterleiten.
        </p>
      </div>
    </div>
  );
}

// ─── History Panel ────────────────────────────────────────────────────────────
function HistoryPanel() {
  const { data: history, isLoading } = trpc.contentBot.getHistory.useQuery({ days: 7 });

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <History className="h-10 w-10 opacity-30" />
        <p className="text-sm">Noch keine Posts in den letzten 7 Tagen</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((post) => {
        const config = POST_TYPE_CONFIG[post.type as PostType];
        return (
          <Card key={post.id} className="border-border/50 bg-card/30">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-lg shrink-0">{config?.emoji ?? "📝"}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{config?.label ?? post.type}</span>
                      <StatusBadge status={post.status} />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{post.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(post.createdAt).toLocaleDateString("de-CH", {
                        weekday: "short", day: "numeric", month: "short",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ContentBot() {
  const utils = trpc.useUtils();
  const { data: todaysPosts, isLoading } = trpc.contentBot.getTodaysPosts.useQuery();

  const [generatingType, setGeneratingType] = useState<PostType | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const generateMutation = trpc.contentBot.generatePost.useMutation({
    onSuccess: () => {
      utils.contentBot.getTodaysPosts.invalidate();
      setGeneratingType(null);
      toast.success("Post generiert");
    },
    onError: (e) => {
      toast.error(e.message);
      setGeneratingType(null);
    },
  });

  const generateAllMutation = trpc.contentBot.generateAllToday.useMutation({
    onSuccess: (data) => {
      utils.contentBot.getTodaysPosts.invalidate();
      setIsGeneratingAll(false);
      toast.success(`${data.length} Posts generiert`);
    },
    onError: (e) => {
      toast.error(e.message);
      setIsGeneratingAll(false);
    },
  });

  const sendMutation = trpc.contentBot.sendPost.useMutation({
    onSuccess: (data) => {
      utils.contentBot.getTodaysPosts.invalidate();
      utils.contentBot.getHistory.invalidate();
      if (data.success) {
        toast.success("Post erfolgreich gesendet!");
      } else {
        toast.error("Telegram-Versand fehlgeschlagen");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.contentBot.deletePost.useMutation({
    onSuccess: () => {
      utils.contentBot.getTodaysPosts.invalidate();
      toast.success("Post gelöscht");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleGenerate = (type: PostType) => {
    setGeneratingType(type);
    generateMutation.mutate({ type });
  };

  const handleGenerateAll = () => {
    setIsGeneratingAll(true);
    generateAllMutation.mutate();
  };

  // Build a map of today's posts by type
  const postsByType: Partial<Record<PostType, typeof todaysPosts extends (infer T)[] | undefined ? T : never>> = {};
  if (todaysPosts) {
    for (const post of todaysPosts) {
      if (!postsByType[post.type as PostType]) {
        postsByType[post.type as PostType] = post as any;
      }
    }
  }

  const sentCount = todaysPosts?.filter((p) => p.status === "sent").length ?? 0;
  const totalCount = todaysPosts?.length ?? 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Content Bot</h1>
              <p className="text-sm text-muted-foreground">EasySignals Telegram Posts – 5 täglich im Livio-Stil</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {totalCount > 0 && (
              <div className="text-xs text-muted-foreground bg-card/50 border border-border/50 rounded-lg px-3 py-1.5">
                <span className="text-foreground font-medium">{sentCount}</span>/{totalCount} gesendet
              </div>
            )}
            <Button
              onClick={handleGenerateAll}
              disabled={isGeneratingAll}
              className="gap-2"
            >
              {isGeneratingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Alle heute generieren
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="today">
          <TabsList className="bg-card/50 border border-border/50">
            <TabsTrigger value="today" className="gap-2 text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              Heute
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 text-xs">
              <History className="h-3.5 w-3.5" />
              Verlauf (7 Tage)
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
              Einstellungen
            </TabsTrigger>
          </TabsList>

          {/* Today's Posts */}
          <TabsContent value="today" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {POST_TYPES.map((type) => (
                  <PostCard
                    key={type}
                    type={type}
                    post={postsByType[type] as any}
                    onGenerate={handleGenerate}
                    onSend={(id) => sendMutation.mutate({ postId: id })}
                    onDelete={(id) => deleteMutation.mutate({ postId: id })}
                    isGenerating={generatingType === type || isGeneratingAll}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="mt-4">
            <HistoryPanel />
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="mt-4">
            <SettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
