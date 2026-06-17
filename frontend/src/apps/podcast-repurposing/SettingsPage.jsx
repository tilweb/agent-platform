import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { ArrowLeftIcon } from '../../components/Icons';
import { apiGet, apiFetch } from '../../utils/apiFetch';

const styles = {
  container: { height: '100%', overflow: 'auto', backgroundColor: theme.colors.background },
  header: { padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, borderBottom: `1px solid ${theme.colors.border}` },
  back: {
    display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary, cursor: 'pointer', border: 'none', background: 'none', padding: 0,
    marginBottom: theme.spacing.lg, fontWeight: theme.typography.weights.medium,
  },
  title: { fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text },
  subtitle: { fontSize: theme.typography.sizes.base, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  body: { padding: theme.spacing['2xl'], maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: theme.spacing.lg },
  card: { backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg, display: 'flex', flexDirection: 'column', gap: theme.spacing.sm },
  row: { display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' },
  label: { fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, flex: 1 },
  small: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  input: { padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none' },
  textarea: { width: '100%', minHeight: '70px', padding: theme.spacing.md, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.xs, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none', resize: 'vertical', fontFamily: 'inherit' },
  btn: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: theme.colors.primary, color: '#fff', border: 'none', borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer', alignSelf: 'flex-start' },
  toggleLink: { ...{ color: theme.colors.primary, cursor: 'pointer', fontSize: theme.typography.sizes.sm, background: 'none', border: 'none' } },
};

function FormatRow({ format }) {
  const [f, setF] = useState(format);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      await apiFetch(`/apps/podcast-repurposing/settings/formats/${f.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          label: f.label,
          enabled: f.enabled,
          variants: f.variants,
          systemPrompt: f.systemPrompt,
          userPromptTemplate: f.userPromptTemplate,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.row}>
        <input type="checkbox" checked={!!f.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        <span style={styles.label}>{f.label}</span>
        <span style={styles.small}>{f.kind}{f.platform ? ` · ${f.platform}` : ''}{f.aspectRatio ? ` · ${f.aspectRatio}` : ''}</span>
        {f.kind !== 'visual' && (
          <label style={styles.small}>
            Varianten{' '}
            <input style={{ ...styles.input, width: 56 }} type="number" min={1} max={5} value={f.variants}
              onChange={(e) => set({ variants: Math.max(1, parseInt(e.target.value || '1', 10)) })} />
          </label>
        )}
        <button style={styles.toggleLink} onClick={() => setOpen((v) => !v)}>{open ? 'Prompts ausblenden' : 'Prompts bearbeiten'}</button>
      </div>
      {open && (
        <>
          <div style={styles.small}>System-Prompt</div>
          <textarea style={styles.textarea} value={f.systemPrompt} onChange={(e) => set({ systemPrompt: e.target.value })} />
          <div style={styles.small}>User-Prompt-Vorlage (Platzhalter: {'{{transcript}}'} {'{{title}}'})</div>
          <textarea style={styles.textarea} value={f.userPromptTemplate} onChange={(e) => set({ userPromptTemplate: e.target.value })} />
        </>
      )}
      <button style={{ ...styles.btn, opacity: busy ? 0.6 : 1 }} onClick={save} disabled={busy}>{saved ? 'Gespeichert' : 'Speichern'}</button>
    </div>
  );
}

function PublishingSettings() {
  const [status, setStatus] = useState(null);
  const [token, setToken] = useState('');
  const [podcastId, setPodcastId] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const res = await apiGet('/apps/podcast-repurposing/settings/publishing');
    const data = await res.json();
    setStatus(data.podigee || { configured: false, podcastId: null });
    if (data.podigee?.podcastId) setPodcastId(data.podigee.podcastId);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!token || !podcastId) return;
    setBusy(true);
    try {
      await apiFetch('/apps/podcast-repurposing/settings/publishing/podigee', {
        method: 'PUT',
        body: JSON.stringify({ apiToken: token, podcastId }),
      });
      setToken('');
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.row}>
        <span style={styles.label}>Podigee (Publishing)</span>
        <span style={styles.small}>
          {status?.configured ? `verbunden · Show ${status.podcastId}` : 'nicht konfiguriert'}
        </span>
      </div>
      <div style={styles.small}>API-Token (aus den Podigee-Account-Settings — wird verschlüsselt gespeichert)</div>
      <input style={styles.input} type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={status?.configured ? '•••••••• (zum Ändern neu eingeben)' : 'Podigee API-Token'} />
      <div style={styles.small}>Podcast-ID (die Show)</div>
      <input style={styles.input} value={podcastId} onChange={(e) => setPodcastId(e.target.value)} placeholder="z. B. 12345" />
      <button style={{ ...styles.btn, opacity: busy ? 0.6 : 1 }} onClick={save} disabled={busy || !token || !podcastId}>
        {saved ? 'Gespeichert' : 'Podigee speichern'}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet('/apps/podcast-repurposing/settings/formats');
        const data = await res.json();
        setFormats(data.formats || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.back} onClick={() => navigate('/apps/podcast-repurposing')}><ArrowLeftIcon /> Podcast-Repurposing</button>
        <h1 style={styles.title}>Format-Vorlagen</h1>
        <p style={styles.subtitle}>Welche Formate generiert werden und mit welchen Prompts.</p>
      </div>
      <div style={styles.body}>
        <PublishingSettings />
        <div style={{ ...styles.label, marginTop: theme.spacing.lg }}>Format-Vorlagen</div>
        {loading ? <div style={styles.small}>Lädt…</div> : formats.map((f) => <FormatRow key={f.id} format={f} />)}
      </div>
    </div>
  );
}
