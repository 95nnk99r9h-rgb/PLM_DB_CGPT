# MC Plan – so verwendest du das überarbeitete Paket

## 1. Bisherige Daten sichern

Öffne deine bisherige App und lade eine JSON-Sicherung herunter. Die neue Version verwendet denselben Speicherschlüssel und kann kompatible Bestände übernehmen.

## 2. GitHub-Repository aktualisieren

1. ZIP entpacken und den enthaltenen Projektordner öffnen.
2. Den **Inhalt** des Projektordners in dein Repository übernehmen. Nicht einen zusätzlichen äußeren Ordner um die Dateien legen.
3. Vorhandene Quelldateien ersetzen. Den alten Inhalt von `app/assets/` durch den neuen Inhalt ersetzen, damit alte Builddateien nicht liegen bleiben. `.github/workflows/pages.yml` ebenfalls übernehmen.
4. In GitHub **Settings → Pages → Build and deployment → Source → GitHub Actions** auswählen.
5. Die Änderungen in `main` oder im enthaltenen Entwicklungsbranch speichern. Unter **Actions** prüfen, ob „MC Plan veröffentlichen“ erfolgreich beendet wurde. Über „Run workflow“ ist auch ein manueller Start möglich.
6. Die in GitHub Pages angezeigte Adresse öffnen. Nach einem Update alle vorher geöffneten App-Tabs einmal schließen.

Der Workflow führt Tests aus, baut den Code und veröffentlicht den fertigen Build. Er schreibt keine generierten Commits in deinen Quellcode-Branch und überschreibt keinen `gh-pages`-Branch.

## Alternative: direkt fertige Dateien hochladen

Der Ordner **`app/`** enthält eine sofort veröffentlichbare statische Website. Dessen **Inhalt** auf deinen Webspace oder in ein separates GitHub-Repository hochladen. Bei GitHub Pages in diesem Fall „Deploy from a branch“, den Zielbranch und `/ (root)` wählen.

Quellcode und fertigen Build nicht durcheinanderlegen: `src/` benötigt einen Build; `app/` ist bereits gebaut. Für den lokalen Aufruf einen Webserver nutzen, nicht die HTML-Datei doppelklicken.

## 3. Daten prüfen oder wiederherstellen

Bei gleicher Domain und gleichem Browserprofil sind die bestehenden Daten normalerweise weiterhin vorhanden. Unter **Daten & Sicherung** lässt sich die alte JSON-Sicherung alternativ auswählen und nach Prüfung wiederherstellen. Vor dem Ersetzen wird der aktuelle Stand automatisch zum Download angeboten; kontrolliere, dass die Datei tatsächlich im Downloadordner liegt.

Die App arbeitet weiterhin auf dem jeweiligen Gerät. Ein Link zur App teilt nicht automatisch deine Projektinhalte mit Kollegen.

## 4. Neue Bedienung

- **Übersicht:** dringende Schritte, eigene Aufgaben und Projekte.
- **Strg + K / ⌘ + K:** Suche über Projekte, Pläne, Kontakte und Workflows.
- **Fristen & Aufgaben:** Filter für überfällige, fällige und geplante Schritte.
- **Stern am Projekt:** Schnellzugriff in Übersicht und Seitenleiste.
- **Name unten links:** Profil und Kontrastdarstellung.
- **Daten & Sicherung:** Export, Wiederherstellung und bewusstes Zurücksetzen.

Mehr Details: [README.md](README.md), [ANALYSE.md](ANALYSE.md).
