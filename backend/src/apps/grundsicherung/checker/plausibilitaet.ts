/**
 * Grundsicherung — Plausibilitätsprüfung (Widersprüche zwischen Antragsangaben und Nachweisen).
 * Reine Funktionen; Regel-IDs und Recht: docs/grundsicherung-regelkatalog-2026-09-27.md
 * Abschnitt 2. Beschreibung jeder Regel in `regeln.ts` (Wächter-Test).
 *
 * Vergleichsgrundlage: Vorgangs-/Personenangaben (Antrag) ↔ `dokument.analyse` (Nachweise,
 * Felder laut DokumentAnalyse-Vertrag in types.ts). Keine Berechnung von Bedarf/Zahlbetrag.
 */
import { dayPart } from '../../_antrag-kern/datum';
import { altersgrenzeFuerJahrgang, fmtAltersgrenze } from '../../_vorrang/altersgrenze';
import { EINKOMMENS_ARTEN, VERMOEGENS_ARTEN, type Dokument, type EingangArt, type Person, type PruefBefund } from '../types';
import {
  alterAm, altersgrenzeErreicht, altersgrenzeErreichtAm, analysen, beziehtGesetzlicheRente, docs, docsFuer,
  dokLabel, emBefund, emIstAnspruchsgrund, einkommenBetrag, euro, fmtDatum, fmtMonat, folgemonat,
  geburtsdatumBelegt, istMietwohnung, mietToleranz, nameGehoertZu, normName,
  personLabel, vermoegenUebersicht, type PruefKontext,
} from './helfer';
import { alterRentenbescheid, bwzUmfasstAnpassung, renteAktuellBelegt } from './nachweise';

const P = 'plausibilitaet' as const;

/** Welche Einkommensarten erklären einen Kontoeingang dieser Art? */
const EINGANG_ERKLAERT_DURCH: Partial<Record<EingangArt, readonly string[]>> = {
  rente: EINKOMMENS_ARTEN.gesetzlicheRente,
  betriebsrente: EINKOMMENS_ARTEN.betriebsrente,
  unterhalt: EINKOMMENS_ARTEN.unterhalt,
  erwerb: EINKOMMENS_ARTEN.erwerb,
  kapitalertrag: EINKOMMENS_ARTEN.kapitalertrag,
  miete_einnahme: EINKOMMENS_ARTEN.vermietung,
  zuwendung: EINKOMMENS_ARTEN.zuwendung,
  sozialleistung: EINKOMMENS_ARTEN.sozialleistung,
};

const EINGANG_LABEL: Record<EingangArt, string> = {
  rente: 'Rente', betriebsrente: 'Betriebs-/Zusatzrente', wohngeld: 'Wohngeld', unterhalt: 'Unterhalt',
  erwerb: 'Erwerbseinkommen', kapitalertrag: 'Kapitalerträge', miete_einnahme: 'Mieteinnahmen',
  zuwendung: 'Zuwendungen', sozialleistung: 'Sozialleistung', erstattung: 'Erstattung', sonstige: 'nicht zugeordnete Eingänge',
};

/** Rentenbetrag-Quellen, neueste zuerst: Anpassungsmitteilung → Kontoauszug → Rentenbescheid. */
function aktuellsteRentenquelle(ctx: PruefKontext, p: Person): { betrag: number; quelle: string; dokId: string } | null {
  const anp = analysen(docsFuer(ctx, 'rentenanpassungsmitteilung', p.id), 'rentenanpassungsmitteilung')
    .filter(({ a }) => typeof a.zahlbetrag_neu === 'number')
    .sort((x, y) => (dayPart(y.a.stichtag) ?? '').localeCompare(dayPart(x.a.stichtag) ?? ''))[0];
  if (anp) return { betrag: anp.a.zahlbetrag_neu!, quelle: `Rentenanpassungsmitteilung${anp.a.stichtag ? ` zum ${fmtDatum(anp.a.stichtag)}` : ''}`, dokId: anp.dok.id };
  const konto = analysen(docsFuer(ctx, 'kontoauszug', p.id), 'kontoauszug')
    .map(({ dok, a }) => ({ dok, a, e: (a.eingaenge ?? []).find((e) => e.art === 'rente' && typeof e.betrag === 'number') }))
    .filter((x) => !!x.e)
    .sort((x, y) => (dayPart(y.a.zeitraum_bis) ?? '').localeCompare(dayPart(x.a.zeitraum_bis) ?? ''))[0];
  if (konto) return { betrag: konto.e!.betrag!, quelle: `${dokLabel(konto.dok, 'Kontoauszug')} (Eingang „${konto.e!.verwendungszweck ?? 'Rente'}")`, dokId: konto.dok.id };
  const bescheid = analysen(docsFuer(ctx, 'rentenbescheid', p.id), 'rentenbescheid')
    .filter(({ a }) => typeof a.zahlbetrag === 'number')
    .sort((x, y) => (dayPart(y.a.bescheiddatum) ?? '').localeCompare(dayPart(x.a.bescheiddatum) ?? ''))[0];
  if (bescheid) return { betrag: bescheid.a.zahlbetrag!, quelle: `Rentenbescheid${bescheid.a.bescheiddatum ? ` vom ${fmtDatum(bescheid.a.bescheiddatum)}` : ''}`, dokId: bescheid.dok.id };
  return null;
}

