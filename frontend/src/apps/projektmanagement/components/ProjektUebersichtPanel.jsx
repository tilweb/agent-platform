/**
 * ProjektUebersichtPanel — Phase B
 *
 * Default-View beim Oeffnen eines Projekts. Zeigt Lifecycle + Schluesseldaten
 * + Last Statusbericht + Platzhalter fuer Lessons Learned / Abschluss (Phase E).
 *
 * Datenquelle: paProjekte (Lifecycle, Owner) + paProjektauftraege (Inhalt
 * Schluesseldaten, bis FK-Umzug in spaeterer Phase) + neuester Statusbericht.
 *
 * Bewusst klein und read-only. Tiefer-greifende Bearbeitung passiert in den
 * anderen Tabs (Projektauftrag, Statusberichte).
 */

import { theme } from '../../../config/theme';

const LIFECYCLE_LABELS = {
  planning: { label: 'Planung', color: 'muted' },
  active: { label: 'Aktiv', color: 'primary' },
  closed: { label: 'Abgeschlossen', color: 'success' },
  cancelled: { label: 'Abgebrochen', color: 'error' },
};

const AMPEL_LABELS = {
  gruen: { label: 'Grün', bg: theme.colors.successLight, fg: theme.colors.success },
  gelb: { label: 'Gelb', bg: theme.colors.warningLight, fg: theme.colors.warning },
  rot: { label: 'Rot', bg: theme.colors.errorLight, fg: theme.colors.error },
};

const styles = {
  container: {
    padding: theme.spacing['2xl'],
    overflow: 'auto',
    height: '100%',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.lg,
  },
  factRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: `${theme.spacing.sm} 0`,
    borderBottom: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.sm,
  },
  factRowLast: {
    borderBottom: 'none',
  },
  factLabel: {
    color: theme.colors.textMuted,
  },
  factValue: {
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
    textAlign: 'right',
  },
  lifecycleBadge: {
    display: 'inline-block',
    padding: `${theme.spacing.xs} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  ampelDot: {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
    marginRight: theme.spacing.sm,
  },
  emptyHint: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  comingSoon: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.md,
    marginLeft: theme.spacing.sm,
  },
};

function lifecycleBadgeStyle(lifecycle) {
  const entry = LIFECYCLE_LABELS[lifecycle] || LIFECYCLE_LABELS.planning;
  const colorMap = {
    muted: { bg: theme.colors.surfaceHover, fg: theme.colors.textMuted },
    primary: { bg: theme.colors.primaryLight, fg: theme.colors.primary },
    success: { bg: theme.colors.successLight, fg: theme.colors.success },
    error: { bg: theme.colors.errorLight, fg: theme.colors.error },
  };
  const c = colorMap[entry.color];
  return { backgroundColor: c.bg, color: c.fg };
}

export default function ProjektUebersichtPanel({ projekt, projektauftrag, statusberichte }) {
  const lifecycle = projekt?.lifecycle || 'planning';
  const lifecycleEntry = LIFECYCLE_LABELS[lifecycle] || LIFECYCLE_LABELS.planning;
  const latestSb = (statusberichte && statusberichte.length > 0)
    ? [...statusberichte].sort((a, b) => b.nummer - a.nummer)[0]
    : null;

  const formatDate = (iso) => {
    if (!iso) return '–';
    try {
      return new Date(iso).toLocaleDateString('de-DE');
    } catch {
      return iso;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Lifecycle</div>
          <div style={{ marginBottom: theme.spacing.lg }}>
            <span style={{ ...styles.lifecycleBadge, ...lifecycleBadgeStyle(lifecycle) }}>
              {lifecycleEntry.label}
            </span>
          </div>
          <div style={styles.factRow}>
            <span style={styles.factLabel}>Version</span>
            <span style={styles.factValue}>{projekt?.version ?? '–'}</span>
          </div>
          <div style={{ ...styles.factRow, ...styles.factRowLast }}>
            <span style={styles.factLabel}>Letzte Aktualisierung</span>
            <span style={styles.factValue}>{formatDate(projekt?.updatedAt)}</span>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Schlüsseldaten</div>
          <div style={styles.factRow}>
            <span style={styles.factLabel}>Projektleitung</span>
            <span style={styles.factValue}>{projektauftrag?.projektleiter || '–'}</span>
          </div>
          <div style={styles.factRow}>
            <span style={styles.factLabel}>Auftraggeber</span>
            <span style={styles.factValue}>{projektauftrag?.auftraggeber || '–'}</span>
          </div>
          <div style={styles.factRow}>
            <span style={styles.factLabel}>Zeitraum</span>
            <span style={styles.factValue}>
              {projektauftrag?.start_date && projektauftrag?.end_date
                ? `${projektauftrag.start_date} – ${projektauftrag.end_date}`
                : '–'}
            </span>
          </div>
          <div style={{ ...styles.factRow, ...styles.factRowLast }}>
            <span style={styles.factLabel}>Projekttyp</span>
            <span style={styles.factValue}>{projektauftrag?.project_type || '–'}</span>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Letzter Statusbericht</div>
          {latestSb ? (
            <>
              <div style={styles.factRow}>
                <span style={styles.factLabel}>Nummer</span>
                <span style={styles.factValue}>#{latestSb.nummer}</span>
              </div>
              <div style={styles.factRow}>
                <span style={styles.factLabel}>Datum</span>
                <span style={styles.factValue}>{formatDate(latestSb.datum)}</span>
              </div>
              <div style={styles.factRow}>
                <span style={styles.factLabel}>Ampel</span>
                <span style={styles.factValue}>
                  {AMPEL_LABELS[latestSb.ampel] && (
                    <>
                      <span style={{ ...styles.ampelDot, backgroundColor: AMPEL_LABELS[latestSb.ampel].fg }} />
                      {AMPEL_LABELS[latestSb.ampel].label}
                    </>
                  )}
                </span>
              </div>
              <div style={{ ...styles.factRow, ...styles.factRowLast }}>
                <span style={styles.factLabel}>Status</span>
                <span style={styles.factValue}>{latestSb.status === 'final' ? 'Final' : 'Entwurf'}</span>
              </div>
            </>
          ) : (
            <div style={styles.emptyHint}>
              Noch kein Statusbericht angelegt.
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>
            Abschluss
            <span style={styles.comingSoon}>Phase E</span>
          </div>
          <div style={styles.emptyHint}>
            Lessons Learned und Abschlussbericht werden hier sichtbar, sobald sie
            implementiert sind. Heute ueberspringen wir den formalen Abschluss
            und tracken Erkenntnisse direkt im Auftrag.
          </div>
        </div>
      </div>
    </div>
  );
}
