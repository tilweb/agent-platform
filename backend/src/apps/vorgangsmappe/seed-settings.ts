/**
 * Vorgangsmappe — Settings-Seeder
 *
 * Beim Boot werden die Stammdaten (Doku-Typen + Standard-Incoterms 2020) in
 * die DB eingespielt. Idempotent: bestehende Eintraege werden NICHT
 * ueberschrieben — Admin kann sie via Settings-UI veraendern, ohne dass der
 * Seed sie zurueckdreht.
 *
 * Pflicht-Mappings werden NICHT geseedet — die werden manuell ueber die UI
 * gepflegt (User-Vorgabe).
 */

import { getDb } from '../../db';
import {
  vmDocumentTypes,
  vmIncoterms,
} from '../../db/schema/vorgangsmappe';

/* -------------------------------------------------------------- *
 * Doku-Typen — aus der Cofermin-Dokumentenmatrix.xlsx
 * (Sheets „Bsp Incoterms" als kuratierte Master-Liste,
 *  ergaenzt um Eintraege aus „Mappe neu")
 * -------------------------------------------------------------- */

interface SeedDocType {
  id: string;
  label: string;
  bereich: 'einkauf' | 'verkauf' | 'produktion' | 'sonstiges';
  match_any: string[];
  sort_order: number;
}

