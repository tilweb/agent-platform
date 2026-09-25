import { theme } from '../../../config/theme';
import { PRUEF_STATUS_LABEL } from '../api';

/**
 * Extraktions-Transparenz als Verzeichnisbaum: je Gruppe ein Knoten, darunter die
 * gezogenen Werte als Blätter (durchgehende vertikale Linie + horizontale Abzweigung
 * je Blatt). Rechts je Blatt die Seitenzahl und NUR echte Warnsignale in Klartext:
 * „uneinheitlich gelesen" (Stellen im Dokument lieferten verschiedene Werte), „ohne Beleg",
 * „nicht gefunden" (Pflichtangabe des Antrags fehlt) und offene Prüfhinweise am Feld.
 * Keine Prozentwerte: Die Extraktion liefert ohne Modellbewertung nur eine Standardzahl
 * (70 %), die für die Sachbearbeitung keine Information trägt.
 *
 * Quelle: `extraktion` (Dokument.extraktion) — sonst Fallback aus `analyseFallback`
 * (Dokument.analyse), damit auch Seed-/Bestandsdokumente Werte zeigen. Optionaler
 * zweiter Ast „Ausgelöste Hinweise" listet die referenzierenden Prüfschritte.
 */

// ── Fallback-Formatierung (Analyse → Label/Wert) ────────────────────────────
const ANALYSE_LABEL = {
  miete: 'Miete laut Dokument',
  wohnflaeche_qm: 'Wohnfläche laut Dokument',
  unterschrift_vorhanden: 'Unterschrift',
  datum_vorhanden: 'Datum',
  rentenart_vorhanden: 'Rentenart',
  grundrentenzeiten_vorhanden: 'Grundrentenzeiten',
  mietzahlung_erkannt: 'Mietzahlung erkannt',
  erkannte_einkuenfte: 'Erkannte Einkünfte',
  betrag: 'Betrag',
};
const EINKUNFTSART_LABEL = { kapitalertraege: 'Kapitalerträge', v_und_v: 'Vermietung/Verpachtung' };
const VORHANDEN_FELDER = new Set(['unterschrift_vorhanden', 'datum_vorhanden', 'rentenart_vorhanden', 'grundrentenzeiten_vorhanden']);
const EURO_FELDER = new Set(['miete', 'betrag']);

