/**
 * Verfügung → DocumentData-Mapping für den Export (PDF/Word) über den
 * bestehenden documentGenerator-Service (Welle 5, WP11).
 *
 * Erzeugt eine Zusammenfassung des Vorgangs (Kopf, Personen, Einkommen §13,
 * Wohnung/Miete, Prüfstatus, Entscheidung). BEWUSST KEINE rechtsverbindliche
 * Bescheidvorlage und KEINE §19-Betragsfestsetzung.
 */
import type { DocumentData, DocumentSection } from '../../services/documentGenerator/types';
import type { Vorgang, Akte, Person, Pruefschritt } from './types';
import type { VorgangEinkommenErgebnis } from './einkommen';

const WOHNGELDART_LABEL: Record<string, string> = { mietzuschuss: 'Mietzuschuss', lastenzuschuss: 'Lastenzuschuss' };
const ANTRAGSART_LABEL: Record<string, string> = {
  erstantrag: 'Erstantrag', weiterleistungsantrag: 'Weiterleistungsantrag',
  erhoehungsantrag: 'Erhöhungsantrag', aenderungsantrag: 'Änderungsantrag',
};
const ROLLE_LABEL: Record<string, string> = {
  antragsteller: 'Antragsteller/in', ehegatte: 'Ehegatte/-gattin', lebenspartner: 'Lebenspartner/in',
  kind: 'Kind', haushaltsmitglied: 'Haushaltsmitglied',
};
const ERWERBSSTATUS_LABEL: Record<string, string> = {
  angestellt: 'Angestellt', selbststaendig: 'Selbstständig', rente_pension: 'Rente / Pension',
  arbeitslos: 'Arbeitslos', ausbildung_studium: 'Ausbildung / Studium', ohne_erwerb: 'Ohne Erwerb', sonstiges: 'Sonstiges',
};
const ENTSCHEIDUNG_LABEL: Record<string, string> = {
  bewilligt: 'Bewilligt', abgelehnt: 'Abgelehnt', teilweise: 'Teilweise bewilligt', offen: 'Offen',
};

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}
function eur(v?: number): string {
  if (v == null) return '—';
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function verfuegungToDocument(
  vorgang: Vorgang,
  akte: Akte | null,
  personen: Person[],
  einkommen: VorgangEinkommenErgebnis,
  pruefschritte: Pruefschritt[],
): DocumentData {
  const verfuegung = vorgang.verfuegung ?? {};
  const antragsteller = akte?.antragstellerName || akte?.name || '—';
  const adresse = [
    akte?.strasse && `${akte.strasse} ${akte.hausnummer ?? ''}`.trim(),
    [akte?.plz, akte?.ort].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');

  const metadata: Record<string, string> = {
    'Antrags-ID': vorgang.antragsId,
    'Antragsteller': antragsteller,
    'Wohngeldart': WOHNGELDART_LABEL[vorgang.wohngeldart] ?? vorgang.wohngeldart,
    'Antragsart': ANTRAGSART_LABEL[vorgang.antragsart] ?? vorgang.antragsart,
    'Erstellt am': fmtDate(verfuegung.erstelltAm ?? new Date().toISOString()),
  };

  const sections: DocumentSection[] = [];

  // ── Kopf ──
  const bwzListe = (vorgang.bwz && vorgang.bwz.length)
    ? vorgang.bwz
    : ((vorgang.bwz_start || vorgang.bwz_ende) ? [{ id: 'legacy', start: vorgang.bwz_start, ende: vorgang.bwz_ende }] : []);
  const bwzText = bwzListe.length
    ? bwzListe.map((b) => `${fmtDate(b.start)} – ${fmtDate(b.ende)}`).join('; ')
    : '—';
  sections.push({
    title: 'Vorgang', type: 'keyvalue',
    content: { items: [
      { key: 'Antragsteller', value: antragsteller },
      ...(adresse ? [{ key: 'Anschrift', value: adresse }] : []),
      { key: 'Wohngeldart', value: WOHNGELDART_LABEL[vorgang.wohngeldart] ?? vorgang.wohngeldart },
      { key: 'Antragsart', value: ANTRAGSART_LABEL[vorgang.antragsart] ?? vorgang.antragsart },
      { key: 'Antragsdatum', value: fmtDate(vorgang.antragsdatum) },
      { key: 'Bewilligungszeitraum', value: bwzText },
    ] },
  });

  // ── Personen ──
  if (personen.length) {
    sections.push({
      title: 'Haushaltsmitglieder', type: 'table',
      content: {
        headers: ['Name', 'Rolle', 'Erwerbsstatus'],
        rows: personen.map((p) => [
          [p.vorname, p.nachname].filter(Boolean).join(' ') || '—',
          ROLLE_LABEL[p.rolle] ?? p.rolle,
          p.erwerbsstatus ? (ERWERBSSTATUS_LABEL[p.erwerbsstatus] ?? p.erwerbsstatus) : '—',
        ]),
      },
    });
  }

  // ── Einkommen (§13) ──
  sections.push({
    title: 'Anrechenbares Einkommen (§13 WoGG)', type: 'keyvalue',
    content: { items: [
      { key: 'Summe Jahreseinkommen (§14/§16)', value: eur(einkommen.summeJahreseinkommen) },
      { key: 'Freibeträge (§17)', value: eur(einkommen.summeFreibetraege) },
      { key: 'Unterhaltsabzüge (§18)', value: eur(einkommen.unterhaltsabzuege) },
      { key: 'Gesamteinkommen (§13, Jahr)', value: eur(einkommen.gesamteinkommenJahr) },
      { key: 'Gesamteinkommen (§13, Monat)', value: eur(einkommen.gesamteinkommenMonat) },
    ] },
  });

  // ── Wohnung / Miete ──
  const wo = vorgang.wohnung ?? {};
  sections.push({
    title: 'Wohnung & Miete', type: 'keyvalue',
    content: { items: [
      { key: 'Wohnfläche', value: wo.wohnflaeche_qm != null ? `${wo.wohnflaeche_qm} m²` : '—' },
      { key: 'Miete (Bruttokalt)', value: eur(wo.miete) },
      { key: 'Heizkosten', value: eur(wo.heizkosten) },
      { key: 'Warmwasser', value: eur(wo.warmwasser) },
    ] },
  });

  // ── Prüfstatus ──
  const anforderungen = pruefschritte.filter((p) => p.typ === 'anforderung');
  const erledigt = anforderungen.filter((p) => p.status === 'erledigt' || p.status === 'verworfen');
  const offen = anforderungen.filter((p) => p.status === 'offen');
  sections.push({
    title: `Erledigte Anforderungen (${erledigt.length})`, type: 'list',
    content: { items: erledigt.length ? erledigt.map((p) => p.titel) : ['Keine.'] },
  });
  sections.push({
    title: `Offene Anforderungen (${offen.length})`, type: 'list',
    content: { items: offen.length ? offen.map((p) => p.titel) : ['Keine.'] },
  });

  // ── Entscheidung ──
  sections.push({
    title: 'Entscheidung', type: 'keyvalue',
    content: { items: [
      { key: 'Entscheidung', value: ENTSCHEIDUNG_LABEL[verfuegung.entscheidung ?? 'offen'] ?? 'Offen' },
      { key: 'Bemerkung', value: verfuegung.bemerkung?.trim() || '—' },
    ] },
  });
  sections.push({
    title: '', type: 'text',
    content: 'Hinweis: Diese Verfügung ist eine Zusammenfassung zur Entscheidungsfindung. Sie enthält keine Betragsfestsetzung nach §19 WoGG und ist keine rechtsverbindliche Bescheidvorlage.',
  });
  // KI-Transparenz (Art. 13/14 DSGVO, AI Act) + Art. 22 DSGVO: keine automatisierte
  // Einzelentscheidung — die Entscheidung trifft ein Mensch.
  sections.push({
    title: '', type: 'text',
    content: 'KI-Transparenzhinweis: Bei der Bearbeitung dieses Vorgangs wurde ein KI-gestützter Assistent zur Vollständigkeits- und Plausibilitätsprüfung sowie zur Aufbereitung von Unterlagen eingesetzt. Es findet keine automatisierte Einzelentscheidung statt (Art. 22 DSGVO); die Entscheidung wurde von einer Sachbearbeiterin bzw. einem Sachbearbeiter geprüft und getroffen.',
  });

  return {
    title: `Verfügung – ${vorgang.antragsId}`,
    metadata,
    sections,
  };
}