const DEFAULT_DOCUMENT_TYPES: SeedDocType[] = [
  // ===== Einkauf =====
  { id: 'ek_rahmenbestellung',       bereich: 'einkauf', label: 'Rahmenbestellung',                                          match_any: ['Rahmenbestellung'],                  sort_order: 100 },
  { id: 'ek_teilbestellung',         bereich: 'einkauf', label: 'Teilbestellung',                                            match_any: ['Teilbestellung'],                    sort_order: 110 },
  { id: 'ek_dienstleistungsbest',    bereich: 'einkauf', label: 'Dienstleistungsbestellung',                                  match_any: ['Dienstleistungsbestellung'],          sort_order: 115 },
  { id: 'ek_auftragsbest_kreditor',  bereich: 'einkauf', label: 'Auftragsbestaetigung (Kreditor)',                            match_any: ['Auftragsbestätigung'],                sort_order: 120 },
  { id: 'ek_eingangsrechnung',       bereich: 'einkauf', label: 'Eingangsrechnung (inkl. Proforma)',                          match_any: ['Eingangsrechnung', 'Einkaufsrechnung', 'Proforma*'], sort_order: 130 },
  { id: 'ek_einlagerungsauftrag',    bereich: 'einkauf', label: 'Einlagerungsauftrag / unterschrieben',                       match_any: ['Einlagerungsauftrag'],                sort_order: 140 },
  { id: 'ek_transportauftrag',       bereich: 'einkauf', label: 'Transportauftrag',                                           match_any: ['Transportauftrag'],                   sort_order: 150 },
  { id: 'ek_zollauftrag',            bereich: 'einkauf', label: 'Zollauftrag',                                                match_any: ['Zollauftrag'],                        sort_order: 160 },
  { id: 'ek_einfuhrumsatzsteuer',    bereich: 'einkauf', label: 'Einfuhrumsatzsteuerbescheid',                                match_any: ['Einfuhrumsatzsteuerbescheid'],        sort_order: 170 },
  { id: 'ek_eingangsanalysen',       bereich: 'einkauf', label: 'Eingangsanalysen (inkl. CoA)',                               match_any: ['Eingangsanalyse', 'CoA'],             sort_order: 180 },
  { id: 'ek_loadingreports',         bereich: 'einkauf', label: 'Loadingreports (inkl. Verladefotos)',                        match_any: ['Loadingreport', 'Verladefoto*'],      sort_order: 190 },
  { id: 'ek_praeferenzdokumente',    bereich: 'einkauf', label: 'Praeferenzdokumente (EUR1, Form A, ATR etc.)',               match_any: ['EUR1', 'Form A', 'ATR', 'Präferenz*'], sort_order: 200 },
  { id: 'ek_lieferpapiere',          bereich: 'einkauf', label: 'Lieferpapiere (BL, PL, CMR, T1 etc.)',                       match_any: ['BL', 'CMR', 'T1', 'Lieferpapier*'],   sort_order: 210 },
  { id: 'ek_labels',                 bereich: 'einkauf', label: 'Labels (Etiketten)',                                         match_any: ['Label', 'Etikett'],                   sort_order: 220 },
  { id: 'ek_ursprungszeugnis',       bereich: 'einkauf', label: 'Ursprungszeugnis',                                           match_any: ['Ursprungszeugnis'],                   sort_order: 230 },
  { id: 'ek_veterinaer',             bereich: 'einkauf', label: 'Veterinaersbescheinigung',                                   match_any: ['Veterinär*'],                          sort_order: 240 },
  { id: 'ek_versicherung',           bereich: 'einkauf', label: 'Versicherungsnachweis',                                      match_any: ['Versicherung*'],                       sort_order: 250 },
  { id: 'ek_loi',                    bereich: 'einkauf', label: 'LOI / Garantieschreiben',                                    match_any: ['LOI', 'Garantieschreiben'],            sort_order: 260 },
  { id: 'ek_gefahrgut',              bereich: 'einkauf', label: 'Gefahrgutdokumente (SDS, MSDS, IATA, IMO etc.)',             match_any: ['SDS', 'MSDS', 'IATA', 'IMO', 'Gefahrgut*'], sort_order: 270 },
  { id: 'ek_reklamation',            bereich: 'einkauf', label: 'Reklamationserfassungsbogen',                                match_any: ['Reklamation*'],                        sort_order: 280 },
  { id: 'ek_langzeitlieferant',      bereich: 'einkauf', label: 'Langzeitlieferantenerklaerung',                              match_any: ['Langzeitlieferantenerklärung'],        sort_order: 290 },
  { id: 'ek_warenmeldung',           bereich: 'einkauf', label: 'Warenein-/Ausgangsmeldung',                                  match_any: ['Warenein*', 'Warenaus*'],              sort_order: 300 },
  { id: 'ek_fotos',                  bereich: 'einkauf', label: 'Fotos',                                                      match_any: ['Foto*'],                               sort_order: 310 },
  { id: 'ek_schriftverkehr',         bereich: 'einkauf', label: 'Schriftverkehr',                                             match_any: ['Schriftverkehr'],                      sort_order: 320 },
  { id: 'ek_abruf_rahmen',           bereich: 'einkauf', label: 'Abruf aus Rahmenbestellung',                                 match_any: ['Abruf*'],                              sort_order: 330 },
  { id: 'ek_geb_vorkasse',           bereich: 'einkauf', label: 'Gebuchte Vorkassenrechnung (Eingang)',                        match_any: ['Vorkassenrechnung'],                   sort_order: 340 },
  { id: 'ek_geb_eingangsrechnung',   bereich: 'einkauf', label: 'Gebuchte Eingangsrechnung',                                  match_any: ['Eingangsrechnung'],                    sort_order: 350 },
  { id: 'ek_geb_eingangsgutschrift', bereich: 'einkauf', label: 'Gebuchte Eingangsgutschrift',                                match_any: ['Eingangsgutschrift', 'Einkaufsgutschrift'], sort_order: 360 },
  { id: 'ek_einkaufsruecklief',      bereich: 'einkauf', label: 'Gebuchte Einkaufsruecklieferung',                            match_any: ['Einkaufsrücklieferung'],               sort_order: 370 },
  { id: 'ek_gutschriften',           bereich: 'einkauf', label: 'Gutschriften (Einkauf)',                                      match_any: ['Gutschrift'],                          sort_order: 380 },
  { id: 'ek_sonstiges',              bereich: 'einkauf', label: 'Sonstiges (Einkauf)',                                         match_any: ['Sonstiges'],                           sort_order: 390 },

  // ===== Verkauf =====
  { id: 'vk_angebot',                bereich: 'verkauf', label: 'Angebot',                                                    match_any: ['Angebot'],                             sort_order: 500 },
  { id: 'vk_rahmenkontrakt',         bereich: 'verkauf', label: 'Rahmenkontrakt',                                             match_any: ['Rahmenkontrakt'],                      sort_order: 510 },
  { id: 'vk_kundenbestellung',       bereich: 'verkauf', label: 'Kundenbestellung',                                           match_any: ['Kundenbestellung'],                    sort_order: 520 },
  { id: 'vk_kalkulation',            bereich: 'verkauf', label: 'Kalkulation',                                                match_any: ['Kalkulation'],                         sort_order: 530 },
  { id: 'vk_auftragsbestaetigung',   bereich: 'verkauf', label: 'Auftragsbestaetigung (Verkauf)',                              match_any: ['Auftragsbestätigung'],                 sort_order: 540 },
  { id: 'vk_label',                  bereich: 'verkauf', label: 'Label / Etikett (Verkauf)',                                   match_any: ['Label', 'Etikett'],                    sort_order: 550 },
  { id: 'vk_proforma_vorkasse',      bereich: 'verkauf', label: 'Proforma- / Vorkassenrechnung',                              match_any: ['Proforma*', 'Vorkassenrechnung'],      sort_order: 560 },
  { id: 'vk_ausgangsrechnung',       bereich: 'verkauf', label: 'Ausgangsrechnung',                                           match_any: ['Ausgangsrechnung', 'Verkaufsrechnung'], sort_order: 570 },
  { id: 'vk_warenausgangsmeldung',   bereich: 'verkauf', label: 'Warenausgangsmeldung',                                       match_any: ['Warenausgang*'],                        sort_order: 580 },
  { id: 'vk_lieferpapiere',          bereich: 'verkauf', label: 'Lieferpapiere (BL, CMR etc.)',                                match_any: ['BL', 'CMR', 'Lieferpapier*'],          sort_order: 590 },
  { id: 'vk_lieferschein',           bereich: 'verkauf', label: 'Lieferschein',                                               match_any: ['Lieferschein'],                        sort_order: 600 },
  { id: 'vk_gelangensbest',          bereich: 'verkauf', label: 'Gelangensbestaetigung (Verbringungsnachweis)',                match_any: ['Gelangensbest*', 'Verbringungsnachweis'], sort_order: 610 },
  { id: 'vk_freistellungsauftrag',   bereich: 'verkauf', label: 'Freistellungsauftrag',                                       match_any: ['Freistellung*'],                       sort_order: 620 },
  { id: 'vk_transportauftrag_ab',    bereich: 'verkauf', label: 'Transportauftrag inkl. Abholschein',                          match_any: ['Transportauftrag', 'Abholschein'],     sort_order: 630 },
  { id: 'vk_speditionsbest',         bereich: 'verkauf', label: 'Bestaetigung vom Spediteur',                                  match_any: ['Speditionsbestätigung', 'Spediteur*'],  sort_order: 640 },
  { id: 'vk_gutschriften_belast',    bereich: 'verkauf', label: 'Gutschriften / Belastungen',                                 match_any: ['Gutschrift', 'Belastung'],             sort_order: 650 },
  { id: 'vk_ausfuhrbegleitdok',      bereich: 'verkauf', label: 'Ausfuhrbegleitdokument',                                     match_any: ['Ausfuhrbegleit*'],                     sort_order: 660 },
  { id: 'vk_praeferenzdokumente',    bereich: 'verkauf', label: 'Praeferenzdokumente (Verkauf)',                              match_any: ['EUR1', 'Form A', 'ATR', 'Präferenz*'], sort_order: 670 },
  { id: 'vk_ursprungszeugnis',       bereich: 'verkauf', label: 'Ursprungszeugnis (Verkauf)',                                  match_any: ['Ursprungszeugnis'],                    sort_order: 680 },
  { id: 'vk_veterinaerzert',         bereich: 'verkauf', label: 'Veterinaerzertifikat',                                       match_any: ['Veterinär*'],                          sort_order: 690 },
  { id: 'vk_gefahrgut',              bereich: 'verkauf', label: 'Gefahrgutdokumente (Verkauf)',                                match_any: ['SDS', 'MSDS', 'IATA', 'IMO', 'Gefahrgut*'], sort_order: 700 },
  { id: 'vk_ausgangsanalysen',       bereich: 'verkauf', label: 'Ausgangsanalysen (intern & extern)',                         match_any: ['Ausgangsanalyse'],                     sort_order: 710 },
  { id: 'vk_versicherung',           bereich: 'verkauf', label: 'Versicherungsnachweis (Verkauf)',                             match_any: ['Versicherung*'],                       sort_order: 720 },
  { id: 'vk_coc',                    bereich: 'verkauf', label: 'Certificate of Conformity',                                  match_any: ['Certificate of Conformity', 'Conformity*'], sort_order: 730 },
  { id: 'vk_loi',                    bereich: 'verkauf', label: 'LOI / Garantieschreiben (Verkauf)',                          match_any: ['LOI', 'Garantieschreiben'],            sort_order: 740 },
  { id: 'vk_langzeitlieferant',      bereich: 'verkauf', label: 'Langzeitlieferantenerklaerung (Verkauf)',                    match_any: ['Langzeitlieferantenerklärung'],        sort_order: 750 },
  { id: 'vk_loadingreports',         bereich: 'verkauf', label: 'Loadingreports (Verkauf)',                                   match_any: ['Loadingreport'],                       sort_order: 760 },
  { id: 'vk_fotos',                  bereich: 'verkauf', label: 'Fotos (Verkauf)',                                            match_any: ['Foto*'],                                sort_order: 770 },
  { id: 'vk_schriftverkehr',         bereich: 'verkauf', label: 'Schriftverkehr (Verkauf)',                                   match_any: ['Schriftverkehr'],                       sort_order: 780 },
  { id: 'vk_reklamation',            bereich: 'verkauf', label: 'Reklamationserfassungsbogen (Verkauf)',                       match_any: ['Reklamation*'],                        sort_order: 790 },
  { id: 'vk_mahnung',                bereich: 'verkauf', label: 'Mahnung',                                                    match_any: ['Mahnung'],                              sort_order: 800 },
  { id: 'vk_abruf_rahmen',           bereich: 'verkauf', label: 'Abruf aus Rahmenauftrag',                                    match_any: ['Abruf*'],                               sort_order: 810 },
  { id: 'vk_geb_vorkasse',           bereich: 'verkauf', label: 'Gebuchte Vorkassenrechnung (Verkauf)',                        match_any: ['Vorkassenrechnung'],                    sort_order: 820 },
  { id: 'vk_geb_verkaufsrechnung',   bereich: 'verkauf', label: 'Gebuchte Verkaufsrechnung',                                  match_any: ['Verkaufsrechnung'],                     sort_order: 830 },
  { id: 'vk_geb_verkaufsgutschrift', bereich: 'verkauf', label: 'Gebuchte Verkaufsgutschrift',                                match_any: ['Verkaufsgutschrift'],                   sort_order: 840 },
  { id: 'vk_verkaufsruecklief',      bereich: 'verkauf', label: 'Gebuchte Verkaufsruecklieferung',                            match_any: ['Verkaufsrücklieferung'],                sort_order: 850 },
  { id: 'vk_sonstiges',              bereich: 'verkauf', label: 'Sonstiges (Verkauf)',                                         match_any: ['Sonstiges'],                            sort_order: 860 },

  // ===== Produktion =====
  { id: 'pr_dienstleistungsbest',    bereich: 'produktion', label: 'Dienstleistungsbestellung (Produktion)',                  match_any: ['Dienstleistungsbestellung'],            sort_order: 1000 },
  { id: 'pr_loss_outturn',           bereich: 'produktion', label: 'Meldung ueber Loss und Outturn',                          match_any: ['Loss', 'Outturn'],                      sort_order: 1010 },
  { id: 'pr_etiketten',              bereich: 'produktion', label: 'Etiketten / Markierungen (Labels)',                       match_any: ['Etikett', 'Label'],                     sort_order: 1020 },
  { id: 'pr_packlisten',             bereich: 'produktion', label: 'Packlisten',                                              match_any: ['Packliste'],                            sort_order: 1030 },
  { id: 'pr_montagerezept',          bereich: 'produktion', label: 'Montagerezept',                                           match_any: ['Montagerezept', 'Produktionsauftrag'],  sort_order: 1040 },
  { id: 'pr_fotos',                  bereich: 'produktion', label: 'Fotos (Produktion)',                                      match_any: ['Foto*'],                                sort_order: 1050 },
  { id: 'pr_schriftverkehr',         bereich: 'produktion', label: 'Schriftverkehr (Produktion)',                             match_any: ['Schriftverkehr'],                       sort_order: 1060 },
  { id: 'pr_sonstiges',              bereich: 'produktion', label: 'Sonstiges (Produktion)',                                  match_any: ['Sonstiges'],                            sort_order: 1070 },
];

