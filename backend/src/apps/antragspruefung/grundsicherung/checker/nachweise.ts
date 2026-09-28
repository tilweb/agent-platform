/**
 * Grundsicherung — Vollständigkeitsprüfung (welche Nachweise/Angaben fehlen?).
 * Reine Funktionen; Regel-IDs und Recht: docs/grundsicherung-regelkatalog-2026-09-27.md
 * Abschnitt 1. Beschreibung jeder Regel in `regeln.ts` (Wächter-Test).
 *
 * Personenbezogene Regeln gelten für die Einsatzgemeinschaft (Antragsteller:in + Partner:in);
 * Haushaltsangehörige lösen keine Nachweisanforderungen aus.
 */
import { dayPart } from '../../kern/datum';
import { analyseVon, EINKOMMENS_ARTEN, VERMOEGENS_ARTEN, type Person, type PruefBefund } from '../types';
import {
  analysen, beziehtGesetzlicheRente, docs, docsFuer, docsFuerOderOhne, emBefund, emIstAnspruchsgrund,
  altersgrenzeErreicht, fmtDatum, geburtsdatumBelegt, hatEinkommensart, istEigeneWohnung, istMietwohnung,
  monateZwischen, personLabel, tageInklusive, type PruefKontext,
} from './helfer';

const V = 'vollstaendigkeit' as const;

/** Liegt ein Nachweis der aktuellen Rentenhöhe ab dem Anpassungsstichtag vor? */
export function renteAktuellBelegt(ctx: PruefKontext, p: Person): boolean {
  const st = ctx.k.RENTENANPASSUNG_STICHTAG;
  const anpassung = analysen(docsFuer(ctx, 'rentenanpassungsmitteilung', p.id), 'rentenanpassungsmitteilung');
  // Anpassungsmitteilung ohne erkannten Stichtag zählt (Datum im Zweifel aktuell).
  if (anpassung.some(({ a }) => !dayPart(a.stichtag) || dayPart(a.stichtag)! >= st)) return true;
  if (docsFuer(ctx, 'rentenanpassungsmitteilung', p.id).some((d) => !d.analyse)) return true;
  return analysen(docsFuer(ctx, 'rentenbescheid', p.id), 'rentenbescheid')
    .some(({ a }) => (dayPart(a.bescheiddatum) ?? '') >= st || (dayPart(a.zahlbetrag_ab) ?? '') >= st);
}

/** Braucht der Fall Werte ab dem Anpassungsstichtag (Bewilligungszeitraum reicht darüber)? */
export function bwzUmfasstAnpassung(ctx: PruefKontext): boolean {
  return !!ctx.bwz && ctx.bwz.ende >= ctx.k.RENTENANPASSUNG_STICHTAG;
}

/** Ältester vorhandener Rentenbescheid mit Datum vor dem Stichtag (für Belegtexte). */
export function alterRentenbescheid(ctx: PruefKontext, p: Person) {
  const st = ctx.k.RENTENANPASSUNG_STICHTAG;
  const liste = analysen(docsFuer(ctx, 'rentenbescheid', p.id), 'rentenbescheid')
    .filter(({ a }) => dayPart(a.bescheiddatum) && dayPart(a.bescheiddatum)! < st && !((dayPart(a.zahlbetrag_ab) ?? '') >= st));
  return liste.sort((x, y) => (dayPart(y.a.bescheiddatum) ?? '').localeCompare(dayPart(x.a.bescheiddatum) ?? ''))[0];
}

