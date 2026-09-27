/**
 * Grundsicherung — Demo-Seed (wiederverwendbare Logik).
 *
 * Legt die drei Goldfälle der Spec (docs/grundsicherung-app-spec-2026-09-27.md, „Goldfälle") als
 * durchklickbare Vorgänge an — mit Personen, Dokumenten samt DokumentAnalyse, ausgeführter
 * Prüfung — plus zwei Posteingang-Einträge (Weiterleitung einer anderen Stelle; ausgewertete
 * Nachreichung mit Match-Vorschlag) und den pflegbaren Textbaustein „Rechtsfolgenbelehrung".
 *
 * Alle angelegten Akten/Eingänge tragen `data.demo === true`. Personen/Adressen sind frei erfunden.
 *
 * Aufruf-Kontrakt wie Wohngeld: kein Top-Level-Ausführen, keine DB-Verbindungsverwaltung.
 *  - `reset: false` (Default): create-if-absent — existiert bereits eine Demo-Akte, passiert nichts.
 *  - `reset: true`: vorhandene Demo-Akten (cascadet) und Demo-Eingänge löschen, neu anlegen.
 * Beim Boot eingehängt in `src/index.ts` (gleiche Bedingungen wie der Wohngeld-Seed).
 */
import {
  createAkte, createVorgang, createPerson, createDokument, updateVorgang, createSchreiben, addNotiz,
  setFeldStatus, listPruefschritte, listAkten, deleteAkte, createPosteingang, listPosteingang,
  listTextbausteine, createTextbaustein, getAkte, listPersonen, listVorgaenge, posteingangStore,
} from './storage';
import { pruefeUndSynchronisiere } from './pruefung';
import { generiereAnforderungsschreiben, RECHTSFOLGENBELEHRUNG, TEXTBAUSTEIN_RECHTSFOLGEN } from './schreiben-generator';
import { berechneBwzVorschlag } from './bwz';
import { plusTage, wiedervorlagePufferTage } from './fristen';
import { matchKandidat } from './verteilung';
import { matchVorgaenge } from './matching';
import { genId } from '../_antrag-kern/ids';
import type { Akte, Dokument, DokumentAnalyse, DokumentTyp, Person, Vorgang, VorgangSnapshot, VorgangStatus } from './types';

export interface SeedGrundsicherungResult {
  aktenCreated: number;
  vorgaengeCreated: number;
  skipped: boolean;
}

// ── Reine Fall-Definitionen (auch Grundlage des Seed-Tests) ─────────────────

interface DemoPerson extends Omit<Person, 'id' | 'vorgangId' | 'version' | 'created_at' | 'updated_at'> { key: string }
interface DemoDokument { personKey?: string; typ: DokumentTyp; titel: string; quelle: string; eingegangenAm: string; analyse?: DokumentAnalyse }
export interface DemoFall {
  key: string;
  akte: Omit<Akte, 'id' | 'version' | 'created_at' | 'updated_at'>;
  vorgang: Omit<Vorgang, 'id' | 'akteId' | 'vorgangsnummer' | 'version' | 'created_at' | 'updated_at' | 'status'> & { status: VorgangStatus };
  personen: DemoPerson[];
  dokumente: DemoDokument[];
  /** Erwartete Regel-IDs laut Spec (Goldfall-Abnahme). */
  erwartet: string[];
}

const e = (art: string, betrag_monat: number, traeger?: string) => ({ id: genId('eink'), art, betrag_monat, ...(traeger ? { traeger } : {}) });
const v = (art: string, betrag: number) => ({ id: genId('verm'), art, betrag });

