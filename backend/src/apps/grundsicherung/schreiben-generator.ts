/**
 * Grundsicherung — Nachforderungsschreiben nach § 60 SGB I (deterministisch, kein LLM).
 *
 * Baut aus den OFFENEN Prüfschritten vom Typ „anforderung" einen editierbaren Entwurf,
 * gegliedert nach fallübergreifenden Punkten und je Person. Pflichtbestandteile nach
 * § 66 Abs. 3 SGB I: angemessene Frist und schriftlicher Hinweis auf die Folgen fehlender
 * Mitwirkung (Rechtsfolgenbelehrung § 66 Abs. 1 SGB I) — als pflegbarer Textbaustein
 * („Rechtsfolgenbelehrung"), sonst der Standardtext unten. Reine Funktion — testbar.
 */
import { dayPart } from '../_antrag-kern/datum';
import type { Person, Pruefschritt, Schreiben, SchreibenArt, SchreibenItem, Textbaustein, Vorgang } from './types';

/** Standard-Frist in Tagen (angemessen i. S. d. § 66 Abs. 3 SGB I; überschreibbar je Schreiben). */
export const STANDARD_FRIST_TAGE = 14;

/** Titel des pflegbaren Textbausteins, der die Standard-Rechtsfolgenbelehrung ersetzt. */
export const TEXTBAUSTEIN_RECHTSFOLGEN = 'Rechtsfolgenbelehrung';

/** Standard-Rechtsfolgenbelehrung (§ 66 Abs. 1 und 3 SGB I; Grenzen § 65 SGB I). */
export const RECHTSFOLGENBELEHRUNG = [
  'Sie sind nach § 60 Abs. 1 des Ersten Buches Sozialgesetzbuch (SGB I) verpflichtet, alle Tatsachen anzugeben, die für die Leistung erheblich sind, und Beweisurkunden vorzulegen. '
  + 'Kommen Sie dieser Pflicht bis zum genannten Termin nicht nach und wird dadurch die Aufklärung des Sachverhalts erheblich erschwert, kann die Leistung nach § 66 Abs. 1 SGB I '
  + 'ohne weitere Ermittlungen bis zur Nachholung der Mitwirkung ganz oder teilweise versagt werden, soweit die Voraussetzungen der Leistung nicht nachgewiesen sind.',
  'Wird die Mitwirkung nachgeholt und liegen die Leistungsvoraussetzungen vor, kann die Leistung nachträglich ganz oder teilweise erbracht werden (§ 67 SGB I). '
  + 'Sollte Ihnen die Vorlage einzelner Unterlagen nicht möglich oder nicht zumutbar sein, teilen Sie uns dies bitte bis zum genannten Termin mit (§ 65 SGB I).',
].join('\n\n');

