/**
 * Grundsicherung → Grunddaten-Vertrag für eine spätere Vorrang-Einschätzung (Wohngeld ↔ Grundsicherung).
 * Reine Funktion, DB-frei, keine Berechnung. Vertrag: apps/_vorrang/grunddaten.ts.
 *
 * Merkmale, die die Regel-Engine schon auswertet (Altersgrenze mit belegtem Geburtsdatum,
 * dauerhafte volle Erwerbsminderung aus Bescheid/Feststellung/Angabe), kommen aus denselben
 * Helfern (`checker/helfer.ts`), damit Grunddaten und Prüfschritte nicht auseinanderlaufen.
 *
 * Nicht erfasst (bleibt `undefined`): Bruttokaltmiete (Kosten liegen getrennt vor und werden
 * nicht addiert), Warmwasserkosten, Steuern, Brutto/Netto der Einkommensangaben, Verwandtschaft
 * von Haushaltsangehörigen.
 */
import { dayPart } from '../kern/datum';
import {
  artAusStichworten, einkommensartAus, EINKOMMENSART_AUS_GRUNDSICHERUNG, RENTENART_AUS_GRUNDSICHERUNG,
  TRANSFERART_AUS_GRUNDSICHERUNG_VORBEZUG, TRANSFERART_STICHWORTE, vermoegensartAus,
  VERMOEGENSART_AUS_GRUNDSICHERUNG, VORRANG_GRUNDDATEN_VERSION,
  type VorrangAbzuege, type VorrangAlterEm, type VorrangEingang, type VorrangEinkommen, type VorrangGrunddaten,
  type VorrangHaushaltsmitglied, type VorrangPartnerschaft, type VorrangRentenart, type VorrangTransferleistung,
  type VorrangVermoegen, type VorrangVerwandtschaft,
} from '../vorrang/grunddaten';
import { altersgrenzeErreicht, altersgrenzeErreichtAm, analysen, baueKontext, emBefund, geburtsdatumBelegt } from './checker/helfer';
import type { Familienstand, Person, VorgangSnapshot } from './types';

const ROLLEN_REIHENFOLGE: Record<Person['rolle'], number> = { antragsteller: 0, partner: 1, haushaltsangehoerig: 2 };

const PARTNERSCHAFT_AUS_FAMILIENSTAND: Partial<Record<Familienstand, VorrangPartnerschaft>> = {
  verheiratet: 'verheiratet', lebenspartnerschaft: 'lebenspartnerschaft', eheaehnlich: 'eheaehnlich',
};
const OHNE_PARTNER: Partial<Record<Familienstand, VorrangPartnerschaft>> = {
  ledig: 'keine', geschieden: 'keine', verwitwet: 'keine', getrennt_lebend: 'getrennt_lebend',
};
const VERWANDTSCHAFT_PARTNER: Partial<Record<VorrangPartnerschaft, VorrangVerwandtschaft>> = {
  verheiratet: 'ehegatte', lebenspartnerschaft: 'lebenspartner', eheaehnlich: 'eheaehnlich',
};

/** EM-Rentenart aus der Erfassung, soweit eindeutig. */
function emRentenart(p: Person): VorrangRentenart {
  if (p.erwerbsminderung?.voll === true) return 'volle_em';
  if (p.erwerbsminderung?.voll === false) return 'teilweise_em';
  return 'em_unbestimmt';
}

/**
 * Stichtag der Altersgrenze ist das maßgebliche Antragsdatum (früheres von Antragsdatum und
 * Ersteingang, § 16 Abs. 2 SGB I); ohne Datum bleibt `altersgrenze_erreicht` unbekannt.
 */
