/**
 * Golden-Dataset-Messung — Markdown-Bericht aus den Messergebnissen.
 */
import type { FallMessung } from './messung';
import { quote } from './vergleich';

const pz = (a: number, b: number) => (b ? `${quote(a, b)} %` : '—');

function tabelle(kopf: string[], zeilen: Array<Array<string | number>>): string {
  return [`| ${kopf.join(' | ')} |`, `|${kopf.map(() => '---').join('|')}|`, ...zeilen.map((z) => `| ${z.join(' | ')} |`)].join('\n');
}

function regelStatistik(liste: FallMessung[], ebene: 'posteingang' | 'regelwerk') {
  const s = new Map<string, { erwartet: number; getroffen: number; verfehlt: string[]; fehlalarm: string[]; bekannt: number }>();
  const eintrag = (r: string) => { if (!s.has(r)) s.set(r, { erwartet: 0, getroffen: 0, verfehlt: [], fehlalarm: [], bekannt: 0 }); return s.get(r)!; };
  for (const m of liste) {
    const a = m[ebene];
    if (!a) continue;
    for (const r of a.treffer) { const e = eintrag(r); e.erwartet++; e.getroffen++; }
    for (const r of a.verfehlt) { const e = eintrag(r); e.erwartet++; e.verfehlt.push(m.fall); }
    for (const r of a.fehlalarm) eintrag(r).fehlalarm.push(m.fall);
    for (const r of a.bekannt) eintrag(r).bekannt++;
  }
  return [...s.entries()].sort((a, b) => (b[1].verfehlt.length + b[1].fehlalarm.length) - (a[1].verfehlt.length + a[1].fehlalarm.length) || a[0].localeCompare(b[0]));
}

