process.env.TZ = 'Europe/Berlin';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, parseISO, diffDays, toISO } from '../src/lib/dates';
import { seedData } from '../src/domain/seed';
import { importiereDaten, ladeDaten, speichereDaten, STORAGE_KEY } from '../src/store/storage';
import { pruefeDaten } from '../src/store/validation';
import { schrittStatusSetzen } from '../src/domain/abschluss';
import {
  pfad,
  recalcRun,
  rueckSprungAnwenden,
  stepsAusTemplate,
  zustaendigkeitenNachziehen,
} from '../src/domain/engine';
import { csvLesen, datumLesen, tabelleLesen, xlsxLesen } from '../src/lib/xlsxLesen';
import { kopiereWorkflowSchritte, entferneWorkflowSchritt } from '../src/domain/workflows';
import { html, druckeHtml } from '../src/lib/print';
import type { RunStep } from '../src/domain/types';

class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  clear() {
    this.items.clear();
  }
}
let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
});
const step = (id: string, patch: Partial<RunStep> = {}): RunStep => ({
  id,
  name: id,
  typ: 'aufgabe',
  roleName: 'Fachplaner',
  contactId: null,
  contactManuell: false,
  fristTage: 2,
  sollDatum: null,
  sollManuell: false,
  istDatum: null,
  status: 'offen',
  abweichung: false,
  bemerkung: '',
  letzteErinnerung: null,
  antworten: [],
  gewaehlteAntwortId: null,
  naechster: null,
  durchlauf: 1,
  nachweis: 'keine',
  nachweisNummer: null,
  mailFrage: false,
  mailVorlageId: null,
  ...patch,
});

