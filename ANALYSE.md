# Codeanalyse und Überarbeitung · MC Plan 0.2.0

Stand: 21. September 2026. Grundlage ist die bereitgestellte ZIP des Branches `claude/planlauf-management-app-5jn9sa`. Es wurde kein GitHub-Repository verändert und nichts veröffentlicht.

## Ergebnis

Die Anwendung besitzt bereits eine umfangreiche fachliche Grundlage für Planlaufmanagement. Das Datenmodell und die Trennung zwischen Fachlogik, Zustand und Ansichten wurden erhalten. Überarbeitet wurden die komplette Gestaltung, wichtige Arbeitsabläufe sowie konkrete Fehler bei Datensicherung, Workflow-Verknüpfungen, Importen und Fristen.

Der Stand ist ein verbessertes lokales Werkzeug. Für einen gemeinsamen, produktiven Mehrbenutzerbetrieb fehlen weiterhin ein Backend, eine Datenbank und verbindliche Zugriffsrechte.

## 1. Erkannte Funktionen

| Funktionsgruppe | Vorhandene Fähigkeiten und fachliche Einordnung |
| --- | --- |
| Projektverwaltung | Projekte anlegen, pflegen, markieren, pausieren/abschließen, löschen; projektbezogene Einstellungen |
| Planbestand | Einzelpläne und Planverzeichnisse mit Nummer, Titel, Index/Ausgabe, Gewerk, Phase, Eingang Soll, Bemerkung |
| Hierarchie | Pläne eines Verzeichnisses nutzen dessen Planlauf; Planpakete sind Ordnungsmerkmale ohne eigenen Planlauf |
| Workflows | Globale Vorlagen und Projektvarianten, Aufgaben, Entscheidungen, Antwortziele, Rücksprünge, zusätzliche Prüfschritte |
| Ablaufsteuerung | Laufende Instanzen, Soll/Ist-Termine, aktueller Schritt, Erledigung, Überspringen, Abbruch und neuer Index |
| Nachweise | Freigabe- und Prüfberichtsnummern bei entsprechenden Schritten |
| Zuständigkeiten | Funktionen je Gewerk, Projektkontakte, automatische Besetzung, manuelle Zuständigkeit je Schritt |
| Fristen | Arbeits-/Kalendertage, projektbezogene Feiertage, manuelle Soll-Termine, Erinnerungs-Vorlauf, Statusampeln |
| Kommunikation | E-Mail-Vorlagen und Platzhalter, Mailprogramm/Outlook-Web-Aufruf; kein automatischer Versand |
| Datenaustausch | Plan- und Kontaktimport aus CSV/XLSX; Projektberichte als XLSX oder über Drucken/PDF; JSON-Sicherung |
| Plattform | React/TypeScript/Vite, Browserdatenspeicher, Hash-Navigation, installierbare PWA und Offlinebetrieb |

Ein Dokumentenserver für tatsächliche PDF-/CAD-Dateien, eine echte Anmeldung und eine gemeinsame Datenbank sind im gelieferten Code nicht enthalten.

## 2. Befunde und durchgeführte Korrekturen

