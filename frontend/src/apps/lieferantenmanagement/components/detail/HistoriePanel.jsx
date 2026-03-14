import { useState, useEffect } from 'react';
import { theme } from '../../../../config/theme';
import { useSuppliers } from '../../../../hooks/useSuppliers';

const PAGE_SIZE = 20;

const AKTION_CONFIG = {
  erstellt: { label: 'Erstellt', color: theme.colors.success, bg: theme.colors.successLight },
  geaendert: { label: 'Geaendert', color: theme.colors.primary, bg: theme.colors.primaryLight },
  phase_gewechselt: { label: 'Phase gewechselt', color: theme.colors.warning, bg: theme.colors.warningLight },
  geloescht: { label: 'Geloescht', color: theme.colors.error, bg: theme.colors.errorLight },
};

const BEREICH_LABELS = {
  stammdaten: 'Stammdaten',
  ansprechpartner: 'Ansprechpartner',
  zertifizierungen: 'Zertifizierungen',
  leistungen: 'Leistungen',
  regulatorik: 'Regulatorik',
  lifecycle: 'Lifecycle',
};

const BIA_LABELS = {
  very_high: 'Sehr hoch',
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
};

const PHASE_LABELS = {
  vorbereitung: 'Vorbereitung',
  risikoanalyse: 'Risikoanalyse',
  vertragspruefung: 'Vertragspruefung',
  betrieb: 'Betrieb',
  beendigung: 'Beendigung',
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
  },
  entry: {
    display: 'flex',
    gap: theme.spacing.lg,
    padding: `${theme.spacing.md} 0`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
  },
  entryTime: {
    minWidth: 140,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  entryDate: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
  },
  entryHour: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  entryIcon: {
    width: 32,
    height: 32,
    minWidth: 32,
    borderRadius: theme.borderRadius.full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  entryBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  entryText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: 1.5,
  },
  entryMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  highlight: {
    fontWeight: theme.typography.weights.medium,
  },
  changePill: {
    display: 'inline-block',
    fontSize: theme.typography.sizes.xs,
    padding: `1px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textSecondary,
    marginRight: 4,
    marginBottom: 2,
  },
  changesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    marginTop: 4,
    paddingLeft: 0,
  },
  changeItem: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'baseline',
  },
  changeField: {
    color: theme.colors.textMuted,
    minWidth: 120,
    flexShrink: 0,
  },
  changeOld: {
    textDecoration: 'line-through',
    color: theme.colors.textMuted,
  },
  changeNew: {
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
  },
  changeArrow: {
    color: theme.colors.textMuted,
  },
  loadMore: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
  },
  btnSecondary: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  empty: {
    textAlign: 'center',
    padding: theme.spacing['2xl'],
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  loading: {
    textAlign: 'center',
    padding: theme.spacing.xl,
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
};

function resolveLeistungName(supplier, leistungId) {
  if (!leistungId || !supplier?.leistungen) return null;
  const l = supplier.leistungen.find((x) => x.id === leistungId);
  return l?.bezeichnung || null;
}

function resolveAnsprechpartnerName(supplier, apId) {
  if (!apId || !supplier?.ansprechpartner) return null;
  const ap = supplier.ansprechpartner.find((x) => x.id === apId);
  return ap?.name || null;
}

function formatUserName(user) {
  if (!user || user === 'system') return 'System';
  if (user.startsWith('user_')) return 'Benutzer';
  return user;
}

function buildDescription(entry, supplier) {
  const { aktion, bereich, feld, alter_wert, neuer_wert, details } = entry;
  const d = details || {};

  if (aktion === 'erstellt' && bereich === 'stammdaten') {
    return <>Lieferant <span style={styles.highlight}>{d.firmenname || supplier?.firmenname || ''}</span> erstellt</>;
  }

  if (aktion === 'phase_gewechselt') {
    const from = PHASE_LABELS[alter_wert] || alter_wert;
    const to = PHASE_LABELS[neuer_wert] || neuer_wert;
    return <>Phase gewechselt: <span style={styles.highlight}>{from}</span> → <span style={styles.highlight}>{to}</span></>;
  }

  if (aktion === 'geloescht') {
    return <>Lieferant geloescht</>;
  }

  if (bereich === 'stammdaten') {
    if (d.felder && Array.isArray(d.felder)) {
      const labels = d.felder.map((f) => FELD_LABELS[f] || f);
      return (
        <>
          Stammdaten geaendert:{' '}
          {labels.map((l, i) => <span key={i} style={styles.changePill}>{l}</span>)}
        </>
      );
    }
    return <>Stammdaten aktualisiert</>;
  }

  if (bereich === 'ansprechpartner') {
    const name = d.name || neuer_wert || resolveAnsprechpartnerName(supplier, d.id) || '';
    if (d.aktion === 'hinzugefuegt') {
      return <>Ansprechpartner <span style={styles.highlight}>{name}</span> hinzugefuegt</>;
    }
    if (d.aktion === 'entfernt') {
      return <>Ansprechpartner{name ? <> <span style={styles.highlight}>{name}</span></> : ''} entfernt</>;
    }
    return <>Ansprechpartner{name ? <> <span style={styles.highlight}>{name}</span></> : ''} aktualisiert</>;
  }

  if (bereich === 'zertifizierungen') {
    const typ = d.typ || neuer_wert || '';
    if (d.aktion === 'hinzugefuegt') {
      return <>Zertifizierung <span style={styles.highlight}>{typ}</span> hinzugefuegt</>;
    }
    if (d.aktion === 'entfernt') {
      return <>Zertifizierung{typ ? <> <span style={styles.highlight}>{typ}</span></> : ''} entfernt</>;
    }
    return <>Zertifizierung{typ ? <> <span style={styles.highlight}>{typ}</span></> : ''} aktualisiert</>;
  }

  if (bereich === 'leistungen') {
    const name = d.bezeichnung || neuer_wert || resolveLeistungName(supplier, d.id || d.leistung_id) || '';
    if (d.aktion === 'hinzugefuegt') {
      return <>Leistung <span style={styles.highlight}>{name}</span> hinzugefuegt</>;
    }
    if (d.aktion === 'entfernt') {
      return <>Leistung{name ? <> <span style={styles.highlight}>{name}</span></> : ''} entfernt</>;
    }
    if (feld === 'bia') {
      const leistName = d.bezeichnung || resolveLeistungName(supplier, d.leistung_id || d.id);
      const biaLabel = BIA_LABELS[neuer_wert] || neuer_wert;
      return (
        <>
          BIA-Bewertung{leistName ? <> fuer <span style={styles.highlight}>{leistName}</span></> : ''} aktualisiert → <span style={styles.highlight}>{biaLabel}</span>
        </>
      );
    }
    const leistName = d.bezeichnung || resolveLeistungName(supplier, d.id || d.leistung_id);
    return <>Leistung{leistName ? <> <span style={styles.highlight}>{leistName}</span></> : ''} aktualisiert</>;
  }

  if (bereich === 'regulatorik') {
    const leistName = d.bezeichnung || resolveLeistungName(supplier, d.leistung_id);
    return <>Regulatorik{leistName ? <> fuer <span style={styles.highlight}>{leistName}</span></> : ''} aktualisiert</>;
  }

  // Fallback
  const bereichLabel = BEREICH_LABELS[bereich] || bereich;
  const aktionLabel = AKTION_CONFIG[aktion]?.label || aktion;
  return <>{bereichLabel}: {aktionLabel}</>;
}

const FELD_LABELS = {
  firmenname: 'Firmenname',
  status: 'Status',
  kundennummer: 'Kundennummer',
  vertragsnummern: 'Vertragsnummern',
  auftragsnummern: 'Auftragsnummern',
  adresse: 'Adresse',
  url: 'Website',
  notizen: 'Notizen',
  verantwortlichkeiten: 'Verantwortlichkeiten',
  fachverantwortlicher: 'Fachverantwortlicher',
  ism_verantwortlicher: 'ISM-Verantwortlicher',
};

function renderChanges(entry) {
  const aenderungen = entry.details?.aenderungen;
  if (!aenderungen || !Array.isArray(aenderungen) || aenderungen.length === 0) return null;

  return (
    <div style={styles.changesList}>
      {aenderungen.map((ch, i) => (
        <div key={i} style={styles.changeItem}>
          <span style={styles.changeField}>{ch.feld}:</span>
          {ch.alt && ch.alt !== '-' && ch.alt !== 'geaendert' ? (
            <>
              <span style={styles.changeOld}>{ch.alt}</span>
              <span style={styles.changeArrow}>→</span>
              <span style={styles.changeNew}>{ch.neu}</span>
            </>
          ) : (
            <span style={styles.changeNew}>{ch.neu}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function ActionIcon({ aktion }) {
  const color = AKTION_CONFIG[aktion]?.color || theme.colors.textMuted;
  if (aktion === 'erstellt') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    );
  }
  if (aktion === 'geaendert') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    );
  }
  if (aktion === 'phase_gewechselt') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
    );
  }
  if (aktion === 'geloescht') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

export default function HistoriePanel({ supplier }) {
  const { getChangelog } = useSuppliers();
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const loadEntries = async (currentOffset = 0, append = false) => {
    if (!supplier?.id) return;
    try {
      setIsLoading(true);
      const result = await getChangelog(supplier.id, PAGE_SIZE, currentOffset);
      const newEntries = result.entries || result.changelog || [];
      if (append) {
        setEntries((prev) => [...prev, ...newEntries]);
      } else {
        setEntries(newEntries);
      }
      setHasMore(newEntries.length >= PAGE_SIZE);
    } catch (err) {
      console.error('Error loading changelog:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setEntries([]);
    setOffset(0);
    loadEntries(0);
  }, [supplier?.id]);

  const handleLoadMore = () => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    loadEntries(newOffset, true);
  };

  if (!supplier) {
    return <div style={styles.loading}>Laden...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>Aenderungshistorie</div>

      {isLoading && entries.length === 0 && (
        <div style={styles.loading}>Laden...</div>
      )}

      {!isLoading && entries.length === 0 && (
        <div style={styles.empty}>Keine Aenderungen vorhanden.</div>
      )}

      {entries.length > 0 && (
        <div style={styles.timeline}>
          {entries.map((entry, idx) => {
            const cfg = AKTION_CONFIG[entry.aktion] || AKTION_CONFIG.geaendert;
            const ts = entry.timestamp ? new Date(entry.timestamp) : null;
            return (
              <div key={entry.id || idx} style={styles.entry}>
                <div style={styles.entryTime}>
                  <span style={styles.entryDate}>
                    {ts ? ts.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                  </span>
                  <span style={styles.entryHour}>
                    {ts ? ts.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div style={{ ...styles.entryIcon, backgroundColor: cfg.bg }}>
                  <ActionIcon aktion={entry.aktion} />
                </div>
                <div style={styles.entryBody}>
                  <div style={styles.entryText}>
                    {buildDescription(entry, supplier)}
                  </div>
                  {renderChanges(entry)}
                  <div style={styles.entryMeta}>
                    {formatUserName(entry.user)}
                    {entry.bereich && <> · {BEREICH_LABELS[entry.bereich] || entry.bereich}</>}
                  </div>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div style={styles.loadMore}>
              <button
                style={styles.btnSecondary}
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? 'Laden...' : 'Weitere laden'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