test('rejects impossible and partial dates, accepts leap day', () => {
  for (const value of [
    '2026-02-31',
    '2026-13-01',
    '2026-00-01',
    '2026-01-00',
    '2026-01-01garbage',
    '2026-01-01T00:00:00',
  ])
    assert.equal(parseISO(value), null);
  assert.equal(toISO(parseISO('2024-02-29')!), '2024-02-29');
  assert.equal(datumLesen('31.02.2026'), null);
  assert.equal(datumLesen('7.9.26'), '2026-09-07');
});
test('business-day deadlines skip weekends and holidays, including DST', () => {
  assert.equal(addDays('2026-04-02', 1, true, ['2026-04-03', '2026-04-06']), '2026-04-07');
  assert.equal(addDays('2026-03-30', -1, true), '2026-03-27');
  assert.equal(diffDays('2026-03-28', '2026-03-30'), 2);
});
test('fractional, NaN and infinite deadlines terminate safely', () => {
  assert.equal(addDays('2026-09-21', 1.9, true), '2026-09-22');
  assert.equal(addDays('2026-09-21', Infinity, true), '2026-09-21');
  assert.equal(addDays('2026-09-21', NaN), '2026-09-21');
});
test('seed data and a complete JSON backup pass validation', () => {
  const data = seedData();
  assert.doesNotThrow(() => pruefeDaten(data));
  const loaded = importiereDaten(JSON.stringify(data));
  assert.equal(loaded.documents.length, data.documents.length);
  assert.equal(loaded.runs.length, data.runs.length);
});
test('invalid backups, duplicate IDs, invalid deadlines and dangling references are rejected', () => {
  assert.throws(() => importiereDaten('{broken'), /JSON/);
  const data = seedData();
  data.version = 999;
  assert.throws(() => importiereDaten(JSON.stringify(data)), /version/);
  const duplicate = seedData();
  duplicate.projects.push(duplicate.projects[0]);
  assert.throws(() => pruefeDaten(duplicate), /doppelte/);
  const decimal = seedData();
  decimal.runs[0].steps[0].fristTage = 1.5;
  assert.throws(() => pruefeDaten(decimal), /ganze Zahl/);
  const dangling = seedData();
  dangling.runs[0].documentId = 'missing';
  assert.throws(() => pruefeDaten(dangling), /fehlenden/);
});
test('corrupt stored data is preserved and never silently replaced by demo data', () => {
  storage.setItem(STORAGE_KEY, '{corrupt');
  assert.throws(() => ladeDaten(), /JSON/);
  assert.equal(storage.getItem(STORAGE_KEY), '{corrupt');
});
test('a conflicting write from another tab is detected before overwriting it', () => {
  const data = ladeDaten();
  speichereDaten(data);
  const other = JSON.stringify({ ...data, bearbeiter: { ...data.bearbeiter, name: 'Anderer Tab' } });
  storage.setItem(STORAGE_KEY, other);
  assert.throws(() => speichereDaten(data), /anderen Tab/);
  assert.equal(storage.getItem(STORAGE_KEY), other);
});
test('storage quota failure is propagated to the UI', () => {
  const data = ladeDaten();
  storage.setItem = () => {
    throw new DOMException('full', 'QuotaExceededError');
  };
  assert.throws(() => speichereDaten(data), /Speicher ist voll/);
});
test('looped review steps require a new proof and reminder in the new iteration', () => {
  const steps = [
    step('review', {
      status: 'erledigt',
      nachweis: 'pruefbericht',
      nachweisNummer: 'OLD-01',
      letzteErinnerung: '2026-01-01',
    }),
    step('decision', {
      typ: 'entscheidung',
      antworten: [{ id: 'no', text: 'Zurück', ziel: 'review' }],
      status: 'erledigt',
    }),
  ];
  const next = rueckSprungAnwenden(steps, 'decision', 'review');
  assert.equal(next[0].status, 'laufend');
  assert.equal(next[0].durchlauf, 2);
  assert.equal(next[0].nachweisNummer, null);
  assert.equal(next[0].letzteErinnerung, null);
  assert.equal(pfad(next).length, 2);
});
test('reopening a completed step reopens the entire run', () => {
  const run = seedData().runs[0];
  run.status = 'abgeschlossen';
  const s = step('done', { status: 'erledigt', istDatum: '2026-09-01' });
  run.steps = [s];
  const result = schrittStatusSetzen(run, s, 'offen');
  assert.equal(result.art, 'aenderung');
  if (result.art === 'aenderung')
    assert.ok(result.aenderungen.some((a) => a.art === 'run' && a.patch.status === 'laufend'));
});
test('blank proof cannot complete an approval', () => {
  const run = seedData().runs[0];
  const s = step('approval', { nachweis: 'freigabe' });
  run.steps = [s];
  assert.equal(schrittStatusSetzen(run, s, 'erledigt', '   ').art, 'nachweis');
});
test('manual dates stay fixed and feed subsequent deadlines', () => {
  const run = seedData().runs[0];
  run.steps = [step('a', { sollManuell: true, sollDatum: '2026-09-23' }), step('b')];
  const calculated = recalcRun(run, seedData().projects[0]);
  assert.equal(calculated.steps[0].sollDatum, '2026-09-23');
  assert.equal(calculated.steps[1].sollDatum, '2026-09-25');
  assert.equal(recalcRun(calculated, seedData().projects[0]), calculated);
});
test('completed and skipped steps retain their historic assignee', () => {
  const data = seedData();
  data.runs[0].steps = [step('skip', { status: 'uebersprungen', contactId: 'historic' })];
  assert.equal(zustaendigkeitenNachziehen(data).runs[0].steps[0].contactId, 'historic');
});
test('cloning a workflow remaps all branch targets into the new run', () => {
  let id = 0;
  const result = stepsAusTemplate(
    seedData().templates[0],
    () => null,
    () => `new-${id++}`,
  );
  const ids = new Set(result.map((s) => s.id));
  for (const s of result)
    for (const target of [s.naechster, ...s.antworten.map((a) => a.ziel)])
      if (target && target !== 'ende') assert.ok(ids.has(target));
});
test('CSV handles BOM, quoted separators, escaped quotes and multiline cells', async () => {
  const file = new File(['\uFEFF"Titel, mit Komma";Datum\r\n"Zeile\nmit ""Zitat""";21.09.2026'], 'plans.csv');
  const [sheet] = await csvLesen(file);
  assert.deepEqual(sheet.zeilen, [
    ['Titel, mit Komma', 'Datum'],
    ['Zeile\nmit "Zitat"', '21.09.2026'],
  ]);
  await assert.rejects(csvLesen(new File(['Titel;Datum\n"offen;2026'], 'bad.csv')), /Anführungszeichen/);
});
test('oversized files and malformed ZIP files are rejected before processing', async () => {
  await assert.rejects(tabelleLesen({ name: 'huge.csv', size: 20_000_001 } as File), /20 MB/);
  await assert.rejects(xlsxLesen(new File(['not-a-zip'], 'broken.xlsx')), /ZIP/);
  await assert.rejects(tabelleLesen(new File(['test'], 'file.exe')), /xlsx/);
});
test('HTML escaping prevents markup in text and attributes', () => {
  assert.equal(html('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('print title cannot inject a script into the iframe', () => {
  let output = '';
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => ({
        setAttribute() {},
        style: {},
        remove() {},
        contentDocument: {
          open() {},
          write(value: string) {
            output = value;
          },
          close() {},
        },
        contentWindow: { document: { readyState: 'loading' } },
      }),
      body: { appendChild() {} },
    },
  });
  druckeHtml('</title><script>attack()</script>', '<p>safe</p>');
  assert.ok(output.includes('&lt;/title&gt;&lt;script&gt;attack()&lt;/script&gt;'));
  assert.ok(!output.includes('<script>attack()'));
});

test('duplicating and deleting workflow nodes preserves valid successor edges', () => {
  const template = seedData().templates[0];
  template.steps[0].naechster = template.steps[2].id;
  let n = 0;
  const copied = kopiereWorkflowSchritte(template.steps, () => `copy-${n++}`);
  assert.equal(copied[0].naechster, copied[2].id);
  const removed = entferneWorkflowSchritt(copied, copied[2].id);
  const ids = new Set(removed.map((s) => s.id));
  for (const s of removed)
    for (const target of [s.naechster, ...s.antworten.map((a) => a.ziel)])
      if (target && target !== 'ende') assert.ok(ids.has(target));
});
