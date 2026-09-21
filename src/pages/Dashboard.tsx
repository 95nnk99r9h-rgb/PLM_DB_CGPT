/** Focused workspace, computed entirely from the user's current project data. */
import { useMemo, useState } from 'react';
import { eigenstaendigeLaeufe, offeneFristen } from '../domain/engine';
import { formatDateShort, relativeLabel } from '../lib/dates';
import { EIGENE_ROLLE, STANDARD_BEARBEITER, type Project } from '../domain/types';
import type { Route } from '../lib/router';
import { useStore } from '../store/store';
import { AmpelBadge } from '../components/common';
import { Card, CardHeader, EmptyState, Stat } from '../components/ui';
import { Icon } from '../components/icons';
import { ProjectCard } from '../components/ProjectCard';
import { ProjektDialog } from './Projekte';

export function sichtbareProjekte(projects: Project[]): Project[] {
  const markiert = projects.filter((p) => p.markiert);
  return markiert.length ? markiert : projects;
}

export function Dashboard({ navigate }: { navigate: (r: Route) => void }) {
  const { data, toggleMarkiert } = useStore();
  const [newProject, setNewProject] = useState(false);
  const [scope, setScope] = useState<'urgent' | 'mine' | 'all'>('urgent');
  const projects = sichtbareProjekte(data.projects);
  const ids = projects.map((p) => p.id);
  const deadlines = offeneFristen(data, ids);
  const overdue = deadlines.filter((f) => f.ampel === 'ueberfaellig');
  const soon = deadlines.filter((f) => f.ampel === 'faellig');
  const mine = deadlines.filter((f) => f.step.roleName === EIGENE_ROLLE);
  const runs = eigenstaendigeLaeufe(data.documents, data.runs).filter((r) => ids.includes(r.projectId));
  const active = runs.filter((r) => r.status === 'laufend').length;
  const done = runs.filter((r) => r.status === 'abgeschlossen').length;
  const cancelled = runs.filter((r) => r.status === 'abgebrochen').length;
  const docs = useMemo(() => new Map(data.documents.map((d) => [d.id, d])), [data.documents]);
  const tasks = scope === 'mine' ? mine : scope === 'all' ? deadlines : [...overdue, ...soon];
  const date = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const end1 = runs.length ? (done / runs.length) * 100 : 0;
  const end2 = runs.length ? ((done + active) / runs.length) * 100 : 0;
  return (
    <div className="dashboard stack">
      <section className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">IHR ARBEITSPLATZ</span>
          <h2>
            {data.bearbeiter.name === STANDARD_BEARBEITER
              ? 'Alles im Blick.'
              : `Guten Tag, ${data.bearbeiter.name.split(' ')[0]}.`}
          </h2>
          <p>Klare Prioritäten. Verlässliche Planläufe.</p>
        </div>
        <div className="heading-actions">
          <span className="date-label">
            <Icon name="kalender" size={16} />
            {date}
          </span>
          <button type="button" className="btn btn-primary" onClick={() => setNewProject(true)}>
            <Icon name="plus" size={17} /> Neues Projekt
          </button>
        </div>
      </section>
      <div className="grid grid-4 dashboard-stats">
        <Stat
          wert={active}
          label="Laufende Planläufe"
          icon="kette"
          hint={`In ${projects.length} ${projects.length === 1 ? 'ausgewähltem Projekt' : 'ausgewählten Projekten'}`}
          onClick={() => navigate({ view: 'projekte' })}
        />
        <Stat
          wert={overdue.length}
          label="Überfällig"
          icon="frist"
          ton="red"
          hint={overdue.length ? 'Hier ist Ihre Aufmerksamkeit gefragt' : 'Keine Frist überschritten'}
          onClick={() => navigate({ view: 'fristen', filter: 'ueberfaellig' })}
        />
        <Stat
          wert={soon.length}
          label="Demnächst fällig"
          icon="kalender"
          ton="orange"
          hint="Gemäß Vorlaufzeit im Projekt"
          onClick={() => navigate({ view: 'fristen', filter: 'faellig' })}
        />
        <Stat
          wert={mine.length}
          label="Meine Aufgaben"
          icon="person"
          ton="blue"
          hint="Aktuelle Schritte im Planlaufmanagement"
          onClick={() => setScope('mine')}
        />
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <Card className="focus-card">
            <CardHeader
              titel={
                <span className="row">
                  <span className="section-icon">
                    <Icon name="verzeichnis" size={19} />
                  </span>
                  Das steht jetzt an
                </span>
              }
              actions={
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate({ view: 'fristen' })}
                >
                  Alle Fristen <Icon name="pfeil" size={14} />
                </button>
              }
            />
            <div className="focus-tabs" aria-label="Aufgabenauswahl">
              {(
                [
                  { id: 'urgent', title: 'Handlungsbedarf', count: overdue.length + soon.length },
                  { id: 'mine', title: 'Meine Aufgaben', count: mine.length },
                  { id: 'all', title: 'Alle', count: deadlines.length },
                ] as const
              ).map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={scope === t.id ? 'active' : ''}
                  aria-pressed={scope === t.id}
                  onClick={() => setScope(t.id)}
                >
                  {t.title}
                  <span>{t.count}</span>
                </button>
              ))}
            </div>
            <div className="focus-list">
              {tasks.slice(0, 6).map((f) => {
                const doc = docs.get(f.run.documentId);
                return (
                  <button
                    type="button"
                    key={f.run.id}
                    className="focus-task"
                    onClick={() => navigate({ view: 'planlauf', projectId: f.project.id, runId: f.run.id })}
                  >
                    <span className={`task-symbol ${f.ampel}`}>
                      <Icon name={f.step.typ === 'entscheidung' ? 'kette' : 'plan'} size={18} />
                    </span>
                    <span className="focus-task-text">
                      <strong>{f.step.name}</strong>
                      <span>
                        {doc?.nummer || f.run.name} · {f.project.name}
                      </span>
                      <small>
                        {f.step.roleName || 'Zuständigkeit offen'}
                        {doc?.gewerk ? ` · ${doc.gewerk}` : ''}
                      </small>
                    </span>
                    <span className="focus-task-date">
                      <strong>{formatDateShort(f.step.sollDatum)}</strong>
                      <small>{relativeLabel(f.step.sollDatum)}</small>
                    </span>
                    <span className="focus-task-status">
                      <AmpelBadge ampel={f.ampel} />
                    </span>
                    <Icon name="chevron" size={15} />
                  </button>
                );
              })}
            </div>
            {!tasks.length ? (
              <EmptyState
                icon="check"
                titel={scope === 'urgent' ? 'Alles im grünen Bereich' : 'Aktuell nichts offen'}
                text={
                  scope === 'urgent'
                    ? 'Für die ausgewählten Projekte stehen keine dringenden Schritte an.'
                    : 'Hier erscheinen Ihre nächsten Prozessschritte.'
                }
                action={
                  <button className="btn btn-outline" onClick={() => setScope('all')}>
                    Alle Aufgaben ansehen
                  </button>
                }
              />
            ) : null}
            {tasks.length > 6 ? (
              <button type="button" className="focus-more" onClick={() => navigate({ view: 'fristen' })}>
                Alle {tasks.length} Einträge in der Fristenübersicht <Icon name="pfeil" size={15} />
              </button>
            ) : null}
          </Card>
          <section className="dashboard-projects">
            <div className="section-heading">
              <div>
                <span className="eyebrow">PROJEKTÜBERBLICK</span>
                <h2>
                  Meine Projekte <span>{projects.length}</span>
                </h2>
              </div>
              <button className="btn btn-ghost" onClick={() => navigate({ view: 'projekte' })}>
                Alle Projekte <Icon name="pfeil" size={16} />
              </button>
            </div>
            <div className="project-grid">
              {projects.slice(0, 6).map((p) => (
                <ProjectCard key={p.id} project={p} data={data} onFavorite={() => toggleMarkiert(p.id)} />
              ))}
            </div>
            {!projects.length ? (
              <Card>
                <EmptyState
                  icon="projekt"
                  titel="Starten Sie Ihr erstes Projekt"
                  text="Legen Sie Projekte an und behalten Sie Fristen und Freigaben im Blick."
                  action={
                    <button className="btn btn-primary" onClick={() => setNewProject(true)}>
                      Projekt anlegen
                    </button>
                  }
                />
              </Card>
            ) : null}
          </section>
        </div>
        <div className="dashboard-aside">
          <Card className="overview-card">
            <CardHeader titel="Planläufe im Überblick" />
            <div
              className="portfolio-ring"
              role="img"
              aria-label={`${done} abgeschlossen, ${active} laufend, ${cancelled} abgebrochen`}
              style={{
                background: `conic-gradient(var(--green) 0% ${end1}%, var(--accent) ${end1}% ${end2}%, var(--separator-strong) ${end2}% 100%)`,
              }}
            >
              <div>
                <strong>{runs.length}</strong>
                <span>Planläufe gesamt</span>
              </div>
            </div>
            <div className="portfolio-legend">
              <div>
                <span>
                  <i className="legend-dot active" />
                  Laufend
                </span>
                <strong>{active}</strong>
              </div>
              <div>
                <span>
                  <i className="legend-dot done" />
                  Abgeschlossen
                </span>
                <strong>{done}</strong>
              </div>
              <div>
                <span>
                  <i className="legend-dot cancelled" />
                  Abgebrochen
                </span>
                <strong>{cancelled}</strong>
              </div>
            </div>
          </Card>
          <section className="quick-start">
            <span className="eyebrow">GUT ORGANISIERT</span>
            <h3>Der nächste Planlauf beginnt hier.</h3>
            <p>Projekt öffnen, Plan anlegen und den passenden Workflow starten.</p>
            <button type="button" onClick={() => navigate({ view: 'projekte' })}>
              Zu meinen Projekten <Icon name="pfeil" size={18} />
            </button>
          </section>
        </div>
      </div>

      {newProject ? <ProjektDialog onClose={() => setNewProject(false)} navigate={navigate} /> : null}
    </div>
  );
}
