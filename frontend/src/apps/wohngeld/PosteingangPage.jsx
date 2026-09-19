import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { ArrowLeftIcon } from '../../components/Icons';
import { ACCENT } from './api';

const styles = {
  page: { width: '100%' },
  header: { padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, borderBottom: `1px solid ${theme.colors.border}` },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.sm, color: ACCENT, cursor: 'pointer', marginBottom: theme.spacing.lg, border: 'none', background: 'none', padding: 0, fontWeight: theme.typography.weights.medium },
  title: { fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text },
  subtitle: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginTop: theme.spacing.xs, maxWidth: 720, lineHeight: 1.5 },
  split: { display: 'flex', gap: theme.spacing.lg, padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, alignItems: 'stretch', flexWrap: 'wrap' },
  pane: { flex: 1, minWidth: 300, backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.xl, padding: theme.spacing.xl, display: 'flex', flexDirection: 'column' },
  paneTitle: { fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginBottom: theme.spacing.md },
  placeholder: { flex: 1, minHeight: 280, border: `1px dashed ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: theme.spacing.xl, color: theme.colors.textMuted, gap: theme.spacing.sm },
  hint: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, lineHeight: 1.5, maxWidth: 320 },
  badge: { fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, padding: `${theme.spacing.xs} ${theme.spacing.md}`, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
};

function InboxGlyph() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textLight} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

/**
 * Posteingang — Split-View-Gerüst (Stammdaten links / Dateivorschau rechts).
 * Upload & automatische Extraktion sind in Vorbereitung; hier bewusst kein
 * simulierter Funktionsumfang, nur das saubere Zielbild der Oberfläche.
 */
export default function PosteingangPage() {
  const navigate = useNavigate();

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.backLink} onClick={() => navigate('/apps/wohngeld')}><ArrowLeftIcon /> Wohngeld</button>
        <h1 style={styles.title}>Posteingang</h1>
        <p style={styles.subtitle}>
          Eingehende Antragsunterlagen sichten, klassifizieren und einem Vorgang zuordnen.
          Der automatische Upload und die Extraktion der Stammdaten aus den Dokumenten werden derzeit vorbereitet.
        </p>
      </div>

      <div style={styles.split}>
        <div style={styles.pane}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
            <div style={styles.paneTitle}>Stammdaten des Antrags</div>
            <span style={styles.badge}>In Vorbereitung</span>
          </div>
          <div style={styles.placeholder}>
            <InboxGlyph />
            <div style={styles.hint}>
              Hier erscheinen die aus dem Antrag erkannten Stammdaten (antragstellende Person, Adresse, Wohngeldart)
              zur Kontrolle und Übernahme in einen Vorgang.
            </div>
          </div>
        </div>

        <div style={styles.pane}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
            <div style={styles.paneTitle}>Dateivorschau</div>
            <span style={styles.badge}>In Vorbereitung</span>
          </div>
          <div style={styles.placeholder}>
            <InboxGlyph />
            <div style={styles.hint}>
              Die Vorschau des hochgeladenen Dokuments erscheint hier — Seite für Seite, mit den markierten
              Fundstellen der extrahierten Werte.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