/** Die drei Goldfälle der Spec als Demo-Vorgänge (Werte wie im Abnahmetest der Regel-Engine). */
export function demoFaelle(): DemoFall[] {
  return [
    {
      key: 'schmidt',
      erwartet: ['rentenanpassungsmitteilung', 'plausi-kontoauszug-unerklaerte-eingaenge', 'plausi-heizung-in-miete-unklar', 'betriebsrente-nachweis'],
      akte: { name: 'Schmidt, Erika', antragstellerName: 'Erika Schmidt', strasse: 'Lindenweg', hausnummer: '7', plz: '34117', ort: 'Kassel' },
      vorgang: {
        antragsart: 'erstantrag', anspruchsgrund: 'alter', status: 'warte_auf_rueckmeldung', prioritaet: 'normal',
        sachbearbeiter: 'Jana Krüger', antragsdatum: '2026-06-15', wohnsituation: 'miete', iban: 'DE44500105175407324931',
        wohnung: { strasse: 'Lindenweg', hausnummer: '7', plz: '34117', ort: 'Kassel', heizung_in_miete_enthalten: true, bewohner_anzahl: 1, wohnflaeche_qm: 46 },
        labels: ['Rentnerin', 'Pauschalmiete'],
      },
      personen: [{
        key: 'erika', rolle: 'antragsteller', vorname: 'Erika', nachname: 'Schmidt', geburtsdatum: '1956-09-03', familienstand: 'verwitwet',
        staatsangehoerigkeit: 'deutsch', krankenversicherung: { art: 'pflicht', kasse: 'AOK Hessen' },
        einkommen: [e('altersrente', 780, 'Deutsche Rentenversicherung Hessen')], vermoegen: [v('girokonto', 640)],
        unterhalt_kinder_eltern: { angegeben: true, ueber_100k_moeglich: false },
      }],
      dokumente: [
        { personKey: 'erika', typ: 'grundsicherungsantrag', titel: 'Antrag auf Grundsicherung', quelle: 'antrag_schmidt.pdf', eingegangenAm: '2026-06-15', analyse: { unterschrift_vorhanden: true, datum_vorhanden: true } },
        { personKey: 'erika', typ: 'personalausweis', titel: 'Personalausweis', quelle: 'ausweis_schmidt.pdf', eingegangenAm: '2026-06-15', analyse: { geburtsdatum: '1956-09-03', nachname: 'Schmidt', vorname: 'Erika' } },
        { personKey: 'erika', typ: 'rentenbescheid', titel: 'Rentenbescheid 2025', quelle: 'rentenbescheid_2025.pdf', eingegangenAm: '2026-06-15', analyse: { rentenart: 'altersrente', zahlbetrag: 780, bescheiddatum: '2025-03-12', geburtsdatum: '1956-09-03' } },
        { personKey: 'erika', typ: 'kv_pv_nachweis', titel: 'Mitgliedsbescheinigung AOK', quelle: 'kv_schmidt.pdf', eingegangenAm: '2026-06-15', analyse: { art: 'pflichtversichert (KVdR)' } },
        { typ: 'mietvertrag', titel: 'Mietvertrag (Pauschalmiete)', quelle: 'mietvertrag_schmidt.pdf', eingegangenAm: '2026-06-15', analyse: { mieter: ['Erika Schmidt'], beginn: '2012-05-01', pauschalmiete: 650, heizkosten_enthalten: true, unterschrift_vorhanden: true } },
        {
          personKey: 'erika', typ: 'kontoauszug', titel: 'Kontoauszüge März–Mai 2026', quelle: 'konto_schmidt.pdf', eingegangenAm: '2026-06-15',
          analyse: {
            zeitraum_von: '2026-03-01', zeitraum_bis: '2026-05-31', endsaldo: 655,
            eingaenge: [
              { betrag: 780, verwendungszweck: 'Deutsche Rentenversicherung', art: 'rente', wiederkehrend: true, anzahl: 3 },
              { betrag: 112, verwendungszweck: 'VBL', art: 'betriebsrente', wiederkehrend: true, anzahl: 3 },
            ],
            mietzahlung_erkannt: true, mietzahlung_betrag: 650,
          },
        },
      ],
    },
    {
      key: 'berger',
      erwartet: ['plausi-em-rente-befristet', 'em-feststellung-rv', 'plausi-partner-fehlt', 'vorrang-sgb2-statt-sgb12'],
      akte: { name: 'Berger, Klaus', antragstellerName: 'Klaus Berger', strasse: 'Am Mühlbach', hausnummer: '12', plz: '97082', ort: 'Würzburg' },
      vorgang: {
        antragsart: 'erstantrag', anspruchsgrund: 'erwerbsminderung', status: 'sachbearbeitung', prioritaet: 'hoch',
        sachbearbeiter: 'Jana Krüger', antragsdatum: '2026-09-02', wohnsituation: 'miete', iban: 'DE89370400440532013000',
        wohnung: { strasse: 'Am Mühlbach', hausnummer: '12', plz: '97082', ort: 'Würzburg', kaltmiete: 520, nebenkosten_kalt: 110, heizkosten: 85, bewohner_anzahl: 2, warmwasser: 'zentral' },
        labels: ['EM-Rente'],
      },
      personen: [{
        key: 'klaus', rolle: 'antragsteller', vorname: 'Klaus', nachname: 'Berger', geburtsdatum: '1968-02-10', familienstand: 'verheiratet',
        staatsangehoerigkeit: 'deutsch', erwerbsminderung: { voll: true, befristet_bis: '2027-12-31' },
        krankenversicherung: { art: 'pflicht' }, einkommen: [e('em_rente', 950, 'Deutsche Rentenversicherung Nordbayern')], vermoegen: [],
        unterhalt_kinder_eltern: { angegeben: true },
      }],
      dokumente: [
        { personKey: 'klaus', typ: 'grundsicherungsantrag', titel: 'Antrag auf Grundsicherung', quelle: 'antrag_berger.pdf', eingegangenAm: '2026-09-02', analyse: { unterschrift_vorhanden: true, datum_vorhanden: true } },
        { personKey: 'klaus', typ: 'personalausweis', titel: 'Personalausweis', quelle: 'ausweis_berger.pdf', eingegangenAm: '2026-09-02', analyse: { geburtsdatum: '1968-02-10', nachname: 'Berger', vorname: 'Klaus' } },
        { personKey: 'klaus', typ: 'rentenbescheid', titel: 'Rentenbescheid volle Erwerbsminderung (befristet)', quelle: 'em_rente_berger.pdf', eingegangenAm: '2026-09-02', analyse: { rentenart: 'volle_em', befristet_bis: '2027-12-31', zahlbetrag: 950, bescheiddatum: '2026-07-15', geburtsdatum: '1968-02-10' } },
        { personKey: 'klaus', typ: 'kv_pv_nachweis', titel: 'Mitgliedsbescheinigung', quelle: 'kv_berger.pdf', eingegangenAm: '2026-09-02', analyse: { art: 'pflichtversichert' } },
        { typ: 'mietvertrag', titel: 'Mietvertrag', quelle: 'mietvertrag_berger.pdf', eingegangenAm: '2026-09-02', analyse: { mieter: ['Klaus Berger', 'Sabine Berger'], beginn: '2015-04-01', grundmiete: 520, nebenkosten_kalt: 110, heizkosten: 85, unterschrift_vorhanden: true } },
      ],
    },
    {
      key: 'lehmann',
      erwartet: ['vorrang-wohngeldbescheid-liegt-vor', 'plausi-wohngeld-als-einkommen', 'plausi-vermoegen-ueber-schonbetrag', 'vorrang-vermoegen-ueber-schonbetrag'],
      akte: { name: 'Lehmann, Horst', antragstellerName: 'Horst Lehmann', strasse: 'Hafenstraße', hausnummer: '31', plz: '26789', ort: 'Leer' },
      vorgang: {
        antragsart: 'erstantrag', anspruchsgrund: 'alter', status: 'sachbearbeitung', prioritaet: 'normal',
        sachbearbeiter: 'Tobias Neumann', antragsdatum: '2026-08-20', wohnsituation: 'miete', iban: 'DE12500105170648489890',
        wohnung: { strasse: 'Hafenstraße', hausnummer: '31', plz: '26789', ort: 'Leer', kaltmiete: 480, nebenkosten_kalt: 95, heizkosten: 75, bewohner_anzahl: 1, warmwasser: 'zentral' },
        labels: ['Wohngeld-Bezug', 'Vermögen'],
      },
      personen: [{
        key: 'horst', rolle: 'antragsteller', vorname: 'Horst', nachname: 'Lehmann', geburtsdatum: '1957-11-22', familienstand: 'verwitwet',
        staatsangehoerigkeit: 'deutsch', krankenversicherung: { art: 'pflicht' }, einkommen: [e('altersrente', 1020)],
        vermoegen: [v('sparbuch', 14200), v('girokonto', 900)], unterhalt_kinder_eltern: { angegeben: true },
      }],
      dokumente: [
        { personKey: 'horst', typ: 'grundsicherungsantrag', titel: 'Antrag auf Grundsicherung', quelle: 'antrag_lehmann.pdf', eingegangenAm: '2026-08-20', analyse: { unterschrift_vorhanden: true, datum_vorhanden: true } },
        { personKey: 'horst', typ: 'personalausweis', titel: 'Personalausweis', quelle: 'ausweis_lehmann.pdf', eingegangenAm: '2026-08-20', analyse: { geburtsdatum: '1957-11-22' } },
        { personKey: 'horst', typ: 'rentenbescheid', titel: 'Rentenbescheid (Anpassung 2026)', quelle: 'rente_lehmann.pdf', eingegangenAm: '2026-08-20', analyse: { rentenart: 'altersrente', zahlbetrag: 1020, bescheiddatum: '2026-07-01' } },
        { personKey: 'horst', typ: 'kv_pv_nachweis', titel: 'KV-Nachweis', quelle: 'kv_lehmann.pdf', eingegangenAm: '2026-08-20', analyse: {} },
        { typ: 'mietvertrag', titel: 'Mietvertrag', quelle: 'mietvertrag_lehmann.pdf', eingegangenAm: '2026-08-20', analyse: { mieter: ['Horst Lehmann'], beginn: '2004-10-01', grundmiete: 480, nebenkosten_kalt: 95, heizkosten: 75, unterschrift_vorhanden: true } },
        { typ: 'vermieterbescheinigung', titel: 'Vermieterbescheinigung', quelle: 'vermieter_lehmann.pdf', eingegangenAm: '2026-08-20', analyse: { grundmiete: 480, nebenkosten_kalt: 95, heizkosten: 75 } },
        { typ: 'nebenkostenabrechnung', titel: 'Betriebskostenabrechnung 2025', quelle: 'nk_lehmann.pdf', eingegangenAm: '2026-08-20', analyse: { heizkosten_enthalten: true } },
        { typ: 'wohngeldbescheid', titel: 'Wohngeldbescheid', quelle: 'wohngeld_lehmann.pdf', eingegangenAm: '2026-08-20', analyse: { betrag_monat: 186, bwz_von: '2026-03-01', bwz_bis: '2027-02-28', bescheiddatum: '2026-02-18' } },
        { personKey: 'horst', typ: 'vermoegensnachweis', titel: 'Sparbuch', quelle: 'sparbuch_lehmann.pdf', eingegangenAm: '2026-08-20', analyse: { art: 'sparbuch', stand: 14200, stichtag: '2026-07-31' } },
        {
          personKey: 'horst', typ: 'kontoauszug', titel: 'Kontoauszüge Mai–Juli 2026', quelle: 'konto_lehmann.pdf', eingegangenAm: '2026-08-20',
          analyse: {
            zeitraum_von: '2026-05-01', zeitraum_bis: '2026-07-31', endsaldo: 950,
            eingaenge: [
              { betrag: 1020, verwendungszweck: 'Deutsche Rentenversicherung', art: 'rente', wiederkehrend: true, anzahl: 3 },
              { betrag: 186, verwendungszweck: 'Wohngeld Stadt Leer', art: 'wohngeld', wiederkehrend: true, anzahl: 3 },
            ],
            mietzahlung_erkannt: true, mietzahlung_betrag: 650,
          },
        },
      ],
    },
  ];
}

