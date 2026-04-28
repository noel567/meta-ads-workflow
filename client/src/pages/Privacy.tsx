export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Datenschutzrichtlinie</h1>
        <p className="text-muted-foreground text-sm mb-10">Zuletzt aktualisiert: April 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">1. Verantwortliche Stelle</h2>
          <p className="text-muted-foreground leading-relaxed">
            Diese Anwendung (<strong>Meta Ads Creative Workflow</strong>) wird von EasySignals (Noel Glausen) betrieben
            und dient ausschließlich der internen Verwaltung von Meta-Werbekampagnen, Kommentaren und
            Performance-Analysen.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">2. Erhobene Daten</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Die App verbindet sich über die offizielle Meta (Facebook) API mit deinem Werbekonto. Dabei werden
            folgende Daten verarbeitet:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>Meta Access Token (zur Authentifizierung)</li>
            <li>Ad Account ID und Name</li>
            <li>Kampagnen- und Anzeigendaten (Spend, Impressionen, Klicks)</li>
            <li>Kommentare und Reaktionen auf Anzeigen</li>
            <li>Verbundene Facebook-Seiten (Name, ID)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">3. Verwendung der Daten</h2>
          <p className="text-muted-foreground leading-relaxed">
            Alle erhobenen Daten werden ausschließlich zur internen Nutzung durch den App-Betreiber verwendet.
            Die Daten werden nicht an Dritte weitergegeben, nicht verkauft und nicht für Werbezwecke genutzt.
            Die Verbindung zur Meta API erfolgt nur lesend (<em>read-only</em>) für Kampagnen- und Performance-Daten.
            Kommentarverwaltung (Antworten, Verstecken) erfolgt nur auf explizite Nutzeranforderung.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">4. Datenspeicherung</h2>
          <p className="text-muted-foreground leading-relaxed">
            Synchronisierte Kampagnen- und Anzeigendaten werden in einer gesicherten Datenbank gespeichert,
            die ausschließlich dem App-Betreiber zugänglich ist. Access Tokens werden verschlüsselt gespeichert
            und können jederzeit über die App-Einstellungen widerrufen werden.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">5. Meta-Berechtigungen</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Die App fordert folgende Meta-Berechtigungen an:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li><strong>ads_read</strong> – Kampagnen und Anzeigen lesen (read-only)</li>
            <li><strong>pages_read_engagement</strong> – Kommentare und Reaktionen lesen</li>
            <li><strong>pages_manage_engagement</strong> – Kommentare beantworten und verstecken</li>
            <li><strong>pages_show_list</strong> – Verbundene Seiten anzeigen</li>
            <li><strong>business_management</strong> – Business-Account-Zugriff</li>
            <li><strong>public_profile</strong> – Basis-Profilinformationen</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">6. Datenlöschung</h2>
          <p className="text-muted-foreground leading-relaxed">
            Du kannst die Meta-Verbindung jederzeit über die App trennen. Dabei werden alle gespeicherten
            Tokens und synchronisierten Daten gelöscht. Zusätzlich kannst du den App-Zugriff direkt in
            deinen{" "}
            <a
              href="https://www.facebook.com/settings?tab=applications"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Facebook-Einstellungen unter „Apps und Websites"
            </a>{" "}
            widerrufen.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">7. Kontakt</h2>
          <p className="text-muted-foreground leading-relaxed">
            Bei Fragen zur Datenschutzrichtlinie wende dich an:{" "}
            <a href="mailto:noel@easysignals.ch" className="text-primary underline">
              noel@easysignals.ch
            </a>
          </p>
        </section>

        <div className="border-t border-border pt-8 mt-8">
          <p className="text-xs text-muted-foreground">
            Diese Datenschutzrichtlinie gilt für die interne Nutzung der Meta Ads Creative Workflow App
            durch EasySignals. Die App ist nicht öffentlich zugänglich.
          </p>
        </div>
      </div>
    </div>
  );
}
