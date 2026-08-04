/**
 * Ehinger-Pilot: flaches XLSX im Zielformat des heutigen n8n-Workflows —
 * eine Zeile je Position, Kopfdaten wiederholt, Prüfergebnisse als Spalten.
 *
 * Nutzt denselben `generateDocument`-Baustein wie der Produkt-Export. Zeigt,
 * dass das von EMMA erwartete Format erreichbar ist; als Produktfunktion fehlt
 * bislang nur der flache Modus (siehe Ergebnisdokument, "Luecken").
 *
 *   /Users/andreasbachmann/.bun/bin/bun run ../tools/ehinger-pilot/flat.ts
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { generateDocument } from '../../backend/src/services/documentGenerator';

const DIR = import.meta.dir;

const HEADERS = [
  'Datei', 'Lieferant', 'Seiten', 'Pruefstatus',
  'Referenznummer', 'Lieferscheinnummer', 'Lieferdatum', 'Handschrift',
  'Positionsnummer', 'Artikelnummer', 'Menge bestellt', 'Menge geliefert', 'Einheit', 'Beschreibung',
];

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nein';
  return String(v);
};

async function main() {
  const run = JSON.parse(await readFile(resolve(DIR, 'results/run.json'), 'utf-8')) as any[];
  const rows: string[][] = [];

  for (const r of run) {
    const vendor = String(r.klassifikation.project_id ?? 'nicht zugeordnet').replace('ehinger-pilot-', '');
    const d = r.extraktion?.data ?? {};
    const befunde = (r.extraktion?.validations ?? []) as Array<{ severity: string; message: string }>;
    const status = r.fehler
      ? `Fehler: ${r.fehler}`
      : !r.extraktion
        ? 'kein Hauptlieferant — manuelle Zuordnung'
        : befunde.some((b) => b.severity === 'error') ? 'zu pruefen' : 'ok';

    const kopf = [
      r.beleg, vendor, String(r.seiten || ''), status,
      cell(d.referenznummer), cell(d.lieferscheinnummer), cell(d.lieferdatum), cell(d.handschriftliche_aenderung),
    ];

    const positionen: any[] = Array.isArray(d.positionen) ? d.positionen : [];
    if (positionen.length === 0) {
      rows.push([...kopf, '', '', '', '', '', '']);
      continue;
    }
    for (const p of positionen) {
      rows.push([
        ...kopf,
        cell(p.positionsnummer), cell(p.artikelnummer),
        cell(p.menge_bestellt), cell(p.menge_geliefert), cell(p.einheit),
        cell(p.beschreibung).replace(/\n/g, ' '),
      ]);
    }
  }

  const buffer = await generateDocument(
    {
      title: 'Ehinger Lieferscheine — Extraktion',
      metadata: { Belege: String(run.length), Zeilen: String(rows.length), Erzeugt: 'Pilot' },
      sections: [{ title: 'Positionen', type: 'table', content: { headers: HEADERS, rows } }],
    },
    'xlsx',
  );

  const out = resolve(DIR, 'results/ehinger-positionen.xlsx');
  await writeFile(out, buffer as unknown as Uint8Array);
  console.log(`${rows.length} Zeilen aus ${run.length} Belegen → ${out}`);
  process.exit(0);
}

void main();
