/**
 * Wohnraum-Mietvertrag (4 Seiten, §-Gliederung, Unterschriftenblock). Nennt die
 * Miete zum Vertragsbeginn — bei späterer Mieterhöhung also die ALTE Grundmiete.
 */
import { datum, esc, eur, htmlDoc, htmlZuPdf, unterschriftSvg } from '../lib';
import type { ErzeugtesDokument, Fall } from '../types';

const CSS = `
  .mv { font-family: 'Times New Roman', Times, serif; font-size: 10.5pt; line-height: 1.45; }
  .mv h1 { text-align: center; font-size: 17pt; margin: 0 0 1mm; letter-spacing: 0.5mm; }
  .mv h2 { font-size: 11pt; margin: 5mm 0 1.5mm; }
  .mv p { margin: 0 0 2mm; text-align: justify; }
  .mv .fuss { position: absolute; bottom: 10mm; left: 22mm; right: 20mm; font-size: 8pt; color: #555; display: flex; justify-content: space-between; border-top: 0.2mm solid #999; padding-top: 1.5mm; }
  .mv table.kosten td { padding: 0.8mm 0; } .mv table.kosten td:last-child { text-align: right; width: 35mm; }
  .sig { display: flex; justify-content: space-between; margin-top: 12mm; }
  .sig > div { width: 72mm; }
  .sig .linie { border-top: 0.3mm solid #222; padding-top: 1mm; font-size: 9pt; height: 0; }
  .sig .feld { height: 18mm; display: flex; align-items: flex-end; }
`;

