import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  Settings as SettingsIcon, Building2, HardDrive, CheckCircle2,
  Unlink, ExternalLink, Info, Sparkles
} from "lucide-react";

export default function Settings() {
  const { user, loading, isAuthenticated } = useAuth();

  // Brand Settings
  const { data: brandData, refetch: refetchBrand } = trpc.brand.get.useQuery(undefined, { enabled: isAuthenticated });
  const [brand, setBrand] = useState({
    brandName: "Easy Signals",
    brandDescription: "",
    targetAudience: "",
    toneOfVoice: "professionell und direkt",
    uniqueSellingPoints: "",
    callToActionDefault: "Jetzt kostenlos starten",
    language: "de",
  });

  useEffect(() => {
    if (brandData) setBrand({
      brandName: brandData.brandName || "Easy Signals",
      brandDescription: brandData.brandDescription || "",
      targetAudience: brandData.targetAudience || "",
      toneOfVoice: brandData.toneOfVoice || "professionell und direkt",
      uniqueSellingPoints: brandData.uniqueSellingPoints || "",
      callToActionDefault: brandData.callToActionDefault || "Jetzt kostenlos starten",
      language: brandData.language || "de",
    });
  }, [brandData]);

  const saveBrandMutation = trpc.brand.save.useMutation({
    onSuccess: () => { toast.success("Brand-Einstellungen gespeichert"); refetchBrand(); },
    onError: (e) => toast.error(e.message),
  });

  // Google Drive
  const { data: driveConnection, refetch: refetchDrive } = trpc.googleDrive.getConnection.useQuery(undefined, { enabled: isAuthenticated });
  const [driveToken, setDriveToken] = useState("");
  const [driveFolderName, setDriveFolderName] = useState("Easy Signals Ads");

  const connectDriveMutation = trpc.googleDrive.connect.useMutation({
    onSuccess: (data) => {
      toast.success(`Google Drive verbunden! Ordner "${data.folderName}" erstellt.`);
      setDriveToken("");
      refetchDrive();
    },
    onError: (e) => toast.error(e.message),
  });

  const disconnectDriveMutation = trpc.googleDrive.disconnect.useMutation({
    onSuccess: () => { toast.success("Google Drive getrennt"); refetchDrive(); },
    onError: (e) => toast.error(e.message),
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Bitte anmelden um fortzufahren.</p>
          <Button onClick={() => window.location.href = getLoginUrl()}>Anmelden</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Einstellungen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Konfiguriere dein Brand-Profil und externe Integrationen
          </p>
        </div>

        {/* Brand Settings */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Brand-Profil</CardTitle>
                <CardDescription className="text-xs">
                  Diese Informationen nutzt die KI, um alle Batches im Easy Signals Stil zu generieren
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex gap-2">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Je detaillierter du dein Brand-Profil ausfüllst, desto besser passen die generierten Batches zu Easy Signals.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Markenname *</Label>
                <Input
                  value={brand.brandName}
                  onChange={e => setBrand(b => ({ ...b, brandName: e.target.value }))}
                  placeholder="Easy Signals"
                />
              </div>
              <div className="space-y-2">
                <Label>Standard-CTA</Label>
                <Input
                  value={brand.callToActionDefault}
                  onChange={e => setBrand(b => ({ ...b, callToActionDefault: e.target.value }))}
                  placeholder="Jetzt kostenlos starten"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Unternehmensbeschreibung</Label>
              <Textarea
                value={brand.brandDescription}
                onChange={e => setBrand(b => ({ ...b, brandDescription: e.target.value }))}
                placeholder="Was macht Easy Signals? Welches Problem löst ihr? Was ist euer Angebot?"
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Zielgruppe</Label>
              <Textarea
                value={brand.targetAudience}
                onChange={e => setBrand(b => ({ ...b, targetAudience: e.target.value }))}
                placeholder="Wer sind eure Kunden? Alter, Interessen, Probleme, Wünsche..."
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Alleinstellungsmerkmale (USPs)</Label>
              <Textarea
                value={brand.uniqueSellingPoints}
                onChange={e => setBrand(b => ({ ...b, uniqueSellingPoints: e.target.value }))}
                placeholder="Was macht euch einzigartig? Warum sollten Kunden euch wählen?"
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ton der Kommunikation</Label>
                <Select value={brand.toneOfVoice} onValueChange={v => setBrand(b => ({ ...b, toneOfVoice: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professionell und direkt">Professionell & direkt</SelectItem>
                    <SelectItem value="freundlich und nahbar">Freundlich & nahbar</SelectItem>
                    <SelectItem value="energetisch und motivierend">Energetisch & motivierend</SelectItem>
                    <SelectItem value="vertrauenswürdig und seriös">Vertrauenswürdig & seriös</SelectItem>
                    <SelectItem value="humorvoll und locker">Humorvoll & locker</SelectItem>
                    <SelectItem value="inspirierend und visionär">Inspirierend & visionär</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ausgabesprache</Label>
                <Select value={brand.language} onValueChange={v => setBrand(b => ({ ...b, language: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="en">Englisch</SelectItem>
                    <SelectItem value="fr">Französisch</SelectItem>
                    <SelectItem value="it">Italienisch</SelectItem>
                    <SelectItem value="es">Spanisch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => saveBrandMutation.mutate(brand)}
              disabled={saveBrandMutation.isPending}
            >
              {saveBrandMutation.isPending ? "Wird gespeichert..." : "Brand-Profil speichern"}
            </Button>
          </CardContent>
        </Card>

        {/* Google Drive Integration */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Google Drive</CardTitle>
                  <CardDescription className="text-xs">
                    Batches und Transkripte automatisch in Google Drive ablegen
                  </CardDescription>
                </div>
              </div>
              {driveConnection && (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Verbunden
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {driveConnection ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-foreground">Google Drive verbunden</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Root-Ordner: <strong className="text-foreground">{driveConnection.rootFolderName}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Verbunden seit: {new Date(driveConnection.createdAt).toLocaleDateString("de-DE")}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Wie es funktioniert:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Batches werden täglich nach Datum in Unterordnern abgelegt</li>
                    <li>• Jeder Batch enthält alle 3 Hooks, Body, CTA und HeyGen-Skript</li>
                    <li>• Dateien werden als Google Docs gespeichert (direkt bearbeitbar)</li>
                  </ul>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => disconnectDriveMutation.mutate()}
                  disabled={disconnectDriveMutation.isPending}
                >
                  <Unlink className="w-4 h-4" />
                  Google Drive trennen
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 flex gap-2">
                  <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Google Access Token benötigt</p>
                    <p>Gehe zu <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google OAuth Playground</a>, autorisiere den Scope <code className="bg-muted px-1 rounded">https://www.googleapis.com/auth/drive.file</code> und kopiere den Access Token hierher.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Google Access Token</Label>
                  <Input
                    type="password"
                    placeholder="ya29.a0AfH6SMB..."
                    value={driveToken}
                    onChange={e => setDriveToken(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Root-Ordner Name</Label>
                  <Input
                    value={driveFolderName}
                    onChange={e => setDriveFolderName(e.target.value)}
                    placeholder="Easy Signals Ads"
                  />
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={() => connectDriveMutation.mutate({ accessToken: driveToken, folderName: driveFolderName })}
                  disabled={!driveToken || connectDriveMutation.isPending}
                >
                  {connectDriveMutation.isPending ? "Verbinde..." : (
                    <>
                      <HardDrive className="w-4 h-4" />
                      Google Drive verbinden
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
