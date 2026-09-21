/** Application shell: navigation, global search and visible storage state. */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { offeneFristen } from './domain/engine';
import { exportiereDaten } from './store/storage';
import { useStore } from './store/store';
import { useRoute, type Route } from './lib/router';
import { useToast } from './components/toast';
import { Dashboard, sichtbareProjekte } from './pages/Dashboard';
import { Projekte } from './pages/Projekte';
import { Card, ConfirmDialog, EmptyState, Field, Modal, TextInput } from './components/ui';
import { EIGENE_ROLLE, STANDARD_BEARBEITER } from './domain/types';
import { Icon, type IconName } from './components/icons';
import { AppIcon, MailaenderLogo } from './components/logos';
import { GlobalSearch } from './components/GlobalSearch';
import { DataDialog } from './components/DataDialog';

const Fristen = lazy(() => import('./pages/Fristen').then((m) => ({ default: m.Fristen })));

const ProjektDetail = lazy(() => import('./pages/ProjektDetail').then((m) => ({ default: m.ProjektDetail })));
const Workflows = lazy(() => import('./pages/Workflows').then((m) => ({ default: m.Workflows })));
const Funktionen = lazy(() => import('./pages/Funktionen').then((m) => ({ default: m.Funktionen })));
const Vorlagen = lazy(() => import('./pages/Vorlagen').then((m) => ({ default: m.Vorlagen })));
const PlanlaufDetail = lazy(() =>
  import('./pages/projekt/PlanlaufDetail').then((m) => ({ default: m.PlanlaufDetail })),
);

