/**
 * Wohngeldantrag Mietzuschuss (amtliche Vorlage, 11 Seiten) aus einem Fall ausfüllen.
 *
 * Feldlogik: Haushalt HHM1..4 = WEITERE Haushaltsmitglieder (ohne antragstellende
 * Person); Einnahmen HHM1 = antragstellende Person, HHM2..5 = weitere Mitglieder.
 * Personen ab dem 6. (Haushalt) bzw. 6. (Einnahmen) stehen auf dem Zusatzblatt.
 * Jede Ja/Nein-Frage wird beantwortet; „Ja"-Pfade kommen aus `fall.antrag`.
 */
import { join } from 'node:path';
import { VORLAGEN, datum, eur } from '../lib';
import type { AntragAngaben, ErzeugtesDokument, Fall, Person } from '../types';
import { Formular } from './pdfform';

const GESCHLECHT: Record<Person['geschlecht'], string> = {
  maennlich: 'Männlich', weiblich: 'Weiblich', divers: 'Divers', keineAngabe: 'KeineAngabe',
};
export const FAMSTAND_TEXT: Record<Person['familienstand'], string> = {
  ledig: 'ledig', verheiratet: 'verheiratet', getrenntlebend: 'getrennt lebend', eingLebenspartner: 'eingetragene Lebenspartnerschaft',
  geschieden: 'geschieden', verwitwet: 'verwitwet', nichtehelicheLebenspartner: 'nichteheliche Lebensgemeinschaft',
};
const ERWERB_CB: Record<Person['erwerb'], string> = {
  Arbeitnehmer: 'Arbeitnehmer', 'Selbständiger': 'Selbständiger', Azubi: 'Azubi', Rentner: 'Rentner',
  Nichterwerbsperson: 'Nichterwerbsperson', Arbeitslos: 'Arbeitslos',
};
export const ERWERB_TEXT: Record<Person['erwerb'], string> = {
  Arbeitnehmer: 'Arbeitnehmer/in', 'Selbständiger': 'Selbständig', Azubi: 'Auszubildende/r', Rentner: 'Rentner/in',
  Nichterwerbsperson: 'Nichterwerbsperson', Arbeitslos: 'arbeitslos',
};

const zahl = (n: number) => String(n).replace('.', ',');

/** Welche Miete/Fläche steht im Antrag? (Widerspruchsfälle weichen bewusst ab.) */
export function antragsWerte(fall: Fall) {
  const w = fall.wohnung;
  const a = fall.antrag ?? {};
  const gesamtWirklich = w.grundmiete + w.nebenkosten + w.heizkosten + w.warmwasser + (a.garage ?? 0) + (a.service ?? 0) + (a.haushaltsenergie ?? 0);
  const gesamtmiete = fall.antragAbweichung?.gesamtmiete ?? gesamtWirklich;
  const heizkosten = fall.antragAbweichung?.heizkosten ?? w.heizkosten;
  const flaeche = fall.antragAbweichung?.flaeche ?? w.flaeche;
  const abzuege = heizkosten + w.warmwasser + (a.garage ?? 0) + (a.haushaltsenergie ?? 0);
  return { gesamtmiete, heizkosten, warmwasser: w.warmwasser, flaeche, bruttokalt: Math.round((gesamtmiete - abzuege) * 100) / 100 };
}

