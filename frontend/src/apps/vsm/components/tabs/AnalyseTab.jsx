import { useState } from 'react';
import { theme } from '../../../../config/theme';

const styles = {
  container: {
    padding: theme.spacing['2xl'],
    maxWidth: '1000px',
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
  },
  analyseButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  infoTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  infoList: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  loadingOverlay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    textAlign: 'center',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: `3px solid ${theme.colors.border}`,
    borderTop: `3px solid ${theme.colors.primary}`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: theme.spacing.lg,
  },
  loadingText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  errorBox: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.lg,
  },
  report: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
  },
  reportMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  reportTimestamp: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  rerunButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.primary,
    border: `1px solid ${theme.colors.primary}40`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  markdown: {
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeight.relaxed,
    color: theme.colors.text,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
    lineHeight: theme.typography.lineHeight.relaxed,
    maxWidth: '500px',
    margin: '0 auto',
    marginBottom: theme.spacing.xl,
  },
};

// Simple markdown renderer for the analysis report
function MarkdownRenderer({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let inTable = false;
  let tableRows = [];
  let inList = false;
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} style={{ paddingLeft: '20px', marginBottom: '12px' }}>
          {listItems.map((item, i) => (
            <li key={i} style={{ marginBottom: '4px' }} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headerRow = tableRows[0];
      const bodyRows = tableRows.slice(2); // skip separator
      elements.push(
        <div key={`table-${elements.length}`} style={{ overflowX: 'auto', marginBottom: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.xs }}>
            <thead>
              <tr>
                {headerRow.map((cell, i) => (
                  <th key={i} style={{
                    padding: '8px 12px',
                    borderBottom: `2px solid ${theme.colors.border}`,
                    textAlign: 'left',
                    fontWeight: theme.typography.weights.semibold,
                    color: theme.colors.text,
                    whiteSpace: 'nowrap',
                  }}>{cell.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: '6px 12px',
                      borderBottom: `1px solid ${theme.colors.border}`,
                      color: theme.colors.text,
                    }} dangerouslySetInnerHTML={{ __html: formatInline(cell.trim()) }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
    inTable = false;
  };

  const formatInline = (text) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, `<code style="background:${theme.colors.surfaceHover};padding:1px 4px;border-radius:3px;font-size:12px">$1</code>`);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table detection
    if (line.includes('|') && line.trim().startsWith('|')) {
      if (!inTable) {
        flushList();
        inTable = true;
      }
      const cells = line.split('|').filter(c => c.trim() !== '');
      if (!line.match(/^\|[\s-|]+\|$/)) { // skip separator rows
        tableRows.push(cells);
      } else {
        tableRows.push(cells); // keep separator for index tracking
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // List items
    if (line.match(/^\s*[-*]\s/)) {
      if (!inList) inList = true;
      listItems.push(line.replace(/^\s*[-*]\s/, ''));
      continue;
    } else if (line.match(/^\s*\d+\.\s/)) {
      if (!inList) inList = true;
      listItems.push(line.replace(/^\s*\d+\.\s/, ''));
      continue;
    } else if (inList) {
      flushList();
    }

    // Headers
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, marginTop: '24px', marginBottom: '12px', color: theme.colors.text }}>{line.substring(2)}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, marginTop: '20px', marginBottom: '10px', color: theme.colors.text, borderBottom: `1px solid ${theme.colors.border}`, paddingBottom: '8px' }}>{line.substring(3)}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, marginTop: '16px', marginBottom: '8px', color: theme.colors.text }}>{line.substring(4)}</h3>);
    } else if (line.startsWith('#### ')) {
      elements.push(<h4 key={i} style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, marginTop: '12px', marginBottom: '6px', color: theme.colors.text }}>{line.substring(5)}</h4>);
    } else if (line.startsWith('---')) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${theme.colors.border}`, margin: '16px 0' }} />);
    } else if (line.trim() === '') {
      // Skip empty lines
    } else {
      elements.push(
        <p key={i} style={{ marginBottom: '8px', lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
      );
    }
  }

  // Flush remaining
  flushList();
  flushTable();

  return <div style={styles.markdown}>{elements}</div>;
}

export default function AnalyseTab({ projekt, onRunAnalyse }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [analyseResult, setAnalyseResult] = useState(projekt?.analyse_ergebnis || null);

  const processCount = projekt?.vsm_data?.prozessschritte?.length || 0;
  const hasData = processCount > 0;

  const handleAnalyse = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await onRunAnalyse();
      setAnalyseResult(result);
    } catch (err) {
      setError(err.message || 'Analyse fehlgeschlagen');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isAnalyzing) {
    return (
      <div style={styles.container}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={styles.loadingOverlay}>
          <div style={styles.spinner} />
          <div style={styles.loadingText}>
            KI-Analyse laeuft...
            <br />
            <span style={{ fontSize: theme.typography.sizes.xs, marginTop: theme.spacing.sm, display: 'block' }}>
              Die Wertstromanalyse wird erstellt. Dies kann bis zu 2 Minuten dauern.
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (analyseResult) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>Wertstromanalyse-Report</h2>
        <p style={styles.subtitle}>KI-gestuetzte Auswertung der erfassten Daten</p>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.report}>
          <div style={styles.reportMeta}>
            <span style={styles.reportTimestamp}>
              Erstellt: {new Date(analyseResult.timestamp).toLocaleString('de-DE')}
            </span>
            <button style={styles.rerunButton} onClick={handleAnalyse}>
              Analyse erneut ausfuehren
            </button>
          </div>
          <MarkdownRenderer content={analyseResult.report_markdown} />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>KI-gestuetzte Wertstromanalyse</h2>
      <p style={styles.subtitle}>Automatische Auswertung mit Verbesserungsvorschlaegen</p>

      {error && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.infoCard}>
        <div style={styles.infoTitle}>Was die Analyse liefert</div>
        <div style={styles.infoList}>
          <p style={{ marginBottom: '8px' }}>Die KI analysiert alle erfassten Daten und erstellt einen professionellen Report mit:</p>
          <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
            <li>Executive Summary mit Top-Problemen und Verbesserungspotenzial</li>
            <li>Engpass-Analyse (Kapazitaet, Qualitaet, Verfuegbarkeit, Zeit)</li>
            <li>Verschwendungs-Analyse nach den 8 Muda-Kategorien</li>
            <li>KPI-Dashboard IST (Durchlaufzeit, OEE, Bestaende, Kosten)</li>
            <li>Quick Wins, mittelfristige Massnahmen und strategische Initiativen mit ROI</li>
            <li>SOLL-Zustand Prognose (IST vs. SOLL Vergleich)</li>
            <li>Implementierungs-Roadmap (24 Monate)</li>
          </ul>
        </div>
      </div>

      {!hasData ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyTitle}>Noch keine Daten erfasst</div>
          <div style={styles.emptyText}>
            Erfasse mindestens die Prozessschritte im Tab "Eingabe", um die Analyse starten zu koennen.
            Je mehr Daten erfasst sind, desto detaillierter wird der Report.
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: theme.spacing.xl }}>
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}>
            {processCount} Prozessschritt{processCount !== 1 ? 'e' : ''} erfasst.
            {processCount < 3 && ' Tipp: Mehr Daten fuehren zu besseren Ergebnissen.'}
          </div>
          <button style={styles.analyseButton} onClick={handleAnalyse}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            Analyse starten
          </button>
        </div>
      )}
    </div>
  );
}
