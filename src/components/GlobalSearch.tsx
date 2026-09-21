import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import type { Route } from '../lib/router';
import { Icon } from './icons';
import { EmptyState, Modal } from './ui';

export function GlobalSearch({ onClose, navigate }: { onClose: () => void; navigate: (r: Route) => void }) {
  const { data } = useStore();
  const [query, setQuery] = useState('');
  const entries = useMemo(() => {
    const projects = new Map(data.projects.map((p) => [p.id, p]));
    const runs = new Map(data.runs.filter((r) => r.status !== 'abgebrochen').map((r) => [r.documentId, r]));
    return [
      ...data.projects.map((p) => ({
        id: p.id,
        name: p.name,
        sub: p.nummer,
        type: 'Projekt',
        icon: 'projekt',
        route: { view: 'projekt', projectId: p.id, tab: 'uebersicht' } as Route,
      })),
      ...data.documents.map((d) => {
        const run = runs.get(d.parentId ?? d.id);
        return {
          id: d.id,
          name: d.titel || d.nummer,
          sub: `${d.nummer} · ${d.gewerk} · ${projects.get(d.projectId)?.name ?? ''}`,
          type: d.kind === 'paket' ? 'Planpaket' : d.kind === 'verzeichnis' ? 'Planverzeichnis' : 'Plan',
          icon: d.kind,
          route: (run
            ? { view: 'planlauf', projectId: d.projectId, runId: run.id }
            : {
                view: 'projekt',
                projectId: d.projectId,
                tab: d.kind === 'paket' ? 'pakete' : 'plaene',
              }) as Route,
        };
      }),
      ...data.contacts.map((c) => ({
        id: c.id,
        name: `${c.vorname} ${c.nachname}`,
        sub: `${c.firma} · ${c.email} · ${projects.get(c.projectId)?.name ?? ''}`,
        type: 'Kontakt',
        icon: 'person',
        route: { view: 'projekt', projectId: c.projectId, tab: 'adressbuch' } as Route,
      })),
      ...data.templates.map((t) => ({
        id: t.id,
        name: t.name,
        sub: t.beschreibung,
        type: 'Workflow',
        icon: 'kette',
        route: (t.projectId
          ? { view: 'projekt', projectId: t.projectId, tab: 'ketten' }
          : { view: 'ketten' }) as Route,
      })),
    ];
  }, [data]);
  const terms = query.toLocaleLowerCase('de').trim().split(/\s+/);
  const filtered = entries.filter((e) =>
    terms.every((t) => `${e.name} ${e.sub} ${e.type}`.toLocaleLowerCase('de').includes(t)),
  );
  const results = query.trim()
    ? filtered.slice(0, 40)
    : entries.filter((e) => e.type === 'Projekt').slice(0, 8);
  return (
    <Modal titel="Schnell finden" sub="Projekte, Pläne, Kontakte und Workflows durchsuchen" onClose={onClose}>
      <div className="command-input">
        <Icon name="suche" size={21} />
        <input
          type="search"
          autoFocus
          placeholder="Was suchen Sie?"
          aria-label="Alle Projekte und Pläne durchsuchen"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="search-result-caption" role="status">
        {query.trim()
          ? `${filtered.length} Treffer${filtered.length > 40 ? ' · erste 40 angezeigt' : ''}`
          : 'Direkt zu einem Projekt'}
      </div>
      <div className="search-results">
        {results.map((r) => (
          <button
            type="button"
            key={`${r.type}-${r.id}`}
            className="search-result"
            onClick={() => {
              navigate(r.route);
              onClose();
            }}
          >
            <span className="result-icon">
              <Icon name={r.icon} size={19} />
            </span>
            <span className="result-text">
              <strong>{r.name}</strong>
              <span>{r.sub}</span>
            </span>
            <span className="result-type">{r.type}</span>
            <Icon name="chevron" size={15} />
          </button>
        ))}
      </div>
      {!results.length ? (
        <EmptyState
          icon="suche"
          titel="Keine Treffer"
          text="Versuchen Sie es mit einer Plannummer, einem Namen oder einem Gewerk."
        />
      ) : null}
      <p className="small muted" style={{ marginTop: 16 }}>
        Mit Tab auswählen · Mit Enter öffnen · Mit Esc schließen
      </p>
    </Modal>
  );
}