export function pruefePlausibilitaet(ctx: PruefKontext): PruefBefund[] {
  const { vorgang } = ctx;
  const befunde: PruefBefund[] = [];
  const at = ctx.antragsteller;

  // ── 2.1 Anspruchsvoraussetzungen ─────────────────────────────────────
  if (at && vorgang.anspruchsgrund === 'alter' && ctx.antragsdatum) {
    const geb = geburtsdatumBelegt(ctx, at);
    const erreichtAm = altersgrenzeErreichtAm(geb);
    if (geb && erreichtAm) {
      const antragsmonat = ctx.antragsdatum.slice(0, 7);
      const grenzmonat = erreichtAm.slice(0, 7);
      const grenze = fmtAltersgrenze(altersgrenzeFuerJahrgang(Number(geb.slice(0, 4))));
      if (grenzmonat === folgemonat(antragsmonat)) {
        befunde.push({
          regelId: 'plausi-altersgrenze-folgemonat', personId: at.id, kategorie: P, typ: 'info',
          titel: 'Altersgrenze erst im Folgemonat erreicht',
          belegtext: `${personLabel(at)} (geb. ${fmtDatum(geb)}) erreicht die Altersgrenze von ${grenze} am ${fmtDatum(erreichtAm)}, also erst im Monat nach dem Antragsmonat ${fmtMonat(ctx.antragsdatum)}. Leistungsbeginn wegen Alters frühestens ${fmtMonat(erreichtAm)} (§ 44 Abs. 2, § 41 Abs. 2 SGB XII).`,
        });
      } else if (grenzmonat > antragsmonat) {
        befunde.push({
          regelId: 'plausi-altersgrenze-nicht-erreicht', personId: at.id, kategorie: P, typ: 'anforderung',
          titel: 'Altersgrenze noch nicht erreicht',
          belegtext: `Anspruchsgrund ist Alter, aber ${personLabel(at)} (geb. ${fmtDatum(geb)}) erreicht die Altersgrenze von ${grenze} erst am ${fmtDatum(erreichtAm)}; Antragsmonat ${fmtMonat(ctx.antragsdatum)}. Anspruchsgrund klären (dauerhafte volle Erwerbsminderung?) oder Zuständigkeit des Jobcenters prüfen (§ 41 Abs. 2 SGB XII).`,
        });
      }
    }
  }

  for (const p of ctx.eg) {
    // Geburtsdatum: Antrag ↔ Ausweis ↔ Rentenbescheid
    const quellen: Array<{ wert: string; quelle: string; dokId?: string }> = [];
    if (dayPart(p.geburtsdatum)) quellen.push({ wert: dayPart(p.geburtsdatum)!, quelle: 'Antrag' });
    for (const { dok, a } of analysen(docsFuer(ctx, 'personalausweis', p.id), 'personalausweis')) {
      if (dayPart(a.geburtsdatum)) quellen.push({ wert: dayPart(a.geburtsdatum)!, quelle: 'Ausweis', dokId: dok.id });
    }
    for (const { dok, a } of analysen(docsFuer(ctx, 'rentenbescheid', p.id), 'rentenbescheid')) {
      if (dayPart(a.geburtsdatum)) quellen.push({ wert: dayPart(a.geburtsdatum)!, quelle: 'Rentenbescheid', dokId: dok.id });
    }
    if (new Set(quellen.map((q) => q.wert)).size > 1) {
      befunde.push({
        regelId: 'plausi-geburtsdatum-abweichung', personId: p.id, kategorie: P, typ: 'anforderung',
        titel: 'Geburtsdatum weicht ab',
        belegtext: `Das Geburtsdatum von ${personLabel(p)} ist uneinheitlich: ${quellen.map((q) => `${q.quelle} ${fmtDatum(q.wert)}`).join(', ')}. Richtiges Datum klären — es bestimmt die Altersgrenze (§ 41 Abs. 2 SGB XII).`,
        quellDokumentId: quellen.find((q) => q.dokId)?.dokId,
      });
    }

    // Erwerbsminderung
    if (emIstAnspruchsgrund(ctx, p)) {
      const em = emBefund(ctx, p);
      if (em.befristet) {
        befunde.push({
          regelId: 'plausi-em-rente-befristet', personId: p.id, kategorie: P, typ: 'anforderung',
          titel: 'EM-Rente befristet',
          belegtext: `Die Erwerbsminderungsrente von ${personLabel(p)} ist befristet${em.befristet.bis ? ` bis ${fmtDatum(em.befristet.bis)}` : ''} (${em.befristet.quelle}). Damit ist die dauerhafte volle Erwerbsminderung nicht belegt; Ersuchen an den Rentenversicherungsträger prüfen (§ 41 Abs. 3, § 45 SGB XII; § 102 Abs. 2 SGB VI).`,
          quellDokumentId: em.befristet.dokId,
        });
      }
      if (em.teilweiseOderArbeitsmarkt) {
        const t = em.teilweiseOderArbeitsmarkt;
        befunde.push({
          regelId: 'plausi-em-rente-teilweise-oder-arbeitsmarkt', personId: p.id, kategorie: P, typ: 'anforderung',
          titel: t.grund === 'teilweise' ? 'Nur teilweise Erwerbsminderung' : 'EM-Rente wegen Arbeitsmarktlage',
          belegtext: t.grund === 'teilweise'
            ? `Für ${personLabel(p)} ist nur eine teilweise Erwerbsminderung belegt (${t.quelle}). Die Voraussetzung „voll erwerbsgemindert" nach § 41 Abs. 3 SGB XII ist damit nicht erfüllt.`
            : `Die volle Erwerbsminderungsrente von ${personLabel(p)} wird wegen der Arbeitsmarktlage gezahlt (${t.quelle}). Das belegt keine Erwerbsminderung „unabhängig von der jeweiligen Arbeitsmarktlage" (§ 41 Abs. 3 SGB XII).`,
          quellDokumentId: t.dokId,
        });
      }
    }
  }

  // ── 2.2 Einsatzgemeinschaft ──────────────────────────────────────────
  if (at && !ctx.partner) {
    const gruende: string[] = [];
    let quellDok: string | undefined;
    if (at.familienstand === 'verheiratet' || at.familienstand === 'lebenspartnerschaft' || at.familienstand === 'eheaehnlich') {
      const fs = { verheiratet: 'verheiratet', lebenspartnerschaft: 'in eingetragener Lebenspartnerschaft', eheaehnlich: 'in eheähnlicher Gemeinschaft' }[at.familienstand];
      gruende.push(`Familienstand „${fs}"`);
    }
    for (const { dok, a } of analysen(docs(ctx, 'mietvertrag'), 'mietvertrag')) {
      const mitmieter = (a.mieter ?? []).filter((n) => !ctx.personen.some((p) => nameGehoertZu(n, p)));
      const gleicherName = mitmieter.filter((n) => normName(n).includes(normName(at.nachname)) && !!normName(at.nachname));
      if (gleicherName.length) {
        gruende.push(`im Mietvertrag ${gleicherName.length === 1 ? 'ist' : 'sind'} ${gleicherName.map((n) => `„${n}"`).join(', ')} als Mitmieter:in eingetragen, aber nicht im Antrag erfasst`);
        quellDok ??= dok.id;
      }
    }
    const atAlter = alterAm(geburtsdatumBelegt(ctx, at), ctx.stichtag);
    for (const h of ctx.haushaltsangehoerige) {
      const hAlter = alterAm(h.geburtsdatum, ctx.stichtag);
      if (normName(h.nachname) === normName(at.nachname) && atAlter !== null && hAlter !== null && hAlter >= 18 && Math.abs(atAlter - hAlter) <= 10) {
        gruende.push(`${personLabel(h)} (gleicher Nachname, ähnliches Alter) ist nur als haushaltsangehörig erfasst`);
      }
    }
    if (gruende.length) {
      befunde.push({
        regelId: 'plausi-partner-fehlt', kategorie: P, typ: 'anforderung',
        titel: 'Partner:in fehlt in der Einsatzgemeinschaft',
        belegtext: `Es ist keine Partnerin bzw. kein Partner erfasst, aber: ${gruende.join('; ')}. Einsatzgemeinschaft klären; Einkommen, Vermögen und Nachweise der Partnerin bzw. des Partners fehlen ggf. (§ 43 Abs. 1 Satz 2, § 20 SGB XII).`,
        quellDokumentId: quellDok,
      });
    }
  }

  const antragAnalysen = analysen(docs(ctx, 'grundsicherungsantrag'), 'grundsicherungsantrag');
  const stufeDok = antragAnalysen.find(({ a }) => a.regelbedarfsstufe !== undefined);
  if (stufeDok) {
    const stufe = stufeDok.a.regelbedarfsstufe!;
    const einrichtung = vorgang.wohnsituation === 'einrichtung';
    let widerspruch: string | null = null;
    if (stufe === 2 && !ctx.partner && !einrichtung) widerspruch = 'Regelbedarfsstufe 2 ist angegeben, aber keine Partnerin bzw. kein Partner in der Wohnung erfasst';
    else if (stufe === 1 && ctx.partner) widerspruch = 'Regelbedarfsstufe 1 ist angegeben, aber eine Partnerin bzw. ein Partner lebt mit in der Wohnung (Stufe 2)';
    else if (stufe === 3 && !einrichtung && vorgang.wohnsituation) widerspruch = 'Regelbedarfsstufe 3 ist angegeben, obwohl eine eigene Wohnung (keine Einrichtung) erfasst ist';
    if (widerspruch) {
      befunde.push({
        regelId: 'plausi-regelbedarfsstufe-inkonsistent', kategorie: P, typ: 'info',
        titel: 'Regelbedarfsstufe prüfen',
        belegtext: `${widerspruch}. Stufe anhand der Wohn- und Partnersituation prüfen (Anlage zu § 28 SGB XII).`,
        quellDokumentId: stufeDok.dok.id,
      });
    }
  }

  // ── 2.3 Unterkunft und Heizung ───────────────────────────────────────
  if (istMietwohnung(vorgang)) {
    const w = vorgang.wohnung ?? {};
    const abweichungen: string[] = [];
    let quellDok: string | undefined;
    const referenz = analysen(docs(ctx, 'vermieterbescheinigung'), 'vermieterbescheinigung')
      .sort((x, y) => (dayPart(y.a.gueltig_ab) ?? '').localeCompare(dayPart(x.a.gueltig_ab) ?? ''))[0];
    const mv = analysen(docs(ctx, 'mietvertrag'), 'mietvertrag')[0];
    const ref = referenz
      ? { grundmiete: referenz.a.grundmiete, nk: referenz.a.nebenkosten_kalt, name: 'Vermieterbescheinigung', dokId: referenz.dok.id }
      : mv ? { grundmiete: mv.a.grundmiete, nk: mv.a.nebenkosten_kalt, name: 'Mietvertrag', dokId: mv.dok.id } : null;
    if (ref) {
      if (typeof w.kaltmiete === 'number' && typeof ref.grundmiete === 'number' && Math.abs(w.kaltmiete - ref.grundmiete) > mietToleranz(ctx, ref.grundmiete)) {
        abweichungen.push(`Kaltmiete: Antrag ${euro(w.kaltmiete)}, ${ref.name} ${euro(ref.grundmiete)}`);
        quellDok ??= ref.dokId;
      }
      if (typeof w.nebenkosten_kalt === 'number' && typeof ref.nk === 'number' && Math.abs(w.nebenkosten_kalt - ref.nk) > mietToleranz(ctx, ref.nk)) {
        abweichungen.push(`kalte Nebenkosten: Antrag ${euro(w.nebenkosten_kalt)}, ${ref.name} ${euro(ref.nk)}`);
        quellDok ??= ref.dokId;
      }
    }
    if (typeof w.kaltmiete === 'number') {
      const ohneHeizung = w.kaltmiete + (w.nebenkosten_kalt ?? 0);
      const mitHeizung = ohneHeizung + (w.heizkosten ?? 0);
      for (const { dok, a } of analysen(docs(ctx, 'kontoauszug'), 'kontoauszug')) {
        if (typeof a.mietzahlung_betrag !== 'number') continue;
        const passt = [ohneHeizung, mitHeizung].some((s) => Math.abs(a.mietzahlung_betrag! - s) <= mietToleranz(ctx, s));
        if (!passt) {
          abweichungen.push(`Mietzahlung laut ${dokLabel(dok, 'Kontoauszug')} ${euro(a.mietzahlung_betrag)}, Antrag ${euro(mitHeizung)} (Kaltmiete + Nebenkosten${w.heizkosten ? ' + Heizkosten' : ''})`);
          quellDok ??= dok.id;
          break;
        }
      }
    }
    if (abweichungen.length) {
      befunde.push({
        regelId: 'plausi-miete-abweichung', kategorie: P, typ: 'anforderung',
        titel: 'Miethöhe weicht ab',
        belegtext: `Die Mietangaben passen nicht zu den Nachweisen — ${abweichungen.join('; ')}. Aktuelle Miethöhe (z. B. letzte Mieterhöhung) anfordern (§ 35 Abs. 1 SGB XII).`,
        quellDokumentId: quellDok,
      });
    }

    const egIds = new Set(ctx.eg.map((p) => p.id));
    const auszuege = analysen(docs(ctx, 'kontoauszug').filter((d) => !d.personId || egIds.has(d.personId)), 'kontoauszug');
    const ohneMiete = auszuege.filter(({ a }) => a.mietzahlung_erkannt === false);
    if (ohneMiete.length > 0 && !auszuege.some(({ a }) => a.mietzahlung_erkannt === true)) {
      befunde.push({
        regelId: 'plausi-miete-nicht-gezahlt', kategorie: P, typ: 'anforderung',
        titel: 'Mietzahlung nicht erkennbar',
        belegtext: `Auf den vorliegenden Kontoauszügen (${ohneMiete.map(({ dok }) => dokLabel(dok, 'Kontoauszug')).join(', ')}) ist keine Mietzahlung erkennbar. Klären, wie die Miete gezahlt wird (bar, durch Dritte, anderes Konto) und Nachweis anfordern (§ 35 Abs. 1 SGB XII).`,
        quellDokumentId: ohneMiete[0]!.dok.id,
      });
    }

    const heizungAufgeteilt = analysen(docs(ctx, 'vermieterbescheinigung'), 'vermieterbescheinigung').some(({ a }) => typeof a.heizkosten === 'number');
    const pauschalDok = analysen(docs(ctx, 'mietvertrag'), 'mietvertrag')
      .find(({ a }) => (typeof a.pauschalmiete === 'number' || a.heizkosten_enthalten === true) && typeof a.heizkosten !== 'number');
    const angabePauschal = w.heizung_in_miete_enthalten === true && typeof w.heizkosten !== 'number';
    if (!heizungAufgeteilt && (pauschalDok || angabePauschal)) {
      const detail = pauschalDok && typeof pauschalDok.a.pauschalmiete === 'number'
        ? `Der Mietvertrag nennt eine Pauschalmiete von ${euro(pauschalDok.a.pauschalmiete)} ohne gesonderten Heizkostenanteil`
        : pauschalDok ? 'Laut Mietvertrag sind die Heizkosten in der Miete enthalten, ohne eigenen Betrag'
          : 'Laut Antrag sind die Heizkosten in der Miete enthalten, ein Betrag ist nicht angegeben';
      befunde.push({
        regelId: 'plausi-heizung-in-miete-unklar', kategorie: P, typ: 'anforderung',
        titel: 'Heizkosten nicht getrennt ausgewiesen',
        belegtext: `${detail}. Aufteilung in Grundmiete, kalte Nebenkosten und Heizkosten beim Vermieter anfordern — Heizung ist ein eigenständiger Bedarf (§ 35 Abs. 1, § 42a SGB XII).`,
        quellDokumentId: pauschalDok?.dok.id,
      });
    }
  }

  // ── 2.4 Einkommen ────────────────────────────────────────────────────
  const egArten = new Set(ctx.eg.flatMap((p) => (p.einkommen ?? []).map((e) => e.art)));
  for (const p of ctx.eg) {
    if (beziehtGesetzlicheRente(p)) {
      const angabe = einkommenBetrag(p, EINKOMMENS_ARTEN.gesetzlicheRente);
      const quelle = aktuellsteRentenquelle(ctx, p);
      if (typeof angabe === 'number' && quelle && Math.abs(angabe - quelle.betrag) > ctx.k.RENTE_TOLERANZ_EUR) {
        befunde.push({
          regelId: 'plausi-rente-abweichung', personId: p.id, kategorie: P, typ: 'anforderung',
          titel: 'Rentenbetrag weicht ab',
          belegtext: `Für ${personLabel(p)} ist im Antrag eine Rente von ${euro(angabe)} angegeben, laut ${quelle.quelle} sind es ${euro(quelle.betrag)}. Aktuellen Zahlbetrag klären (§ 82 Abs. 1 SGB XII).`,
          quellDokumentId: quelle.dokId,
        });
      }
      if (bwzUmfasstAnpassung(ctx) && !renteAktuellBelegt(ctx, p)) {
        const alt = alterRentenbescheid(ctx, p);
        if (alt && typeof angabe === 'number' && typeof alt.a.zahlbetrag === 'number' && Math.abs(angabe - alt.a.zahlbetrag) <= ctx.k.RENTE_TOLERANZ_EUR) {
          befunde.push({
            regelId: 'plausi-rentenanpassung-fehlt', personId: p.id, kategorie: P, typ: 'anforderung',
            titel: 'Rentenangabe vor der Rentenanpassung',
            belegtext: `Die Rentenangabe von ${personLabel(p)} (${euro(angabe)}) entspricht dem Rentenbescheid vom ${fmtDatum(alt.a.bescheiddatum)}. Der Bewilligungszeitraum reicht über den ${fmtDatum(ctx.k.RENTENANPASSUNG_STICHTAG)} hinaus; der angepasste Betrag ab diesem Stichtag ist nicht berücksichtigt (§ 82 Abs. 1, 7 SGB XII).`,
            quellDokumentId: alt.dok.id,
          });
        }
      }
    }

    // Unerklärte regelmäßige Eingänge (Wohngeld → eigene Regel plausi-wohngeld-als-einkommen)
    const unerklaert: string[] = [];
    let quellDok: string | undefined;
    for (const { dok, a } of analysen(docsFuer(ctx, 'kontoauszug', p.id), 'kontoauszug')) {
      for (const e of a.eingaenge ?? []) {
        if (!e.wiederkehrend || !e.art || e.art === 'wohngeld' || e.art === 'erstattung') continue;
        const erklaerer = EINGANG_ERKLAERT_DURCH[e.art];
        const erklaert = erklaerer
          ? erklaerer.some((art) => egArten.has(art)) || (e.art === 'sozialleistung' && !!vorgang.vorbezug?.leistung)
          : false;
        if (erklaert) continue;
        const anzahl = e.anzahl && e.anzahl > 1 ? `${e.anzahl} Eingänge` : 'regelmäßige Eingänge';
        unerklaert.push(`${dokLabel(dok, 'Kontoauszug')}: ${anzahl} „${e.verwendungszweck ?? EINGANG_LABEL[e.art]}"${typeof e.betrag === 'number' ? ` à ${euro(e.betrag)}` : ''} (${EINGANG_LABEL[e.art]})`);
        quellDok ??= dok.id;
      }
    }
    if (unerklaert.length) {
      befunde.push({
        regelId: 'plausi-kontoauszug-unerklaerte-eingaenge', personId: p.id, kategorie: P, typ: 'anforderung',
        titel: 'Nicht angegebene regelmäßige Eingänge',
        belegtext: `Auf dem Konto von ${personLabel(p)} gibt es regelmäßige Eingänge, die im Antrag nicht als Einkommen erscheinen — ${unerklaert.join('; ')}. Herkunft klären und Nachweis anfordern (§ 82 Abs. 1 SGB XII).`,
        quellDokumentId: quellDok,
      });
    }
  }

  if (!egArten.has('wohngeld')) {
    const bescheid = analysen(docs(ctx, 'wohngeldbescheid'), 'wohngeldbescheid')[0];
    const bescheidDok = bescheid?.dok ?? docs(ctx, 'wohngeldbescheid')[0];
    const konto = analysen(docs(ctx, 'kontoauszug'), 'kontoauszug')
      .map(({ dok, a }) => ({ dok, e: (a.eingaenge ?? []).find((e) => e.art === 'wohngeld') }))
      .find((x) => !!x.e);
    if (bescheidDok || konto) {
      const teile: string[] = [];
      if (bescheidDok) teile.push(`Ein Wohngeldbescheid liegt vor${typeof bescheid?.a.betrag_monat === 'number' ? ` (${euro(bescheid.a.betrag_monat)} monatlich${bescheid.a.bwz_von ? `, ${fmtDatum(bescheid.a.bwz_von)} – ${fmtDatum(bescheid.a.bwz_bis)}` : ''})` : ''}`);
      if (konto) teile.push(`${dokLabel(konto.dok, 'Kontoauszug')} zeigt Wohngeld-Eingänge${typeof konto.e!.betrag === 'number' ? ` à ${euro(konto.e!.betrag)}` : ''}`);
      befunde.push({
        regelId: 'plausi-wohngeld-als-einkommen', kategorie: P, typ: 'anforderung',
        titel: 'Wohngeld nicht als Einkommen angegeben',
        belegtext: `${teile.join('; ')}. Im Antrag ist Wohngeld nicht als Einkommen angegeben. Solange Wohngeld bezogen wird, ist es Einkommen (§ 82 Abs. 1 SGB XII).`,
        quellDokumentId: bescheidDok?.id ?? konto?.dok.id,
      });
    }
  }

  // ── 2.5 Vermögen ─────────────────────────────────────────────────────
  const verm = vermoegenUebersicht(ctx);
  if (verm.wert > verm.schonbetrag) {
    befunde.push({
      regelId: 'plausi-vermoegen-ueber-schonbetrag', kategorie: P, typ: 'info',
      titel: 'Vermögen über dem Schonbetrag',
      belegtext: `Das verwertbare Barvermögen der Einsatzgemeinschaft (${euro(verm.wert)}; ${verm.quellen.join('; ')}) liegt über dem Barbetrag von ${euro(verm.schonbetrag)} (${verm.volljaehrige} × ${euro(ctx.k.SCHONBETRAG_JE_PERSON)}${verm.unterhaltene ? ` + ${verm.unterhaltene} × ${euro(ctx.k.SCHONBETRAG_UNTERHALTENE)}` : ''}). Sachbearbeitung prüft Einsatz, Schonvermögen und Härte (§ 90 Abs. 2 Nr. 9, Abs. 3 SGB XII) — keine automatische Ablehnung.`,
    });
  }

  for (const p of ctx.eg) {
    const kontoAngaben = (p.vermoegen ?? []).filter((v) => (VERMOEGENS_ARTEN.konto as readonly string[]).includes(v.art) && typeof v.betrag === 'number');
    const jeKonto = new Map<string, { bis: string; saldo: number; dok: Dokument }>();
    for (const { dok, a } of analysen(docsFuer(ctx, 'kontoauszug', p.id), 'kontoauszug')) {
      if (typeof a.endsaldo !== 'number') continue;
      const key = a.iban?.replace(/\s+/g, '') || dok.id;
      const bis = dayPart(a.zeitraum_bis) ?? '';
      const vorher = jeKonto.get(key);
      if (!vorher || bis > vorher.bis) jeKonto.set(key, { bis, saldo: a.endsaldo, dok });
    }
    if (jeKonto.size === 0 || p.vermoegen === undefined) continue;
    const saldo = [...jeKonto.values()].reduce((s, k) => s + k.saldo, 0);
    const angabe = kontoAngaben.reduce((s, v) => s + (v.betrag ?? 0), 0);
    const toleranz = Math.max(ctx.k.KONTOSTAND_TOLERANZ_EUR, Math.abs(angabe) * ctx.k.KONTOSTAND_TOLERANZ_PROZENT);
    // Mehr Guthaben als angegeben → immer melden. Weniger → nur, wenn genau ein Konto angegeben ist
    // (sonst kann das Fehlende auf einem Konto ohne Auszug liegen, z. B. Sparbuch).
    const hoeher = saldo - angabe > toleranz;
    const nurEinGirokonto = kontoAngaben.length === 1 && kontoAngaben[0]!.art === 'girokonto' && jeKonto.size === 1;
    const niedriger = nurEinGirokonto && angabe - saldo > toleranz;
    if (hoeher || niedriger) {
      const erster = [...jeKonto.values()][0]!;
      befunde.push({
        regelId: 'plausi-kontostand-abweichung', personId: p.id, kategorie: P, typ: 'anforderung',
        titel: 'Kontostand weicht von der Vermögensangabe ab',
        belegtext: `Für ${personLabel(p)} sind Kontoguthaben von ${euro(angabe)} angegeben, die Kontoauszüge weisen ${euro(saldo)} aus (${[...jeKonto.values()].map((k) => `${dokLabel(k.dok, 'Kontoauszug')}: ${euro(k.saldo)}`).join('; ')}). Abweichung klären (§ 90 Abs. 1 SGB XII).`,
        quellDokumentId: erster.dok.id,
      });
    }
  }

  for (const p of ctx.eg) {
    const gross: string[] = [];
    let quellDok: string | undefined;
    for (const { dok, a } of analysen(docsFuer(ctx, 'kontoauszug', p.id), 'kontoauszug')) {
      for (const g of a.grosse_abgaenge ?? []) {
        if (typeof g.betrag !== 'number' || Math.abs(g.betrag) < ctx.k.GROSSE_ABGAENGE_SCHWELLE) continue;
        gross.push(`${euro(Math.abs(g.betrag))}${g.datum ? ` am ${fmtDatum(g.datum)}` : ''}${g.verwendungszweck ? ` („${g.verwendungszweck}")` : ''} laut ${dokLabel(dok, 'Kontoauszug')}`);
        quellDok ??= dok.id;
      }
    }
    if (gross.length) {
      befunde.push({
        regelId: 'plausi-grosse-abgaenge', personId: p.id, kategorie: P, typ: 'info',
        titel: 'Größere Abgänge ohne erkennbaren Zweck',
        belegtext: `Auf dem Konto von ${personLabel(p)}: ${gross.join('; ')}. Verbleib klären (§ 90, § 41 Abs. 4 SGB XII) — Sachbearbeitung entscheidet.`,
        quellDokumentId: quellDok,
      });
    }
  }

  // ── 2.6 Mehrbedarfe ──────────────────────────────────────────────────
  const istG = (m: string) => /^a?g$/i.test(m.trim());
  for (const p of ctx.eg) {
    const angabeG = (p.schwerbehinderung?.merkzeichen ?? []).some(istG);
    for (const { dok, a } of analysen(docsFuer(ctx, 'schwerbehindertenausweis', p.id), 'schwerbehindertenausweis')) {
      if (!angabeG && (a.merkzeichen ?? []).some(istG) && (altersgrenzeErreicht(ctx, p) !== false || p.erwerbsminderung?.voll === true)) {
        befunde.push({
          regelId: 'plausi-merkzeichen-g-nicht-beantragt', personId: p.id, kategorie: P, typ: 'info',
          titel: 'Merkzeichen G — Mehrbedarf nicht beantragt',
          belegtext: `Der Schwerbehindertenausweis von ${personLabel(p)} weist Merkzeichen ${(a.merkzeichen ?? []).filter(istG).join('/')} aus, im Antrag ist es nicht angegeben. Mehrbedarf nach § 30 Abs. 1 SGB XII zugunsten prüfen.`,
          quellDokumentId: dok.id,
        });
        break;
      }
    }
    const bezug = ctx.bwz?.ende ?? ctx.stichtag;
    for (const { dok, a } of analysen(docsFuer(ctx, 'schwerbehindertenausweis', p.id), 'schwerbehindertenausweis')) {
      const bis = dayPart(a.gueltig_bis);
      if (bis && bis < bezug) {
        befunde.push({
          regelId: 'plausi-ausweis-abgelaufen', personId: p.id, kategorie: P, typ: 'anforderung',
          titel: 'Schwerbehindertenausweis läuft ab',
          belegtext: `Der Schwerbehindertenausweis von ${personLabel(p)} ist nur gültig bis ${fmtDatum(bis)}${ctx.bwz ? ` — vor Ende des Bewilligungszeitraums (${fmtDatum(ctx.bwz.ende)})` : ''}. Verlängerung bzw. neuen Feststellungsbescheid anfordern (§ 30 Abs. 1 SGB XII).`,
          quellDokumentId: dok.id,
        });
        break;
      }
    }
  }

  // ── 2.7 Formales ─────────────────────────────────────────────────────
  if (antragAnalysen.length > 0 || docs(ctx, 'grundsicherungsantrag').length > 0) {
    if (!vorgang.antragsdatum && !dayPart(vorgang.ersteingang?.datum)) {
      const antragDok = docs(ctx, 'grundsicherungsantrag')[0]!;
      const ohneDatum = antragAnalysen.some(({ a }) => a.datum_vorhanden === false);
      const eingang = dayPart(antragDok.eingegangenAm);
      befunde.push({
        regelId: 'plausi-antrag-ohne-datum', kategorie: P, typ: 'anforderung',
        titel: 'Antragsdatum fehlt',
        belegtext: `${ohneDatum ? 'Der Antrag trägt kein Datum' : 'Im Vorgang ist kein Antragsdatum erfasst'} — der Leistungsbeginn (§ 44 Abs. 2 SGB XII) ist nicht bestimmbar. Maßgeblich ist der Eingang${eingang ? ` (Eingang laut Posteingang: ${fmtDatum(eingang)})` : ''}; bei Weiterleitung der Eingang bei der ersten Stelle (§ 16 Abs. 2 SGB I).`,
        quellDokumentId: antragDok.id,
      });
    }
  }

  return befunde;
}
