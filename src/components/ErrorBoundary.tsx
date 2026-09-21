import { Component, type ReactNode } from 'react';
import { importiereDaten, speichereDaten, STORAGE_KEY } from '../store/storage';
import { dateiLaden } from '../lib/xlsx';

/** A damaged local dataset must never be replaced by demo data on startup. */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; notice: string }
> {
  state = { error: null as Error | null, notice: '' };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="recovery-screen">
        <section className="card card-pad">
          <span className="eyebrow">MC PLAN · WIEDERHERSTELLUNG</span>
          <h1>Ihr Datenbestand bleibt erhalten.</h1>
          <p>Die Anwendung konnte nicht geöffnet werden. Es wurde nichts durch Demodaten ersetzt.</p>
          <p className="callout error" role="alert">
            {this.state.error.message}
          </p>
          <div className="row wrap">
            <button
              className="btn btn-primary"
              onClick={() => {
                try {
                  const raw = localStorage.getItem(STORAGE_KEY);
                  if (!raw) {
                    this.setState({ notice: 'Kein gespeicherter Bestand vorhanden.' });
                    return;
                  }
                  dateiLaden(new Blob([raw], { type: 'application/json' }), 'MC-Plan-Wiederherstellung.json');
                } catch {
                  this.setState({ notice: 'Der Browser erlaubt keinen Zugriff auf den lokalen Speicher.' });
                }
              }}
            >
              Vorhandenen Bestand sichern
            </button>
            <button className="btn btn-outline" onClick={() => location.reload()}>
              Erneut laden
            </button>
          </div>
          <label className="recovery-import">
            Geprüfte JSON-Sicherung wiederherstellen
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 20_000_000) throw new Error('Die Datei ist größer als 20 MB.');
                  const data = importiereDaten(await file.text());
                  if (
                    !window.confirm(
                      `${data.projects.length} Projekte aus dieser Sicherung wiederherstellen? Bitte den bisherigen Bestand vorher herunterladen.`,
                    )
                  )
                    return;
                  speichereDaten(data, true);
                  location.reload();
                } catch (err) {
                  this.setState({
                    notice: err instanceof Error ? err.message : 'Wiederherstellung fehlgeschlagen.',
                  });
                }
              }}
            />
          </label>
          {this.state.notice ? <p role="alert">{this.state.notice}</p> : null}
        </section>
      </main>
    );
  }
}
