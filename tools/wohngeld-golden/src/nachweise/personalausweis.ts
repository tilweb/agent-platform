/**
 * Kopie eines Personalausweises (Vorder- und Rückseite auf einer A4-Seite, wie
 * vom Kopierer). Bewusst vereinfachtes Kartenlayout ohne echte Sicherheitsmerkmale.
 */
import { datum, esc, htmlDoc, htmlZuPdf } from '../lib';
import type { ErzeugtesDokument, Fall, Person } from '../types';

const CSS = `
  .karte { width: 111mm; height: 70mm; border-radius: 4mm; border: 0.3mm solid #777; position: relative; overflow: hidden;
           background: linear-gradient(135deg, #e9eef0 0%, #d7e2e0 45%, #e8e1ea 100%); font-size: 7.5pt; color: #222; }
  .karte .band { position: absolute; top: 0; left: 0; right: 0; height: 8mm; background: rgba(0,0,0,0.06); font-weight: bold; font-size: 8pt; padding: 2mm 4mm; letter-spacing: 0.3mm; }
  .karte .lbl { font-size: 5.5pt; color: #555; text-transform: none; }
  .karte .val { font-size: 9pt; font-weight: bold; margin-bottom: 1.2mm; font-family: 'Courier New', monospace; }
  .foto { position: absolute; left: 4mm; top: 12mm; width: 28mm; height: 36mm; background: #cfd6d8; border-radius: 1mm; }
  .felder { position: absolute; left: 36mm; top: 11mm; right: 4mm; }
  .mrz { position: absolute; left: 4mm; right: 4mm; bottom: 3mm; font-family: 'Courier New', monospace; font-size: 8.4pt; letter-spacing: 0.35mm; line-height: 1.25; }
`;

function mrzName(s: string) { return s.toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS').replace(/[^A-Z]/g, '<'); }
function mrzDatum(iso: string) { return iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10); }

export async function erzeugePersonalausweis(fall: Fall, person: Person): Promise<ErzeugtesDokument> {
  const a = person.ausweis;
  if (!a) throw new Error(`Person ${person.id} hat keine Ausweisdaten`);
  const w = fall.wohnung;
  const silhouette = `<svg viewBox="0 0 28 36" style="position:absolute;inset:0;width:100%;height:100%"><circle cx="14" cy="13" r="6.5" fill="#9aa5a8"/><path d="M2 36 C3 25 9 22 14 22 C19 22 25 25 26 36 Z" fill="#9aa5a8"/></svg>`;
  const vorder = `
    <div class="karte">
      <div class="band">BUNDESREPUBLIK DEUTSCHLAND &nbsp;·&nbsp; PERSONALAUSWEIS</div>
      <div class="foto">${silhouette}</div>
      <div class="felder">
        <div class="lbl">Name / Surname</div><div class="val">${esc(person.nachname.toUpperCase())}</div>
        ${person.geburtsname ? `<div class="lbl">Geburtsname / Name at birth</div><div class="val">${esc(person.geburtsname.toUpperCase())}</div>` : ''}
        <div class="lbl">Vornamen / Given names</div><div class="val">${esc(person.vorname.toUpperCase())}</div>
        <div style="display:flex;gap:6mm"><div><div class="lbl">Geburtstag</div><div class="val">${datum(person.geburtsdatum)}</div></div>
        <div><div class="lbl">Staatsangehörigkeit</div><div class="val">${esc(person.staatsangehoerigkeit.toUpperCase())}</div></div></div>
        <div style="display:flex;gap:6mm"><div><div class="lbl">Geburtsort</div><div class="val">${esc(person.geburtsort.toUpperCase())}</div></div>
        <div><div class="lbl">Gültig bis</div><div class="val">${datum(a.gueltigBis)}</div></div></div>
      </div>
      <div style="position:absolute;right:4mm;top:10mm;font-family:'Courier New',monospace;font-size:10pt;font-weight:bold">${esc(a.nummer)}</div>
    </div>`;
  const rueck = `
    <div class="karte">
      <div class="felder" style="left:4mm;top:6mm">
        <div class="lbl">Anschrift / Address</div>
        <div class="val">${esc(w.plz)} ${esc(w.ort.toUpperCase())}<br>${esc(w.strasse.toUpperCase())} ${esc(w.hausnummer)}</div>
        <div style="display:flex;gap:8mm"><div><div class="lbl">Größe / Height</div><div class="val">${a.groesseCm} cm</div></div>
        <div><div class="lbl">Augenfarbe / Colour of eyes</div><div class="val">${esc(a.augenfarbe.toUpperCase())}</div></div></div>
        <div class="lbl">Behörde / Authority</div><div class="val">${esc(a.behoerde.toUpperCase())}</div>
        <div class="lbl">Datum / Date</div><div class="val">${datum(a.ausgestellt)}</div>
      </div>
      <div class="mrz">IDD&lt;&lt;${esc(a.nummer)}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;<br>${mrzDatum(person.geburtsdatum)}0&lt;${mrzDatum(a.gueltigBis)}4D&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;<br>${esc(mrzName(person.nachname))}&lt;&lt;${esc(mrzName(person.vorname))}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>
    </div>`;
  const html = htmlDoc(`<div class="seite" style="padding-top:30mm"><div style="display:flex;flex-direction:column;gap:22mm;align-items:center">${vorder}${rueck}</div></div>`, CSS);
  return {
    art: 'personalausweis', typ: 'personalausweis', titel: `Personalausweis ${person.vorname} ${person.nachname}`, person: person.id,
    pdf: await htmlZuPdf(html),
    erwartet: { identitaet: { nachname: person.nachname, vorname: person.vorname, geburtsdatum: person.geburtsdatum } },
  };
}
