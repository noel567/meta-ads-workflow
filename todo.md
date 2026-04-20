# Meta Ads Creative Workflow – TODO

## Datenbank & Backend
- [x] DB-Schema: meta_connections (Meta API Tokens)
- [x] DB-Schema: campaigns (eigene Kampagnen-Cache)
- [x] DB-Schema: ads (eigene Ads-Cache mit KPIs)
- [x] DB-Schema: competitor_ads (Ad Library Ergebnisse)
- [x] DB-Schema: transcripts (erstellte Transkripte)
- [x] DB-Schema: documents (exportierte Dokumente)
- [x] tRPC Router: meta (connect, disconnect, syncCampaigns, syncAds)
- [x] tRPC Router: analytics (getAds, getKPIs, getAIInsights)
- [x] tRPC Router: adLibrary (search, saveAd, getSaved, deleteSaved)
- [x] tRPC Router: transcripts (create, list, get, update, delete, generateFromAd)
- [x] tRPC Router: documents (export, list, delete)
- [x] tRPC Router: dashboard (stats)

## Frontend – Design & Layout
- [x] Elegantes Dark-Theme Design-System (OKLCH Farben, Premium-Typografie)
- [x] DashboardLayout mit Sidebar-Navigation für alle Module
- [x] Responsive Layout (Desktop-first)
- [x] Globale Styles in index.css (Farben, Fonts, Shadows, Badges)

## Modul 1: Meta Ads Manager Integration
- [x] Verbindungsseite: Meta API Token eingeben und speichern
- [x] Connect-Flow mit Access Token, Ad Account ID, App ID
- [x] Verbindungsstatus anzeigen (aktiv/inaktiv)
- [x] Kampagnen-Sync und Ads-Sync Buttons

## Modul 2: Ads Performance Auswertung
- [x] KPI-Dashboard: Ausgaben, Impressionen, Klicks, CTR, CPC, ROAS
- [x] Recharts-Diagramme für Top Ads nach Ausgaben
- [x] KI-Analyse: Was performt gut / was verbessern (invokeLLM)
- [x] Kampagnen-Liste und Ads-Liste mit Expand-Details

## Modul 3: Meta Ad Library Suche
- [x] Suchformular: Suchbegriff, Land
- [x] Ad Library API Integration mit Mock-Fallback
- [x] Ergebnisse als Cards anzeigen (Text, Sponsor, Datum, Impressionen)
- [x] Ads speichern und verwalten (Gespeichert-Tab)

## Modul 4: Transkript-Erstellung
- [x] KI-gestützte Transkript-Generierung aus Ad Library Ergebnissen
- [x] Transkript-Editor (bearbeitbares Textfeld)
- [x] Transkripte speichern, benennen und verwalten
- [x] Liste aller gespeicherten Transkripte mit Quell-Badge

## Modul 5: Teleprompter
- [x] Vollbild-Teleprompter-Ansicht (requestFullscreen)
- [x] Einstellbare Scrollgeschwindigkeit (Slider)
- [x] Einstellbare Schriftgröße (Slider)
- [x] Start/Pause/Reset-Steuerung mit Keyboard-Shortcuts
- [x] Transkript aus Liste auswählen und laden
- [x] Fortschrittsbalken

## Modul 6: Creative Workflow Dashboard (Startseite)
- [x] Übersichts-Dashboard mit Schnellzugriff auf alle Module
- [x] Statistik-Karten (Kampagnen, Ads, Konkurrenz-Ads, Transkripte, Dokumente)
- [x] Performance-Übersicht (Ausgaben, CTR, ROAS)
- [x] Zuletzt bearbeitete Transkripte

## Modul 7: Dokument-Export
- [x] Transkript als Markdown exportieren (Download)
- [x] Gespeicherte Dokumente verwalten
- [x] Dokument-Download als .md Datei

## Tests
- [x] Vitest: auth router tests (2 tests)
- [x] Vitest: meta router tests (2 tests)
- [x] Vitest: analytics router tests (3 tests)
- [x] Vitest: adLibrary router tests (3 tests)
- [x] Vitest: transcripts router tests (3 tests)
- [x] Vitest: documents router tests (2 tests)
- [x] Vitest: dashboard stats tests (1 test)
- [x] Alle 17 Tests bestanden ✓

## ERWEITERUNG: Vollautomatisierter Ad-Produktions-Workflow

### Konkurrenten-Management
- [x] Konkurrenten-Liste: Seite/Brand-Name + Meta Page ID speichern und verwalten
- [x] Tägliches Monitoring: Neue Ads von Konkurrenten automatisch erkennen
- [x] Ad-Status-Tracking: Welche Ads sind neu seit letztem Scan
- [x] Mehrsprachige Ads unterstützen (EN, FR, ES, etc.)

