/**
 * DIN-5008-naher Geschäftsbrief als HTML-Baustein (Briefkopf, Anschriftfeld mit
 * Rücksendezeile, Info-Block, Betreff, Text, Fußzeile). Grundlage für Bescheide,
 * Mieterhöhung, Stromrechnung.
 */
import { esc } from '../lib';

export interface BriefOpts {
  kopf: string;                // HTML des Briefkopfs (Logo-Ersatz/Name)
  ruecksendezeile: string;
  empfaenger: string[];
  info: Array<[string, string]>;
  betreff: string;
  inhalt: string;              // HTML
  fuss?: string;               // HTML der Fußzeile
  farbe?: string;              // Akzentfarbe des Absenders
  seitenzahl?: string;         // "Seite 1 von 2"
}

export const BRIEF_CSS = `
  .kopf { height: 26mm; border-bottom: 0.6mm solid var(--akzent, #333); margin: -4mm 0 0 0; display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 2mm; }
  .anschrift { position: absolute; top: 45mm; left: 22mm; width: 85mm; }
  .anschrift .rs { font-size: 6.5pt; border-bottom: 0.2mm solid #555; padding-bottom: 0.6mm; margin-bottom: 2mm; color: #333; }
  .anschrift div { line-height: 1.35; }
  .info { position: absolute; top: 45mm; left: 118mm; width: 72mm; font-size: 8.3pt; }
  .info td { padding: 0.4mm 0; }
  .info td:first-child { color: #555; width: 33mm; padding-right: 2mm; }
  .betreff { position: absolute; top: 98mm; left: 22mm; right: 20mm; font-weight: bold; font-size: 11pt; }
  .inhalt { position: absolute; top: 113mm; left: 22mm; right: 20mm; line-height: 1.45; }
  .inhalt p { margin: 0 0 3mm 0; }
  .fuss { position: absolute; bottom: 10mm; left: 22mm; right: 20mm; font-size: 7pt; color: #555; border-top: 0.2mm solid #999; padding-top: 1.5mm; display: flex; justify-content: space-between; gap: 4mm; }
  .seitenzahl { position: absolute; bottom: 20mm; right: 20mm; font-size: 8pt; color: #555; }
  .tab th { text-align: left; font-size: 8.5pt; border-bottom: 0.3mm solid #333; padding: 1mm 1.5mm; background: #f1f1f1; }
  .tab td { padding: 1mm 1.5mm; border-bottom: 0.15mm solid #ccc; font-size: 9pt; }
  .tab tr.summe td { font-weight: bold; border-top: 0.3mm solid #333; border-bottom: none; }
`;

export function brief(o: BriefOpts): string {
  return `
  <div class="seite" style="--akzent:${o.farbe ?? '#333'}">
    <div class="kopf">${o.kopf}</div>
    <div class="anschrift">
      <div class="rs">${esc(o.ruecksendezeile)}</div>
      ${o.empfaenger.map((z) => `<div>${esc(z)}</div>`).join('')}
    </div>
    <table class="info">${o.info.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
    <div class="betreff">${esc(o.betreff)}</div>
    <div class="inhalt">${o.inhalt}</div>
    ${o.seitenzahl ? `<div class="seitenzahl">${esc(o.seitenzahl)}</div>` : ''}
    ${o.fuss ? `<div class="fuss">${o.fuss}</div>` : ''}
  </div>`;
}

/** Folgeseite eines Briefs (ohne Anschriftfeld). */
export function folgeseite(o: { kopfKlein: string; inhalt: string; fuss?: string; seitenzahl: string; farbe?: string }): string {
  return `
  <div class="seite" style="--akzent:${o.farbe ?? '#333'}">
    <div style="border-bottom:0.4mm solid var(--akzent);padding-bottom:1.5mm;font-size:8.5pt;color:#444;display:flex;justify-content:space-between"><span>${o.kopfKlein}</span><span>${esc(o.seitenzahl)}</span></div>
    <div style="margin-top:8mm;line-height:1.45">${o.inhalt}</div>
    ${o.fuss ? `<div class="fuss">${o.fuss}</div>` : ''}
  </div>`;
}
