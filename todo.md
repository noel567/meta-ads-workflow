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

## Automatische Budget-Regeln (April 2026)
- [x] Datenbank: budget_rules Tabelle (name, metric, condition, threshold, action, change_percent, campaign_id, active)
- [x] Datenbank: rule_executions Tabelle (rule_id, executed_at, triggered, old_budget, new_budget, reason)
- [x] Server: budgetRules.create, list, update, delete, toggle Procedures
- [x] Server: budgetRules.runNow + runSingle Procedures (alle aktiven Regeln prüfen + ausführen)
- [x] Server: Regel-Ausführungslogik (Meta API Insights abrufen → Bedingung prüfen → Budget anpassen)
- [x] Scheduler: Tägliche Regelausführung um 10:10 Uhr CEST (08:10 UTC)
- [x] Frontend: Budget-Regeln Seite (/budget-rules)
- [x] Frontend: Regel-Ersteller (Metrik, Bedingung, Schwellenwert, Aktion, Kampagne)
- [x] Frontend: Regel-Liste mit Toggle (aktiv/inaktiv) und Löschen
- [x] Frontend: Ausführungsprotokoll (wann ausgelöst, was geändert, Begründung)
- [x] Frontend: "Jetzt ausführen" Button für manuellen Test
- [x] Sidebar-Navigation: Budget-Regeln Eintrag

