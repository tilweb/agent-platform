/**
 * DP-Qualitaetssuite — Baseline, Rauschband, Schwelle und Bericht (Spezifikation §5).
 */

import type { FallBewertung, SetMetriken } from './bewertung';
import type { Schwellen } from './korpus';

export interface SetBaseline {
  metriken: SetMetriken;
  /** Halbe Spannweite je Quote aus Wiederholungslaeufen (Prozentpunkte). */
  rauschband: Record<string, number>;
  /** Je Fall die kritischen Feldpfade, die in der Baseline richtig waren. */
  kritischRichtig: Record<string, string[]>;
}

export interface Baseline { erstellt: string; lauf: string; commit: string; modell: string; sets: Record<string, SetBaseline> }

export interface Urteil { harte: string[]; warnungen: string[] }

const STANDARD: Required<Schwellen> = { rueckgang_pp: 1, kosten_anstieg: 0.15 };

export function kritischRichtigJeFall(bewertungen: FallBewertung[]): Record<string, string[]> {
  return Object.fromEntries(bewertungen.map((b) => [b.id, b.felder.filter((f) => f.kritisch && f.ok).map((f) => f.pfad)]));
}

/** Rauschband aus mehreren Laeufen derselben Version: halbe Spannweite je Quote. */
export function rauschbandAus(laeufe: SetMetriken[]): Record<string, number> {
  const out: Record<string, number> = {};
  const schluessel = new Set(laeufe.flatMap((m) => Object.keys(m.quoten)));
  for (const k of schluessel) {
    const werte = laeufe.map((m) => m.quoten[k]).filter((x): x is number => typeof x === 'number');
    if (werte.length >= 2) out[k] = Math.round(((Math.max(...werte) - Math.min(...werte)) / 2) * 10) / 10;
  }
  return out;
}

/** Vergleich eines Set-Ergebnisses mit seiner Baseline. */
export function beurteile(
  setId: string, aktuell: SetMetriken, bewertungen: FallBewertung[], basis: SetBaseline | undefined, schwellen: Schwellen = {},
): Urteil {
  const s = { ...STANDARD, ...schwellen };
  const harte: string[] = [];
  const warnungen: string[] = [];
  if (aktuell.ausfaelle > 0) harte.push(`${setId}: ${aktuell.ausfaelle} Fall/Fälle ohne Ergebnis (Ausfall)`);
  if (!basis) {
    warnungen.push(`${setId}: keine Baseline — Ergebnis nur zur Kenntnis (mit --als-baseline festschreiben)`);
    return { harte, warnungen };
  }
  for (const [k, wert] of Object.entries(aktuell.quoten)) {
    const alt = basis.metriken.quoten[k];
    if (typeof wert !== 'number' || typeof alt !== 'number') continue;
    const erlaubt = Math.max(basis.rauschband[k] ?? 0, s.rueckgang_pp);
    if (alt - wert > erlaubt) harte.push(`${setId}: ${k} ${alt} % → ${wert} % (−${(alt - wert).toFixed(1)} pp, erlaubt ${erlaubt} pp)`);
  }
  // Kritische Felder: was in der Baseline richtig war, darf nicht kippen.
  for (const b of bewertungen) {
    const vorher = new Set(basis.kritischRichtig[b.id] ?? []);
    for (const f of b.felder) {
      if (f.kritisch && !f.ok && vorher.has(f.pfad)) harte.push(`${setId}/${b.id}: kritisches Feld ${f.pfad} gekippt (erwartet ${JSON.stringify(f.erwartet)}, ist ${JSON.stringify(f.ist)})`);
    }
  }
  const anstieg = (neu: number, alt: number) => (alt > 0 ? (neu - alt) / alt : 0);
  const kb = basis.metriken.betrieb;
  if (anstieg(aktuell.betrieb.tokensJeSeite, kb.tokensJeSeite) > s.kosten_anstieg) warnungen.push(`${setId}: Tokens je Seite ${kb.tokensJeSeite} → ${aktuell.betrieb.tokensJeSeite}`);
  if (anstieg(aktuell.betrieb.sekundenJeSeite, kb.sekundenJeSeite) > s.kosten_anstieg) warnungen.push(`${setId}: Sekunden je Seite ${kb.sekundenJeSeite} → ${aktuell.betrieb.sekundenJeSeite}`);
  if (aktuell.zaehler.sicherAberFalsch > basis.metriken.zaehler.sicherAberFalsch) warnungen.push(`${setId}: „sicher aber falsch" ${basis.metriken.zaehler.sicherAberFalsch} → ${aktuell.zaehler.sicherAberFalsch}`);
  if (aktuell.zaehler.fehlschnitte > basis.metriken.zaehler.fehlschnitte) warnungen.push(`${setId}: Fehlschnitte ${basis.metriken.zaehler.fehlschnitte} → ${aktuell.zaehler.fehlschnitte}`);
  return { harte, warnungen };
}