function plusTageIso(iso: string, tage: number): string {
  const d = new Date(`${dayPart(iso) ?? iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}
function fmtDatum(iso?: string): string {
  const d = dayPart(iso);
  if (!d) return '';
  const [y, m, t] = d.split('-');
  return `${t}.${m}.${y}`;
}
function personLabel(p: Person): string {
  return `${p.vorname} ${p.nachname}`.trim() || (p.rolle === 'partner' ? 'Partner:in' : p.rolle === 'antragsteller' ? 'Antragsteller:in' : 'Haushaltsangehörige:r');
}

export interface GeneratorOptionen {
  art?: SchreibenArt;
  fristTage?: number;
  /** Bezugsdatum für die Frist (Default: heute). */
  stichtag?: string;
  /** Gepflegte Textbausteine — „Rechtsfolgenbelehrung" ersetzt den Standardtext. */
  textbausteine?: Pick<Textbaustein, 'titel' | 'text'>[];
}

const EINLEITUNG: Record<SchreibenArt, (frist: string) => string> = {
  erstanforderung: (f) => `für die Bearbeitung Ihres Antrags auf Grundsicherung im Alter und bei Erwerbsminderung nach dem Vierten Kapitel des Zwölften Buches Sozialgesetzbuch (SGB XII) benötigen wir noch die folgenden Unterlagen bzw. Angaben (§ 60 Abs. 1 SGB I). Bitte reichen Sie diese bis zum **${f}** ein.`,
  erinnerung: (f) => `wir haben Sie gebeten, für die Bearbeitung Ihres Antrags auf Grundsicherung im Alter und bei Erwerbsminderung noch Unterlagen bzw. Angaben einzureichen. Bisher liegen uns die folgenden Punkte nicht vor (§ 60 Abs. 1 SGB I). Bitte reichen Sie diese bis zum **${f}** ein.`,
  zweitanforderung: (f) => `trotz unserer Aufforderung fehlen für die Bearbeitung Ihres Antrags auf Grundsicherung im Alter und bei Erwerbsminderung weiterhin die folgenden Unterlagen bzw. Angaben (§ 60 Abs. 1 SGB I). Wir bitten Sie letztmalig, diese bis zum **${f}** einzureichen.`,
  sonstiges: (f) => `für die Bearbeitung Ihres Antrags auf Grundsicherung im Alter und bei Erwerbsminderung benötigen wir noch die folgenden Unterlagen bzw. Angaben (§ 60 Abs. 1 SGB I). Bitte reichen Sie diese bis zum **${f}** ein.`,
};

/**
 * Erzeugt einen Schreiben-Entwurf (Betreff, Frist, Body als Markdown, Punkte mit Provenienz).
 * Berücksichtigt nur offene Prüfschritte vom Typ „anforderung" (Hinweise an die Sachbearbeitung
 * gehören nicht ins Schreiben).
 */
export function generiereAnforderungsschreiben(
  vorgang: Pick<Vorgang, 'antragsdatum' | 'vorgangsnummer' | 'aktenzeichen'>,
  personen: Person[],
  pruefschritte: Pruefschritt[],
  optionen: GeneratorOptionen = {},
): Pick<Schreiben, 'art' | 'betreff' | 'frist' | 'body' | 'items'> {
  const art = optionen.art ?? 'erstanforderung';
  const offene = pruefschritte.filter((p) => p.status === 'offen' && p.typ === 'anforderung');
  const stichtag = dayPart(optionen.stichtag) ?? new Date().toISOString().slice(0, 10);
  const fristTage = Number.isFinite(optionen.fristTage) && (optionen.fristTage ?? 0) > 0 ? Math.floor(optionen.fristTage!) : STANDARD_FRIST_TAGE;
  const frist = plusTageIso(stichtag, fristTage);

  const antragsdatum = fmtDatum(vorgang.antragsdatum);
  const praefix = art === 'erinnerung' ? 'Erinnerung: ' : art === 'zweitanforderung' ? 'Zweite Anforderung: ' : '';
  const betreff = `${praefix}Ihr Antrag auf Grundsicherung${antragsdatum ? ` vom ${antragsdatum}` : ''} — fehlende Unterlagen (Mitwirkung nach § 60 SGB I)`;

  const personIds = new Set(personen.map((p) => p.id));
  const byPerson = new Map<string, Pruefschritt[]>();
  const fallweit: Pruefschritt[] = [];
  for (const ps of offene) {
    if (ps.personId && personIds.has(ps.personId)) byPerson.set(ps.personId, [...(byPerson.get(ps.personId) ?? []), ps]);
    else fallweit.push(ps);
  }

  const lines: string[] = [];
  const items: SchreibenItem[] = [];
  const punktText = (ps: Pruefschritt) => `${ps.titel}${ps.belegtext ? ` — ${ps.belegtext}` : ''}`;
  const punkt = (ps: Pruefschritt) => {
    lines.push(`- ${punktText(ps)}`);
    items.push({ text: punktText(ps), regelId: ps.regelId, titel: ps.titel, quellDokumentId: ps.quellDokumentId, personId: ps.personId });
  };

  lines.push('Sehr geehrte Damen und Herren,', '', EINLEITUNG[art](fmtDatum(frist)), '');
  if (fallweit.length) {
    lines.push('**Allgemein**');
    fallweit.forEach(punkt);
    lines.push('');
  }
  for (const p of personen) {
    const liste = byPerson.get(p.id);
    if (!liste?.length) continue;
    lines.push(`**${personLabel(p)}**`);
    liste.forEach(punkt);
    lines.push('');
  }
  if (!offene.length) lines.push('_Derzeit sind keine offenen Anforderungen vorhanden._', '');

  const belehrung = optionen.textbausteine?.find((t) => t.titel.trim().toLowerCase() === TEXTBAUSTEIN_RECHTSFOLGEN.toLowerCase())?.text?.trim() || RECHTSFOLGENBELEHRUNG;
  lines.push('**Hinweis auf die Folgen fehlender Mitwirkung (§ 66 SGB I)**', '', belehrung, '');
  const zeichen = vorgang.aktenzeichen || vorgang.vorgangsnummer;
  if (zeichen) lines.push(`Bitte geben Sie bei Rückfragen und Einsendungen das Zeichen ${zeichen} an.`, '');
  lines.push('Mit freundlichen Grüßen', 'Ihr Sozialamt — Grundsicherung im Alter und bei Erwerbsminderung');

  return { art, betreff, frist, body: lines.join('\n'), items };
}