## Telegram-Benachrichtigung bei Budgetanpassungen (April 2026)
- [x] budgetRulesRouter: sendTelegramRuleNotification Hilfsfunktion (Bot API sendMessage)
- [x] executeRule: Telegram-Nachricht nach jeder ausgelösten Aktion senden (Budget erhöht/gesenkt/pausiert/aktiviert)
- [x] Nachrichtenformat: Emoji + Regelname + Kampagne + Metrik-Wert + Aktion + altes/neues Budget
- [x] Nur bei triggered=true benachrichtigen (nicht bei nicht erfüllten Bedingungen)
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Google Drive → Meta Video-Upload (April 2026)
- [x] Server: driveToMeta.listVideos — Videos aus Drive-Ordner 1ywN_lDHCkgWT4uL5sr4pmyEMzAnpx1oe auflisten
- [x] Server: driveToMeta.uploadToMeta — Video von Drive herunterladen und zu Meta advideos hochladen
- [x] Server: driveToMeta.refreshStatus — Upload-Status eines Meta-Videos abrufen
- [x] DB: drive_meta_uploads Tabelle (driveFileId, fileName, metaVideoId, status, createdAt)
- [x] Frontend: DriveToMeta.tsx Seite (/drive-to-meta)
- [x] Frontend: Video-Liste aus Drive-Ordner mit Name, Typ, Grösse, Datum
- [x] Frontend: Upload-Button pro Video mit Lade-Status
- [x] Frontend: Upload-Protokoll-Tabelle (hochgeladen, verarbeitet, Fehler)
- [x] Sidebar-Navigation: "Drive → Meta" Eintrag (CloudUpload-Icon)
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Telegram-Benachrichtigung bei Video-Upload (April 2026)
- [x] driveToMetaRouter: sendTelegramVideoNotification nach erfolgreichem uploadToMeta
- [x] Nachricht bei Erfolg: Dateiname, Meta Video-ID, Dateigrösse
- [x] Nachricht bei Fehler: Dateiname + Fehlermeldung
- [x] sendTelegramVideoReadyNotification: Benachrichtigung wenn Status auf "ready" wechselt
- [x] refreshStatus: Telegram-Benachrichtigung bei Statuswechsel processing → ready
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Batch-Upload Drive → Meta (April 2026)
- [x] Frontend: Checkbox pro Video-Zeile (Einzel-Auswahl)
- [x] Frontend: "Alle auswählen" Checkbox im Tabellen-Header
- [x] Frontend: Aktionsleiste erscheint wenn ≥1 Video ausgewählt (X ausgewählt + "Alle hochladen" Button)
- [x] Frontend: Batch-Upload sequenziell (ein Video nach dem anderen, mit Fortschrittsanzeige)
- [x] Frontend: Bereits hochgeladene Videos nicht auswählbar (deaktivierte Checkbox)
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Externe REST API mit API-Key Authentifizierung (April 2026)
- [x] DB: api_keys Tabelle (id, userId, name, keyHash, keyPreview, lastUsedAt, createdAt, revokedAt)
- [x] DB: DB-Helpers (createApiKey, getApiKeysByUser, getApiKeyByHash, revokeApiKey, updateApiKeyLastUsed)
- [x] Server: externalApiRoutes.ts — Express REST-Endpunkte unter /api/v1/
- [x] API: Middleware: Bearer Token aus Authorization-Header prüfen
- [x] API: GET /api/v1/me — API-Key Inhaber Info
- [x] API: GET /api/v1/campaigns — Kampagnen abrufen
- [x] API: GET /api/v1/ads — Ads abrufen
- [x] API: GET /api/v1/competitors — Konkurrenten abrufen
- [x] API: GET /api/v1/competitor-ads — Konkurrenz-Ads abrufen
- [x] API: GET /api/v1/batches — Ad-Batches abrufen
- [x] API: GET /api/v1/transcripts — Transkripte abrufen
- [x] API: GET /api/v1/budget-rules — Budget-Regeln abrufen
- [x] API: GET /api/v1/heygen-videos — HeyGen-Videos abrufen
- [x] API: GET /api/v1/video-research — Video Research Einträge abrufen
- [x] API: GET /api/v1/telegram-posts — Telegram-Posts abrufen
- [x] API: GET /api/v1/drive-uploads — Drive-Uploads abrufen
- [x] tRPC: apiKeys.create, apiKeys.list, apiKeys.revoke Prozeduren
- [x] Frontend: API-Keys Seite (/api-keys)
- [x] Frontend: Key erstellen (Name eingeben, Key wird einmalig angezeigt + Copy-Button)
- [x] Frontend: Key-Liste (Name, Preview, zuletzt verwendet, widerrufen)
- [x] Frontend: API-Dokumentation auf der Seite (alle Endpunkte + curl-Beispiel)
- [x] Sidebar-Navigation: "API-Keys" Eintrag (Key-Icon)
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Externe API POST-Endpunkte (April 2026)
- [x] POST /api/v1/competitors — Neuen Konkurrenten hinzufügen (name, pageId, country, language, notes)
- [x] DELETE /api/v1/competitors/:id — Konkurrenten entfernen
- [x] POST /api/v1/scan — Täglichen Konkurrenten-Scan manuell auslösen (async, 202)
- [x] POST /api/v1/batches/generate — Batch für eine Konkurrenz-Ad generieren (adId)
- [x] POST /api/v1/budget-rules — Neue Budget-Regel erstellen
- [x] PATCH /api/v1/budget-rules/:id/toggle — Budget-Regel aktivieren/deaktivieren
- [x] POST /api/v1/budget-rules/run — Alle Budget-Regeln jetzt ausführen (async, 202)
- [x] Frontend: POST/DELETE/PATCH-Endpunkte in API-Dokumentation mit farbcodierten Badges (blau/rot/gelb)
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Telegram Content Bot – Automatische Posts (April 2026)
- [x] DB: content_posts Tabelle (type, text, scheduledAt, sentAt, status, telegramMessageId)
- [x] DB: content_bot_settings Tabelle (autoSend per Post-Typ, aktive Uhrzeiten)
- [x] Server: contentBot.generatePost – KI generiert Post nach EasySignals-Stil (5 Typen)
- [x] Server: contentBot.sendPost – Post via Telegram Bot API senden
- [x] Server: contentBot.getPosts – Post-Liste abrufen (heute + History)
- [x] Server: contentBot.updateSettings – Auto-Senden Einstellungen speichern
- [x] Scheduler: alle 5 Minuten prüfen ob ein Post fällig ist (±5 Min Toleranz)
- [x] KI-Prompts: Mindset, Daily Recap, Social Proof, Scarcity/CTA, Abend-Recap
- [x] KI-Stil: kurze Zeilen, Schweizerdeutsch-Einflüsse, Livio-Persona, gezielte Emojis
- [x] Frontend: Content Bot Seite (/content-bot)
- [x] Frontend: Heutiger Post-Kalender (5 Slots mit Status: ausstehend/gesendet/fehler)
- [x] Frontend: Post-Vorschau mit Text und "Jetzt senden" Button
- [x] Frontend: "Alle heute generieren" Button
- [x] Frontend: Auto-Senden Toggle pro Post-Typ
- [x] Frontend: Post-History (letzte 7 Tage)
- [x] Sidebar-Navigation: "Content Bot" Eintrag (Bot-Icon)
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Content Bot: Posting-Zeiten konfigurierbar (April 2026)
- [x] Frontend: Zeitpicker (input type=time) neben jedem Auto-Send-Toggle in der Einstellungs-Tab
- [x] Frontend: Sofortiges Speichern der Uhrzeit via updateSettings Mutation (onBlur)
- [x] Frontend: Aktualisierte Zeiten werden in der Heute-Ansicht (PostCard) reflektiert
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Telegram Bot + Content Bot zusammenführen (April 2026)
- [x] ContentBot.tsx: "Bot testen" Button (testConnection) in Header integrieren
- [x] ContentBot.tsx: "Creative Report" Button (sendCreativeReport) in Header integrieren
- [x] ContentBot.tsx: Bild-Vorschau (imageUrl) in PostCard anzeigen wenn vorhanden
- [x] Sidebar: "Telegram Bot" Eintrag entfernen
- [x] App.tsx: /telegram Route auf /content-bot umleiten (Redirect)
- [x] App.tsx: TelegramBot Import entfernen
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Content Bot: Scheduler-Statusanzeige (April 2026)
- [x] Backend: contentBot.getSchedulerStatus Prozedur (berechnet nächsten geplanten Post pro Typ)
- [x] Frontend: SchedulerStatusPanel als eigener Tab (Tabelle aller Post-Typen mit Countdown)
- [x] Frontend: Übersichts-Banner mit nächstem Auto-Post im Scheduler-Tab
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Content Bot: Zeitzone Europe/Zurich (April 2026)
- [x] Backend: getSchedulerStatus – nextAt Berechnung auf Europe/Zurich umstellen
- [x] Backend: runContentBotScheduler – Vergleich der konfigurierten Uhrzeit in Schweizer Zeit
- [x] Backend: getScheduledTime + zurichTimeToDate Hilfsfunktionen für korrekte TZ-Konvertierung
- [x] Frontend: Zeitzone-Hinweis im Scheduler-Tab auf "Schweizer Zeit (CEST/CET)" geändert
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Content Bot: Hochdeutsch + Quote of the Day (April 2026)
- [x] Backend: Alle KI-Prompts auf sauberes Hochdeutsch umschreiben (kein Schweizerdeutsch)
- [x] Backend: Formatierung verbessern (klare Absätze, konsistente Emojis, kein Fließtext)
- [x] Backend: Neuer Post-Typ "quote" (Quote of the Day, täglich 09:00 Uhr, vollautomatisch)
- [x] Backend: KI wählt bekanntes Trading-Zitat + Autor, HTML-formatiert mit EasySignals-Branding
- [x] Backend: quote in PostType, autoMap, timeMap, getSchedulerStatus, generatePost, generateAllToday
- [x] DB: content_bot_settings – autoSendQuote + timeQuote Felder (Migration 0013)
- [x] DB: content_posts.type Enum um "quote" erweitert
- [x] Frontend: POST_TYPE_CONFIG um "quote" erweitert
- [x] Frontend: Quote-Slot in Heute-Ansicht und Einstellungen (Auto-Send Toggle + Zeitpicker)
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Content Bot: Quote Duplikat-Schutz (April 2026)
- [x] Backend: Letzte 30 Tage Quote-Posts aus DB laden (type="quote", alle Status)
- [x] Backend: Gesendete Zitate als Kontext an KI-Prompt übergeben ("Diese Zitate nicht wiederholen")
- [x] Backend: generatePostText(type, userId) – userId optional, bei quote wird DB-Abfrage ausgeführt
- [x] Backend: getQuoteDeduplicationNote() extrahiert Zitat-Snippets und baut Warnung
- [x] Backend: userId in generatePost, generateAllToday und runContentBotScheduler weitergegeben
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Content Bot: Quote als Bild senden (April 2026)
- [x] Backend: createQuoteImage.py – Pillow-Script erstellt 1080x1080 Bild (dunkler BG, Candlesticks, Logo, Zitat, Autor)
- [x] Backend: sendTelegramPhoto() – sendet Bild via multipart/form-data an Telegram sendPhoto API
- [x] Backend: sendQuoteAsImage() – extrahiert Zitat+Autor aus Text, erstellt Bild, lädt auf S3 hoch, sendet an Telegram
- [x] Backend: sendPost Prozedur – quote-Typ verwendet sendQuoteAsImage statt sendTelegramMessage
- [x] Backend: runContentBotScheduler – quote-Typ verwendet sendQuoteAsImage
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Content Bot: Quote-Bild Design überarbeiten (April 2026)
- [x] createQuoteImage.py: Design nach Beispielbildern (Candlestick rechts oben aufsteigend, links unten gedimmt, Kurve, grosses linksbündiges Zitat)
- [x] sendQuoteAsImage: Caption entfernt (nur Bild wird gesendet, kein Text)
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Content Bot: Quote-Bild Design v2 – KI-Hintergrund (April 2026)
- [x] KI-Hintergrundbild generiert (realistischer Candlestick-Chart, dunkel, teal/grün, 2048x2048)
- [x] createQuoteImage.py: KI-Hintergrund als Basis, Pillow legt Logo/Titel/Zitat/Autor darüber
- [x] Test-Bild erstellt und an Telegram gesendet (Message ID: 16)
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Content Bot: Echtes EasySignals-Logo im Quote-Bild (April 2026)
- [x] EasySignals-Logo-PNG (Logo_Weiss.png, 832x150, RGBA) heruntergeladen
- [x] createQuoteImage.py: Logo-PNG zentriert eingebettet (72px Hoehe, alpha_composite)
- [x] Fallback auf Unicode-Pfeil wenn Logo nicht vorhanden
- [x] Test-Bild erstellt und an Telegram gesendet (Message ID: 18)
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Content Bot: Mehrere Hintergrundvarianten (April 2026)
- [x] KI-Hintergrund Variante 2: Blauer Ton (deep navy, cyan/blaue Candlesticks)
- [x] KI-Hintergrund Variante 3: Dunkelgrüner Ton (forest green, smaragdgrüne Candlesticks)
- [x] createQuoteImage.py: BG_VARIANTS Liste mit 3 Einträgen (path + CDN-URL + name)
- [x] get_daily_bg_variant(): MD5-Hash des Datums als deterministischer Seed (gleicher Tag = gleiche Variante)
- [x] Test-Bilder für alle 3 Varianten erstellt und geprüft
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Content Bot: CTA auf @easysignal_de_bot setzen (April 2026)
- [x] contentBotRouter.ts: social_proof Prompt CTA auf @easysignal_de_bot geändert
- [x] contentBotRouter.ts: scarcity Prompt CTA auf @easysignal_de_bot geändert
- [x] Kein anderer Username mehr in den Posts
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Meta Ads Dashboard: Zeitraum Heute/Gestern + Zurück-Button (April 2026)
- [x] Zeitraum-Dropdown: "Heute" und "Gestern" als Optionen hinzufügen
- [x] Backend: dateRange-Logik für "today" und "yesterday" implementieren
- [x] Zurück-zum-Dashboard-Button auf Seiten ohne Sidebar-Navigation einbauen (MetaAdsDashboard, VideoResearch, BudgetRules, ApiKeys)
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Bugfix: API-Keys keyPreview zu lang (April 2026)
- [x] Schema: keyPreview varchar(16) → varchar(32) in drizzle/schema.ts
- [x] DB: ALTER TABLE api_keys MODIFY keyPreview varchar(32)
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Username/Password Login + User-Management (April 2026)
- [x] DB: users Tabelle – username (varchar 64, unique) + passwordHash (varchar 255) Felder hinzufügen
- [x] DB: Migration per ALTER TABLE anwenden
- [x] Backend: POST /api/auth/login (username + password → session cookie)
- [x] Backend: tRPC adminUsers.create (Admin erstellt User mit username + password)
- [x] Backend: tRPC adminUsers.list (Admin sieht alle User)
- [x] Backend: tRPC adminUsers.delete (Admin löscht User)
- [x] Backend: tRPC adminUsers.resetPassword (Admin setzt neues Passwort)
- [x] Frontend: Login-Seite um Username/Password-Tab erweitern (neben OTP)
- [x] Frontend: Admin-Seite /admin/users – User anlegen, auflisten, löschen, Passwort zurücksetzen
- [x] Sidebar: Admin-Eintrag nur für role=admin sichtbar
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Passwort-vergessen Flow (April 2026)
- [x] DB: password_reset_tokens Tabelle (id, userId, token, expiresAt, usedAt, createdAt)
- [x] DB: Migration per ALTER TABLE / CREATE TABLE anwenden
- [x] Backend: POST /api/auth/forgot-password (E-Mail eingeben → Token generieren → E-Mail senden)
- [x] Backend: POST /api/auth/reset-password (Token + neues Passwort → Passwort aktualisieren)
- [x] Backend: GET /api/auth/reset-password/:token (Token validieren → gültig/abgelaufen prüfen)
- [x] E-Mail: nodemailer mit SMTP senden (Reset-Link mit Token, 1h Ablaufzeit)
- [x] Frontend: ForgotPassword.tsx – E-Mail-Eingabe + Bestätigungsmeldung
- [x] Frontend: ResetPassword.tsx – Token aus URL, neues Passwort + Bestätigung eingeben
- [x] Frontend: Login-Seite – "Passwort vergessen?" Link unter Passwort-Feld
- [x] App.tsx: /forgot-password und /reset-password/:token Routen registrieren
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Sidebar immer sichtbar (April 2026)
- [x] Alle Seiten ohne DashboardLayout identifizieren
- [x] VideoResearch, BudgetRules, ApiKeys, MetaAdsDashboard, AdminUsers in DashboardLayout einbetten
- [x] Zurück-Buttons auf diesen Seiten entfernen (Sidebar übernimmt Navigation)
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## ContentBot: Post-Vorschau nach Generierung (April 2026)
- [x] Nach Generierung: Post-Text als Vorschau in der Karte anzeigen (optimistisches Update)
- [x] Vorschau: Bearbeiten-Textarea (editierbar, Klick auf Text)
- [x] Vorschau: „Jetzt senden“-Button direkt in der Karte
- [x] Vorschau: „Neu generieren“-Button zum Überschreiben
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## Bugfix: Quote-Bild-Vorschau fehlt (April 2026)
- [x] generatePost (quote): Bild beim Generieren erstellen, imageUrl in DB speichern
- [x] Frontend: imageUrl aus generatePost-Antwort ins optimistische Update übernehmen
- [x] 0 TypeScript-Fehler, 27/27 Tests bestanden

