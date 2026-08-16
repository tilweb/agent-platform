/**
 * K1-Report-Export — Kundenfassung + Bauanleitung + Kennzahlen als
 * selbsttragendes, druckoptimiertes HTML (Browser: Drucken → PDF; kein
 * Renderer-Dependency). YNEO-nahe Gestaltung, Living-Styleguide-Geist.
 *
 * Rein & deterministisch: `renderReportHtml` nimmt Kunde/Prozess/Baustand und
 * gibt einen vollständigen HTML-String zurück — offline bedienbar, ein File.
 */
import { ALL_DIMS, CORE_DIMS, DIM_LABEL, computeScores, bewerteVereinbarungsGates, levelKlasse, type Dim } from './scoring';
import { wertfehlerAnalyse } from './checker';
import type { Baustand, Kunde, Prozess } from './types';

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const SEV_LABEL: Record<string, string> = { kritisch: '🔴 kritisch', hoch: '🔶 hoch', mittel: '🟡 mittel', niedrig: '⚪ niedrig', frage: '❓ Panel' };
const KLASSE_LABEL: Record<string, string> = { boden: 'Boden', robustheit: 'Robustheit', skalierung: 'Skalierung' };

/** Erzeugt den vollständigen HTML-Report zu einem Baustand. */
export function renderReportHtml(input: { kunde?: Kunde | null; prozess?: Prozess | null; baustand: Baustand }): string {
  const { kunde, prozess, baustand } = input;
  const s = computeScores(baustand.dimensionen ?? {});
  const gates = bewerteVereinbarungsGates(baustand.dimensionen ?? {});
  const tiefe = baustand.analyseTiefe;

  const kennzahlen = `
    <section class="kpis">
      ${kpi('Gesamt-Reifegrad', `RG ${s.gesamtRg}`, 'weakest link (Pflicht-Raster)')}
      ${kpi('RG* (harter Boden)', `${s.rgStar}`, 'min über relevante Dimensionen')}
      ${kpi('RGQ (Quote)', `${s.rgq}%`, 'Σ Ist / 50')}
      ${kpi('SE (Soll-Erfüllung)', `${s.seQuotient}%`, 'Über-Soll zählt nicht')}
    </section>`;

  const profil = `
    <table class="profil">
      <thead><tr><th>Dimension</th><th>Natur</th><th>Ist</th><th>Soll</th><th>Profil</th></tr></thead>
      <tbody>
        ${ALL_DIMS.map((d) => profilZeile(d, baustand)).join('')}
      </tbody>
    </table>`;

  const relevanteGates = gates.filter((g) => g.status !== 'nicht_relevant');
  const gateBlock = relevanteGates.length
    ? `<section><h2>Vereinbarungs-Gates (Zwei-Naturen)</h2>
        <p class="hint">Ab Skalierungs-Stufe (L4–L5) baut die Organisation mit — diese Gates sind Vereinbarungen, keine reinen Bau-Aufgaben.</p>
        <table class="gates"><thead><tr><th>Gate</th><th>Status</th><th>Träger / Hinweis</th></tr></thead><tbody>
        ${relevanteGates.map((g) => `<tr><td><strong>${esc(g.id)}</strong></td><td class="st-${esc(g.status)}">${esc(g.status)}</td><td>${esc(g.hinweis ?? g.fordert)}</td></tr>`).join('')}
        </tbody></table></section>`
    : '';

  const befunde = (baustand.befunde ?? []).filter((f) => f.schwere !== 'niedrig');
  const befundBlock = befunde.length
    ? `<section><h2>Befunde</h2>
        <table class="befunde"><thead><tr><th>Muster</th><th>Schwere</th><th>Fundstelle</th><th>Befund</th></tr></thead><tbody>
        ${befunde.slice(0, 40).map((f) => `<tr><td>${esc(f.pm)}${f.beobachtend ? ' <span class="obs">(beob.)</span>' : ''}</td><td>${esc(SEV_LABEL[f.schwere] ?? f.schwere)}</td><td>P${esc(f.prozessNr)}${f.schrittId != null ? ` S${esc(f.schrittId)}` : ''}</td><td>${esc(f.befund)}</td></tr>`).join('')}
        </tbody></table></section>`
    : '';

  // Wertfehler-Kette (/wertfehler) — nur wenn statische W-Befunde vorliegen.
  const wf = wertfehlerAnalyse(baustand.befunde ?? []);
  const wertfehlerBlock = wf.statischeBefunde.length
    ? `<section><h2>Wertfehler-Kette</h2>
        <p class="hint">Stille Falschwerte („Prozess läuft weiter, Wert ist falsch/leer") entlang der 6-Stationen-Herkunftskette. ${esc(wf.methodenHinweis)}</p>
        <table class="befunde"><thead><tr><th>Station</th><th>Prüft</th><th>Statische Befunde</th></tr></thead><tbody>
        ${wf.stationen.map((st) => `<tr><td><strong>${st.nr} ${esc(st.station)}</strong></td><td>${esc(st.prueft)}</td><td>${st.befunde.length ? st.befunde.map((f) => `${esc(f.pm)} (P${esc(f.prozessNr)}${f.schrittId != null ? ` S${esc(f.schrittId)}` : ''})`).join('<br>') : '—'}</td></tr>`).join('')}
        </tbody></table>
        <p class="hint"><strong>Am Panel klären (nicht statisch):</strong></p>
        <ul>${wf.panelFragen.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></section>`
    : '';

  const narrativ = baustand.narrativ;
  const narrativBlock = narrativ
    ? `<section><h2>Kundenfassung</h2>
        <p class="exec"><strong>${esc(narrativ.exec?.was ?? '')}</strong></p>
        ${(narrativ.exec?.findings ?? []).length ? `<ul>${narrativ.exec!.findings.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${(narrativ.prosa ?? []).map((p) => `<p>${esc(p)}</p>`).join('')}
        ${narrativ.stabilityNote ? `<p class="hint">${esc(narrativ.stabilityNote)}</p>` : ''}</section>`
    : '';

  const bau = baustand.bauanleitung;
  const bauBlock = bau
    ? `<section class="bau"><h2>Bauanleitung → Ziel-Reifegrad RG${esc(bau.zielLevel)}</h2>
        ${bau.einleitung ? `<p>${esc(bau.einleitung)}</p>` : ''}
        ${(bau.karten ?? []).map((k) => `
          <div class="karte">
            <h3>${esc(k.id)} · ${esc(k.titel)} <span class="prio prio-${esc(k.prio)}">${esc(k.prio)}</span></h3>
            ${k.warum ? `<p class="warum">${esc(k.warum)}</p>` : ''}
            <ol>${(k.schritte ?? []).map((sch) => `<li>${esc(sch.text)}</li>`).join('')}</ol>
          </div>`).join('')}
      </section>`
    : '';

  const titel = `${esc(prozess?.name ?? 'Prozess')} — Reifegrad-Analyse`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titel}</title>
<style>${CSS}</style></head>
<body>
  <header class="kopf">
    <div class="marke">Echo-Loop · Reifegrad-Analyse</div>
    <h1>${titel}</h1>
    <div class="meta">
      ${kunde ? `Kunde: <strong>${esc(kunde.name)}</strong> · ` : ''}
      ${prozess?.emmaPlanNr ? `EMMA-Nr ${esc(prozess.emmaPlanNr)} · ` : ''}
      Stand ${esc(baustand.datum)} · Status ${esc(baustand.status)}
      ${tiefe ? ` · Analyse-Tiefe <strong>${esc(tiefe)}</strong>` : ''}
    </div>
    ${tiefe ? `<div class="tiefe-hinweis">Dieser Bericht verspricht nie mehr, als seine Tiefe (${esc(tiefe)}) trägt.</div>` : ''}
  </header>
  ${kennzahlen}
  <section><h2>Reifegradprofil D1–D10 + D6b</h2>${profil}<p class="noten">${esc(s.notenZeile)}</p></section>
  ${gateBlock}
  ${narrativBlock}
  ${befundBlock}
  ${wertfehlerBlock}
  ${bauBlock}
  <footer>Erzeugt aus dem Echo-Loop-Baustand · deterministische Kennzahlen (RG/RGQ/SE) · ${esc(new Date().toISOString().slice(0, 10))}</footer>
</body></html>`;
}

function kpi(label: string, wert: string, sub: string): string {
  return `<div class="kpi"><div class="kpi-wert">${esc(wert)}</div><div class="kpi-label">${esc(label)}</div><div class="kpi-sub">${esc(sub)}</div></div>`;
}

function profilZeile(d: Dim, b: Baustand): string {
  const dim = b.dimensionen?.[d];
  const ist = dim?.ist ?? 0;
  const soll = dim?.soll ?? 0;
  const maskiert = dim?.relevanz === 0;
  const kern = (CORE_DIMS as readonly string[]).includes(d);
  const balken = maskiert
    ? '<span class="maske">maskiert</span>'
    : `<span class="bar"><span class="ist" style="width:${(ist / 5) * 100}%"></span><span class="soll" style="left:${(soll / 5) * 100}%"></span></span>`;
  return `<tr${maskiert ? ' class="row-maske"' : ''}>
    <td>${esc(d.toUpperCase())} ${esc(DIM_LABEL[d])}${kern ? '' : ' <em>(Zusatz)</em>'}</td>
    <td>${esc(KLASSE_LABEL[levelKlasse(ist)] ?? '')}</td>
    <td class="num">${maskiert ? '–' : `L${ist}`}</td>
    <td class="num">${maskiert ? '–' : `L${soll}`}</td>
    <td class="profil-cell">${balken}</td>
  </tr>`;
}

const CSS = `
:root{--lila:#452C71;--lila-2:#6B4CA8;--ink:#1a1a1a;--mut:#666;--line:#e3e0ea;--bg:#fff;--soft:#f6f4fa}
*{box-sizing:border-box}
body{font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:var(--ink);margin:0;background:var(--bg);padding:32px;max-width:900px;margin:0 auto}
h1{font-size:24px;margin:4px 0 8px}h2{font-size:18px;margin:28px 0 10px;color:var(--lila);border-bottom:2px solid var(--line);padding-bottom:4px}
h3{font-size:15px;margin:12px 0 4px}
.kopf{border-bottom:3px solid var(--lila);padding-bottom:14px;margin-bottom:18px}
.marke{color:var(--lila-2);font-weight:700;letter-spacing:.04em;text-transform:uppercase;font-size:12px}
.meta{color:var(--mut);font-size:13px}
.tiefe-hinweis{margin-top:6px;font-size:12px;color:var(--mut);font-style:italic}
.kpis{display:flex;gap:12px;margin:18px 0;flex-wrap:wrap}
.kpi{flex:1;min-width:150px;background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:14px}
.kpi-wert{font-size:26px;font-weight:800;color:var(--lila)}
.kpi-label{font-weight:600;font-size:13px}.kpi-sub{color:var(--mut);font-size:11px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;color:var(--mut);font-weight:600;border-bottom:1px solid var(--line);padding:6px 8px}
td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.num{text-align:center;white-space:nowrap}
.profil-cell{width:220px}
.bar{position:relative;display:block;height:12px;background:#ece8f4;border-radius:6px;overflow:visible}
.bar .ist{position:absolute;left:0;top:0;height:100%;background:var(--lila);border-radius:6px}
.bar .soll{position:absolute;top:-2px;width:2px;height:16px;background:#c0392b}
.row-maske{color:var(--mut)}.maske{font-style:italic;color:var(--mut)}
.noten{font-size:12px;color:var(--mut);margin-top:8px}
.hint{color:var(--mut);font-size:12px}
.gates .st-papier,.gates .st-nicht_belegt{color:#c0392b;font-weight:600}
.gates .st-nachgewiesen{color:#1e7a3d;font-weight:600}
.obs{color:var(--mut);font-size:11px}
.exec{font-size:16px}
.bau .karte{border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:10px 0;break-inside:avoid}
.warum{color:var(--mut);font-size:13px;margin:2px 0 6px}
.prio{font-size:11px;padding:1px 7px;border-radius:10px;font-weight:600;vertical-align:middle}
.prio-hoch{background:#fbe4e2;color:#c0392b}.prio-mittel{background:#fdf3e0;color:#a76a00}.prio-niedrig{background:#e8f3ec;color:#1e7a3d}
footer{margin-top:32px;padding-top:12px;border-top:1px solid var(--line);color:var(--mut);font-size:11px}
@media print{body{padding:0;max-width:none}h2{break-after:avoid}section{break-inside:auto}.karte,.kpi{break-inside:avoid}}
`;
