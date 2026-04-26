import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { knowledgeFiles } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

const DEFAULT_KNOWLEDGE: Array<{ slug: string; title: string; content: string }> = [
  {
    slug: "offer",
    title: "Angebot & Produkt",
    content: `# EasySignals – Angebot & Produkt

## Was ist EasySignals?
EasySignals ist ein Trading-Signal-Service für Krypto- und Aktien-Trader. Wir liefern täglich präzise Handelssignale mit klaren Entry/Exit-Punkten, Stop-Loss und Take-Profit-Levels.

## Kernprodukt
- **EasySignals Premium**: Monatliches Abo für täglich 2-5 Trading-Signale
- **Telegram-Gruppe**: Exklusive Community mit Live-Signalen und Marktanalysen
- **Wöchentliche Webinare**: Live-Trading-Sessions mit Livio

## Preise
- Basic: 49€/Monat
- Premium: 97€/Monat
- VIP: 197€/Monat (inkl. 1:1 Coaching)

## USP (Unique Selling Proposition)
- Bewährte Strategie mit über 70% Trefferquote
- Transparente Performance-Dokumentation
- Persönlicher Support durch Livio
- Kein Vorwissen nötig – einfach kopieren und profitieren`,
  },
  {
    slug: "target_audience",
    title: "Zielgruppe",
    content: `# EasySignals – Zielgruppe

## Primäre Zielgruppe
**Berufstätige Männer, 25-45 Jahre**, die:
- Nebeneinkommen durch Trading aufbauen wollen
- Keine Zeit für stundenlange Chart-Analyse haben
- Bereits von Krypto/Aktien gehört haben, aber nicht wissen wie sie anfangen sollen
- Ein monatliches Einkommen von 2.000-8.000€ haben
- Bereit sind, 50-500€ zu investieren

## Psychografisches Profil
- Ehrgeizig, wollen finanziell unabhängig werden
- Frustriert von niedrigen Zinsen und Inflation
- Haben schon selbst versucht zu traden und Geld verloren
- Suchen nach einer "fertigen Lösung" – kein DIY
- Vertrauen Experten die Ergebnisse vorweisen können

## Schmerzpunkte
- "Ich habe keine Zeit, Charts stundenlang zu analysieren"
- "Ich weiß nicht welche Coins/Aktien ich kaufen soll"
- "Ich habe schon Geld verloren beim selbst traden"
- "Ich verpasse immer die besten Moves"
- "Ich will mein Geld für mich arbeiten lassen"`,
  },
  {
    slug: "painpoints",
    title: "Pain Points & Einwände",
    content: `# EasySignals – Pain Points & Einwände

## Top Pain Points
1. **Zeitproblem**: "Ich habe keine Zeit für Trading"
2. **Wissensproblem**: "Ich verstehe Charts nicht"
3. **Vertrauensproblem**: "Ich wurde schon von anderen Signalanbietern enttäuscht"
4. **Geldproblem**: "Ich habe kein Startkapital"
5. **FOMO**: "Ich verpasse täglich Gewinne"

## Häufige Einwände
- "Das ist zu teuer" → ROI-Argument: 1 gutes Signal = Abo-Kosten gedeckt
- "Funktioniert das wirklich?" → Social Proof: Screenshots, Testimonials
- "Ich brauche das nicht" → Schmerz verstärken: Was kostet dich Inaktivität?
- "Ich muss darüber nachdenken" → Scarcity: Limitierte Plätze
- "Ich kenne euch nicht" → Authority: Livio's Track Record zeigen

## Emotionale Trigger
- Angst vor dem Verpassen (FOMO)
- Wunsch nach finanzieller Freiheit
- Frustration über aktuellen Job/Gehalt
- Neid auf erfolgreiche Trader
- Hoffnung auf besseres Leben`,
  },
  {
    slug: "ad_angles",
    title: "Ad Angles & Hooks",
    content: `# EasySignals – Ad Angles & Hooks

## Bewährte Ad-Winkel

### 1. Ergebnis-Winkel (Results)
"Wie ich mit 3 Minuten täglich [X]€ nebenbei verdiene"
"Dieser eine Signal-Service hat meinen Account in 30 Tagen verdoppelt"

### 2. Schmerz-Winkel (Pain)
"Hör auf, Geld beim selbst traden zu verlieren"
"Warum 90% der Trader scheitern – und wie du zur anderen 10% gehörst"

### 3. Neugier-Winkel (Curiosity)
"Das Trading-Geheimnis das Banken nicht wollen dass du weißt"
"Warum kluge Leute keine eigene Strategie entwickeln"

### 4. Social Proof Winkel
"Über 500 Mitglieder können nicht irren"
"Schau was unsere Mitglieder diese Woche verdient haben"

### 5. Authority-Winkel
"Livio Swiss – 5 Jahre Trading-Erfahrung, jetzt teile ich alles"

## Beste Hooks (erste 3 Sekunden)
- "Ich zeige dir wie ich [Betrag] in [Zeit] gemacht habe..."
- "Wenn du das siehst, hör sofort auf selbst zu traden..."
- "Dieser Fehler kostet dich täglich Geld..."
- "Warte – bevor du deinen nächsten Trade machst..."
- "Die meisten Trader wissen das nicht..."`,
  },
  {
    slug: "scripts",
    title: "Bewährte Skripte & Vorlagen",
    content: `# EasySignals – Bewährte Skripte & Vorlagen

## Video Ad Skript Vorlage (30-60 Sek)

### Hook (0-5 Sek)
[Starke Aussage oder Frage die sofort Aufmerksamkeit erregt]

### Problem (5-15 Sek)
[Schmerz der Zielgruppe beschreiben – sie sollen sich wiedererkennen]

### Lösung (15-40 Sek)
[EasySignals als einfache Lösung präsentieren]
[Social Proof einbauen]
[Konkrete Ergebnisse nennen]

### CTA (40-60 Sek)
[Klarer Aufruf zur Handlung]
[Scarcity/Urgency wenn möglich]

## Bewährte Eröffnungen
1. "Ich war genau wie du – ich hatte keine Ahnung von Trading..."
2. "Schau dir das an – das ist mein Ergebnis von letzter Woche..."
3. "Stell dir vor, du wachst morgen auf und dein Konto ist [X]€ mehr wert..."
4. "Ich werde dir jetzt zeigen warum 90% der Trader Geld verlieren..."
5. "Diese 3 Minuten täglich haben mein Leben verändert..."

## Bewährte CTAs
- "Klick jetzt auf den Link und sichere dir deinen Platz"
- "Schreib mir 'SIGNAL' in die Kommentare"
- "Teste uns 7 Tage kostenlos – Link in der Bio"
- "Nur noch [X] Plätze verfügbar – jetzt handeln"`,
  },
];