### KI-Transkript-Pipeline
- [x] Automatische Transkript-Extraktion aus Konkurrenz-Ads
- [x] KI-Übersetzung ins Deutsche (falls Ad in anderer Sprache)
- [x] Easy Signals Branding-Anpassung: Transkript auf eigene Firma/Produkt ummünzen
- [x] Qualitäts-Score für jedes generierte Transkript

### Batch-Generator (Kern-Feature)
- [x] Pro Konkurrenz-Ad automatisch einen Batch erstellen
- [x] Batch = 1 Body (Hauptskript) + 1 CTA + 3 verschiedene Hooks
- [x] Hooks: kreativ, kontext-bewusst, Easy Signals Branding
- [x] Batch-Übersicht: Alle Batches des Tages auf einen Blick
- [x] Batch-Status: Entwurf / Bereit / Exportiert

### HeyGen-Skript-Export
- [x] Skript im HeyGen-Format formatieren (sauberer Fließtext, Pausen-Markierungen)
- [x] Ein-Klick-Kopieren des HeyGen-Skripts in die Zwischenablage
- [x] HeyGen-Skript-Vorschau mit Formatierung
- [x] Alle Hooks einzeln als HeyGen-Skript exportierbar

### Google Drive Integration
- [x] Google OAuth Verbindung (Drive API)
- [x] Ordnerstruktur automatisch anlegen: /Easy Signals Ads/YYYY-MM-DD/Konkurrent/
- [x] Batch-Dokument automatisch in Google Drive speichern
- [x] Tägliche Zusammenfassung als Google Doc ablegen
- [x] Sync-Status anzeigen (zuletzt synchronisiert)

### Automatisierung & Scheduler
- [x] Täglicher Cron-Job: Alle Konkurrenten scannen (morgens 07:00 Uhr)
- [x] Automatische Batch-Generierung nach jedem Scan
- [x] Automatischer Google Drive Upload nach Batch-Generierung
- [x] Benachrichtigung wenn neue Batches bereit sind
- [x] Scan-Protokoll / History anzeigen

### UI-Erweiterungen
- [x] Konkurrenten-Seite: Liste, Hinzufügen, Entfernen, Status
- [x] Batch-Übersicht: Tagesansicht aller generierten Batches
- [x] Batch-Detail: Body, CTA, 3 Hooks mit Edit + HeyGen-Export
- [x] Google Drive Status-Widget im Dashboard
- [x] Teleprompter: Batch direkt aus Batch-Übersicht laden

## Tests Erweiterung
- [x] Vitest: competitors router tests (2 tests)
- [x] Vitest: batches router tests (2 tests)
- [x] Vitest: brand router tests (2 tests)
- [x] Vitest: googleDrive router tests (1 test)
- [x] Vitest: automation router tests (1 test)
- [x] Alle 25 Tests bestanden ✓

## Offene Punkte (nächste Iteration)
- [x] Scan-Protokoll / History UI-Seite (in Competitors-Seite integriert)
- [x] Batch-Edit-Funktion (Body, CTA, Hooks inline bearbeiten)
- [x] Automatischer Google Drive Upload nach Batch-Generierung im Scheduler
- [x] Tägliche Zusammenfassung als Google Doc nach Scheduler-Lauf
- [x] Ordnerstruktur in Drive: /Easy Signals Ads/YYYY-MM-DD/Konkurrent/

## HeyGen-Integration (direkte Video-Erstellung)
- [x] HeyGen API-Key in Einstellungen hinterlegen (Secret)
- [x] tRPC Router: heygen.getAvatars (Liste aller Avatare)
- [x] tRPC Router: heygen.getVoices (Liste aller Stimmen)
- [x] tRPC Router: heygen.createVideo (Video aus Skript erstellen)
- [x] tRPC Router: heygen.getVideoStatus (Video-Status abrufen)
- [x] tRPC Router: heygen.getVideos (Liste erstellter Videos)
- [x] DB-Schema: heygen_videos Tabelle (video_id, batch_id, status, url)
- [x] UI: "An HeyGen senden" Button in Batches.tsx
- [x] UI: Avatar + Voice Auswahl-Dialog
- [x] UI: Video-Status-Anzeige (pending/processing/completed/failed)
- [x] UI: Link zum fertigen Video in HeyGen
- [x] UI: HeyGen-Status in Einstellungen (API-Key-Verbindung testen)

