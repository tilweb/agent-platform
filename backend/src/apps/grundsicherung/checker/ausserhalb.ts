/**
 * Grundsicherung — Hinweis „außerhalb des Prüfumfangs" (erster Wurf).
 * Einrichtung/besondere Wohnform, Werkstatt für behinderte Menschen und Selbständigkeit sind
 * fachliche Sonderwelten; die App prüft sie nicht und weist die Sachbearbeitung darauf hin.
 * Spec: docs/grundsicherung-app-spec-2026-09-27.md (Auftrag und Grenzen).
 */
import { EINKOMMENS_ARTEN, type PruefBefund } from '../types';
import { hatEinkommensart, personLabel, type PruefKontext } from './helfer';

export function pruefeAusserhalb(ctx: PruefKontext): PruefBefund[] {
  const gruende: string[] = [];
  if (ctx.vorgang.wohnsituation === 'einrichtung') gruende.push('Wohnen in einer Einrichtung bzw. besonderen Wohnform');
  for (const p of ctx.eg) {
    if (hatEinkommensart(p, EINKOMMENS_ARTEN.wfbm)) gruende.push(`Tätigkeit in einer Werkstatt für behinderte Menschen (${personLabel(p)})`);
    if (hatEinkommensart(p, EINKOMMENS_ARTEN.selbstaendig)) gruende.push(`selbständige Tätigkeit (${personLabel(p)})`);
  }
  if (!gruende.length) return [];
  return [{
    regelId: 'ausserhalb-pruefumfang', kategorie: 'plausibilitaet', typ: 'info',
    titel: 'Teile außerhalb des Prüfumfangs',
    belegtext: `Der Fall enthält ${gruende.join(', ')}. Diese Teile prüft die App nicht automatisch; die Sachbearbeitung prüft Nachweise und Voraussetzungen manuell (§ 42a Abs. 2, 5; § 41 Abs. 3a; § 82 SGB XII).`,
  }];
}