/** Snapshot eines Demo-Falls (IDs = Schlüssel) — DB-frei, für den Abnahmetest des Seeds. */
export function snapshotAus(fall: DemoFall): VorgangSnapshot {
  const vorgang = { ...fall.vorgang, id: fall.key, akteId: `akte-${fall.key}`, vorgangsnummer: `DEMO-${fall.key}`, version: 1, created_at: '', updated_at: '' } as Vorgang;
  const personen = fall.personen.map(({ key, ...p }) => ({ ...p, id: key, vorgangId: vorgang.id, version: 1, created_at: '', updated_at: '' }) as Person);
  const dokumente = fall.dokumente.map((d, i) => ({
    id: `${fall.key}-dok-${i + 1}`, vorgangId: vorgang.id, personId: d.personKey, typ: d.typ, titel: d.titel, quelle: d.quelle,
    istOriginal: false, eingegangenAm: d.eingegangenAm, analyse: d.analyse, version: 1, created_at: '', updated_at: '',
  }) as Dokument);
  return { vorgang, personen, dokumente };
}

// ── Anlegen (IO) ─────────────────────────────────────────────────────────────

async function legeFallAn(fall: DemoFall): Promise<Vorgang> {
  const akte = await createAkte({ ...fall.akte, demo: true } as Parameters<typeof createAkte>[0]);
  const bwz = berechneBwzVorschlag(fall.vorgang.antragsdatum);
  let vorgang = await createVorgang({ ...fall.vorgang, akteId: akte.id, ...(bwz ? { bwz } : {}) });
  const ids = new Map<string, string>();
  for (const { key, ...p } of fall.personen) ids.set(key, (await createPerson({ ...p, vorgangId: vorgang.id })).id);
  for (const d of fall.dokumente) {
    await createDokument({
      vorgangId: vorgang.id, typ: d.typ, titel: d.titel, quelle: d.quelle, istOriginal: false,
      eingegangenAm: d.eingegangenAm, analyse: d.analyse ?? {}, ...(d.personKey ? { personId: ids.get(d.personKey) } : {}),
    });
  }
  await pruefeUndSynchronisiere(vorgang.id);

  if (fall.key === 'schmidt') {
    // Nachforderung erzeugt und versendet → wartet auf Rückmeldung (Frist/Wiedervorlage).
    const personen = await listPersonen(vorgang.id);
    const entwurf = generiereAnforderungsschreiben(vorgang, personen, await listPruefschritte(vorgang.id), { stichtag: '2026-09-20' });
    await createSchreiben({ vorgangId: vorgang.id, ...entwurf });
    vorgang = (await updateVorgang(vorgang.id, { frist: entwurf.frist, wiedervorlage: plusTage(entwurf.frist, wiedervorlagePufferTage()) ?? entwurf.frist })) ?? vorgang;
    await addNotiz({ vorgangId: vorgang.id, anker: `person:${ids.get('erika')}`, autor: 'Jana Krüger', text: 'Kontoauszug zeigt monatlich 112 € von der VBL — im Antrag nicht angegeben. Leistungsmitteilung angefordert.' });
  }
  if (fall.key === 'berger') {
    // Aus dem Antrag gelesene Werte als noch unbestätigte KI-Vorschläge.
    for (const feldPfad of ['antragsdatum', 'wohnung.kaltmiete', 'wohnung.nebenkosten_kalt', 'wohnung.heizkosten']) {
      await setFeldStatus({ vorgangId: vorgang.id, zielTyp: 'vorgang', zielId: vorgang.id, feldPfad, quelle: 'llm', bestaetigt: false, confidence: 0.86 });
    }
  }
  return vorgang;
}

