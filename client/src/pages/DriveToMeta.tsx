import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload,
  RefreshCw,
  Video,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderOpen,
  ExternalLink,
  Clock,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "–";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-CH", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending:     { label: "Ausstehend",   variant: "outline" },
    downloading: { label: "Herunterladen", variant: "secondary" },
    uploading:   { label: "Hochladen",    variant: "secondary" },
    processing:  { label: "Verarbeitung", variant: "secondary" },
    ready:       { label: "Bereit",       variant: "default" },
    error:       { label: "Fehler",       variant: "destructive" },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// ─── Hauptkomponente ─────────────────────────────────────────────────────────

export default function DriveToMeta() {
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [refreshingIds, setRefreshingIds] = useState<Set<number>>(new Set());

  const { data, isLoading, refetch } = trpc.driveToMeta.listVideos.useQuery(undefined, {
    refetchInterval: 15000, // alle 15s automatisch aktualisieren
  });

  const uploadMutation = trpc.driveToMeta.uploadToMeta.useMutation({
    onSuccess: (result, variables) => {
      setUploadingIds(prev => { const s = new Set(prev); s.delete(variables.driveFileId); return s; });
      toast.success(`Upload gestartet — Meta Video-ID: ${result.metaVideoId}`);
      refetch();
    },
    onError: (err, variables) => {
      setUploadingIds(prev => { const s = new Set(prev); s.delete(variables.driveFileId); return s; });
      toast.error(`Upload fehlgeschlagen: ${err.message}`);
      refetch();
    },
  });

  const refreshMutation = trpc.driveToMeta.refreshStatus.useMutation({
    onSuccess: (result, variables) => {
      setRefreshingIds(prev => { const s = new Set(prev); s.delete(variables.uploadId); return s; });
      if (result.status === "ready") {
        toast.success("Video ist bereit in Meta!");
      }
      refetch();
    },
    onError: (_err, variables) => {
      setRefreshingIds(prev => { const s = new Set(prev); s.delete(variables.uploadId); return s; });
    },
  });

  function handleUpload(video: { id: string; name: string; mimeType: string; size: number }) {
    setUploadingIds(prev => new Set(prev).add(video.id));
    uploadMutation.mutate({
      driveFileId: video.id,
      fileName: video.name,
      mimeType: video.mimeType,
      fileSizeBytes: video.size,
    });
  }

  function handleRefresh(uploadId: number) {
    setRefreshingIds(prev => new Set(prev).add(uploadId));
    refreshMutation.mutate({ uploadId });
  }

  // Bereits hochgeladene Drive-IDs
  const uploadedDriveIds = new Set((data?.uploads ?? []).map(u => u.driveFileId));

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Video className="h-6 w-6 text-primary" />
              Drive → Meta Upload
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Videos aus dem Google Drive Ordner <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">01_Video_Ads</span> direkt zu Meta Ads hochladen
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        </div>

        {/* Nicht verbunden */}
        {!isLoading && data && !data.connected && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="font-medium text-sm">Google Drive nicht verbunden</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bitte zuerst Google Drive in den <a href="/settings" className="underline">Einstellungen</a> verbinden.
                  Nach der Verbindung muss der Scope <strong>drive</strong> (Vollzugriff) gewährt werden.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Videos im Drive-Ordner */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              Videos in 01_Video_Ads
            </CardTitle>
            <CardDescription>
              {isLoading ? "Lade Videos…" :
                data?.connected
                  ? `${data.videos.length} Datei${data.videos.length !== 1 ? "en" : ""} gefunden`
                  : "Nicht verbunden"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Lade Drive-Ordner…
              </div>
            ) : !data?.connected ? null : data.videos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Keine Videos im Ordner gefunden.</p>
                <p className="text-xs mt-1">Lade Videos in den Ordner <strong>01_Video_Ads</strong> in Google Drive hoch.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dateiname</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Grösse</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.videos.map(video => {
                    const isUploading = uploadingIds.has(video.id);
                    const alreadyUploaded = uploadedDriveIds.has(video.id);
                    const uploadRecord = data.uploads.find(u => u.driveFileId === video.id);

                    return (
                      <TableRow key={video.id}>
                        <TableCell className="font-medium max-w-[240px] truncate">
                          <div className="flex items-center gap-2">
                            <Video className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate" title={video.name}>{video.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground font-mono">
                            {video.mimeType.replace("video/", "")}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatBytes(video.size)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(video.createdTime)}
                        </TableCell>
                        <TableCell>
                          {uploadRecord ? (
                            <StatusBadge status={uploadRecord.status} />
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Nicht hochgeladen</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {alreadyUploaded ? (
                            <div className="flex items-center justify-end gap-2">
                              {uploadRecord?.metaVideoId && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  ID: {uploadRecord.metaVideoId}
                                </span>
                              )}
                              {uploadRecord && uploadRecord.status === "processing" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRefresh(uploadRecord.id)}
                                  disabled={refreshingIds.has(uploadRecord.id)}
                                >
                                  {refreshingIds.has(uploadRecord.id)
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <RefreshCw className="h-3.5 w-3.5" />}
                                </Button>
                              )}
                              {uploadRecord?.status === "ready" && (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              )}
                              {uploadRecord?.status === "error" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUpload(video)}
                                  disabled={isUploading}
                                >
                                  Erneut versuchen
                                </Button>
                              )}
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleUpload(video)}
                              disabled={isUploading}
                            >
                              {isUploading ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                  Wird hochgeladen…
                                </>
                              ) : (
                                <>
                                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                                  Zu Meta hochladen
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Upload-Protokoll */}
        {data?.uploads && data.uploads.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Upload-Protokoll
              </CardTitle>
              <CardDescription>Alle bisherigen Uploads zu Meta Ads</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dateiname</TableHead>
                    <TableHead>Meta Video-ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hochgeladen</TableHead>
                    <TableHead>Fehler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.uploads.map(upload => (
                    <TableRow key={upload.id}>
                      <TableCell className="font-medium max-w-[200px] truncate" title={upload.fileName}>
                        {upload.fileName}
                      </TableCell>
                      <TableCell>
                        {upload.metaVideoId ? (
                          <span className="text-xs font-mono text-muted-foreground">{upload.metaVideoId}</span>
                        ) : "–"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={upload.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(upload.createdAt.toString())}
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={upload.errorMessage ?? ""}>
                        {upload.errorMessage ?? "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Hinweis */}
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3">
              <ExternalLink className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong className="text-foreground">Hinweis:</strong> Videos werden direkt als Ad-Videos in deinem Meta Ad Account <span className="font-mono text-xs bg-muted px-1 rounded">act_1093241318940799</span> gespeichert.</p>
                <p>Nach dem Upload verarbeitet Meta das Video (Status: <em>Verarbeitung</em>). Klicke auf <RefreshCw className="h-3 w-3 inline" /> um den Status zu aktualisieren. Sobald der Status <strong>Bereit</strong> anzeigt, kann das Video in Kampagnen verwendet werden.</p>
                <p>⚠️ Der Ordner <strong>01_Video_Ads</strong> ist aktuell leer. Lade Videos dort hoch, damit sie hier erscheinen.</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
