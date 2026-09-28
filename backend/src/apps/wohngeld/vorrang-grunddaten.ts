/**
 * Wohngeld → Grunddaten-Vertrag für eine spätere Vorrang-Einschätzung (Wohngeld ↔ Grundsicherung).
 * Reine Funktion, DB-frei, keine Berechnung. Vertrag: apps/_vorrang/grunddaten.ts.
 *
 * Was Wohngeld NICHT erfasst (bleibt `undefined`):
 * - keine Einsatzgemeinschaft: Partner:in wird nur abgeleitet, wenn eindeutig (genau eine
 *   Person mit Rolle Ehegatte/Lebenspartner, nicht getrennt lebend); eheähnliche Partner
 *   bleiben „haushaltsangehörig", die Partnerschaft dann unbekannt.
 * - Miete nur als Bruttokaltmiete: `kaltmiete`/`nebenkosten_kalt` bleiben leer.
 * - keine Zahl der Bewohner, keine Warmwasser-Erzeugungsart, keine Pauschalmiete-Kennung.
 * - Erwerbsminderung nur indirekt über die Rentenart im Rentenbescheid (Profil-Rohwert).
 * - keine Merkzeichen, kein Schonvermögen-Kennzeichen, keine KV/PV- und Steuerangaben.
 * - Rente ohne Unterscheidung gesetzlich/betrieblich (`rente_unbestimmt`).
 */
import { dayPart } from '../_antrag-kern/datum';
import { altersgrenzeErreichtAm, altersgrenzeImMonatErreicht } from '../_vorrang/altersgrenze';
import {
  artAusStichworten, einkommensartAus, EINKOMMENSART_AUS_WOHNGELD, TRANSFERART_AUS_WOHNGELD_AUSSCHLUSS,
  TRANSFERART_STICHWORTE, VERMOEGENSART_STICHWORTE_WOHNGELD, VORRANG_GRUNDDATEN_VERSION,
  type VorrangAlterEm, type VorrangEinkommen, type VorrangGrunddaten, type VorrangHaushaltsmitglied,
  type VorrangPartnerschaft, type VorrangRentenart, type VorrangTransferleistung, type VorrangVermoegen,
  type VorrangVerwandtschaft,
} from '../_vorrang/grunddaten';
import type { Dokument, Person, VorgangSnapshot } from './types';

export interface GrunddatenOptionen {
  /** Abweichender Stichtag für die Altersgrenze (ISO). Default: Antragsdatum. */
  stichtag?: string;
}

const ROLLEN_REIHENFOLGE: Record<Person['rolle'], number> = {
  antragsteller: 0, ehegatte: 1, lebenspartner: 1, kind: 2, haushaltsmitglied: 3,
};

const VERWANDTSCHAFT: Partial<Record<Person['rolle'], VorrangVerwandtschaft>> = {
  ehegatte: 'ehegatte', lebenspartner: 'lebenspartner', kind: 'kind',
};

/** Rentenart aus dem Freitext eines Rentenbescheids („Regelaltersrente", „Rente wegen voller Erwerbsminderung"). */
export function rentenartAusText(text: string | undefined): { rentenart?: VorrangRentenart; dauerhaft?: boolean } {
  const t = text?.trim().toLowerCase();
  if (!t) return {};
  if (/erwerbsminderung|erwerbsunf[äa]hig|berufsunf[äa]hig/.test(t)) {
    const rentenart: VorrangRentenart = /teilweise|berufsunf/.test(t) ? 'teilweise_em' : /voll|erwerbsunf/.test(t) ? 'volle_em' : 'em_unbestimmt';
    const befristet = /befristet|auf zeit|\bbis\b/.test(t) && !/unbefristet/.test(t);
    const dauerhaft = /unbefristet|auf dauer|dauerhaft/.test(t) ? true : befristet ? false : undefined;
    return { rentenart, dauerhaft };
  }
  if (/witwe|witwer|waisen|hinterblieb|erziehungsrente/.test(t)) return { rentenart: 'hinterbliebene' };
  if (/alter/.test(t)) return { rentenart: 'alter' };
  return { rentenart: 'sonstige' };
}