## Hook-Generator (automatisch 3 Hooks pro Skript)
- [x] Backend: hooks.generate tRPC-Router (Skript-Text → 3 Hooks mit Typ + Inhalt)
- [x] Hook-Typen: Neugier-Hook, Problem/Schmerz-Hook, Ergebnis/Transformation-Hook
- [x] Hook-Generator Komponente: HookGenerator.tsx (wiederverwendbar)
- [x] Integration in Transkripte-Seite: "3 Hooks generieren" Button pro Transkript
- [x] Integration in Batches-Seite: Hooks direkt aus Batch-Body neu generieren
- [x] Hooks inline bearbeitbar und einzeln kopierbar
- [x] Hooks als HeyGen-Skript formatiert exportierbar
- [x] Hooks in Teleprompter ladbar
- [x] Vitest: hooks.generate Router Test (in meta-ads-workflow.test.ts)

## Google Drive OAuth (echter OAuth 2.0 Flow)
- [x] Google Cloud Console: OAuth 2.0 Client-ID und Client-Secret
- [x] Backend: /api/google/auth Route (OAuth Redirect zu Google)
- [x] Backend: /api/google/callback Route (Code → Access + Refresh Token)
- [x] Backend: Token-Erneuerung via Refresh Token (automatisch)
- [x] Backend: Drive-Upload mit echtem Token (Ordner erstellen + Datei hochladen)
- [x] Frontend: "Mit Google Drive verbinden" Button in Settings
- [x] Frontend: OAuth-Redirect-Flow (Redirect zu Google + Callback)
- [x] Frontend: Verbindungsstatus anzeigen (verbunden/getrennt + E-Mail)
- [x] Frontend: Verbindung trennen Button
- [x] Vitest: Google Drive Token-Refresh Test (27/27 bestanden)

## Bugfixes (April 2026)
- [x] Google Drive OAuth 403-Fehler: googleRedirectUri zu ENV hinzugefügt (server/_core/env.ts)
- [x] GOOGLE_REDIRECT_URI Secret gesetzt (feste Callback-URL für OAuth)
- [x] getRedirectUri() nutzt ENV.googleRedirectUri als primäre Quelle
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Video Research Pipeline (April 2026)
- [x] Datenbank: video_research Tabelle (url, platform, competitor, status, transcript, analysis, adaptations, driveLink)
- [x] Server: video.submit – URL einreichen, yt-dlp Download starten, S3 speichern
- [x] Server: video.transcribe – Whisper-Transkription aus Video-URL
- [x] Server: video.analyze – KI-Analyse (Hook, Body, CTA, Mechanik, Zielgruppe, Offer-Struktur)
- [x] Server: video.adapt – EasySignals-Adaption (3 Hooks, Body, CTA, HeyGen-Skript, Telegram-Post, Nano-Banana-Prompt)
- [x] Server: video.exportToDrive – Video + Analyse strukturiert in Google Drive ablegen
- [x] Frontend: Video Research Seite (/video-research) mit URL-Eingabe und Pipeline-Status
- [x] Frontend: Pipeline-Status-Anzeige (Download → Transkript → Analyse → Adaption)
- [x] Frontend: Transkript-Viewer mit Hook/Body/CTA-Markierungen
- [x] Frontend: Analyse-Card (Zielgruppe, Mechanik, Offer-Struktur, Warum-es-funktioniert)
- [x] Frontend: Adaption-Panel (alle 7 Outputs: Hooks, Body, CTA, HeyGen, Telegram, Nano-Banana)
- [x] Frontend: Video-Library mit Filterung nach Konkurrent/Plattform/Status/Datum
- [x] Frontend: Sidebar-Navigation: "Video Research" Eintrag hinzufügen

## Telegram Content Bot (April 2026)
- [x] telegram_posts Tabelle in Drizzle-Schema (text, image_url, status, sent_at, scheduled_at)
- [x] telegram_settings Tabelle (bot_token, chat_id, posting_time, active)
- [x] Server: telegram.generatePost Procedure (KI-Text nach EasySignals COS)
- [x] Server: Bild-Generierung für Telegram-Post (generateImage)
- [x] Server: telegram.sendPost Procedure (Bild + Text via Telegram Bot API)
- [x] Server: telegram.schedulePost Procedure (täglicher Cron-Job)
- [x] Server: telegram.getPosts Procedure (Post-Historie)
- [x] Frontend: Telegram-Content Seite (/telegram)
- [x] Frontend: Post-Vorschau mit Bild + Text
- [x] Frontend: Manueller Post-Button
- [x] Frontend: Posting-Zeit konfigurieren
- [x] Frontend: Post-Historie anzeigen
- [x] Sidebar-Navigation: Telegram-Eintrag

