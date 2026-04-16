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
