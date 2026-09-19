/**
 * Plausibilitätsprüfung — Widersprüche zwischen Antragsangaben und Nachweisen.
 * Reine Funktionen. Regel-IDs & Recht siehe Regel-Katalog Abschnitt 2.
 *
 * Vergleichsgrundlage: `vorgang.wohnung` (Antragsangaben) ↔ `dokument.analyse`
 * (aus den Nachweisen extrahierte Werte).
 */
import type { VorgangSnapshot, Dokument, Person, DokumentTyp, PruefBefund } from '../types';
import { haushaltsVermoegen, vermoegensFreigrenze } from '../einkommen';
import { berechneBwzVorschlag, fmtDe } from '../bwz';

function docsOfType(dokumente: Dokument[], ...typen: DokumentTyp[]): Dokument[] {
  return dokumente.filter(d => typen.includes(d.typ));
}
function euro(n: number | undefined): string {
  return typeof n === 'number' ? n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '—';
}
function personById(personen: Person[], id?: string): Person | undefined {
  return id ? personen.find(p => p.id === id) : undefined;
}

const EINKUNFTS_LABEL: Record<string, string> = {
  kapitalertraege: 'Kapitalerträge',
  v_und_v: 'Einkünfte aus Vermietung/Verpachtung',
  lohn_gehalt: 'Einkünfte aus Erwerbstätigkeit',
  rente: 'Renteneinkünfte',
};

