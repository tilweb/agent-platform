/**
 * Brücke vom bestehenden Section-Format (export_document, generateDocument) zu
 * Markdown, damit auch strukturierte Exporte im Design einer Designvorlage landen.
 */
import type { DocumentSection, CellValue } from '../documentGenerator/types';

const cell = (v: CellValue | undefined): string => {
  const raw = v == null ? '' : typeof v === 'object' ? v.text : String(v);
  return raw.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
};

export function sectionsToMarkdown(sections: DocumentSection[], metadata: Record<string, string> = {}): string {
  const out: string[] = [];
  const meta = Object.entries(metadata).filter(([, v]) => v);
  if (meta.length) out.push(meta.map(([k, v]) => `**${k}:** ${v}`).join(' · '), '');

  for (const s of sections) {
    if (s.title) out.push(`## ${s.title}`, '');
    const c = s.content;
    switch (s.type) {
      case 'text':
        // Der alte Generator machte aus jeder Zeile einen Absatz — in Markdown braucht das eine Leerzeile
        out.push(String(c ?? '').replace(/\n(?!\n)/g, '\n\n'), '');
        break;
      case 'list':
        for (const item of c?.items ?? []) out.push(`- ${item}`);
        out.push('');
        break;
      case 'table': {
        const headers: CellValue[] = c?.headers ?? [];
        if (!headers.length) break;
        out.push(`| ${headers.map(cell).join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`);
        for (const row of (c?.rows ?? []) as CellValue[][]) out.push(`| ${headers.map((_, i) => cell(row[i])).join(' | ')} |`);
        out.push('');
        break;
      }
      case 'keyvalue':
        // Markdown-Tabellen brauchen eine Kopfzeile — Schlüssel/Wert daher als Liste
        for (const item of c?.items ?? []) {
          const value = typeof item.value === 'object' ? item.value.text : item.value;
          out.push(`- **${item.key}:** ${value ?? ''}`);
        }
        out.push('');
        break;
    }
  }
  return out.join('\n').trim();
}