export const knowledgeRouter = router({
  getOrInit: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const existing = await db
      .select()
      .from(knowledgeFiles)
      .where(eq(knowledgeFiles.userId, ctx.user.id));

    if (existing.length > 0) return existing;

    // Initialize with defaults
    for (const kf of DEFAULT_KNOWLEDGE) {
      await db.insert(knowledgeFiles).values({
        userId: ctx.user.id,
        slug: kf.slug,
        title: kf.title,
        content: kf.content,
      });
    }

    return await db
      .select()
      .from(knowledgeFiles)
      .where(eq(knowledgeFiles.userId, ctx.user.id));
  }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .update(knowledgeFiles)
        .set({ content: input.content })
        .where(
          and(
            eq(knowledgeFiles.id, input.id),
            eq(knowledgeFiles.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  expandWithAI: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const [file] = await db
        .select()
        .from(knowledgeFiles)
        .where(
          and(
            eq(knowledgeFiles.id, input.id),
            eq(knowledgeFiles.userId, ctx.user.id)
          )
        );
      if (!file) throw new Error("Datei nicht gefunden");

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Du bist ein Marketing-Experte für EasySignals, einen Trading-Signal-Service. 
Erweitere und verbessere den folgenden Wissensdatei-Inhalt mit zusätzlichen Details, Beispielen und Insights.
Behalte die Markdown-Formatierung bei. Antworte NUR mit dem verbesserten Inhalt, kein Präambel.`,
          },
          {
            role: "user",
            content: `Datei: ${file.title}\n\nAktueller Inhalt:\n${file.content}\n\nBitte erweitere und verbessere diesen Inhalt mit mehr Details, konkreten Beispielen und Marketing-Insights.`,
          },
        ],
      });

      const expanded =
        (response as any).choices?.[0]?.message?.content ?? file.content;

      await db
        .update(knowledgeFiles)
        .set({ content: expanded, lastExpandedAt: new Date() })
        .where(eq(knowledgeFiles.id, input.id));

      return { content: expanded };
    }),

  getAllContext: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const files = await db
      .select()
      .from(knowledgeFiles)
      .where(eq(knowledgeFiles.userId, ctx.user.id));

    if (files.length === 0) return "";

    return files
      .map((f) => `## ${f.title}\n${f.content}`)
      .join("\n\n---\n\n");
  }),
});
