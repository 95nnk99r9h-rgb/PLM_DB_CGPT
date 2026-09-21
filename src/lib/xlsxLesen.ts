/**
 * Lesen von Excel-Arbeitsmappen (.xlsx) und Textlisten (.csv) im Browser –
 * ohne externe Abhängigkeit.
 *
 * Die ZIP-Einträge einer Arbeitsmappe sind in der Regel mit „deflate“ gepackt;
 * ausgepackt wird mit der im Browser eingebauten DecompressionStream-Schnittstelle.
 */

import { parseISO } from './dates';

const MAX_FILE = 20_000_000;
const MAX_XML = 20_000_000;
const MAX_ROWS = 10_000;
const MAX_COLUMNS = 256;
const MAX_CELLS = 500_000;
function pruefeDatei(datei: File) {
  if (datei.size > MAX_FILE) throw new Error('Die Importdatei darf höchstens 20 MB groß sein.');
}
function xmlLesen(text: string): XMLDocument {
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error('XML-Deklarationen mit Entitäten werden nicht unterstützt.');
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('Die Excel-Datei enthält ungültiges XML.');
  return xml;
}

export interface GeleseneTabelle {
  name: string;
  /** Erste Zeile sind die Spaltenüberschriften. */
  zeilen: string[][];
}

/* ----------------------------- ZIP ------------------------------- */

interface ZipEintrag {
  name: string;
  methode: number;
  offset: number;
  groesse: number;
  entpackt: number;
}