/* -------------------------------------------------------------- *
 * Incoterms 2020 — Standard-Set
 * -------------------------------------------------------------- */

const DEFAULT_INCOTERMS: Array<{ code: string; label: string; description: string; sort_order: number }> = [
  { code: 'EXW', label: 'EXW — Ex Works',                            description: 'Ab Werk',                                       sort_order: 10 },
  { code: 'FCA', label: 'FCA — Free Carrier',                        description: 'Frei Frachtfuehrer',                            sort_order: 20 },
  { code: 'FAS', label: 'FAS — Free Alongside Ship',                 description: 'Frei laengsseits Schiff',                       sort_order: 30 },
  { code: 'FOB', label: 'FOB — Free On Board',                       description: 'Frei an Bord',                                  sort_order: 40 },
  { code: 'CPT', label: 'CPT — Carriage Paid To',                    description: 'Frachtfrei',                                    sort_order: 50 },
  { code: 'CIP', label: 'CIP — Carriage and Insurance Paid To',      description: 'Frachtfrei versichert',                         sort_order: 60 },
  { code: 'CFR', label: 'CFR — Cost and Freight',                    description: 'Kosten und Fracht',                             sort_order: 70 },
  { code: 'CIF', label: 'CIF — Cost, Insurance and Freight',         description: 'Kosten, Versicherung und Fracht',               sort_order: 80 },
  { code: 'DAP', label: 'DAP — Delivered At Place',                  description: 'Geliefert benannter Ort',                       sort_order: 90 },
  { code: 'DPU', label: 'DPU — Delivered At Place Unloaded',         description: 'Geliefert benannter Ort entladen',              sort_order: 100 },
  { code: 'DDP', label: 'DDP — Delivered Duty Paid',                 description: 'Geliefert verzollt',                            sort_order: 110 },
];