const fmt = (x: number | null | undefined) => (typeof x === 'number' ? `${x.toFixed(1)} %` : '–');

export function berichtMarkdown(kopf: { lauf: string; commit: string; modell: string; umfang: string; split: string }, sets: Array<{
  id: string; name: string; metriken: SetMetriken; basis?: SetBaseline; urteil: Urteil; bewertungen: FallBewertung[];
}>): string {
  const zeilen: string[] = [
    `# DP-Qualitätssuite — Lauf ${kopf.lauf}`,
    '',
    `Commit ${kopf.commit} · Modell ${kopf.modell} · Umfang ${kopf.umfang} · Split ${kopf.split}`,
    '',
  ];
  const harte = sets.flatMap((s) => s.urteil.harte);
  zeilen.push(harte.length ? `**Ergebnis: NICHT BESTANDEN** (${harte.length} harte Abweichung(en))` : '**Ergebnis: bestanden**', '');
  for (const s of sets) {
    const m = s.metriken;
    zeilen.push(`## ${s.name} (${s.id}) — ${m.faelle} Fälle${m.ausfaelle ? `, ${m.ausfaelle} Ausfall/Ausfälle` : ''}`, '');
    zeilen.push('| Metrik | aktuell | Baseline | Δ | Rauschband |', '|---|---|---|---|---|');
    for (const [k, v] of Object.entries(m.quoten)) {
      if (v === null) continue;
      const alt = s.basis?.metriken.quoten[k];
      const d = typeof alt === 'number' ? `${v - alt >= 0 ? '+' : ''}${(v - alt).toFixed(1)}` : '–';
      zeilen.push(`| ${k} | ${fmt(v)} | ${fmt(alt)} | ${d} | ${s.basis?.rauschband[k] ?? '–'} |`);
    }
    const b = m.betrieb;
    zeilen.push('', `Betrieb: ${b.sekundenJeSeite} s/Seite · ${b.tokensJeSeite} Tokens/Seite · ${b.aufrufeJeSeite} Aufrufe/Seite · „sicher aber falsch" ${m.zaehler.sicherAberFalsch} · Fehlschnitte ${m.zaehler.fehlschnitte}`, '');
    for (const h of s.urteil.harte) zeilen.push(`- ✗ ${h}`);
    for (const w of s.urteil.warnungen) zeilen.push(`- ⚠ ${w}`);
    const schwach = Object.entries(m.jeFeld).filter(([, p]) => p < 100).sort((a, b) => a[1] - b[1]).slice(0, 10);
    if (schwach.length) zeilen.push('', 'Schwächste Felder: ' + schwach.map(([k, p]) => `${k} ${p} %`).join(' · '));
    const fehlerFaelle = s.bewertungen.filter((x) => x.fehler);
    if (fehlerFaelle.length) zeilen.push('', 'Ausfälle: ' + fehlerFaelle.map((x) => `${x.id} (${x.fehler})`).join(' · '));
    zeilen.push('');
  }
  return zeilen.join('\n');
}
