/**
 * Schreiben → DocumentData-Mapping für den Export (PDF/Word) über den
 * bestehenden documentGenerator-Service (keine neue Dependency).
 *
 * Rendert den (ggf. von der Sachbearbeitung editierten) Schreiben-Body
 * strukturerhaltend: **fett**-Zeilen werden zu Abschnittsüberschriften,
 * `- `-Zeilen zu Listeneinträgen, alles andere zu Fließtext.
 */
import type { DocumentData, DocumentSection } from '../../services/documentGenerator/types';
import type { Vorgang, Akte, Schreiben } from './types';

const ART_LABEL: Record<string, string> = {
  erstanforderung: 'Erstanforderung',
  erinnerung: 'Erinnerung',
  zweitanforderung: 'Zweitanforderung',
  sonstiges: 'Schreiben',
};

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/** Zerlegt den Markdown-artigen Body in Document-Sections. */
export function bodyToSections(body: string): DocumentSection[] {
  const lines = (body ?? '').split('\n');
  const sections: DocumentSection[] = [];
  let textBuf: string[] = [];
  let listTitle: string | null = null;
  let listBuf: string[] = [];

  const flushText = () => {
    const t = textBuf.join('\n').trim();
    if (t) sections.push({ title: '', type: 'text', content: t });
    textBuf = [];
  };
  const flushList = () => {
    if (listTitle !== null) {
      sections.push({ title: listTitle, type: 'list', content: { items: [...listBuf] } });
    }
    listTitle = null;
    listBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const boldOnly = line.trim().match(/^\*\*(.+)\*\*$/);
    const listItem = line.trim().match(/^[-*]\s+(.*)$/);
    if (boldOnly) {
      flushText(); flushList();
      listTitle = boldOnly[1]!.trim();
    } else if (listItem) {
      if (listTitle === null) { flushText(); listTitle = ''; }
      listBuf.push(listItem[1]!.replace(/\*\*/g, '').trim());
    } else {
      if (listTitle !== null) flushList();
      textBuf.push(line.replace(/\*\*/g, ''));
    }
  }
  flushText(); flushList();
  return sections;
}

export function schreibenToDocument(schreiben: Schreiben, vorgang: Vorgang | null, akte: Akte | null): DocumentData {
  const metadata: Record<string, string> = {};
  if (vorgang?.wohngeldnummer) metadata['Wohngeldnummer/Aktenzeichen'] = vorgang.wohngeldnummer;
  if (vorgang?.antragsId) metadata['Vorgangsnummer'] = vorgang.antragsId;
  const antragsteller = akte?.antragstellerName || akte?.name;
  if (antragsteller) metadata['Antragsteller'] = antragsteller;
  metadata['Art des Schreibens'] = ART_LABEL[schreiben.art] ?? schreiben.art;
  if (schreiben.frist) metadata['Frist für Unterlagen'] = fmtDate(schreiben.frist);

  const sections: DocumentSection[] = [];
  const adresse = [akte?.strasse && `${akte.strasse} ${akte.hausnummer ?? ''}`.trim(), [akte?.plz, akte?.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
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

  return {
    title: schreiben.betreff || 'Anforderungsschreiben',
    metadata,
    sections,
  };
}
