/** Fortschritt der Posteingang-Auswertung — Hilfen für die Anzeige (Backend: posteingang-fortschritt.ts). */

export const FORTSCHRITT_PHASEN = [
  { phase: 'wartet', label: 'In Warteschlange' },
  { phase: 'laden', label: 'Datei laden' },
  { phase: 'seiten', label: 'Seiten erkennen' },
  { phase: 'trennen', label: 'Dokumente trennen' },
  { phase: 'auslesen', label: 'Dokumente auslesen' },
  { phase: 'abschluss', label: 'Zuordnung vorschlagen' },
];

/** Seit 10 Minuten ohne Fortschritt ⇒ gilt als abgebrochen (wie im Backend). */
export const HAENGT_NACH_MS = 10 * 60 * 1000;

export function fortschrittVon(eingang) {
  return eingang?.data?.fortschritt || null;
}

export function istHaengend(eingang, jetzt = Date.now()) {
  if (eingang?.status !== 'in_analyse') return false;
  const f = fortschrittVon(eingang);
  const t = f ? Date.parse(f.aktualisiert) : NaN;
  return !Number.isFinite(t) || jetzt - t > HAENGT_NACH_MS;
}

/** Laufzeit „m:ss" seit Start. */
export function laufzeit(f, jetzt = Date.now()) {
  const t = f ? Date.parse(f.gestartet) : NaN;
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((jetzt - t) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Anteil 0..1 innerhalb der aktuellen Phase (nur mit Zählern). */
export function anteil(f) {
  return f && f.gesamt ? Math.min(1, Math.max(0, (f.fertig || 0) / f.gesamt)) : null;
}
