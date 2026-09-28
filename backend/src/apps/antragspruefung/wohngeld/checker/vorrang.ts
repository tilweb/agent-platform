/**
 * Wohngeld — Vorrang-Hinweise Grundsicherung (Spiegelregeln zum Grundsicherungs-Katalog 5.2).
 * Beide Befunde sind `info` (Hinweis an die Sachbearbeitung), qualitativ, OHNE Berechnung von
 * Wohngeld oder Bedarf. Gleiche Regel-IDs wie im Grundsicherungs-Katalog.
 *
 * Abgrenzung zur §-7-Regel `ausschluss-person-transferbezug` (plausibilitaet.ts): Diese meldet
 * je Person „bleibt das Mitglied bei der Berechnung außer Betracht?". Die Vorrang-Hinweise hier
 * betreffen den Haushalt und das Verhältnis zur Grundsicherungsstelle (Ausnahme § 7 Abs. 1
 * Satz 3, Abstimmung, Beratung).
 *
 * Datenquelle ist der Grunddaten-Vertrag (`vorrang-grunddaten.ts`) — dieselbe Form, die später
 * die Vorrang-Einschätzung nutzt.
 */
import { dayPart } from '../../kern/datum';
import {
  einsatzgemeinschaft, ERWERBS_EINKOMMENSARTEN, RENTEN_EINKOMMENSARTEN, type VorrangGrunddaten,
} from '../../vorrang/grunddaten';
import type { Person, PruefBefund, VorgangSnapshot } from '../types';
import { grunddatenFuerVorrangpruefung } from '../vorrang-grunddaten';
import { belegtesVermoegen } from './abgleich';
import { KONSTANTEN, type WohngeldKonstanten } from './konstanten';
import { istHeimfall } from './nachweise';

const P = 'plausibilitaet' as const;

/** Barbetrag je erwachsener Person der Einsatzgemeinschaft (§ 1 BarbetragsVO zu § 90 Abs. 2 Nr. 9 SGB XII). */
export const BARBETRAG_JE_PERSON = 10000;

