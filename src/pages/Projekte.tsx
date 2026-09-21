/** Project portfolio with accessible cards and focused filtering. */
import { useState } from 'react';
import type { Project, ProjectStatus } from '../domain/types';
import type { Route } from '../lib/router';
import { useStore } from '../store/store';
import { useToast } from '../components/toast';
import {
  Card,
  EmptyState,
  Field,
  Modal,
  Search,
  Segmented,
  Select,
  TextArea,
  TextInput,
} from '../components/ui';
import { Icon } from '../components/icons';
import { ProjectCard } from '../components/ProjectCard';
const STATUS_OPTIONEN = [
  { value: 'aktiv', label: 'Aktiv' },
  { value: 'pausiert', label: 'Pausiert' },
  { value: 'abgeschlossen', label: 'Abgeschlossen' },
];

export function Projekte({ navigate }: { navigate: (r: Route) => void }) {
  const { data, toggleMarkiert } = useStore();
  const [suche, setSuche] = useState('');
  const [filter, setFilter] = useState('alle');
  const [dialog, setDialog] = useState(false);
  const projects = data.projects.filter(
    (p) =>
      (filter === 'alle' || (filter === 'markiert' ? p.markiert : p.status === filter)) &&
      [p.name, p.nummer, p.beschreibung].join(' ').toLowerCase().includes(suche.trim().toLowerCase()),
  );
  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">IHR PROJEKTPORTFOLIO</span>
          <h2>
            Projekte<span className="heading-count">{data.projects.length}</span>
          </h2>
          <p>Alle Pläne, Beteiligten und Freigaben. An einem Ort.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setDialog(true)}>
          <Icon name="plus" size={17} /> Neues Projekt
        </button>
      </section>
      <div className="portfolio-toolbar">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'alle', label: 'Alle Projekte' },
            { value: 'markiert', label: 'Meine Projekte' },
            { value: 'aktiv', label: 'Aktiv' },
            { value: 'pausiert', label: 'Pausiert' },
            { value: 'abgeschlossen', label: 'Abgeschlossen' },
          ]}
        />
        <Search value={suche} onChange={setSuche} placeholder="Projekte durchsuchen …" />
      </div>
      <div className="project-grid">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} data={data} onFavorite={() => toggleMarkiert(p.id)} />
        ))}
      </div>
      {!projects.length ? (
        <Card>
          <EmptyState
            icon="projekt"
            titel="Keine Projekte in dieser Auswahl"
            text={
              data.projects.length
                ? 'Passen Sie die Suche oder den Filter an.'
                : 'Legen Sie Ihr erstes Projekt an, um zu starten.'
            }
            action={
              <button
                className="btn btn-primary"
                onClick={() => (data.projects.length ? (setFilter('alle'), setSuche('')) : setDialog(true))}
              >
                {data.projects.length ? 'Filter zurücksetzen' : 'Projekt anlegen'}
              </button>
            }
          />
        </Card>
      ) : null}
      <p className="small muted">
        Mit dem Stern markierte Projekte erscheinen in Ihrer Übersicht und im direkten Projektzugriff.
      </p>
      {dialog ? <ProjektDialog onClose={() => setDialog(false)} navigate={navigate} /> : null}
    </div>
  );
}

export function ProjektDialog({
  project,
  onClose,
  navigate,
}: {
  project?: Project;
  onClose: () => void;
  navigate?: (r: Route) => void;
}) {
  const { data, addProject, updateProject, addRole, transaktion } = useStore();
  const toast = useToast();
  const [form, setForm] = useState({
    nummer: project?.nummer ?? '',
    name: project?.name ?? '',
    status: project?.status ?? ('aktiv' as ProjectStatus),
    markiert: project?.markiert ?? true,
    beschreibung: project?.beschreibung ?? '',
  });

  const set = <K extends keyof typeof form>(key: K, wert: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: wert }));

  const speichern = () => {
    if (!form.name.trim()) {
      toast('Bitte einen Projektnamen angeben.');
      return;
    }
    if (project) {
      updateProject(project.id, form);
      toast('Projekt aktualisiert.');
      onClose();
      return;
    }
    let id = '';
    transaktion(() => {
      id = addProject({
        ...form,
        settings: {
          erinnerungVorlaufTage: 5,
          fristenInArbeitstagen: true,
          feiertage: [],
          absenderName: '',
          absenderEmail: '',
        },
      });
      // Funktionen als Projektfunktionen übernehmen
      data.standardRollen.forEach((r) =>
        addRole({
          projectId: id,
          name: r.name,
          kuerzel: r.kuerzel,
          farbe: r.farbe,
          beschreibung: r.beschreibung,
          gewerk: r.gewerk,
        }),
      );
    });
    toast('Projekt angelegt – die Funktionen wurden übernommen.');
    onClose();
    navigate?.({ view: 'projekt', projectId: id, tab: 'uebersicht' });
  };

  return (
    <Modal
      titel={project ? 'Projekt bearbeiten' : 'Neues Projekt'}
      sub={project ? project.nummer : 'Grunddaten erfassen – Rollen und Vorlagen werden vorbelegt'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={speichern}>
            {project ? 'Speichern' : 'Projekt anlegen'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Projektnummer">
          <TextInput value={form.nummer} onChange={(v) => set('nummer', v)} placeholder="2026-001" />
        </Field>
        <Field label="Status">
          <Select
            value={form.status}
            onChange={(v) => set('status', v as ProjectStatus)}
            options={STATUS_OPTIONEN}
          />
        </Field>
        <Field label="Projektname" full>
          <TextInput value={form.name} onChange={(v) => set('name', v)} placeholder="Neubau …" />
        </Field>
        <Field label="Beschreibung" full>
          <TextArea value={form.beschreibung} onChange={(v) => set('beschreibung', v)} rows={3} />
        </Field>
      </div>
    </Modal>
  );
}
