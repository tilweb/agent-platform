/**
 * Kleinere Unterlagen: Mieterhöhungsschreiben (F18), Stromjahresabrechnung als
 * fremdes Dokument (F30), Hinweisblatt als Beilage, Leerseite (leere Rückseite).
 */
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { VORLAGEN, datum, esc, eur, htmlDoc, htmlZuPdf, rng, ganz, unterschriftSvg } from '../lib';
import type { ErzeugtesDokument, Fall } from '../types';
import { BRIEF_CSS, brief } from './brief';

export async function erzeugeMieterhoehung(fall: Fall): Promise<ErzeugtesDokument> {
  const m = fall.mieterhoehung;
  if (!m) throw new Error(`${fall.id}: keine Mieterhöhung definiert`);
  const w = fall.wohnung;
  const v = fall.vermieter;
  const mieter = fall.personen.filter((p) => p.id === 'P1' || /(ehe|partner)/i.test(p.verhaeltnis ?? ''));
  const neuGesamt = w.grundmiete + w.nebenkosten + w.heizkosten + w.warmwasser;
  const altGesamt = m.alteGrundmiete + w.nebenkosten + w.heizkosten + w.warmwasser;
  const qmAlt = m.alteGrundmiete / w.flaeche;
  const qmNeu = w.grundmiete / w.flaeche;
  const html = htmlDoc(brief({
    kopf: `<div style="font-weight:bold;font-size:13pt">${esc(v.name)}</div><div class="klein r">${esc(v.strasse)} · ${esc(v.plzOrt)}<br>Tel. ${esc(v.telefon ?? '')}</div>`,
    ruecksendezeile: `${v.name}, ${v.strasse}, ${v.plzOrt}`,
    empfaenger: [...mieter.map((p) => `${p.vorname} ${p.nachname}`), `${w.strasse} ${w.hausnummer}`, `${w.plz} ${w.ort}`],
    info: [['Mietobjekt', `${w.strasse} ${w.hausnummer}, ${w.lage}`], ['Datum', datum(m.schreibenVom)]],
    betreff: 'Mieterhöhungsverlangen gemäß § 558 BGB — Zustimmung zur Erhöhung der Nettokaltmiete',
    fuss: `<span>${esc(v.name)}</span><span>${esc(v.bank)} · IBAN ${esc(v.iban)}</span>`,
    inhalt: `
      <p>Sehr geehrte Damen und Herren,</p>
      <p>die Nettokaltmiete für die von Ihnen gemietete Wohnung beträgt derzeit ${eur(m.alteGrundmiete)} EUR
      (${eur(qmAlt)} EUR/m²). Sie ist seit mehr als 15 Monaten unverändert. Wir bitten Sie, einer Erhöhung der
      Nettokaltmiete auf <b>${eur(w.grundmiete)} EUR</b> (${eur(qmNeu)} EUR/m²) mit Wirkung ab dem <b>${datum(m.ab)}</b> zuzustimmen.</p>
      <p>Zur Begründung verweisen wir auf den qualifizierten Mietspiegel der Stadt ${esc(w.ort)} 2026. Die neue Miete liegt
      innerhalb der ortsüblichen Vergleichsmiete; die Kappungsgrenze von 15 % wird eingehalten.</p>
      <table class="tab" style="width:125mm;margin:3mm 0 4mm">
        <tr><th></th><th class="r">bisher (EUR)</th><th class="r">ab ${datum(m.ab)} (EUR)</th></tr>
        <tr><td>Nettokaltmiete</td><td class="r">${eur(m.alteGrundmiete)}</td><td class="r">${eur(w.grundmiete)}</td></tr>
        <tr><td>Betriebskostenvorauszahlung</td><td class="r">${eur(w.nebenkosten)}</td><td class="r">${eur(w.nebenkosten)}</td></tr>
        <tr><td>Heizkosten/Warmwasser</td><td class="r">${eur(w.heizkosten + w.warmwasser)}</td><td class="r">${eur(w.heizkosten + w.warmwasser)}</td></tr>
        <tr class="summe"><td>Gesamtmiete</td><td class="r">${eur(altGesamt)}</td><td class="r">${eur(neuGesamt)}</td></tr>
      </table>
      <p>Bitte senden Sie uns die beiliegende Zustimmungserklärung bis zum Ende des zweiten Kalendermonats nach Zugang dieses
      Schreibens unterschrieben zurück und passen Sie Ihren Dauerauftrag entsprechend an.</p>
      <p>Mit freundlichen Grüßen</p>
      <div style="height:14mm">${unterschriftSvg(v.vertreter ?? v.name, 40)}</div>
      <p>${esc(v.vertreter ?? v.name)}</p>`,
  }), BRIEF_CSS);
  return {
    art: 'mieterhoehung', typ: 'mietvertrag', titel: 'Mieterhöhungsverlangen',
    pdf: await htmlZuPdf(html),
    erwartet: {
      analyse: { miete: Math.round((neuGesamt - w.heizkosten - w.warmwasser) * 100) / 100, unterschrift_vorhanden: true },
      identitaet: { nachname: fall.personen[0]!.nachname },
    },
  };
}