function fmtEuro(v) {
  if (v == null || Number.isNaN(v)) return null;
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
function analyseWert(feld, v) {
  if (v == null) return null;
  if (EURO_FELDER.has(feld)) return fmtEuro(v);
  if (feld === 'wohnflaeche_qm') return `${v.toLocaleString('de-DE')} m²`;
  if (feld === 'erkannte_einkuenfte') return Array.isArray(v) && v.length ? v.map((x) => EINKUNFTSART_LABEL[x] ?? x).join(', ') : null;
  if (VORHANDEN_FELDER.has(feld)) return v === true ? 'vorhanden' : v === false ? 'fehlt' : null;
  if (feld === 'mietzahlung_erkannt') return v === true ? 'ja' : v === false ? 'nein' : null;
  return String(v);
}

/** Aus Dokument.analyse eine felder-Liste (Gruppe „Analyse") ableiten. */
function felderAusAnalyse(analyse) {
  if (!analyse) return [];
  const felder = [];
  for (const [feld, label] of Object.entries(ANALYSE_LABEL)) {
    const wert = analyseWert(feld, analyse[feld]);
    if (wert != null && wert !== '') felder.push({ gruppe: 'Analyse', label, wert });
  }
  return felder;
}

/** Felder in Gruppen (Insertion-Order erhalten). */
function gruppiere(felder) {
  const map = new Map();
  for (const f of felder) {
    const g = f.gruppe || 'Werte';
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(f);
  }
  return [...map.entries()];
}

const styles = {
  wrap: { fontSize: theme.typography.sizes.xs },
  group: { marginBottom: theme.spacing.sm },
  groupTitle: { fontSize: '0.7rem', fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 },
  // durchgehende vertikale Linie links (neutral, strukturell)
  branch: { borderLeft: `1px solid ${theme.colors.border}`, marginLeft: 4 },
  leaf: { position: 'relative', paddingLeft: 14, paddingTop: 3, paddingBottom: 3, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing.sm },
  // horizontale Abzweigung je Blatt
  connector: { position: 'absolute', left: 0, top: '50%', width: 10, height: 1, backgroundColor: theme.colors.border },
  leafLeft: { display: 'flex', alignItems: 'baseline', gap: theme.spacing.xs, minWidth: 0, flex: 1 },
  leafLabel: { color: theme.colors.textMuted, flexShrink: 0 },
  leafValue: { color: theme.colors.text, fontWeight: theme.typography.weights.medium, wordBreak: 'break-word' },
  leafMeta: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, flexShrink: 0 },
  warn: { fontSize: '0.65rem', fontWeight: theme.typography.weights.semibold, padding: `0 ${theme.spacing.xs}`, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.warningLight, color: theme.colors.warning, whiteSpace: 'nowrap', cursor: 'help' },
  seite: { color: theme.colors.textMuted },
  hinweisTitle: { fontSize: '0.7rem', fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: theme.spacing.sm, marginBottom: 2 },
  hinweisRow: { position: 'relative', paddingLeft: 14, paddingTop: 3, paddingBottom: 3, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing.sm },
  hinweisText: { color: theme.colors.text, wordBreak: 'break-word' },
  statusBadge: { fontSize: '0.65rem', fontWeight: theme.typography.weights.medium, padding: `0 ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full, flexShrink: 0, whiteSpace: 'nowrap' },
  empty: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
};

function statusTone(status) {
  if (status === 'erledigt') return { backgroundColor: theme.colors.successLight, color: theme.colors.success };
  if (status === 'verworfen') return { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted };
  return { backgroundColor: theme.colors.warningLight, color: theme.colors.warning }; // offen
}

/** Pflichtangaben des Antrags je Gruppe (Label wie im Extraktions-Baum). */
const ANTRAG_PFLICHT = {
  Antragsteller: ['Vorname', 'Nachname', 'Geburtsdatum'],
  Adresse: ['Straße', 'Hausnummer', 'PLZ', 'Ort'],
  Wohnung: ['Bruttokaltmiete', 'Wohnfläche'],
  Antrag: ['Antragsdatum'],
};

/** Offene Prüfhinweise → betroffenes Feld (Label im Baum). */
const REGEL_ZU_FELD = {
  'plausi-miethoehe-abweichung': ['Miete laut Dokument', 'Bruttokaltmiete'],
  'plausi-wohnflaeche-abweichung': ['Wohnfläche laut Dokument', 'Wohnfläche'],
  'plausi-mietvertrag-unsigniert': ['Unterschrift'],
  'plausi-antrag-ohne-unterschrift': ['Unterschrift'],
  'plausi-antrag-ohne-datum': ['Datum'],
  'plausi-mietzahlung-fehlt': ['Mietzahlung erkannt'],
  'plausi-rentenart-fehlt': ['Rentenart'],
};
const regelBasis = (id) => String(id || '').split(':')[0];

/**
 * Warnsignal eines Feldes (oder nichts). Die Konfidenz der Extraktion ist ohne Modellbewertung
 * eine Standardzahl — sie wird nur als Signal genutzt, wenn sie einen Widerspruch anzeigt.
 */
function WarnMark({ feld, hinweise }) {
  const h = hinweise.find((x) => x.status === 'offen' && (REGEL_ZU_FELD[regelBasis(x.regelId)] || []).includes(feld.label));
  if (h) return <span style={styles.warn} title={h.titel}>Prüfhinweis</span>;
  if (feld.fehlt) return <span style={styles.warn} title="Diese Pflichtangabe wurde im Antrag nicht gefunden.">nicht gefunden</span>;
  const c = feld.confidence;
  if (c === 0) return <span style={styles.warn} title="Der Wert konnte keiner Stelle im Dokument zugeordnet werden — bitte mit der Vorschau abgleichen.">ohne Beleg</span>;
  if (typeof c === 'number' && c < 0.65) {
    return <span style={styles.warn} title="Verschiedene Stellen des Dokuments lieferten unterschiedliche Werte — bitte mit der Vorschau abgleichen.">uneinheitlich gelesen</span>;
  }
  return null;
}

/** Beim Antrag fehlende Pflichtangaben als Blätter „—" ergänzen. */
function mitFehlendenPflichtangaben(felder) {
  const istAntrag = felder.some((f) => f.gruppe === 'Antragsteller' || f.gruppe === 'Adresse');
  if (!istAntrag) return felder;
  const out = [...felder];
  for (const [gruppe, labels] of Object.entries(ANTRAG_PFLICHT)) {
    for (const label of labels) {
      if (!felder.some((f) => f.gruppe === gruppe && f.label === label)) out.push({ gruppe, label, wert: '—', fehlt: true });
    }
  }
  // Gruppenreihenfolge der Pflichtangaben beibehalten.
  const reihenfolge = [...Object.keys(ANTRAG_PFLICHT), ...new Set(felder.map((f) => f.gruppe || 'Werte'))];
  return out.sort((a, b) => reihenfolge.indexOf(a.gruppe || 'Werte') - reihenfolge.indexOf(b.gruppe || 'Werte'));
}

export default function ExtraktionsBaum({ extraktion, analyseFallback, hinweise }) {
  const felder = (extraktion?.felder && extraktion.felder.length)
    ? extraktion.felder
    : felderAusAnalyse(analyseFallback);
  const gruppen = gruppiere(mitFehlendenPflichtangaben(felder));
  const hinweisListe = Array.isArray(hinweise) ? hinweise : [];

  if (!gruppen.length && !hinweisListe.length) {
    return <div style={styles.empty}>Keine extrahierten Werte vorhanden.</div>;
  }

  return (
    <div style={styles.wrap}>
      {gruppen.map(([gruppe, leaves]) => (
        <div key={gruppe} style={styles.group}>
          <div style={styles.groupTitle}>{gruppe}</div>
          <div style={styles.branch}>
            {leaves.map((f, i) => (
              <div key={`${f.label}-${i}`} style={styles.leaf}>
                <span style={styles.connector} />
                <span style={styles.leafLeft}>
                  <span style={styles.leafLabel}>{f.label}</span>
                  <span style={styles.leafValue}>{f.wert}</span>
                </span>
                <span style={styles.leafMeta}>
                  {f.seite != null && <span style={styles.seite}>S. {f.seite}</span>}
                  <WarnMark feld={f} hinweise={hinweisListe} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {hinweisListe.length > 0 && (
        <div style={styles.group}>
          <div style={styles.hinweisTitle}>Ausgelöste Hinweise</div>
          <div style={styles.branch}>
            {hinweisListe.map((h) => (
              <div key={h.id} style={styles.hinweisRow}>
                <span style={styles.connector} />
                <span style={styles.hinweisText}>{h.titel}</span>
                <span style={{ ...styles.statusBadge, ...statusTone(h.status) }}>{PRUEF_STATUS_LABEL[h.status] || h.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
