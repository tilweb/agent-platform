import { useEffect, useState, useCallback } from 'react';
import { theme } from '../../config/theme';
import { apiGet, apiPost } from '../../utils/apiFetch';
import { ClassifierIcon } from '../../components/Icons';
import MatchCard from './components/MatchCard';
import HistoryList from './components/HistoryList';

const styles = {
  page: {
    padding: theme.spacing['2xl'],
    height: '100%',
    overflow: 'auto',
    backgroundColor: theme.colors.background,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    margin: 0,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing['2xl'],
    marginTop: theme.spacing.xs,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 320px',
    gap: theme.spacing['2xl'],
    alignItems: 'start',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
    minWidth: 0,
  },
  panel: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
  },
  inputLabel: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  textarea: {
    width: '100%',
    minHeight: '120px',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.base,
    fontFamily: theme.typography.fontFamily,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  buttonGroup: {
    display: 'flex',
    gap: theme.spacing.sm,
  },
  btnSecondary: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  btnPrimary: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.md,
  },
  activityBlock: {
    marginBottom: theme.spacing.xl,
  },
  activityHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  activityIndex: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  activityName: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  error: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
  },
  meta: {
    display: 'flex',
    gap: theme.spacing.md,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  status: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
};

export default function MatcherPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiGet('/apps/wzbar-matcher/history?limit=20');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.records || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiGet('/apps/wzbar-matcher/status');
      if (res.ok) setStatus(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadHistory();
    loadStatus();
  }, [loadHistory, loadStatus]);

  const doMatch = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost('/apps/wzbar-matcher/match', { inputText: text });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Match fehlgeschlagen');
      } else {
        setRecord(data.record);
        loadHistory();
      }
    } catch (err) {
      setError(err?.message || 'Match fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      doMatch();
    }
  };

  const reset = () => {
    setInput('');
    setRecord(null);
    setError(null);
  };

  const selectFromHistory = (r) => {
    setRecord(r);
    setInput(r.inputText || '');
    setError(null);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <ClassifierIcon size={28} color={theme.colors.primary} />
        <h1 style={styles.title}>WZ-Branchen-Matcher</h1>
      </div>
      <p style={styles.subtitle}>
        Bis zu 3 WZ-2025-Schlüssel pro Eingabe — automatisch nach erkannten Tätigkeiten getrennt. 4- bis 7-stellige Codes.
      </p>

      <div style={styles.grid}>
        <div style={styles.main}>
          <div style={styles.panel}>
            <label htmlFor="wzbar-input" style={styles.inputLabel}>Tätigkeitsbeschreibung</label>
            <textarea
              id="wzbar-input"
              style={styles.textarea}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={'z.B. "Allgemeine Putz- und Reinigungsleistungen im Haushalt"'}
              disabled={loading}
            />
            <div style={styles.toolbar}>
              <span style={styles.hint}>Tipp: Cmd/Ctrl + Enter sendet ab.</span>
              <div style={styles.buttonGroup}>
                <button type="button" style={styles.btnSecondary} onClick={reset} disabled={loading}>
                  Zurücksetzen
                </button>
                <button
                  type="button"
                  style={{ ...styles.btnPrimary, ...(loading || !input.trim() ? styles.btnDisabled : {}) }}
                  onClick={doMatch}
                  disabled={loading || !input.trim()}
                >
                  {loading ? 'Ermittle…' : 'Schlüssel ermitteln'}
                </button>
              </div>
            </div>
            {status && !status.indexReady && (
              <div style={{ ...styles.status, color: theme.colors.warning }}>
                Index noch nicht geladen. Bitte catalog-builder.ts im Backend ausführen.
              </div>
            )}
          </div>

          {error && <div style={styles.error}>{error}</div>}

          {record && (
            <div>
              <div style={styles.meta}>
                <span>Dauer: {record.durationMs} ms</span>
                <span>Embedding: {record.embeddingModel}</span>
                <span>LLM: {record.llmModel}</span>
              </div>
              {(() => {
                const activities = record.result?.activities || [];
                const multi = activities.length > 1;
                return activities.map((am, idx) => (
                  <div key={`${am.activity}-${idx}`} style={styles.activityBlock}>
                    {multi && (
                      <div style={styles.activityHeader}>
                        <span style={styles.activityIndex}>Tätigkeit {idx + 1}</span>
                        <span style={styles.activityName}>{am.activity}</span>
                      </div>
                    )}
                    {am.result?.primary && (
                      <MatchCard candidate={am.result.primary} isPrimary />
                    )}
                    {am.result?.alternatives?.length > 0 && (
                      <>
                        <div style={styles.sectionTitle}>Alternativen</div>
                        {am.result.alternatives.map((alt) => (
                          <MatchCard key={alt.code} candidate={alt} />
                        ))}
                      </>
                    )}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        <div style={styles.sidebar}>
          <div style={styles.panel}>
            <div style={styles.sectionTitle}>Historie (letzte 20)</div>
            <HistoryList records={history} activeId={record?.id} onSelect={selectFromHistory} />
          </div>
          {status && status.indexReady && (
            <div style={{ ...styles.panel, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
              Katalog: {status.catalogSize} Codes · {status.embeddingModel} · {status.embeddingDimensions} dim
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