async function legePosteingangAn(): Promise<void> {
  // A) Weiterleitung der Wohngeldstelle, noch nicht ausgewertet (Ersteingang dort am 03.09.2026).
  await createPosteingang({
    quelle: 'weiterleitung', eingegangenAm: '2026-09-03T09:12:00.000Z', status: 'eingegangen',
    betreff: 'Weitergeleitet von Wohngeldstelle Stadt Leer', hash: 'gs-demo-eingang-a',
    data: { demo: true, weitergeleitetVon: 'Wohngeldstelle Stadt Leer' },
    dateien: [{ dateiname: 'weiterleitung_antrag_meyer.pdf', contentType: 'application/pdf', groesse: 418220, hash: 'gs-demo-a-1' }],
  });

  // B) Ausgewertete Nachreichung (Rentenanpassungsmitteilung Erika Schmidt) mit Match-Vorschlag.
  const identitaet = { nachname: 'Schmidt', vorname: 'Erika', geburtsdatum: '1956-09-03' };
  const vorgaenge = await listVorgaenge();
  const kandidaten = await Promise.all(vorgaenge.map(async (x) => matchKandidat(x, await getAkte(x.akteId), await listPersonen(x.id))));
  await createPosteingang({
    quelle: 'manuell', eingegangenAm: '2026-09-24T10:40:00.000Z', status: 'analysiert',
    betreff: 'Schmidt, Erika', hash: 'gs-demo-eingang-b', data: { demo: true },
    matchVorschlag: matchVorgaenge(identitaet, kandidaten),
    dateien: [{
      dateiname: 'rentenanpassung_2026_schmidt.pdf', contentType: 'application/pdf', groesse: 96114, hash: 'gs-demo-b-1',
      typ: 'rentenanpassungsmitteilung', titel: 'Rentenanpassungsmitteilung',
      analyse: { stichtag: '2026-07-01', zahlbetrag_alt: 780, zahlbetrag_neu: 813.5 },
      identitaet,
      extraktion: { felder: [
        { gruppe: 'Rentenanpassungsmitteilung', label: 'Anpassung zum', wert: '01.07.2026' },
        { gruppe: 'Rentenanpassungsmitteilung', label: 'Bisheriger Zahlbetrag in EUR/Monat', wert: '780,00 €' },
        { gruppe: 'Rentenanpassungsmitteilung', label: 'Neuer Zahlbetrag in EUR/Monat', wert: '813,50 €' },
      ] },
      extrahierterTextGekuerzt: 'Renten Service — Mitteilung über die Anpassung Ihrer Rente zum 1. Juli 2026 … Erika Schmidt …',
    }],
  });
}

