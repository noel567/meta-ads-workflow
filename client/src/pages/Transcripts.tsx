import DashboardLayout from "@/components/DashboardLayout";
import HookGenerator from "@/components/HookGenerator";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Loader2,
  MonitorPlay,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";

export default function Transcripts() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [hookGenOpenId, setHookGenOpenId] = useState<number | null>(null);

  const { data: transcripts, isLoading } = trpc.transcripts.list.useQuery();

  const createMutation = trpc.transcripts.create.useMutation({
    onSuccess: () => {
      toast.success("Transkript erstellt");
      utils.transcripts.list.invalidate();
      utils.dashboard.getStats.invalidate();
      setIsCreateOpen(false);
      setNewTitle("");
      setNewContent("");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.transcripts.update.useMutation({
    onSuccess: () => {
      toast.success("Transkript gespeichert");
      utils.transcripts.list.invalidate();
      setEditingId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.transcripts.delete.useMutation({
    onSuccess: () => {
      toast.success("Transkript gelöscht");
      utils.transcripts.list.invalidate();
      utils.dashboard.getStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const exportMutation = trpc.documents.export.useMutation({
    onSuccess: () => toast.success("Als Dokument exportiert"),
    onError: (err) => toast.error(err.message),
  });

  const startEdit = (t: { id: number; title: string; content: string }) => {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditContent(t.content);
    setHookGenOpenId(null);
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({ id: editingId, title: editTitle, content: editContent });
  };

  const handleExport = (t: { id: number; title: string }) => {
    exportMutation.mutate({ transcriptId: t.id, title: t.title, format: "markdown" });
  };

  const toggleHookGen = (id: number) => {
    setHookGenOpenId(hookGenOpenId === id ? null : id);
    setEditingId(null);
  };

  const sourceTypeLabel: Record<string, string> = {
    competitor_ad: "Konkurrenz-Ad",
    manual: "Manuell",
    ai_generated: "KI-generiert",
  };

  const sourceTypeColor: Record<string, string> = {
    competitor_ad: "badge-paused",
    manual: "badge-archived",
    ai_generated: "badge-active",
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">Transkripte</h1>
            <p className="text-sm text-muted-foreground">
              Erstelle und verwalte Skripte für deine Video-Aufnahmen.
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Neues Transkript
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-2xl">
              <DialogHeader>
                <DialogTitle>Neues Transkript erstellen</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Titel</Label>
                  <Input
                    placeholder="z.B. Produkt-Launch Video Skript"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="bg-input border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Inhalt</Label>
                  <Textarea
                    placeholder="Schreibe dein Skript hier..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="bg-input border-border/50 min-h-[200px] font-mono text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate({ title: newTitle, content: newContent })}
                    disabled={createMutation.isPending || !newTitle.trim() || !newContent.trim()}
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Speichern
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Transcripts List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="bg-card border-border/50">
                <CardContent className="p-5">
                  <div className="h-4 bg-muted rounded w-48 mb-3" />
                  <div className="h-3 bg-muted rounded w-full mb-2" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !transcripts || transcripts.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Noch keine Transkripte. Erstelle eines manuell oder generiere es aus einer Konkurrenz-Ad.
            </p>
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Erstes Transkript erstellen
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {transcripts.map((t) => (
              <div key={t.id}>
                <Card
                  className={`bg-card border-border/50 transition-all ${
                    editingId === t.id ? "border-primary/50" :
                    hookGenOpenId === t.id ? "border-primary/30" :
                    "hover:border-border"
                  }`}
                >
                  <CardContent className="p-5">
                    {editingId === t.id ? (
                      /* Edit Mode */
                      <div className="space-y-3">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="bg-input border-border/50 font-medium"
                        />
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="bg-input border-border/50 min-h-[200px] font-mono text-sm"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5 mr-2" />
                            )}
                            Speichern
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="h-3.5 w-3.5 mr-2" />
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="text-sm font-semibold truncate">{t.title}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sourceTypeColor[t.sourceType] || "badge-archived"}`}>
                              {sourceTypeLabel[t.sourceType] || t.sourceType}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(t.updatedAt).toLocaleDateString("de-DE")}
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4 font-mono leading-relaxed">
                          {t.content}
                        </p>

                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLocation(`/teleprompter/${t.id}`)}
                            className="border-border/50 text-xs h-7"
                          >
                            <MonitorPlay className="h-3 w-3 mr-1" />
                            Teleprompter
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(t)}
                            className="border-border/50 text-xs h-7"
                          >
                            <Edit3 className="h-3 w-3 mr-1" />
                            Bearbeiten
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleExport(t)}
                            disabled={exportMutation.isPending}
                            className="border-border/50 text-xs h-7"
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Exportieren
                          </Button>
                          {/* Hook-Generator Toggle */}
                          <Button
                            size="sm"
                            variant={hookGenOpenId === t.id ? "default" : "outline"}
                            onClick={() => toggleHookGen(t.id)}
                            className={`text-xs h-7 gap-1 ${
                              hookGenOpenId === t.id
                                ? "bg-primary text-primary-foreground"
                                : "border-primary/30 text-primary hover:bg-primary/10"
                            }`}
                          >
                            <Sparkles className="h-3 w-3" />
                            3 Hooks
                            {hookGenOpenId === t.id
                              ? <ChevronUp className="h-3 w-3" />
                              : <ChevronDown className="h-3 w-3" />
                            }
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate({ id: t.id })}
                            disabled={deleteMutation.isPending}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-7 ml-auto"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Hook-Generator Panel – expandiert direkt unter der Karte */}
                {hookGenOpenId === t.id && (
                  <div className="mt-1 rounded-xl border border-primary/20 bg-primary/5 p-5 transition-all">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">Hook-Generator</span>
                      <span className="text-xs text-muted-foreground">– KI erstellt 3 Hooks für: <em>{t.title}</em></span>
                    </div>
                    <HookGenerator
                      initialScript={t.content}
                      scriptEditable={false}
                      compact
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
