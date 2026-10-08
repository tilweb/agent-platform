/**
 * Ende-zu-Ende-Pruefung der Strategie `contract-structured` ueber den echten
 * DP-Pfad: Projekt (lokale DB) anlegen → `extract()` → Ergebnis pruefen →
 * Projekt wieder loeschen. Echte Modellaufrufe (Adacor Qwen 3.5).
 *
 *   bun run scripts/vertrag-pilot/e2e.ts [V1]
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { createProject, deleteProject } from '../../src/extraction/learning/projects';
import { extract } from '../../src/extraction/learning/service';
import type { ProjectField } from '../../src/extraction/learning/types';

const GOLDEN = join(import.meta.dir, '..', '..', '..', 'tools', 'vertrag-golden');
const id = (process.argv[2] ?? 'V1').toUpperCase();
const zuordnung = await Bun.file(join(GOLDEN, 'erwartet', 'zuordnung.json')).json() as Record<string, string>;
const pfad = join(homedir(), 'Downloads', 'Vertragsbeispiele-Ehinger-END', zuordnung[id]!);

const felder: Record<string, ProjectField> = {
  ladepunkte: { type: 'list', required: false, label: 'Ladepunkte', description: 'Je Ladepunkt eine Zeile, meist Tabelle in Anlage 1', item_fields: {
    evse_id: { type: 'text', label: 'EVSE-ID' }, hersteller: { type: 'text', label: 'Hersteller' },
  } },
  entgelt_je_ladepunkt_monat: { type: 'number', required: false, label: 'Entgelt je Ladepunkt und Monat (EUR)' },
};

const projekt = await createProject({
  name: `Vertrag E2E ${Date.now().toString(36)}`,
  description: 'Temporäres Testprojekt (wird gelöscht)',
  fields: felder,
  extraction: { strategy: 'contract-structured' },
});
let ok = true;
const pruefe = (was: string, bedingung: boolean, ist?: unknown) => {
  if (!bedingung) ok = false;
  console.log(`${bedingung ? '✓' : '✗'} ${was}${bedingung ? '' : ` — ist ${JSON.stringify(ist).slice(0, 200)}`}`);
};
try {
  const t0 = performance.now();
  const r = await extract(projekt.id, { type: 'file', path: pfad, filename: `${id}.pdf` }, 'vertrag-e2e');
  console.log(`extract(): ${((performance.now() - t0) / 1000).toFixed(0)} s, Strategie ${r.strategyUsed}`);
  pruefe('success', r.success, r.error);
  pruefe('strategyUsed contract-structured', r.strategyUsed === 'contract-structured', r.strategyUsed);
  pruefe('vertrag vorhanden', !!r.vertrag);
  pruefe('Klauselbaum', (r.vertrag?.klauseln.length ?? 0) > 10, r.vertrag?.klauseln.length);
  pruefe('Katalog Kündigung', r.vertrag?.katalog.kuendigung?.status === 'gefunden', r.vertrag?.katalog.kuendigung);
  pruefe('Inventar', (r.vertrag?.inventar.length ?? 0) > 10, r.vertrag?.inventar.length);
  pruefe('Profilfeld ladepunkte (Liste)', Array.isArray(r.data.ladepunkte) && (r.data.ladepunkte as unknown[]).length > 0, r.data.ladepunkte);
  pruefe('Profilfeld entgelt_je_ladepunkt_monat', r.data.entgelt_je_ladepunkt_monat === 20, r.data.entgelt_je_ladepunkt_monat);
  pruefe('Seitenbilder', (r.pageImages?.length ?? 0) > 0, r.pageImages?.length);
  pruefe('document_text aus Transkription', r.document_text.includes('[§6'), r.document_text.slice(0, 120));
  pruefe('Befunde als validations (vertrag-*)', (r.validations ?? []).some((v) => v.rule_id.startsWith('vertrag-')), r.validations?.map((v) => v.rule_id));
  pruefe('audit.strategy', r.audit?.strategy === 'contract-structured', r.audit);
} finally {
  await deleteProject(projekt.id);
}
process.exit(ok ? 0 : 1);