## DALL-E 3 Quote-Hintergrund (April 2026)
- [x] DALL-E 3 API-Aufruf in contentBotRouter.ts: einzigartigen Hintergrund pro Quote generieren
- [x] createQuoteImage.py: --background_url Parameter akzeptieren, Bild herunterladen und als Hintergrund verwenden
- [x] Fallback auf statische Hintergründe wenn DALL-E 3 fehlschlägt
- [x] Test: Quote-Bild mit DALL-E 3 Hintergrund generieren und an Telegram senden

## DALL-E 3 Hintergrundbild-Vorschau in ContentBot-UI (April 2026)
- [x] DB: dalleBackgroundUrl Feld in content_posts Tabelle hinzufügen
- [x] Backend: generateDallE3Background URL separat in DB speichern (dalleBackgroundUrl)
- [x] Backend: dalleBackgroundUrl in getTodaysPosts und generatePost zurückgeben
- [x] Frontend: Quote-Karte zeigt DALL-E 3 Hintergrundbild als Vorschau (klein, links)
- [x] Frontend: "Neuen Hintergrund generieren" Button in Quote-Karte (via Neu generieren)
- [x] Frontend: Vollbild-Vorschau des finalen Quote-Bildes (imageUrl) per Klick (Lightbox)

## DALL-E 3 Hintergrundstil-Dropdown (April 2026)
- [x] Backend: backgroundStyle Parameter in generatePost Procedure (optional, default "trading")
- [x] Backend: 8 Stil-Varianten mit eigenen DALL-E 3 Prompts (trading, skyline, abstract, nature, gold, dark_minimal, cosmic, luxury)
- [x] Backend: backgroundStyle in DB speichern (neues Feld in content_posts)
- [x] Frontend: Stil-Dropdown in Quote-Karte (vor Generierung auswählbar)
- [x] Frontend: Stil-Labels auf Deutsch mit Emoji-Icons
- [x] Frontend: Gewählter Stil bleibt nach Generierung sichtbar (Badge)

## Bug: Stil-Dropdown fehlt bei bestehendem Quote-Post (April 2026)
- [x] Stil-Dropdown auch im bestehenden Post-Zustand (neben "Neu generieren" Button) anzeigen
- [x] "Neu generieren" übergibt den gewählten Stil korrekt an generateMutation
