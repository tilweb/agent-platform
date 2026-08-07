/**
 * Konverter-Benchmark (W8): Markitdown vs. Docling auf denselben Dokumenten.
 *
 * Misst je Backend: Dauer, Zeichen, Markdown-Tabellenzeilen (Zeilen mit >= 2
 * Pipes) und Ueberschriften — die Tabellen-Treue ist der Grund fuer den
 * Docling-Wechsel. Ohne DOCLING_API_URL laeuft nur die Markitdown-Baseline;
 * sobald der Adacor-Endpunkt steht, liefert derselbe Aufruf den Vergleich.
 *
 * Aufruf (im backend/-Verzeichnis):
 *   /Users/andreasbachmann/.bun/bin/bun run ../tools/konverter-benchmark/run.ts <datei> [datei ...]
 */

import { resolve } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { convertDocument, doclingConfigured } from '../../backend/src/services/documentConverter';

interface Probe {
  backend: 'markitdown' | 'docling';
  ms: number;
  chars: number;
  tableRows: number;
  headings: number;
  error?: string;
}

function analyze(md: string): Pick<Probe, 'chars' | 'tableRows' | 'headings'> {
  const lines = md.split('\n');
  return {
    chars: md.length,
    tableRows: lines.filter((l) => (l.match(/\|/g) ?? []).length >= 2).length,
    headings: lines.filter((l) => /^#{1,6}\s/.test(l)).length,
  };
}

async function probe(buffer: Buffer, filename: string, backend: 'markitdown' | 'docling'): Promise<Probe> {
  const t0 = Date.now();
  try {
    const md = await convertDocument({ buffer, filename }, { backend });
    return { backend, ms: Date.now() - t0, ...analyze(md) };
  } catch (err) {
    return { backend, ms: Date.now() - t0, chars: 0, tableRows: 0, headings: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Aufruf: run.ts <datei> [datei ...]');
    process.exit(1);
  }

  const withDocling = doclingConfigured();
  console.log(withDocling
    ? 'DOCLING_API_URL gesetzt — voller Vergleich.\n'
    : 'DOCLING_API_URL nicht gesetzt — nur Markitdown-Baseline (Vergleich laeuft automatisch mit, sobald der Adacor-Endpunkt konfiguriert ist).\n');

  const rows: string[] = [
    '| Datei | Backend | Dauer | Zeichen | Tabellenzeilen | Ueberschriften | Fehler |',
    '|---|---|---|---|---|---|---|',
  ];

  for (const f of files) {
    const path = resolve(f);
    const buffer = Buffer.from(await Bun.file(path).arrayBuffer());
    const name = path.split('/').pop()!;
    const backends: Array<'markitdown' | 'docling'> = withDocling ? ['markitdown', 'docling'] : ['markitdown'];
    for (const b of backends) {
      const p = await probe(buffer, name, b);
      rows.push(`| ${name} | ${p.backend} | ${(p.ms / 1000).toFixed(1)}s | ${p.chars} | ${p.tableRows} | ${p.headings} | ${p.error ?? ''} |`);
      console.log(rows[rows.length - 1]);
    }
  }

  const outDir = resolve(import.meta.dir, 'results');
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const out = `${outDir}/vergleich-${stamp}${withDocling ? '' : '-baseline'}.md`;
  await writeFile(out, `# Konverter-Benchmark ${stamp}\n\n${rows.join('\n')}\n`, 'utf-8');
  console.log(`\n→ ${out}`);
  process.exit(0);
}

void main();
