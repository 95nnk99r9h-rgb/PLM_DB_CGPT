import type { ProcessTemplateStep } from './types';
import { zielVonSchritt } from './engine';

/** Remap both decision branches and ordinary successor edges when duplicating. */
export function kopiereWorkflowSchritte(
  steps: ProcessTemplateStep[],
  newId: () => string,
): ProcessTemplateStep[] {
  const ids = new Map(steps.map((s) => [s.id, newId()]));
  const target = (id: string | null) => (id === null || id === 'ende' ? id : (ids.get(id) ?? null));
  return steps.map((s) => ({
    ...s,
    id: ids.get(s.id)!,
    naechster: target(s.naechster),
    antworten: s.antworten.map((a) => ({ ...a, id: newId(), ziel: target(a.ziel) })),
  }));
}

/** Deleting a node reconnects incoming edges; no dangling IDs are persisted. */
export function entferneWorkflowSchritt(steps: ProcessTemplateStep[], id: string): ProcessTemplateStep[] {
  const index = steps.findIndex((s) => s.id === id);
  if (index < 0) return steps;
  const explicit = zielVonSchritt(steps[index]);
  const next = explicit && explicit !== id ? explicit : (steps[index + 1]?.id ?? 'ende');
  return steps
    .filter((s) => s.id !== id)
    .map((s) => ({
      ...s,
      naechster: s.naechster === id ? next : s.naechster,
      antworten: s.antworten.map((a) => ({ ...a, ziel: a.ziel === id ? next : a.ziel })),
    }));
}
