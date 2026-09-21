/** Runtime validation at the trust boundary: stored data and imported backups. */
import { DATEN_VERSION, type AppData } from '../domain/types';
import { parseISO } from '../lib/dates';

type Row = Record<string, unknown>;
const fail = (path: string): never => {
  throw new Error(`Ungültige Sicherung: ${path}. Der vorhandene Bestand bleibt erhalten.`);
};
function obj(value: unknown, path: string): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${path} muss ein Objekt sein`);
  return value as Row;
}
function text(row: Row, key: string, path: string, optional = false) {
  if (optional && row[key] == null) return;
  if (typeof row[key] !== 'string' || (row[key] as string).length > 100_000)
    fail(`${path}.${key} ist kein gültiger Text`);
}
function number(row: Row, key: string, path: string) {
  if (!Number.isSafeInteger(row[key]) || (row[key] as number) < 0 || (row[key] as number) > 36500)
    fail(`${path}.${key} muss eine ganze Zahl zwischen 0 und 36500 sein`);
}
function date(row: Row, key: string, path: string, nullable = true) {
  if (nullable && row[key] == null) return;
  if (typeof row[key] !== 'string' || !parseISO(row[key] as string))
    fail(`${path}.${key} ist kein gültiges Datum`);
}
function oneOf(row: Row, key: string, values: string[], path: string) {
  if (!values.includes(row[key] as string)) fail(`${path}.${key} ist unbekannt`);
}
function rows(value: unknown, path: string): Row[] {
  if (!Array.isArray(value) || value.length > 100_000)
    fail(`${path} muss eine Liste mit höchstens 100.000 Einträgen sein`);
  const ids = new Set<string>();
  return (value as unknown[]).map((v, i) => {
    const row = obj(v, `${path}[${i + 1}]`);
    if (typeof row.id !== 'string' || !row.id || row.id.length > 300 || ids.has(row.id))
      fail(`${path} enthält eine fehlende oder doppelte ID`);
    ids.add(row.id as string);
    return row;
  });
}

/** Checks the fields required to migrate old backups safely. */
export function pruefeGrundstruktur(value: unknown): asserts value is AppData {
  const data = obj(value, 'Daten');
  if (
    !Number.isInteger(data.version) ||
    (data.version as number) < 1 ||
    (data.version as number) > DATEN_VERSION
  )
    fail('Datenversion wird nicht unterstützt');
  for (const key of ['projects', 'roles', 'contacts', 'documents', 'templates', 'runs']) rows(data[key], key);
  for (const p of data.projects as Row[]) obj(p.settings, 'Projekteinstellungen');
  for (const key of ['templates', 'runs'])
    for (const row of data[key] as Row[]) rows(row.steps, `${key}.steps`);
}

export function pruefeDaten(value: unknown): asserts value is AppData {
  pruefeGrundstruktur(value);
  const data = value as unknown as Row;
  const bearbeiter = obj(data.bearbeiter, 'Bearbeiter');
  text(bearbeiter, 'name', 'Bearbeiter');
  const projects = rows(data.projects, 'Projekte');
  const projectIds = new Set(projects.map((p) => p.id));
  const projectRef = (r: Row, path: string, nullable = false) => {
    if (nullable && r.projectId === null) return;
    if (!projectIds.has(r.projectId)) fail(`${path} verweist auf ein fehlendes Projekt`);
  };
  for (const p of projects) {
    for (const key of ['name', 'nummer', 'beschreibung']) text(p, key, 'Projekt');
    oneOf(p, 'status', ['aktiv', 'pausiert', 'abgeschlossen'], 'Projekt');
    const settings = obj(p.settings, 'Einstellungen');
    number(settings, 'erinnerungVorlaufTage', 'Einstellungen');
    if (typeof settings.fristenInArbeitstagen !== 'boolean') fail('Arbeitstage-Einstellung fehlt');
    if (
      !Array.isArray(settings.feiertage) ||
      settings.feiertage.length > 10000 ||
      settings.feiertage.some((d) => typeof d !== 'string' || !parseISO(d))
    )
      fail('Feiertage sind ungültig');
  }
  const roles = rows(data.roles, 'Rollen');
  const roleMap = new Map(roles.map((r) => [r.id, r]));
  for (const r of [...roles, ...rows(data.standardRollen, 'Standardrollen')]) {
    for (const key of ['name', 'kuerzel', 'farbe', 'beschreibung']) text(r, key, 'Funktion');
    text(r, 'gewerk', 'Funktion', true);
    if ('projectId' in r) projectRef(r, 'Funktion');
  }
  for (const c of rows(data.contacts, 'Kontakte')) {
    projectRef(c, 'Kontakt');
    for (const key of ['vorname', 'nachname', 'email', 'firma', 'telefon', 'anschrift', 'notiz'])
      text(c, key, 'Kontakt');
    if (!Array.isArray(c.zuordnungen)) fail('Kontaktzuordnungen fehlen');
    for (const z of c.zuordnungen as unknown[]) {
      const role = roleMap.get(obj(z, 'Zuordnung').roleId);
      if (!role || role.projectId !== c.projectId)
        fail('Kontaktzuordnung verweist auf eine fehlende oder fremde Rolle');
    }
  }
  for (const v of rows(data.emailVorlagen, 'E-Mail-Vorlagen'))
    for (const key of ['name', 'betreff', 'text', 'anlass']) text(v, key, 'E-Mail-Vorlage');
  const documents = rows(data.documents, 'Dokumente');
  const docs = new Map(documents.map((d) => [d.id, d]));
  for (const d of documents) {
    projectRef(d, 'Dokument');
    oneOf(d, 'kind', ['plan', 'paket', 'verzeichnis'], 'Dokument');
    for (const key of ['nummer', 'titel', 'index', 'gewerk', 'planungsphase', 'bemerkung'])
      text(d, key, 'Dokument');
    date(d, 'eingangSoll', 'Dokument');
    date(d, 'datum', 'Dokument');
    for (const key of ['parentId', 'paketId']) {
      if (d[key] == null) continue;
      const parent = docs.get(d[key]);
      if (
        !parent ||
        parent.projectId !== d.projectId ||
        parent.id === d.id ||
        parent.kind !== (key === 'parentId' ? 'verzeichnis' : 'paket')
      )
        fail('Dokumentzuordnung ist ungültig');
    }
  }
  const runs = rows(data.runs, 'Planläufe');
  for (const r of [...rows(data.templates, 'Workflows'), ...runs]) {
    const isRun = 'documentId' in r;
    projectRef(r, isRun ? 'Planlauf' : 'Workflow', !isRun);
    text(r, 'name', 'Workflow');
    if (isRun) {
      const doc = docs.get(r.documentId);
      if (!doc || doc.projectId !== r.projectId)
        fail('Planlauf verweist auf einen fehlenden oder fremden Plan');
      oneOf(r, 'status', ['laufend', 'abgeschlossen', 'abgebrochen'], 'Planlauf');
      date(r, 'start', 'Planlauf', false);
    }
    const steps = rows(r.steps, 'Schritte');
    const stepIds = new Set(steps.map((s) => s.id));
    if (steps.length > 2000) fail('Workflow enthält mehr als 2.000 Schritte');
    for (const s of steps) {
      text(s, 'name', 'Schritt');
      text(s, 'roleName', 'Schritt');
      number(s, 'fristTage', 'Schritt');
      oneOf(s, 'typ', ['aufgabe', 'entscheidung', 'sonstiges'], 'Schritt');
      oneOf(s, 'nachweis', ['keine', 'freigabe', 'pruefbericht'], 'Schritt');
      const answers = rows(s.antworten, 'Antworten');
      for (const a of answers) text(a, 'text', 'Antwort');
      for (const target of [s.naechster, ...answers.map((a) => a.ziel)])
        if (target != null && target !== 'ende' && !stepIds.has(target))
          fail('Workflow enthält ein fehlendes Sprungziel');
      if (isRun) {
        oneOf(s, 'status', ['offen', 'laufend', 'erledigt', 'uebersprungen'], 'Schritt');
        date(s, 'sollDatum', 'Schritt');
        date(s, 'istDatum', 'Schritt');
      }
    }
  }
}
