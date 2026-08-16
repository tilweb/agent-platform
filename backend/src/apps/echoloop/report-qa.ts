/**
 * Artefakt-QA-Gate (Übergabe Gate B, §3.3 „das Ergebnis prüft sich selbst").
 *
 * Prüft einen Baustand VOR der Freigabe/Auslieferung auf seine Pflicht-Elemente
 * (Vertrag am Artefakt). Semantik wie der v3.11-Selbsttest:
 *   · Pflicht-Verstoß  → verdikt FAIL — kein ungeprüftes Ergebnis wird freigegeben.
 *   · Weiche Lücke     → verdikt TEIL — „ein Teil-Vertrag ist kein PASS".
 *   · alles grün       → verdikt VOLL.
 *
 * Anmerkung zur Domäne: der PAKET_2-Skill `/uebergabe` ist die Session-Übergabe
 * (Staffelstab-Register) — allgemeiner Workflow, NICHT Echo-Loop. Dieses Gate ist
 * die fachlich passende Hälfte: die Selbstprüfung des RGA-Artefakts.
 *
 * Rein & deterministisch (kein LLM, kein Browser-Render — wir prüfen die Baustand-
 * Daten, aus denen der Report entsteht, statt das gerenderte HTML).
 */
import { ALL_DIMS } from './scoring';
import type { Baustand } from './types';

export type QaVerdikt = 'VOLL' | 'TEIL' | 'FAIL';

export interface QaPruefung {
  name: string;
  ok: boolean;
  pflicht: boolean;        // Pflicht → Verstoß = FAIL; sonst weich → TEIL
  hinweis?: string;
}

export interface ReportQa {
  verdikt: QaVerdikt;
  pruefungen: QaPruefung[];
  verstoesse: string[];
}

/** Prüft den Baustand gegen den Artefakt-Vertrag. */
export function reportQa(baustand: Baustand): ReportQa {
  const p: QaPruefung[] = [];

  // 1 · Kennzahlen vorhanden (Pflicht) — RG/RGQ/SE müssen berechnet sein.
  const k = baustand.kennzahlen;
  p.push({
    name: 'Kennzahlen (RG · RGQ · SE)',
    ok: !!k && [k.gesamtRg, k.rgq, k.seQuotient].every((v) => typeof v === 'number'),
    pflicht: true,
  });

  // 2 · Reifegradprofil vollständig (Pflicht) — alle D1–D10+D6b mit Ist-Level.
  const dims = baustand.dimensionen ?? {};
  const fehlend = ALL_DIMS.filter((d) => !dims[d] || typeof dims[d].ist !== 'number');
  p.push({
    name: 'Reifegradprofil D1–D10+D6b',
    ok: fehlend.length === 0,
    pflicht: true,
    hinweis: fehlend.length ? `fehlende Dimensionen: ${fehlend.map((d) => d.toUpperCase()).join(', ')}` : undefined,
  });

  // 3 · Evidenz-Disziplin (Pflicht) — maskierte Dimension nur mit Owner-Begründung, nie als 0.
  const maskeOhneGrund = ALL_DIMS.filter((d) => dims[d]?.relevanz === 0 && !dims[d]?.maskeGrund);
  p.push({
    name: 'Maskierte Dimensionen belegt (r=0 ⇒ Begründung)',
    ok: maskeOhneGrund.length === 0,
    pflicht: true,
    hinweis: maskeOhneGrund.length ? `ohne Begründung maskiert: ${maskeOhneGrund.map((d) => d.toUpperCase()).join(', ')}` : undefined,
  });

  // 4 · Analyse-Tiefe deklariert (Seite-1-Prinzip) — weich: fehlt sie, ist es ein Teil-Vertrag.
  p.push({
    name: 'Analyse-Tiefe deklariert (Seite-1-Prinzip)',
    ok: !!baustand.analyseTiefe,
    pflicht: false,
    hinweis: baustand.analyseTiefe ? undefined : 'keine Tiefe deklariert — der Bericht verspricht mehr, als er ausweist',
  });

  // 5 · Kundenfassung bei Freigabe (weich) — ein freigegebener Stand sollte ein Narrativ tragen.
  if (baustand.status === 'freigegeben') {
    p.push({
      name: 'Kundenfassung (Narrativ) bei Freigabe',
      ok: !!baustand.narrativ,
      pflicht: false,
      hinweis: baustand.narrativ ? undefined : 'freigegeben ohne Kundenfassung — nachziehen',
    });
  }

  const verstoesse = p.filter((x) => !x.ok).map((x) => `${x.name}${x.hinweis ? ` (${x.hinweis})` : ''}`);
  const hartGefallen = p.some((x) => x.pflicht && !x.ok);
  const weichGefallen = p.some((x) => !x.pflicht && !x.ok);
  const verdikt: QaVerdikt = hartGefallen ? 'FAIL' : weichGefallen ? 'TEIL' : 'VOLL';

  return { verdikt, pruefungen: p, verstoesse };
}