function euro(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function fmtDatum(iso?: string): string {
  const d = dayPart(iso);
  if (!d) return '—';
  const [y, m, t] = d.split('-');
  return `${t}.${m}.${y}`;
}
function name(p: Person | undefined, fallback: string): string {
  return (p ? `${p.vorname} ${p.nachname}`.trim() : '') || fallback;
}

/** Laufender (nicht vor dem Antragsdatum beendeter) Grundsicherungsbezug laut Personenangaben. */
function grundsicherungsbezug(g: VorrangGrunddaten) {
  return g.transferleistungen.filter((t) => t.art === 'grundsicherung' && t.stand !== 'beantragt'
    && !(t.bis && g.stichtag && t.bis < g.stichtag));
}

export interface VorrangOptionen {
  /** Abweichende Schwellen (Tests, Konfiguration). */
  konstanten?: Partial<WohngeldKonstanten>;
}

export function pruefeVorrang(snapshot: VorgangSnapshot, optionen: VorrangOptionen = {}): PruefBefund[] {
  const k: WohngeldKonstanten = { ...KONSTANTEN, ...(optionen.konstanten ?? {}) };
  const g = grunddatenFuerVorrangpruefung(snapshot);
  const personById = new Map(snapshot.personen.map((p) => [p.id, p]));
  const personZu = (idx?: number) => (idx === undefined ? undefined : personById.get(g.haushalt[idx]?.personId ?? ''));
  const befunde: PruefBefund[] = [];

  // ── Grundsicherungsbezug angegeben ──────────────────────────────────
  const bezug = grundsicherungsbezug(g);
  if (bezug.length > 0) {
    const wer = [...new Set(bezug.map((t) => name(personZu(t.person), 'ein Haushaltsmitglied')))];
    const zeitraum = bezug.find((t) => t.von || t.bis);
    befunde.push({
      regelId: 'vorrang-grundsicherungsbescheid-bei-wohngeld', kategorie: P, typ: 'info',
      titel: 'Grundsicherungsbezug angegeben — Vorrang klären',
      belegtext: `Für ${wer.join(', ')} ist Grundsicherung im Alter und bei Erwerbsminderung angegeben`
        + `${zeitraum ? ` (${fmtDatum(zeitraum.von)} – ${fmtDatum(zeitraum.bis)})` : ''}. `
        + 'Wer diese Leistung erhält, ist vom Wohngeld ausgeschlossen (§ 7 Abs. 1 Satz 1 Nr. 5 WoGG). '
        + 'Ausnahme: Wohngeld kann die Hilfebedürftigkeit vermeiden oder beseitigen und die Grundsicherung '
        + 'wurde im Verfahren noch nicht erbracht bzw. nur als nachrangig verpflichteter Träger (§ 7 Abs. 1 Satz 3 WoGG). '
        + 'Grundsicherungsbescheid anfordern bzw. mit der Grundsicherungsstelle abstimmen; ein Verzicht nach § 8 WoGG ist möglich. '
        + 'Hinweis ohne Berechnung und ohne Entscheidung.',
    });
  }

  // ── Grundsicherung mitprüfen ────────────────────────────────────────
  // Heim-/Einrichtungsfälle ausgenommen: dort stellt sich die Frage nach Hilfe zur Pflege bzw.
  // Grundsicherung in der Einrichtung beim Sozialhilfeträger gesondert (Heimvertrag liegt vor).
  if (bezug.length === 0 && !istHeimfall(snapshot.dokumente)) {
    const eg = einsatzgemeinschaft(g);
    const anlass = eg.flatMap((i) => {
      const a = g.alter_em[i];
      const p = personZu(i);
      if (a?.altersgrenze_erreicht === true) return [`${name(p, 'eine Person')} hat die Altersgrenze erreicht (mit Ablauf des ${fmtDatum(a.altersgrenze_am)})`];
      if (a?.em_voll_dauerhaft === true) return [`${name(p, 'eine Person')} ist laut Rentenbescheid dauerhaft voll erwerbsgemindert`];
      return [];
    });
    const egEinkommen = g.einkommen.filter((e) => eg.includes(e.person));
    const erwerb = egEinkommen.some((e) => ERWERBS_EINKOMMENSARTEN.includes(e.art));
    const rente = egEinkommen.some((e) => RENTEN_EINKOMMENSARTEN.includes(e.art));
    const erwachsene = Math.max(1, eg.length);
    const grenze = erwachsene * BARBETRAG_JE_PERSON;
    const verm = g.vermoegen.filter((v) => eg.includes(v.person) && v.schonvermoegen !== true && typeof v.betrag === 'number');
    const summe = verm.reduce((s, v) => s + (v.betrag ?? 0), 0);
    // Vermögen auch aus den Belegen (Vermögensnachweise, letzte Kontostände) — dieselbe Quelle wie
    // plausi-vermoegen-beleg-abweichung; nur Belege der Einsatzgemeinschaft oder ohne Personenbezug.
    const egIds = new Set(eg.map((i) => g.haushalt[i]?.personId).filter(Boolean));
    const belegt = belegtesVermoegen(snapshot.dokumente.filter((d) => !d.personId || egIds.has(d.personId)));
    const vermoegenUnbekannt = verm.length === 0 && belegt.summe <= 0 && eg.some((i) => g.haushalt[i]?.vermoegen_angegeben !== true);
    // Grober Einkommens-Orientierungswert (kommunal festzulegen) — keine Bedarfsberechnung. Nur wenn
    // für jede Einkommensposition der Einsatzgemeinschaft ein Monatsbetrag erfasst ist.
    const orientierung = eg.length >= 2 ? k.GRUNDSICHERUNG_ORIENTIERUNG_PAAR_EUR : k.GRUNDSICHERUNG_ORIENTIERUNG_PERSON_EUR;
    const einkommenBekannt = egEinkommen.length > 0 && egEinkommen.every((e) => typeof e.betrag_monat === 'number');
    const einkommenSumme = Math.round(egEinkommen.reduce((s, e) => s + (e.betrag_monat ?? 0), 0) * 100) / 100;
    const ueberOrientierung = einkommenBekannt && einkommenSumme > orientierung;

    if (anlass.length > 0 && !erwerb && summe < grenze && belegt.summe < grenze && !ueberOrientierung) {
      const einkommenText = (rente
        ? 'Als Einkommen ist nur Rente erfasst, keine Erwerbseinkünfte'
        : egEinkommen.length === 0 ? 'Einkommen ist nicht erfasst' : 'Erwerbseinkünfte sind nicht erfasst')
        + (einkommenBekannt
          ? ` (zusammen ${euro(einkommenSumme)} brutto im Monat, Orientierungswert ${euro(orientierung)}${eg.length >= 2 ? ' für zwei Partner' : ''})`
          : egEinkommen.length > 0 ? ' (Höhe nicht vollständig erfasst)' : '');
      const vermoegenText = vermoegenUnbekannt
        ? 'Vermögen ist nicht erfasst'
        : `das ${verm.length ? 'erfasste' : 'belegte'} Vermögen (${euro(Math.max(summe, belegt.summe))}) liegt unter ${euro(BARBETRAG_JE_PERSON)} je erwachsener Person`;
      befunde.push({
        regelId: 'vorrang-grundsicherung-mitpruefen', kategorie: P, typ: 'info',
        titel: 'Grundsicherung mitprüfen',
        belegtext: `${anlass.join('; ')}. ${einkommenText}; ${vermoegenText}. `
          + 'Ein Anspruch auf Grundsicherung im Alter und bei Erwerbsminderung kann in Betracht kommen (§ 41 SGB XII). '
          + 'Auf Beratung zur Grundsicherung hinweisen und die Vorrangfrage mit der Grundsicherungsstelle abstimmen: '
          + 'Vermeidet Wohngeld zusammen mit dem übrigen Einkommen die Hilfebedürftigkeit, geht Wohngeld vor; '
          + 'sonst kommt Grundsicherung in Betracht, deren Bezug Wohngeld ausschließt (§ 7 Abs. 1 WoGG, § 2 Abs. 1 SGB XII). '
          + 'Hinweis ohne Berechnung und ohne Entscheidung.',
      });
    }
  }

  return befunde;
}
