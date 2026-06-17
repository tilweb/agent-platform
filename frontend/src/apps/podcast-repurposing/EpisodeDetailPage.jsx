import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { theme } from '../../config/theme';
import { ArrowLeftIcon } from '../../components/Icons';
import { apiGet, apiFetch } from '../../utils/apiFetch';
import OutputCard from './components/OutputCard';
import VisualCard from './components/VisualCard';

const PLATFORM_LABEL = { facebook: 'Facebook', linkedin: 'LinkedIn', tiktok: 'TikTok', instagram: 'Instagram' };
const VISUAL_LABEL = { youtube_thumbnail: 'YouTube-Thumbnail', quote_card: 'Zitat-Karte', vertical_story: 'Vertical Story' };
const STEP_COLOR = {
  pending: theme.colors.textMuted,
  running: theme.colors.warning,
  done: theme.colors.success,
  failed: theme.colors.error,
};
const PUB_STATUS = {
  pending: { label: 'Wartet', color: theme.colors.textMuted, bg: theme.colors.surfaceHover },
  processing: { label: 'Läuft…', color: theme.colors.warning, bg: theme.colors.warningLight },
  draft: { label: 'Entwurf (Review)', color: theme.colors.primary, bg: theme.colors.primaryLight },
  published: { label: 'Veröffentlicht', color: theme.colors.success, bg: theme.colors.successLight },
  failed: { label: 'Fehler', color: theme.colors.error, bg: theme.colors.errorLight },
};

const styles = {
  container: { height: '100%', overflow: 'auto', backgroundColor: theme.colors.background },
  header: { padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, borderBottom: `1px solid ${theme.colors.border}` },
  back: {
    display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary, cursor: 'pointer', border: 'none', background: 'none', padding: 0,
    marginBottom: theme.spacing.lg, fontWeight: theme.typography.weights.medium,
  },
  title: { fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text },
  body: { padding: theme.spacing['2xl'], maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: theme.spacing['2xl'] },
  steps: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing.lg },
  step: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, fontSize: theme.typography.sizes.sm, color: theme.colors.text },
  dot: { width: 10, height: 10, borderRadius: '50%' },
  sectionTitle: { fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginBottom: theme.spacing.md },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: theme.spacing.lg },
  visualsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: theme.spacing.lg },
  transcript: {
    backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, whiteSpace: 'pre-wrap',
    maxHeight: '220px', overflow: 'auto', lineHeight: 1.5,
  },
  errorBox: { color: theme.colors.error, backgroundColor: theme.colors.errorLight, padding: theme.spacing.lg, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm },
  pubRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.sm },
  pubBadge: { fontSize: theme.typography.sizes.xs, padding: `2px ${theme.spacing.md}`, borderRadius: theme.borderRadius.full, fontWeight: theme.typography.weights.medium },
  publishBtn: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: theme.colors.primary, color: '#fff', border: 'none', borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer' },
  empty: { padding: theme.spacing['2xl'], color: theme.colors.textMuted, textAlign: 'center' },
};

function outputLabel(o) {
  if (o.kind === 'social') return (PLATFORM_LABEL[o.platform] || o.platform) + (o.variant > 0 ? ` (Variante ${o.variant + 1})` : '');
  if (o.kind === 'blog') return 'Blogpost';
  if (o.kind === 'email') return 'Danke-Mail';
  return o.formatId;
}

