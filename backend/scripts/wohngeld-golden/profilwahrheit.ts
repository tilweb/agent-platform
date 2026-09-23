/**
 * Wahrheit des Golden Datasets in den Begriffen des DP-Segmentprofils „Wohngeld-Eingang"
 * (je Abschnittstyp ein Objekt bzw. bei wiederholbaren Typen ein Array in Seitenreihenfolge).
 * Grundlage für die Testbeispiele im Profil (DP-Eval). Reine Funktion.
 *
 * Die DP-Eval vergleicht Abschnitte als GANZE Instanzen (stabiler Hash) — daher werden
 * genau die Profilfelder befüllt, deren Wert aus Fall + Erwartungsdatei eindeutig folgt.
 */
import type { ExtractionProject } from '../../src/extraction/learning/types';

/** Dokumentart des Generators → Abschnittstyp des Profils (leerseite = kein Abschnitt). */
export const ART_ZU_ABSCHNITT: Record<string, string | null> = {
  antrag: 'wohngeldantrag', zusatzblatt_haushalt: 'zusatzblatt',
  vermieterbescheinigung: 'vermieterbescheinigung', mietvertrag: 'mietvertrag', untermietvertrag: 'untermietvertrag',
  heimvertrag: 'heimvertrag', mieterhoehung: 'mieterhoehung',
  personalausweis: 'personalausweis', aufenthaltstitel: 'aufenthaltstitel',
  gehaltsabrechnung: 'gehaltsabrechnung', verdienstbescheinigung: 'verdienstbescheinigung',
  alg1_bescheid: 'lohnersatzbescheid', elterngeldbescheid: 'lohnersatzbescheid', bafoeg_bescheid: 'lohnersatzbescheid',
  steuerbescheid: 'steuerunterlagen', euer: 'steuerunterlagen',
  rentenbescheid: 'rentenbescheid', kontoauszug: 'kontoauszug',
  kv_karte: 'kv_nachweis', kv_beitragsnachweis: 'kv_nachweis',
  schwerbehindertenausweis: 'schwerbehindertenausweis', pflegebescheid: 'pflegebescheid',
  kindergeldbescheid: 'kindergeldbescheid',
  uvs_bescheid: 'unterhaltsnachweis', unterhaltsanlage: 'unterhaltsnachweis', unterhaltszahlung: 'unterhaltsnachweis',
  buergergeld_bescheid: 'transferleistungsbescheid', jobcenter_ablehnung: 'transferleistungsbescheid',
  depotauszug: 'vermoegensnachweis',
  leerseite: null,
};

export interface FallFuerWahrheit {
  wohngeldnummer?: string;
  antragsart: string;
  antragsdatum: string;
  personen: Array<{ id: string; vorname: string; nachname: string; geburtsdatum: string; rente?: { art: string } }>;
  wohnung: { strasse: string; hausnummer: string; plz: string; ort: string; flaeche: number; grundmiete: number; nebenkosten: number; heizkosten: number; warmwasser: number };
  antragAbweichung?: { gesamtmiete?: number; heizkosten?: number; flaeche?: number };
  mieterhoehung?: { alteGrundmiete: number };
  unterschrift: { antrag: boolean; antragDatum: boolean; mietvertrag: boolean };
  antrag?: { leer?: string[]; status?: string; garage?: number; haushaltsenergie?: number; service?: number };
  dokumente: Array<{ art: string; person?: string; optionen?: Record<string, unknown> }>;
}