export function App() {
  const { data, zuruecksetzen, speicherFehler, erneutSpeichern } = useStore();
  const toast = useToast();
  const [route, navigate] = useRoute();
  const [menuOffen, setMenuOffen] = useState(false);
  const [zuruecksetzenDialog, setZuruecksetzenDialog] = useState(false);
  const [bearbeiterDialog, setBearbeiterDialog] = useState(false);
  const [sucheOffen, setSucheOffen] = useState(false);
  const [datenOffen, setDatenOffen] = useState(false);
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 860px)').matches);
  const content = useRef<HTMLDivElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const [clock, setClock] = useState(() => new Date());
  const markierte = sichtbareProjekte(data.projects);
  const fristen = useMemo(() => offeneFristen(data), [data, clock]);
  const overdue = fristen.filter((f) => f.ampel === 'ueberfaellig').length;
  const projekt =
    route.view === 'projekt' || route.view === 'planlauf'
      ? data.projects.find((p) => p.id === route.projectId)
      : undefined;
  const lauf =
    route.view === 'planlauf'
      ? data.runs.find((r) => r.id === route.runId && r.projectId === route.projectId)
      : undefined;
  const gehe = (r: Route) => {
    navigate(r);
    setMenuOffen(false);
  };
  const kopf = kopfzeile(route, projekt?.name, lauf?.name);

  useEffect(() => {
    document.documentElement.dataset.farbmodus = data.bearbeiter.farbmodus ?? 'standard';
  }, [data.bearbeiter.farbmodus]);
  useEffect(() => {
    document.title = `${kopf.titel} · MC Plan`;
    if (content.current) content.current.scrollTop = 0;
  }, [route]);
  useEffect(() => {
    const media = matchMedia('(max-width: 860px)');
    const resize = () => {
      setMobile(media.matches);
      if (!media.matches) setMenuOffen(false);
    };
    media.addEventListener('change', resize);
    const tick = setInterval(() => setClock(new Date()), 60_000);
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!document.querySelector('dialog[open]')) setSucheOffen(true);
      }
      if (e.key === 'Escape') setMenuOffen(false);
    };
    window.addEventListener('keydown', key);
    return () => {
      media.removeEventListener('change', resize);
      clearInterval(tick);
      window.removeEventListener('keydown', key);
    };
  }, []);
  useEffect(() => {
    if (menuOffen) sidebar.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [menuOffen]);

  return (
    <div className="app">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          content.current?.focus();
        }}
      >
        Zum Inhalt springen
      </a>
      <aside
        ref={sidebar}
        id="main-navigation"
        className={`sidebar ${menuOffen ? 'open' : ''}`}
        aria-label="Hauptnavigation"
        inert={mobile && !menuOffen}
      >
        <button
          type="button"
          className="sidebar-brand"
          onClick={() => gehe({ view: 'dashboard' })}
          aria-label="MC Plan – zur Übersicht"
        >
          <span className="brand-symbol">
            <AppIcon size={34} />
          </span>
          <span className="sidebar-brand-text">
            <strong>
              MC Plan<span className="brand-point">.</span>
            </strong>
            <span>PLANLAUFMANAGEMENT</span>
          </span>
        </button>
        <div className="workspace-label">
          <span className="workspace-dot" /> Mein Arbeitsbereich
        </div>
        <nav aria-label="Arbeitsplatz">
          <div className="nav-group-label">Arbeitsplatz</div>
          <NavItem
            icon="dashboard"
            label="Übersicht"
            aktiv={route.view === 'dashboard'}
            onClick={() => gehe({ view: 'dashboard' })}
          />
          <NavItem
            icon="projekt"
            label="Projekte"
            aktiv={route.view === 'projekte'}
            badge={String(data.projects.length)}
            onClick={() => gehe({ view: 'projekte' })}
          />
          <NavItem
            icon="frist"
            label="Fristen & Aufgaben"
            aktiv={route.view === 'fristen'}
            badge={overdue ? String(overdue) : undefined}
            badgeAlarm
            onClick={() => gehe({ view: 'fristen' })}
          />
        </nav>
        <nav aria-label="Verwaltung">
          <div className="nav-group-label">Verwaltung</div>
          <NavItem
            icon="kette"
            label="Workflows"
            aktiv={route.view === 'ketten'}
            onClick={() => gehe({ view: 'ketten' })}
          />
          <NavItem
            icon="person"
            label="Funktionen & Rollen"
            aktiv={route.view === 'rollen'}
            onClick={() => gehe({ view: 'rollen' })}
          />
          <NavItem
            icon="kopieren"
            label="Vorlagen"
            aktiv={route.view === 'vorlagen'}
            onClick={() => gehe({ view: 'vorlagen' })}
          />
        </nav>
        <nav aria-label="Projektzugriff" className="project-nav">
          <div className="nav-group-label">
            {data.projects.some((p) => p.markiert) ? 'Meine Projekte' : 'Alle Projekte'}
            <span>{markierte.length}</span>
          </div>
          {markierte.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`project-nav-item ${projekt?.id === p.id ? 'active' : ''}`}
              aria-current={projekt?.id === p.id ? 'page' : undefined}
              onClick={() => gehe({ view: 'projekt', projectId: p.id, tab: 'uebersicht' })}
            >
              <span className="project-dot" />
              <span>
                <strong>{p.name}</strong>
                <small>{p.nummer || 'Ohne Projektnummer'}</small>
              </span>
              <Icon name="chevron" size={12} />
            </button>
          ))}
          {!markierte.length ? <p className="sidebar-empty">Ihr erstes Projekt wartet auf Sie.</p> : null}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="nav-item" onClick={() => setDatenOffen(true)}>
            <Icon name="sicherung" size={18} />
            <span>Daten & Sicherung</span>
          </button>
          <button type="button" className="bearbeiter" onClick={() => setBearbeiterDialog(true)}>
            <span className="avatar">{initialen(data.bearbeiter.name)}</span>
            <span>
              <strong>{data.bearbeiter.name}</strong>
              <small>Planlaufmanagement</small>
            </span>
            <Icon name="einstellungen" size={16} />
          </button>
          <div className="sidebar-signature">
            <MailaenderLogo height={27} />
          </div>
        </div>
      </aside>
      <main className="main" inert={mobile && menuOffen}>
        <header className="topbar">
          <button
            type="button"
            className="btn-icon menu-toggle"
            onClick={() => setMenuOffen((o) => !o)}
            aria-label="Menü öffnen"
            aria-expanded={menuOffen}
            aria-controls="main-navigation"
          >
            <Icon name="menu" size={21} />
          </button>
          <div className="topbar-title">
            <span className="breadcrumb-root">
              Arbeitsbereich <span>/</span>
            </span>
            <h1>{kopf.titel}</h1>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="global-search-trigger"
              onClick={() => setSucheOffen(true)}
              aria-label="Globale Suche öffnen"
            >
              <Icon name="suche" size={17} />
              <span>Schnell finden …</span>
              <kbd>⌘ / Strg K</kbd>
            </button>
            <button
              type="button"
              className={`storage-state ${speicherFehler ? 'error' : ''}`}
              onClick={() => setDatenOffen(true)}
              title={speicherFehler || 'Arbeitsstand auf diesem Gerät gespeichert'}
            >
              <span />
              {speicherFehler ? 'Nicht gespeichert' : 'Lokal gespeichert'}
            </button>
            <button
              type="button"
              className="btn-icon notification-button"
              aria-label={`Fristen öffnen, ${overdue} überfällig`}
              onClick={() => gehe({ view: 'fristen' })}
            >
              <Icon name="glocke" size={20} />
              {overdue ? <i /> : null}
            </button>
          </div>
        </header>
        {speicherFehler ? (
          <div className="storage-warning" role="alert">
            <div>
              <strong>Änderungen sind nicht gespeichert.</strong>
              <p>{speicherFehler}</p>
            </div>
            <div className="row wrap">
              <button className="btn btn-outline" onClick={() => exportiereDaten(data)}>
                Jetzt sichern
              </button>
              <button className="btn btn-outline" onClick={erneutSpeichern}>
                Erneut speichern
              </button>
              <button className="btn btn-outline" onClick={() => location.reload()}>
                Neu laden
              </button>
            </div>
          </div>
        ) : null}
        <div className="content" id="main-content" ref={content} tabIndex={-1}>
          <div className="content-inner">
            {!['dashboard', 'projekte', 'projekt', 'planlauf'].includes(route.view) ? (
              <section className="page-heading">
                <div>
                  <span className="eyebrow">
                    {route.view === 'fristen' ? 'IM BLICK BEHALTEN' : 'VERWALTUNG'}
                  </span>
                  <h2>{kopf.titel}</h2>
                  <p>{kopf.sub}</p>
                </div>
              </section>
            ) : null}
            <Suspense
              fallback={
                <div className="page-loading" role="status">
                  Arbeitsbereich wird geladen …
                </div>
              }
            >
              {route.view === 'dashboard' ? <Dashboard navigate={gehe} /> : null}
              {route.view === 'fristen' ? (
                <Fristen key={route.filter ?? 'alle'} navigate={gehe} initialFilter={route.filter} />
              ) : null}
              {route.view === 'projekte' ? <Projekte navigate={gehe} /> : null}
              {route.view === 'ketten' ? <Workflows /> : null}
              {route.view === 'rollen' ? <Funktionen /> : null}
              {route.view === 'vorlagen' ? <Vorlagen /> : null}
              {route.view === 'projekt' ? (
                projekt ? (
                  <ProjektDetail key={projekt.id} project={projekt} tab={route.tab} navigate={gehe} />
                ) : (
                  <NichtGefunden onZurueck={() => gehe({ view: 'projekte' })} />
                )
              ) : null}
              {route.view === 'planlauf' ? (
                projekt && lauf ? (
                  <PlanlaufDetail
                    key={lauf.id}
                    project={projekt}
                    run={lauf}
                    onZurueck={() => gehe({ view: 'projekt', projectId: projekt.id, tab: 'uebersicht' })}
                    oeffneLauf={(runId) => gehe({ view: 'planlauf', projectId: projekt.id, runId })}
                  />
                ) : (
                  <NichtGefunden onZurueck={() => gehe({ view: 'projekte' })} />
                )
              ) : null}
            </Suspense>
            <footer className="workspace-footer">
              <span>MC Plan · Klarheit in jedem Planlauf.</span>
              <span>Mailänder Consult</span>
            </footer>
          </div>
        </div>
      </main>
      {menuOffen && mobile ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Menü schließen"
          onClick={() => setMenuOffen(false)}
        />
      ) : null}
      {sucheOffen ? <GlobalSearch navigate={gehe} onClose={() => setSucheOffen(false)} /> : null}
      {datenOffen ? (
        <DataDialog
          onClose={() => setDatenOffen(false)}
          onReset={() => {
            setDatenOffen(false);
            setZuruecksetzenDialog(true);
          }}
          onRestored={() => gehe({ view: 'dashboard' })}
        />
      ) : null}
      {bearbeiterDialog ? <BearbeiterDialog onClose={() => setBearbeiterDialog(false)} /> : null}
      {zuruecksetzenDialog ? (
        <ConfirmDialog
          titel="Daten zurücksetzen?"
          text="Alle lokal gespeicherten Änderungen werden durch Demodaten ersetzt. Ihr bisheriger Stand wird vorher als Sicherung heruntergeladen."
          bestaetigenLabel="Sichern und zurücksetzen"
          onConfirm={() => {
            exportiereDaten(data);
            zuruecksetzen();
            toast('Demodaten wiederhergestellt.');
            gehe({ view: 'dashboard' });
          }}
          onClose={() => setZuruecksetzenDialog(false)}
        />
      ) : null}
    </div>
  );
}