export default function EpisodeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const timer = useRef(null);

  const fetchDetail = async () => {
    const res = await apiGet(`/apps/podcast-repurposing/episodes/${id}`);
    if (res.ok) {
      const data = await res.json();
      setDetail(data);
      return data.episode.status;
    }
    return null;
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const status = await fetchDetail();
      if (active) setLoading(false);
      if (status && status !== 'done' && status !== 'failed') {
        timer.current = setInterval(async () => {
          const s = await fetchDetail();
          if (s === 'done' || s === 'failed') clearInterval(timer.current);
        }, 2000);
      }
    })();
    return () => { active = false; if (timer.current) clearInterval(timer.current); };
  }, [id]);

  const replaceOutput = (o) => setDetail((d) => ({ ...d, outputs: d.outputs.map((x) => (x.id === o.id ? o : x)) }));
  const replaceVisual = (v) => setDetail((d) => ({ ...d, visuals: d.visuals.map((x) => (x.id === v.id ? v : x)) }));

  const publishPodigee = async () => {
    setPublishing(true);
    setPublishError('');
    try {
      const res = await apiFetch(`/apps/podcast-repurposing/episodes/${id}/publish/podigee`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setPublishError(data.error || 'Veröffentlichung fehlgeschlagen.');
      await fetchDetail();
    } catch (e) {
      setPublishError(String(e?.message || e));
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return <div style={styles.container}><div style={styles.empty}>Lädt…</div></div>;
  if (!detail) return <div style={styles.container}><div style={styles.empty}>Episode nicht gefunden.</div></div>;

  const { episode, outputs, visuals } = detail;
  const publications = detail.publications || [];
  const steps = Array.isArray(episode.pipelineSteps) ? episode.pipelineSteps : [];
  const social = outputs.filter((o) => o.kind === 'social');
  const blog = outputs.filter((o) => o.kind === 'blog');
  const email = outputs.filter((o) => o.kind === 'email');

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.back} onClick={() => navigate('/apps/podcast-repurposing')}><ArrowLeftIcon /> Podcast-Repurposing</button>
        <h1 style={styles.title}>{episode.title}</h1>
      </div>

      <div style={styles.body}>
        {/* Pipeline-Fortschritt */}
        <div style={styles.steps}>
          {steps.map((s) => (
            <div key={s.id} style={styles.step}>
              <span style={{ ...styles.dot, backgroundColor: STEP_COLOR[s.status] || theme.colors.textMuted }} />
              {s.name}{s.status === 'running' ? '…' : ''}
            </div>
          ))}
        </div>

        {episode.status === 'failed' && <div style={styles.errorBox}>Fehler: {episode.error}</div>}

        {/* Transkript */}
        {episode.transcript && (
          <div>
            <div style={styles.sectionTitle}>
              Transkript{' '}
              <button style={{ ...styles.back, marginBottom: 0, display: 'inline' }} onClick={() => setShowTranscript((v) => !v)}>
                {showTranscript ? 'ausblenden' : 'anzeigen'}
              </button>
            </div>
            {showTranscript && <div style={styles.transcript}>{episode.transcript}</div>}
          </div>
        )}

        {/* Social */}
        {social.length > 0 && (
          <div>
            <div style={styles.sectionTitle}>Social-Posts</div>
            <div style={styles.grid}>
              {social.map((o) => <OutputCard key={o.id} label={outputLabel(o)} output={o} onChanged={replaceOutput} />)}
            </div>
          </div>
        )}

        {/* Blog */}
        {blog.length > 0 && (
          <div>
            <div style={styles.sectionTitle}>Blogpost</div>
            <div style={styles.grid}>
              {blog.map((o) => <OutputCard key={o.id} label={outputLabel(o)} output={o} onChanged={replaceOutput} />)}
            </div>
          </div>
        )}

        {/* Email */}
        {email.length > 0 && (
          <div>
            <div style={styles.sectionTitle}>Danke-Mail</div>
            <div style={styles.grid}>
              {email.map((o) => <OutputCard key={o.id} label={outputLabel(o)} output={o} onChanged={replaceOutput} />)}
            </div>
          </div>
        )}

        {/* Visuals */}
        {visuals.length > 0 && (
          <div>
            <div style={styles.sectionTitle}>Visuals</div>
            <div style={styles.visualsGrid}>
              {visuals.map((v) => <VisualCard key={v.id} label={VISUAL_LABEL[v.role] || v.role} visual={v} onChanged={replaceVisual} />)}
            </div>
          </div>
        )}

        {/* Veröffentlichen */}
        {episode.status === 'done' && (
          <div>
            <div style={styles.sectionTitle}>Veröffentlichen</div>
            {publishError && <div style={{ ...styles.errorBox, marginBottom: theme.spacing.md }}>{publishError}</div>}
            {publications.map((p) => {
              const s = PUB_STATUS[p.status] || PUB_STATUS.pending;
              return (
                <div key={p.id} style={styles.pubRow}>
                  <span style={{ fontWeight: theme.typography.weights.semibold, color: theme.colors.text }}>
                    {p.platform === 'podigee' ? 'Podigee' : p.platform}
                  </span>
                  <span style={{ ...styles.pubBadge, color: s.color, backgroundColor: s.bg }}>{s.label}</span>
                  {p.externalUrl && <a href={p.externalUrl} target="_blank" rel="noreferrer" style={{ ...styles.back, marginBottom: 0 }}>in Podigee öffnen</a>}
                  {p.error && <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.error }}>{p.error}</span>}
                </div>
              );
            })}
            <button style={{ ...styles.publishBtn, opacity: publishing ? 0.6 : 1 }} onClick={publishPodigee} disabled={publishing}>
              {publishing ? 'Wird hochgeladen…' : 'Auf Podigee veröffentlichen (Entwurf)'}
            </button>
          </div>
        )}

        {episode.status !== 'done' && episode.status !== 'failed' && outputs.length === 0 && (
          <div style={styles.empty}>Die Inhalte werden generiert – das dauert je nach Länge ein bis wenige Minuten.</div>
        )}
      </div>
    </div>
  );
}