## Verbesserungen (April 2026)
- [x] Telegram-Scheduler nutzt konfigurierte Posting-Zeit aus DB (postingTimeHour/postingTimeMinute) statt hardcoded
- [x] EasySignals COS vollständig in Telegram-Generierung eingebaut (alle 6 Post-Kategorien, Berndeutsch-Regeln, Persona Livio)
- [x] Video Research Library: Filter nach Plattform, Konkurrent und Zeitraum (Heute/Woche/Monat) hinzugefügt
- [x] Telegram Chat ID auf @Manuseasy (-1003503941067) aktualisiert und getestet
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Meta Ads Analytics Dashboard (April 2026)
- [x] Meta Access Token gespeichert und API-Verbindung getestet (LGLShop Account)
- [x] Datenbank-Tabellen: meta_ad_insights + meta_ai_analyses
- [x] Server: metaInsightsRouter (sync, getInsights, analyze, getLatestAnalysis, getAccountOverview)
- [x] Frontend: MetaAdsDashboard (/meta-ads) mit KPI-Cards, KI-Analyse-Tabs, Budget-Empfehlungen, Top-Performer
- [x] Sidebar-Navigation: "Meta Ads Analytics" Eintrag hinzugefügt
- [x] Tägliche automatische Analyse um 10:00 CEST (08:00 UTC) im Scheduler
- [x] Telegram-Benachrichtigung nach täglicher Analyse
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Ad-Level Creative Analyse (April 2026)
- [x] Server: Ad-Level Insights von Meta API abrufen (CTR, CPC, Spend, Impressions, Conversions pro Ad)
- [x] Server: Creative-Thumbnails (Vorschaubild) pro Ad abrufen
- [x] Server: KI-Analyse auf Ad-Ebene (Top/Schwache Creatives, Empfehlungen)
- [x] Frontend: Ad-Level Tab im Meta Ads Dashboard
- [x] Frontend: Creative-Cards mit Thumbnail, Ad-Name, KPIs (CTR, CPC, Spend, CPL)
- [x] Frontend: Sortierung nach Performance-Metrik (CTR, Spend, CPC, Leads, Impressionen)
- [x] Frontend: KI-Empfehlungen pro Creative (pausieren/skalieren/testen)
- [x] Frontend: Ad-Text expandierbar pro Creative-Card

## Creative Detail Ansicht (April 2026)
- [x] Datenbank: ad_comments Tabelle (ad_id, user_id, text, created_at)
- [x] Server: adComments.add, adComments.list, adComments.delete Procedures
- [x] Frontend: Creative Detail Slide-over Panel (Sheet) – rechts aufklappend
- [x] Frontend: Vollständige Ad-Vorschau (grosses Thumbnail + Link zu Ad Library)
- [x] Frontend: Alle 8 KPIs in Detailansicht (Spend, CTR, CPC, CPL, Impressionen, Reichweite, Klicks, Leads)
- [x] Frontend: Vollständiger Ad-Text in Detailansicht (nicht abgeschnitten)
- [x] Frontend: Kommentar-Eingabe mit Textarea + Speichern-Button
- [x] Frontend: Kommentar-Liste mit Datum + Löschen (hover)

## Täglicher Telegram Creative-Report (April 2026)
- [x] Scheduler: runDailyCreativeReport Funktion (Meta API → Top-3/Flop-3 → Telegram)
- [x] Formatierung: Emoji-reicher Telegram-Report mit Ad-Name, CTR, CPC, Spend, Leads
- [x] Cron-Job: täglich 10:05 Uhr CEST (nach Meta-Analyse um 10:00)
- [x] Frontend: "Creative Report" Button in Telegram-Seite (manueller Trigger)
- [x] Server: sendCreativeReport Procedure im metaInsightsRouter

## Budget-Anpassen in Creative-Detailansicht (April 2026)
- [x] Server: metaInsights.updateCampaignBudget Procedure (Meta API POST /{campaignId} mit daily_budget in Cents)
- [x] Server: metaInsights.getCampaignBudget Procedure (aktuelles Budget + Verbleibend abrufen)
- [x] Frontend: Budget-Anpassen UI im Creative Detail Sheet (aktuelles Budget, Schnell-Buttons -20%/-10%/+10%/+20%/+50%, CHF-Eingabe)
- [x] Frontend: Warnhinweis vor Budget-Änderung ("wird sofort in Meta übernommen")
- [x] Frontend: Erfolgs-/Fehler-Toast nach Budget-Änderung + automatisches Budget-Refresh