export function pruefePlausibilitaet(snapshot: VorgangSnapshot): PruefBefund[] {
  const { vorgang, personen, dokumente } = snapshot;
  const befunde: PruefBefund[] = [];
  const wohnung = vorgang.wohnung ?? {};

  // ── Antrag: Unterschrift / Datum ─────────────────────────────────────
  const antragDok = docsOfType(dokumente, 'wohngeldantrag')[0];
  if (antragDok?.analyse) {
    if (antragDok.analyse.unterschrift_vorhanden === false) {
      befunde.push({
        regelId: 'plausi-antrag-ohne-unterschrift', kategorie: 'plausibilitaet', typ: 'anforderung',
        titel: 'Antrag ohne Unterschrift',
        belegtext: 'Der Wohngeldantrag ist nicht unterschrieben — es liegt kein wirksamer Antrag vor (§ 22 WoGG).',
        quellDokumentId: antragDok.id,
      });
    }
    if (antragDok.analyse.datum_vorhanden === false) {
      befunde.push({
        regelId: 'plausi-antrag-ohne-datum', kategorie: 'plausibilitaet', typ: 'anforderung',
        titel: 'Antrag ohne Datum',
        belegtext: 'Der Antrag trägt kein Datum — der Antragsmonat/Leistungsbeginn ist nicht bestimmbar (§ 22 WoGG).',
        quellDokumentId: antragDok.id,
      });
    }
  }

  // ── Miethöhe / Wohnfläche / Unterschrift Mietvertrag ─────────────────
  const mietDok = docsOfType(dokumente, 'mietvertrag', 'mietbescheinigung')[0];
  if (mietDok?.analyse) {
    const a = mietDok.analyse;
    if (typeof a.miete === 'number' && typeof wohnung.miete === 'number' && Math.abs(a.miete - wohnung.miete) >= 0.01) {
      const diff = Math.abs(a.miete - wohnung.miete);
      befunde.push({
        regelId: 'plausi-miethoehe-abweichung', kategorie: 'plausibilitaet', typ: 'anforderung',
        titel: 'Miethöhe klären',
        belegtext: `Der Mietvertrag nennt eine Miete von ${euro(a.miete)}, im Antrag sind ${euro(wohnung.miete)} angegeben. Die Differenz von ${euro(diff)} ist zu klären.`,
        quellDokumentId: mietDok.id,
      });
    }
    if (typeof a.wohnflaeche_qm === 'number' && typeof wohnung.wohnflaeche_qm === 'number' && Math.abs(a.wohnflaeche_qm - wohnung.wohnflaeche_qm) >= 0.01) {
      befunde.push({
        regelId: 'plausi-wohnflaeche-abweichung', kategorie: 'plausibilitaet', typ: 'info',
        titel: 'Wohnfläche prüfen',
        belegtext: `Wohnfläche im Antrag (${wohnung.wohnflaeche_qm} m²) weicht vom Mietvertrag (${a.wohnflaeche_qm} m²) ab.`,
        quellDokumentId: mietDok.id,
      });
    }
    if (mietDok.typ === 'mietvertrag' && a.unterschrift_vorhanden === false) {
      befunde.push({
        regelId: 'plausi-mietvertrag-unsigniert', kategorie: 'plausibilitaet', typ: 'anforderung',
        titel: 'Mietvertrag ohne Unterschrift',
        belegtext: 'Der Mietvertrag ist nicht von beiden Parteien unterschrieben — als Nachweis nicht ausreichend.',
        quellDokumentId: mietDok.id,
      });
    }
  }

  // ── Mietzahlung auf Kontoauszug ──────────────────────────────────────
  for (const konto of docsOfType(dokumente, 'kontoauszug')) {
    if (konto.analyse?.mietzahlung_erkannt === false) {
      befunde.push({
        regelId: 'plausi-mietzahlung-fehlt', personId: konto.personId, kategorie: 'plausibilitaet', typ: 'anforderung',
        titel: 'Mietzahlung nicht belegt',
        belegtext: 'Auf dem vorliegenden Kontoauszug ist keine Mietzahlung erkennbar — ein aktueller Zahlungsnachweis ist erforderlich (§ 9 WoGG).',
        quellDokumentId: konto.id,
      });
    }
    // Unerklärte Einkünfte (z. B. Dividenden) auf dem Kontoauszug
    const erkannt = konto.analyse?.erkannte_einkuenfte ?? [];
    const person = personById(personen, konto.personId);
    for (const art of erkannt) {
      const deklariert = (person?.einkommen ?? []).some(e => e.art === art);
      if (!deklariert) {
        befunde.push({
          regelId: `plausi-kontoauszug-unerklaerte-einkuenfte:${art}`, personId: konto.personId,
          kategorie: 'plausibilitaet', typ: 'anforderung',
          titel: `${EINKUNFTS_LABEL[art] ?? art} nicht angegeben`,
          belegtext: `Der Kontoauszug weist ${EINKUNFTS_LABEL[art] ?? art} aus, die im Antrag nicht angegeben sind. Bitte nacherklären (§ 14 WoGG).`,
          quellDokumentId: konto.id,
        });
      }
    }
  }

  // ── Rentenart / Grundrentenzeiten ────────────────────────────────────
  for (const rente of docsOfType(dokumente, 'rentenbescheid')) {
    const a = rente.analyse;
    if (a && (a.rentenart_vorhanden === false || a.grundrentenzeiten_vorhanden === false)) {
      const person = personById(personen, rente.personId);
      const label = person ? `${person.vorname} ${person.nachname}`.trim() : 'die betreffende Person';
      befunde.push({
        regelId: 'plausi-rentenart-fehlt', personId: rente.personId, kategorie: 'plausibilitaet', typ: 'info',
        titel: 'Rentenart/Grundrentenzeiten unklar',
        belegtext: `Der Rentenbescheid für ${label} weist Rentenart bzw. Grundrentenzeiten nicht aus — für die Freibetragsprüfung (§ 17) nachfordern.`,
        quellDokumentId: rente.id,
      });
    }
  }

  // ── Vermögen über Freigrenze (§ 21 Nr. 3) ────────────────────────────
  const vermoegenSumme = haushaltsVermoegen(personen);
  if (vermoegenSumme > 0) {
    const freigrenze = vermoegensFreigrenze(personen.length || 1);
    if (vermoegenSumme > freigrenze) {
      befunde.push({
        regelId: 'plausi-vermoegen-ueber-freigrenze', kategorie: 'plausibilitaet', typ: 'anforderung',
        titel: 'Vermögen über Freigrenze',
        belegtext: `Das Haushaltsvermögen (${euro(vermoegenSumme)}) überschreitet die Freigrenze von ${euro(freigrenze)} `
          + `(60.000 € + 30.000 € je weiterem Mitglied, ${personen.length} Mitglied(er)). `
          + `Vermögensnachweise und Zweckerklärung anfordern, dann Einzelfallbewertung (§ 21 Nr. 3 WoGG).`,
      });
    }
  }

  // ── Ausschluss wegen Transferleistung mit enthaltenen Unterkunftskosten (§ 7) ──
  for (const p of personen) {
    const mitKdu = (p.transferleistungenDetail ?? []).filter(t => t.kduEnthalten);
    if (mitKdu.length > 0) {
      const label = `${p.vorname} ${p.nachname}`.trim() || 'Ein Haushaltsmitglied';
      const arten = mitKdu.map(t => t.art).filter(Boolean).join(', ');
      befunde.push({
        regelId: 'ausschluss-person-transferbezug', personId: p.id, kategorie: 'plausibilitaet', typ: 'info',
        titel: 'Möglicher Wohngeld-Ausschluss (§ 7)',
        belegtext: `${label} bezieht eine Transferleistung mit enthaltenen Unterkunftskosten`
          + `${arten ? ` (${arten})` : ''}. Prüfen, ob nach § 7 WoGG ein Ausschluss vorliegt und das `
          + `Mitglied bei der Wohngeldberechnung außer Betracht bleibt.`,
      });
    }
  }

  // ── Bewilligungszeitraum-Vorschlag (§ 22/§ 25) ───────────────────────
  const hatBwz = (vorgang.bwz?.length ?? 0) > 0 || !!vorgang.bwz_start;
  if (!hatBwz && vorgang.antragsdatum) {
    const vorschlag = berechneBwzVorschlag(vorgang.antragsdatum);
    if (vorschlag) {
      befunde.push({
        regelId: 'bwz-vorschlag-pruefen', kategorie: 'plausibilitaet', typ: 'info',
        titel: 'Bewilligungszeitraum festlegen',
        belegtext: `Es ist noch kein Bewilligungszeitraum erfasst. Vorschlag: 12 Monate ab Antragsmonat `
          + `(${fmtDe(vorschlag.start)} – ${fmtDe(vorschlag.ende)}, § 22/§ 25 WoGG).`,
      });
    }
  }

  return befunde;
}