function leseZipVerzeichnis(daten: DataView): ZipEintrag[] {
  // Ende des Zentralverzeichnisses von hinten suchen
  let eocd = -1;
  for (let i = daten.byteLength - 22; i >= 0 && i > daten.byteLength - 66_000; i--) {
    if (daten.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Die Datei ist keine gültige Excel-Datei (ZIP-Ende fehlt).');

  const anzahl = daten.getUint16(eocd + 10, true);
  if (anzahl > 2048) throw new Error('Die Excel-Datei enthält zu viele ZIP-Einträge.');
  let gesamt = 0;
  const bounds = (start: number, size: number) => {
    if (start < 0 || size < 0 || start + size > daten.byteLength)
      throw new Error('Die Excel-Datei ist beschädigt (ungültiger ZIP-Bereich).');
  };
  let pos = daten.getUint32(eocd + 16, true);
  const eintraege: ZipEintrag[] = [];
  const decoder = new TextDecoder();

  for (let i = 0; i < anzahl; i++) {
    bounds(pos, 46);
    if (daten.getUint32(pos, true) !== 0x02014b50) throw new Error('Ungültiges ZIP-Verzeichnis.');
    if (daten.getUint16(pos + 8, true) & 1)
      throw new Error('Verschlüsselte Dateien werden nicht unterstützt.');
    const methode = daten.getUint16(pos + 10, true);
    const groesse = daten.getUint32(pos + 20, true);
    const entpackt = daten.getUint32(pos + 24, true);
    gesamt += entpackt;
    if (entpackt > MAX_XML || gesamt > 100_000_000)
      throw new Error('Die entpackte Arbeitsmappe ist zu groß.');
    const nameLaenge = daten.getUint16(pos + 28, true);
    const extraLaenge = daten.getUint16(pos + 30, true);
    const kommentarLaenge = daten.getUint16(pos + 32, true);
    const offset = daten.getUint32(pos + 42, true);
    bounds(pos + 46, nameLaenge + extraLaenge + kommentarLaenge);
    const name = decoder.decode(new Uint8Array(daten.buffer, daten.byteOffset + pos + 46, nameLaenge));
    bounds(offset, 30);
    eintraege.push({ name, methode, offset, groesse, entpackt });
    pos += 46 + nameLaenge + extraLaenge + kommentarLaenge;
  }
  return eintraege;
}

async function entpacke(puffer: ArrayBuffer, daten: DataView, eintrag: ZipEintrag): Promise<string> {
  if (daten.getUint32(eintrag.offset, true) !== 0x04034b50) throw new Error('Ungültiger ZIP-Eintrag.');
  const nameLaenge = daten.getUint16(eintrag.offset + 26, true);
  const extraLaenge = daten.getUint16(eintrag.offset + 28, true);
  const start = eintrag.offset + 30 + nameLaenge + extraLaenge;
  if (start + eintrag.groesse > puffer.byteLength) throw new Error('Beschädigte Excel-Datei.');
  const roh = new Uint8Array(puffer, start, eintrag.groesse);

  if (eintrag.methode === 0) {
    if (roh.length > MAX_XML || roh.length !== eintrag.entpackt)
      throw new Error('Ungültige Größe des ZIP-Eintrags.');
    return new TextDecoder().decode(roh);
  }
  if (eintrag.methode !== 8) throw new Error('Die Datei verwendet ein nicht unterstütztes Packverfahren.');

  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Dieser Browser kann keine Excel-Dateien entpacken – bitte die Liste als CSV speichern.');
  }
  const strom = new Blob([roh]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = strom.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_XML || bytes > eintrag.entpackt)
        throw new Error('Entpackter ZIP-Eintrag überschreitet die zulässige Größe.');
      chunks.push(decoder.decode(value, { stream: true }));
    }
    if (bytes !== eintrag.entpackt) throw new Error('Die Excel-Datei ist unvollständig.');
    chunks.push(decoder.decode());
    return chunks.join('');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/* ---------------------------- XLSX ------------------------------- */

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

/** Spaltenname zu Index: A → 0, AA → 26. */
function spaltenIndex(ref: string): number {
  const buchstaben = /^([A-Z]+)/.exec(ref)?.[1] ?? 'A';
  let index = 0;
  for (const z of buchstaben) index = index * 26 + (z.charCodeAt(0) - 64);
  if (index < 1 || index > MAX_COLUMNS) throw new Error('Die Tabelle darf höchstens 256 Spalten enthalten.');
  return index - 1;
}

function textVon(el: Element | null): string {
  if (!el) return '';
  return Array.from(el.getElementsByTagNameNS(NS, 't'))
    .map((t) => t.textContent ?? '')
    .join('');
}

/** Liest alle Tabellenblätter einer Arbeitsmappe. */
export async function xlsxLesen(datei: File): Promise<GeleseneTabelle[]> {
  pruefeDatei(datei);
  const puffer = await datei.arrayBuffer();
  const daten = new DataView(puffer);
  const eintraege = leseZipVerzeichnis(daten);
  const finde = (name: string) => eintraege.find((e) => e.name === name);

  // Gemeinsame Zeichenketten
  const geteilt: string[] = [];
  const sharedEintrag = finde('xl/sharedStrings.xml');
  if (sharedEintrag) {
    const xml = xmlLesen(await entpacke(puffer, daten, sharedEintrag));
    for (const si of Array.from(xml.getElementsByTagNameNS(NS, 'si'))) geteilt.push(textVon(si));
  }

  // Blattnamen in der Reihenfolge der Mappe
  const namen: string[] = [];
  const sheetPaths: string[] = [];
  const relEntry = finde('xl/_rels/workbook.xml.rels');
  const rels = relEntry ? xmlLesen(await entpacke(puffer, daten, relEntry)) : null;
  const wbEintrag = finde('xl/workbook.xml');
  if (wbEintrag) {
    const xml = xmlLesen(await entpacke(puffer, daten, wbEintrag));
    for (const sheet of Array.from(xml.getElementsByTagNameNS(NS, 'sheet'))) {
      namen.push(sheet.getAttribute('name') ?? `Tabelle${namen.length + 1}`);
      const id = sheet.getAttributeNS(
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'id',
      );
      const rel = Array.from(rels?.getElementsByTagName('Relationship') ?? []).find(
        (r) => r.getAttribute('Id') === id,
      );
      const target = rel?.getAttribute('Target');
      sheetPaths.push(
        target ? new URL(target, 'https://xlsx.invalid/xl/workbook.xml').pathname.slice(1) : '',
      );
    }
  }

  const fallbackSheets = eintraege
    .filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name))
    .sort((a, b) => Number(/(\d+)/.exec(a.name)![1]) - Number(/(\d+)/.exec(b.name)![1]));

  const blattEintraege =
    sheetPaths.length && sheetPaths.every((p) => finde(p))
      ? sheetPaths.map((p) => finde(p)!)
      : fallbackSheets;
  if (!blattEintraege.length) throw new Error('Die Datei enthält keine lesbaren Tabellenblätter.');
  const tabellen: GeleseneTabelle[] = [];
  let cellCount = 0;
  for (let i = 0; i < blattEintraege.length; i++) {
    const xml = xmlLesen(await entpacke(puffer, daten, blattEintraege[i]));
    const zeilen: string[][] = [];

    for (const row of Array.from(xml.getElementsByTagNameNS(NS, 'row'))) {
      const zeile: string[] = [];
      for (const c of Array.from(row.getElementsByTagNameNS(NS, 'c'))) {
        if (++cellCount > MAX_CELLS) throw new Error('Die Arbeitsmappe enthält mehr als 500.000 Zellen.');
        const spalte = spaltenIndex(c.getAttribute('r') ?? 'A');
        const typ = c.getAttribute('t');
        let wert = '';
        if (typ === 's') {
          const v = c.getElementsByTagNameNS(NS, 'v')[0];
          wert = geteilt[Number(v?.textContent ?? '0')] ?? '';
        } else if (typ === 'inlineStr') {
          wert = textVon(c.getElementsByTagNameNS(NS, 'is')[0] ?? null);
        } else {
          wert = c.getElementsByTagNameNS(NS, 'v')[0]?.textContent ?? '';
        }
        while (zeile.length < spalte) zeile.push('');
        zeile[spalte] = wert.trim();
      }
      if (zeile.some((z) => z !== '')) zeilen.push(zeile);
      if (zeilen.length > MAX_ROWS) throw new Error('Die Tabelle darf höchstens 10.000 Zeilen enthalten.');
    }

    tabellen.push({ name: namen[i] ?? `Tabelle${i + 1}`, zeilen });
  }
  return tabellen;
}

