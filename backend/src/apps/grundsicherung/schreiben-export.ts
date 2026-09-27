/**
 * Grundsicherung — Schreiben → DocumentData für den Export (PDF/Word) über den bestehenden
 * documentGenerator-Service (keine neue Dependency). Rein und testbar.
 *
 * Rendert den (ggf. editierten) Body strukturerhaltend: **fett**-Zeilen werden zu
 * Abschnittsüberschriften, `- `-Zeilen zu Listeneinträgen, übriges zu Fließtext. Eine Überschrift
 * ohne folgende Liste (z. B. die Rechtsfolgenbelehrung) wird zur Überschrift des Fließtexts.
 */
import type { DocumentData, DocumentSection } from '../../services/documentGenerator/types';
import { dayPart } from '../_antrag-kern/datum';
import type { Akte, Schreiben, Vorgang } from './types';

const ART_LABEL: Record<string, string> = {
  erstanforderung: 'Anforderung von Unterlagen',
  erinnerung: 'Erinnerung',
  zweitanforderung: 'Zweite Anforderung',
  sonstiges: 'Schreiben',
};

function fmtDatum(iso?: string): string {
  const d = dayPart(iso);
  if (!d) return iso ?? '';
  const [y, m, t] = d.split('-');
  return `${t}.${m}.${y}`;
}

/** Zerlegt den Markdown-artigen Body in Document-Sections. */
export function bodyToSections(body: string): DocumentSection[] {
  const sections: DocumentSection[] = [];
  let titel: string | null = null;
  let liste: string[] = [];
  let text: string[] = [];

  const flushText = () => {
    const t = text.join('\n').trim();
    if (t) { sections.push({ title: titel ?? '', type: 'text', content: t }); titel = null; }
    text = [];
  };
  const flushListe = () => {
    if (liste.length) { sections.push({ title: titel ?? '', type: 'list', content: { items: [...liste] } }); titel = null; }
    liste = [];
  };

  for (const raw of (body ?? '').split('\n')) {
    const line = raw.trimEnd();
    const fett = line.trim().match(/^\*\*(.+)\*\*$/);
    const punkt = line.trim().match(/^[-*]\s+(.*)$/);
    if (fett) {
      flushText(); flushListe();
      if (titel !== null) sections.push({ title: titel, type: 'text', content: '' });
      titel = fett[1]!.trim();
    } else if (punkt) {
      flushText();
      liste.push(punkt[1]!.replace(/\*\*/g, '').trim());
    } else {
      flushListe();
      text.push(line.replace(/\*\*/g, ''));
    }
  }
  flushText(); flushListe();
  return sections.filter((s) => s.type !== 'text' || s.content !== '' || s.title);
}

export function schreibenToDocument(schreiben: Schreiben, vorgang: Vorgang | null, akte: Akte | null): DocumentData {
  const metadata: Record<string, string> = {};
  if (vorgang?.aktenzeichen) metadata['Aktenzeichen'] = vorgang.aktenzeichen;
  if (vorgang?.vorgangsnummer) metadata['Vorgangsnummer'] = vorgang.vorgangsnummer;
  const antragsteller = akte?.antragstellerName || akte?.name;
  if (antragsteller) metadata['Antragsteller:in'] = antragsteller;
  metadata['Art des Schreibens'] = ART_LABEL[schreiben.art] ?? schreiben.art;
  if (schreiben.frist) metadata['Frist für Unterlagen'] = fmtDatum(schreiben.frist);

  const sections: DocumentSection[] = [];
  const adresse = [
    akte?.strasse && `${akte.strasse} ${akte.hausnummer ?? ''}`.trim(),
    [akte?.plz, akte?.ort].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');
  if (antragsteller || adresse) {
    sections.push({
      title: 'Empfänger', type: 'keyvalue',
      content: { items: [
        ...(antragsteller ? [{ key: 'Name', value: antragsteller }] : []),
        ...(adresse ? [{ key: 'Anschrift', value: adresse }] : []),
      ] },
    });
  }
  sections.push(...bodyToSections(schreiben.body ?? ''));
  return { title: schreiben.betreff || 'Anforderung von Unterlagen', metadata, sections };
}