export function pruefeNachweise(ctx: PruefKontext): PruefBefund[] {
  const { vorgang } = ctx;
  const befunde: PruefBefund[] = [];

  // ── Antrag ───────────────────────────────────────────────────────────
  const antraege = docs(ctx, 'grundsicherungsantrag');
  if (antraege.length === 0) {
    befunde.push({
      regelId: 'antrag-vollstaendig-unterschrieben', kategorie: V, typ: 'anforderung',
      titel: 'Vollständiger, unterschriebener Antrag',
      belegtext: 'Im Vorgang liegt kein ausgefüllter, datierter und unterschriebener Antrag auf Grundsicherung vor (§ 44 Abs. 1 SGB XII; § 60 SGB I).',
    });
  } else {
    const ohne = analysen(antraege, 'grundsicherungsantrag').find(({ a }) => a.unterschrift_vorhanden === false);
    const mit = analysen(antraege, 'grundsicherungsantrag').some(({ a }) => a.unterschrift_vorhanden === true);
    if (ohne && !mit) {
      befunde.push({
        regelId: 'antrag-vollstaendig-unterschrieben', kategorie: V, typ: 'anforderung',
        titel: 'Antrag ohne Unterschrift',
        belegtext: 'Auf dem vorliegenden Antrag wurde keine Unterschrift erkannt. Unterschrift der antragstellenden Person bzw. der Vertretung nachholen lassen (§ 60 Abs. 2 SGB I).',
        quellDokumentId: ohne.dok.id,
      });
    }
  }

  if (!vorgang.iban?.trim()) {
    befunde.push({
      regelId: 'bankverbindung', kategorie: V, typ: 'anforderung',
      titel: 'Bankverbindung',
      belegtext: 'Es ist keine Kontoverbindung (IBAN, Kontoinhaber) für die Auszahlung erfasst (§ 60 SGB I).',
    });
  }

  // ── Wohnen ───────────────────────────────────────────────────────────
  const mietvertraege = analysen(docs(ctx, 'mietvertrag'), 'mietvertrag');
  const vermieterBesch = docs(ctx, 'vermieterbescheinigung');
  if (istMietwohnung(vorgang)) {
    const mvDocs = docs(ctx, 'mietvertrag');
    if (mvDocs.length === 0) {
      befunde.push({
        regelId: 'mietvertrag', kategorie: V, typ: 'anforderung',
        titel: vorgang.wohnsituation === 'untermiete' ? 'Untermietvertrag' : 'Mietvertrag',
        belegtext: `Für die ${vorgang.wohnsituation === 'untermiete' ? 'Untermiet' : 'Miet'}wohnung liegt kein Mietvertrag vor (alle Seiten, unterschrieben; § 42a Abs. 1, § 35 Abs. 1 SGB XII).`,
      });
    }
    // Mietvertrag ohne erkannte Unterschrift: plausi-mietvertrag-unsigniert (plausibilitaet.ts).

    const mv = mietvertraege[0];
    if (mv && vermieterBesch.length === 0) {
      const gruende: string[] = [];
      const beginn = dayPart(mv.a.beginn);
      if (beginn && monateZwischen(beginn, ctx.stichtag) > ctx.k.MIETVERTRAG_AKTUELL_MONATE) gruende.push(`der Mietvertrag ist vom ${fmtDatum(beginn)} und damit älter als ${ctx.k.MIETVERTRAG_AKTUELL_MONATE} Monate`);
      if (typeof mv.a.pauschalmiete === 'number' || typeof mv.a.grundmiete !== 'number' || typeof mv.a.nebenkosten_kalt !== 'number') gruende.push('der Vertrag weist Grundmiete und kalte Nebenkosten nicht getrennt aus');
      if (gruende.length) {
        befunde.push({
          regelId: 'mietbescheinigung-aktuell', kategorie: V, typ: 'anforderung',
          titel: 'Aktuelle Mietbescheinigung',
          belegtext: `Aktuelle Miethöhe, aufgeteilt in Grundmiete, kalte Nebenkosten und Heizkosten, fehlt: ${gruende.join('; ')} (§ 35 Abs. 1 SGB XII).`,
          quellDokumentId: mv.dok.id,
        });
      }
    }

    // Keine Betriebskostenabrechnung bei Pauschalmiete oder Mietbeginn innerhalb der letzten 12 Monate.
    const pauschal = mietvertraege.some(({ a }) => typeof a.pauschalmiete === 'number');
    const neu = mietvertraege.some(({ a }) => dayPart(a.beginn) && monateZwischen(dayPart(a.beginn)!, ctx.stichtag) < 12);
    if (vorgang.wohnsituation === 'miete' && !pauschal && !neu && docs(ctx, 'nebenkostenabrechnung').length === 0) {
      befunde.push({
        regelId: 'nebenkostenabrechnung', kategorie: V, typ: 'anforderung',
        titel: 'Letzte Betriebskostenabrechnung',
        belegtext: 'Die letzte Betriebs-/Nebenkostenabrechnung des Vermieters liegt nicht vor (§ 35 Abs. 1 SGB XII).',
      });
    }

    const egIds = new Set(ctx.eg.map((p) => p.id));
    const kontoauszuege = docs(ctx, 'kontoauszug').filter((d) => !d.personId || egIds.has(d.personId));
    if (kontoauszuege.length === 0) {
      befunde.push({
        regelId: 'mietzahlungsnachweis', kategorie: V, typ: 'anforderung',
        titel: 'Nachweis der Mietzahlung',
        belegtext: 'Ein Nachweis über die tatsächliche Mietzahlung (Kontoauszug mit Mietabbuchung) fehlt (§ 35 Abs. 1 SGB XII: tatsächliche Aufwendungen).',
      });
    }
  }

  if (istEigeneWohnung(vorgang)) {
    const heizungPauschal = vorgang.wohnung?.heizung_in_miete_enthalten === true
      || mietvertraege.some(({ a }) => a.heizkosten_enthalten === true || typeof a.pauschalmiete === 'number');
    const belegt = docs(ctx, 'energieabrechnung').length > 0
      || docs(ctx, 'nebenkostenabrechnung').some((d) => analyseVon(d, 'nebenkostenabrechnung')?.heizkosten_enthalten !== false)
      || analysen(vermieterBesch, 'vermieterbescheinigung').some(({ a }) => typeof a.heizkosten === 'number');
    // Pauschalmiete: fehlende Aufteilung meldet plausi-heizung-in-miete-unklar.
    if (!belegt && !heizungPauschal) {
      befunde.push({
        regelId: 'heizkosten-nachweis', kategorie: V, typ: 'anforderung',
        titel: 'Nachweis der Heizkosten',
        belegtext: 'Es fehlt ein Nachweis der Heizkosten (Abschlagsplan und letzte Jahresabrechnung des Versorgers oder Heizkostenanteil in der Nebenkostenabrechnung, mit Energieart; § 35 Abs. 1, § 42a Abs. 1 SGB XII).',
      });
    }
  }

  if (vorgang.wohnsituation === 'eigentum' && docs(ctx, 'eigentum_nachweis').length === 0) {
    befunde.push({
      regelId: 'eigentum-kostenaufstellung', kategorie: V, typ: 'anforderung',
      titel: 'Kosten des Wohneigentums',
      belegtext: 'Für das selbst genutzte Wohneigentum fehlt die Aufstellung der Kosten und Belastungen mit Belegen (Schuldzinsen, Grundsteuer, Gebäudeversicherung, Nebenkosten; § 35 Abs. 1 SGB XII).',
    });
  }

  // ── Wohngeld ─────────────────────────────────────────────────────────
  const wohngeldAngegeben = ctx.eg.some((p) => hatEinkommensart(p, EINKOMMENS_ARTEN.wohngeld));
  const wohngeldAufKonto = analysen(docs(ctx, 'kontoauszug'), 'kontoauszug').find(({ a }) => (a.eingaenge ?? []).some((e) => e.art === 'wohngeld'));
  if ((wohngeldAngegeben || wohngeldAufKonto) && docs(ctx, 'wohngeldbescheid').length === 0) {
    befunde.push({
      regelId: 'wohngeldbescheid', kategorie: V, typ: 'anforderung',
      titel: 'Wohngeldbescheid',
      belegtext: wohngeldAngegeben
        ? 'Im Antrag ist Wohngeld angegeben, der Wohngeld- bzw. Lastenzuschussbescheid liegt nicht vor (§ 82 Abs. 1 SGB XII).'
        : 'Auf dem Kontoauszug sind Wohngeldzahlungen erkennbar; der Wohngeldbescheid liegt nicht vor (§ 82 Abs. 1 SGB XII).',
      quellDokumentId: wohngeldAngegeben ? undefined : wohngeldAufKonto?.dok.id,
    });
  }

  // ── Personen der Einsatzgemeinschaft ─────────────────────────────────
  const egHatEinkommen = ctx.eg.some((p) => (p.einkommen ?? []).length > 0);
  const antragLebensunterhalt = analysen(antraege, 'grundsicherungsantrag').some(({ a }) => !!a.bisheriger_lebensunterhalt?.trim());

  for (const p of ctx.eg) {
    const label = personLabel(p);
    const person = { personId: p.id };

    if (docsFuer(ctx, 'personalausweis', p.id).length === 0) {
      befunde.push({
        regelId: 'identitaet-jede-person', ...person, kategorie: V, typ: 'anforderung',
        titel: 'Identitätsnachweis',
        belegtext: `Identitätsnachweis (Personalausweis oder Reisepass mit Geburtsdatum) für ${label} fehlt (§ 41 Abs. 1, 2 SGB XII; § 60 SGB I).`,
      });
    }

    if (p.betreuung === 'betreuung' && docsFuerOderOhne(ctx, 'betreuerausweis', p.id).length === 0) {
      befunde.push({
        regelId: 'betreuung-bestellungsurkunde', ...person, kategorie: V, typ: 'anforderung',
        titel: 'Betreuerausweis / Bestellungsurkunde',
        belegtext: `Für ${label} ist eine gesetzliche Betreuung angegeben; Betreuerausweis bzw. Bestellungsurkunde mit Aufgabenkreisen fehlt (§ 60 SGB I).`,
      });
    }
    if (p.betreuung === 'vollmacht' && docsFuerOderOhne(ctx, 'betreuerausweis', p.id).length === 0) {
      befunde.push({
        regelId: 'vollmacht-bevollmaechtigte', ...person, kategorie: V, typ: 'anforderung',
        titel: 'Vollmacht',
        belegtext: `${label} wird durch eine bevollmächtigte Person vertreten; die Vollmacht liegt nicht vor (§ 60 SGB I).`,
      });
    }

    if (p.rolle === 'antragsteller' && vorgang.anspruchsgrund === 'alter' && !geburtsdatumBelegt(ctx, p)) {
      befunde.push({
        regelId: 'anspruchsgrund-alter-nachweis', ...person, kategorie: V, typ: 'anforderung',
        titel: 'Geburtsdatum für Anspruchsgrund Alter',
        belegtext: `Anspruchsgrund ist Alter, aber für ${label} ist weder im Antrag noch auf einem Nachweis ein Geburtsdatum erfasst — die Altersgrenze (§ 41 Abs. 2 SGB XII) ist nicht prüfbar.`,
      });
    }

    // ── Erwerbsminderung ──
    if (emIstAnspruchsgrund(ctx, p)) {
      const emRenteAngegeben = hatEinkommensart(p, ['em_rente']);
      if (emRenteAngegeben && docsFuer(ctx, 'rentenbescheid', p.id).length === 0) {
        befunde.push({
          regelId: 'em-rentenbescheid-unbefristet', ...person, kategorie: V, typ: 'anforderung',
          titel: 'Rentenbescheid Erwerbsminderung',
          belegtext: `${label} bezieht laut Antrag eine Erwerbsminderungsrente; der Rentenbescheid mit Rentenart, Befristung und Angabe zur Arbeitsmarktlage fehlt (§ 41 Abs. 3, § 45 Satz 3 Nr. 1 SGB XII).`,
        });
      }
      const em = emBefund(ctx, p);
      // Bescheid über angegebene EM-Rente steht noch aus → erst den Bescheid abwarten.
      const bescheidAbwarten = emRenteAngegeben && docsFuer(ctx, 'rentenbescheid', p.id).length === 0
        && !em.befristet && !em.teilweiseOderArbeitsmarkt;
      if (!em.dauerhaftBelegt && !em.feststellung && !bescheidAbwarten) {
        const grund = em.befristet
          ? `die EM-Rente ist befristet${em.befristet.bis ? ` bis ${fmtDatum(em.befristet.bis)}` : ''} (${em.befristet.quelle})`
          : em.teilweiseOderArbeitsmarkt
            ? `die EM-Rente beruht auf ${em.teilweiseOderArbeitsmarkt.grund === 'teilweise' ? 'teilweiser Erwerbsminderung' : 'der Arbeitsmarktlage'} (${em.teilweiseOderArbeitsmarkt.quelle})`
            : 'eine unbefristete Rente wegen voller Erwerbsminderung ist nicht belegt';
        befunde.push({
          regelId: 'em-feststellung-rv', ...person, kategorie: V, typ: 'anforderung',
          titel: 'Feststellung der dauerhaften vollen Erwerbsminderung',
          belegtext: `Für ${label} fehlt die Feststellung des Rentenversicherungsträgers zur dauerhaften vollen Erwerbsminderung: ${grund}. Ersuchen nach § 45 SGB XII prüfen.`,
          quellDokumentId: em.befristet?.dokId ?? em.teilweiseOderArbeitsmarkt?.dokId,
        });
      }
    }

    // ── Versicherung ──
    if (p.krankenversicherung?.art !== 'keine' && docsFuer(ctx, 'kv_pv_nachweis', p.id).length === 0) {
      befunde.push({
        regelId: 'kv-pv-nachweis', ...person, kategorie: V, typ: 'anforderung',
        titel: 'Nachweis Kranken-/Pflegeversicherung',
        belegtext: `Mitgliedsbescheinigung der Kranken- und Pflegekasse mit Versicherungsart für ${label} fehlt (§ 32 SGB XII).`,
      });
    }

    // ── Einkommen ──
    if (beziehtGesetzlicheRente(p)) {
      // Bei EM als Anspruchsgrund fordert em-rentenbescheid-unbefristet denselben Bescheid an.
      const emDeckt = emIstAnspruchsgrund(ctx, p) && hatEinkommensart(p, ['em_rente']);
      if (docsFuer(ctx, 'rentenbescheid', p.id).length === 0) {
        if (!emDeckt) befunde.push({
          regelId: 'rentenbescheid', ...person, kategorie: V, typ: 'anforderung',
          titel: 'Rentenbescheid',
          belegtext: `Für ${label} ist eine gesetzliche Rente angegeben; der aktuelle Rentenbescheid (Rentenart, Zahlbetrag, KV/PV-Beitrag, Befristung) fehlt (§ 82 Abs. 1 SGB XII).`,
        });
      } else if (bwzUmfasstAnpassung(ctx) && !renteAktuellBelegt(ctx, p)) {
        const alt = alterRentenbescheid(ctx, p);
        if (alt) {
          befunde.push({
            regelId: 'rentenanpassungsmitteilung', ...person, kategorie: V, typ: 'anforderung',
            titel: `Rentenanpassungsmitteilung zum ${fmtDatum(ctx.k.RENTENANPASSUNG_STICHTAG)}`,
            belegtext: `Für ${label} liegt nur der Rentenbescheid vom ${fmtDatum(alt.a.bescheiddatum)} vor. Der Bewilligungszeitraum reicht über den ${fmtDatum(ctx.k.RENTENANPASSUNG_STICHTAG)} hinaus; die Rentenanpassungsmitteilung fehlt (§ 82 Abs. 1, 7 SGB XII).`,
            quellDokumentId: alt.dok.id,
          });
        }
      }
    }

    const betriebsrenteAngegeben = hatEinkommensart(p, EINKOMMENS_ARTEN.betriebsrente);
    const betriebsrenteAufKonto = analysen(docsFuer(ctx, 'kontoauszug', p.id), 'kontoauszug')
      .map(({ dok, a }) => ({ dok, e: (a.eingaenge ?? []).find((e) => e.art === 'betriebsrente') }))
      .find((x) => !!x.e);
    if ((betriebsrenteAngegeben || betriebsrenteAufKonto) && docsFuer(ctx, 'betriebsrente_mitteilung', p.id).length === 0) {
      befunde.push({
        regelId: 'betriebsrente-nachweis', ...person, kategorie: V, typ: 'anforderung',
        titel: 'Nachweis Betriebsrente / Zusatzversorgung',
        belegtext: betriebsrenteAngegeben
          ? `Für ${label} ist eine Betriebs-/Zusatzrente angegeben; die Leistungsmitteilung des Trägers fehlt (§ 82 Abs. 1, 4 SGB XII).`
          : `Auf dem Kontoauszug von ${label} sind Zahlungen einer Betriebs-/Zusatzversorgung erkennbar${betriebsrenteAufKonto?.e?.verwendungszweck ? ` („${betriebsrenteAufKonto.e.verwendungszweck}")` : ''}; die Leistungsmitteilung des Trägers fehlt (§ 82 Abs. 1, 4 SGB XII).`,
        quellDokumentId: betriebsrenteAngegeben ? undefined : betriebsrenteAufKonto?.dok.id,
      });
    }

    if (!egHatEinkommen && !vorgang.vorbezug?.leistung && !antragLebensunterhalt) {
      befunde.push({
        regelId: 'kein-einkommen-erklaerung', ...person, kategorie: V, typ: 'anforderung',
        titel: 'Erklärung zum bisherigen Lebensunterhalt',
        belegtext: `Für ${label} ist weder Einkommen noch ein früherer Leistungsbezug angegeben. Erklärung anfordern, wovon der Lebensunterhalt bisher bestritten wurde (§ 60 Abs. 1 SGB I).`,
      });
    }

    // ── Mehrbedarfe ──
    const merkG = (p.schwerbehinderung?.merkzeichen ?? []).some((m) => /^a?g$/i.test(m.trim()));
    if (merkG && (altersgrenzeErreicht(ctx, p) !== false || p.erwerbsminderung?.voll === true)) {
      const ausweise = analysen(docsFuer(ctx, 'schwerbehindertenausweis', p.id), 'schwerbehindertenausweis');
      const ausweisDocs = docsFuer(ctx, 'schwerbehindertenausweis', p.id);
      const ohneG = ausweise.length > 0 && ausweise.every(({ a }) => Array.isArray(a.merkzeichen) && !a.merkzeichen.some((m) => /^a?g$/i.test(m.trim())));
      if (ausweisDocs.length === 0 || ohneG) {
        befunde.push({
          regelId: 'schwerbehindertenausweis-g', ...person, kategorie: V, typ: 'anforderung',
          titel: 'Schwerbehindertenausweis mit Merkzeichen G',
          belegtext: ohneG
            ? `Für ${label} ist Merkzeichen G angegeben, der vorliegende Schwerbehindertenausweis weist es nicht aus. Ausweis (Vorder- und Rückseite) oder Feststellungsbescheid mit Merkzeichen G anfordern (§ 30 Abs. 1 SGB XII).`
            : `Für ${label} ist Merkzeichen G angegeben; Schwerbehindertenausweis (Vorder- und Rückseite) oder Feststellungsbescheid fehlt (§ 30 Abs. 1 SGB XII).`,
          quellDokumentId: ohneG ? ausweise[0]!.dok.id : undefined,
        });
      }
    }

    if (p.mehrbedarf_ernaehrung === true) {
      const passend = docsFuer(ctx, 'aerztliche_bescheinigung', p.id)
        .filter((d) => analyseVon(d, 'aerztliche_bescheinigung')?.zweck !== 'em_befund');
      if (passend.length === 0) {
        befunde.push({
          regelId: 'ernaehrung-aerztliche-bescheinigung', ...person, kategorie: V, typ: 'anforderung',
          titel: 'Ärztliche Bescheinigung kostenaufwändige Ernährung',
          belegtext: `Für ${label} ist Mehrbedarf für kostenaufwändige Ernährung beantragt; die ärztliche Bescheinigung über Erkrankung und notwendige Kostform fehlt (§ 30 Abs. 5 SGB XII).`,
        });
      }
    }

    // ── Vermögen ──
    if (p.vermoegen === undefined) {
      befunde.push({
        regelId: 'vermoegenserklaerung', ...person, kategorie: V, typ: 'anforderung',
        titel: 'Vermögensangaben',
        belegtext: `Für ${label} sind keine Vermögensangaben erfasst (Bargeld, Konten, Wertpapiere, Versicherungen, Kfz, Immobilien, Forderungen — im In- und Ausland; § 90 Abs. 1 SGB XII).`,
      });
    }

    pruefeKontoauszuege(ctx, p, befunde);

    const lv = (p.vermoegen ?? []).filter((v) => (VERMOEGENS_ARTEN.lebensversicherung as readonly string[]).includes(v.art));
    if (lv.length > 0) {
      const belegt = analysen(docsFuer(ctx, 'vermoegensnachweis', p.id), 'vermoegensnachweis')
        .some(({ a }) => a.art === 'lebensversicherung' && typeof a.rueckkaufswert === 'number');
      if (!belegt) {
        befunde.push({
          regelId: 'lebensversicherung-rueckkaufswert', ...person, kategorie: V, typ: 'anforderung',
          titel: 'Rückkaufswert Lebensversicherung',
          belegtext: `Für ${label} ist eine Lebens-/Kapitalversicherung angegeben; eine aktuelle Bescheinigung des Rückkaufswerts fehlt (§ 90 Abs. 1, 3 SGB XII).`,
        });
      }
    }

    const bv = (p.vermoegen ?? []).some((v) => (VERMOEGENS_ARTEN.bestattungsvorsorge as readonly string[]).includes(v.art));
    if (bv && docsFuer(ctx, 'bestattungsvorsorge', p.id).length === 0) {
      befunde.push({
        regelId: 'bestattungsvorsorge-vertrag', ...person, kategorie: V, typ: 'anforderung',
        titel: 'Bestattungsvorsorgevertrag',
        belegtext: `Für ${label} ist eine Bestattungsvorsorge angegeben; Vertrag bzw. Sterbegeldversicherung mit Leistungsverzeichnis und Betrag fehlt (§ 90 Abs. 3 SGB XII).`,
      });
    }

    // ── Unterhalt ──
    if (p.unterhalt_kinder_eltern?.angegeben !== true) {
      befunde.push({
        regelId: 'angaben-kinder-eltern', ...person, kategorie: V, typ: 'anforderung',
        titel: 'Angaben zu Kindern und Eltern',
        belegtext: `Für ${label} fehlen die Angaben zu Kindern und Eltern (Namen, Berufe) und die Einschätzung, ob eine dieser Personen jährlich mehr als 100.000 € Gesamteinkommen hat (§ 94 Abs. 1a SGB XII).`,
      });
    }
  }

  return befunde;
}

/** Kontoauszüge je Person: vorhanden und über den kommunal festgelegten Zeitraum? */
function pruefeKontoauszuege(ctx: PruefKontext, p: Person, befunde: PruefBefund[]): void {
  const hatKonto = p.rolle === 'antragsteller'
    || (p.vermoegen ?? []).some((v) => (VERMOEGENS_ARTEN.konto as readonly string[]).includes(v.art));
  if (!hatKonto) return;
  const label = personLabel(p);
  const monate = ctx.k.KONTOAUSZUG_MONATE;
  const auszuege = docsFuer(ctx, 'kontoauszug', p.id);
  if (auszuege.length === 0) {
    befunde.push({
      regelId: 'kontoauszuege', personId: p.id, kategorie: V, typ: 'anforderung',
      titel: 'Kontoauszüge',
      belegtext: `Für ${label} liegen keine Kontoauszüge vor. Lückenlose Auszüge aller Konten der letzten ${monate} Monate anfordern (§ 60 Abs. 1 SGB I; § 90 Abs. 1 SGB XII).`,
    });
    return;
  }
  // Abdeckung: Vereinigung der Zeiträume, soweit erkannt. Ohne erkannte Zeiträume keine Aussage.
  const zeitraeume = analysen(auszuege, 'kontoauszug')
    .map(({ a }) => ({ von: dayPart(a.zeitraum_von), bis: dayPart(a.zeitraum_bis) }))
    .filter((z): z is { von: string; bis: string } => !!z.von && !!z.bis && z.von <= z.bis)
    .sort((x, y) => x.von.localeCompare(y.von));
  if (zeitraeume.length === 0 || zeitraeume.length < auszuege.length) return;
  let tage = 0;
  let cur: { von: string; bis: string } | null = null;
  for (const z of zeitraeume) {
    if (cur && z.von <= cur.bis) { if (z.bis > cur.bis) cur.bis = z.bis; continue; }
    if (cur) tage += tageInklusive(cur.von, cur.bis);
    cur = { ...z };
  }
  if (cur) tage += tageInklusive(cur.von, cur.bis);
  const benoetigt = Math.round(monate * 30.44) - 3;
  if (tage < benoetigt) {
    const erster = zeitraeume[0]!.von;
    const letzter = zeitraeume.reduce((m, z) => (z.bis > m ? z.bis : m), zeitraeume[0]!.bis);
    befunde.push({
      regelId: 'kontoauszuege', personId: p.id, kategorie: V, typ: 'anforderung',
      titel: 'Kontoauszüge unvollständig',
      belegtext: `Die Kontoauszüge von ${label} decken nur rund ${Math.max(1, Math.round(tage / 30.44))} Monat(e) ab (${fmtDatum(erster)} – ${fmtDatum(letzter)}, ggf. mit Lücken). Gefordert sind lückenlose Auszüge der letzten ${monate} Monate (§ 60 Abs. 1 SGB I).`,
      quellDokumentId: auszuege[0]!.id,
    });
  }
}
