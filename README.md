# MC Plan · Planlaufmanagement

Überarbeitete Ausgabe **0.2.0**. Eine responsive Web-App für Projekte, Pläne, Planverzeichnisse, Planpakete, Prüf- und Freigabeabläufe, Kontakte und Fristen.

Die App arbeitet **lokal im jeweiligen Browser**. Es gibt keine serverseitige Anmeldung, keine gemeinsame Datenbank und keine automatische Synchronisierung zwischen Geräten. Der Profilname bezeichnet die bearbeitende Person; er ist kein Benutzerkonto.

## Was ist neu?

- Neue Oberfläche mit klarer Navigation, Arbeitsübersicht nach Dringlichkeit, Projektkarten, besser lesbaren Tabellen und mobiler Ansicht.
- Globale Suche nach Projekten, Plänen, Kontakten und Workflows, erreichbar über **Strg/⌘ + K**.
- **Daten & Sicherung**: JSON-Sicherung herunterladen, prüfen und mit Vorschau wiederherstellen.
- Sichtbare Speicherfehler, Schutz vor unbemerktem Überschreiben durch andere Tabs und Wiederherstellungsansicht bei beschädigten Daten.
- Korrigierte Workflow-Verknüpfungen beim Kopieren und Löschen, neue Nachweiserfassung bei Rücksprüngen und Wiederöffnung abgeschlossener Läufe.
- Abgesicherte Datums- und Importverarbeitung sowie ein Cache pro App-Pfad für den Offlinebetrieb.
- Automatisierte Regressions- und Browserprüfungen.

Die vollständige Bestandsaufnahme, behobene Probleme und verbleibende Grenzen stehen in **[ANALYSE.md](ANALYSE.md)**. **[START-HIER.md](START-HIER.md)** erklärt den Upload.

## Lokal starten

Voraussetzung: **Node.js 22.12 oder neuer**, npm.

```bash
npm ci
npm run dev
```

Im Browser die vom Terminal angezeigte Adresse öffnen. Für einen lokalen Produktionsbuild:

```bash
npm run build
npm run preview
```

`npm run build` prüft TypeScript, erzeugt `dist/` und erstellt die vollständige Assetliste für den Offlinebetrieb. `dist/` wird bei jedem Build neu erzeugt. Der beigefügte Ordner `app/` enthält den bereits gebauten Stand dieser Lieferung; er wird durch `npm run build` nicht automatisch aktualisiert.

## Veröffentlichen

Empfohlen ist GitHub Pages mit **Settings → Pages → Source: GitHub Actions**. Der enthaltene Workflow testet und baut die Anwendung, bevor er `dist/` veröffentlicht.

Der Workflow reagiert auf `main` und auf den ursprünglich gelieferten Branch `claude/planlauf-management-app-5jn9sa`. Beide veröffentlichen auf dieselbe Pages-Adresse. Soll später nur `main` veröffentlichen, den zweiten Branch in `.github/workflows/pages.yml` entfernen.

Alternativ den **Inhalt von `app/`** als fertige statische Website hochladen. Nur den Inhalt verwenden, damit `index.html` direkt im Veröffentlichungsordner liegt. Zum Aktualisieren dieses Ordners nach eigenen Änderungen den neuen Inhalt von `dist/` nach `app/` kopieren.

Die Web-App unterstützt Unterverzeichnisse und Hash-Adressen. Der Service Worker benötigt HTTPS oder localhost. Die Dateien nicht per Doppelklick mit `file://` öffnen.

## Vorhandene Daten übernehmen

Vor dem Update in der bisherigen App eine JSON-Sicherung herunterladen. Danach möglichst **dieselbe Webadresse und dasselbe Browserprofil** benutzen. Der bisherige Speicherschlüssel und die Datenversion 10 bleiben erhalten; vorhandene kompatible Daten werden weitergeladen.

Beim Wechsel auf eine andere Domain, einen anderen Browser oder ein anderes Gerät über **Daten & Sicherung → Sicherung wiederherstellen** importieren. Ein neuer URL-Pfad auf derselben Domain teilt sich weiterhin den Browserdatenspeicher mit dieser App; der Offline-Cache ist dagegen nach App-Pfad getrennt.

