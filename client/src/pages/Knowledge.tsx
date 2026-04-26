import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Brain, Pencil, RefreshCw, BookOpen, Target, AlertCircle, Lightbulb, FileText } from "lucide-react";

const FILE_ICONS: Record<string, React.ElementType> = {
  offer: BookOpen,
  target_audience: Target,
  painpoints: AlertCircle,
  ad_angles: Lightbulb,
  scripts: FileText,
};

const FILE_COLORS: Record<string, string> = {
  offer: "text-blue-400",
  target_audience: "text-green-400",
  painpoints: "text-red-400",
  ad_angles: "text-yellow-400",
  scripts: "text-purple-400",
};

type KnowledgeFile = { id: number; slug: string; title: string; content: string; updatedAt: Date };

export default function Knowledge() {
  const utils = trpc.useUtils();
  const { data: files, isLoading } = trpc.knowledge.getOrInit.useQuery();

  const updateMutation = trpc.knowledge.update.useMutation({
    onSuccess: () => {
      utils.knowledge.getOrInit.invalidate();
      toast.success("Gespeichert!");
      setEditDialog(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const expandMutation = trpc.knowledge.expandWithAI.useMutation({
    onSuccess: (data) => {
      setEditContent(data.content);
      toast.success("KI hat die Datei erweitert!");
    },
    onError: (e) => toast.error(e.message),
  });

  const [editDialog, setEditDialog] = useState<KnowledgeFile | null>(null);
  const [editContent, setEditContent] = useState("");

  const openEdit = (file: KnowledgeFile) => {
    setEditDialog(file);
    setEditContent(file.content);
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Brain className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Wissensbasis</h1>
              <p className="text-sm text-muted-foreground">EasySignals Kontext für alle KI-Generierungen</p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 text-sm text-muted-foreground">
          Diese Dateien dienen als Kontext für Image Ads, Video Ads, Hooks und Skripte. Je detaillierter, desto besser die Ergebnisse. Die KI kann jede Datei automatisch erweitern.
        </div>

        {/* Files Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-48 rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        ) : files && files.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {files.map((file) => {
              const Icon = FILE_ICONS[file.slug] ?? FileText;
              const color = FILE_COLORS[file.slug] ?? "text-muted-foreground";
              return (
                <Card key={file.id} className="bg-card/50 border-border/50 hover:border-border transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${color}`} />
                        <CardTitle className="text-sm font-medium">{file.title}</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-xs font-mono">{file.slug}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-4 mb-4 leading-relaxed whitespace-pre-wrap">
                      {file.content || "Noch kein Inhalt"}
                    </p>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => openEdit(file)}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Bearbeiten
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium">Lade Wissensdateien...</p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(o) => { if (!o) setEditDialog(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editDialog && (() => {
                const Icon = FILE_ICONS[editDialog.slug] ?? FileText;
                const color = FILE_COLORS[editDialog.slug] ?? "text-muted-foreground";
                return <Icon className={`h-4 w-4 ${color}`} />;
              })()}
              {editDialog?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Inhalt..."
              className="min-h-[350px] font-mono text-sm resize-none"
            />
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => editDialog && expandMutation.mutate({ id: editDialog.id })}
              disabled={expandMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${expandMutation.isPending ? "animate-spin" : ""}`} />
              {expandMutation.isPending ? "KI erweitert..." : "KI erweitern"}
            </Button>
            <Button
              onClick={() => editDialog && updateMutation.mutate({ id: editDialog.id, content: editContent })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