export async function erzeugeStromrechnung(fall: Fall): Promise<ErzeugtesDokument> {
  const r = rng(`${fall.id}:strom`);
  const w = fall.wohnung;
  const p1 = fall.personen[0]!;
  const kwh = ganz(r, 1650, 2900);
  const arbeitspreis = 0.3189;
  const grund = 13.9 * 12;
  const summe = kwh * arbeitspreis + grund;
  const abschlaege = 11 * Math.round(summe / 11.5);
  const html = htmlDoc(brief({
    farbe: '#0a7d3b',
    kopf: `<div style="font-weight:bold;font-size:14pt;color:#0a7d3b">Stadtwerke ${esc(w.ort)}</div><div class="klein r">Kundenservice 0800 7788 100<br>www.stadtwerke-beispiel.de</div>`,
    ruecksendezeile: `Stadtwerke ${w.ort} GmbH, Postfach 1180`,
    empfaenger: [`${p1.vorname} ${p1.nachname}`, `${w.strasse} ${w.hausnummer}`, `${w.plz} ${w.ort}`],
    info: [['Kundennummer', String(ganz(r, 40000000, 49999999))], ['Vertragskonto', String(ganz(r, 200000, 899999))], ['Rechnungsdatum', datum('2026-02-09')]],
    betreff: 'Ihre Jahresverbrauchsabrechnung Strom 2025',
    fuss: `<span>Stadtwerke ${esc(w.ort)} GmbH · Amtsgericht Registergericht HRB 1180</span><span>Seite 1 von 1</span>`,
    inhalt: `
      <p>Sehr geehrte Kundin, sehr geehrter Kunde,</p>
      <p>vielen Dank für Ihr Vertrauen. Hier ist Ihre Abrechnung für den Zeitraum 01.01.2025 bis 31.12.2025.</p>
      <table class="tab" style="margin:3mm 0 4mm">
        <tr><th>Position</th><th class="r">Menge</th><th class="r">Preis</th><th class="r">Betrag EUR</th></tr>
        <tr><td>Arbeitspreis Strom</td><td class="r">${kwh} kWh</td><td class="r">${eur(arbeitspreis * 100)} ct/kWh</td><td class="r">${eur(kwh * arbeitspreis)}</td></tr>
        <tr><td>Grundpreis</td><td class="r">12 Monate</td><td class="r">13,90 EUR/Monat</td><td class="r">${eur(grund)}</td></tr>
        <tr class="summe"><td colspan="3">Rechnungsbetrag brutto (inkl. 19 % USt.)</td><td class="r">${eur(summe)}</td></tr>
        <tr><td colspan="3">abzüglich geleistete Abschläge</td><td class="r">– ${eur(abschlaege)}</td></tr>
        <tr class="summe"><td colspan="3">${summe - abschlaege > 0 ? 'Nachzahlung' : 'Guthaben'}</td><td class="r">${eur(Math.abs(summe - abschlaege))}</td></tr>
      </table>
      <p>Ihr neuer monatlicher Abschlag beträgt ab März 2026 ${eur(Math.round(summe / 11))} EUR.</p>
      <p>Mit freundlichen Grüßen<br>Ihre Stadtwerke ${esc(w.ort)}</p>`,
  }), BRIEF_CSS);
  return { art: 'stromrechnung', typ: 'sonstiges', titel: 'Stromjahresabrechnung (fremdes Dokument)', pdf: await htmlZuPdf(html) };
}

export async function erzeugeHinweisblatt(): Promise<ErzeugtesDokument> {
  const pdf = new Uint8Array(await Bun.file(join(VORLAGEN, 'hinweisblatt-zum-wohngeldantrag.pdf')).arrayBuffer());
  return { art: 'hinweisblatt', typ: 'sonstiges', titel: 'Hinweisblatt zum Wohngeldantrag (Beilage)', pdf };
}

export async function erzeugeLeerseite(): Promise<ErzeugtesDokument> {
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]);
  return { art: 'leerseite', typ: 'sonstiges', titel: 'Leerseite (leere Rückseite)', pdf: await doc.save(), leerseite: true };
}
