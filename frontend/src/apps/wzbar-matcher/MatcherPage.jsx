import { useEffect, useState, useCallback } from 'react';
import { theme } from '../../config/theme';
import { apiGet, apiPost } from '../../utils/apiFetch';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
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
    alignItems: 'center',
    gap: theme.spacing.md,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  cachedBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  pendingHint: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  recomputeLink: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primary,
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontWeight: theme.typography.weights.medium,
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
  const [pendingActivities, setPendingActivities] = useState(null);
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

  // SSE-Variante: zeigt die erkannten Tätigkeiten an, sobald der Splitter
  // fertig ist, während die Codes noch rechnen. Wirft bei Server-Fehlern
  // (Event `error`) mit err.serverError=true — dann KEIN Fallback-Rerun.
  const doMatchStream = async (text, force) => {
    const res = await fetch(`${API_URL}/apps/wzbar-matcher/match/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputText: text, force }),
    });
    if (!res.ok || !res.body) throw new Error(`Stream nicht verfügbar (${res.status})`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let gotRecord = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        let event = 'message';
        let data = '';
        for (const line of rawEvent.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) continue;
        const payload = JSON.parse(data);
        if (event === 'activities') {
          setPendingActivities(payload.activities || []);
        } else if (event === 'record') {
          setRecord(payload.record);
          gotRecord = true;
        } else if (event === 'error') {
          const err = new Error(payload.error || 'Match fehlgeschlagen');
          err.serverError = true;
          throw err;
        }
      }
    }
    if (!gotRecord) throw new Error('Stream ohne Ergebnis beendet');
  };

  const doMatch = async (force = false) => {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setRecord(null);
    setPendingActivities(null);
    setLoading(true);
    try {
      await doMatchStream(text, force);
      loadHistory();
    } catch (err) {
      if (err?.serverError) {
        setError(err.message);
      } else {
        // Transport-Problem (z.B. Proxy ohne SSE) — Fallback auf klassischen POST
        try {
          const res = await apiPost('/apps/wzbar-matcher/match', { inputText: text, force });
          const data = await res.json();
          if (!res.ok) {
            setError(data?.error || 'Match fehlgeschlagen');
          } else {
            setRecord(data.record);
            loadHistory();
          }
        } catch (fallbackErr) {
          setError(fallbackErr?.message || 'Match fehlgeschlagen');
        }
      }
    } finally {
      setLoading(false);
      setPendingActivities(null);
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
                  onClick={() => doMatch()}
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

          {loading && pendingActivities && pendingActivities.length > 0 && (
            <div style={styles.panel}>
              <div style={styles.sectionTitle}>
                {pendingActivities.length === 1 ? 'Erkannte Tätigkeit' : `${pendingActivities.length} erkannte Tätigkeiten`}
              </div>
              {pendingActivities.map((a, idx) => (
                <div key={`${a.text}-${idx}`} style={styles.activityBlock}>
                  <div style={styles.activityHeader}>
                    {pendingActivities.length > 1 && <span style={styles.activityIndex}>Tätigkeit {idx + 1}</span>}
                    <span style={styles.activityName}>{a.text}</span>
                  </div>
                  <div style={styles.pendingHint}>WZ-Schlüssel wird ermittelt…</div>
                </div>
              ))}
            </div>
          )}

          {record && (
            <div>
              <div style={styles.meta}>
                <span>Dauer: {record.durationMs} ms</span>
                <span>Embedding: {record.embeddingModel}</span>
                <span>LLM: {record.llmModel}</span>
                {record.cached && (
                  <>
                    <span style={styles.cachedBadge}>aus früherem Lauf</span>
                    <button
                      type="button"
                      style={styles.recomputeLink}
                      onClick={() => doMatch(true)}
                      disabled={loading}
                      title="Cache umgehen und den Schlüssel frisch ermitteln — das neue Ergebnis ersetzt den gespeicherten Treffer"
                    >
                      Neu ermitteln
                    </button>
                  </>
                )}
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
