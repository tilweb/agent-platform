/**
 * Betroffenen-Auskunft (Art. 15/20 DSGVO) → DocumentData / JSON.
 *
 * Sammelt ALLE zu einer Person gespeicherten Fachdaten (Stammdaten, Einkommen,
 * Vermögen, Unterhalt, Transferleistungen, Pflege/Behinderung) plus Kontext
 * (zugehöriger Vorgang, Dokumentenliste OHNE Datei-Bytes, Protokoll-Auszug) und
 * bildet sie auf das DocumentData-Format des documentGenerators ab (Muster wie
 * verfuegung-export.ts). Reine Funktionen (DB-frei, testbar).
 */
import type { DocumentData, DocumentSection } from '../../services/documentGenerator/types';
import type {
  Person, Vorgang, Akte, Dokument, AuditEintrag,
  Einkommensposition, VermoegenPosition, Unterhaltsverpflichtung,
  Unterhaltsanspruch, TransferleistungDetail, Kinderbetreuungskosten, Ausschluss,
} from './types';

const WOHNGELDART_LABEL: Record<string, string> = { mietzuschuss: 'Mietzuschuss', lastenzuschuss: 'Lastenzuschuss' };
const ANTRAGSART_LABEL: Record<string, string> = {
  erstantrag: 'Erstantrag', weiterleistungsantrag: 'Weiterleistungsantrag',
  erhoehungsantrag: 'Erhöhungsantrag', aenderungsantrag: 'Änderungsantrag',
};
const STATUS_LABEL: Record<string, string> = {
  posteingang: 'Posteingang', sachbearbeitung: 'In Bearbeitung',
  warte_auf_rueckmeldung: 'Wartet auf Rückmeldung', entscheidung: 'Entscheidung', abgeschlossen: 'Abgeschlossen',
};
const ROLLE_LABEL: Record<string, string> = {
  antragsteller: 'Antragsteller/in', ehegatte: 'Ehegatte/-gattin', lebenspartner: 'Lebenspartner/in',
  kind: 'Kind', haushaltsmitglied: 'Haushaltsmitglied',
};
const ERWERBSSTATUS_LABEL: Record<string, string> = {
  angestellt: 'Angestellt', selbststaendig: 'Selbstständig', rente_pension: 'Rente / Pension',
  arbeitslos: 'Arbeitslos', ausbildung_studium: 'Ausbildung / Studium', ohne_erwerb: 'Ohne Erwerb', sonstiges: 'Sonstiges',
};
const DOKUMENT_TYP_LABEL: Record<string, string> = {
  wohngeldantrag: 'Wohngeldantrag', personalausweis: 'Personalausweis', mietvertrag: 'Mietvertrag',
  mietbescheinigung: 'Mietbescheinigung', rentenbescheid: 'Rentenbescheid', verdienstbescheinigung: 'Verdienstbescheinigung',
  gehaltsabrechnung: 'Gehaltsabrechnung', kontoauszug: 'Kontoauszug', kv_pv_nachweis: 'KV-/PV-Nachweis',
  schwerbehindertenausweis: 'Schwerbehindertenausweis', pflegenachweis: 'Pflegenachweis', kindergeldnachweis: 'Kindergeldnachweis',
  unterhaltsnachweis: 'Unterhaltsnachweis', transferleistungsbescheid: 'Transferleistungsbescheid',
  vermoegensnachweis: 'Vermögensnachweis', sonstiges: 'Sonstiges',
};
const UNTERHALT_KATEGORIE_LABEL: Record<string, string> = {
  auswaertige_ausbildung: 'Auswärtige Ausbildung', kind_anderer_elternteil: 'Kind (anderer Elternteil)',
  ehegatte_getrennt: 'Getrennt lebender Ehegatte', sonstige: 'Sonstige',
};
const VERWANDTSCHAFT_LABEL: Record<string, string> = {
  kind: 'Kind', ehegatte_getrennt: 'Getrennt lebender/früherer Ehegatte/Lebenspartner',
  elternteil: 'Elternteil', auswaertige_ausbildung: 'Person in auswärtiger Ausbildung', sonstige: 'Sonstige',
};
const FREQUENZ_LABEL: Record<string, string> = {
  taeglich: 'täglich', woechentlich: 'wöchentlich', vierzehntaegig: '14-täglich', monatlich: 'monatlich',
  vierteljaehrlich: 'vierteljährlich', jaehrlich: 'jährlich', einmalig: 'einmalig', schwankend: 'schwankend', sonstige: 'sonstige',
};
const AUSSCHLUSS_GRUND_LABEL: Record<string, string> = {
  sgb2_buergergeld: 'Leistung nach SGB II (Bürgergeld)',
  grundsicherung_alter_em: 'Grundsicherung im Alter/bei Erwerbsminderung',
  hilfe_lebensunterhalt_sgb12: 'Hilfe zum Lebensunterhalt (SGB XII)',
  ergaenzende_hilfe_bvg: 'Ergänzende Hilfe zum Lebensunterhalt (nach BVG)',
  hilfe_stationaer: 'Hilfe in einer stationären Einrichtung zum Lebensunterhalt',
  kinder_jugendhilfe_sgb8: 'Leistungen der Kinder- und Jugendhilfe (SGB VIII)',
  asylblg: 'Grundleistungen nach dem AsylbLG',
  ausbildungsfoerderung: 'Ausbildungsförderung (BAföG/BAB, § 20 Abs. 2 WoGG)',
  sonstiger_grund: 'Sonstiger Grund',
};
/** Kompakte, lesbare Labels der Protokoll-Aktionen (Auszug — Fallback: Rohwert). */
const AKTION_LABEL: Record<string, string> = {
  'vorgang.geoeffnet': 'Fall geöffnet', 'vorgang.erstellt': 'Vorgang erstellt',
  'vorgang.geaendert': 'Vorgang geändert', 'vorgang.geloescht': 'Vorgang gelöscht',
  'person.erstellt': 'Person angelegt', 'person.geaendert': 'Person geändert', 'person.geloescht': 'Person gelöscht',
  'dokument.hochgeladen': 'Dokument(e) hochgeladen', 'dokument.geaendert': 'Dokument geändert',
  'dokument.geloescht': 'Dokument gelöscht', 'dokument.heruntergeladen': 'Dokument heruntergeladen',
  'dokument.vorschau': 'Dokument angesehen', 'dokument.abgelegt': 'Dokument abgelegt',
  'pruefung.ausgefuehrt': 'Prüfung ausgeführt', 'schreiben.generiert': 'Schreiben generiert',
  'schreiben.versendet': 'Schreiben versendet', 'schreiben.exportiert': 'Schreiben exportiert',
  'verfuegung.gespeichert': 'Verfügung gespeichert', 'verfuegung.exportiert': 'Verfügung exportiert',
  'person.auskunft_exportiert': 'Auskunft exportiert',
};

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}
function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function eur(v?: number): string {
  if (v == null) return '—';
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
function personName(p: Person): string {
  return [p.titel, p.vorname, p.nachname].filter(Boolean).join(' ') || 'Person';
}

export interface AuskunftInput {
  person: Person;
  vorgang: Vorgang | null;
  akte: Akte | null;
  /** Nur Dokumente dieser Person (ohne Datei-Bytes). */
  dokumente: Dokument[];
  /** Protokoll-Einträge, die diese Person/den Vorgang betreffen. */
  protokoll: AuditEintrag[];
}

/**
 * Strukturierte JSON-Auskunft (Art. 20 — Datenübertragbarkeit). Nur die zu der
 * Person gespeicherten Fachdaten + Kontext; KEINE Datei-Bytes, KEINE fremden Personen.
 */
export function auskunftToJson(input: AuskunftInput): Record<string, unknown> {
  const { person: p, vorgang, akte, dokumente, protokoll } = input;
  return {
    erstelltAm: new Date().toISOString(),
    hinweis: 'Auskunft nach Art. 15 DSGVO über die zu dieser Person gespeicherten Daten. Enthält keine Dokumentdateien und keine Daten anderer Personen im Detail.',
    person: {
      id: p.id, rolle: p.rolle, nachname: p.nachname, vorname: p.vorname,
      geburtsname: p.geburtsname, titel: p.titel, geburtsdatum: p.geburtsdatum, geburtsort: p.geburtsort,
      geschlecht: p.geschlecht, familienstand: p.familienstand, telefon: p.telefon, email: p.email,
      erwerbsstatus: p.erwerbsstatus, staatsangehoerigkeit: p.staatsangehoerigkeit, eu_ewr: p.eu_ewr,
      erhaelt_kindergeld: p.erhaelt_kindergeld, hat_werbungskosten: p.hat_werbungskosten,
      pflege_behinderung: p.pflege_behinderung,
      einkommen: p.einkommen ?? [],
      vermoegen: p.vermoegen,
      vermoegenPositionen: p.vermoegenPositionen ?? [],
      kinderbetreuungskosten: p.kinderbetreuungskosten ?? [],
      unterhaltsverpflichtungen: p.unterhaltsverpflichtungen ?? [],
      unterhaltsansprueche: p.unterhaltsansprueche ?? [],
      transferleistungen: p.transferleistungen ?? [],
      transferleistungenDetail: p.transferleistungenDetail ?? [],
      ausschluesse: p.ausschluesse ?? [],
      bemerkung: p.bemerkung,
      created_at: p.created_at, updated_at: p.updated_at,
    },
    vorgang: vorgang ? {
      antragsId: vorgang.antragsId, wohngeldart: vorgang.wohngeldart, antragsart: vorgang.antragsart,
      status: vorgang.status, antragsdatum: vorgang.antragsdatum, wohnung: vorgang.wohnung,
    } : null,
    akte: akte ? {
      name: akte.name, antragstellerName: akte.antragstellerName,
      strasse: akte.strasse, hausnummer: akte.hausnummer, plz: akte.plz, ort: akte.ort,
    } : null,
    dokumente: dokumente.map((d) => ({ id: d.id, typ: d.typ, titel: d.titel, eingegangenAm: d.eingegangenAm, created_at: d.created_at })),
    protokoll: protokoll.map((e) => ({
      timestamp: e.timestamp, aktion: e.aktion, akteurName: e.akteurName, akteurRolle: e.akteurRolle,
      objektTyp: e.objektTyp, objektId: e.objektId, ergebnis: e.ergebnis, detail: e.detail,
    })),
  };
}

export function auskunftToDocument(input: AuskunftInput): DocumentData {
  const { person: p, vorgang, akte, dokumente, protokoll } = input;
  const name = personName(p);
  const adresse = [
    akte?.strasse && `${akte.strasse} ${akte.hausnummer ?? ''}`.trim(),
    [akte?.plz, akte?.ort].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');

  const metadata: Record<string, string> = {
    'Betroffene Person': name,
    'Rolle im Haushalt': ROLLE_LABEL[p.rolle] ?? p.rolle,
    'Erstellt am': fmtDate(new Date().toISOString()),
  };
  if (vorgang) metadata['Vorgangsnummer'] = vorgang.antragsId;

  const sections: DocumentSection[] = [];

  sections.push({
    title: '', type: 'text',
    content: 'Auskunft nach Art. 15 DSGVO über die zu dieser Person im Wohngeld-Verfahren gespeicherten personenbezogenen Daten. Rechtsgrundlage der Verarbeitung: öffentliche Aufgabe (Art. 6 Abs. 1 lit. e DSGVO i. V. m. WoGG/SGB). Diese Auskunft enthält keine Dokumentdateien; auf angehängte Nachweise wird nur mit Typ und Datum verwiesen.',
  });

  // ── Stammdaten ──
  const stamm: { key: string; value: string }[] = [
    { key: 'Name', value: name },
    { key: 'Geburtsname', value: p.geburtsname || '—' },
    { key: 'Geburtsdatum', value: fmtDate(p.geburtsdatum) },
    { key: 'Geburtsort', value: p.geburtsort || '—' },
    { key: 'Geschlecht', value: p.geschlecht || '—' },
    { key: 'Familienstand', value: p.familienstand || '—' },
    { key: 'Staatsangehörigkeit', value: p.staatsangehoerigkeit || '—' },
    { key: 'EU/EWR', value: p.eu_ewr == null ? '—' : (p.eu_ewr ? 'Ja' : 'Nein') },
    { key: 'Telefon', value: p.telefon || '—' },
    { key: 'E-Mail', value: p.email || '—' },
    { key: 'Erwerbsstatus', value: p.erwerbsstatus ? (ERWERBSSTATUS_LABEL[p.erwerbsstatus] ?? p.erwerbsstatus) : '—' },
    { key: 'Erhält Kindergeld', value: p.erhaelt_kindergeld == null ? '—' : (p.erhaelt_kindergeld ? 'Ja' : 'Nein') },
  ];
  sections.push({ title: 'Stammdaten', type: 'keyvalue', content: { items: stamm } });

  // ── Pflege & Behinderung (Art. 9) ──
  const pb = p.pflege_behinderung ?? {};
  if (pb.schwerbehinderungsgrad != null || pb.pflegegrad != null || pb.pflegebeduerftig != null) {
    sections.push({
      title: 'Pflege & Behinderung (besondere Kategorien, Art. 9 DSGVO)', type: 'keyvalue',
      content: { items: [
        { key: 'Behinderungsgrad (GdB)', value: pb.schwerbehinderungsgrad != null ? String(pb.schwerbehinderungsgrad) : '—' },
        { key: 'Pflegegrad', value: pb.pflegegrad != null ? String(pb.pflegegrad) : '—' },
        { key: 'Pflegebedürftig', value: pb.pflegebeduerftig == null ? '—' : (pb.pflegebeduerftig ? 'Ja' : 'Nein') },
      ] },
    });
  }

  // ── Einkommen ──
  const einkommen: Einkommensposition[] = p.einkommen ?? [];
  if (einkommen.length) {
    sections.push({
      title: 'Einkommenspositionen', type: 'table',
      content: {
        headers: ['Art', 'Monatlich', 'Jährlich', 'Berücksichtigt'],
        rows: einkommen.map((e) => [
          e.bezeichnung || e.art || '—', eur(e.betrag_monatlich), eur(e.betrag_jaehrlich), e.beruecksichtigt ? 'Ja' : 'Nein',
        ]),
      },
    });
  }

  // ── Vermögen ──
  const vermoegen: VermoegenPosition[] = p.vermoegenPositionen ?? [];
  if (vermoegen.length) {
    sections.push({
      title: 'Vermögen', type: 'table',
      content: { headers: ['Art', 'Betrag'], rows: vermoegen.map((v) => [v.art || '—', eur(v.betrag)]) },
    });
  } else if (p.vermoegen != null) {
    sections.push({
      title: 'Vermögen', type: 'keyvalue',
      content: { items: [{ key: 'Vermögen (Einzelwert)', value: eur(p.vermoegen) }] },
    });
  }

  // ── Kinderbetreuungskosten ──
  const kbk: Kinderbetreuungskosten[] = p.kinderbetreuungskosten ?? [];
  if (kbk.length) {
    sections.push({
      title: 'Kinderbetreuungskosten', type: 'table',
      content: {
        headers: ['Bemerkung', 'Frequenz', 'Betrag'],
        rows: kbk.map((k) => [k.bemerkung || '—', (k.frequenz && FREQUENZ_LABEL[k.frequenz]) || '—', eur(k.betrag)]),
      },
    });
  }

  // ── Unterhaltsverpflichtungen (§18) ──
  const uVerpf: Unterhaltsverpflichtung[] = p.unterhaltsverpflichtungen ?? [];
  if (uVerpf.length) {
    sections.push({
      title: 'Unterhaltsverpflichtungen (§ 18 WoGG)', type: 'table',
      content: {
        headers: ['Verhältnis / Empfänger', 'Frequenz', 'Betrag'],
        rows: uVerpf.map((u) => {
          const verhaeltnis = (u.verwandtschaft && VERWANDTSCHAFT_LABEL[u.verwandtschaft])
            || (u.empfaengerKategorie && UNTERHALT_KATEGORIE_LABEL[u.empfaengerKategorie]) || '—';
          const name = [u.empfaengerVorname, u.empfaengerNachname].filter(Boolean).join(' ');
          const freq = (u.frequenz && FREQUENZ_LABEL[u.frequenz]) || (u.titelVorhanden ? 'mit Titel' : '—');
          return [name ? `${verhaeltnis} (${name})` : verhaeltnis, freq, eur(u.betrag)];
        }),
      },
    });
  }

  // ── Unterhaltsansprüche ──
  const uAnspr: Unterhaltsanspruch[] = p.unterhaltsansprueche ?? [];
  if (uAnspr.length) {
    sections.push({
      title: 'Unterhaltsansprüche', type: 'table',
      content: {
        headers: ['Von / Art', 'Frequenz', 'Betrag'],
        rows: uAnspr.map((u) => {
          const von = [u.vonVorname, u.vonNachname].filter(Boolean).join(' ') || u.art || '—';
          return [von, (u.frequenz && FREQUENZ_LABEL[u.frequenz]) || '—', eur(u.betrag)];
        }),
      },
    });
  }

  // ── Ausschlüsse (§7) ──
  const ausschluesse: Ausschluss[] = p.ausschluesse ?? [];
  if (ausschluesse.length) {
    sections.push({
      title: 'Ausschlüsse (§ 7 WoGG)', type: 'table',
      content: {
        headers: ['Grund', 'Von', 'Bis', 'Bemerkung'],
        rows: ausschluesse.map((a) => [
          (a.grund && AUSSCHLUSS_GRUND_LABEL[a.grund]) || '—', fmtDate(a.von), fmtDate(a.bis), a.freitext || '—',
        ]),
      },
    });
  }

  // ── Transferleistungen (§7) ──
  const transfer: TransferleistungDetail[] = p.transferleistungenDetail ?? [];
  if (transfer.length) {
    sections.push({
      title: 'Transferleistungen (§ 7 WoGG)', type: 'table',
      content: {
        headers: ['Art', 'KdU enthalten', 'Bescheid vorhanden'],
        rows: transfer.map((t) => [t.art || '—', t.kduEnthalten ? 'Ja' : 'Nein', t.bescheidVorhanden ? 'Ja' : 'Nein']),
      },
    });
  } else if ((p.transferleistungen ?? []).length) {
    sections.push({
      title: 'Transferleistungen', type: 'list',
      content: { items: p.transferleistungen ?? [] },
    });
  }

  if (p.bemerkung) {
    sections.push({ title: 'Bemerkung', type: 'text', content: p.bemerkung });
  }

  // ── Kontext: Vorgang ──
  if (vorgang) {
    sections.push({
      title: 'Zugehöriger Vorgang', type: 'keyvalue',
      content: { items: [
        { key: 'Vorgangsnummer', value: vorgang.antragsId },
        ...(vorgang.wohngeldnummer ? [{ key: 'Wohngeldnummer/Aktenzeichen', value: vorgang.wohngeldnummer }] : []),
        { key: 'Wohngeldart', value: WOHNGELDART_LABEL[vorgang.wohngeldart] ?? vorgang.wohngeldart },
        { key: 'Antragsart', value: ANTRAGSART_LABEL[vorgang.antragsart] ?? vorgang.antragsart },
        { key: 'Status', value: STATUS_LABEL[vorgang.status] ?? vorgang.status },
        { key: 'Antragsdatum', value: fmtDate(vorgang.antragsdatum) },
        ...(adresse ? [{ key: 'Anschrift', value: adresse }] : []),
        { key: 'Miete (Bruttokalt)', value: eur(vorgang.wohnung?.miete) },
      ] },
    });
  }

  // ── Kontext: Dokumente (nur Typ/Datum, keine Datei-Bytes) ──
  sections.push({
    title: `Dokumente der Person (${dokumente.length})`, type: dokumente.length ? 'table' : 'text',
    content: dokumente.length
      ? {
          headers: ['Typ', 'Titel', 'Eingegangen am'],
          rows: dokumente.map((d) => [
            DOKUMENT_TYP_LABEL[d.typ] ?? d.typ, d.titel || '—', fmtDate(d.eingegangenAm || d.created_at),
          ]),
        }
      : 'Keine dieser Person zugeordneten Dokumente.',
  });

  // ── Kontext: Protokoll-Auszug ──
  sections.push({
    title: `Protokoll-Auszug (${protokoll.length})`, type: protokoll.length ? 'table' : 'text',
    content: protokoll.length
      ? {
          headers: ['Zeitpunkt', 'Aktion', 'Akteur', 'Detail'],
          rows: protokoll.map((e) => [
            fmtDateTime(e.timestamp), AKTION_LABEL[e.aktion] ?? e.aktion, e.akteurName || '—', e.detail || '—',
          ]),
        }
      : 'Keine Protokolleinträge zu dieser Person/dem Vorgang.',
  });

  return {
    title: `Auskunft nach Art. 15 DSGVO – ${name}`,
    metadata,
    sections,
  };
}
