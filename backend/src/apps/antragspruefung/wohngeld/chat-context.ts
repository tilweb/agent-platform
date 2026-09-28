/**
 * Fall-Chat — Kontext-Assemblierung (rein, DB-frei, testbar).
 *
 * Baut aus dem Vorgang-Snapshot + Prüfschritten einen kompakten, strukturierten
 * deutschen Kontextblock als Grounding-Quelle für die Fall-Q&A (Stufe C1).
 * Antworten des Modells dürfen NUR auf diesem Kontext beruhen — keine Rechts-KB
 * (folgt in C2). Die zurückgegebene Dokument-Liste (id → label) dient dazu,
 * vom Modell markierte Quellen auf klickbare Refs aufzulösen.
 */
import type { VorgangSnapshot, Pruefschritt, Person, Dokument } from './types';
import { gesamteinkommen, type GesamteinkommenInput } from './einkommen';

// ── Anzeige-Labels (kompakt, serverseitig) ─────────────────────────────────

const WOHNGELDART_LABEL: Record<string, string> = {
  mietzuschuss: 'Mietzuschuss',
  lastenzuschuss: 'Lastenzuschuss',
};
const ANTRAGSART_LABEL: Record<string, string> = {
  erstantrag: 'Erstantrag',
  weiterleistungsantrag: 'Weiterleistungsantrag',
  erhoehungsantrag: 'Erhöhungsantrag',
  aenderungsantrag: 'Änderungsantrag',
};
const STATUS_LABEL: Record<string, string> = {
  posteingang: 'Posteingang',
  sachbearbeitung: 'In Bearbeitung',
  warte_auf_rueckmeldung: 'Wartet auf Rückmeldung',
  entscheidung: 'Entscheidung',
  abgeschlossen: 'Abgeschlossen',
};
const ROLLE_LABEL: Record<string, string> = {
  antragsteller: 'Antragsteller/in',
  ehegatte: 'Ehegatte/-gattin',
  lebenspartner: 'Lebenspartner/in',
  kind: 'Kind',
  haushaltsmitglied: 'Haushaltsmitglied',
};
const ERWERBSSTATUS_LABEL: Record<string, string> = {
  angestellt: 'Angestellt',
  selbststaendig: 'Selbstständig',
  rente_pension: 'Rente / Pension',
  arbeitslos: 'Arbeitslos',
  ausbildung_studium: 'Ausbildung / Studium',
  ohne_erwerb: 'Ohne Erwerb',
  sonstiges: 'Sonstiges',
};
const DOKUMENT_TYP_LABEL: Record<string, string> = {
  wohngeldantrag: 'Wohngeldantrag',
  personalausweis: 'Personalausweis',
  mietvertrag: 'Mietvertrag',
  mietbescheinigung: 'Mietbescheinigung',
  rentenbescheid: 'Rentenbescheid',
  verdienstbescheinigung: 'Verdienstbescheinigung',
  gehaltsabrechnung: 'Gehaltsabrechnung',
  kontoauszug: 'Kontoauszug',
  kv_pv_nachweis: 'KV-/PV-Nachweis',
  schwerbehindertenausweis: 'Schwerbehindertenausweis',
  pflegenachweis: 'Pflegenachweis',
  kindergeldnachweis: 'Kindergeldnachweis',
  unterhaltsnachweis: 'Unterhaltsnachweis',
  transferleistungsbescheid: 'Transferleistungsbescheid',
  vermoegensnachweis: 'Vermögensnachweis',
  sonstiges: 'Sonstiges',
};
const KATEGORIE_LABEL: Record<string, string> = {
  vollstaendigkeit: 'Vollständigkeit',
  plausibilitaet: 'Plausibilität',
};

// ── Hilfen ──────────────────────────────────────────────────────────────────

