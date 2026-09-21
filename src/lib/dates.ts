import type { ISODate } from '../domain/types';

/** Formatiert ein ISO-Datum als "14.03.2026". */
export function formatDate(iso: ISODate | null | undefined): string {
  if (!iso) return '–';
  const d = parseISO(iso);
  if (!d) return '–';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Formatiert ein ISO-Datum kurz als "14. Mär". */
export function formatDateShort(iso: ISODate | null | undefined): string {
  if (!iso) return '–';
  const d = parseISO(iso);
  if (!d) return '–';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

export function parseISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]),
    month = Number(m[2]),
    day = Number(m[3]);
  const d = new Date(0);
  d.setFullYear(y, month - 1, day);
  d.setHours(12, 0, 0, 0);
  return y >= 1000 && y <= 9999 && d.getFullYear() === y && d.getMonth() === month - 1 && d.getDate() === day
    ? d
    : null;
}

export function toISO(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): ISODate {
  return toISO(new Date());
}

/** Differenz in Kalendertagen (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  const da = parseISO(a);
  const db = parseISO(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * Addiert Tage auf ein Datum. Mit `arbeitstage` werden Wochenenden und
 * projektbezogene Feiertage übersprungen.
 */
export function addDays(iso: ISODate, tage: number, arbeitstage = false, feiertage: ISODate[] = []): ISODate {
  const d = parseISO(iso);
  if (!d) return iso;
  // Endliche, ganze Tage verhindern Endlosschleifen bei Dezimalwerten oder Infinity.
  const anzahl = Number.isFinite(tage) ? Math.max(-36500, Math.min(36500, Math.trunc(tage))) : 0;
  if (!arbeitstage) {
    d.setDate(d.getDate() + anzahl);
    return toISO(d);
  }
  const holidays = new Set(feiertage);
  let rest = Math.abs(anzahl);
  const schritt = anzahl >= 0 ? 1 : -1;
  while (rest > 0) {
    d.setDate(d.getDate() + schritt);
    if (!isWeekend(d) && !holidays.has(toISO(d))) rest--;
  }
  return toISO(d);
}

/** "1 Tag" / "5 Tage" */
export function tageLabel(anzahl: number): string {
  return `${anzahl} ${Math.abs(anzahl) === 1 ? 'Tag' : 'Tage'}`;
}

/** "in 3 Tagen", "heute", "seit 2 Tagen überfällig" */
export function relativeLabel(iso: ISODate | null): string {
  if (!iso) return 'kein Termin';
  const delta = diffDays(today(), iso);
  if (delta === 0) return 'heute fällig';
  if (delta === 1) return 'morgen fällig';
  if (delta === -1) return '1 Tag überfällig';
  if (delta < 0) return `${Math.abs(delta)} Tage überfällig`;
  return `in ${delta} Tagen`;
}