/* ----------------------------- CSV ------------------------------- */

/** Liest eine Textliste; Trennzeichen wird erkannt (Semikolon, Komma, Tabulator). */
export async function csvLesen(datei: File): Promise<GeleseneTabelle[]> {
  pruefeDatei(datei);
  const text = (await datei.text()).replace(/^\uFEFF/, '');
  const counts = new Map([
    [';', 0],
    ['\t', 0],
    [',', 0],
  ]);
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted && (text[i] === '\r' || text[i] === '\n')) break;
    else if (!quoted && counts.has(text[i])) counts.set(text[i], counts.get(text[i])! + 1);
  }
  const trenner = [...counts].sort((a, b) => b[1] - a[1])[0][0];

  const zeilen: string[][] = [];
  let feld = '';
  let zeile: string[] = [];
  let inAnfuehrung = false;

  for (let i = 0; i < text.length; i++) {
    const z = text[i];
    if (inAnfuehrung) {
      if (z === '"' && text[i + 1] === '"') {
        feld += '"';
        i++;
      } else if (z === '"') inAnfuehrung = false;
      else feld += z;
      continue;
    }
    if (z === '"') inAnfuehrung = true;
    else if (z === trenner) {
      zeile.push(feld.trim());
      feld = '';
    } else if (z === '\n') {
      zeile.push(feld.trim());
      if (zeile.some((f) => f !== '')) zeilen.push(zeile);
      zeile = [];
      feld = '';
    } else if (z !== '\r') feld += z;
  }
  if (inAnfuehrung) throw new Error('Die CSV-Datei enthält ein nicht geschlossenes Anführungszeichen.');
  zeile.push(feld.trim());
  if (zeile.some((f) => f !== '')) zeilen.push(zeile);

  if (
    zeilen.length > MAX_ROWS ||
    zeilen.some((z) => z.length > MAX_COLUMNS) ||
    zeilen.reduce((n, z) => n + z.length, 0) > MAX_CELLS
  )
    throw new Error(
      'Die CSV-Datei überschreitet die Grenze von 10.000 Zeilen, 256 Spalten oder 500.000 Zellen.',
    );
  return [{ name: datei.name, zeilen }];
}

/** Liest .xlsx oder .csv anhand der Dateiendung. */
export async function tabelleLesen(datei: File): Promise<GeleseneTabelle[]> {
  if (/\.csv$/i.test(datei.name) || /\.txt$/i.test(datei.name)) return csvLesen(datei);
  if (!/\.xlsx$/i.test(datei.name)) throw new Error('Bitte eine .xlsx- oder .csv-Datei auswählen.');
  return xlsxLesen(datei);
}

/**
 * Ordnet die Spalten einer Tabelle den erwarteten Feldern zu. Groß-/Klein-
 * schreibung, Umlaute und Leerzeichen werden dabei ignoriert.
 */
export function spaltenZuordnen(kopf: string[], felder: Record<string, string[]>): Record<string, number> {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]/g, '');

  const kopfNorm = kopf.map(norm);
  const zuordnung: Record<string, number> = {};
  for (const [feld, bezeichnungen] of Object.entries(felder)) {
    const index = kopfNorm.findIndex((k) => bezeichnungen.some((b) => norm(b) === k));
    if (index >= 0) zuordnung[feld] = index;
  }
  return zuordnung;
}

/** Wandelt gebräuchliche Datumsangaben in ein ISO-Datum. */
export function datumLesen(wert: string): string | null {
  const text = wert.trim();
  if (!text) return null;
  // Excel speichert Datumsangaben als Tageszahl seit dem 30.12.1899
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const tage = Number(text);
    const d = new Date(Date.UTC(1899, 11, 30) + tage * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  const de = /^(\d{1,2})[.](\d{1,2})[.](\d{2,4})$/.exec(text);
  if (de) {
    const jahr = de[3].length === 2 ? `20${de[3]}` : de[3];
    const iso = `${jahr}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`;
    return parseISO(iso) ? iso : null;
  }
  if (parseISO(text)) return text;
  return null;
}