export interface ErwartungFuerWahrheit {
  dokumente: Array<{ art: string; seiteVon: number; seiteBis: number; person?: string; erwartet?: { analyse?: Record<string, unknown>; identitaet?: Record<string, unknown>; stammdaten?: Record<string, unknown> } }>;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const oderNull = (n: number | undefined) => (n && n > 0 ? n : null);
const beleg = (label: string, von: number, bis: number) => `${label}, Seite${von === bis ? ` ${von}` : `n ${von}–${bis}`}`;

export function profilWahrheit(fall: FallFuerWahrheit, erw: ErwartungFuerWahrheit, profil: ExtractionProject): Record<string, unknown> {
  const defs = profil.segments ?? {};
  const out: Record<string, unknown> = {};
  const p1 = fall.personen[0]!;
  const w = fall.wohnung;
  const a = fall.antrag ?? {};
  const leer = new Set(a.leer ?? []);
  const gesamtWirklich = w.grundmiete + w.nebenkosten + w.heizkosten + w.warmwasser;
  const person = (id?: string) => fall.personen.find((p) => p.id === (id ?? 'P1')) ?? p1;

  erw.dokumente.forEach((d, i) => {
    const typ = ART_ZU_ABSCHNITT[d.art] === undefined ? 'sonstiges' : ART_ZU_ABSCHNITT[d.art];
    if (!typ) return;
    const def = defs[typ];
    if (!def) return;
    const spec = fall.dokumente[i] ?? { art: d.art };
    const an = d.erwartet?.analyse ?? {};
    const id = d.erwartet?.identitaet ?? {};
    const namen = { nachname: (id.nachname as string) ?? person(d.person).nachname, vorname: (id.vorname as string) ?? person(d.person).vorname };
    let werte: Record<string, unknown>;

    switch (typ) {
      case 'wohngeldantrag': {
        // „Nicht auslesbar" aus der Erwartungsdatei (z. B. fehlende Antragsseite 10 in F30).
        const sd = d.erwartet?.stammdaten ?? {};
        const heim = a.status === 'heim' || sd['wohnung.miete'] === null;
        if (sd['wohnung.wohnflaeche_qm'] === null) leer.add('flaeche');
        const gesamt = fall.antragAbweichung?.gesamtmiete ?? (gesamtWirklich + (a.garage ?? 0) + (a.service ?? 0) + (a.haushaltsenergie ?? 0));
        werte = {
          antragsdatum: fall.unterschrift.antragDatum ? fall.antragsdatum : null,
          wohngeldart: 'mietzuschuss', antragsart: fall.antragsart, wohngeldnummer: fall.wohngeldnummer ?? null,
          antragsteller_nachname: p1.nachname, antragsteller_vorname: p1.vorname,
          antragsteller_geburtsdatum: leer.has('P1.geburtsdatum') ? null : p1.geburtsdatum,
          strasse: w.strasse, hausnummer: w.hausnummer, plz: w.plz, ort: w.ort,
          wohnflaeche_qm: heim || leer.has('flaeche') ? null : (fall.antragAbweichung?.flaeche ?? w.flaeche),
          gesamtmiete: heim || leer.has('gesamtmiete') ? null : r2(gesamt),
          heizkosten: heim ? null : oderNull(fall.antragAbweichung?.heizkosten ?? w.heizkosten),
          warmwasser: heim ? null : oderNull(w.warmwasser),
          garage: heim ? null : oderNull(a.garage),
          haushaltsenergie: heim ? null : oderNull(a.haushaltsenergie),
          unterschrift_vorhanden: fall.unterschrift.antrag, datum_vorhanden: fall.unterschrift.antragDatum,
        };
        break;
      }
      case 'vermieterbescheinigung':
        werte = { ...namen, wohnflaeche_qm: w.flaeche, gesamtmiete: r2(gesamtWirklich), heizkosten: oderNull(w.heizkosten), warmwasser: oderNull(w.warmwasser), unterschrift_vorhanden: true };
        break;
      case 'mietvertrag': {
        const grund = fall.mieterhoehung?.alteGrundmiete ?? w.grundmiete;
        werte = { ...namen, wohnflaeche_qm: w.flaeche, grundmiete: grund, nebenkosten: w.nebenkosten, heizkosten: oderNull(w.heizkosten), warmwasser: oderNull(w.warmwasser), gesamtmiete: r2(grund + w.nebenkosten + w.heizkosten + w.warmwasser), unterschrift_vorhanden: fall.unterschrift.mietvertrag };
        break;
      }
      case 'untermietvertrag':
        werte = { ...namen, zimmer_qm: an.wohnflaeche_qm ?? null, entgelt: an.miete ?? null, unterschrift_vorhanden: an.unterschrift_vorhanden ?? true };
        break;
      case 'heimvertrag':
        werte = { ...namen, unterkunft_gesamt: an.miete ?? null, unterschrift_vorhanden: an.unterschrift_vorhanden ?? true };
        break;
      case 'mieterhoehung':
        werte = { nachname: p1.nachname, vorname: p1.vorname, neue_gesamtmiete: r2(gesamtWirklich), heizung_warmwasser: r2(w.heizkosten + w.warmwasser) };
        break;
      case 'personalausweis':
      case 'aufenthaltstitel':
        werte = { ...namen, geburtsdatum: (id.geburtsdatum as string) ?? person(d.person).geburtsdatum };
        break;
      case 'gehaltsabrechnung': werte = { ...namen, brutto: an.betrag ?? null }; break;
      case 'verdienstbescheinigung': werte = { ...namen, monatsbrutto: an.betrag ?? null }; break;
      case 'lohnersatzbescheid':
      case 'kindergeldbescheid':
      case 'unterhaltsnachweis': werte = { ...namen, betrag: an.betrag ?? null }; break;
      case 'steuerunterlagen': werte = { ...namen, jahreseinkuenfte: an.betrag ?? null }; break;
      case 'rentenbescheid': werte = { ...namen, rentenart: person(d.person).rente?.art ?? null, betrag: an.betrag ?? null, grundrentenzeiten_vorhanden: false }; break;
      case 'kontoauszug': {
        const buchungen = ((spec.optionen?.buchungen as Array<{ text?: string; zweck?: string; betrag: number }>) ?? []);
        const plus = (re: RegExp) => buchungen.some((b) => b.betrag > 0 && re.test(`${b.text ?? ''} ${b.zweck ?? ''}`));
        werte = { nachname: p1.nachname, vorname: p1.vorname, mietzahlung_erkannt: an.mietzahlung_erkannt ?? true, kapitalertraege_erkannt: plus(/zins|dividend|ertrag|ausschüttung/i), mieteinnahmen_erkannt: plus(/untermiet|mieteinnahm/i) };
        break;
      }
      case 'schwerbehindertenausweis': werte = { ...namen, gdb: (spec.optionen?.gdb as number) ?? 50 }; break;
      case 'pflegebescheid': werte = { ...namen, pflegegrad: (spec.optionen?.pflegegrad as number) ?? 2 }; break;
      case 'vermoegensnachweis': werte = { ...namen, gesamtwert: an.betrag ?? null }; break;
      case 'kv_nachweis':
      case 'transferleistungsbescheid': werte = { ...namen }; break;
      default: werte = { _beleg: beleg(def.label, d.seiteVon, d.seiteBis) }; // classify-only
    }
    if (def.mode === 'classify-only') werte = { _beleg: beleg(def.label, d.seiteVon, d.seiteBis) };
    if (def.repeatable) out[typ] = [...((out[typ] as unknown[]) ?? []), werte];
    else out[typ] = werte;
  });
  return out;
}