/** Rentenart-Rohwert eines Rentenbescheids (DP-Profil), falls erkannt. */
function rentenartRohwert(d: Dokument): string | undefined {
  const w = d.profil?.rohwerte?.rentenart;
  return typeof w === 'string' && w.trim() ? w.trim() : undefined;
}

/** Monatsbetrag einer Einkommensposition (monatlich erfasst oder Jahresbetrag / 12). */
function monatsbetrag(e: { betrag_monatlich?: number; betrag_jaehrlich?: number }): number | undefined {
  if (typeof e.betrag_monatlich === 'number') return e.betrag_monatlich;
  if (typeof e.betrag_jaehrlich === 'number') return Math.round((e.betrag_jaehrlich / 12) * 100) / 100;
  return undefined;
}

export function grunddatenFuerVorrangpruefung(snapshot: VorgangSnapshot, optionen: GrunddatenOptionen = {}): VorrangGrunddaten {
  const { vorgang, dokumente } = snapshot;
  const personen = [...snapshot.personen].sort((a, b) => ROLLEN_REIHENFOLGE[a.rolle] - ROLLEN_REIHENFOLGE[b.rolle]);
  const stichtag = dayPart(optionen.stichtag) ?? dayPart(vorgang.antragsdatum) ?? undefined;

  // Partner:in nur, wenn eindeutig (genau eine Ehe-/Lebenspartner-Person, nicht getrennt lebend).
  const partnerKandidaten = personen.filter((p) => p.rolle === 'ehegatte' || p.rolle === 'lebenspartner');
  const partner = partnerKandidaten.length === 1 && partnerKandidaten[0]!.familienstand !== 'getrennt_lebend'
    ? partnerKandidaten[0]! : undefined;

  const haushalt: VorrangHaushaltsmitglied[] = personen.map((p) => ({
    rolle: p.rolle === 'antragsteller' ? 'antragsteller' : p === partner ? 'partner' : 'haushaltsangehoerig',
    geburtsdatum: dayPart(p.geburtsdatum) ?? undefined,
    verwandtschaft: VERWANDTSCHAFT[p.rolle],
    vermoegen_angegeben: (p.vermoegenPositionen?.length ?? 0) > 0 || typeof p.vermoegen === 'number' ? true : undefined,
    personId: p.id,
  }));

  let partnerschaft: VorrangPartnerschaft | undefined;
  if (partner) partnerschaft = partner.rolle === 'ehegatte' ? 'verheiratet' : 'lebenspartnerschaft';
  else if (personen.length === 1) partnerschaft = 'keine';
  else if (personen.find((p) => p.rolle === 'antragsteller')?.familienstand === 'getrennt_lebend') partnerschaft = 'getrennt_lebend';

  const einkommen: VorrangEinkommen[] = [];
  personen.forEach((p, i) => {
    const rentenbescheide = dokumente.filter((d) => d.typ === 'rentenbescheid' && d.personId === p.id);
    const rentenText = rentenbescheide.map(rentenartRohwert).find(Boolean);
    for (const e of p.einkommen ?? []) {
      const art = einkommensartAus(EINKOMMENSART_AUS_WOHNGELD, e.art);
      const rentenart = art === 'rente_unbestimmt'
        ? rentenartAusText(rentenText ?? e.bezeichnung).rentenart
        : undefined;
      einkommen.push({
        person: i, art, art_quelle: e.art,
        ...(rentenart ? { rentenart } : {}),
        betrag_monat: monatsbetrag(e),
        // § 14 WoGG: Jahreseinkommen = Summe der positiven Einkünfte (brutto).
        brutto: true,
      });
    }
  });

  const vermoegen: VorrangVermoegen[] = [];
  personen.forEach((p, i) => {
    const positionen = p.vermoegenPositionen ?? [];
    for (const v of positionen) {
      vermoegen.push({ person: i, art: artAusStichworten(VERMOEGENSART_STICHWORTE_WOHNGELD, v.art) ?? 'sonstiges', art_quelle: v.art, betrag: v.betrag });
    }
    if (positionen.length === 0 && typeof p.vermoegen === 'number' && p.vermoegen > 0) {
      vermoegen.push({ person: i, art: 'sonstiges', art_quelle: 'gesamtangabe', betrag: p.vermoegen });
    }
  });

  const alter_em: VorrangAlterEm[] = personen.map((p, i) => {
    const geb = dayPart(p.geburtsdatum) ?? undefined;
    const erreicht = altersgrenzeImMonatErreicht(geb, stichtag);
    const texte = dokumente.filter((d) => d.typ === 'rentenbescheid' && d.personId === p.id).map(rentenartRohwert)
      .concat((p.einkommen ?? []).filter((e) => e.art === 'rente').map((e) => e.bezeichnung));
    let em_voll_dauerhaft: boolean | undefined;
    for (const t of texte) {
      const r = rentenartAusText(t);
      if (r.rentenart === 'teilweise_em' || (r.rentenart === 'volle_em' && r.dauerhaft === false)) { em_voll_dauerhaft = false; break; }
      if (r.rentenart === 'volle_em' && r.dauerhaft === true) em_voll_dauerhaft = true;
    }
    return {
      person: i,
      altersgrenze_erreicht: erreicht ?? undefined,
      altersgrenze_am: altersgrenzeErreichtAm(geb) ?? undefined,
      em_voll_dauerhaft,
    };
  });

  const transferleistungen: VorrangTransferleistung[] = [];
  personen.forEach((p, i) => {
    for (const a of p.ausschluesse ?? []) {
      const art = (a.grund && TRANSFERART_AUS_WOHNGELD_AUSSCHLUSS[a.grund])
        || artAusStichworten(TRANSFERART_STICHWORTE, a.freitext) || 'sonstige';
      transferleistungen.push({
        person: i, art, art_quelle: a.grund ?? a.freitext ?? 'ausschluss', stand: 'bezug',
        von: dayPart(a.von) ?? undefined, bis: dayPart(a.bis) ?? undefined, herkunft: 'angabe',
      });
    }
    for (const t of p.transferleistungenDetail ?? []) {
      transferleistungen.push({ person: i, art: artAusStichworten(TRANSFERART_STICHWORTE, t.art) ?? 'sonstige', art_quelle: t.art, stand: 'bezug', herkunft: 'angabe' });
    }
    if (!(p.transferleistungenDetail?.length)) {
      for (const t of p.transferleistungen ?? []) {
        if (!t?.trim()) continue;
        transferleistungen.push({ person: i, art: artAusStichworten(TRANSFERART_STICHWORTE, t) ?? 'sonstige', art_quelle: t, stand: 'bezug', herkunft: 'angabe' });
      }
    }
  });

  const w = vorgang.wohnung ?? {};
  const antragDok = dokumente.filter((d) => d.typ === 'wohngeldantrag' && dayPart(d.eingegangenAm))
    .sort((a, b) => (a.eingegangenAm! < b.eingegangenAm! ? -1 : 1))[0];

  return {
    version: VORRANG_GRUNDDATEN_VERSION,
    quelle: 'wohngeld',
    vorgangId: vorgang.id,
    stichtag,
    haushalt,
    partnerschaft,
    einkommen,
    abzuege: personen.map((_, i) => ({ person: i })),
    wohnkosten: {
      bruttokaltmiete: w.miete,
      heizkosten: w.heizkosten,
      warmwasser_kosten: w.warmwasser,
      wohnflaeche_qm: w.wohnflaeche_qm,
      eigentum: vorgang.wohngeldart === 'lastenzuschuss' ? true : vorgang.wohngeldart === 'mietzuschuss' ? false : undefined,
    },
    vermoegen,
    alter_em,
    schwerbehinderung: personen.map((p, i) => ({ person: i, gdb: p.pflege_behinderung?.schwerbehinderungsgrad })),
    transferleistungen,
    eingang: {
      antragsdatum: dayPart(vorgang.antragsdatum) ?? undefined,
      datum: dayPart(antragDok?.eingegangenAm) ?? undefined,
      // Der Wohngeld-Vorgang wird bei der Wohngeldstelle geführt; eine Weiterleitung erfasst Wohngeld nicht.
      erste_stelle: 'wohngeldstelle',
    },
  };
}
