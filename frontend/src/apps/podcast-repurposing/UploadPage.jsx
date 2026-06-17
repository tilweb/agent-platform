import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { ArrowLeftIcon } from '../../components/Icons';
import { apiPostForm } from '../../utils/apiFetch';

const styles = {
  container: { height: '100%', overflow: 'auto', backgroundColor: theme.colors.background },
  header: { padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`, borderBottom: `1px solid ${theme.colors.border}` },
  back: {
    display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm, color: theme.colors.primary, cursor: 'pointer',
    border: 'none', background: 'none', padding: 0, marginBottom: theme.spacing.lg, fontWeight: theme.typography.weights.medium,
  },
  title: { fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text },
  body: { padding: theme.spacing['2xl'], maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: theme.spacing.lg },
  fieldLabel: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text, marginBottom: theme.spacing.xs },
  input: {
    width: '100%', padding: theme.spacing.md, border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none',
  },
  drop: {
    border: `2px dashed ${theme.colors.border}`, borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'], textAlign: 'center', color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm, cursor: 'pointer', backgroundColor: theme.colors.surface,
  },
  fileName: { color: theme.colors.text, fontWeight: theme.typography.weights.medium },
  btn: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`, backgroundColor: theme.colors.primary, color: '#fff',
    border: 'none', borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium, cursor: 'pointer', alignSelf: 'flex-start',
  },
  error: { color: theme.colors.error, backgroundColor: theme.colors.errorLight, padding: theme.spacing.md, borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm },
  hint: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
};

export default function UploadPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onFile = (f) => {
    if (f) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
    }
  };

  const submit = async () => {
    if (!file) { setError('Bitte ein Video auswählen.'); return; }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title || file.name);
      const res = await apiPostForm('/apps/podcast-repurposing/episodes', fd);
      const data = await res.json();
      if (!res.ok || !data.id) {
        setError(data.error || 'Upload fehlgeschlagen.');
        setBusy(false);
        return;
      }
      navigate(`/apps/podcast-repurposing/${data.id}`);
    } catch (e) {
      setError(String(e?.message || e));
      setBusy(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.back} onClick={() => navigate('/apps/podcast-repurposing')}><ArrowLeftIcon /> Podcast-Repurposing</button>
        <h1 style={styles.title}>Neue Episode</h1>
      </div>
      <div style={styles.body}>
        <div>
          <div style={styles.fieldLabel}>Titel der Folge</div>
          <input style={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Folge 42 – Managed Hosting Trends" />
        </div>
        <div>
          <div style={styles.fieldLabel}>Podcast-Video</div>
          <label style={styles.drop}>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
              style={{ display: 'none' }}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {file ? <span style={styles.fileName}>{file.name} ({Math.round(file.size / 1024 / 1024)} MB)</span> : 'Video-Datei hier auswählen (MP4 / MOV / WebM)'}
          </label>
          <div style={{ ...styles.hint, marginTop: theme.spacing.xs }}>Die Audiospur wird extrahiert und transkribiert. Max. 500 MB.</div>
        </div>
        {error && <div style={styles.error}>{error}</div>}
        <button style={{ ...styles.btn, opacity: busy ? 0.6 : 1 }} onClick={submit} disabled={busy}>
          {busy ? 'Wird hochgeladen…' : 'Hochladen & generieren'}
        </button>
      </div>
    </div>
  );
}
