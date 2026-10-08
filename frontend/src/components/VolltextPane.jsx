import { useState } from 'react';
import { theme } from '../config/theme';

/**
 * Volltext (Basisprofil „Allgemein", Strategie `general-document`) im Prüfdialog:
 * Transkript je Seite mit Suche; ein Klick auf die Seitenzeile springt zur Seite.
 */

const ROLLE = {
  vertragstext: 'Text', deckblatt: 'Deckblatt', unterschriften: 'Unterschriften', anlage: 'Anlage', mandat: 'Mandat',
  muster: 'Muster', vorlage: 'Vorlage', datenblatt: 'Datenblatt', sonstiges: 'Sonstiges', leer: 'leer',
};

const styles = {
  suche: {
    width: '100%', padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none', marginBottom: theme.spacing.sm,
  },
  seite: { borderBottom: `1px solid ${theme.colors.border}`, padding: `${theme.spacing.sm} 0` },
  kopf: { display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text },
  text: {
    marginTop: theme.spacing.xs, padding: theme.spacing.md, backgroundColor: theme.colors.background, border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, whiteSpace: 'pre-wrap', color: theme.colors.text, maxHeight: 360, overflow: 'auto',
  },
  hinweis: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
};

export default function VolltextPane({ volltext, onJumpToPage }) {
  const [offen, setOffen] = useState(volltext?.seiten?.[0]?.seite ?? null);
  const [suche, setSuche] = useState('');
  if (!volltext?.seiten?.length) return null;
  const q = suche.trim().toLowerCase();
  const seiten = volltext.seiten.filter((s) => !q || s.text.toLowerCase().includes(q));
  return (
    <div style={{ marginBottom: theme.spacing.lg }}>
      <div style={{ ...styles.hinweis, marginBottom: theme.spacing.sm }}>Volltext je Seite (aus dem Seitenbild gelesen)</div>
      <input style={styles.suche} placeholder="Im Volltext suchen …" value={suche} onChange={(e) => setSuche(e.target.value)} />
      {seiten.map((s) => (
        <div key={s.seite} style={styles.seite}>
          <div style={styles.kopf} onClick={() => { setOffen(offen === s.seite ? null : s.seite); onJumpToPage?.(s.seite); }}>
            <span>Seite {s.seite}</span>
            <span style={styles.hinweis}>{s.fehler ? `nicht lesbar: ${s.fehler}` : ROLLE[s.rolle] ?? s.rolle}</span>
          </div>
          {(offen === s.seite || q) && <div style={styles.text}>{s.text || '(kein Text)'}</div>}
        </div>
      ))}
      {seiten.length === 0 && <div style={styles.hinweis}>Kein Treffer.</div>}
    </div>
  );
}
