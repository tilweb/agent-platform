/**
 * Anforderungsschreiben-Generator (deterministisch).
 *
 * Baut aus den offenen Prüfschritten (Typ „anforderung") einen strukturierten
 * Entwurf, gegliedert je Person + fallübergreifend. Reine Funktion — testbar.
 * Die LLM-gestützte Ausformulierung kann später darauf aufsetzen.
 */
import type { Vorgang, Person, Pruefschritt, Schreiben, SchreibenArt } from './types';

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}
function personLabel(p: Person): string {
  return `${p.vorname} ${p.nachname}`.trim() || 'Antragsteller:in';
}

export interface GeneratorOptions {
  art?: SchreibenArt;
  fristTage?: number;
  /** Bezugsdatum für die Frist (default: heute — via Vorgang antragsdatum als Fallback). */
  stichtag?: string;
}

/**
 * Erzeugt einen Schreiben-Entwurf (betreff, frist, body als Markdown).
 * Berücksichtigt nur offene Prüfschritte vom Typ „anforderung".
 */
export function generiereAnforderungsschreiben(
  vorgang: Vorgang,
  personen: Person[],
  pruefschritte: Pruefschritt[],
  options: GeneratorOptions = {},
): Pick<Schreiben, 'art' | 'betreff' | 'frist' | 'body'> {
  const offene = pruefschritte.filter(p => p.status === 'offen' && p.typ === 'anforderung');
  const stichtag = options.stichtag ?? new Date().toISOString().slice(0, 10);
  const frist = addDays(stichtag, options.fristTage ?? 14);

  const antragsdatum = fmtDate(vorgang.antragsdatum);
  const betreff = antragsdatum
    ? `Ihr Wohngeldantrag vom ${antragsdatum} — fehlende Nachweise`
    : 'Ihr Wohngeldantrag — fehlende Nachweise';

  const byPerson = new Map<string, Pruefschritt[]>();
  const fallweit: Pruefschritt[] = [];
  for (const ps of offene) {
    if (ps.personId) {
      const arr = byPerson.get(ps.personId) ?? [];
      arr.push(ps);
      byPerson.set(ps.personId, arr);
    } else {
      fallweit.push(ps);
    }
  }

  const lines: string[] = [];
  lines.push(`Sehr geehrte Damen und Herren,`);
  lines.push('');
  lines.push(`für die weitere Bearbeitung Ihres Wohngeldantrags benötigen wir noch folgende Unterlagen bzw. Angaben. Bitte reichen Sie diese bis zum **${fmtDate(frist)}** ein.`);
  lines.push('');

  if (fallweit.length) {
    lines.push(`**Allgemein**`);
    for (const ps of fallweit) lines.push(`- ${ps.titel}${ps.belegtext ? ` — ${ps.belegtext}` : ''}`);
    lines.push('');
  }

  for (const p of personen) {
    const items = byPerson.get(p.id);
    if (!items?.length) continue;
    lines.push(`**${personLabel(p)}**`);
    for (const ps of items) lines.push(`- ${ps.titel}${ps.belegtext ? ` — ${ps.belegtext}` : ''}`);
    lines.push('');
  }

  if (!offene.length) {
    lines.push(`_Derzeit sind keine offenen Anforderungen vorhanden._`);
    lines.push('');
  }

  lines.push(`Mit freundlichen Grüßen`);
  lines.push(`Ihre Wohngeldbehörde`);

  return {
    art: options.art ?? 'erstanforderung',
    betreff,
    frist,
    body: lines.join('\n'),
  };
}
