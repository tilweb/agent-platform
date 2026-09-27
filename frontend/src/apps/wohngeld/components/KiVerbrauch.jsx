import { useEffect, useState } from 'react';
import { theme } from '../../../config/theme';
import { wohngeldApi } from '../api';

/**
 * KI-Verbrauch (Tokens) eines Vorgangs bzw. Posteingangs.
 * Spec: docs/wohngeld-token-verbrauch-spec-2026-09-27.md
 *
 * - `KiVerbrauchAnsicht` — voller Reiter: Kennzahlen, je Aktion, je Modell, Verlauf.
 * - `KiVerbrauchZeile`   — kompakte Summenzeile (Seitenleiste, Posteingang-Detail).
 */

const styles = {
  hinweis: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, lineHeight: 1.5, marginBottom: theme.spacing.lg },
  kacheln: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: theme.spacing.md, marginBottom: theme.spacing.xl },
  kachel: { border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, backgroundColor: theme.colors.surface },
  kachelLabel: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, fontWeight: theme.typography.weights.medium },
  kachelWert: { fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginTop: theme.spacing.xs, fontVariantNumeric: 'tabular-nums' },
  kachelSub: { fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, marginTop: 2 },
  abschnitt: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, margin: `${theme.spacing.lg} 0 ${theme.spacing.sm}` },
  tableWrap: { border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, overflowX: 'auto', backgroundColor: theme.colors.surface },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm },
  th: { textAlign: 'left', padding: `${theme.spacing.sm} ${theme.spacing.md}`, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, fontWeight: theme.typography.weights.semibold, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${theme.colors.border}`, whiteSpace: 'nowrap' },
  td: { padding: `${theme.spacing.sm} ${theme.spacing.md}`, color: theme.colors.text, borderBottom: `1px solid ${theme.colors.borderLight}`, whiteSpace: 'nowrap' },
  tdMuted: { padding: `${theme.spacing.sm} ${theme.spacing.md}`, color: theme.colors.textSecondary, borderBottom: `1px solid ${theme.colors.borderLight}` },
  summeZeile: { fontWeight: theme.typography.weights.semibold },
  phase: { display: 'inline-block', padding: `1px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full, fontSize: theme.typography.sizes.xs, backgroundColor: theme.colors.background, color: theme.colors.textSecondary, border: `1px solid ${theme.colors.border}` },
  leer: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted },
  fehler: { fontSize: theme.typography.sizes.sm, color: theme.colors.error },
  zeile: { fontSize: theme.typography.sizes.sm, color: theme.colors.text, lineHeight: 1.5 },
  zeileSub: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  link: { background: 'none', border: 'none', padding: 0, color: theme.colors.primary, cursor: 'pointer', fontSize: theme.typography.sizes.xs },
};

const num = (n) => (Number(n) || 0).toLocaleString('de-DE');
const rechts = (s) => ({ ...s, textAlign: 'right', fontVariantNumeric: 'tabular-nums' });

const PHASE_LABEL = { ersterfassung: 'Ersterfassung', bearbeitung: 'Bearbeitung' };

function fmtDateTime(iso) {
  if (!iso) return '–';
  try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
}

function fmtDauer(ms) {
  if (ms == null) return '–';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toLocaleString('de-DE', { maximumFractionDigits: 1 })} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}

function useKiVerbrauch({ vorgangId, posteingangId, reloadKey }) {
  const [daten, setDaten] = useState(null);
  const [fehler, setFehler] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const laden = vorgangId ? wohngeldApi.getKiVerbrauch(vorgangId) : wohngeldApi.getPosteingangKiVerbrauch(posteingangId);
    laden
      .then((d) => { if (!cancelled) { setDaten(d); setFehler(null); } })
      .catch((e) => { if (!cancelled) setFehler(e.message || 'Laden fehlgeschlagen'); });
    return () => { cancelled = true; };
  }, [vorgangId, posteingangId, reloadKey]);
  return { daten, fehler };
}

