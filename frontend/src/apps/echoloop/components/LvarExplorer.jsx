import { useState } from 'react';
import { theme } from '../../../config/theme';

/**
 * L-VAR-Explorer (Reiter 1 Variablen/NK/Kopplung · 2 Steckbriefe · 3 CFG).
 * Reiter 1 ist arbeitsfähig: der menschliche Stand (Status/Feedback/Vorabhaken)
 * wird über props.stand + props.onStand(token, value) controlled — Sebs
 * window.STAND-Modell, serverseitig persistiert. props.readOnly bei Freigabe.
 * props.lvar = LvarErgebnis | { leer, grund }
 */
const PURPLE = '#452C71';
const TEAL = '#00C7D2';   // Design-System: Fortschritt/Soll-Erfüllung
const LAV = '#E7DFF7';    // Design-System: Grund/Lavendel

const STATUS_OPT = [
  { v: 'offen', l: 'offen' }, { v: 'in_arbeit', l: 'in Arbeit' }, { v: 'erledigt', l: 'erledigt' },
  { v: 'frage', l: 'Frage' }, { v: 'anders_gebaut', l: 'anders gebaut' },
];
const TYP_OPT = [{ v: 'MP' }, { v: 'TP' }, { v: 'SP' }, { v: 'UNENTSCHIEDEN', l: '?' }];
const KRIT_OPT = [{ v: '', l: 'offen' }, { v: 'hoch', l: 'hoch' }, { v: 'mittel', l: 'mittel' }, { v: 'niedrig', l: 'niedrig' }];

/** Case-insensitiver Freitext-Filter über mehrere Felder. */
function matchQ(q, ...felder) {
  if (!q) return true;
  const t = q.toLowerCase();
  return felder.some((f) => String(f ?? '').toLowerCase().includes(t));
}
async function kopiere(text) {
  try { await navigator.clipboard.writeText(text); } catch { /* clipboard evtl. gesperrt */ }
}

const REITER = [
  { id: 'variablen', label: 'Variablen & NK' },
  { id: 'steckbriefe', label: 'Prozess-Steckbriefe' },
  { id: 'einbau', label: 'Prozess-Start (Einbau)' },
  { id: 'cfg', label: 'Konfiguration' },
];

const KLASSE_TON = {
  gleich: theme.colors.success, abweichend: theme.colors.error, unklar: theme.colors.warning,
  nur_excel: PURPLE, nur_panel: theme.colors.warning, fehlend: theme.colors.error, nicht_verglichen: theme.colors.textMuted,
};