/** Kürzel der angemeldeten Person für das Namensfeld. */
function initialen(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  if (teile.length === 0) return '?';
  if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase();
  return (teile[0][0] + teile[teile.length - 1][0]).toUpperCase();
}

function BearbeiterDialog({ onClose }: { onClose: () => void }) {
  const { data, setBearbeiter } = useStore();
  const [name, setName] = useState(data.bearbeiter.name);
  const [mailNachfrage, setMailNachfrage] = useState(data.bearbeiter.mailNachfrage ?? true);
  const [kontrast, setKontrast] = useState((data.bearbeiter.farbmodus ?? 'standard') === 'kontrast');

  return (
    <Modal
      titel="Mein Profil"
      sub="Eigene Angaben und persönliche Einstellungen"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setBearbeiter({
                name: name.trim() || STANDARD_BEARBEITER,
                mailNachfrage,
                farbmodus: kontrast ? 'kontrast' : 'standard',
              });
              onClose();
            }}
          >
            Übernehmen
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field
          label="Name"
          full
          hint={`In markierten Projekten sind Sie automatisch im Adressbuch als ${EIGENE_ROLLE} geführt.`}
        >
          <TextInput value={name} onChange={setName} placeholder="Vor- und Nachname" />
        </Field>
        <Field label="E-Mail nach Erledigung" full>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={mailNachfrage}
              onChange={(e) => setMailNachfrage(e.target.checked)}
            />
            Nachfragen zulassen, wenn ein Workflow-Schritt eine E-Mail vorsieht
          </label>
        </Field>
        <Field
          label="Darstellung"
          full
          hint="Farben für eine Rot-Grün-Sehschwäche: Blaugrün, Bernstein und Magenta statt Grün, Orange und Rot – zusätzlich mit stärkeren Kontrasten."
        >
          <label className="checkbox">
            <input type="checkbox" checked={kontrast} onChange={(e) => setKontrast(e.target.checked)} />
            Farbmodus für Rot-Grün-Sehschwäche (hoher Kontrast)
          </label>
        </Field>
      </div>
      <p className="small tertiary" style={{ marginTop: 12 }}>
        Eine Anmeldung je Person ist vorgesehen; bis dahin gilt dieser Name für alle Ansichten. Der
        Datenbestand liegt in dieser Fassung lokal im Browser – ein gemeinsamer Zugriff mehrerer Personen auf
        denselben Stand setzt die Anbindung einer Datenbank voraus.
      </p>
    </Modal>
  );
}

