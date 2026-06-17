import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { SparklesIcon } from '../../components/Icons';
import { apiGet } from '../../utils/apiFetch';

const STATUS_LABELS = {
  uploaded: { label: 'Hochgeladen', color: theme.colors.textMuted, bg: theme.colors.surfaceHover },
  extracting_audio: { label: 'Audio extrahieren…', color: theme.colors.warning, bg: theme.colors.warningLight },
  transcribing: { label: 'Transkribieren…', color: theme.colors.warning, bg: theme.colors.warningLight },
  generating: { label: 'Generieren…', color: theme.colors.warning, bg: theme.colors.warningLight },
  done: { label: 'Fertig', color: theme.colors.success, bg: theme.colors.successLight },
  failed: { label: 'Fehler', color: theme.colors.error, bg: theme.colors.errorLight },
};

const styles = {
  container: { height: '100%', overflow: 'auto', backgroundColor: theme.colors.background },
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  subtitle: { fontSize: theme.typography.sizes.base, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  headerActions: { display: 'flex', gap: theme.spacing.md },
  btn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  btnPrimary: { backgroundColor: theme.colors.primary, color: '#fff', border: 'none' },
  body: { padding: theme.spacing['2xl'], maxWidth: '900px' },
  list: { display: 'flex', flexDirection: 'column', gap: theme.spacing.sm },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.lg,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
    cursor: 'pointer',
  },
  cardTitle: { fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.medium, color: theme.colors.text },
  cardMeta: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: '2px' },
  badge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
    whiteSpace: 'nowrap',
  },
  empty: { padding: theme.spacing['2xl'], color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm, textAlign: 'center' },
};

export default function EpisodesListPage() {
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet('/apps/podcast-repurposing/episodes');
        const data = await res.json();
        setEpisodes(data.episodes || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}><SparklesIcon size={24} color={theme.colors.primary} /> Podcast-Repurposing</h1>
          <p style={styles.subtitle}>Aus einem Podcast-Video automatisch Social-Posts, Blog, Mail & Visuals erzeugen.</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.btn} onClick={() => navigate('/apps/podcast-repurposing/settings')}>Einstellungen</button>
          <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => navigate('/apps/podcast-repurposing/upload')}>Neue Episode</button>
        </div>
      </div>

      <div style={styles.body}>
        {loading ? (
          <div style={styles.empty}>Lädt…</div>
        ) : episodes.length === 0 ? (
          <div style={styles.empty}>Noch keine Episoden. Lade ein Podcast-Video hoch, um zu starten.</div>
        ) : (
          <div style={styles.list}>
            {episodes.map((ep) => {
              const s = STATUS_LABELS[ep.status] || STATUS_LABELS.uploaded;
              return (
                <div key={ep.id} style={styles.card} onClick={() => navigate(`/apps/podcast-repurposing/${ep.id}`)}>
                  <div>
                    <div style={styles.cardTitle}>{ep.title}</div>
                    <div style={styles.cardMeta}>{new Date(ep.createdAt).toLocaleString('de-DE')}</div>
                  </div>
                  <span style={{ ...styles.badge, color: s.color, backgroundColor: s.bg }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
