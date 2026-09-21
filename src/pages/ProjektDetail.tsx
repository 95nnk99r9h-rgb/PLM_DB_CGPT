/** Projektarbeitsbereich mit Reitern für alle projektbezogenen Funktionen. */
import { useState } from 'react';
import type { Project } from '../domain/types';
import type { ProjektTab, Route } from '../lib/router';
import { Adressbuch } from './projekt/Adressbuch';
import { Einstellungen } from './projekt/Einstellungen';
import { ExportDialog } from './projekt/ExportDialog';
import { Plaene } from './projekt/Plaene';
import { Planpakete } from './projekt/Planpakete';
import { Uebersicht } from './projekt/Uebersicht';
import { Workflows } from './Workflows';
import { Icon } from '../components/icons';
import { Badge } from '../components/ui';

const TABS: { id: ProjektTab; label: string }[] = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'plaene', label: 'Planliste' },
  { id: 'pakete', label: 'Planpakete' },
  { id: 'adressbuch', label: 'Adressbuch' },
  { id: 'ketten', label: 'Workflows' },
  { id: 'einstellungen', label: 'Einstellungen' },
];

export function ProjektDetail({
  project,
  tab,
  navigate,
}: {
  project: Project;
  tab: ProjektTab;
  navigate: (r: Route) => void;
}) {
  const [exportOffen, setExportOffen] = useState(false);
  const gotoTab = (t: ProjektTab) => navigate({ view: 'projekt', projectId: project.id, tab: t });
  const oeffneLauf = (runId: string) => navigate({ view: 'planlauf', projectId: project.id, runId });

  return (
    <div className="stack">
      <section className="project-heading">
        <div>
          <span className="eyebrow">PROJEKT · {project.nummer || 'OHNE NUMMER'}</span>
          <h2>{project.name}</h2>
          <p>{project.beschreibung || 'Ihr Arbeitsbereich für Pläne, Fristen und Beteiligte.'}</p>
        </div>
        <Badge ton={project.status === 'aktiv' ? 'green' : project.status === 'pausiert' ? 'orange' : ''}>
          {project.status === 'aktiv'
            ? 'Aktiv'
            : project.status === 'pausiert'
              ? 'Pausiert'
              : 'Abgeschlossen'}
        </Badge>
      </section>
      <div className="project-tabbar">
        <div className="tabs" style={{ flex: 1, minWidth: 0 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={t.id === tab ? 'page' : undefined}
              className={t.id === tab ? 'active' : ''}
              onClick={() => gotoTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setExportOffen(true)}>
          <Icon name="export" size={13} /> Export
        </button>
      </div>

      {tab === 'uebersicht' ? (
        <Uebersicht project={project} gotoTab={gotoTab} oeffneLauf={oeffneLauf} />
      ) : null}
      {tab === 'plaene' ? <Plaene project={project} oeffneLauf={oeffneLauf} /> : null}
      {tab === 'pakete' ? <Planpakete project={project} /> : null}
      {tab === 'adressbuch' ? <Adressbuch project={project} /> : null}
      {tab === 'ketten' ? <Workflows projectId={project.id} /> : null}
      {tab === 'einstellungen' ? <Einstellungen project={project} /> : null}

      {exportOffen ? <ExportDialog project={project} onClose={() => setExportOffen(false)} /> : null}
    </div>
  );
}