function NavItem({
  icon,
  label,
  aktiv,
  badge,
  badgeAlarm,
  onClick,
}: {
  icon: IconName;
  label: string;
  aktiv: boolean;
  badge?: string;
  badgeAlarm?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`nav-item ${aktiv ? 'active' : ''}`}
      aria-current={aktiv ? 'page' : undefined}
      onClick={onClick}
      title={label}
    >
      <span className="nav-icon">
        <Icon name={icon} size={16} />
      </span>
      <span className="nav-label">{label}</span>
      {badge ? <span className={`nav-badge ${badgeAlarm ? 'alert' : ''}`}>{badge}</span> : null}
    </button>
  );
}

function NichtGefunden({ onZurueck }: { onZurueck: () => void }) {
  return (
    <Card>
      <EmptyState
        icon="projekt"
        titel="Nicht gefunden"
        text="Der aufgerufene Eintrag existiert nicht (mehr)."
        action={
          <button type="button" className="btn btn-primary" onClick={onZurueck}>
            Zu den Projekten
          </button>
        }
      />
    </Card>
  );
}

function kopfzeile(route: Route, projektName?: string, laufName?: string): { titel: string; sub?: string } {
  switch (route.view) {
    case 'dashboard':
      return { titel: 'Übersicht', sub: 'Alle Projekte auf einen Blick' };
    case 'fristen':
      return { titel: 'Fristen & Erinnerungen', sub: 'Anstehende Prozessschritte über alle Projekte' };
    case 'projekte':
      return { titel: 'Projekte', sub: 'Projektverwaltung' };
    case 'ketten':
      return { titel: 'Workflows', sub: 'Standard-Workflows und Projektvarianten' };
    case 'rollen':
      return { titel: 'Funktionen', sub: 'Projektübergreifend, gegliedert nach Gewerken' };
    case 'vorlagen':
      return { titel: 'Vorlagen', sub: 'E-Mail-Texte und Excel-Vorlagen für den Upload' };
    case 'projekt':
      return { titel: projektName ?? 'Projekt', sub: 'Projektarbeitsbereich' };
    case 'planlauf':
      return { titel: laufName ?? 'Planlauf', sub: projektName };
    default:
      return { titel: 'MC Plan' };
  }
}
