import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import {
  RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Zap, Target, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight,
  Lightbulb, ChevronRight, Loader2, Play, MessageSquare, Trash2,
  ExternalLink, Eye, MousePointer, Users, Send, PencilLine, X
} from "lucide-react";
import { toast } from "sonner";

const DATE_PRESETS = [
  { value: "last_7d", label: "Letzte 7 Tage" },
  { value: "last_14d", label: "Letzte 14 Tage" },
  { value: "last_30d", label: "Letzte 30 Tage" },
  { value: "last_90d", label: "Letzte 90 Tage" },
  { value: "maximum", label: "Gesamter Zeitraum" },
];

function ScoreRing({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? "#22c55e" : score >= 5 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold" style={{ color }}>{score.toFixed(1)}</div>
        <div className="text-xs text-muted-foreground">/10</div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, trend, icon: Icon, color = "blue" }: {
  label: string; value: string; sub?: string; trend?: "up" | "down" | "neutral";
  icon: React.ElementType; color?: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400",
    green: "bg-green-500/10 text-green-400",
    amber: "bg-amber-500/10 text-amber-400",
    purple: "bg-purple-500/10 text-purple-400",
    red: "bg-red-500/10 text-red-400",
  };
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold text-white truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ml-3 flex-shrink-0 ${colors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1">
            {trend === "up" ? <ArrowUpRight className="w-3 h-3 text-green-400" /> : trend === "down" ? <ArrowDownRight className="w-3 h-3 text-red-400" /> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "high") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Hoch</Badge>;
  if (priority === "medium") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Mittel</Badge>;
  return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-xs">Niedrig</Badge>;
}

// ─── Creative Detail Sheet ────────────────────────────────────────────────────
function CreativeDetailSheet({ ad, open, onClose }: { ad: any | null; open: boolean; onClose: () => void }) {
  const [commentText, setCommentText] = useState("");
  const [showBudgetEditor, setShowBudgetEditor] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [showBudgetConfirm, setShowBudgetConfirm] = useState(false);
  const utils = trpc.useUtils();

  // Budget abrufen (nur wenn campaignId vorhanden und Sheet offen)
  const { data: budgetData, refetch: refetchBudget } = trpc.metaInsights.getCampaignBudget.useQuery(
    { campaignId: ad?.campaignId ?? "" },
    { enabled: !!ad?.campaignId && open, retry: false }
  );

  const updateBudget = trpc.metaInsights.updateCampaignBudget.useMutation({
    onSuccess: (d) => {
      const chf = (d.newDailyBudgetCents / 100).toFixed(2);
      toast.success(`✅ Budget auf CHF ${chf}/Tag gesetzt`);
      setShowBudgetEditor(false);
      setBudgetInput("");
      refetchBudget();
    },
    onError: (e) => toast.error(`❌ Budget-Änderung fehlgeschlagen: ${e.message}`),
  });

  const handleBudgetSave = () => {
    const val = parseFloat(budgetInput);
    if (isNaN(val) || val < 1) { toast.error("Mindestbudget: CHF 1.00"); return; }
    if (!ad?.campaignId) { toast.error("Keine Kampagnen-ID verfügbar"); return; }
    setShowBudgetConfirm(true);
  };

  const handleBudgetConfirmed = () => {
    const val = parseFloat(budgetInput);
    updateBudget.mutate({ campaignId: ad!.campaignId, newDailyBudgetCents: Math.round(val * 100) });
    setShowBudgetConfirm(false);
  };

  const { data: comments, isLoading: commentsLoading } = trpc.adComments.list.useQuery(
    { adId: ad?.adId ?? "" },
    { enabled: !!ad?.adId && open }
  );

  const addComment = trpc.adComments.add.useMutation({
    onSuccess: () => {
      setCommentText("");
      utils.adComments.list.invalidate({ adId: ad?.adId });
      toast.success("Kommentar gespeichert");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteComment = trpc.adComments.delete.useMutation({
    onSuccess: () => {
      utils.adComments.list.invalidate({ adId: ad?.adId });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!ad) return null;

  const ctrColor = ad.ctr >= 3 ? "text-green-400" : ad.ctr >= 1.5 ? "text-amber-400" : "text-red-400";
  const cpcColor = ad.cpc <= 0.8 ? "text-green-400" : ad.cpc <= 1.5 ? "text-amber-400" : "text-red-400";

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate({
      adId: ad.adId,
      adName: ad.adName,
      campaignName: ad.campaignName,
      text: commentText.trim(),
    });
  };

  const budgetVal = parseFloat(budgetInput);
  const currentBudgetChf = budgetData ? (budgetData.dailyBudgetCents / 100).toFixed(2) : "–";

  return (
    <>
    {/* Bestätigungs-Dialog */}
    <AlertDialog open={showBudgetConfirm} onOpenChange={setShowBudgetConfirm}>
      <AlertDialogContent className="bg-slate-900 border-slate-700">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">Budget wirklich ändern?</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            Das Tagesbudget der Kampagne <span className="text-white font-medium">{ad?.campaignName}</span> wird von{" "}
            <span className="text-white font-medium">CHF {currentBudgetChf}</span> auf{" "}
            <span className="text-green-400 font-bold">CHF {isNaN(budgetVal) ? "–" : budgetVal.toFixed(2)}</span> geändert.
            <br /><br />
            Diese Änderung wird <span className="text-amber-400 font-medium">sofort in Meta Ads Manager</span> übernommen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-slate-700 text-slate-300">Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBudgetConfirmed}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Ja, Budget ändern
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl bg-slate-950 border-slate-800 overflow-y-auto p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="p-6 pb-4 border-b border-slate-800 flex-shrink-0">
            <SheetTitle className="text-white text-lg leading-tight pr-8">{ad.adName}</SheetTitle>
            <p className="text-sm text-slate-400">{ad.campaignName}</p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {/* Vorschau */}
            <div className="p-6 pb-4">
              <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                {ad.thumbnailUrl ? (
                  <img
                    src={ad.thumbnailUrl}
                    alt={ad.adName}
                    className="w-full object-cover max-h-72"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-full h-48 flex flex-col items-center justify-center gap-3">
                    <Play className="w-12 h-12 text-slate-600" />
                    <p className="text-sm text-slate-500">Keine Vorschau verfügbar</p>
                  </div>
                )}
                {ad.adId && (
                  <a
                    href={`https://www.facebook.com/ads/library/?id=${ad.adId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-full transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" /> In Ad Library öffnen
                  </a>
                )}
              </div>
            </div>

            {/* KPI Grid */}
            <div className="px-6 pb-4">
              <h3 className="text-sm font-semibold text-white mb-3">Performance-Kennzahlen</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                  <DollarSign className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">Ausgaben</p>
                  <p className="text-base font-bold text-white">CHF {ad.spend.toFixed(0)}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                  <TrendingUp className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">Impressionen</p>
                  <p className="text-base font-bold text-white">
                    {ad.impressions > 1000 ? `${(ad.impressions / 1000).toFixed(1)}K` : ad.impressions}
                  </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                  <MousePointer className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">Klicks</p>
                  <p className="text-base font-bold text-white">{ad.clicks?.toLocaleString() ?? "–"}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                  <Users className="w-4 h-4 text-green-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">Reichweite</p>
                  <p className="text-base font-bold text-white">
                    {ad.reach > 1000 ? `${(ad.reach / 1000).toFixed(1)}K` : (ad.reach ?? "–")}
                  </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                  <Eye className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">CTR</p>
                  <p className={`text-base font-bold ${ctrColor}`}>{ad.ctr.toFixed(2)}%</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                  <DollarSign className="w-4 h-4 text-rose-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">CPC</p>
                  <p className={`text-base font-bold ${cpcColor}`}>CHF {ad.cpc.toFixed(2)}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">Leads</p>
                  <p className="text-base font-bold text-white">{ad.leads > 0 ? ad.leads : "–"}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                  <Target className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">CPL</p>
                  <p className="text-base font-bold text-white">
                    {ad.costPerLead > 0 ? `CHF ${ad.costPerLead.toFixed(0)}` : "–"}
                  </p>
                </div>
              </div>
            </div>

            {/* Ad-Text */}
            {ad.adText && (
              <div className="px-6 pb-4">
                <h3 className="text-sm font-semibold text-white mb-2">Ad-Text</h3>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{ad.adText}</p>
                </div>
              </div>
            )}

            {/* Ad-Titel */}
            {ad.adTitle && (
              <div className="px-6 pb-4">
                <h3 className="text-sm font-semibold text-white mb-2">Anzeigentitel</h3>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                  <p className="text-sm font-medium text-white">{ad.adTitle}</p>
                </div>
              </div>
            )}

            {/* Budget-Anpassen */}
            {ad.campaignId && (
              <div className="px-6 pb-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Kampagnen-Budget
                </h3>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  {/* Aktuelles Budget */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Tagesbudget (Kampagne)</p>
                      {budgetData ? (
                        <p className="text-xl font-bold text-white">
                          CHF {(budgetData.dailyBudgetCents / 100).toFixed(2)}
                          <span className="text-xs text-slate-500 font-normal ml-1">/Tag</span>
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500">Wird geladen...</p>
                      )}
                      {budgetData && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Verbleibend: CHF {(budgetData.budgetRemainingCents / 100).toFixed(2)}
                        </p>
                      )}
                    </div>
                    {!showBudgetEditor && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setBudgetInput(budgetData ? String((budgetData.dailyBudgetCents / 100).toFixed(2)) : "");
                          setShowBudgetEditor(true);
                        }}
                        className="border-slate-700 text-slate-300 hover:text-white"
                      >
                        <PencilLine className="w-3.5 h-3.5 mr-1.5" />
                        Anpassen
                      </Button>
                    )}
                  </div>

                  {/* Budget-Editor */}
                  {showBudgetEditor && (
                    <div className="border-t border-slate-800 pt-3 space-y-3">
                      <p className="text-xs text-slate-400">Neues Tagesbudget in CHF eingeben:</p>
                      <div className="flex gap-2">
                        {/* Schnell-Buttons */}
                        {budgetData && [
                          { label: "-20%", factor: 0.8 },
                          { label: "-10%", factor: 0.9 },
                          { label: "+10%", factor: 1.1 },
                          { label: "+20%", factor: 1.2 },
                          { label: "+50%", factor: 1.5 },
                        ].map(({ label, factor }) => (
                          <button
                            key={label}
                            onClick={() => setBudgetInput(((budgetData.dailyBudgetCents / 100) * factor).toFixed(2))}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${
                              factor < 1
                                ? "border-red-500/40 text-red-400 hover:bg-red-500/10"
                                : "border-green-500/40 text-green-400 hover:bg-green-500/10"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">CHF</span>
                          <Input
                            type="number"
                            min="1"
                            step="0.5"
                            value={budgetInput}
                            onChange={(e) => setBudgetInput(e.target.value)}
                            className="pl-12 bg-slate-800 border-slate-700 text-white"
                            placeholder="z.B. 35.00"
                          />
                        </div>
                        <Button
                          onClick={handleBudgetSave}
                          disabled={updateBudget.isPending || !budgetInput}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {updateBudget.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => { setShowBudgetEditor(false); setBudgetInput(""); }}
                          className="border-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-amber-400/80">
                        ⚠️ Änderung wird sofort in Meta übernommen. Bitte sorgfältig prüfen.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Kommentare */}
            <div className="px-6 pb-6">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                Kommentare
                {comments && comments.length > 0 && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">{comments.length}</Badge>
                )}
              </h3>

              {/* Kommentar eingeben */}
              <div className="space-y-2 mb-4">
                <Textarea
                  placeholder="Notiz oder Kommentar zu dieser Ad hinzufügen..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 text-sm resize-none"
                  rows={3}
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || addComment.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm w-full"
                >
                  {addComment.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Kommentar speichern
                </Button>
              </div>

              {/* Kommentar-Liste */}
              {commentsLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                </div>
              )}
              {!commentsLoading && (!comments || comments.length === 0) && (
                <div className="text-center py-6 text-slate-500 text-sm">
                  Noch keine Kommentare. Füge eine Notiz hinzu.
                </div>
              )}
              {comments && comments.length > 0 && (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 group">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-slate-200 leading-relaxed flex-1">{c.text}</p>
                        <button
                          onClick={() => deleteComment.mutate({ id: c.id })}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400 flex-shrink-0 mt-0.5"
                          title="Kommentar löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5">
                        {new Date(c.createdAt).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}

// ─── Creative Card ────────────────────────────────────────────────────────────
function CreativeCard({ ad, onSelect }: { ad: any; onSelect: (ad: any) => void }) {
  const ctrColor = ad.ctr >= 3 ? "text-green-400" : ad.ctr >= 1.5 ? "text-amber-400" : "text-red-400";
  const cpcColor = ad.cpc <= 0.8 ? "text-green-400" : ad.cpc <= 1.5 ? "text-amber-400" : "text-red-400";

  return (
    <Card
      className="bg-slate-900 border-slate-800 hover:border-blue-500/50 transition-colors cursor-pointer"
      onClick={() => onSelect(ad)}
    >
      <CardContent className="p-0">
        <div className="flex gap-0">
          {/* Thumbnail */}
          <div className="w-24 h-24 flex-shrink-0 rounded-l-lg overflow-hidden bg-slate-800">
            {ad.thumbnailUrl ? (
              <img src={ad.thumbnailUrl} alt={ad.adName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Play className="w-6 h-6 text-slate-600" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate" title={ad.adName}>{ad.adName}</p>
                <p className="text-xs text-slate-500 truncate">{ad.campaignName}</p>
              </div>
              <Badge className={ad.leads > 0 ? "bg-green-500/20 text-green-400 border-green-500/30 text-xs flex-shrink-0" : "bg-slate-700 text-slate-400 border-slate-600 text-xs flex-shrink-0"}>
                {ad.leads > 0 ? `${ad.leads} Leads` : "Kein Lead"}
              </Badge>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-4 gap-2 mt-2">
              <div className="text-center">
                <p className="text-xs text-slate-500">Spend</p>
                <p className="text-sm font-bold text-white">CHF {ad.spend.toFixed(0)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500">CTR</p>
                <p className={`text-sm font-bold ${ctrColor}`}>{ad.ctr.toFixed(2)}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500">CPC</p>
                <p className={`text-sm font-bold ${cpcColor}`}>CHF {ad.cpc.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500">CPL</p>
                <p className="text-sm font-bold text-white">{ad.costPerLead > 0 ? `CHF ${ad.costPerLead.toFixed(0)}` : "–"}</p>
              </div>
            </div>

            <p className="text-xs text-blue-400/70 mt-2">Klicken für Details →</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MetaAdsDashboard() {
  const [datePreset, setDatePreset] = useState("last_30d");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [adSortBy, setAdSortBy] = useState<"spend" | "ctr" | "cpc" | "impressions" | "leads">("spend");
  const [isAnalyzingAds, setIsAnalyzingAds] = useState(false);
  const [adAnalysis, setAdAnalysis] = useState<any>(null);
  const [selectedAd, setSelectedAd] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: analysis, isLoading: analysisLoading } = trpc.metaInsights.getLatestAnalysis.useQuery();
  const { data: insights, isLoading: insightsLoading } = trpc.metaInsights.getInsights.useQuery({ datePreset, level: "campaign" });
  const { data: account } = trpc.metaInsights.getAccountOverview.useQuery();
  const { data: adInsights, isLoading: adInsightsLoading, refetch: refetchAds } = trpc.metaInsights.getAdInsights.useQuery(
    { datePreset: datePreset as any, sortBy: adSortBy },
    { enabled: false }
  );
  const analyzeAdsMutation = trpc.metaInsights.analyzeAds.useMutation({
    onSuccess: (data) => { setAdAnalysis(data); toast.success("Creative-Analyse abgeschlossen"); },
    onError: (e) => toast.error(e.message),
  });

  const syncMutation = trpc.metaInsights.sync.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.synced} Kampagnen synchronisiert`);
      utils.metaInsights.getInsights.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const analyzeMutation = trpc.metaInsights.analyze.useMutation({
    onSuccess: () => {
      toast.success("KI-Analyse abgeschlossen");
      utils.metaInsights.getLatestAnalysis.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSync = async () => {
    setIsSyncing(true);
    try { await syncMutation.mutateAsync({ datePreset: datePreset as any, level: "campaign" }); }
    finally { setIsSyncing(false); }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try { await analyzeMutation.mutateAsync({ datePreset, forceRefresh: true }); }
    finally { setIsAnalyzing(false); }
  };

  const totalSpend = insights?.reduce((s, i) => s + (i.spend ?? 0), 0) ?? 0;
  const totalImpressions = insights?.reduce((s, i) => s + (i.impressions ?? 0), 0) ?? 0;
  const totalClicks = insights?.reduce((s, i) => s + (i.clicks ?? 0), 0) ?? 0;
  const totalPurchases = insights?.reduce((s, i) => s + (i.purchases ?? 0), 0) ?? 0;
  const avgCtr = insights?.length ? insights.reduce((s, i) => s + (i.ctr ?? 0), 0) / insights.length : 0;
  const avgCpc = insights?.length ? insights.reduce((s, i) => s + (i.cpc ?? 0), 0) / insights.filter(i => i.cpc).length : 0;

  const topCampaigns = [...(insights ?? [])].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0)).slice(0, 8);

  const handleLoadAds = () => { refetchAds(); };
  const handleAnalyzeAds = async () => {
    setIsAnalyzingAds(true);
    try { await analyzeAdsMutation.mutateAsync({ datePreset: datePreset as any }); }
    finally { setIsAnalyzingAds(false); }
  };

  const handleSelectAd = (ad: any) => {
    setSelectedAd(ad);
    setDetailOpen(true);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Creative Detail Sheet */}
      <CreativeDetailSheet ad={selectedAd} open={detailOpen} onClose={() => setDetailOpen(false)} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Meta Ads Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {account ? `${account.name} · ${account.currency}` : "Hydroalp · CHF"} ·{" "}
            {DATE_PRESETS.find(d => d.value === datePreset)?.label}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="w-44 bg-slate-900 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {DATE_PRESETS.map(d => (
                <SelectItem key={d.value} value={d.value} className="text-white">{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleSync} disabled={isSyncing}
            className="border-slate-700 text-white hover:bg-slate-800">
            {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Synchronisieren
          </Button>
          <Button onClick={handleAnalyze} disabled={isAnalyzing || !insights?.length}
            className="bg-blue-600 hover:bg-blue-700 text-white">
            {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            KI-Analyse
          </Button>
        </div>
      </div>

      {/* Kein Daten State */}
      {!insightsLoading && (!insights || insights.length === 0) && (
        <Card className="bg-slate-900 border-slate-800 border-dashed">
          <CardContent className="p-12 text-center">
            <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Noch keine Daten</h3>
            <p className="text-muted-foreground mb-6">Klicke auf "Synchronisieren" um deine Meta Ads Daten zu laden.</p>
            <Button onClick={handleSync} disabled={isSyncing} className="bg-blue-600 hover:bg-blue-700">
              {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Jetzt synchronisieren
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Kampagnen / Creatives */}
      <Tabs defaultValue="campaigns" className="space-y-6">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="campaigns" className="data-[state=active]:bg-slate-800">Kampagnen</TabsTrigger>
          <TabsTrigger value="creatives" className="data-[state=active]:bg-slate-800">Creatives (Ad-Ebene)</TabsTrigger>
        </TabsList>

        {/* ── KAMPAGNEN TAB ── */}
        <TabsContent value="campaigns" className="space-y-6">

          {insights && insights.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard label="Gesamtausgaben" value={`CHF ${totalSpend.toFixed(0)}`} icon={DollarSign} color="blue" />
              <KpiCard label="Impressionen" value={totalImpressions > 1000 ? `${(totalImpressions / 1000).toFixed(1)}K` : totalImpressions.toString()} icon={BarChart3} color="purple" />
              <KpiCard label="Klicks" value={totalClicks.toLocaleString()} icon={Target} color="amber" />
              <KpiCard label="Conversions" value={totalPurchases.toFixed(0)} icon={CheckCircle2} color="green" />
              <KpiCard label="Ø CTR" value={`${avgCtr.toFixed(2)}%`} icon={TrendingUp} color={avgCtr >= 2 ? "green" : "amber"} />
              <KpiCard label="Ø CPC" value={`CHF ${avgCpc.toFixed(2)}`} icon={DollarSign} color={avgCpc <= 1 ? "green" : "red"} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* KI-Analyse Panel */}
            <div className="lg:col-span-2 space-y-4">
              {analysisLoading ? (
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="p-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  </CardContent>
                </Card>
              ) : analysis ? (
                <Tabs defaultValue="actions" className="space-y-4">
                  <TabsList className="bg-slate-900 border border-slate-800">
                    <TabsTrigger value="actions" className="data-[state=active]:bg-slate-800">To-Dos</TabsTrigger>
                    <TabsTrigger value="budget" className="data-[state=active]:bg-slate-800">Budget</TabsTrigger>
                    <TabsTrigger value="performers" className="data-[state=active]:bg-slate-800">Performance</TabsTrigger>
                    <TabsTrigger value="insights" className="data-[state=active]:bg-slate-800">Insights</TabsTrigger>
                  </TabsList>

                  <TabsContent value="actions" className="space-y-3">
                    {(analysis.actionItems as any[] ?? []).map((item: any, i: number) => (
                      <Card key={i} className="bg-slate-900 border-slate-800">
                        <CardContent className="p-4 flex items-start gap-3">
                          <div className="mt-0.5"><PriorityBadge priority={item.priority} /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">{item.action}</p>
                            {item.reason && <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {!(analysis.actionItems as any[] ?? []).length && (
                      <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-8 text-center text-muted-foreground">Keine To-Dos vorhanden.</CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="budget" className="space-y-3">
                    {(analysis.budgetRecommendations as any[] ?? []).map((rec: any, i: number) => (
                      <Card key={i} className="bg-slate-900 border-slate-800">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{rec.campaign}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{rec.reason}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {rec.action === "increase" ? (
                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                  <ArrowUpRight className="w-3 h-3 mr-1" />+{rec.changePercent}%
                                </Badge>
                              ) : rec.action === "decrease" ? (
                                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                                  <ArrowDownRight className="w-3 h-3 mr-1" />-{rec.changePercent}%
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                                  <AlertTriangle className="w-3 h-3 mr-1" />Pausieren
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {!(analysis.budgetRecommendations as any[] ?? []).length && (
                      <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-8 text-center text-muted-foreground">Keine Budget-Empfehlungen vorhanden.</CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="performers" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-white flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-400" /> Top Performer
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {(analysis.topPerformers as any[] ?? []).map((p: any, i: number) => (
                          <div key={i} className="p-2 rounded bg-slate-800/50 border border-green-500/20">
                            <p className="text-xs font-medium text-white truncate">{p.name}</p>
                            <p className="text-xs text-green-400 mt-0.5">{p.metric}: {p.value}</p>
                          </div>
                        ))}
                        {!(analysis.topPerformers as any[] ?? []).length && <p className="text-xs text-muted-foreground">Keine Daten</p>}
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-white flex items-center gap-2">
                          <TrendingDown className="w-4 h-4 text-red-400" /> Schwache Performer
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {(analysis.underperformers as any[] ?? []).map((p: any, i: number) => (
                          <div key={i} className="p-2 rounded bg-slate-800/50 border border-red-500/20">
                            <p className="text-xs font-medium text-white truncate">{p.name}</p>
                            <p className="text-xs text-red-400 mt-0.5">{p.issue}</p>
                          </div>
                        ))}
                        {!(analysis.underperformers as any[] ?? []).length && <p className="text-xs text-muted-foreground">Keine Daten</p>}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="insights">
                    <Card className="bg-slate-900 border-slate-800">
                      <CardContent className="p-4 space-y-3">
                        {(analysis.insights as any[] ?? []).map((ins: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded bg-slate-800/50">
                            <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-white">{ins.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{ins.description}</p>
                            </div>
                          </div>
                        ))}
                        {!(analysis.insights as any[] ?? []).length && (
                          <p className="text-muted-foreground text-sm text-center py-4">Keine Insights vorhanden.</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              ) : (
                <Card className="bg-slate-900 border-slate-800 border-dashed">
                  <CardContent className="p-8 text-center">
                    <Zap className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">Noch keine KI-Analyse. Klicke auf "KI-Analyse" um Empfehlungen zu erhalten.</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Score + Kampagnen-Liste */}
            <div className="space-y-4">
              {analysis && (
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="p-4 flex flex-col items-center gap-2">
                    <p className="text-xs text-muted-foreground">Performance Score</p>
                    <ScoreRing score={analysis.overallScore ?? 0} />
                    {analysis.summary && <p className="text-xs text-muted-foreground text-center leading-relaxed">{analysis.summary}</p>}
                  </CardContent>
                </Card>
              )}

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white">Top Kampagnen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                  {topCampaigns.map((c, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-2 rounded bg-slate-800/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{c.campaignName}</p>
                        <p className="text-xs text-muted-foreground">{c.impressions?.toLocaleString()} Imp.</p>
                      </div>
                      <p className="text-xs font-bold text-white flex-shrink-0">CHF {(c.spend ?? 0).toFixed(0)}</p>
                    </div>
                  ))}
                  {!topCampaigns.length && <p className="text-xs text-muted-foreground text-center py-4">Keine Kampagnendaten</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── CREATIVES TAB ── */}
        <TabsContent value="creatives" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Creative Performance</h2>
              <p className="text-xs text-muted-foreground">Klicke auf eine Ad für Details, Vorschau und Kommentare</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={adSortBy} onValueChange={(v) => setAdSortBy(v as any)}>
                <SelectTrigger className="w-36 bg-slate-900 border-slate-700 text-white text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="spend" className="text-white text-xs">Nach Spend</SelectItem>
                  <SelectItem value="ctr" className="text-white text-xs">Nach CTR</SelectItem>
                  <SelectItem value="cpc" className="text-white text-xs">Nach CPC</SelectItem>
                  <SelectItem value="leads" className="text-white text-xs">Nach Leads</SelectItem>
                  <SelectItem value="impressions" className="text-white text-xs">Nach Impressionen</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleLoadAds} disabled={adInsightsLoading}
                className="border-slate-700 text-white hover:bg-slate-800 text-xs h-8">
                {adInsightsLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                Laden
              </Button>
              <Button onClick={handleAnalyzeAds} disabled={isAnalyzingAds || !adInsights?.length}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8">
                {isAnalyzingAds ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                KI-Analyse
              </Button>
            </div>
          </div>

          {/* KI Creative-Analyse */}
          {adAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" /> Top Creatives
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(adAnalysis.topCreatives ?? []).map((c: any, i: number) => (
                    <div key={i} className="p-2 rounded bg-slate-800/50 border border-green-500/20">
                      <p className="text-xs font-medium text-white truncate">{c.name}</p>
                      <p className="text-xs text-green-400 mt-0.5">{c.action} · {c.reason}</p>
                    </div>
                  ))}
                  {!(adAnalysis.topCreatives ?? []).length && <p className="text-xs text-muted-foreground">Keine Daten</p>}
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-400" /> Schwache Creatives
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(adAnalysis.weakCreatives ?? []).map((c: any, i: number) => (
                    <div key={i} className="p-2 rounded bg-slate-800/50 border border-red-500/20">
                      <p className="text-xs font-medium text-white truncate">{c.name}</p>
                      <p className="text-xs text-red-400 mt-0.5">{c.action} · {c.reason}</p>
                    </div>
                  ))}
                  {!(adAnalysis.weakCreatives ?? []).length && <p className="text-xs text-muted-foreground">Keine Daten</p>}
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-400" /> Zusammenfassung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">{adAnalysis.summary}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Creative Cards Grid */}
          {!adInsights && !adInsightsLoading && (
            <Card className="bg-slate-900 border-slate-800 border-dashed">
              <CardContent className="p-12 text-center">
                <Play className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-white mb-2">Creative-Daten laden</h3>
                <p className="text-muted-foreground text-sm mb-4">Klicke auf "Laden" um alle Ads mit Thumbnails und KPIs anzuzeigen.</p>
                <Button onClick={handleLoadAds} className="bg-blue-600 hover:bg-blue-700">
                  <RefreshCw className="w-4 h-4 mr-2" /> Jetzt laden
                </Button>
              </CardContent>
            </Card>
          )}

          {adInsightsLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-slate-900 border-slate-800 animate-pulse">
                  <CardContent className="p-3 flex gap-3">
                    <div className="w-24 h-24 bg-slate-800 rounded" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-slate-800 rounded w-3/4" />
                      <div className="h-2 bg-slate-800 rounded w-1/2" />
                      <div className="grid grid-cols-4 gap-1 mt-3">
                        {[...Array(4)].map((_, j) => <div key={j} className="h-6 bg-slate-800 rounded" />)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {adInsights && adInsights.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground">{adInsights.length} Ads geladen · sortiert nach {adSortBy} · klicken für Details</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {adInsights.map((ad) => <CreativeCard key={ad.adId} ad={ad} onSelect={handleSelectAd} />)}
              </div>
            </>
          )}

          {adInsights && adInsights.length === 0 && (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Keine Ad-Daten für diesen Zeitraum gefunden.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