export async function erzeugeAntrag(fall: Fall): Promise<ErzeugtesDokument> {
  const f = await Formular.laden(join(VORLAGEN, 'antrag-auf-mietzuschuss-barrierefrei-stand-03.05.23.pdf'));
  const a: AntragAngaben = fall.antrag ?? {};
  if (a.handschrift) f.handschrift = { seed: fall.id };
  const leer = new Set(a.leer ?? []);
  const P = (id: string) => {
    const p = fall.personen.find((x) => x.id === id);
    if (!p) throw new Error(`${fall.id}: Person ${id} unbekannt`);
    return p;
  };
  const [p1, ...weitere] = fall.personen as [Person, ...Person[]];
  const w = fall.wohnung;
  const werte = antragsWerte(fall);
  const heim = a.status === 'heim';

  // ── Seite 1: Antragstyp, Behörde, persönliche Angaben, Wohnung ──
  f.kreuz('CB_AllgAntragstyp_Erstantrag');
  const [jahr, monat] = fall.antragsdatum.split('-');
  f.text('Monat/Jahr_af_date', `${monat}/${jahr!.slice(2)}`);
  f.text('MTF_AllgAnschWoGB', fall.behoerde);
  f.text('MTF_AllgWoGNR_AKZ', fall.wohngeldnummer);
  f.text('ET_PersAngFamilienname', p1.nachname);
  f.text('ET_PersAngVornamen', p1.vorname);
  f.text('ET_PersAngGeburtsname', p1.geburtsname);
  if (!leer.has('P1.geburtsdatum')) f.text('DA_PersAngGeburtsdatum', datum(p1.geburtsdatum));
  f.text('ET_PersAngGeburtsort', p1.geburtsort);
  if (!leer.has('P1.staatsangehoerigkeit')) f.text('ET_PersAngStaatsangehörigkeit', p1.staatsangehoerigkeit);
  f.kreuz(`CB_PersAngGeschlecht${GESCHLECHT[p1.geschlecht]}`);
  f.text('ET_PersAngTelefonnummer', fall.telefon);
  f.text('ET_PersAngE-Mail', fall.email);
  f.kreuz(`CB_PersAngFamStand${p1.familienstand}`);
  f.kreuz(`CB_PersAngErwerb${ERWERB_CB[p1.erwerb]}`);
  f.text('ET_WohnungAnschriftStraße', w.strasse);
  f.text('ET_WohnungAnschriftHausnummer', w.hausnummer);
  f.text('ET_WohnungAnschriftPostleitzahl', w.plz);
  f.text('ET_WohnungAnschriftWohnort', w.ort);
  if (a.zuzug) {
    f.text('ET_WohnungZKAnschriftStraße', a.zuzug.strasse);
    f.text('ET_WohnungZKAnschriftHausnummer', a.zuzug.hausnummer);
    f.text('ET_WohnungZKAnschriftPostleitzahl', a.zuzug.plz);
    f.text('ET_WohnungZKAnschriftWohnort', a.zuzug.ort);
    f.text('DA_WohnungZKAnschriftEinzugsdatum', datum(a.zuzug.einzugsdatum));
  }
  f.jaNein('CB_WohnungGefördert', w.gefoerdert);

  // ── Seite 2–3: weitere Wohnung, Zweitwohnsitz, Haushaltsmitglieder ──
  f.jaNein('CB_WohnungAndereWohnung', !!a.andereWohnungWohngeld);
  f.jaNein('CB_WohnungZweitwohnsitz', !!a.zweitwohnsitz);
  weitere.slice(0, 4).forEach((p, i) => {
    const n = i + 1;
    f.text(`ET_HaushaltHHM${n}Familienname`, p.nachname);
    f.text(`ET_HaushaltHHM${n}Vornamen`, p.vorname);
    f.text(`ET_HaushaltHHM${n}Geburtsname`, p.geburtsname);
    // HHM4-Datumsfeld heißt in der Vorlage fälschlich „DA_ HaushaltHHM4Geburtsname"
    if (!leer.has(`${p.id}.geburtsdatum`)) f.text(n === 4 ? 'DA_HaushaltHHM4Geburtsname' : `DA_HaushaltHHM${n}Geburtsdatum`, datum(p.geburtsdatum));
    f.text(`ET_HaushaltHHM${n}Geburtsort`, p.geburtsort);
    if (!leer.has(`${p.id}.staatsangehoerigkeit`)) f.text(n >= 3 ? `ET_HaushaltHHM${n}Staatsangehörigkeit2` : `ET_HaushaltHHM${n}Staatsangehörigkeiten`, p.staatsangehoerigkeit);
    f.kreuz(`CB_HaushaltHHM${n}Geschlecht${GESCHLECHT[p.geschlecht]}`);
    // Vorlage: „HHM1FamStand" hat ein zweites Widget an der Stelle des 4. Mitglieds (Seite 3);
    // ein eigenes HHM4-Feld fehlt. HHM1 nur auf Seite 2, HHM4 frei an die Position schreiben.
    if (n === 1) f.text('ET_HaushaltHHM1FamStand', FAMSTAND_TEXT[p.familienstand], undefined, 2);
    else if (n === 4) f.textAn(3, 113, 669, 200, 18, FAMSTAND_TEXT[p.familienstand]);
    else f.text(`ET_HaushaltHHM${n}FamStand`, FAMSTAND_TEXT[p.familienstand]);
    f.text(`ET_HaushaltHHM${n}VerhältnisAngP`, p.verhaeltnis);
    f.text(`ET_HaushaltHHM${n}ErwerbStatus`, ERWERB_TEXT[p.erwerb]);
  });
  if (a.drittstaatVerpflichtung !== undefined) f.jaNein('CB_DrittStaatKostentragen', a.drittstaatVerpflichtung);
  f.jaNein('CB_WeiterePersonen', !!a.mitbewohner?.length);
  a.mitbewohner?.slice(0, 2).forEach((m, i) => {
    f.text(`ET_WeiterePersonFamilienname${i + 1}`, m.nachname);
    f.text(`ET_WeiterePersonVornamename${i + 1}`, m.vorname);
  });
  f.jaNein('CB_VerändHHMVerstorben', !!a.verstorben);
  if (a.verstorben) {
    f.text('ET_VerändHHMWerFamilienname', a.verstorben.nachname);
    f.text('ET_VerändHHMWerVorname', a.verstorben.vorname);
    f.text('DA_VerändHHMWann', datum(a.verstorben.datum));
    f.jaNein('CB_VerändHHMVerstorbenTransf', a.verstorben.transfer);
    f.jaNein('CB_VerändHHMTodUmgezogen', a.verstorben.umgezogen);
    f.jaNein('CB_VerändHHMTod', false);
  }

  // ── Seite 4–5: Veränderung Haushalt, Transferleistungen ──
  f.jaNein('CB_VerändHHMAnzahl', !!a.haushaltAenderung);
  if (a.haushaltAenderung) {
    f.text('DA_VerändHHMAnzahlDatum', datum(a.haushaltAenderung.datum));
    f.text('ET_VerändHHMAnzahlGrund', a.haushaltAenderung.grund);
  }
  if (a.umzugGeplant) f.text('DA_VerändHHMAnzahlWann', datum(a.umzugGeplant));
  f.jaNein('CB_TransfLeistung', !!a.transfer?.length);
  a.transfer?.slice(0, 3).forEach((t, i) => {
    const n = i + 1;
    const p = P(t.person);
    f.text(`ET_TransfHHM${n}Familienname`, p.nachname);
    f.text(`ET_TransfHHM${n}Vorname`, p.vorname);
    f.text(`ET_TransfHHM${n}Leistung`, t.leistung);
    if (t.beantragt) f.text(`DA_TransfHHM${n}JaBeantragung`, datum(t.beantragt));
    if (t.bewilligt) f.text(`DA_TransfHHM${n}JaBewilligung`, datum(t.bewilligt));
    if (t.weggefallen) f.text(`DA_TransfHHM${n}JaWegfall`, datum(t.weggefallen));
    if (t.abgelehnt) f.text(`DA_TransfHHM${n}JaAblehnung`, datum(t.abgelehnt));
  });
  f.jaNein('CB_TransfWohngeldBeantragen', !!a.aufforderungTransferbehoerde);

  // ── Seite 5–6: Einnahmen (HHM1 = antragstellende Person) ──
  fall.personen.slice(0, 5).forEach((p, i) => {
    const n = i + 1;
    f.text(`ET_EinnahmeHHM${n}Familienname`, p.nachname);
    f.text(`ET_EinnahmeHHM${n}Vorname`, p.vorname);
    const liste = p.einnahmen.length ? p.einnahmen : [{ art: 'keine Einnahmen', brutto: NaN, turnus: 'monatlich' as const }];
    liste.slice(0, 4).forEach((e, j) => {
      f.text(`ET_EinnahmeHHM${n}Art${j + 1}`, e.art);
      if (Number.isFinite(e.brutto)) {
        f.text(`ET_EinnahmeHHM${n}Art${j + 1}Brutto`, eur(e.brutto));
        f.text(`ET_EinnahmeHHM${n}Art${j + 1}Turnus`, e.turnus);
      }
    });
    f.kreuz(`CB_EinnahmeHHM${n}Steuern`, p.abzuege.steuern);
    f.kreuz(`CB_EinnahmeHHM${n}RVLV`, p.abzuege.rvlv);
    f.kreuz(`CB_EinnahmeHHM${n}KV`, p.abzuege.kv);
  });

  // ── Seite 7: Freibeträge ──
  const name = (id: string, feldFam: string, feldVor: string) => { const p = P(id); f.text(feldFam, p.nachname); f.text(feldVor, p.vorname); };
  f.jaNein('CB_FreiBWerb', !!a.werbungskosten?.length);
  a.werbungskosten?.slice(0, 2).forEach((x, i) => {
    name(x.person, `ET_FreiBWerbHHM${i + 1}Familienname`, `ET_FreiBWerbHHM${i + 1}Vorname`);
    f.text(`ET_FreiBWerbHHM${i + 1}Ausgaben`, eur(x.betrag));
  });
  f.jaNein('CB_FreiBKinderbetreu', !!a.kinderbetreuung?.length);
  a.kinderbetreuung?.slice(0, 2).forEach((x, i) => {
    name(x.person, `ET_FreiKinderbetreuHHM${i + 1}Familienname`, `ET_FreiKinderbetreuHHM${i + 1}Vorname`);
    f.text(`ET_FreiKinderbetreuHHM${i + 1}Ausgaben`, eur(x.betrag));
  });
  f.jaNein('CB_FreiBSchwerBe', !!a.schwerbehinderung?.length);
  a.schwerbehinderung?.slice(0, 2).forEach((x, i) => {
    const n = i + 1;
    name(x.person, `ET_FreiBSchwerBeHHM${n}Familienname`, `ET_FreiBSchwerBeHHM${n}Vorname`);
    if (x.gdb) f.text(`ET_FreiBSchwerBeHHM${n}Behinderungsgrad`, String(x.gdb));
    if (x.pflegegrad) f.text(`ET_FreiBSchwerBeHHM${n}Pflegegrad`, String(x.pflegegrad));
    f.kreuz(`CB_FreiBSchwerBeHHM${n}Pflegebedürftig`, !!x.haeuslich);
  });
  f.jaNein('CB_FreiBUnterh', !!a.unterhaltGezahlt?.length);
  a.unterhaltGezahlt?.slice(0, 2).forEach((u, i) => {
    const z = P(u.zahler);
    if (i === 0) {
      f.text('ET_FreiBUnterhHHM1Familienname', z.nachname);
      f.text('ET_FreiBUnterhHHM1Vorname', z.vorname);
      f.text('ET_FreiBUnterhHHM1FürFamilienname', u.fuer.nachname);
      f.text('ET_FreiBUnterhHHM1FürVorname', u.fuer.vorname);
      f.text('DA_UnterhHHM1FürGeburtsdatum', datum(u.fuer.geburtsdatum));
      f.text('ET_FreiBUnterhHHM1FürAnschrift', u.fuer.anschrift);
      f.text('ET_FreiBUnterhHHM1Verwandt', u.verwandt);
      f.text('ET_FreiBUnterhHHM1Betrag', eur(u.betrag));
    } else {
      f.text('ET_FreiBUnterhHHM2Familienname', z.nachname);
      f.text('ET_FreiBUnterhHHM2Vorname', z.vorname);
      f.text('ET_FreiBUnterhFürHHM2FürFamilienname', u.fuer.nachname);
      f.text('ET_FreiBUnterhFürHHM2FürVorname', u.fuer.vorname);
      f.text('DA_UnterhFürHHM2Geburtsdatum', datum(u.fuer.geburtsdatum));
      f.text('ET_FreiBUnterhFürHHM2FürAnschrift', u.fuer.anschrift);
      f.text('ET_FreiBUnterhFürHHM2Verwandt', u.verwandt);
      f.text('ET_FreiBUnterhHHM2Betrag', eur(u.betrag));
    }
  });

  // ── Seite 8–9: sonstige Einnahmen, Vermögen ──
  f.jaNein('CB_SonstEinUnterh', !!a.unterhaltAnspruch?.length);
  a.unterhaltAnspruch?.slice(0, 2).forEach((x, i) => {
    const n = i + 1;
    name(x.person, `ET_SonstEinUnterhHHM${n}Familienname`, `ET_SonstEinUnterhHHM${n}Vorname`);
    if (x.betrag !== undefined) f.text(`ET_SonstEinUnterhHHM${n}Anspruch`, eur(x.betrag));
    else f.kreuz(`CB_SonstEinUnterhHHM${n}AnspruchNichtbekannt`);
  });
  f.jaNein('CB_SonstEinEinm', !!a.einmalig?.length);
  a.einmalig?.slice(0, 2).forEach((x, i) => {
    const n = i + 1;
    name(x.person, `ET_SonstEinEinmHHM${n}Familienname`, `ET_SonstEinEinmHHM${n}Vorname`);
    // Vorlage: Feld „…Höhe" sitzt unter der Überschrift „Art", Feld „…Art" unter „Betrag".
    f.text(`ET_SonstEinEinmHHM${n}Höhe`, x.art);
    f.text(`ET_SonstEinEinmHHM${n}Art`, eur(x.betrag));
    f.text(`DA_SonstEinEinmHHM${n}DatumZahlung`, datum(x.datum));
  });
  if (a.einnahmeAenderung) {
    f.kreuz(a.einnahmeAenderung.richtung === 'erhoehen' ? 'CB_SonstEinErhJaErh' : 'CB_SonstEinErhJaVer');
    a.einnahmeAenderung.eintraege.slice(0, 2).forEach((x, i) => {
      const n = i + 1;
      name(x.person, `ET_SonstEinErhHHM${n}Familienname`, `ET_SonstEinErhHHM${n}Vorname`);
      // Vorlage: Feldnamen sind gegenüber den Überschriften verschoben (nach Position zugeordnet):
      // unter „Einnahmeart" liegt „…ZeitpunktVeränderung", unter „Zeitpunkt" „…Einnahmeart",
      // unter „Grund" „…Butto", unter „zukünftige Brutto-Einnahmen" „…Grund".
      f.text(`ET_SonstEinErhHHM${n}ZeitpunktVeränderung`, x.art);
      f.text(`ET_SonstEinErhHHM${n}Einnahmeart`, datum(x.zeitpunkt));
      f.text(`ET_SonstEinErhHHM${n}Butto`, x.grund);
      f.text(`ET_SonstEinErhHHM${n}Grund`, eur(x.betrag));
    });
  } else f.kreuz('CB_SonstEinErhNein');
  f.jaNein('CB_SonstEinVermögen', !!a.vermoegen);
  if (a.vermoegen) {
    const v = a.vermoegen;
    if (v.immobilie) { f.kreuz('CB_SonstEinVermögenImmobilie'); f.text('ET_SonstEinVermögenImmobilieWert', eur(v.immobilie)); }
    if (v.geld) { f.kreuz('CB_SonstEinVermögenGeldvermögen'); f.text('ET_SonstEinVermögenGeldvermögenWert', eur(v.geld)); }
    if (v.gegenstaende) { f.kreuz('CB_SonstEinVermögenGegenstände'); f.text('ET_SonstEinVermögenGegenständeWert', eur(v.gegenstaende)); }
    if (v.sonstiges) { f.kreuz('CB_SonstEinVermögenSonstiges'); f.text('ET_SonstEinVermögenSonstigesWert', eur(v.sonstiges)); }
  }

  // ── Seite 10: Miete ──
  const status = a.status ?? 'hauptmieter';
  f.kreuz({ hauptmieter: 'CB_IchBinHauptmieter', untermieter: 'CB_IchBinUntermieter', heim: 'CB_IchBinHeimbewohner', eigentuemerMfh: 'CB_IchBinBewohnerMehr', sonstiges: 'CB_IchBinSonstiges' }[status]);
  if (status === 'sonstiges') f.text('ET_IchBinSonstiges', a.statusSonstiges);
  if (!heim) {
    f.kreuz(a.vermieterVerwandt ? 'CB_IIchBinVerwandtVerJa' : 'CB_IchBinVerwandtVerNein');
    if (!leer.has('flaeche')) f.text('ET_MieteGrößeWohnung', zahl(werte.flaeche));
    if (!leer.has('gesamtmiete')) f.text('ET_MieteGesamt', eur(werte.gesamtmiete));
    const posten = (basis: string, betrag: number | undefined) => {
      if (betrag && betrag > 0) { f.kreuz(`CB_MonatMiete${basis}Ja`); f.text(`ET_MonatMiete${basis}Betrag`, eur(betrag)); }
      else f.kreuz(`CB_MonatMiete${basis}Nein`);
    };
    posten('Heizkostem', werte.heizkosten);
    posten('Warmwasser', werte.warmwasser);
    posten('Garage', a.garage);
    posten('Service', a.service);
    posten('Haushaltsenergie', a.haushaltsenergie);
    f.jaNein('CB_MieteDritte', !!a.kostenDritte);
    if (a.kostenDritte) f.text('ET_MieteDritteBetrag', eur(a.kostenDritte));
    f.jaNein('CB_MieteAnderePers', !!a.zuschussDritter);
    if (a.zuschussDritter) {
      f.text('ET_MieteDritteVonFamilienname', a.zuschussDritter.nachname);
      f.text('ET_MieteDritteVonVornamename', a.zuschussDritter.vorname);
      f.text('ET_MieteDritteVonBetrag', eur(a.zuschussDritter.betrag));
      f.text('ET_MieteDritteVonZeitraum', a.zuschussDritter.zeitraum);
    }
    const aend = a.mieteAenderung;
    if (aend) {
      f.kreuz(aend.richtung === 'erhoehen' ? 'CB_MieteVerÄndJaErhöhen' : 'CB_MieteVerÄndJaVerringern');
      f.text('ET_MieteVerÄndWann', datum(aend.wann));
      f.text('ET_MieteVerÄndGrund', aend.grund);
      f.text('ET_MieteVerÄndZukünftigeMiete', eur(aend.zukuenftig));
    } else f.kreuz('CB_MieteVerÄndNein');
    if (a.beruflichGenutzt) { f.kreuz('CB_NutzWohnraumBeruflich'); f.text('ET_NutzWohnraumBeruflichFläche', zahl(a.beruflichGenutzt)); }
    // ── Seite 11: Frage 28/29 Untervermietung ──
    if (a.untervermietung) {
      const u = a.untervermietung;
      // Vorlage: „…Überlassen" = obere Zeile „anderen Personen … überlassen", „…Entgeltlich" = untere Zeile „… mitbewohnt".
      if (u.art === 'mitbewohnt') { f.kreuz('CB_NutzWohnraumAndPersEntgeltlich'); f.text('ET_NutzWohnraumAndPersEntgeltlichFläche', zahl(u.flaeche)); }
      else { f.kreuz('CB_NutzWohnraumAndPersÜberlassen'); f.text('ET_NutzWohnraumAndPersÜberlassenFläche', zahl(u.flaeche)); }
      f.text('ET_NutzUnterBetrag', eur(u.entgelt));
      if (u.heizung) { f.kreuz('CB_NutzUnterHeizung'); f.text('ET_NutzUnterHeizungBetrag', eur(u.heizung)); }
      if (u.strom) { f.kreuz('CB_NutzUnterHausenergie'); f.text('ET_NutzUnterHausenergieBetrag', eur(u.strom)); }
      if (u.garage) { f.kreuz('CB_NutzUnterGarage'); f.text('ET_NutzUnterGarageBetrag', eur(u.garage)); }
    }
  }

  // ── Seite 11: Zahlung, Bank, Hinweise, Datum, Unterschrift ──
  const zahlung = a.zahlungAn;
  if (zahlung) {
    f.kreuz('CB_AuszahlungHHM');
    f.text('ET_AuszahlungFamilienname', zahlung.nachname);
    f.text('ET_AuszahlungVorname', zahlung.vorname);
    f.text('ET_AuszahlungAnschrift', zahlung.anschrift);
  } else f.kreuz('CB_ZahlungAnMich');
  const iban = zahlung?.iban ?? fall.bank.iban;
  [...iban].forEach((ch, i) => f.text(`AN_IBAN${i + 1}`, ch));
  f.text('ET_AuszahlungNameBank', zahlung?.bank ?? fall.bank.name);
  f.kreuz('CB_HinweisAbfrage');
  if (fall.unterschrift.antragDatum) f.text('DA_HinweisDatumUnterschrift', datum(fall.antragsdatum));
  if (fall.unterschrift.antrag) {
    if (a.bevollmaechtigter) f.unterschrift(11, 330, 62, `${a.bevollmaechtigter.vorname} ${a.bevollmaechtigter.nachname}`, 130);
    else f.unterschrift(11, 105, 62, `${p1.vorname} ${p1.nachname}`, 130);
  }

  const pdf = await f.flach({ titel: `Wohngeldantrag ${p1.nachname}` });
  return {
    art: 'antrag', typ: 'wohngeldantrag', titel: 'Wohngeldantrag (Mietzuschuss)', person: p1.id, pdf,
    erwartet: {
      stammdaten: {
        antragsdatum: fall.unterschrift.antragDatum ? fall.antragsdatum : null,
        wohngeldart: 'mietzuschuss',
        antragsart: fall.antragsart,
        'antragsteller.vorname': p1.vorname,
        'antragsteller.nachname': p1.nachname,
        'antragsteller.geburtsdatum': leer.has('P1.geburtsdatum') ? null : p1.geburtsdatum,
        'adresse.strasse': w.strasse,
        'adresse.hausnummer': w.hausnummer,
        'adresse.plz': w.plz,
        'adresse.ort': w.ort,
        'wohnung.miete': heim || leer.has('gesamtmiete') ? null : werte.bruttokalt,
        'wohnung.wohnflaeche_qm': heim || leer.has('flaeche') ? null : werte.flaeche,
      },
      analyse: {
        unterschrift_vorhanden: fall.unterschrift.antrag,
        datum_vorhanden: fall.unterschrift.antragDatum,
      },
    },
  };
}
