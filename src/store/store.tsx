/**
 * Zentraler Anwendungsstatus. Alle Schreibzugriffe laufen über diesen Store,
 * der den Bestand nach jeder Änderung lokal persistiert und die Soll-Termine
 * betroffener Planläufe neu berechnet.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { eigeneKontakteSichern, recalcRun, zustaendigkeitenNachziehen } from '../domain/engine';
import { seedData } from '../domain/seed';
import { ladeDaten, speichereDaten, STORAGE_KEY } from './storage';
import { newId } from '../lib/id';
export { newId } from '../lib/id';
import { today } from '../lib/dates';
import type {
  AbbruchArt,
  AppData,
  Bearbeiter,
  Contact,
  ID,
  PlanDocument,
  PlanRun,
  ProcessTemplate,
  EmailTemplate,
  Project,
  Role,
  RunStep,
  StandardRolle,
} from '../domain/types';

interface StoreValue {
  data: AppData;
  speicherFehler: string | null;
  erneutSpeichern: () => void;
  transaktion: (aktion: () => void) => void;
  /* Bearbeiter */
  setBearbeiter: (b: Partial<Bearbeiter>) => void;
  /* Projekte */
  addProject: (p: Omit<Project, 'id'>) => ID;
  toggleMarkiert: (id: ID) => void;
  updateProject: (id: ID, patch: Partial<Project>) => void;
  deleteProject: (id: ID) => void;
  /* Funktionen (projektübergreifend) */
  addStandardRolle: (r: Omit<StandardRolle, 'id'>) => ID;
  updateStandardRolle: (id: ID, patch: Partial<StandardRolle>) => void;
  deleteStandardRolle: (id: ID) => void;
  /* Projektfunktionen */
  addRole: (r: Omit<Role, 'id'>) => ID;
  updateRole: (id: ID, patch: Partial<Role>) => void;
  deleteRole: (id: ID) => void;
  /* Kontakte */
  addContact: (c: Omit<Contact, 'id'>) => ID;
  updateContact: (id: ID, patch: Partial<Contact>) => void;
  deleteContact: (id: ID) => void;
  /* Dokumente */
  addDocument: (d: Omit<PlanDocument, 'id'>) => ID;
  updateDocument: (id: ID, patch: Partial<PlanDocument>) => void;
  deleteDocument: (id: ID) => void;
  /* E-Mail-Vorlagen (projektübergreifend) */
  setEmailVorlage: (t: EmailTemplate) => void;
  deleteEmailVorlage: (id: ID) => void;
  /* Vorlagen */
  addTemplate: (t: Omit<ProcessTemplate, 'id'> & { id?: ID }) => ID;
  updateTemplate: (id: ID, patch: Partial<ProcessTemplate>) => void;
  deleteTemplate: (id: ID) => void;
  /* Planläufe */
  addRun: (r: Omit<PlanRun, 'id'>) => ID;
  updateRun: (id: ID, patch: Partial<PlanRun>) => void;
  deleteRun: (id: ID) => void;
  updateStep: (runId: ID, stepId: ID, patch: Partial<RunStep>) => void;
  addStep: (runId: ID, step: Omit<RunStep, 'id'>, position?: number) => void;
  /** Bricht einen Lauf mit Begründung ab; er bleibt im Projekt sichtbar. */
  abbrechenRun: (runId: ID, grund: string, art: AbbruchArt, neuerIndex: string | null) => void;
  /* Verwaltung */
  ersetzeDaten: (d: AppData) => void;
  zuruecksetzen: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => ladeDaten());
  const [speicherFehler, setSpeicherFehler] = useState<string | null>(null);
  const transaktionen = useRef<((d: AppData) => AppData)[] | null>(null);
  const erneutSpeichern = useCallback(() => {
    try {
      speichereDaten(data);
      setSpeicherFehler(null);
    } catch (e) {
      setSpeicherFehler(e instanceof Error ? e.message : 'Die Änderungen konnten nicht gespeichert werden.');
    }
  }, [data]);

  useEffect(() => {
    erneutSpeichern();
  }, [erneutSpeichern]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null)
        setSpeicherFehler(
          'Ein anderer Tab hat den Bestand geändert. Sichern Sie bei Bedarf Ihren Arbeitsstand und laden Sie die Seite neu.',
        );
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /** Änderung anwenden und alle Läufe mit aktuellen Projekteinstellungen durchrechnen. */
  const mutate = useCallback((fn: (d: AppData) => AppData) => {
    if (transaktionen.current) {
      transaktionen.current.push(fn);
      return;
    }
    setData((alt) => {
      // Die angemeldete Person wird in ihren Projekten stets als
      // Planlaufmanagement geführt – auch nach einem neuen Projekt,
      // einer Markierung oder einer Namensänderung.
      // Zuständigkeiten folgen dem Adressbuch: neue oder gewechselte
      // Besetzungen greifen sofort auch in laufenden Planläufen.
      const neu = zustaendigkeitenNachziehen(eigeneKontakteSichern(fn(alt), newId));
      const projects = new Map(neu.projects.map((p) => [p.id, p]));
      const documents = new Map(neu.documents.map((d) => [d.id, d]));
      return {
        ...neu,
        runs: neu.runs.map((r) => recalcRun(r, projects.get(r.projectId), documents.get(r.documentId))),
      };
    });
  }, []);

  const transaktion = useCallback(
    (aktion: () => void) => {
      if (transaktionen.current) {
        aktion();
        return;
      }
      transaktionen.current = [];
      try {
        aktion();
        const changes = transaktionen.current;
        transaktionen.current = null;
        if (changes.length) mutate((d) => changes.reduce((current, fn) => fn(current), d));
      } finally {
        transaktionen.current = null;
      }
    },
    [mutate],
  );

  const value = useMemo<StoreValue>(() => {
    const upd = <T extends { id: ID }>(list: T[], id: ID, patch: Partial<T>) =>
      list.map((x) => (x.id === id ? { ...x, ...patch } : x));

    return {
      data,
      speicherFehler,
      erneutSpeichern,
      transaktion,

      setBearbeiter: (b) => mutate((d) => ({ ...d, bearbeiter: { ...d.bearbeiter, ...b } })),

      toggleMarkiert: (id) =>
        mutate((d) => ({
          ...d,
          projects: d.projects.map((p) => (p.id === id ? { ...p, markiert: !p.markiert } : p)),
        })),

      addProject: (p) => {
        const id = newId('prj');
        mutate((d) => ({ ...d, projects: [...d.projects, { ...p, id }] }));
        return id;
      },
      updateProject: (id, patch) => mutate((d) => ({ ...d, projects: upd(d.projects, id, patch) })),
      deleteProject: (id) =>
        mutate((d) => ({
          ...d,
          projects: d.projects.filter((p) => p.id !== id),
          roles: d.roles.filter((r) => r.projectId !== id),
          contacts: d.contacts.filter((c) => c.projectId !== id),
          documents: d.documents.filter((x) => x.projectId !== id),
          runs: d.runs.filter((r) => r.projectId !== id),
          templates: d.templates.filter((t) => t.projectId !== id),
        })),

      addStandardRolle: (r) => {
        const id = newId('srol');
        mutate((d) => ({ ...d, standardRollen: [...d.standardRollen, { ...r, id }] }));
        return id;
      },
      updateStandardRolle: (id, patch) =>
        mutate((d) => ({ ...d, standardRollen: upd(d.standardRollen, id, patch) })),
      deleteStandardRolle: (id) =>
        mutate((d) => ({ ...d, standardRollen: d.standardRollen.filter((r) => r.id !== id) })),

      addRole: (r) => {
        const id = newId('rol');
        mutate((d) => ({ ...d, roles: [...d.roles, { ...r, id }] }));
        return id;
      },
      updateRole: (id, patch) => mutate((d) => ({ ...d, roles: upd(d.roles, id, patch) })),
      deleteRole: (id) =>
        mutate((d) => ({
          ...d,
          roles: d.roles.filter((r) => r.id !== id),
          contacts: d.contacts.map((c) => ({
            ...c,
            zuordnungen: c.zuordnungen.filter((z) => z.roleId !== id),
          })),
        })),

      addContact: (c) => {
        const id = newId('con');
        mutate((d) => ({ ...d, contacts: [...d.contacts, { ...c, id }] }));
        return id;
      },
      updateContact: (id, patch) => mutate((d) => ({ ...d, contacts: upd(d.contacts, id, patch) })),
      deleteContact: (id) =>
        mutate((d) => ({
          ...d,
          contacts: d.contacts.filter((c) => c.id !== id),
          runs: d.runs.map((r) => ({
            ...r,
            steps: r.steps.map((s) => (s.contactId === id ? { ...s, contactId: null } : s)),
          })),
        })),

      addDocument: (doc) => {
        const id = newId('doc');
        mutate((d) => ({ ...d, documents: [...d.documents, { ...doc, id }] }));
        return id;
      },
      updateDocument: (id, patch) => mutate((d) => ({ ...d, documents: upd(d.documents, id, patch) })),
      deleteDocument: (id) =>
        mutate((d) => ({
          ...d,
          documents: d.documents
            .filter((x) => x.id !== id)
            .map((x) => ({
              ...x,
              parentId: x.parentId === id ? null : x.parentId,
              paketId: x.paketId === id ? null : x.paketId,
            })),
          runs: d.runs.filter((r) => r.documentId !== id),
        })),

      setEmailVorlage: (t) =>
        mutate((d) => ({
          ...d,
          emailVorlagen: d.emailVorlagen.some((x) => x.id === t.id)
            ? d.emailVorlagen.map((x) => (x.id === t.id ? t : x))
            : [...d.emailVorlagen, t],
        })),

      deleteEmailVorlage: (id) =>
        mutate((d) => ({ ...d, emailVorlagen: d.emailVorlagen.filter((x) => x.id !== id) })),

      addTemplate: (t) => {
        const id = t.id ?? newId('tpl');
        mutate((d) => ({ ...d, templates: [...d.templates, { ...t, id } as ProcessTemplate] }));
        return id;
      },
      updateTemplate: (id, patch) => mutate((d) => ({ ...d, templates: upd(d.templates, id, patch) })),
      deleteTemplate: (id) => mutate((d) => ({ ...d, templates: d.templates.filter((t) => t.id !== id) })),

      addRun: (r) => {
        const id = newId('run');
        mutate((d) => ({ ...d, runs: [...d.runs, { ...r, id }] }));
        return id;
      },
      updateRun: (id, patch) => mutate((d) => ({ ...d, runs: upd(d.runs, id, patch) })),
      deleteRun: (id) => mutate((d) => ({ ...d, runs: d.runs.filter((r) => r.id !== id) })),

      updateStep: (runId, stepId, patch) =>
        mutate((d) => ({
          ...d,
          runs: d.runs.map((r) =>
            r.id === runId
              ? { ...r, steps: r.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) }
              : r,
          ),
        })),

      addStep: (runId, step, position) =>
        mutate((d) => ({
          ...d,
          runs: d.runs.map((r) => {
            if (r.id !== runId) return r;
            const neu = { ...step, id: newId('rs') };
            const steps = [...r.steps];
            steps.splice(position ?? steps.length, 0, neu);
            return { ...r, steps };
          }),
        })),

      abbrechenRun: (runId, grund, art, neuerIndex) =>
        mutate((d) => ({
          ...d,
          runs: d.runs.map((r) =>
            r.id === runId
              ? {
                  ...r,
                  status: 'abgebrochen' as const,
                  abbruchGrund: grund,
                  abbruchDatum: today(),
                  abbruchArt: art,
                  abbruchNeuerIndex: neuerIndex,
                }
              : r,
          ),
        })),

      ersetzeDaten: (d) => mutate(() => d),
      zuruecksetzen: () => mutate(() => seedData()),
    };
  }, [data, mutate, speicherFehler, erneutSpeichern, transaktion]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore muss innerhalb des StoreProvider verwendet werden.');
  return ctx;
}
