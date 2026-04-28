import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BookOpen,
  Bookmark,
  Calendar,
  CheckSquare,
  ChevronDown,
  Download,
  ExternalLink,
  Filter,
  Globe,
  Image as ImageIcon,
  Loader2,
  Search,
  Square,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";

const COUNTRIES = [
  { value: "DE", label: "Deutschland" },
  { value: "AT", label: "Österreich" },
  { value: "CH", label: "Schweiz" },
  { value: "US", label: "USA" },
  { value: "GB", label: "Großbritannien" },
  { value: "FR", label: "Frankreich" },
];

interface AdResult {
  id: string;
  page_name?: string;
  page_id?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_snapshot_url?: string;
  currency?: string;
  impressions?: { lower_bound: string; upper_bound: string };
  publisher_platforms?: string[];
  _isMock?: boolean;
}

interface ImageAdResult extends AdResult {
  ad_creation_time?: string;
}

export default function AdLibrary() {
  const utils = trpc.useUtils();

  // ─── Text Search State ───────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("DE");
  const [searchResults, setSearchResults] = useState<AdResult[]>([]);
  const [isMock, setIsMock] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  // ─── Image Scraper State ─────────────────────────────────────────────────────
  const [imgQuery, setImgQuery] = useState("");
  const [imgPageIds, setImgPageIds] = useState(""); // comma-separated page IDs
  const [imgCountry, setImgCountry] = useState("DE");
  const [imgActiveStatus, setImgActiveStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [imgMinImpressions, setImgMinImpressions] = useState("");
  const [imgMaxImpressions, setImgMaxImpressions] = useState("");
  const [imgStartDateMin, setImgStartDateMin] = useState("");
  const [imgStartDateMax, setImgStartDateMax] = useState("");
  const [imgResults, setImgResults] = useState<ImageAdResult[]>([]);
  const [imgNextCursor, setImgNextCursor] = useState<string | null>(null);
  const [imgHasMore, setImgHasMore] = useState(false);
  const [imgFiltersOpen, setImgFiltersOpen] = useState(false);
  const [selectedAds, setSelectedAds] = useState<Set<string>>(new Set());

  // ─── Queries & Mutations ─────────────────────────────────────────────────────
  const { data: savedAds, isLoading: loadingSaved } = trpc.adLibrary.getSaved.useQuery();

  const searchMutation = trpc.adLibrary.search.useMutation({
    onSuccess: (data) => {
      setSearchResults(data.results as AdResult[]);
      setIsMock(!!data.isMock);
      if (data.results.length === 0) toast.info("Keine Ergebnisse gefunden.");
    },
    onError: (err) => toast.error(err.message),
  });

  const searchImagesMutation = trpc.adLibrary.searchImages.useMutation({
    onSuccess: (data, variables) => {
      const newResults = data.results as ImageAdResult[];
      if (variables.after) {
        setImgResults((prev) => [...prev, ...newResults]);
      } else {
        setImgResults(newResults);
        setSelectedAds(new Set());
      }
      setImgNextCursor(data.nextCursor);
      setImgHasMore(data.hasMore);
      if (newResults.length === 0 && !variables.after) toast.info("Keine Ergebnisse gefunden.");
    },
    onError: (err) => toast.error(err.message),
  });

  const saveAdMutation = trpc.adLibrary.saveAd.useMutation({
    onSuccess: () => { toast.success("Ad gespeichert"); utils.adLibrary.getSaved.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const deleteAdMutation = trpc.adLibrary.deleteSaved.useMutation({
    onSuccess: () => { toast.success("Ad gelöscht"); utils.adLibrary.getSaved.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const createTranscriptMutation = trpc.transcripts.create.useMutation({
    onSuccess: () => {
      utils.transcripts.list.invalidate();
      utils.dashboard.getStats.invalidate();
      toast.success("Transkript erstellt");
      setGeneratingFor(null);
    },
    onError: (err) => { toast.error(err.message); setGeneratingFor(null); },
  });

  const generateTranscriptMutation = trpc.transcripts.generateFromAd.useMutation({
    onSuccess: (data, variables) => {
      createTranscriptMutation.mutate({
        title: `Transkript – ${variables.pageName || "Unbekannt"} – ${new Date().toLocaleDateString("de-DE")}`,
        content: String(data.content),
        sourceType: "ai_generated",
      });
    },
    onError: (err) => { toast.error(err.message); setGeneratingFor(null); },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleSearch = () => {
    if (!query.trim()) { toast.error("Bitte einen Suchbegriff eingeben"); return; }
    searchMutation.mutate({ query, country });
  };

  const buildImageSearchParams = useCallback((after?: string) => {
    const pageIds = imgPageIds.split(",").map((s) => s.trim()).filter(Boolean);
    return {
      query: imgQuery,
      searchPageIds: pageIds.length > 0 ? pageIds : undefined,
      country: imgCountry,
      limit: 30,
      activeStatus: imgActiveStatus,
      minImpressions: imgMinImpressions ? parseInt(imgMinImpressions) : undefined,
      maxImpressions: imgMaxImpressions ? parseInt(imgMaxImpressions) : undefined,
      startDateMin: imgStartDateMin || undefined,
      startDateMax: imgStartDateMax || undefined,
      after,
    };
  }, [imgQuery, imgPageIds, imgCountry, imgActiveStatus, imgMinImpressions, imgMaxImpressions, imgStartDateMin, imgStartDateMax]);

  const handleImageSearch = () => {
    if (!imgQuery.trim() && !imgPageIds.trim()) {
      toast.error("Bitte Suchbegriff oder Page-ID eingeben");
      return;
    }
    searchImagesMutation.mutate(buildImageSearchParams());
  };

  const handleLoadMore = () => {
    if (!imgNextCursor) return;
    searchImagesMutation.mutate(buildImageSearchParams(imgNextCursor));
  };

  const handleSaveAd = (ad: AdResult) => {
    saveAdMutation.mutate({
      adId: ad.id,
      pageName: ad.page_name || "Unbekannt",
      pageId: ad.page_id,
      adText: ad.ad_creative_bodies?.[0],
      adTitle: ad.ad_creative_link_titles?.[0],
      adImageUrl: ad.ad_snapshot_url,
      startDate: ad.ad_delivery_start_time,
    });
  };

  const handleGenerateTranscript = (ad: AdResult) => {
    const adText = ad.ad_creative_bodies?.[0];
    if (!adText) { toast.error("Kein Ad-Text gefunden"); return; }
    setGeneratingFor(ad.id);
    generateTranscriptMutation.mutate({
      adText,
      headline: ad.ad_creative_link_titles?.[0] ?? undefined,
      pageName: ad.page_name ?? undefined,
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedAds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedAds(new Set(imgResults.map((a) => a.id)));
  const clearSelection = () => setSelectedAds(new Set());

  const handleDownloadSelected = () => {
    const toDownload = imgResults.filter((a) => selectedAds.has(a.id) && a.ad_snapshot_url);
    if (toDownload.length === 0) { toast.error("Keine Ads mit Snapshot-URL ausgewählt"); return; }
    toDownload.forEach((ad) => {
      const link = document.createElement("a");
      link.href = ad.ad_snapshot_url!;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    });
    toast.success(`${toDownload.length} Ad-Snapshots geöffnet`);
  };

  const handleDownloadAll = () => {
    const toDownload = imgResults.filter((a) => a.ad_snapshot_url);
    if (toDownload.length === 0) { toast.error("Keine Ads mit Snapshot-URL"); return; }
    toDownload.forEach((ad) => {
      const link = document.createElement("a");
      link.href = ad.ad_snapshot_url!;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    });
    toast.success(`${toDownload.length} Ad-Snapshots geöffnet`);
  };

  // ─── Sub-Components ───────────────────────────────────────────────────────────
  const AdCard = ({ ad, showSave = true }: { ad: AdResult; showSave?: boolean }) => (
    <Card className="bg-card border-border/50 hover:border-border transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{ad.page_name || "Unbekannte Seite"}</p>
              {ad.ad_delivery_start_time && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(ad.ad_delivery_start_time).toLocaleDateString("de-DE")}
                </p>
              )}
            </div>
          </div>
          {ad._isMock && <Badge variant="outline" className="text-xs shrink-0">Demo</Badge>}
        </div>
        {ad.ad_creative_link_titles?.[0] && (
          <p className="text-sm font-medium mb-1">{ad.ad_creative_link_titles[0]}</p>
        )}
        {ad.ad_creative_bodies?.[0] && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{ad.ad_creative_bodies[0]}</p>
        )}
        {ad.impressions && (
          <p className="text-xs text-muted-foreground mb-3">
            Impressionen: {parseInt(ad.impressions.lower_bound).toLocaleString("de-DE")} – {parseInt(ad.impressions.upper_bound).toLocaleString("de-DE")}
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          {showSave && (
            <Button size="sm" variant="outline" onClick={() => handleSaveAd(ad)} disabled={saveAdMutation.isPending} className="border-border/50 text-xs h-7">
              <Bookmark className="h-3 w-3 mr-1" />Speichern
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => handleGenerateTranscript(ad)} disabled={generatingFor === ad.id} className="border-border/50 text-xs h-7">
            {generatingFor === ad.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
            Transkript
          </Button>
          {ad.ad_snapshot_url && (
            <a href={ad.ad_snapshot_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors h-7 px-2">
              <ExternalLink className="h-3 w-3" />Vorschau
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const ImageAdCard = ({ ad }: { ad: ImageAdResult }) => {
    const isSelected = selectedAds.has(ad.id);
    const impressionsLower = ad.impressions ? parseInt(ad.impressions.lower_bound) : null;
    const impressionsUpper = ad.impressions ? parseInt(ad.impressions.upper_bound) : null;
    return (
      <Card
        className={`bg-card border-border/50 hover:border-border transition-all cursor-pointer relative ${isSelected ? "ring-2 ring-primary border-primary" : ""}`}
        onClick={() => toggleSelect(ad.id)}
      >
        {/* Selection indicator */}
        <div className="absolute top-2 left-2 z-10">
          {isSelected
            ? <CheckSquare className="h-5 w-5 text-primary drop-shadow-md" />
            : <Square className="h-5 w-5 text-muted-foreground/50 drop-shadow-md" />
          }
        </div>

        {/* Snapshot preview */}
        <div className="relative w-full aspect-video bg-muted/30 rounded-t-lg overflow-hidden border-b border-border/30">
          {ad.ad_snapshot_url ? (
            <iframe
              src={ad.ad_snapshot_url}
              className="w-full h-full pointer-events-none"
              title={`Ad ${ad.id}`}
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
        </div>

        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-6 w-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Globe className="h-3 w-3 text-primary" />
            </div>
            <p className="text-xs font-medium truncate flex-1">{ad.page_name || "Unbekannte Seite"}</p>
            {ad.ad_delivery_stop_time ? (
              <Badge variant="outline" className="text-xs h-4 px-1 text-muted-foreground">Inaktiv</Badge>
            ) : (
              <Badge className="text-xs h-4 px-1 bg-green-500/20 text-green-400 border-green-500/30">Aktiv</Badge>
            )}
          </div>

          {ad.ad_creative_link_titles?.[0] && (
            <p className="text-xs font-medium mb-1 line-clamp-1">{ad.ad_creative_link_titles[0]}</p>
          )}
          {ad.ad_creative_bodies?.[0] && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{ad.ad_creative_bodies[0]}</p>
          )}

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            {impressionsLower !== null && (
              <span className="flex items-center gap-1">
                👁 {impressionsLower >= 1000000
                  ? `${(impressionsLower / 1000000).toFixed(1)}M`
                  : impressionsLower >= 1000
                  ? `${(impressionsLower / 1000).toFixed(0)}K`
                  : impressionsLower.toLocaleString("de-DE")}
                {impressionsUpper && impressionsUpper !== impressionsLower && ` – ${impressionsUpper >= 1000000
                  ? `${(impressionsUpper / 1000000).toFixed(1)}M`
                  : impressionsUpper >= 1000
                  ? `${(impressionsUpper / 1000).toFixed(0)}K`
                  : impressionsUpper.toLocaleString("de-DE")}`}
              </span>
            )}
            {ad.ad_delivery_start_time && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(ad.ad_delivery_start_time).toLocaleDateString("de-DE", { month: "short", year: "2-digit" })}
              </span>
            )}
          </div>

          <div className="flex gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
            {ad.ad_snapshot_url && (
              <a
                href={ad.ad_snapshot_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors h-6 px-2 rounded border border-border/50 hover:bg-muted/50"
              >
                <ExternalLink className="h-3 w-3" />Öffnen
              </a>
            )}
            <Button size="sm" variant="outline" onClick={() => handleSaveAd(ad)} disabled={saveAdMutation.isPending} className="border-border/50 text-xs h-6 px-2">
              <Bookmark className="h-3 w-3 mr-1" />Speichern
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Meta Ad Library</h1>
          <p className="text-sm text-muted-foreground">Recherchiere Konkurrenten, analysiere Werbeanzeigen und lade Image Ads herunter.</p>
        </div>

        <Tabs defaultValue="image-scraper">
          <TabsList className="mb-6 bg-card border border-border/50">
            <TabsTrigger value="image-scraper" className="text-sm">
              <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
              Image Scraper
              {imgResults.length > 0 && <Badge variant="secondary" className="ml-2 h-5 text-xs">{imgResults.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="results" className="text-sm">
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Text-Suche
              {searchResults.length > 0 && <Badge variant="secondary" className="ml-2 h-5 text-xs">{searchResults.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="saved" className="text-sm">
              <BookOpen className="h-3.5 w-3.5 mr-1.5" />
              Gespeichert
              {savedAds && savedAds.length > 0 && <Badge variant="secondary" className="ml-2 h-5 text-xs">{savedAds.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* ─── IMAGE SCRAPER TAB ─────────────────────────────────────────── */}
          <TabsContent value="image-scraper">
            <Card className="bg-card border-border/50 mb-4">
              <CardContent className="p-5 space-y-4">
                {/* Main search row */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Input
                      placeholder="Suchbegriff oder Markenname..."
                      value={imgQuery}
                      onChange={(e) => setImgQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleImageSearch()}
                      className="bg-input border-border/50"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      placeholder="Page-IDs (kommagetrennt, z.B. 123456,789012)"
                      value={imgPageIds}
                      onChange={(e) => setImgPageIds(e.target.value)}
                      className="bg-input border-border/50"
                    />
                  </div>
                  <Select value={imgCountry} onValueChange={setImgCountry}>
                    <SelectTrigger className="w-full sm:w-36 bg-input border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleImageSearch} disabled={searchImagesMutation.isPending} className="shrink-0">
                    {searchImagesMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Suchen
                  </Button>
                </div>

                {/* Advanced Filters */}
                <Collapsible open={imgFiltersOpen} onOpenChange={setImgFiltersOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground text-xs h-7 px-2">
                      <Filter className="h-3 w-3 mr-1.5" />
                      Erweiterte Filter
                      <ChevronDown className={`h-3 w-3 ml-1.5 transition-transform ${imgFiltersOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-border/30 mt-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <Select value={imgActiveStatus} onValueChange={(v) => setImgActiveStatus(v as "ALL" | "ACTIVE" | "INACTIVE")}>
                          <SelectTrigger className="h-8 text-xs bg-input border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">Alle</SelectItem>
                            <SelectItem value="ACTIVE">Aktiv</SelectItem>
                            <SelectItem value="INACTIVE">Inaktiv</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Min. Impressionen</Label>
                        <Input
                          type="number"
                          placeholder="z.B. 10000"
                          value={imgMinImpressions}
                          onChange={(e) => setImgMinImpressions(e.target.value)}
                          className="h-8 text-xs bg-input border-border/50"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Max. Impressionen</Label>
                        <Input
                          type="number"
                          placeholder="z.B. 1000000"
                          value={imgMaxImpressions}
                          onChange={(e) => setImgMaxImpressions(e.target.value)}
                          className="h-8 text-xs bg-input border-border/50"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Start ab</Label>
                        <Input
                          type="date"
                          value={imgStartDateMin}
                          onChange={(e) => setImgStartDateMin(e.target.value)}
                          className="h-8 text-xs bg-input border-border/50"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Start bis</Label>
                        <Input
                          type="date"
                          value={imgStartDateMax}
                          onChange={(e) => setImgStartDateMax(e.target.value)}
                          className="h-8 text-xs bg-input border-border/50"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground"
                          onClick={() => {
                            setImgActiveStatus("ALL");
                            setImgMinImpressions("");
                            setImgMaxImpressions("");
                            setImgStartDateMin("");
                            setImgStartDateMax("");
                          }}
                        >
                          <X className="h-3 w-3 mr-1" />Filter zurücksetzen
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            {/* Selection toolbar */}
            {imgResults.length > 0 && (
              <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-card border border-border/50">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectedAds.size === imgResults.length ? clearSelection : selectAll}>
                  {selectedAds.size === imgResults.length
                    ? <><CheckSquare className="h-3.5 w-3.5 mr-1.5" />Alle abwählen</>
                    : <><Square className="h-3.5 w-3.5 mr-1.5" />Alle auswählen</>
                  }
                </Button>
                <span className="text-xs text-muted-foreground">
                  {selectedAds.size > 0 ? `${selectedAds.size} von ${imgResults.length} ausgewählt` : `${imgResults.length} Ergebnisse`}
                </span>
                <div className="ml-auto flex gap-2">
                  {selectedAds.size > 0 && (
                    <Button size="sm" variant="outline" className="text-xs h-7 border-border/50" onClick={handleDownloadSelected}>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Auswahl öffnen ({selectedAds.size})
                    </Button>
                  )}
                  <Button size="sm" className="text-xs h-7" onClick={handleDownloadAll}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Alle öffnen ({imgResults.length})
                  </Button>
                </div>
              </div>
            )}

            {/* Results grid */}
            {imgResults.length === 0 && !searchImagesMutation.isPending ? (
              <div className="text-center py-16">
                <ImageIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-1">Noch keine Ergebnisse</p>
                <p className="text-xs text-muted-foreground/60">Gib einen Suchbegriff oder eine Page-ID ein und klicke auf "Suchen".</p>
              </div>
            ) : searchImagesMutation.isPending && imgResults.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i} className="bg-card border-border/50">
                    <div className="aspect-video bg-muted/30 rounded-t-lg animate-pulse" />
                    <CardContent className="p-3 space-y-2">
                      <div className="h-3 bg-muted rounded w-24 animate-pulse" />
                      <div className="h-2 bg-muted rounded w-full animate-pulse" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {imgResults.map((ad) => (
                    <ImageAdCard key={ad.id} ad={ad} />
                  ))}
                </div>
                {imgHasMore && (
                  <div className="flex justify-center mt-6">
                    <Button variant="outline" onClick={handleLoadMore} disabled={searchImagesMutation.isPending} className="border-border/50">
                      {searchImagesMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                      Mehr laden
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ─── TEXT SEARCH TAB ───────────────────────────────────────────── */}
          <TabsContent value="results">
            <Card className="bg-card border-border/50 mb-6">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Input
                      placeholder="Suchbegriff, Markenname oder Branche..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="bg-input border-border/50"
                    />
                  </div>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger className="w-full sm:w-40 bg-input border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleSearch} disabled={searchMutation.isPending} className="shrink-0">
                    {searchMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Suchen
                  </Button>
                </div>
              </CardContent>
            </Card>

            {isMock && searchResults.length > 0 && (
              <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm text-amber-300/80">
                Demo-Daten werden angezeigt. Verbinde Meta für echte Ergebnisse.
              </div>
            )}

            {searchResults.length === 0 && !searchMutation.isPending ? (
              <div className="text-center py-16">
                <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Gib einen Suchbegriff ein und klicke auf "Suchen".</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((ad) => <AdCard key={ad.id} ad={ad} />)}
              </div>
            )}
          </TabsContent>

          {/* ─── SAVED TAB ────────────────────────────────────────────────── */}
          <TabsContent value="saved">
            {loadingSaved ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="bg-card border-border/50">
                    <CardContent className="p-4 space-y-2">
                      <div className="h-4 bg-muted rounded w-32" />
                      <div className="h-3 bg-muted rounded w-full" />
                      <div className="h-3 bg-muted rounded w-3/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !savedAds || savedAds.length === 0 ? (
              <div className="text-center py-16">
                <Bookmark className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Noch keine Ads gespeichert.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedAds.map((ad) => (
                  <Card key={ad.id} className="bg-card border-border/50 hover:border-border transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <Globe className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{ad.pageName || "Unbekannt"}</p>
                            <p className="text-xs text-muted-foreground">{ad.searchQuery}</p>
                          </div>
                        </div>
                      </div>
                      {ad.headline && <p className="text-sm font-medium mb-1">{ad.headline}</p>}
                      {ad.adText && <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{ad.adText}</p>}
                      <div className="flex gap-2">
                        <Button
                          size="sm" variant="outline"
                          onClick={() => {
                            if (!ad.adText) { toast.error("Kein Ad-Text"); return; }
                            setGeneratingFor(String(ad.id));
                            generateTranscriptMutation.mutate({ adText: ad.adText, headline: ad.headline || undefined, pageName: ad.pageName || undefined });
                          }}
                          disabled={generatingFor === String(ad.id)}
                          className="border-border/50 text-xs h-7"
                        >
                          {generatingFor === String(ad.id) ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                          Transkript
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => deleteAdMutation.mutate({ id: ad.id })}
                          disabled={deleteAdMutation.isPending}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-7 ml-auto"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
