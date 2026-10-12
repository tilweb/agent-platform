import { useEffect, useRef, useState } from 'react';
import { theme } from '../config/theme';
import { ChevronDownIcon, DownloadIcon, TableIcon } from './Icons';

/**
 * Export eines Verarbeitungslaufs (Document Processing): Dateiformate, Workplace-Tabelle und der
 * Diagnose-Schalter in einem Menü. Jeder Punkt mit einer Zeile, die erklärt, was genau herauskommt.
 */

const DATEIEN = [
  { id: 'xlsx', titel: 'Excel', unter: 'Ein Blatt mit einer Zeile je Dokument, dazu ein eigenes Blatt je Liste (z. B. Positionen).' },
  { id: 'xlsx_wide', titel: 'Excel breit', unter: 'Eine Zeile je Dokument. Listen werden zu nummerierten Spalten (Position 1, Position 2 …).' },
  { id: 'xlsx_flat', titel: 'Excel flach', unter: 'Eine Zeile je Listen-Position, die Dokumentdaten stehen in jeder Zeile — gut für Filter und Pivot.' },
  { id: 'csv_wide', titel: 'CSV breit', unter: 'Wie „Excel breit", als CSV für den Import in andere Systeme.' },
  { id: 'csv', titel: 'CSV einfach', unter: 'Eine Zeile je Dokument mit Prüfstatus und Befunden; Listen stehen als Text in einer Zelle.' },
  { id: 'json', titel: 'JSON', unter: 'Rohdaten je Dokument inkl. Prüfstatus und Befunden — für Entwickler und Schnittstellen.' },
];

const styles = {
  container: { position: 'relative', display: 'inline-block' },
  button: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: 'transparent', color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
  },
  menu: {
    position: 'absolute', top: 'calc(100% + 4px)', right: 0, width: 380, maxWidth: '90vw', backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, boxShadow: theme.shadows.lg, zIndex: 100,
    padding: `${theme.spacing.sm} 0`, maxHeight: '70vh', overflowY: 'auto',
  },
  gruppe: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg} ${theme.spacing.xs}`, fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  eintrag: {
    display: 'flex', flexDirection: 'column', gap: 2, width: '100%', padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    border: 'none', backgroundColor: 'transparent', textAlign: 'left', cursor: 'pointer', color: theme.colors.text,
  },
  titel: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, display: 'flex', alignItems: 'center', gap: theme.spacing.sm },
  unter: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, lineHeight: 1.4 },
  trenner: { height: 1, backgroundColor: theme.colors.border, margin: `${theme.spacing.sm} 0` },
  schalter: { display: 'flex', gap: theme.spacing.sm, alignItems: 'flex-start', padding: `${theme.spacing.sm} ${theme.spacing.lg}`, cursor: 'pointer' },
};

export default function LaufExportMenu({ onExport, onTabelle, diagnose, onDiagnose, ladeFormat = null, tabelleLaedt = false }) {
  const [offen, setOffen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!offen) return;
    const klick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOffen(false); };
    const taste = (e) => { if (e.key === 'Escape') setOffen(false); };
    document.addEventListener('mousedown', klick);
    document.addEventListener('keydown', taste);
    return () => { document.removeEventListener('mousedown', klick); document.removeEventListener('keydown', taste); };
  }, [offen]);

  const beschaeftigt = !!ladeFormat || tabelleLaedt;
  const hover = (an) => (e) => { e.currentTarget.style.backgroundColor = an ? theme.colors.surfaceHover : 'transparent'; };

  return (
    <div ref={ref} style={styles.container}>
      <button type="button" style={{ ...styles.button, ...(beschaeftigt ? { opacity: 0.6 } : {}) }} onClick={() => setOffen((v) => !v)}
        onMouseEnter={hover(true)} onMouseLeave={hover(false)}>
        <DownloadIcon size={16} /> {beschaeftigt ? 'Exportiere …' : 'Export'} <ChevronDownIcon size={16} style={{ marginLeft: 2 }} />
      </button>
      {offen && (
        <div style={styles.menu} role="menu">
          <label style={styles.schalter}>
            <input type="checkbox" checked={diagnose} onChange={(e) => onDiagnose(e.target.checked)} style={{ marginTop: 3 }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={styles.titel}>Auch ungeprüfte Ergebnisse (Diagnose)</span>
              <span style={styles.unter}>
                Standard: nur freigegebene Dokumente. Mit Diagnose enthalten die Dateien alle Dokumente samt Prüfstatus — zum
                Analysieren, nicht zur Weiterverarbeitung. Gilt nicht für die Workplace-Tabelle.
              </span>
            </span>
          </label>
          <div style={styles.trenner} />
          <div style={styles.gruppe}>Datei herunterladen</div>
          {DATEIEN.map((d) => (
            <button key={d.id} type="button" role="menuitem" style={styles.eintrag} disabled={beschaeftigt}
              onMouseEnter={hover(true)} onMouseLeave={hover(false)}
              onClick={() => { setOffen(false); onExport(d.id); }}>
              <span style={styles.titel}>{d.titel}{ladeFormat === d.id && <span style={styles.unter}>wird erstellt …</span>}</span>
              <span style={styles.unter}>{d.unter}</span>
            </button>
          ))}
          <div style={styles.trenner} />
          <div style={styles.gruppe}>Im Workplace</div>
          <button type="button" role="menuitem" style={styles.eintrag} disabled={beschaeftigt}
            onMouseEnter={hover(true)} onMouseLeave={hover(false)}
            onClick={() => { setOffen(false); onTabelle(); }}>
            <span style={styles.titel}><TableIcon size={14} /> In Tabelle schreiben</span>
            <span style={styles.unter}>
              Legt unter „Tabellen" im Workplace eine neue Tabelle an — eine Zeile je freigegebenem Dokument. Jeder Klick
              erzeugt eine eigene Tabelle.
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
