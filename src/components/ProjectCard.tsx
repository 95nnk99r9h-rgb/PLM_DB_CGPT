import { eigenstaendigeLaeufe, fortschritt, offeneFristen } from '../domain/engine';
import type { AppData, Project } from '../domain/types';
import { routeToHash } from '../lib/router';
import { Badge, Progress } from './ui';
import { Icon } from './icons';

export function ProjectCard({
  project: p,
  data,
  onFavorite,
}: {
  project: Project;
  data: AppData;
  onFavorite?: () => void;
}) {
  const runs = eigenstaendigeLaeufe(data.documents, data.runs).filter(
    (r) => r.projectId === p.id && r.status !== 'abgebrochen',
  );
  const active = runs.filter((r) => r.status === 'laufend');
  const late = offeneFristen(data, [p.id]).filter((f) => f.ampel === 'ueberfaellig').length;
  const progress = runs.length
    ? Math.round(runs.reduce((sum, r) => sum + fortschritt(r), 0) / runs.length)
    : 0;
  const docs = data.documents.filter((d) => d.projectId === p.id && d.kind !== 'paket');
  const trades = [...new Set(docs.map((d) => d.gewerk).filter(Boolean))];
  return (
    <article className="project-card card">
      <div className="project-card-top">
        <span className="project-card-symbol">
          <Icon name="projekt" size={22} />
        </span>
        <Badge ton={p.status === 'aktiv' ? 'green' : p.status === 'pausiert' ? 'orange' : ''}>
          {p.status === 'aktiv' ? 'Aktiv' : p.status === 'pausiert' ? 'Pausiert' : 'Abgeschlossen'}
        </Badge>
        {onFavorite ? (
          <button
            type="button"
            className={`btn-icon favorite ${p.markiert ? 'selected' : ''}`}
            aria-label={`${p.name}: ${p.markiert ? 'Markierung aufheben' : 'Projekt markieren'}`}
            aria-pressed={p.markiert}
            onClick={onFavorite}
          >
            <Icon name="stern" size={19} />
          </button>
        ) : null}
      </div>
      <a
        className="project-card-link"
        href={routeToHash({ view: 'projekt', projectId: p.id, tab: 'uebersicht' })}
      >
        <span className="project-number">{p.nummer || 'PROJEKT'}</span>
        <h3>{p.name}</h3>
        <p>{p.beschreibung || 'Pläne, Beteiligte und Prozesse an einem Ort.'}</p>
      </a>
      <div className="project-card-facts">
        <span>
          <Icon name="plan" size={14} />
          {docs.length} Planeinträge
        </span>
        <span>
          <Icon name="kette" size={14} />
          {active.length} laufend
        </span>
      </div>
      <div className="project-progress">
        <div>
          <span>Schrittfortschritt</span>
          <strong>{progress} %</strong>
        </div>
        <Progress wert={progress} />
      </div>
      <div className="project-card-bottom">
        <div className="trade-list">
          {trades.slice(0, 3).map((t) => (
            <span key={t}>{t}</span>
          ))}
          {trades.length > 3 ? <span>+{trades.length - 3}</span> : null}
          {!trades.length ? <span>Gewerke noch offen</span> : null}
        </div>
        <span className={`project-health ${late ? 'late' : ''}`}>
          <span />
          {late ? `${late} überfällig` : active.length ? 'Im Plan' : 'Keine offenen Fristen'}
        </span>
      </div>
    </article>
  );
}