function Kachel({ label, summe, sub }) {
  return (
    <div style={styles.kachel}>
      <div style={styles.kachelLabel}>{label}</div>
      <div style={styles.kachelWert}>{num(summe.totalTokens)}</div>
      <div style={styles.kachelSub}>{sub ?? `${num(summe.aufrufe)} KI-Aufrufe`}</div>
    </div>
  );
}

function modelleText(modelle) {
  const namen = Object.keys(modelle || {});
  return namen.length ? namen.join(', ') : '–';
}

/** Voller Reiter „KI-Verbrauch" am Vorgang. */
export function KiVerbrauchAnsicht({ vorgangId, reloadKey }) {
  const { daten, fehler } = useKiVerbrauch({ vorgangId, reloadKey });
  if (fehler) return <div style={styles.fehler}>{fehler}</div>;
  if (!daten) return <div style={styles.leer}>Lädt …</div>;
  const { summe, jePhase, jeAktion, jeModell, eintraege } = daten;

  return (
    <div>
      <div style={styles.hinweis}>
        Tokens sind die Mengeneinheit, in der Sprachmodelle Text verarbeiten (Eingabe = gelesener Kontext, Ausgabe = erzeugter Text).
        „Ersterfassung" umfasst die Auswertung des Eingangs, aus dem dieser Antrag entstanden ist; „Bearbeitung" alles danach.
      </div>
      <div style={styles.kacheln}>
        <Kachel label="Tokens gesamt" summe={summe} sub={`${num(summe.promptTokens)} Eingabe · ${num(summe.completionTokens)} Ausgabe`} />
        <Kachel label="Ersterfassung" summe={jePhase.ersterfassung} />
        <Kachel label="Bearbeitung" summe={jePhase.bearbeitung} />
        <Kachel label="KI-Aufrufe" summe={{ totalTokens: summe.aufrufe }} sub={`in ${num(summe.anzahl)} Aktionen`} />
      </div>

      {summe.ohneAngabe > 0 && (
        <div style={{ ...styles.hinweis, color: theme.colors.textSecondary }}>
          Bei {num(summe.ohneAngabe)} Aufruf{summe.ohneAngabe === 1 ? '' : 'en'} hat der KI-Anbieter keine Token-Zahlen gemeldet — die Summen sind dort unvollständig.
        </div>
      )}

      {eintraege.length === 0 ? (
        <div style={styles.leer}>Für diesen Antrag wurde noch keine KI-Verarbeitung gemessen.</div>
      ) : (
        <>
          <div style={styles.abschnitt}>Nach Aktion</div>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Aktion</th>
                  <th style={rechts(styles.th)}>Anzahl</th>
                  <th style={rechts(styles.th)}>Aufrufe</th>
                  <th style={rechts(styles.th)}>Eingabe</th>
                  <th style={rechts(styles.th)}>Ausgabe</th>
                  <th style={rechts(styles.th)}>Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {jeAktion.map((a) => (
                  <tr key={a.aktion}>
                    <td style={styles.td}>{a.label}</td>
                    <td style={rechts(styles.td)}>{num(a.anzahl)}</td>
                    <td style={rechts(styles.td)}>{num(a.aufrufe)}</td>
                    <td style={rechts(styles.td)}>{num(a.promptTokens)}</td>
                    <td style={rechts(styles.td)}>{num(a.completionTokens)}</td>
                    <td style={rechts(styles.td)}>{num(a.totalTokens)}</td>
                  </tr>
                ))}
                <tr style={styles.summeZeile}>
                  <td style={styles.td}>Summe</td>
                  <td style={rechts(styles.td)}>{num(summe.anzahl)}</td>
                  <td style={rechts(styles.td)}>{num(summe.aufrufe)}</td>
                  <td style={rechts(styles.td)}>{num(summe.promptTokens)}</td>
                  <td style={rechts(styles.td)}>{num(summe.completionTokens)}</td>
                  <td style={rechts(styles.td)}>{num(summe.totalTokens)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {jeModell.length > 1 && (
            <>
              <div style={styles.abschnitt}>Nach Modell</div>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Modell</th>
                      <th style={rechts(styles.th)}>Aufrufe</th>
                      <th style={rechts(styles.th)}>Eingabe</th>
                      <th style={rechts(styles.th)}>Ausgabe</th>
                      <th style={rechts(styles.th)}>Gesamt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jeModell.map((m) => (
                      <tr key={m.modell}>
                        <td style={styles.td}>{m.modell}</td>
                        <td style={rechts(styles.td)}>{num(m.aufrufe)}</td>
                        <td style={rechts(styles.td)}>{num(m.promptTokens)}</td>
                        <td style={rechts(styles.td)}>{num(m.completionTokens)}</td>
                        <td style={rechts(styles.td)}>{num(m.totalTokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div style={styles.abschnitt}>Verlauf</div>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Zeitpunkt</th>
                  <th style={styles.th}>Aktion</th>
                  <th style={styles.th}>Phase</th>
                  <th style={rechts(styles.th)}>Aufrufe</th>
                  <th style={rechts(styles.th)}>Eingabe</th>
                  <th style={rechts(styles.th)}>Ausgabe</th>
                  <th style={rechts(styles.th)}>Gesamt</th>
                  <th style={rechts(styles.th)}>Dauer</th>
                  <th style={styles.th}>Modell</th>
                </tr>
              </thead>
              <tbody>
                {eintraege.map((e) => (
                  <tr key={e.id}>
                    <td style={styles.td}>{fmtDateTime(e.zeitpunkt)}</td>
                    <td style={styles.tdMuted}>
                      <div style={{ color: theme.colors.text }}>{e.label}</div>
                      {e.detail && <div style={styles.zeileSub}>{e.detail}</div>}
                    </td>
                    <td style={styles.td}><span style={styles.phase}>{PHASE_LABEL[e.phase] || e.phase}</span></td>
                    <td style={rechts(styles.td)}>{num(e.aufrufe)}{e.ohneAngabe > 0 ? ` (${num(e.ohneAngabe)} o. A.)` : ''}</td>
                    <td style={rechts(styles.td)}>{num(e.promptTokens)}</td>
                    <td style={rechts(styles.td)}>{num(e.completionTokens)}</td>
                    <td style={rechts(styles.td)}>{num(e.totalTokens)}</td>
                    <td style={rechts(styles.td)}>{fmtDauer(e.dauerMs)}</td>
                    <td style={styles.tdMuted}>{modelleText(e.modelle)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Kompakte Summenzeile. `vorgangId` ODER `posteingangId`; `onDetails` blendet einen
 * Sprung-Link ein (z. B. in den Reiter „KI-Verbrauch").
 */
export function KiVerbrauchZeile({ vorgangId, posteingangId, reloadKey, onDetails, leerText }) {
  const { daten, fehler } = useKiVerbrauch({ vorgangId, posteingangId, reloadKey });
  if (fehler || !daten) return null;
  const { summe, jePhase } = daten;
  if (summe.anzahl === 0) return leerText ? <div style={styles.zeileSub}>{leerText}</div> : null;
  return (
    <div style={styles.zeile}>
      <div>
        <strong>{num(summe.totalTokens)}</strong> Tokens in {num(summe.aufrufe)} KI-Aufruf{summe.aufrufe === 1 ? '' : 'en'}
      </div>
      {vorgangId && (
        <div style={styles.zeileSub}>
          Ersterfassung {num(jePhase.ersterfassung.totalTokens)} · Bearbeitung {num(jePhase.bearbeitung.totalTokens)}
        </div>
      )}
      {!vorgangId && (
        <div style={styles.zeileSub}>{num(summe.promptTokens)} Eingabe · {num(summe.completionTokens)} Ausgabe · {num(summe.anzahl)} Auswertung{summe.anzahl === 1 ? '' : 'en'}</div>
      )}
      {onDetails && <button style={styles.link} onClick={onDetails}>Aufschlüsselung anzeigen</button>}
    </div>
  );
}
