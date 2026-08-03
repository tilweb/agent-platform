/**
 * Virtuelle Public-API-Apps (Welle 5).
 *
 * Das Public-API-Framework liest seine Functions bisher ausschliesslich aus der
 * App-Registry (`apps/registry.ts`). Kern-Features ohne eigene App — die
 * Dokumenten-Extraktion ist der erste Fall — koennen dort nicht sauber
 * andocken: Ein Registry-Eintrag erzeugt ueber die Sidebar automatisch einen
 * Navigationseintrag auf `/apps/<id>`, der ins Leere fuehrt, und eine DB-Zeile,
 * die ein Admin versehentlich deaktivieren kann.
 *
 * Virtuelle Apps existieren daher nur im Code: kein Registry-Eintrag, kein
 * Sidebar-Link, keine Migration — aber sie erscheinen in Discovery, OpenAPI und
 * im Permissions-Katalog der API-Key-Verwaltung wie jede andere App.
 *
 * Sie werden bewusst NICHT als Agenten-Tools registriert (das macht
 * `tools/index.ts` nur fuer echte Registry-Apps) — sonst waechst die Tool-Liste
 * jedes Agenten um vier selten gebrauchte Eintraege.
 */

import type { AppConfig } from '../apps/types';
import { getApps } from '../apps/registry';
import { extractionPublicFunctions } from '../extraction/public-functions';

/** Ist die Extraktions-API per ENV abgeschaltet? (Default: an) */
function extractionApiEnabled(): boolean {
  return process.env.EXTRACTION_PUBLIC_API !== '0';
}

const extractionVirtualApp: AppConfig = {
  id: 'extraktion',
  name: 'Dokumenten-Extraktion',
  description: 'Strukturierte Felder aus Dokumenten ziehen — einzeln oder als Stapel, mit Konfidenzen, Review-Vorschlag und fachlichen Pruefregeln.',
  icon: 'extraction',
  version: '1.0.0',
  enabled: true,
  routes: [],
  publicFunctions: extractionPublicFunctions,
};

/** Alle virtuellen Apps (ENV-gefiltert). */
export function getVirtualApps(): AppConfig[] {
  return extractionApiEnabled() ? [extractionVirtualApp] : [];
}

/**
 * Registry-Apps + virtuelle Apps — die Quelle fuer Discovery, Dispatch,
 * OpenAPI und Permissions-Katalog.
 */
export async function listPublicApps(): Promise<AppConfig[]> {
  const apps = await getApps();
  return [...apps, ...getVirtualApps()];
}
