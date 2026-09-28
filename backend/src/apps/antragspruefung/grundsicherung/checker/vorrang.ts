/**
 * Grundsicherung — Vorrang-Hinweise Wohngeld ↔ Grundsicherung ↔ SGB II.
 * Alle Befunde sind `info` (Hinweis an die Sachbearbeitung), qualitativ, OHNE Berechnung.
 * Regel-IDs und Recht: docs/grundsicherung-regelkatalog-2026-09-27.md Abschnitt 5.2.
 */
import { dayPart } from '../../kern/datum';
import type { PruefBefund } from '../types';
import {
  altersgrenzeErreicht, analysen, docs, emBefund, emIstAnspruchsgrund, euro, fmtDatum,
  personLabel, vermoegenUebersicht, type PruefKontext,
} from './helfer';

const P = 'plausibilitaet' as const;

export function pruefeVorrang(ctx: PruefKontext): PruefBefund[] {
  const { vorgang } = ctx;
  const befunde: PruefBefund[] = [];

  // Wohngeldbescheid, dessen Bewilligungszeitraum den Antragsmonat überschneidet (unbekannt → Hinweis).
  const monatStart = `${ctx.stichtag.slice(0, 7)}-01`;
  const monatEnde = `${ctx.stichtag.slice(0, 7)}-31`;
  const bescheide = docs(ctx, 'wohngeldbescheid');
  const laufend = bescheide.find((d) => {
    const a = analysen([d], 'wohngeldbescheid')[0]?.a;
    const von = dayPart(a?.bwz_von);
    const bis = dayPart(a?.bwz_bis);
    return !(bis && bis < monatStart) && !(von && von > monatEnde);
  });
  if (laufend) {
    const a = analysen([laufend], 'wohngeldbescheid')[0]?.a;
    const zeitraum = a?.bwz_von || a?.bwz_bis ? ` (Bewilligungszeitraum ${fmtDatum(a?.bwz_von)} – ${fmtDatum(a?.bwz_bis)})` : '';
    befunde.push({
      regelId: 'vorrang-wohngeldbescheid-liegt-vor', kategorie: P, typ: 'info',
      titel: 'Laufender Wohngeldbescheid',
      belegtext: `Ein Wohngeldbescheid liegt vor${zeitraum}. Wohngeld als Einkommen erfassen; wird Grundsicherung bewilligt, entfällt das Wohngeld (§ 7 Abs. 1 Satz 1 Nr. 5 WoGG) — Wohngeldstelle informieren (§ 82 Abs. 1 SGB XII).`,
      quellDokumentId: laufend.id,
    });
  }

  if (vorgang.wohngeld_antrag_laeuft === true) {
    befunde.push({
      regelId: 'vorrang-wohngeld-antrag-parallel', kategorie: P, typ: 'info',
      titel: 'Wohngeldantrag läuft parallel',
      belegtext: 'Laut Angabe ist ein Wohngeldantrag gestellt und noch nicht beschieden. Vorrangfrage mit der Wohngeldstelle abstimmen, ggf. vorläufig entscheiden (§ 2 Abs. 1, § 44a SGB XII; § 7 Abs. 1 Satz 3 WoGG).',
    });
  }

  const verm = vermoegenUebersicht(ctx);
  const haushalt = Math.max(1, ctx.personen.length);
  const freigrenzeWohngeld = ctx.k.WOHNGELD_FREIGRENZE_ERSTE_PERSON + (haushalt - 1) * ctx.k.WOHNGELD_FREIGRENZE_WEITERE_PERSON;
  if (verm.wert > verm.schonbetrag && verm.wert <= freigrenzeWohngeld) {
    befunde.push({
      regelId: 'vorrang-vermoegen-ueber-schonbetrag', kategorie: P, typ: 'info',
      titel: 'Wohngeld statt Grundsicherung prüfen (Vermögen)',
      belegtext: `Das Barvermögen (${euro(verm.wert)}) liegt über dem Barbetrag der Grundsicherung (${euro(verm.schonbetrag)}), aber unter der Wohngeld-Freigrenze für ${haushalt} Haushaltsmitglied(er) (${euro(freigrenzeWohngeld)}). Solange das Vermögen einzusetzen ist, kann Wohngeld in Betracht kommen — auf Beratung zum Wohngeld hinweisen (§ 90 Abs. 2 Nr. 9 SGB XII; § 21 Nr. 3 WoGG).`,
    });
  }

  if (dayPart(vorgang.ersteingang?.datum) || vorgang.ersteingang?.stelle?.trim()) {
    const e = vorgang.ersteingang!;
    befunde.push({
      regelId: 'vorrang-weiterleitung-antragsdatum', kategorie: P, typ: 'info',
      titel: 'Antrag zuerst bei anderer Stelle eingegangen',
      belegtext: `Der Antrag ist zuerst ${e.stelle?.trim() ? `bei „${e.stelle.trim()}" ` : 'bei einer anderen Stelle '}eingegangen${dayPart(e.datum) ? ` (am ${fmtDatum(e.datum)})` : ''}. Dieses Eingangsdatum gilt als Antragsdatum und bestimmt den Leistungsbeginn — übernehmen und dokumentieren (§ 16 Abs. 2 SGB I; § 44 Abs. 2 SGB XII).`,
    });
  }

  for (const p of ctx.eg) {
    const gruende: string[] = [];
    if (emIstAnspruchsgrund(ctx, p)) {
      const em = emBefund(ctx, p);
      if (em.befristet) gruende.push(`die Erwerbsminderungsrente ist befristet${em.befristet.bis ? ` bis ${fmtDatum(em.befristet.bis)}` : ''}`);
      if (em.teilweiseOderArbeitsmarkt) gruende.push(em.teilweiseOderArbeitsmarkt.grund === 'teilweise' ? 'es ist nur eine teilweise Erwerbsminderung belegt' : 'die Erwerbsminderungsrente beruht auf der Arbeitsmarktlage');
      if (em.feststellung?.dauerhaft === false) gruende.push('der Rentenversicherungsträger hat keine dauerhafte volle Erwerbsminderung festgestellt');
    }
    if (p.rolle === 'antragsteller' && vorgang.anspruchsgrund === 'alter' && altersgrenzeErreicht(ctx, p) === false) {
      gruende.push('die Altersgrenze ist im Antragsmonat noch nicht erreicht');
    }
    if (gruende.length && altersgrenzeErreicht(ctx, p) !== true) {
      befunde.push({
        regelId: 'vorrang-sgb2-statt-sgb12', personId: p.id, kategorie: P, typ: 'info',
        titel: 'Zuständigkeit Jobcenter (SGB II) prüfen',
        belegtext: `${personLabel(p)} ist unter der Altersgrenze und ${gruende.join('; ')}. Eine Leistungsberechtigung nach dem 4. Kapitel SGB XII ist damit nicht belegt; Zuständigkeit des Jobcenters prüfen und den Antrag ggf. weiterleiten (§ 41 Abs. 3 SGB XII; § 16 Abs. 2 SGB I).`,
      });
    }
  }

  return befunde;
}