/** Längenbegrenzung mit Kürzungshinweis. */
function kuerze(text: string, max: number): string {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)} … [gekürzt]`;
}

function euro(n: number | undefined): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '–';
  return `${n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

/** Ein sprechendes, eindeutiges Label je Dokument (für Quellen-Auflösung). */
export function dokumentLabel(dok: Dokument): string {
  const typ = DOKUMENT_TYP_LABEL[dok.typ] ?? dok.typ;
  const zusatz = dok.titel || dok.quelle;
  return zusatz ? `${typ} – ${zusatz}` : typ;
}

function personName(p: Person): string {
  const name = [p.vorname, p.nachname].filter(Boolean).join(' ').trim();
  return name || '(ohne Namen)';
}

// ── Hauptfunktion ─────────────────────────────────────────────────────────

export interface FallKontext {
  text: string;
  dokumente: Array<{ id: string; label: string }>;
}

/** Grenzwerte für die Kontextlänge (Zeichen). */
const MAX_DOK_TEXT = 1200;
const MAX_BELEGTEXT = 400;

export function buildFallKontext(snapshot: VorgangSnapshot, pruefschritte: Pruefschritt[]): FallKontext {
  const { vorgang, personen, dokumente } = snapshot;
  const lines: string[] = [];

  // ── Vorgang ──
  lines.push('## Vorgang');
  lines.push(`- Vorgangsnummer (intern): ${vorgang.antragsId}`);
  if (vorgang.wohngeldnummer) lines.push(`- Wohngeldnummer/Aktenzeichen: ${vorgang.wohngeldnummer}`);
  lines.push(`- Wohngeldart: ${WOHNGELDART_LABEL[vorgang.wohngeldart] ?? vorgang.wohngeldart}`);
  lines.push(`- Antragsart: ${ANTRAGSART_LABEL[vorgang.antragsart] ?? vorgang.antragsart}`);
  lines.push(`- Status: ${STATUS_LABEL[vorgang.status] ?? vorgang.status}`);
  if (vorgang.antragsdatum) lines.push(`- Antragsdatum: ${vorgang.antragsdatum}`);
  if (vorgang.bwz_start || vorgang.bwz_ende) {
    lines.push(`- Bewilligungszeitraum: ${vorgang.bwz_start ?? '?'} bis ${vorgang.bwz_ende ?? '?'}`);
  }
  const w = vorgang.wohnung;
  if (w) {
    const adresse = [w.strasse, w.hausnummer, w.plz, w.ort].filter(Boolean).join(' ');
    if (adresse) lines.push(`- Wohnung: ${adresse}`);
    if (w.wohnflaeche_qm !== undefined) lines.push(`- Wohnfläche: ${w.wohnflaeche_qm} m²`);
    if (w.miete !== undefined) lines.push(`- Bruttokaltmiete (lt. Antrag): ${euro(w.miete)}`);
    if (w.heizkosten !== undefined) lines.push(`- Heizkosten: ${euro(w.heizkosten)}`);
    if (w.warmwasser !== undefined) lines.push(`- Warmwasser: ${euro(w.warmwasser)}`);
  }
  lines.push('');

  // ── Personen ──
  lines.push('## Personen im Haushalt');
  if (personen.length === 0) {
    lines.push('- (keine Personen erfasst)');
  }
  for (const p of personen) {
    lines.push(`### ${personName(p)} (${ROLLE_LABEL[p.rolle] ?? p.rolle})`);
    if (p.geburtsdatum) lines.push(`- Geburtsdatum: ${p.geburtsdatum}`);
    if (p.erwerbsstatus) lines.push(`- Erwerbsstatus: ${ERWERBSSTATUS_LABEL[p.erwerbsstatus] ?? p.erwerbsstatus}`);
    if (p.staatsangehoerigkeit) lines.push(`- Staatsangehörigkeit: ${p.staatsangehoerigkeit}`);
    const pb = p.pflege_behinderung;
    if (pb && (pb.schwerbehinderungsgrad || pb.pflegegrad || pb.pflegebeduerftig)) {
      const merkmale: string[] = [];
      if (pb.schwerbehinderungsgrad) merkmale.push(`GdB ${pb.schwerbehinderungsgrad}`);
      if (pb.pflegegrad) merkmale.push(`Pflegegrad ${pb.pflegegrad}`);
      if (pb.pflegebeduerftig) merkmale.push('pflegebedürftig');
      lines.push(`- Merkmale: ${merkmale.join(', ')}`);
    }
    if (p.erhaelt_kindergeld) lines.push('- Erhält Kindergeld: ja');
    if (p.vermoegen !== undefined) lines.push(`- Vermögen: ${euro(p.vermoegen)}`);
    if (p.transferleistungen && p.transferleistungen.length) {
      lines.push(`- Transferleistungen: ${p.transferleistungen.join(', ')}`);
    }
    const eink = p.einkommen ?? [];
    if (eink.length) {
      lines.push('- Einkommenspositionen:');
      for (const e of eink) {
        const mtl = e.betrag_monatlich !== undefined ? `${euro(e.betrag_monatlich)}/Monat` : undefined;
        const jhr = e.betrag_jaehrlich !== undefined ? `${euro(e.betrag_jaehrlich)}/Jahr` : undefined;
        const betrag = [mtl, jhr].filter(Boolean).join(', ') || 'ohne Betrag';
        const bez = e.bezeichnung ? ` (${e.bezeichnung})` : '';
        const beruecks = e.beruecksichtigt ? '' : ' [noch nicht bestätigt]';
        lines.push(`  - ${e.art}${bez}: ${betrag}${beruecks}`);
      }
    } else {
      lines.push('- Einkommenspositionen: keine erfasst');
    }
    if (p.bemerkung) lines.push(`- Bemerkung: ${kuerze(p.bemerkung, 200)}`);
    lines.push('');
  }

  // ── Gesamteinkommen § 13 ──
  const inputs: GesamteinkommenInput[] = personen.map((person) => ({ person }));
  const ge = gesamteinkommen(inputs);
  lines.push('## Berechnetes Gesamteinkommen (§ 13 WoGG)');
  lines.push('Herleitung (nur strukturell, keine Wohngeld-Betragsberechnung nach § 19):');
  lines.push(`- Summe Jahreseinkommen (§ 14/§ 16): ${euro(ge.summeJahreseinkommen)}`);
  lines.push(`- abzgl. Freibeträge (§ 17): ${euro(ge.summeFreibetraege)}`);
  lines.push(`- abzgl. Unterhaltsabzüge (§ 18): ${euro(ge.unterhaltsabzuege)}`);
  lines.push(`- = Gesamteinkommen/Jahr (§ 13): ${euro(ge.gesamteinkommenJahr)}`);
  lines.push(`- = Gesamteinkommen/Monat (§ 13 Abs. 2): ${euro(ge.gesamteinkommenMonat)}`);
  lines.push('');

  // ── Dokumente ──
  const dokListe: Array<{ id: string; label: string }> = [];
  lines.push('## Dokumente / Nachweise');
  if (dokumente.length === 0) {
    lines.push('- (keine Dokumente vorhanden)');
  }
  for (const d of dokumente) {
    const label = dokumentLabel(d);
    dokListe.push({ id: d.id, label });
    lines.push(`### [${d.id}] ${label}`);
    if (d.seiten) lines.push(`- Seiten: ${d.seiten}`);
    if (d.eingegangenAm) lines.push(`- Eingegangen am: ${d.eingegangenAm}`);
    if (d.flags && d.flags.length) {
      lines.push(`- Hinweise: ${d.flags.map((f) => f.hinweis).join('; ')}`);
    }
    if (d.analyse) {
      const a = d.analyse;
      const felder: string[] = [];
      if (a.miete !== undefined) felder.push(`Miete ${euro(a.miete)}`);
      if (a.wohnflaeche_qm !== undefined) felder.push(`Wohnfläche ${a.wohnflaeche_qm} m²`);
      if (a.betrag !== undefined) felder.push(`Betrag ${euro(a.betrag)}`);
      if (a.unterschrift_vorhanden !== undefined) felder.push(`Unterschrift ${a.unterschrift_vorhanden ? 'vorhanden' : 'fehlt'}`);
      if (a.erkannte_einkuenfte && a.erkannte_einkuenfte.length) felder.push(`erkannte Einkünfte: ${a.erkannte_einkuenfte.join(', ')}`);
      if (felder.length) lines.push(`- Extrahierte Werte: ${felder.join('; ')}`);
    }
    if (d.extrahierterText) {
      lines.push(`- Extrahierter Text: ${kuerze(d.extrahierterText, MAX_DOK_TEXT)}`);
    }
    lines.push('');
  }

  // ── Offene Prüfschritte ──
  const offene = pruefschritte.filter((p) => p.status === 'offen');
  lines.push('## Offene Prüfschritte');
  if (offene.length === 0) {
    lines.push('- (keine offenen Prüfschritte)');
  }
  for (const p of offene) {
    lines.push(`- [${KATEGORIE_LABEL[p.kategorie] ?? p.kategorie}] ${p.titel}`);
    if (p.belegtext) lines.push(`  Begründung: ${kuerze(p.belegtext, MAX_BELEGTEXT)}`);
    if (p.quellDokumentId) lines.push(`  Bezug-Dokument: ${p.quellDokumentId}`);
  }

  return { text: lines.join('\n'), dokumente: dokListe };
}