const s = {
  tabs: { display: 'flex', gap: theme.spacing.sm, marginBottom: theme.spacing.lg, flexWrap: 'wrap' },
  tab: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, background: 'transparent', border: 'none', borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.textMuted, cursor: 'pointer' },
  tabActive: { backgroundColor: '#F4EFFB', color: PURPLE },
  card: { backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md },
  title: { fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginBottom: theme.spacing.sm },
  gateRow: { display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' },
  gate: { fontSize: theme.typography.sizes.xs, padding: `3px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full, fontWeight: theme.typography.weights.semibold },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.xs },
  th: { textAlign: 'left', padding: `6px ${theme.spacing.sm}`, color: theme.colors.textMuted, fontWeight: theme.typography.weights.semibold, borderBottom: `1px solid ${theme.colors.border}`, textTransform: 'uppercase', letterSpacing: '0.03em' },
  td: { padding: `6px ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.borderLight}`, verticalAlign: 'top' },
  badge: { fontSize: '0.68rem', padding: `1px 6px`, borderRadius: theme.borderRadius.full, fontWeight: theme.typography.weights.semibold, whiteSpace: 'nowrap' },
  muted: { color: theme.colors.textMuted, fontSize: theme.typography.sizes.xs },
  scroll: { overflowX: 'auto' },
  select: { padding: `3px ${theme.spacing.sm}`, fontSize: '0.7rem', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
  fb: { width: '100%', minWidth: 120, minHeight: 30, padding: `3px ${theme.spacing.sm}`, fontSize: '0.7rem', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none', resize: 'vertical', fontFamily: 'inherit' },
  chk: { accentColor: PURPLE, cursor: 'pointer' },
  progWrap: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  progBar: { flex: 1, height: 8, background: LAV, borderRadius: 4, overflow: 'hidden', maxWidth: 260 },
  progFill: { height: '100%', background: TEAL },
  inp: { width: '100%', minWidth: 90, padding: `3px ${theme.spacing.sm}`, fontSize: '0.7rem', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none' },
  kop: { padding: `2px ${theme.spacing.sm}`, fontSize: '0.66rem', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, background: theme.colors.surface, color: theme.colors.textSecondary, cursor: 'pointer', whiteSpace: 'nowrap' },
  search: { width: '100%', maxWidth: 320, padding: `6px ${theme.spacing.md}`, fontSize: theme.typography.sizes.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none', marginBottom: theme.spacing.md },
};

function Badge({ children, ton }) {
  return <span style={{ ...s.badge, backgroundColor: `${ton}22`, color: ton }}>{children}</span>;
}

/** Fortschrittsbalken „X von N erledigt (Y %)" (Design-System teal/lavendel). */
function Fortschritt({ erledigt, gesamt }) {
  const pct = gesamt ? Math.round((erledigt / gesamt) * 100) : 0;
  return (
    <div style={s.progWrap}>
      <div style={s.progBar}><div style={{ ...s.progFill, width: `${pct}%` }} /></div>
      <span style={s.muted}>{erledigt} von {gesamt} erledigt ({pct} %)</span>
    </div>
  );
}

function Variablen({ nk, kopplung, stand, onStand, readOnly, q }) {
  const quote = nk.entscheidungsquote;
  const val = (token, fallback) => (stand[token] !== undefined ? stand[token] : fallback);
  const statusOf = (k) => val(`${k.id}-st`, k.status);
  const hakenOf = (k) => (k.gesperrt ? false : !!val(`${k.id}-hak`, k.vorabHaken));
  const erledigt = kopplung.karten.filter((k) => statusOf(k) === 'erledigt' || hakenOf(k)).length;
  const karten = kopplung.karten.filter((k) => matchQ(q, k.alt, k.neu, k.rolle));

  return (
    <>
      <div style={s.card}>
        <div style={s.title}>NK-Gate G1–G7 {nk.gold ? '· GOLD ✓' : `· offen: ${nk.offen.join(', ') || '—'}`}</div>
        <div style={s.gateRow}>
          {Object.entries(nk.gates).map(([id, g]) => (
            <span key={id} style={{ ...s.gate, backgroundColor: g.erfuellt ? `${theme.colors.success}22` : `${theme.colors.error}22`, color: g.erfuellt ? theme.colors.success : theme.colors.error }} title={`${g.titel}${g.details?.length ? ': ' + g.details.join(' · ') : ''}`}>
              {id} {g.erfuellt ? '✓' : '✗'}
            </span>
          ))}
        </div>
        <div style={{ ...s.muted, marginTop: theme.spacing.sm }}>
          {nk.zielnamen} Ist-Namen → {nk.entschieden} Zielnamen · entschieden {quote.entschieden} · umformatiert {quote.umformatiert} ({quote.quoteUmformatiert}%) · fertig {quote.fertig}
          {nk.sperrend && <span style={{ color: theme.colors.error }}> · ⛔ harter Kanon-Verstoß</span>}
        </div>
        <div style={{ marginTop: theme.spacing.sm }}>
          <label style={s.muted}>NK-Feedback (zur Regel selbst):</label>
          <textarea style={s.fb} value={val('NK-fb', '')} disabled={readOnly}
            placeholder="Anmerkung zum NK-Gate / zu Regelfällen…" onChange={(e) => onStand('NK-fb', e.target.value)} />
        </div>
      </div>

      {(kopplung.risse.length > 0 || kopplung.dubletten.length > 0 || kopplung.konsolidierungen.length > 0) && (
        <div style={s.card}>
          <div style={s.title}>Kopplung</div>
          {kopplung.risse.map((r, i) => (
            <div key={i} style={{ ...s.muted, marginBottom: 4 }}>
              <Badge ton={theme.colors.error}>Kopplungs-Riss</Badge> <strong>{r.neu}</strong>: in {r.renamedIn.join('/')} umbenannt, in {r.oldIn.join('/')} noch „{r.altName}".
            </div>
          ))}
          {kopplung.dubletten.map((d) => <div key={d} style={{ ...s.muted, marginBottom: 4 }}><Badge ton={theme.colors.error}>Dublette</Badge> {d}</div>)}
          {kopplung.konsolidierungen.map((k) => <div key={k} style={{ ...s.muted, marginBottom: 4 }}><Badge ton={theme.colors.success}>Konsolidierung</Badge> {k}</div>)}
        </div>
      )}

      <div style={s.card}>
        <div style={s.title}>Umbenennen-Cockpit ({kopplung.karten.length})</div>
        <Fortschritt erledigt={erledigt} gesamt={kopplung.karten.length} />
        <div style={{ ...s.scroll, marginTop: theme.spacing.sm }}>
          <table style={s.table}>
            <thead><tr><th style={s.th}>Alt → Neu</th><th style={s.th}>Rolle</th><th style={s.th}>Prozesse</th><th style={s.th}>Vorab</th><th style={s.th}>Status</th><th style={s.th}>Feedback</th></tr></thead>
            <tbody>
              {karten.map((k) => (
                <tr key={k.id}>
                  <td style={s.td}>{k.alt} → <strong>{k.neu}</strong></td>
                  <td style={s.td}>{k.rolle}</td>
                  <td style={s.td}>{k.prozesse.join(', ') || '—'}</td>
                  <td style={s.td}>
                    {k.gesperrt
                      ? <Badge ton={theme.colors.warning} >gesperrt</Badge>
                      : <input type="checkbox" style={s.chk} disabled={readOnly}
                          checked={hakenOf(k)} onChange={(e) => onStand(`${k.id}-hak`, e.target.checked)} />}
                  </td>
                  <td style={s.td}>
                    <select style={s.select} value={statusOf(k)} disabled={readOnly} onChange={(e) => onStand(`${k.id}-st`, e.target.value)}>
                      {STATUS_OPT.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </td>
                  <td style={{ ...s.td, minWidth: 160 }}>
                    <textarea style={s.fb} value={val(`${k.id}-fb`, '')} disabled={readOnly}
                      placeholder={k.gesperrt ? 'Kreuz-Widerspruch am Panel klären…' : 'Feedback / anders gebaut…'}
                      onChange={(e) => onStand(`${k.id}-fb`, e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

const TYP_TON = { MP: PURPLE, TP: theme.colors.success, SP: theme.colors.textMuted, UNENTSCHIEDEN: theme.colors.warning };

function Steckbriefe({ steckbriefe, stand, onStand, readOnly, q }) {
  const val = (token, fallback) => (stand[token] !== undefined ? stand[token] : fallback);
  const typOf = (b) => val(`SB-${b.nr}-typ`, b.typ);
  const rows = steckbriefe.filter((b) => matchQ(q, b.nr, b.ist, b.soll));
  const entschieden = steckbriefe.filter((b) => typOf(b) !== 'UNENTSCHIEDEN').length;

  return (
    <div style={s.card}>
      <div style={s.title}>Prozess-Steckbriefe ({steckbriefe.length})</div>
      <Fortschritt erledigt={entschieden} gesamt={steckbriefe.length} />
      <div style={{ ...s.scroll, marginTop: theme.spacing.sm }}>
        <table style={s.table}>
          <thead><tr>
            <th style={s.th}>Nr · Ist → Soll</th><th style={s.th}>Typ</th><th style={s.th}>Krit.</th>
            <th style={s.th}>Beschreibung</th><th style={s.th}>Ergebnis</th><th style={s.th}></th>
          </tr></thead>
          <tbody>
            {rows.map((b) => {
              const beschr = val(`SB-${b.nr}-beschr`, b.beschreibung || '');
              const ergeb = val(`SB-${b.nr}-ergebnis`, b.ergebnis || '');
              const typ = typOf(b);
              return (
                <tr key={b.nr}>
                  <td style={s.td}>
                    <strong>{b.nr}</strong>{b.altStand && <> <Badge ton={theme.colors.warning}>Alt</Badge></>}
                    <div style={s.muted}>{b.ist} → {b.soll || '—'} ({b.sollQuelle})</div>
                    <div style={s.muted}>ruft {b.gerufen.join(', ') || '—'} · gerufen von {b.aufrufer.join(', ') || '—'}</div>
                  </td>
                  <td style={s.td}>
                    <select style={{ ...s.select, color: TYP_TON[typ] || theme.colors.text }} value={typ} disabled={readOnly} onChange={(e) => onStand(`SB-${b.nr}-typ`, e.target.value)}>
                      {TYP_OPT.map((o) => <option key={o.v} value={o.v}>{o.l || o.v}</option>)}
                    </select>
                    <div style={s.muted}>{typ === b.typ ? b.typQuelle : 'entschieden'}</div>
                  </td>
                  <td style={{ ...s.td, minWidth: 100 }}>
                    <select style={s.select} value={val(`SB-${b.nr}-krit`, b.krit || '')} disabled={readOnly} onChange={(e) => onStand(`SB-${b.nr}-krit`, e.target.value)}>
                      {KRIT_OPT.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                    <textarea style={{ ...s.fb, marginTop: 3 }} value={val(`SB-${b.nr}-kritgrund`, b.kritGrund || '')} disabled={readOnly}
                      placeholder="Grund…" onChange={(e) => onStand(`SB-${b.nr}-kritgrund`, e.target.value)} />
                  </td>
                  <td style={{ ...s.td, minWidth: 160 }}>
                    <textarea style={s.fb} value={beschr} disabled={readOnly} onChange={(e) => onStand(`SB-${b.nr}-beschr`, e.target.value)} />
                  </td>
                  <td style={{ ...s.td, minWidth: 160 }}>
                    <textarea style={s.fb} value={ergeb} disabled={readOnly} onChange={(e) => onStand(`SB-${b.nr}-ergebnis`, e.target.value)} />
                  </td>
                  <td style={s.td}>
                    <button type="button" style={s.kop} title="Soll-Name · Beschreibung · Ergebnis in die Zwischenablage"
                      onClick={() => kopiere([b.soll || b.ist, beschr, ergeb].filter(Boolean).join('\n'))}>kopieren</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pfad({ pfad }) {
  if (!pfad || (!pfad.kuerzbar.length && !pfad.extern.length && !pfad.trenner.length)) return null;
  return (
    <div style={s.card}>
      <div style={s.title}>Pfad-Wiederholung (→ D9/D10){pfad.stamm ? ` · Stamm ${pfad.stamm}` : ''}</div>
      {pfad.kuerzbar.length > 0 && <div style={{ ...s.muted, marginBottom: 4 }}><Badge ton={PURPLE}>kürzbar ({pfad.kuerzbar.length})</Badge> {pfad.kuerzbar.map((k) => k.schluessel).join(', ')} — über C_BasisPfad + Rest baubar (D9).</div>}
      {pfad.extern.length > 0 && <div style={{ ...s.muted, marginBottom: 4 }}><Badge ton={theme.colors.warning}>extern ({pfad.extern.length})</Badge> {pfad.extern.map((e) => e.schluessel).join(', ')} — nicht relativ baubar, Umgebungs-Bindung (D10). Kein Defekt.</div>}
      {pfad.trenner.length > 0 && <div style={{ ...s.muted, marginBottom: 4 }}><Badge ton={theme.colors.textMuted}>trenner ({pfad.trenner.length})</Badge> {pfad.trenner.join(', ')} — führender Separator, sonst „…\\…" beim Zusammensetzen.</div>}
    </div>
  );
}

function Einbau({ einbau, q }) {
  if (!einbau?.length) return <div style={s.card}><div style={s.muted}>Keine Einbau-Tabelle.</div></div>;
  const rows = einbau.filter((z) => matchQ(q, z.nr, z.istName, z.namensVorschlag));
  return (
    <div style={s.card}>
      <div style={s.title}>Einbau-Tabelle · /prozess-start ({einbau.length})</div>
      <div style={s.muted}>Sprechzettel für den Menschen am Panel. Was der Export nicht hergibt, bleibt ❓ (Owner/Takt/Frische-Schwelle = Eingabe; Umbenenn-Wirkung = Panel-Frage).</div>
      <div style={{ ...s.scroll, marginTop: theme.spacing.sm }}>
        <table style={s.table}>
          <thead><tr>
            <th style={s.th}>Nr / Ist</th><th style={s.th}>Namens-Vorschlag</th><th style={s.th}>Typ</th>
            <th style={s.th}>Kopfblock</th><th style={s.th}>C_ProzessTyp</th><th style={s.th}>Frische (SP)</th><th style={s.th}>Umbenenn-Risiko</th>
          </tr></thead>
          <tbody>
            {rows.map((z) => (
              <tr key={z.nr}>
                <td style={s.td}><strong>{z.nr}</strong><div style={s.muted}>{z.istName}</div></td>
                <td style={s.td}>{z.namensVorschlag || '—'}<div style={s.muted}>{z.namensVorschlagQuelle}</div></td>
                <td style={s.td}><Badge ton={TYP_TON[z.typ] || theme.colors.textMuted}>{z.typ}</Badge><div style={s.muted}>{z.typBegruendung}</div></td>
                <td style={s.td}><code style={{ fontSize: '0.68rem' }}>{z.kopfblock}</code></td>
                <td style={s.td}>{z.cProzessTyp}</td>
                <td style={s.td}>{z.frische ? (z.frische.verstoss ? <Badge ton={theme.colors.error}>Frische fehlt</Badge> : <Badge ton={theme.colors.success}>ok</Badge>) : <span style={s.muted}>—</span>}{z.frische && <div style={s.muted}>{z.frische.schwelleVorschlag}</div>}</td>
                <td style={s.td}><span style={s.muted}>{z.umbenennFrage}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cfg({ cfg, pfad, stand, onStand, readOnly, q }) {
  if (!cfg) return <><div style={s.card}><div style={s.muted}>Keine CONFIG-Excel hinterlegt — Reiter 3 zeigt nichts zu vergleichen (ERSTANLAGE).</div></div><Pfad pfad={pfad} /></>;
  const val = (token, fallback) => (stand[token] !== undefined ? stand[token] : fallback);
  const hakOf = (k) => (k.vorabhakenGesperrt ? false : !!val(`CFG-${k.key}-hak`, false));
  const erledigt = cfg.schluessel.filter((k) => hakOf(k) || val(`CFG-${k.key}-wahl`, '') || val(`CFG-${k.key}-fb`, '')).length;
  const rows = cfg.schluessel.filter((k) => matchQ(q, k.key, k.configProzess, k.klasse));
  return (
    <>
      <Pfad pfad={pfad} />
      <div style={s.card}>
        <div style={s.title}>Konfiguration · Modus {cfg.modus}</div>
        <div style={s.gateRow}>
          {Object.entries(cfg.verteilung).filter(([, n]) => n > 0).map(([klasse, n]) => (
            <Badge key={klasse} ton={KLASSE_TON[klasse] || theme.colors.textMuted}>{klasse}: {n}</Badge>
          ))}
        </div>
        <Fortschritt erledigt={erledigt} gesamt={cfg.schluessel.length} />
      </div>
      <div style={s.card}>
        <div style={s.scroll}>
          <table style={s.table}>
            <thead><tr><th style={s.th}>Schlüssel</th><th style={s.th}>Prozess</th><th style={s.th}>Klasse</th><th style={s.th}>Panel / Kandidaten</th><th style={s.th}>Excel</th><th style={s.th}>Vorab</th><th style={s.th}>Wahl</th><th style={s.th}>Feedback</th></tr></thead>
            <tbody>
              {rows.map((k) => (
                <tr key={k.key}>
                  <td style={s.td}><strong>{k.key}</strong>{k.hinweis && <div style={s.muted}>{k.hinweis}</div>}</td>
                  <td style={s.td}>{k.configProzess}</td>
                  <td style={s.td}><Badge ton={KLASSE_TON[k.klasse] || theme.colors.textMuted}>{k.klasse}</Badge></td>
                  <td style={s.td}>{k.kandidaten ? k.kandidaten.join(' | ') : (k.panelWert || '—')}</td>
                  <td style={s.td}>{k.excelWert || '—'}</td>
                  <td style={s.td}>
                    {k.vorabhakenGesperrt
                      ? <Badge ton={theme.colors.warning}>gesperrt</Badge>
                      : <input type="checkbox" style={s.chk} disabled={readOnly} checked={hakOf(k)} onChange={(e) => onStand(`CFG-${k.key}-hak`, e.target.checked)} />}
                  </td>
                  <td style={s.td}>
                    {k.kandidaten
                      ? <select style={s.select} value={val(`CFG-${k.key}-wahl`, '')} disabled={readOnly} onChange={(e) => onStand(`CFG-${k.key}-wahl`, e.target.value)}>
                          <option value="">— wählen —</option>
                          {k.kandidaten.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      : <span style={s.muted}>—</span>}
                  </td>
                  <td style={{ ...s.td, minWidth: 140 }}>
                    <textarea style={s.fb} value={val(`CFG-${k.key}-fb`, '')} disabled={readOnly} placeholder="Feedback…" onChange={(e) => onStand(`CFG-${k.key}-fb`, e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {cfg.verwaist.length > 0 && (
        <div style={s.card}>
          <div style={s.title}>Excel-Waisen ({cfg.verwaist.length})</div>
          {cfg.verwaist.map((w) => (
            <div key={w.key} style={{ ...s.muted, marginBottom: 4 }}>
              <Badge ton={w.art === 'verdacht' ? theme.colors.warning : theme.colors.textMuted}>{w.art}</Badge> <strong>{w.key}</strong> = {w.wert} — {w.hinweis}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function LvarExplorer({ lvar, stand = {}, onStand = () => {}, readOnly = false }) {
  const [reiter, setReiter] = useState('variablen');
  const [q, setQ] = useState('');
  if (!lvar) return null;
  if (lvar.leer) return <div style={s.card}><div style={s.muted}>{lvar.grund}</div></div>;

  return (
    <div>
      <div style={s.tabs}>
        {REITER.map((r) => (
          <button key={r.id} style={{ ...s.tab, ...(reiter === r.id ? s.tabActive : {}) }} onClick={() => setReiter(r.id)}>{r.label}</button>
        ))}
      </div>
      <input style={s.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtern (Name · Schlüssel · Prozess) …" />
      {reiter === 'variablen' && <Variablen nk={lvar.nk} kopplung={lvar.kopplung} stand={stand} onStand={onStand} readOnly={readOnly} q={q} />}
      {reiter === 'steckbriefe' && <Steckbriefe steckbriefe={lvar.steckbriefe} stand={stand} onStand={onStand} readOnly={readOnly} q={q} />}
      {reiter === 'einbau' && <Einbau einbau={lvar.einbau} q={q} />}
      {reiter === 'cfg' && <Cfg cfg={lvar.cfg} pfad={lvar.pfad} stand={stand} onStand={onStand} readOnly={readOnly} q={q} />}
      {lvar.rgaHinweise?.length > 0 && (
        <div style={s.card}>
          <div style={s.title}>→ RGA-Verzahnung ({lvar.rgaHinweise.length} Hinweise)</div>
          {lvar.rgaHinweise.map((h, i) => (
            <div key={i} style={{ ...s.muted, marginBottom: 4 }}><strong style={{ color: PURPLE }}>{h.dim}</strong> {h.hinweis}</div>
          ))}
        </div>
      )}
    </div>
  );
}
