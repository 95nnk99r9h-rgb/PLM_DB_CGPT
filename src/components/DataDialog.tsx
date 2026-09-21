import { useState } from 'react';
import { useStore } from '../store/store';
import { exportiereDaten, importiereDaten } from '../store/storage';
import type { AppData } from '../domain/types';
import { ConfirmDialog, Modal } from './ui';
import { Icon } from './icons';
import { useToast } from './toast';

export function DataDialog({
  onClose,
  onReset,
  onRestored,
}: {
  onClose: () => void;
  onReset: () => void;
  onRestored: () => void;
}) {
  const { data, ersetzeDaten } = useStore();
  const toast = useToast();
  const [preview, setPreview] = useState<{ data: AppData; name: string } | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Modal titel="Daten & Sicherung" sub="Ihr Arbeitsstand auf diesem Gerät" onClose={onClose}>
        <div className="stack">
          <div className="backup-summary">
            <Icon name="sicherung" size={28} />
            <div>
              <strong>
                {data.projects.length} Projekte · {data.documents.length} Planeinträge
              </strong>
              <p className="small muted">Lokal gespeichert. Keine Synchronisierung zwischen Geräten.</p>
            </div>
          </div>
          <section className="data-section">
            <h3>Sicherung herunterladen</h3>
            <p>Alle Projekte, Kontakte, Workflows und Planläufe als JSON-Datei sichern.</p>
            <button type="button" className="btn btn-primary" onClick={() => exportiereDaten(data)}>
              <Icon name="export" /> Sicherung herunterladen
            </button>
          </section>
          <section className="data-section">
            <h3>Sicherung wiederherstellen</h3>
            <p>Wählen Sie eine MC-Plan-Sicherung. Die Datei wird vor der Übernahme geprüft.</p>
            <label className="file-picker">
              <Icon name="importieren" size={20} />
              <span>JSON-Datei auswählen</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  setError('');
                  setPreview(null);
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 20_000_000) throw new Error('Die Sicherung ist größer als 20 MB.');
                    setPreview({ name: file.name, data: importiereDaten(await file.text()) });
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Datei konnte nicht gelesen werden.');
                  }
                }}
              />
            </label>
            {error ? (
              <p className="callout error" role="alert">
                {error}
              </p>
            ) : null}
            {preview ? (
              <div className="import-preview">
                <strong>{preview.name}</strong>
                <p>
                  {preview.data.projects.length} Projekte · {preview.data.documents.length} Planeinträge ·{' '}
                  {preview.data.runs.length} Planläufe
                </p>
                <button type="button" className="btn btn-primary" onClick={() => setConfirm(true)}>
                  Sicherung übernehmen
                </button>
              </div>
            ) : null}
          </section>
          <section className="data-section danger-section">
            <h3>Demodaten zurücksetzen</h3>
            <p>Ersetzt den gesamten Arbeitsstand durch die mitgelieferten Beispiele.</p>
            <button type="button" className="btn btn-danger" onClick={onReset}>
              Zurücksetzen …
            </button>
          </section>
        </div>
      </Modal>
      {confirm && preview ? (
        <ConfirmDialog
          titel="Arbeitsstand ersetzen?"
          text="Die ausgewählte Sicherung ersetzt den Bestand auf diesem Gerät. Vorher wird Ihr bisheriger Stand automatisch als JSON-Datei heruntergeladen."
          bestaetigenLabel="Sichern und wiederherstellen"
          ton="blau"
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            exportiereDaten(data);
            ersetzeDaten(preview.data);
            toast('Sicherung übernommen. Bitte Speicherstatus beachten.');
            onRestored();
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