| Gewichtung | Befund im Ausgangscode | Überarbeitung |
| --- | --- | --- |
| Hoch | Bei Lesefehlern wurden still Demodaten geladen. Der Store schrieb sie anschließend in denselben Speicherbereich. | Ladefehler führen zu einer Wiederherstellungsansicht. Der ursprüngliche Inhalt bleibt erhalten und kann heruntergeladen werden. |
| Hoch | Schreibfehler, etwa bei vollem Browserspeicher, erschienen nur in der Konsole. | Dauerhafte sichtbare Meldung mit Sicherung, erneutem Speichern und Neuladen. |
| Hoch | Mehrere Tabs konnten Änderungen des jeweils anderen Tabs überschreiben. | Vergleich mit dem zuletzt bekannten Speicherstand vor jedem Schreiben und Reaktion auf Speicherereignisse. Konflikte werden sichtbar. Dies ist keine atomare Mehrbenutzertransaktion. |
| Hoch | Beim Duplizieren von Workflows wurden normale Nachfolger-IDs nicht neu zugeordnet. Beim Entfernen von Schritten konnten Sprungziele ins Leere zeigen. | Zentrale Funktionen für Kopieren und Entfernen; sowohl Entscheidungskanten als auch normale Nachfolger bleiben innerhalb der neuen Kette gültig. |
| Hoch | Beim CSV-Planimport diente die Plannummer als interne Zuordnung. Gleiche Nummern oder fehlende Nummern konnten Planläufe falsch zuordnen. | Separate Identität je Importzeile; getrennte Namensräume für Pakete und Verzeichnisse. |
| Mittel | Datumsparser akzeptierte nicht existierende Tage und zusätzliche Zeichen. Nicht-ganzzahlige Arbeitstage konnten eine Schleife auslösen. | Strenge Datumsprüfung; endliche, begrenzte ganze Tageswerte; angepasste Eingabefelder. |
| Mittel | Bei einem Rücksprung blieben Nachweisnummer und Erinnerungszeitpunkt des vorherigen Durchlaufs stehen. | Diese Werte werden im neuen Durchlauf zurückgesetzt. Eine neue Freigabe bzw. Prüfung verlangt wieder einen Nachweis. |
| Mittel | Wiederöffnung konnte den Laufstatus abgeschlossen lassen; übersprungene Schritte konnten nachträglich andere Verantwortliche bekommen. | Laufstatus wird wieder laufend. Erledigte und übersprungene Schritte behalten ihre Zuständigkeit. Wiederöffnung abgeschlossener Schritte ist in der Oberfläche erreichbar. |
| Mittel | Gelöschte Verzeichnisse/Pakete hinterließen Verweise bei zugeordneten Plänen. | Zuordnungen werden aufgelöst; die erhaltenen Pläne zeigen nicht mehr auf den gelöschten Eintrag. |
| Mittel | Sicherungsimport und Laufzeitprüfung fehlten. TypeScript allein prüft keine gespeicherten JSON-Dateien. | Validierung von Struktur, Version, IDs, Referenzen, Terminen und Workflow-Zielen; Wiederherstellung mit Vorschau und Bestätigung. |
| Mittel | Tabellenimporte hatten keine ausreichenden Größen- und Entpackgrenzen. CSV-Trennzeichen und Blattreihenfolge konnten falsch erkannt werden. | Dateigrößen-, ZIP-/XML- und Tabellenlimits, gestreamte Entpackgrenzen, XML-Fehlerprüfung, bessere CSV-Erkennung und Zuordnung über Workbook-Beziehungen. |
| Mittel | Der Service Worker entfernte beim Aktivieren alle fremden Cache-Namen derselben Origin. Nachgeladene Ansichten waren nicht vollständig vorab gesichert. | Cache-Namensraum pro App-Pfad, versionierte komplette Assetliste und konsistente Offline-Versionen. |
| Mittel | Eine automatische Weiterleitung nach 1,5 Sekunden konnte bei langsamer Verbindung einen funktionierenden Start unterbrechen. | Zeitabhängige Weiterleitung entfernt. Ein eng begrenzter Fallback greift nur bei einem tatsächlichen Modul-Ladefehler auf GitHub Pages. |
| Mittel | Der Deployment-Workflow schrieb generierte Commits und erzwang Updates eines `gh-pages`-Branches. | Build/Tests und reguläres Pages-Deployment; Quellcodezugriff nur lesend. |
| Niedrig / Härtung | Der generische Druckhelfer setzte seinen Titel ohne HTML-Maskierung ein. Der vorhandene Aufrufer bereinigte den Titel bereits. | Titel und Sonderzeichen werden zusätzlich im Druckhelfer maskiert. Das ist zusätzliche Absicherung, kein belegter XSS-Angriff über den bisherigen Exportdialog. |
| Bedienbarkeit | Fehlende direkte Fristennavigation, verstreute Aktionen, kleine Klickziele, nicht zugeordnete Feldbeschriftungen und unvollständige Dialogbedienung. | Neue Navigation, globale Suche, Arbeitsübersicht, konsistente Komponenten, Feldzuordnung, native modale Dialoge, Tab-Fokusführung und Escape. |

## 3. Neue Gestaltung und Bedienung

Die Anwendung verwendet eine dunkelblaue Navigation und eine helle Arbeitsfläche. Die Marke MC Plan sowie der Bezug zu Mailänder Consult bleiben erhalten. Die Schrift Inter wird lokal mitgeliefert; dafür ist kein externer Fontdienst nötig.

Die Startseite priorisiert Handlungsbedarf, eigene Aufgaben und Projektzugriff. Kennzahlen, Fristen und Fortschritte stammen aus den aktuellen Daten. Projektkarten zeigen Status, Umfang, Fortschritt und Dringlichkeit. Die Fristen-Kennzahlen führen direkt auf den passenden Filter. Projekte lassen sich außerdem nach Status und Markierung filtern.

Die globale Suche durchsucht Projekte, Pläne, Kontakte und Workflows. Auf dem Smartphone wird die Navigation eingeklappt; Tabellen bleiben horizontal bedienbar bzw. wechseln, wo vorgesehen, in eine gestapelte Ansicht. Dialoge passen sich der verfügbaren Höhe an. Der bestehende Kontrastmodus und reduzierte Animationen werden unterstützt.

## 4. Technische Optimierungen

