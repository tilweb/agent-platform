/**
 * Wohngeldantrag Mietzuschuss (amtliche Vorlage, 11 Seiten) aus einem Fall ausfüllen.
 *
 * Feldlogik: Haushalt HHM1..4 = WEITERE Haushaltsmitglieder (ohne antragstellende
 * Person); Einnahmen HHM1 = antragstellende Person, HHM2..5 = weitere Mitglieder.
 * Ja/Nein-Fragen werden immer beantwortet (ein echter vollständiger Antrag).
 */
import { join } from 'node:path';
import { VORLAGEN, datum, eur } from '../lib';
import type { ErzeugtesDokument, Fall, Person } from '../types';
import { Formular } from './pdfform';

const GESCHLECHT: Record<Person['geschlecht'], string> = {
  maennlich: 'Männlich', weiblich: 'Weiblich', divers: 'Divers', keineAngabe: 'KeineAngabe',
};
const FAMSTAND_TEXT: Record<Person['familienstand'], string> = {
  ledig: 'ledig', verheiratet: 'verheiratet', getrenntlebend: 'getrennt lebend', eingLebenspartner: 'eingetragene Lebenspartnerschaft',
  geschieden: 'geschieden', verwitwet: 'verwitwet', nichtehelicheLebenspartner: 'nichteheliche Lebensgemeinschaft',
};
const ERWERB_CB: Record<Person['erwerb'], string> = {
  Arbeitnehmer: 'Arbeitnehmer', 'Selbständiger': 'Selbständiger', Azubi: 'Azubi', Rentner: 'Rentner',
  Nichterwerbsperson: 'Nichterwerbsperson', Arbeitslos: 'Arbeitslos',
};
const ERWERB_TEXT: Record<Person['erwerb'], string> = {
  Arbeitnehmer: 'Arbeitnehmer/in', 'Selbständiger': 'Selbständig', Azubi: 'Auszubildende/r', Rentner: 'Rentner/in',
  Nichterwerbsperson: 'Nichterwerbsperson', Arbeitslos: 'arbeitslos',
};

/** Welche Miete/Fläche steht im Antrag? (Widerspruchsfälle weichen bewusst ab.) */
export function antragsWerte(fall: Fall) {
  const w = fall.wohnung;
  const gesamtWirklich = w.grundmiete + w.nebenkosten + w.heizkosten + w.warmwasser;
  const gesamtmiete = fall.antragAbweichung?.gesamtmiete ?? gesamtWirklich;
  const heizkosten = fall.antragAbweichung?.heizkosten ?? w.heizkosten;
  const flaeche = fall.antragAbweichung?.flaeche ?? w.flaeche;
  return { gesamtmiete, heizkosten, warmwasser: w.warmwasser, flaeche, bruttokalt: Math.round((gesamtmiete - heizkosten - w.warmwasser) * 100) / 100 };
}