export function grunddatenFuerVorrangpruefung(snapshot: VorgangSnapshot): VorrangGrunddaten {
  const ctx = baueKontext(snapshot);
  const { vorgang, dokumente } = snapshot;
  const personen = [...snapshot.personen].sort((a, b) => ROLLEN_REIHENFOLGE[a.rolle] - ROLLEN_REIHENFOLGE[b.rolle]);
  const antragsteller = personen.find((p) => p.rolle === 'antragsteller');
  const partner = personen.find((p) => p.rolle === 'partner');

  let partnerschaft: VorrangPartnerschaft | undefined;
  if (partner) {
    partnerschaft = (partner.familienstand && PARTNERSCHAFT_AUS_FAMILIENSTAND[partner.familienstand])
      || (antragsteller?.familienstand && PARTNERSCHAFT_AUS_FAMILIENSTAND[antragsteller.familienstand])
      || undefined;
  } else if (antragsteller?.familienstand) {
    partnerschaft = OHNE_PARTNER[antragsteller.familienstand];
  }

  const haushalt: VorrangHaushaltsmitglied[] = personen.map((p) => ({
    rolle: p.rolle,
    geburtsdatum: geburtsdatumBelegt(ctx, p),
    verwandtschaft: p.rolle === 'partner' && partnerschaft ? VERWANDTSCHAFT_PARTNER[partnerschaft] : undefined,
    // `[]` = ausdrücklich kein Vermögen; fehlt = keine Angabe.
    vermoegen_angegeben: Array.isArray(p.vermoegen) ? true : undefined,
    personId: p.id,
  }));

  const einkommen: VorrangEinkommen[] = [];
  const vermoegen: VorrangVermoegen[] = [];
  const transferleistungen: VorrangTransferleistung[] = [];
  personen.forEach((p, i) => {
    for (const e of p.einkommen ?? []) {
      const art = einkommensartAus(EINKOMMENSART_AUS_GRUNDSICHERUNG, e.art);
      let rentenart = RENTENART_AUS_GRUNDSICHERUNG[e.art];
      if (rentenart === 'em_unbestimmt') rentenart = emRentenart(p);
      einkommen.push({ person: i, art, art_quelle: e.art, ...(rentenart ? { rentenart } : {}), betrag_monat: e.betrag_monat });
      if (art === 'wohngeld') transferleistungen.push({ person: i, art: 'wohngeld', art_quelle: e.art, stand: 'bezug', herkunft: 'angabe' });
      if (e.art === 'grundsicherungsgeld') transferleistungen.push({ person: i, art: 'sgb2', art_quelle: e.art, stand: 'bezug', herkunft: 'angabe' });
    }
    for (const v of p.vermoegen ?? []) {
      vermoegen.push({
        person: i, art: vermoegensartAus(VERMOEGENSART_AUS_GRUNDSICHERUNG, v.art), art_quelle: v.art, betrag: v.betrag,
        ...(v.schonvermoegen !== undefined ? { schonvermoegen: v.schonvermoegen } : {}),
      });
    }
  });

  const alter_em: VorrangAlterEm[] = personen.map((p, i) => {
    const em = emBefund(ctx, p);
    const eg = p.erwerbsminderung;
    let em_voll_dauerhaft: boolean | undefined;
    if (em.befristet || em.teilweiseOderArbeitsmarkt || em.feststellung?.dauerhaft === false) em_voll_dauerhaft = false;
    else if (em.dauerhaftBelegt || (eg?.voll === true && eg.dauerhaft === true)) em_voll_dauerhaft = true;
    else if (eg?.dauerhaft === false) em_voll_dauerhaft = false;
    return {
      person: i,
      altersgrenze_erreicht: ctx.antragsdatum ? altersgrenzeErreicht(ctx, p) ?? undefined : undefined,
      altersgrenze_am: altersgrenzeErreichtAm(geburtsdatumBelegt(ctx, p)) ?? undefined,
      em_voll_dauerhaft,
    };
  });

  const abzuege: VorrangAbzuege[] = personen.map((p, i) => {
    const kv = p.krankenversicherung;
    const selbst = kv?.art === 'freiwillig' || kv?.art === 'privat' ? true
      : kv?.art === 'pflicht' || kv?.art === 'familie' || kv?.art === 'keine' ? false : undefined;
    return { person: i, kv_pv_selbst_gezahlt: selbst, kv_pv_beitrag_monat: kv?.beitrag };
  });

  // Transferleistungen: Vorbezug, Wohngeldbescheide, paralleler Wohngeldantrag.
  if (vorgang.vorbezug?.leistung) {
    const l = vorgang.vorbezug.leistung;
    transferleistungen.push({
      art: TRANSFERART_AUS_GRUNDSICHERUNG_VORBEZUG[l] ?? artAusStichworten(TRANSFERART_STICHWORTE, l) ?? 'sonstige',
      art_quelle: l, stand: 'bezug', bis: dayPart(vorgang.vorbezug.bis) ?? undefined, herkunft: 'angabe',
    });
  }
  for (const { dok, a } of analysen(dokumente, 'wohngeldbescheid')) {
    const idx = dok.personId ? personen.findIndex((p) => p.id === dok.personId) : -1;
    transferleistungen.push({
      ...(idx >= 0 ? { person: idx } : {}), art: 'wohngeld', art_quelle: 'wohngeldbescheid', stand: 'bezug',
      von: dayPart(a.bwz_von) ?? undefined, bis: dayPart(a.bwz_bis) ?? undefined, herkunft: 'dokument',
    });
  }
  if (vorgang.wohngeld_antrag_laeuft === true) {
    transferleistungen.push({ art: 'wohngeld', art_quelle: 'wohngeld_antrag_laeuft', stand: 'beantragt', herkunft: 'angabe' });
  }

  const w = vorgang.wohnung ?? {};
  const eigentum = vorgang.wohnsituation === 'eigentum' ? true
    : vorgang.wohnsituation ? false : undefined;

  const antragDok = dokumente.filter((d) => d.typ === 'grundsicherungsantrag' && dayPart(d.eingegangenAm))
    .sort((a, b) => (a.eingegangenAm! < b.eingegangenAm! ? -1 : 1))[0];
  const stelle = vorgang.ersteingang?.stelle?.trim();
  const ersteingangDatum = dayPart(vorgang.ersteingang?.datum) ?? undefined;
  const eingang: VorrangEingang = {
    antragsdatum: dayPart(vorgang.antragsdatum) ?? undefined,
    datum: ersteingangDatum ?? dayPart(antragDok?.eingegangenAm) ?? undefined,
    erste_stelle: stelle || ersteingangDatum
      ? (stelle && /wohngeld/i.test(stelle) ? 'wohngeldstelle' : 'andere')
      : 'grundsicherungstraeger',
    ...(stelle ? { erste_stelle_bezeichnung: stelle } : {}),
  };

  return {
    version: VORRANG_GRUNDDATEN_VERSION,
    quelle: 'grundsicherung',
    vorgangId: vorgang.id,
    stichtag: ctx.antragsdatum,
    haushalt,
    partnerschaft,
    einkommen,
    abzuege,
    wohnkosten: {
      kaltmiete: w.kaltmiete,
      nebenkosten_kalt: w.nebenkosten_kalt,
      heizkosten: w.heizkosten,
      warmwasser_erzeugung: w.warmwasser,
      heizung_in_miete: w.heizung_in_miete_enthalten,
      wohnflaeche_qm: w.wohnflaeche_qm,
      bewohner: w.bewohner_anzahl,
      eigentum,
    },
    vermoegen,
    alter_em,
    schwerbehinderung: personen.map((p, i) => ({
      person: i, gdb: p.schwerbehinderung?.gdb,
      ...(p.schwerbehinderung?.merkzeichen ? { merkzeichen: [...p.schwerbehinderung.merkzeichen] } : {}),
    })),
    transferleistungen,
    eingang,
  };
}