export interface SeedResult {
  documentTypesAdded: number;
  documentTypesSkipped: number;
  incotermsAdded: number;
  incotermsSkipped: number;
}

export async function seedVorgangsmappeSettings(): Promise<SeedResult> {
  const db = getDb();
  let documentTypesAdded = 0;
  let documentTypesSkipped = 0;
  let incotermsAdded = 0;
  let incotermsSkipped = 0;

  for (const dt of DEFAULT_DOCUMENT_TYPES) {
    try {
      const res = await db
        .insert(vmDocumentTypes)
        .values({
          id: dt.id,
          label: dt.label,
          bereich: dt.bereich,
          matchAny: dt.match_any,
          sortOrder: dt.sort_order,
        })
        .onConflictDoNothing({ target: vmDocumentTypes.id })
        .returning({ id: vmDocumentTypes.id });
      if (res.length > 0) documentTypesAdded += 1;
      else documentTypesSkipped += 1;
    } catch (err) {
      console.warn(`[vorgangsmappe-seed] document_type ${dt.id} failed:`, err instanceof Error ? err.message : err);
    }
  }

  for (const ic of DEFAULT_INCOTERMS) {
    try {
      const res = await db
        .insert(vmIncoterms)
        .values({
          code: ic.code,
          label: ic.label,
          description: ic.description,
          sortOrder: ic.sort_order,
        })
        .onConflictDoNothing({ target: vmIncoterms.code })
        .returning({ code: vmIncoterms.code });
      if (res.length > 0) incotermsAdded += 1;
      else incotermsSkipped += 1;
    } catch (err) {
      console.warn(`[vorgangsmappe-seed] incoterm ${ic.code} failed:`, err instanceof Error ? err.message : err);
    }
  }

  return { documentTypesAdded, documentTypesSkipped, incotermsAdded, incotermsSkipped };
}
