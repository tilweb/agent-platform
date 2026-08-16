import { useState } from 'react';
import { theme } from '../../../config/theme';

/**
 * L-VAR-Explorer (Reiter 1 Variablen/NK/Kopplung · 2 Steckbriefe · 3 CFG).
 * Read-only-Darstellung des `lvar`-Ergebnisses (assembleLvar) — Kern der Phase 2.
 * props.lvar = LvarErgebnis | { leer, grund }
 */
const PURPLE = '#452C71';

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
};

function Badge({ children, ton }) {
  return <span style={{ ...s.badge, backgroundColor: `${ton}22`, color: ton }}>{children}</span>;
}

function Variablen({ nk, kopplung }) {
  const q = nk.entscheidungsquote;
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
          {nk.zielnamen} Ist-Namen → {nk.entschieden} Zielnamen · entschieden {q.entschieden} · umformatiert {q.umformatiert} ({q.quoteUmformatiert}%) · fertig {q.fertig}
          {nk.sperrend && <span style={{ color: theme.colors.error }}> · ⛔ harter Kanon-Verstoß</span>}
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
        <div style={s.scroll}>
          <table style={s.table}>
            <thead><tr><th style={s.th}>Alt</th><th style={s.th}>Neu</th><th style={s.th}>Rolle</th><th style={s.th}>Prozesse</th><th style={s.th}>Status</th></tr></thead>
            <tbody>
              {kopplung.karten.map((k) => (
                <tr key={k.id}>
                  <td style={s.td}>{k.alt}</td>
                  <td style={s.td}><strong>{k.neu}</strong></td>
                  <td style={s.td}>{k.rolle}</td>
                  <td style={s.td}>{k.prozesse.join(', ') || '—'}</td>
                  <td style={s.td}>
                    {k.gesperrt ? <Badge ton={theme.colors.warning}>gesperrt (Reiter 3)</Badge>
                      : k.vorabHaken ? <Badge ton={theme.colors.success}>✓ vorab</Badge>
                      : <Badge ton={theme.colors.textMuted}>{k.status}</Badge>}
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

function Steckbriefe({ steckbriefe }) {
  return (
    <div style={s.card}>
      <div style={s.title}>Prozess-Steckbriefe ({steckbriefe.length})</div>
      <div style={s.scroll}>
        <table style={s.table}>
          <thead><tr><th style={s.th}>Nr</th><th style={s.th}>Ist</th><th style={s.th}>Typ</th><th style={s.th}>Soll</th><th style={s.th}>Ruft / gerufen von</th><th style={s.th}>Krit.</th></tr></thead>
          <tbody>
            {steckbriefe.map((b) => (
              <tr key={b.nr}>
                <td style={s.td}>{b.nr}{b.altStand && <> <Badge ton={theme.colors.warning}>Alt</Badge></>}</td>
                <td style={s.td}>{b.ist}</td>
                <td style={s.td}><Badge ton={TYP_TON[b.typ] || theme.colors.textMuted}>{b.typ}</Badge> <span style={s.muted}>{b.typQuelle}</span></td>
                <td style={s.td}>{b.soll || '—'}<div style={s.muted}>{b.sollQuelle}</div></td>
                <td style={s.td}>{b.gerufen.join(', ') || '—'} / {b.aufrufer.join(', ') || '—'}</td>
                <td style={s.td}>{b.krit || <span style={s.muted}>offen</span>}</td>
              </tr>
            ))}
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

function Einbau({ einbau }) {
  if (!einbau?.length) return <div style={s.card}><div style={s.muted}>Keine Einbau-Tabelle.</div></div>;
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
            {einbau.map((z) => (
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

function Cfg({ cfg, pfad }) {
  if (!cfg) return <><div style={s.card}><div style={s.muted}>Keine CONFIG-Excel hinterlegt — Reiter 3 zeigt nichts zu vergleichen (ERSTANLAGE).</div></div><Pfad pfad={pfad} /></>;
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
      </div>
      <div style={s.card}>
        <div style={s.scroll}>
          <table style={s.table}>
            <thead><tr><th style={s.th}>Schlüssel</th><th style={s.th}>Prozess</th><th style={s.th}>Klasse</th><th style={s.th}>Panel</th><th style={s.th}>Excel</th><th style={s.th}>Hinweis</th></tr></thead>
            <tbody>
              {cfg.schluessel.map((k) => (
                <tr key={k.key}>
                  <td style={s.td}><strong>{k.key}</strong></td>
                  <td style={s.td}>{k.configProzess}</td>
                  <td style={s.td}><Badge ton={KLASSE_TON[k.klasse] || theme.colors.textMuted}>{k.klasse}</Badge></td>
                  <td style={s.td}>{k.kandidaten ? k.kandidaten.join(' | ') : (k.panelWert || '—')}</td>
                  <td style={s.td}>{k.excelWert || '—'}</td>
                  <td style={s.td}>{k.vorabhakenGesperrt && <Badge ton={theme.colors.warning}>Vorabhaken gesperrt</Badge>} <span style={s.muted}>{k.hinweis}</span></td>
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

export default function LvarExplorer({ lvar }) {
  const [reiter, setReiter] = useState('variablen');
  if (!lvar) return null;
  if (lvar.leer) return <div style={s.card}><div style={s.muted}>{lvar.grund}</div></div>;

  return (
    <div>
      <div style={s.tabs}>
        {REITER.map((r) => (
          <button key={r.id} style={{ ...s.tab, ...(reiter === r.id ? s.tabActive : {}) }} onClick={() => setReiter(r.id)}>{r.label}</button>
        ))}
      </div>
      {reiter === 'variablen' && <Variablen nk={lvar.nk} kopplung={lvar.kopplung} />}
      {reiter === 'steckbriefe' && <Steckbriefe steckbriefe={lvar.steckbriefe} />}
      {reiter === 'einbau' && <Einbau einbau={lvar.einbau} />}
      {reiter === 'cfg' && <Cfg cfg={lvar.cfg} pfad={lvar.pfad} />}
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
