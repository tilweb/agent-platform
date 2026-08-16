/**
 * Phase 4 · Governance PROD ↔ PROJ (LIESMICH_ADACOR §3).
 *
 * „Produkt-Instanz schreibt die Engine, Projekt-Instanzen wenden sie an und melden
 * Kandidaten — nie beides gleichzeitig. Genau diese Trennung ist der Grund, warum
 * vier Instanzen dieselbe Qualität liefern."
 *
 *   PROD — schreibt Standards/Prüfer/Engine-Logik; darf Regel-Backlog-Kandidaten
 *          ins Review nehmen und zum STANDARD promoten (scharf schalten).
 *   PROJ — wendet die Verfahren an, meldet Kandidaten (beobachtend), darf aber
 *          KEINEN Kandidaten zum Standard machen und keinen Standard ändern.
 *
 * Rein & deterministisch. Die Instanz-Rolle kommt aus der App-Konfiguration
 * (ENV `ECHOLOOP_ROLLE`, Default PROJ — die sichere Annahme).
 */
import type { KandidatStatus } from './register';

export type InstanzRolle = 'PROD' | 'PROJ';

/** Instanz-Rolle aus der Umgebung; Default PROJ (die sichere Annahme: darf nichts scharf schalten). */
export function instanzRolle(): InstanzRolle {
  return process.env.ECHOLOOP_ROLLE === 'PROD' ? 'PROD' : 'PROJ';
}

/** Nur PROD darf Standards/Prüfer/Engine-Logik ändern. */
export function darfStandardAendern(rolle: InstanzRolle): boolean {
  return rolle === 'PROD';
}

/** Nur PROD darf einen Kandidaten zum STANDARD promoten (scharf schalten). */
export function darfPromoten(rolle: InstanzRolle, ziel: KandidatStatus): boolean {
  if (ziel === 'standard') return rolle === 'PROD';
  return true;                       // beobachten/melden/verwerfen darf auch PROJ
}

export class GovernanceFehler extends Error {}

/** Guard vor einem Backlog-Übergang: wirft, wenn die Rolle den Zielzustand nicht setzen darf. */
export function pruefeGovernance(rolle: InstanzRolle, ziel: KandidatStatus): void {
  if (!darfPromoten(rolle, ziel)) {
    throw new GovernanceFehler(`Rolle ${rolle} darf „${ziel}" nicht setzen — nur die PROD-Instanz schaltet scharf. PROJ meldet Kandidaten, PROD promotet im Review.`);
  }
}