Beschädigte oder unbekannte Sicherungen werden abgewiesen. Dabei bleibt der vorhandene Bestand erhalten. Bei einem Konflikt mit einem zweiten Tab den eigenen Stand sichern und die Seite neu laden. Dies ist eine Konflikterkennung, kein gleichzeitiger Mehrbenutzerbetrieb.

## Funktionsbereiche

| Bereich | Funktionen |
| --- | --- |
| Übersicht | Laufende Planläufe, überfällige und bald fällige Schritte, eigene Aufgaben, markierte Projekte |
| Projekte | Anlegen, Bearbeiten, Status, Markierung, Einstellungen, Löschung mit Bestätigung |
| Planbestand | Einzelpläne, Planverzeichnisse, untergeordnete Pläne, Planpakete als Ordnungsmerkmal, Index/Ausgabe, Vormerken |
| Workflows | Vorlagen, Projektvarianten, Aufgaben, Entscheidungen, Verzweigungen, Rücksprünge, individuelle Schritte |
| Planläufe | Soll/Ist, Arbeitstage/Feiertage, manuelle Termine, Zuständigkeiten, Nachweise, Abbruch/Neustart, Wiederöffnung |
| Adressbuch | Projektkontakte, Funktionen und Zuordnungen nach Gewerk, Excel/CSV-Import |
| Fristen | Aktueller Schritt je Lauf, Statusfilter, Suche, vorbereitete Erinnerungen |
| Vorlagen | E-Mail-Texte und Excel-Importvorlagen |
| Export | Projektberichte als XLSX oder über den Druckdialog als PDF, vollständige JSON-Sicherung |
| App | Globale Suche, Tastaturbedienung, Kontrastmodus, PWA, Offlinebetrieb |

Die App verwaltet Planmetadaten und Abläufe. Eine Ablage der eigentlichen CAD-/PDF-Planunterlagen gehört nicht zum vorhandenen Funktionsumfang. E-Mails werden im Mailprogramm vorbereitet; die App verschickt keine Nachrichten im Hintergrund.

## Prüfungen

```bash
npm test                 # 19 fachliche und technische Regressionstests
npm run typecheck
npm run build
npm audit
```

Optionale Browserprüfungen, nach Installation eines Chromium-Testbrowsers:

```bash
npx playwright install chromium
npm run test:browser      # 14 Prüfgruppen, Desktop und Mobil
npm run build
npm run test:offline      # Produktionsbuild in Unterverzeichnis, Offline-Routen
```

Die Browserprüfungen verwenden ein eigenes temporäres Browserprofil. Ihre normalen Browserdaten werden nicht verändert. Screenshots und Ergebnisse liegen unter `test-results/` und werden nicht mit Git übertragen. In speziellen Testumgebungen kann `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` den Browserpfad vorgeben.

```bash
npm run format           # Einheitliche Formatierung mit Prettier
```

## Projektstruktur

- `src/domain/`: Datenmodell und Fachlogik, Fristen, Workflow-Verknüpfung, Statuswechsel, Import/Export.
- `src/store/`: Zustand, Migration, Laufzeitprüfung, lokale Speicherung und Transaktionen.
- `src/pages/`: Fachansichten und Projektdialoge.
- `src/components/`: Gemeinsame UI, Suche, Sicherung, Fehlerbehandlung.
- `src/styles/global.css`: Gestaltung, Komponenten, responsive Regeln und Kontrastmodus.
- `public/`: Logos, PWA-Manifest, Icons und Service-Worker-Vorlage.
- `scripts/prepare-build.mjs`: Versionierung und Vorbereitung des Offline-Caches.
- `tests/`: Regressions- und Browserprüfungen.
- `app/`: Fertiges statisches Uploadpaket dieses Stands.

## Offline-Updates

Eine neue Service-Worker-Version wartet, bis geöffnete App-Tabs geschlossen sind. Nach einer Veröffentlichung alle App-Tabs schließen und die Adresse neu öffnen. So bleiben HTML und nachgeladene Programmteile einer laufenden Sitzung auf demselben Stand.

## Nächster Entwicklungsschritt

Für den Betrieb mit mehreren Bearbeitern: Backend, zentrale Datenbank, echte Authentifizierung und Berechtigungen, nachvollziehbare Änderungshistorie und serverseitige Sicherungen ergänzen. Browserdaten und manuell heruntergeladene Sicherungen ersetzen diese Funktionen nicht.
