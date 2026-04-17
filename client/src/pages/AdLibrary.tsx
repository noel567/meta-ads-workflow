import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BookOpen,
  Bookmark,
  Calendar,
  ExternalLink,
  Globe,
  Loader2,
  Search,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  _isMock?: boolean;
}

export default function AdLibrary() {
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("DE");
  const [searchResults, setSearchResults] = useState<AdResult[]>([]);
  const [isMock, setIsMock] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const { data: savedAds, isLoading: loadingSaved } = trpc.adLibrary.getSaved.useQuery();

  const searchMutation = trpc.adLibrary.search.useMutation({
    onSuccess: (data) => {
      setSearchResults(data.results as AdResult[]);
      setIsMock(!!data.isMock);
      if (data.results.length === 0) {
        toast.info("Keine Ergebnisse gefunden. Versuche einen anderen Suchbegriff.");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const saveAdMutation = trpc.adLibrary.saveAd.useMutation({
    onSuccess: () => {
      toast.success("Ad gespeichert");
      utils.adLibrary.getSaved.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAdMutation = trpc.adLibrary.deleteSaved.useMutation({
    onSuccess: () => {
      toast.success("Ad gelöscht");
      utils.adLibrary.getSaved.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const createTranscriptMutation = trpc.transcripts.create.useMutation({
    onSuccess: () => {
      utils.transcripts.list.invalidate();
      utils.dashboard.getStats.invalidate();
      toast.success("Transkript erstellt und gespeichert");
      setGeneratingFor(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setGeneratingFor(null);
    },
  });

  const generateTranscriptMutation = trpc.transcripts.generateFromAd.useMutation({
    onSuccess: (data, variables) => {
      createTranscriptMutation.mutate({
        title: `Transkript – ${variables.pageName || "Unbekannt"} – ${new Date().toLocaleDateString("de-DE")}`,
        content: String(data.content),
        sourceType: "ai_generated",
      });
    },
    onError: (err) => {
      toast.error(err.message);
      setGeneratingFor(null);
    },
  });

  const handleSearch = () => {
    if (!query.trim()) {
      toast.error("Bitte einen Suchbegriff eingeben");
      return;
    }
    searchMutation.mutate({ query, country });
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

  const handleGenerateTranscript = async (ad: AdResult) => {
    const adText = ad.ad_creative_bodies?.[0];
    if (!adText) {
      toast.error("Kein Ad-Text gefunden");
      return;
    }
    setGeneratingFor(ad.id);
    generateTranscriptMutation.mutate({
      adText,
      headline: ad.ad_creative_link_titles?.[0] ?? undefined,
      pageName: ad.page_name ?? undefined,
    });
  };


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
          {ad._isMock && (
            <Badge variant="outline" className="badge-paused text-xs shrink-0">Demo</Badge>
          )}
        </div>

        {ad.ad_creative_link_titles?.[0] && (
          <p className="text-sm font-medium mb-1 text-foreground">{ad.ad_creative_link_titles[0]}</p>
        )}

        {ad.ad_creative_bodies?.[0] && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
            {ad.ad_creative_bodies[0]}
          </p>
        )}

        {ad.impressions && (
          <p className="text-xs text-muted-foreground mb-3">
            Impressionen: {parseInt(ad.impressions.lower_bound).toLocaleString("de-DE")} – {parseInt(ad.impressions.upper_bound).toLocaleString("de-DE")}
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          {showSave && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSaveAd(ad)}
              disabled={saveAdMutation.isPending}
              className="border-border/50 text-xs h-7"
            >
              <Bookmark className="h-3 w-3 mr-1" />
              Speichern
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleGenerateTranscript(ad)}
            disabled={generatingFor === ad.id}
            className="border-border/50 text-xs h-7"
          >
            {generatingFor === ad.id ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3 mr-1" />
            )}
            Transkript erstellen
          </Button>
          {ad.ad_snapshot_url && (
            <a
              href={ad.ad_snapshot_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors h-7 px-2"
            >
              <ExternalLink className="h-3 w-3" />
              Vorschau
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Meta Ad Library</h1>
          <p className="text-sm text-muted-foreground">
            Recherchiere Konkurrenten und analysiere deren Werbeanzeigen.
          </p>
        </div>

        {/* Search Form */}
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
              <Button
                onClick={handleSearch}
                disabled={searchMutation.isPending}
                className="shrink-0"
              >
                {searchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Suchen
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="results">
          <TabsList className="mb-6 bg-card border border-border/50">
            <TabsTrigger value="results" className="text-sm">
              Suchergebnisse
              {searchResults.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 text-xs">{searchResults.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="saved" className="text-sm">
              Gespeichert
              {savedAds && savedAds.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 text-xs">{savedAds.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="results">
            {isMock && searchResults.length > 0 && (
              <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm text-amber-300/80">
                Demo-Daten werden angezeigt. Konfiguriere den Meta Ad Library Token in den Einstellungen für echte Ergebnisse.
              </div>
            )}

            {searchResults.length === 0 && !searchMutation.isPending ? (
              <div className="text-center py-16">
                <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Gib einen Suchbegriff ein und klicke auf "Suchen".
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((ad) => (
                  <AdCard key={ad.id} ad={ad} />
                ))}
              </div>
            )}
          </TabsContent>

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
                <p className="text-sm text-muted-foreground">
                  Noch keine Ads gespeichert. Suche nach Konkurrenten und speichere interessante Ads.
                </p>
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

                      {ad.headline && (
                        <p className="text-sm font-medium mb-1">{ad.headline}</p>
                      )}
                      {ad.adText && (
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{ad.adText}</p>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!ad.adText) { toast.error("Kein Ad-Text"); return; }
                            setGeneratingFor(String(ad.id));
                            generateTranscriptMutation.mutate({
                              adText: ad.adText,
                              headline: ad.headline || undefined,
                              pageName: ad.pageName || undefined,
                            });
                          }}
                          disabled={generatingFor === String(ad.id)}
                          className="border-border/50 text-xs h-7"
                        >
                          {generatingFor === String(ad.id) ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Wand2 className="h-3 w-3 mr-1" />
                          )}
                          Transkript
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
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