export function erzeugeBericht(d: { lauf: string; modell: string; endeZuEnde: boolean; ergebnisse: FallMessung[]; erkennung?: 'legacy' | 'profil' }): string {
  const teile: string[] = [];
  teile.push(`# Messbericht Wohngeld Golden Dataset — ${d.lauf}\n`);
  teile.push(`Erkennung: ${d.erkennung === 'profil' ? 'Document-Processing-Segmentprofil „Wohngeld-Eingang"' : 'bisheriger Weg (Grenzprüfung + eigene Klassifikation)'}\n`);
  teile.push(`Modell: \`${d.modell}\` · Dokumentgrenzen für die Extraktion: ${d.endeZuEnde ? 'aus dem Split (Ende-zu-Ende)' : 'erwartete Grenzen (Orakel)'} · Fälle: ${new Set(d.ergebnisse.map((e) => e.fall)).size}\n`);

  // ── Übersicht je Variante ──
  const varianten = [...new Set(d.ergebnisse.map((e) => e.variante))];
  const zeilen: Array<Array<string | number>> = [];
  for (const v of varianten) {
    const l = d.ergebnisse.filter((e) => e.variante === v);
    const sp = l.filter((e) => e.split).map((e) => e.split!.metrik);
    const docs = l.flatMap((e) => e.dokumente ?? []);
    const felder = docs.flatMap((x) => x.felder);
    const pe = l.filter((e) => e.posteingang).map((e) => e.posteingang!);
    const peErw = pe.reduce((s, a) => s + a.treffer.length + a.verfehlt.length, 0);
    zeilen.push([
      v,
      sp.length ? `${pz(sp.reduce((s, x) => s + x.treffer, 0), sp.reduce((s, x) => s + x.erwarteteSchnitte, 0))} Schnitte, ${sp.reduce((s, x) => s + x.fehlalarme, 0)} Fehlschnitte` : '—',
      sp.length ? pz(sp.reduce((s, x) => s + x.dokumenteExakt, 0), sp.reduce((s, x) => s + x.dokumenteGesamt, 0)) : '—',
      docs.length ? pz(docs.filter((x) => x.typErkannt === x.typErwartet).length, docs.length) : '—',
      felder.length ? pz(felder.filter((f) => f.urteil === 'richtig').length, felder.length) : '—',
      pe.length ? `${pz(pe.reduce((s, a) => s + a.treffer.length, 0), peErw)} · ${pe.reduce((s, a) => s + a.fehlalarm.length, 0)} Fehlalarme` : '—',
    ]);
  }
  teile.push('## Übersicht\n');
  teile.push(tabelle(['Variante', 'Split', 'Dokumente exakt getrennt', 'Typ richtig', 'Felder richtig', 'Prüfung Posteingang (Treffer · Fehlalarme)'], zeilen));
  const rw = d.ergebnisse.filter((e, i, arr) => e.regelwerk && arr.findIndex((x) => x.fall === e.fall) === i).map((e) => e.regelwerk!);
  if (rw.length) {
    const erwartet = rw.reduce((s, a) => s + a.treffer.length + a.verfehlt.length, 0);
    teile.push(`\n**Regelwerk bei korrekt erfasstem Fall:** ${pz(rw.reduce((s, a) => s + a.treffer.length, 0), erwartet)} der erwarteten Befunde gemeldet, `
      + `${rw.reduce((s, a) => s + a.verfehlt.length, 0)} verfehlt, ${rw.reduce((s, a) => s + a.fehlalarm.length, 0)} Fehlalarme, `
      + `${rw.reduce((s, a) => s + a.bekannt.length, 0)} bekannte App-Übermeldungen (Regeln je Fall zusammengefasst).\n`);
  }

  // ── Klassifikation ──
  const docsAlle = d.ergebnisse.flatMap((e) => (e.dokumente ?? []).map((x) => ({ ...x, variante: e.variante, fall: e.fall })));
  if (docsAlle.length) {
    const verw = new Map<string, string[]>();
    for (const x of docsAlle) if (x.typErkannt !== x.typErwartet) {
      const k = `${x.typErwartet} → ${x.typErkannt ?? '(kein Teil)'}`;
      verw.set(k, [...(verw.get(k) ?? []), `${x.fall}/${x.variante[0]}#${x.nr}`]);
    }
    teile.push('\n## Klassifikation: Verwechslungen\n');
    teile.push(verw.size ? tabelle(['erwartet → erkannt', 'Anzahl', 'Beispiele (Fall/Variante#Dok)'], [...verw.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, v]) => [k, v.length, v.slice(0, 6).join(', ')])) : 'Keine Verwechslungen.');

    // ── Extraktion je Feld ──
    const feld = new Map<string, { n: number; richtig: number; falsch: number; fehlt: number; zuviel: number; bsp: string[] }>();
    for (const x of docsAlle) {
      if (x.typErkannt !== x.typErwartet) continue; // Felder nur bei richtig erkanntem Typ sinnvoll
      for (const f of x.felder) {
        const k = `${x.typErwartet} · ${f.gruppe}.${f.pfad}`;
        const e = feld.get(k) ?? { n: 0, richtig: 0, falsch: 0, fehlt: 0, zuviel: 0, bsp: [] };
        e.n++; e[f.urteil]++;
        if (f.urteil !== 'richtig' && e.bsp.length < 3) e.bsp.push(`${x.fall}: ${JSON.stringify(f.erwartet)} ≠ ${JSON.stringify(f.ist)}`);
        feld.set(k, e);
      }
    }
    teile.push('\n## Extraktion je Feld (nur Dokumente mit richtig erkanntem Typ)\n');
    teile.push(tabelle(['Dokumenttyp · Feld', 'n', 'richtig', 'falsch', 'fehlt', 'zu viel', 'Beispiele'],
      [...feld.entries()].sort((a, b) => a[1].richtig / a[1].n - b[1].richtig / b[1].n).map(([k, e]) => [k, e.n, pz(e.richtig, e.n), e.falsch, e.fehlt, e.zuviel, e.bsp.join('; ').replace(/\|/g, '/')])));
  }

  // ── Prüfregeln ──
  for (const [ebene, titel] of [['regelwerk', 'Prüfregeln bei korrekt erfasstem Fall'], ['posteingang', 'Prüfregeln auf dem Posteingang-Stand']] as const) {
    const quelle = ebene === 'regelwerk' ? d.ergebnisse.filter((e, i, arr) => arr.findIndex((x) => x.fall === e.fall) === i) : d.ergebnisse;
    const stat = regelStatistik(quelle, ebene);
    if (!stat.length) continue;
    teile.push(`\n## ${titel}\n`);
    teile.push(tabelle(['Regel', 'erwartet', 'getroffen', 'verfehlt in', 'Fehlalarm in', 'bekannte Übermeldung'],
      stat.map(([r, e]) => [`\`${r}\``, e.erwartet, e.getroffen, e.verfehlt.join(', ') || '—', e.fehlalarm.join(', ') || '—', e.bekannt || '—'])));
  }

  // ── Je Fall ──
  teile.push('\n## Je Fall\n');
  teile.push(tabelle(['Fall', 'Variante', 'Split (Schnitte · Fehlschnitte)', 'Typ', 'Felder', 'Posteingang verfehlt / Fehlalarm', 'Regelwerk verfehlt / Fehlalarm'],
    d.ergebnisse.map((e) => {
      const f = (e.dokumente ?? []).flatMap((x) => x.felder);
      return [
        e.fall, e.variante,
        e.split ? `${e.split.metrik.treffer}/${e.split.metrik.erwarteteSchnitte} · ${e.split.metrik.fehlalarme}${e.split.hinweis ? ' ⚠' : ''}` : '—',
        e.dokumente ? `${e.dokumente.filter((x) => x.typErkannt === x.typErwartet).length}/${e.dokumente.length}` : '—',
        f.length ? pz(f.filter((x) => x.urteil === 'richtig').length, f.length) : '—',
        e.posteingang ? `${e.posteingang.verfehlt.join(', ') || '—'} / ${e.posteingang.fehlalarm.join(', ') || '—'}` : '—',
        e.regelwerk ? `${e.regelwerk.verfehlt.join(', ') || '—'} / ${e.regelwerk.fehlalarm.join(', ') || '—'}` : '—',
      ];
    })));
  const splitHinweise = d.ergebnisse.filter((e) => e.split?.hinweis || e.split?.metrik.fehlalarmSeiten.length || e.split?.metrik.verfehltSeiten.length);
  if (splitHinweise.length) {
    teile.push('\n### Split-Details\n');
    for (const e of splitHinweise) {
      const s = e.split!;
      teile.push(`- **${e.fall} ${e.variante}:** ${s.hinweis ? `${s.hinweis} ` : ''}${s.metrik.verfehltSeiten.length ? `Verfehlte Schnitte vor Seite ${s.metrik.verfehltSeiten.join(', ')}. ` : ''}${s.metrik.fehlalarmSeiten.length ? `Fehlschnitte vor Seite ${s.metrik.fehlalarmSeiten.join(', ')}.` : ''}`);
    }
  }
  const fallFehler = d.ergebnisse.filter((e) => e.fehler);
  if (fallFehler.length) {
    teile.push('\n### Abgebrochene Fälle\n');
    for (const e of fallFehler) teile.push(`- ${e.fall} ${e.variante}: ${e.fehler}`);
  }
  const fehler = docsAlle.filter((x) => x.fehler);
  if (fehler.length) {
    teile.push('\n### Fehler bei der Extraktion\n');
    for (const x of fehler) teile.push(`- ${x.fall} ${x.variante} Dok. ${x.nr} (${x.art}): ${x.fehler}`);
  }
  return `${teile.join('\n')}\n`;
}