export async function erzeugeAntrag(fall: Fall): Promise<ErzeugtesDokument> {
  const f = await Formular.laden(join(VORLAGEN, 'antrag-auf-mietzuschuss-barrierefrei-stand-03.05.23.pdf'));
  const [p1, ...weitere] = fall.personen as [Person, ...Person[]];
  const w = fall.wohnung;
  const werte = antragsWerte(fall);

  // ── Seite 1: Antragstyp, Behörde, persönliche Angaben, Wohnung ──
  f.kreuz('CB_AllgAntragstyp_Erstantrag');
  const [jahr, monat] = fall.antragsdatum.split('-');
  f.text('Monat/Jahr_af_date', `${monat}/${jahr!.slice(2)}`);
  f.text('MTF_AllgAnschWoGB', fall.behoerde);
  f.text('MTF_AllgWoGNR_AKZ', fall.wohngeldnummer);
  f.text('ET_PersAngFamilienname', p1.nachname);
  f.text('ET_PersAngVornamen', p1.vorname);
  f.text('ET_PersAngGeburtsname', p1.geburtsname);
  f.text('DA_PersAngGeburtsdatum', datum(p1.geburtsdatum));
  f.text('ET_PersAngGeburtsort', p1.geburtsort);
  f.text('ET_PersAngStaatsangehörigkeit', p1.staatsangehoerigkeit);
  f.kreuz(`CB_PersAngGeschlecht${GESCHLECHT[p1.geschlecht]}`);
  f.text('ET_PersAngTelefonnummer', fall.telefon);
  f.text('ET_PersAngE-Mail', fall.email);
  f.kreuz(`CB_PersAngFamStand${p1.familienstand}`);
  f.kreuz(`CB_PersAngErwerb${ERWERB_CB[p1.erwerb]}`);
  f.text('ET_WohnungAnschriftStraße', w.strasse);
  f.text('ET_WohnungAnschriftHausnummer', w.hausnummer);
  f.text('ET_WohnungAnschriftPostleitzahl', w.plz);
  f.text('ET_WohnungAnschriftWohnort', w.ort);
  f.jaNein('CB_WohnungGefördert', w.gefoerdert);

  // ── Seite 2–3: weitere Wohnung, Zweitwohnsitz, Haushaltsmitglieder ──
  f.jaNein('CB_WohnungAndereWohnung', false);
  f.jaNein('CB_WohnungZweitwohnsitz', false);
  weitere.slice(0, 4).forEach((p, i) => {
    const n = i + 1;
    f.text(`ET_HaushaltHHM${n}Familienname`, p.nachname);
    f.text(`ET_HaushaltHHM${n}Vornamen`, p.vorname);
    f.text(`ET_HaushaltHHM${n}Geburtsname`, p.geburtsname);
    // HHM4-Datumsfeld heißt in der Vorlage fälschlich „DA_ HaushaltHHM4Geburtsname"
    f.text(n === 4 ? 'DA_HaushaltHHM4Geburtsname' : `DA_HaushaltHHM${n}Geburtsdatum`, datum(p.geburtsdatum));
    f.text(`ET_HaushaltHHM${n}Geburtsort`, p.geburtsort);
    f.text(n >= 3 ? `ET_HaushaltHHM${n}Staatsangehörigkeit2` : `ET_HaushaltHHM${n}Staatsangehörigkeiten`, p.staatsangehoerigkeit);
    f.kreuz(`CB_HaushaltHHM${n}Geschlecht${GESCHLECHT[p.geschlecht]}`);
    f.text(`ET_HaushaltHHM${n}FamStand`, FAMSTAND_TEXT[p.familienstand]);
    f.text(`ET_HaushaltHHM${n}VerhältnisAngP`, p.verhaeltnis);
    f.text(`ET_HaushaltHHM${n}ErwerbStatus`, ERWERB_TEXT[p.erwerb]);
  });
  f.jaNein('CB_WeiterePersonen', false);
  f.jaNein('CB_VerändHHMVerstorben', false);

  // ── Seite 4–5: Veränderung Haushalt, Transferleistungen ──
  f.jaNein('CB_VerändHHMAnzahl', false);
  f.jaNein('CB_TransfLeistung', false);
  f.jaNein('CB_TransfWohngeldBeantragen', false);

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

  // ── Seite 7–9: Freibeträge, sonstige Einnahmen, Vermögen ──
  f.kreuz('CB_FreiBWerbNein');
  f.kreuz('CB_FreiBKinderbetreuNein');
  f.kreuz('CB_FreiBSchwerBeNein');
  f.kreuz('CB_FreiBUnterhNein');
  f.kreuz('CB_SonstEinUnterhNein');
  f.kreuz('CB_SonstEinEinmNein');
  f.kreuz('CB_SonstEinErhNein');
  f.kreuz('CB_SonstEinVermögenNein');

  // ── Seite 10: Miete ──
  f.kreuz('CB_IchBinHauptmieter');
  f.kreuz('CB_IchBinVerwandtVerNein');
  f.text('ET_MieteGrößeWohnung', String(werte.flaeche).replace('.', ','));
  f.text('ET_MieteGesamt', eur(werte.gesamtmiete));
  if (werte.heizkosten > 0) { f.kreuz('CB_MonatMieteHeizkostemJa'); f.text('ET_MonatMieteHeizkostemBetrag', eur(werte.heizkosten)); }
  else f.kreuz('CB_MonatMieteHeizkostemNein');
  if (werte.warmwasser > 0) { f.kreuz('CB_MonatMieteWarmwasserJa'); f.text('ET_MonatMieteWarmwasserBetrag', eur(werte.warmwasser)); }
  else f.kreuz('CB_MonatMieteWarmwasserNein');
  f.kreuz('CB_MonatMieteGarageNein');
  f.kreuz('CB_MonatMieteServiceNein');
  f.kreuz('CB_MonatMieteHaushaltsenergieNein');
  f.kreuz('CB_MieteDritteNein');
  f.kreuz('CB_MieteAnderePersNein');
  const veraend = fall.antragAbweichung?.mieteVeraenderung ?? 'nein';
  f.kreuz(veraend === 'erhoehen' ? 'CB_MieteVerÄndJaErhöhen' : 'CB_MieteVerÄndNein');

  // ── Seite 11: Zahlung, Bank, Hinweise, Datum, Unterschrift ──
  f.kreuz('CB_ZahlungAnMich');
  [...fall.bank.iban].forEach((ch, i) => f.text(`AN_IBAN${i + 1}`, ch));
  f.text('ET_AuszahlungNameBank', fall.bank.name);
  f.kreuz('CB_HinweisAbfrage');
  if (fall.unterschrift.antragDatum) f.text('DA_HinweisDatumUnterschrift', datum(fall.antragsdatum));
  if (fall.unterschrift.antrag) f.unterschrift(11, 105, 62, `${p1.vorname} ${p1.nachname}`, 130);

  const pdf = await f.flach({ titel: `Wohngeldantrag ${p1.nachname}` });
  return {
    art: 'antrag', typ: 'wohngeldantrag', titel: 'Wohngeldantrag (Mietzuschuss)', person: p1.id, pdf,
    erwartet: {
      stammdaten: {
        antragsdatum: fall.unterschrift.antragDatum ? fall.antragsdatum : undefined,
        wohngeldart: 'mietzuschuss',
        antragsart: fall.antragsart,
        'antragsteller.vorname': p1.vorname,
        'antragsteller.nachname': p1.nachname,
        'antragsteller.geburtsdatum': p1.geburtsdatum,
        'adresse.strasse': w.strasse,
        'adresse.hausnummer': w.hausnummer,
        'adresse.plz': w.plz,
        'adresse.ort': w.ort,
        'wohnung.miete': werte.bruttokalt,
        'wohnung.wohnflaeche_qm': werte.flaeche,
      },
      analyse: {
        unterschrift_vorhanden: fall.unterschrift.antrag,
        datum_vorhanden: fall.unterschrift.antragDatum,
      },
    },
  };
}