export async function erzeugeMietvertrag(fall: Fall): Promise<ErzeugtesDokument> {
  const w = fall.wohnung;
  const v = fall.vermieter;
  const grund = fall.mieterhoehung?.alteGrundmiete ?? w.grundmiete;
  const gesamt = grund + w.nebenkosten + w.heizkosten + w.warmwasser;
  const mieter = fall.personen.filter((p) => p.id === 'P1' || /(ehe|partner)/i.test(p.verhaeltnis ?? ''));
  const unterschrieben = fall.unterschrift.mietvertrag;
  const vertragsdatum = (() => { const d = new Date(`${w.mietbeginn}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 19); return d.toISOString().slice(0, 10); })();
  const ortV = v.plzOrt.replace(/^\d+\s*/, '');
  const seiten = 4;
  const fuss = (n: number) => `<div class="fuss"><span>Mietvertrag · ${esc(w.strasse)} ${esc(w.hausnummer)}, ${esc(w.plz)} ${esc(w.ort)}</span><span>Seite ${n} von ${seiten}</span></div>`;

  const s1 = `
  <div class="seite mv">
    <h1>MIETVERTRAG</h1>
    <p style="text-align:center;margin-bottom:6mm">über Wohnraum</p>
    <p>Zwischen</p>
    <p style="margin-left:10mm"><b>${esc(v.name)}</b><br>${esc(v.strasse)}, ${esc(v.plzOrt)}<br>— nachstehend „Vermieter" genannt —</p>
    <p>und</p>
    <p style="margin-left:10mm"><b>${mieter.map((p) => `${esc(p.vorname)} ${esc(p.nachname)}, geb. ${datum(p.geburtsdatum)}`).join('<br>')}</b><br>— nachstehend „Mieter" genannt —</p>
    <p>wird folgender Mietvertrag geschlossen:</p>
    <h2>§ 1 Mietsache</h2>
    <p>(1) Vermietet wird die Wohnung im Hause ${esc(w.strasse)} ${esc(w.hausnummer)}, ${esc(w.plz)} ${esc(w.ort)},
    ${esc(w.lage)}, bestehend aus ${w.zimmer} Zimmern, Küche, Bad/WC und Diele. Zur Wohnung gehört ein Kellerabteil.</p>
    <p>(2) Die Wohnfläche beträgt <b>${String(w.flaeche).replace('.', ',')} m²</b>.</p>
    <p>(3) Dem Mieter werden folgende Schlüssel ausgehändigt: 2 Haus-, 2 Wohnungs-, 1 Briefkastenschlüssel.</p>
    ${w.gefoerdert ? '<p>(4) Die Wohnung ist mit öffentlichen Mitteln gefördert. Der Mieter hat einen gültigen Wohnberechtigungsschein vorgelegt.</p>' : ''}
    <h2>§ 2 Mietzeit</h2>
    <p>Das Mietverhältnis beginnt am <b>${datum(w.mietbeginn)}</b> und läuft auf unbestimmte Zeit. Es kann nach den gesetzlichen
    Vorschriften gekündigt werden.</p>
    ${fuss(1)}
  </div>`;

  const s2 = `
  <div class="seite mv">
    <h2>§ 3 Miete und Nebenkosten</h2>
    <p>(1) Die Miete beträgt monatlich:</p>
    <table class="kosten" style="width:120mm;margin:0 0 3mm 10mm">
      <tr><td>Grundmiete (Nettokaltmiete)</td><td>${eur(grund)} EUR</td></tr>
      <tr><td>Vorauszahlung Betriebskosten (ohne Heizung)</td><td>${eur(w.nebenkosten)} EUR</td></tr>
      ${w.heizkosten ? `<tr><td>Vorauszahlung Heizkosten</td><td>${eur(w.heizkosten)} EUR</td></tr>` : ''}
      ${w.warmwasser ? `<tr><td>Vorauszahlung Warmwasser</td><td>${eur(w.warmwasser)} EUR</td></tr>` : ''}
      <tr><td style="border-top:0.3mm solid #222"><b>Gesamtmiete</b></td><td style="border-top:0.3mm solid #222"><b>${eur(gesamt)} EUR</b></td></tr>
    </table>
    <p>(2) Über die Vorauszahlungen wird jährlich abgerechnet. Umgelegt werden die Betriebskosten nach § 2 der
    Betriebskostenverordnung. Verteilungsmaßstab ist die Wohnfläche, für Heizung und Warmwasser gilt die Heizkostenverordnung.</p>
    <h2>§ 4 Zahlung der Miete</h2>
    <p>Die Miete ist monatlich im Voraus, spätestens am dritten Werktag des Monats, auf folgendes Konto des Vermieters zu zahlen:
    ${esc(v.bank)}, IBAN ${esc(v.iban.replace(/(.{4})/g, '$1 ').trim())}.</p>
    <h2>§ 5 Mietsicherheit</h2>
    <p>Der Mieter leistet eine Mietsicherheit in Höhe von ${eur(grund * 3)} EUR. Sie kann in drei gleichen monatlichen Teilzahlungen
    erbracht werden. Der Vermieter legt die Sicherheit getrennt von seinem Vermögen bei einem Kreditinstitut an.</p>
    <h2>§ 6 Schönheitsreparaturen</h2>
    <p>Die Wohnung wird in renoviertem Zustand übergeben. Der Mieter übernimmt die Schönheitsreparaturen während der Mietzeit,
    soweit sie durch seinen Gebrauch erforderlich werden.</p>
    ${fuss(2)}
  </div>`;

  const s3 = `
  <div class="seite mv">
    <h2>§ 7 Benutzung der Mietsache, Untervermietung</h2>
    <p>(1) Der Mieter darf die Mietsache nur zu Wohnzwecken nutzen. (2) Eine Untervermietung oder sonstige Gebrauchsüberlassung
    an Dritte bedarf der vorherigen schriftlichen Erlaubnis des Vermieters.</p>
    <h2>§ 8 Tierhaltung</h2>
    <p>Kleintiere dürfen ohne Erlaubnis gehalten werden. Für andere Tiere ist die Zustimmung des Vermieters erforderlich; sie darf
    nur aus wichtigem Grund verweigert werden.</p>
    <h2>§ 9 Instandhaltung, Anzeigepflicht</h2>
    <p>Der Mieter hat Schäden an der Mietsache unverzüglich anzuzeigen. Kleinreparaturen bis 100,00 EUR im Einzelfall, höchstens
    jedoch 8 % der Jahresgrundmiete, trägt der Mieter.</p>
    <h2>§ 10 Betreten der Mietsache</h2>
    <p>Der Vermieter darf die Mietsache nach rechtzeitiger Ankündigung zu üblichen Tageszeiten betreten, soweit ein berechtigter
    Anlass besteht.</p>
    <h2>§ 11 Hausordnung</h2>
    <p>Die beigefügte Hausordnung ist Bestandteil dieses Vertrags. Der Mieter verpflichtet sich zu gegenseitiger Rücksichtnahme.</p>
    <h2>§ 12 Beendigung des Mietverhältnisses</h2>
    <p>Bei Beendigung des Mietverhältnisses ist die Wohnung vollständig geräumt und besenrein mit allen Schlüsseln zurückzugeben.</p>
    ${fuss(3)}
  </div>`;

  const sigMieter = mieter.map((p) => `
      <div><div class="feld">${unterschrieben ? unterschriftSvg(`${p.vorname} ${p.nachname}`, 48) : ''}</div>
      <div class="linie">Mieter: ${esc(p.vorname)} ${esc(p.nachname)}</div></div>`).join('');
  const s4 = `
  <div class="seite mv">
    <h2>§ 13 Sonstige Vereinbarungen</h2>
    <p>Keine.</p>
    <h2>§ 14 Schlussbestimmungen</h2>
    <p>Änderungen und Ergänzungen dieses Vertrags bedürfen der Textform. Sollte eine Bestimmung unwirksam sein, bleibt die
    Wirksamkeit der übrigen Bestimmungen unberührt.</p>
    <p style="margin-top:10mm">${esc(ortV)}, den ${datum(vertragsdatum)}</p>
    <div class="sig">
      <div><div class="feld">${unterschrieben ? unterschriftSvg(v.vertreter ?? v.name, 48) : ''}</div>
      <div class="linie">Vermieter: ${esc(v.name)}</div></div>
      ${sigMieter}
    </div>
    ${fuss(4)}
  </div>`;

  return {
    art: 'mietvertrag', typ: 'mietvertrag', titel: 'Mietvertrag',
    pdf: await htmlZuPdf(htmlDoc(s1 + s2 + s3 + s4, CSS)),
    erwartet: {
      analyse: { miete: Math.round((gesamt - w.heizkosten - w.warmwasser) * 100) / 100, wohnflaeche_qm: w.flaeche, unterschrift_vorhanden: unterschrieben },
      identitaet: { nachname: fall.personen[0]!.nachname, vorname: fall.personen[0]!.vorname },
    },
  };
}
