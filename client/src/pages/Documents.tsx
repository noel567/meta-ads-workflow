import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Calendar,
  Download,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";

export default function Documents() {
  const utils = trpc.useUtils();
  const { data: documents, isLoading } = trpc.documents.list.useQuery();

  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      toast.success("Dokument gelöscht");
      utils.documents.list.invalidate();
      utils.dashboard.getStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDownload = (doc: { title: string; content: string; format: string }) => {
    const ext = doc.format === "pdf" ? "md" : "md"; // We export as markdown
    const blob = new Blob([doc.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, "").trim()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Download gestartet");
  };

  const formatLabel: Record<string, string> = {
    markdown: "Markdown",
    pdf: "PDF",
  };

  const sourceLabel: Record<string, string> = {
    transcript: "Transkript",
    analysis: "Analyse",
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Dokumente</h1>
          <p className="text-sm text-muted-foreground">
            Exportierte Transkripte und Analysen als Dokumente.
          </p>
        </div>

        {/* Documents List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="bg-card border-border/50">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-48 mb-2" />
                  <div className="h-3 bg-muted rounded w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !documents || documents.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">
              Noch keine Dokumente. Exportiere Transkripte oder Analysen, um sie hier zu speichern.
            </p>
            <p className="text-xs text-muted-foreground">
              Gehe zu Transkripte → Transkript auswählen → "Exportieren"
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className="bg-card border-border/50 hover:border-border transition-all"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(doc.createdAt).toLocaleDateString("de-DE")}
                          </span>
                          <Badge variant="outline" className="badge-archived text-xs h-4 px-1.5">
                            {formatLabel[doc.format] || doc.format}
                          </Badge>
                          <Badge variant="outline" className="badge-archived text-xs h-4 px-1.5">
                            {sourceLabel[doc.sourceType] || doc.sourceType}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(doc)}
                        className="border-border/50 text-xs h-7"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate({ id: doc.id })}
                        disabled={deleteMutation.isPending}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Content preview */}
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-xs text-muted-foreground font-mono line-clamp-2">
                      {doc.content.slice(0, 200)}...
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
