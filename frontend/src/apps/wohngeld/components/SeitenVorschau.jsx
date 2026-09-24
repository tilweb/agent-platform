import { useEffect, useState } from 'react';
import { theme } from '../../../config/theme';
import { RefreshIcon } from '../../../components/Icons';

/**
 * Seitenvorschau als Bilder (vom Server gerendert). Funktioniert ohne Browser-PDF-Viewer und
 * unabhängig von der Content-Security-Policy der Instanz.
 * `ladeInfo()` → { art: 'pdf'|'bild'|'keine', seiten }, `seiteUrl(n)` → Bild-URL der Seite n.
 */
export default function SeitenVorschau({ schluessel, ladeInfo, seiteUrl, titel, hoehe = 'min(72vh, 900px)' }) {
  const [info, setInfo] = useState(null); // { schluessel, art, seiten } | { schluessel, fehler }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await ladeInfo();
        if (!cancelled) setInfo({ schluessel, ...r });
      } catch (e) {
        if (!cancelled) setInfo({ schluessel, fehler: e.message || 'Vorschau nicht verfügbar' });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `schluessel` identifiziert die Datei
  }, [schluessel]);

  const aktuell = info && info.schluessel === schluessel ? info : null;
  if (!aktuell) return <div style={{ ...styles.rahmen, ...styles.mitte, height: hoehe }}><RefreshIcon size={18} /><span>Vorschau wird geladen …</span></div>;
  if (aktuell.fehler) return <div style={{ ...styles.rahmen, ...styles.mitte, height: hoehe }}>Vorschau nicht verfügbar: {aktuell.fehler}</div>;
  if (aktuell.art === 'keine' || !aktuell.seiten) {
    return <div style={{ ...styles.rahmen, ...styles.mitte, height: hoehe }}>Für diesen Dateityp gibt es keine Vorschau — bitte „In neuem Tab" öffnen.</div>;
  }
  return (
    <div style={{ ...styles.rahmen, height: hoehe }}>
      {Array.from({ length: aktuell.seiten }, (_, i) => i + 1).map((n) => (
        <figure key={n} style={styles.seite}>
          <img src={seiteUrl(n)} alt={`${titel || 'Dokument'} – Seite ${n}`} loading={n <= 2 ? 'eager' : 'lazy'} style={styles.bild} />
          {aktuell.seiten > 1 && <figcaption style={styles.nummer}>Seite {n} von {aktuell.seiten}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

const styles = {
  rahmen: { overflowY: 'auto', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surfaceHover, padding: theme.spacing.sm, display: 'flex', flexDirection: 'column', gap: theme.spacing.sm },
  mitte: { alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm, textAlign: 'center' },
  seite: { margin: 0, display: 'grid', gap: 4 },
  bild: { width: '100%', height: 'auto', display: 'block', backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.sm },
  nummer: { fontSize: '0.7rem', color: theme.colors.textMuted, textAlign: 'center' },
};