- Projekt- und Dokumentzugriffe in zentralen Auswertungen verwenden Maps; Workflow-Verfolgung sucht Sprungziele über einen Index.
- Unveränderte Planläufe behalten bei der Terminberechnung ihre Referenz.
- Projektanlage, Import und mehrteilige Schrittaktionen werden gesammelt angewendet und nur einmal normalisiert.
- Neue IDs verwenden `crypto.randomUUID()`.
- Fachansichten werden bedarfsgerecht nachgeladen. Das initiale JavaScript-Bundle liegt bei ungefähr 315 kB statt 422 kB im gelieferten Build, also rund 25 % kleiner, jeweils unkomprimiert. Dies ist eine Bundle-Messung, kein gemessener Geschwindigkeitsgewinn beim Benutzer. Die Gesamtmenge aller Programmdateien wächst durch zusätzliche Funktionen und Prüfungen.
- Wiederherstellung und Suchoberfläche sind eigenständige Komponenten. Workflow-Kopieren und -Entfernen sind getrennt von der Ansicht testbar.
- Einheitliche Codeformatierung, reproduzierbarer npm-Lockstand und mitgelieferte Testskripte.

## 5. Validierung

Die Lieferung wurde mit automatisierten Tests und Browserprüfungen untersucht:

- **19 Regressionstests:** Datumsvalidierung, Arbeitstage/Feiertage/Sommerzeit, Fristgrenzen, JSON-Validierung, Speicherfehler, Tab-Konflikt, Rücksprünge, Nachweise, Wiederöffnung, Zuständigkeiten, Workflow-Verknüpfung, CSV, Importgrenzen und Druckmaskierung.
- **14 Browser-Prüfgruppen:** Übersicht, globale Suche und Tastaturbedienung, Fristenfilter, alle Projekt- und Verwaltungsansichten, Projektanlage, Plananlage/Workflowstart, Schrittabschluss mit Neuladen, CSV-Import, Excel-Ausgabe mit erneutem Einlesen, Workflow-Kopie, Sicherungswiederherstellung, mobile Navigation/Dialoge, Tab-Konflikt und beschädigter Bestand.
- **Produktionsprüfung:** Build in einem Repository-Unterverzeichnis, abgegrenzter Cache, nachgeladene Workflow-Ansicht und Neuladen ohne Netzwerk.
- **TypeScript und Produktionsbuild:** erfolgreich.
- **Abhängigkeitsprüfung:** npm audit meldete zum Prüfzeitpunkt keine bekannten Schwachstellen für den geprüften Lockstand.

Die Browserprüfungen liefen in Chromium mit Desktop- und Smartphone-Breite. Safari, Firefox, echtes iOS/Android, der produktive GitHub-Account und tatsächlicher E-Mail-Versand wurden nicht getestet. Dies ist keine vollständige Sicherheitszertifizierung und keine fachliche Abnahme nach DB-Vorgaben.

## 6. Verbleibende Grenzen und Prioritäten

1. **Gemeinsamer Betrieb:** Eine lokale Namensauswahl ist keine Authentifizierung. Für mehrere Bearbeiter sind ein Backend, serverseitige Rechteprüfung, eine zentrale Datenbank und Konfliktauflösung erforderlich. Die ergänzte Tab-Erkennung verhindert viele unbemerkte Überschreibungen, kann aber gleichzeitig stattfindende Schreibvorgänge nicht atomar koordinieren.
2. **Nachvollziehbarkeit:** Es gibt weiterhin kein unveränderliches Änderungsprotokoll. Rücksprünge zählen Durchläufe, speichern aber keine vollständige Historie sämtlicher vorheriger Soll-/Ist-Termine und Nachweise. Für revisionsrelevante Nutzung braucht es eigene Ereignis- und Historientabellen.
3. **Datensicherung:** Browserdaten können bei Profilverlust oder Löschen von Websitedaten verloren gehen. JSON-Sicherungen sind manuell heruntergeladene, unverschlüsselte Dateien. Automatische serverseitige Sicherungen fehlen.
4. **Fachliche Regeln:** Die vorhandenen VVBau-Vorlagen, Fristenannahmen, Gewerke und Freigabelogik wurden technisch erhalten. Ihre fachliche Gültigkeit wurde nicht unabhängig bestätigt. Parallele Aufgaben sind weiterhin als sequenzielle Abläufe modelliert.
5. **Skalierung:** Große Importe bleiben Browserarbeit; trotz Limits können sie spürbar dauern. Für sehr große Bestände wären Worker, indizierte Speicherung, Pagination/Virtualisierung und ein Backend sinnvoll.
6. **Versionspflege:** Änderungen an mitgelieferten Standard-Workflows sollten künftig über ausdrückliche Vorlagenversionen und kontrollierte Migrationen erfolgen. Benutzerbearbeitungen und zukünftige Standardupdates müssen dabei getrennt nachvollziehbar bleiben.

Empfohlene Reihenfolge: Backend und Rechte → belastbare Historie und Sicherungen → tatsächliche Dokumentenablage → parallele Prozessschritte und automatisierte Benachrichtigungen. Die aktuelle Überarbeitung schafft dafür eine besser strukturierte, getestete lokale Grundlage.
