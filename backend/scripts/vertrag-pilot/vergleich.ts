/**
 * Vergleich Vertragsauswertung ↔ Erwartungswerte (tools/vertrag-golden/erwartet/V<n>.json).
 * Jede Pruefung ist ein Ja/Nein mit Kategorie; die Messung summiert je Kategorie.
 */

import type { VertragsAuswertung } from '../../src/services/extraction/contract/types';

export interface Erwartung {
  parteien?: string[];
  beginn?: string;
  laufzeit_dauer?: string;
  verlaengerung_automatisch?: boolean;
  kuendigung?: { dauer: number; einheit: string };
  unterschriften?: Record<string, boolean>;
  anlagen_fehlen?: string[];
  geregelt?: string[];
  nicht_geregelt?: string[];
  status?: Record<string, string[]>;
  verknuepfung?: string;
  ladepunkte_anzahl?: number;
  entgelt_je_ladepunkt?: number;
  rueckverguetung?: string;
  gestrichen_min?: number;
  kern?: string[];
  befunde_erwartet?: string[];
}

export interface Pruefung { kategorie: 'katalog' | 'unterschriften' | 'status' | 'befunde' | 'erweiterung' | 'inventar' | 'gueltigkeit'; was: string; ok: boolean; ist?: string }

/** „01.11.2022", „1.11.22", „2022-11-01" → „2022-11-01". */
export function normDatum(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})/.exec(s);
  if (m) {
    const j = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    return `${j}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  }
  return null;
}

const klein = (x: unknown) => JSON.stringify(x ?? '').toLowerCase();

export function vergleiche(v: VertragsAuswertung, data: Record<string, unknown>, e: Erwartung): Pruefung[] {
  const p: Pruefung[] = [];
  const k = v.katalog;
  const add = (kategorie: Pruefung['kategorie'], was: string, ok: boolean, ist?: unknown) => p.push({ kategorie, was, ok, ...(ok ? {} : { ist: JSON.stringify(ist ?? null).slice(0, 160) }) });

  const parteien = (k.parteien?.wert ?? []) as Array<{ name?: string; aliasse?: string[] }>;
  for (const name of e.parteien ?? []) add('katalog', `Partei ${name}`, parteien.some((x) => klein([x.name, x.aliasse]).includes(name.toLowerCase())), parteien.map((x) => x.name));
  if (e.beginn) {
    const b = k.beginn?.wert as { datum?: string; regel?: string } | null;
    add('katalog', 'Beginn', normDatum(b?.datum) === e.beginn || normDatum(b?.regel) === e.beginn, b);
  }
  if (e.laufzeit_dauer) {
    const l = k.laufzeit?.wert as { dauer?: string; ende?: string } | null;
    add('katalog', 'Laufzeit', new RegExp(`\\b${e.laufzeit_dauer}\\b`).test(`${l?.dauer ?? ''}`), l);
  }
  if (e.verlaengerung_automatisch !== undefined) {
    const w = k.verlaengerung?.wert as { automatisch?: boolean } | null;
    const ist = k.verlaengerung?.status === 'nicht_geregelt' ? false : w?.automatisch === true;
    add('katalog', 'Verlängerung automatisch', ist === e.verlaengerung_automatisch, k.verlaengerung);
  }
  if (e.kuendigung) {
    const f = (k.kuendigung?.wert as { frist?: { dauer?: number; einheit?: string } } | null)?.frist;
    add('katalog', 'Kündigungsfrist', f?.dauer === e.kuendigung.dauer && f?.einheit === e.kuendigung.einheit, f);
  }
  const us = (k.unterschriften?.wert ?? []) as Array<{ partei?: string; vorhanden?: boolean }>;
  // Schluessel mit Alternativen („Auftragnehmer|END|EMobility") — Rolle oder Name der Partei.
  const passt = (text: string | undefined, schluessel: string) => schluessel.split('|').some((s) => (text ?? '').toLowerCase().includes(s.toLowerCase()));
  for (const [partei, soll] of Object.entries(e.unterschriften ?? {})) {
    const u = us.find((x) => passt(x.partei, partei));
    add('unterschriften', `Unterschrift ${partei} ${soll ? 'vorhanden' : 'fehlt'}`, !!u && (u.vorhanden !== false) === soll, us);
  }
  for (const el of e.geregelt ?? []) add('status', `${el} geregelt`, !!k[el as keyof typeof k] && k[el as keyof typeof k]!.status !== 'nicht_geregelt', k[el as keyof typeof k]?.status);
  for (const el of e.nicht_geregelt ?? []) add('status', `${el} nicht geregelt`, (k[el as keyof typeof k]?.status ?? 'nicht_geregelt') === 'nicht_geregelt', k[el as keyof typeof k]?.status);
  for (const [el, erlaubt] of Object.entries(e.status ?? {})) add('status', `${el} ${erlaubt.join('/')}`, erlaubt.includes(k[el as keyof typeof k]?.status ?? ''), k[el as keyof typeof k]?.status);

  const befunde = v.befunde.filter((b) => b.typ !== 'verarbeitung');
  for (const anl of e.anlagen_fehlen ?? []) add('befunde', `Anlage ${anl} fehlt`, befunde.some((b) => b.typ === 'anlage_fehlt' && new RegExp(`(Anlage|Anhang)\\s+${anl}\\b`, 'i').test(b.text)), befunde.filter((b) => b.typ === 'anlage_fehlt').map((b) => b.text));
  if (e.anlagen_fehlen && !e.anlagen_fehlen.length) add('befunde', 'keine fehlende Anlage gemeldet', !befunde.some((b) => b.typ === 'anlage_fehlt'), befunde.filter((b) => b.typ === 'anlage_fehlt').map((b) => b.text));
  for (const typ of e.befunde_erwartet ?? []) add('befunde', `Befund ${typ}`, befunde.some((b) => b.typ === typ), befunde.map((b) => b.typ));
  if (e.unterschriften && Object.values(e.unterschriften).every(Boolean)) add('befunde', 'kein falscher Befund „Unterschrift fehlt"', !befunde.some((b) => b.typ === 'unterschrift_fehlt'));
  if (e.verknuepfung) add('katalog', `Verknüpfung ${e.verknuepfung}`, v.verknuepfungen.some((x) => x.wert.includes(e.verknuepfung!)), v.verknuepfungen);

  if (e.ladepunkte_anzahl !== undefined) {
    const lp = Array.isArray(data.ladepunkte) ? data.ladepunkte.length : 0;
    add('erweiterung', `Ladepunkte ${e.ladepunkte_anzahl}`, lp === e.ladepunkte_anzahl, lp);
  }
  if (e.entgelt_je_ladepunkt !== undefined) add('erweiterung', `Entgelt je LP ${e.entgelt_je_ladepunkt}`, Number(data.entgelt_je_ladepunkt_monat) === e.entgelt_je_ladepunkt, data.entgelt_je_ladepunkt_monat);
  if (e.rueckverguetung) add('erweiterung', `Rückvergütung ${e.rueckverguetung}`, String(data.rueckverguetung ?? '').includes(e.rueckverguetung), data.rueckverguetung);

  if (e.gestrichen_min !== undefined) add('gueltigkeit', `≥ ${e.gestrichen_min} Streichungen`, v.gueltigkeit.filter((g) => g.art === 'gestrichen').length >= e.gestrichen_min, v.gueltigkeit.length);
  const inventarText = klein([v.inventar.map((i) => [i.inhalt, i.frist?.wortlaut, i.ausloeser, i.bedingung])]);
  const gesamt = `${inventarText} ${klein(v.katalog)}`;
  for (const wort of e.kern ?? []) add('inventar', `Kern „${wort}"`, inventarText.includes(wort.toLowerCase()) || gesamt.includes(wort.toLowerCase()));
  return p;
}