async function findeDemoAkten(): Promise<string[]> {
  return (await listAkten()).filter((a) => (a as unknown as { demo?: boolean }).demo === true).map((a) => a.id);
}
async function findeDemoPosteingang(): Promise<string[]> {
  return (await listPosteingang()).filter((p) => (p.data as { demo?: boolean } | undefined)?.demo === true).map((p) => p.id);
}

/** Befüllt die Grundsicherungs-App mit den Demo-Fällen (idempotent, siehe Kopfkommentar). */
export async function seedGrundsicherungDemo(opts: { reset?: boolean } = {}): Promise<SeedGrundsicherungResult> {
  const bestehende = await findeDemoAkten();
  if (!opts.reset && bestehende.length > 0) return { aktenCreated: 0, vorgaengeCreated: 0, skipped: true };
  if (opts.reset) {
    for (const id of bestehende) await deleteAkte(id);
    for (const id of await findeDemoPosteingang()) await posteingangStore.deletePosteingang(id);
  }
  if (!(await listTextbausteine()).some((t) => t.titel.trim().toLowerCase() === TEXTBAUSTEIN_RECHTSFOLGEN.toLowerCase())) {
    await createTextbaustein({ kategorie: 'Mitwirkung', titel: TEXTBAUSTEIN_RECHTSFOLGEN, text: RECHTSFOLGENBELEHRUNG });
  }
  let vorgaenge = 0;
  for (const fall of demoFaelle()) { await legeFallAn(fall); vorgaenge++; }
  if ((await findeDemoPosteingang()).length === 0) await legePosteingangAn();
  return { aktenCreated: vorgaenge, vorgaengeCreated: vorgaenge, skipped: false };
}
