/**
 * IdeeUebersicht — Tab 6 (Read-Only-Zusammenfassung).
 * Zeigt alle ausgefuellten Felder kompakt + Status der abgeleiteten Auftraege.
 */

import { theme } from '../../../../config/theme';

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xl },
  header: { marginBottom: theme.spacing.lg },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
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
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    columnGap: theme.spacing.lg,
    rowGap: theme.spacing.sm,
  },
  fieldLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  fieldValue: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  emptyValue: { color: theme.colors.textMuted, fontStyle: 'italic' },
  bulletList: {
    margin: 0,
    paddingLeft: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  riskRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 80px 80px',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    paddingBottom: theme.spacing.xs,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  bcRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    fontVariantNumeric: 'tabular-nums',
    paddingBottom: theme.spacing.xs,
  },
  bcSum: {
    fontWeight: theme.typography.weights.semibold,
    paddingTop: theme.spacing.sm,
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: theme.spacing.sm,
  },
  auftraegeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  auftragRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.sm,
  },
  link: {
    color: theme.colors.primary,
    textDecoration: 'none',
    fontWeight: theme.typography.weights.medium,
  },
  noContent: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
};

function formatEuro(v) {
  if (typeof v !== 'number') return '0 €';
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function fmt(v) {
  if (v === null || v === undefined || v === '') return null;
  return v;
}

function FieldRow({ label, value }) {
  return (
    <>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={value ? styles.fieldValue : { ...styles.fieldValue, ...styles.emptyValue }}>
        {value || '—'}
      </div>
    </>
  );
}

const STATUS_LABELS = {
  draft: 'Entwurf',
  review: 'In Pruefung',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  archived: 'Archiviert',
};

const PROJECT_TYPE_LABELS = {
  internal: 'Internes Projekt',
  external: 'Externes Projekt',
  research: 'Forschungsprojekt',
  infrastructure: 'Infrastrukturprojekt',
};

const SIZE_LABELS = {
  klein: 'Klein',
  mittel: 'Mittel',
  gross: 'Groß',
  sehr_gross: 'Sehr groß',
};

const PRIO_LABELS = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  critical: 'Kritisch',
};

const LEVEL_LABELS = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
};

export default function IdeeUebersicht({ projektidee, onCreateAuftrag }) {
  const idee = projektidee;
  const bc = idee.business_case ?? { investitionen: [], nutzen: [] };
  const sumInvest = bc.investitionen.reduce((a, i) => a + (Number(i.betrag) || 0), 0);
  const sumNutzen = bc.nutzen.reduce((a, i) => a + (Number(i.betrag) || 0), 0);
  const saldo = sumNutzen - sumInvest;
  const auftraege = idee.abgeleitete_auftraege ?? [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>6. Übersicht</h2>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Basis</div>
        <div style={styles.fieldGrid}>
          <FieldRow label="Projektname" value={fmt(idee.name)} />
          <FieldRow label="Projekt-ID" value={fmt(idee.projekt_id)} />
          <FieldRow label="Projekttyp" value={PROJECT_TYPE_LABELS[idee.project_type] ?? null} />
          <FieldRow label="Projektidee Status" value={STATUS_LABELS[idee.status] ?? idee.status} />
          <FieldRow label="Projektstatus" value={fmt(idee.project_status)} />
          <FieldRow label="Projekttreiber" value={fmt(idee.projekttreiber)} />
          <FieldRow label="Projektgröße" value={SIZE_LABELS[idee.projektgroesse] ?? null} />
          <FieldRow label="Priorität" value={PRIO_LABELS[idee.prioritaet] ?? null} />
          <FieldRow label="Startdatum" value={fmt(idee.start_date)} />
          <FieldRow label="Enddatum" value={fmt(idee.end_date)} />
          <FieldRow label="Projektleiter" value={fmt(idee.projektleiter)} />
          <FieldRow label="Auftraggeber" value={fmt(idee.auftraggeber)} />
          <FieldRow label="Kurzbeschreibung" value={fmt(idee.description)} />
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Ziele</div>
        <div style={styles.fieldValue}>{fmt(idee.goals) || <span style={styles.noContent}>Noch nicht erfasst</span>}</div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Projektkontext</div>
        <div style={styles.fieldGrid}>
          <FieldRow label="Ausgangslage" value={fmt(idee.context?.ausgangslage)} />
          <FieldRow label="Rahmenbedingungen" value={fmt(idee.context?.rahmenbedingungen)} />
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Business Case</div>
        {bc.investitionen.length === 0 && bc.nutzen.length === 0 ? (
          <div style={styles.noContent}>Noch keine Werte erfasst</div>
        ) : (
          <>
            <div style={{ ...styles.fieldLabel, marginBottom: 8 }}>Investitionen</div>
            {bc.investitionen.map((it) => (
              <div key={it.id} style={styles.bcRow}>
                <span>{it.beschreibung || <em style={{ color: theme.colors.textMuted }}>—</em>}</span>
                <span style={{ textAlign: 'right' }}>− {formatEuro(it.betrag)}</span>
              </div>
            ))}
            <div style={{ ...styles.bcRow, ...styles.bcSum }}>
              <span>Summe Investitionen</span>
              <span style={{ textAlign: 'right' }}>− {formatEuro(sumInvest)}</span>
            </div>

            <div style={{ ...styles.fieldLabel, marginTop: theme.spacing.lg, marginBottom: 8 }}>Nutzen</div>
            {bc.nutzen.map((it) => (
              <div key={it.id} style={styles.bcRow}>
                <span>{it.beschreibung || <em style={{ color: theme.colors.textMuted }}>—</em>}</span>
                <span style={{ textAlign: 'right' }}>+ {formatEuro(it.betrag)}</span>
              </div>
            ))}
            <div style={{ ...styles.bcRow, ...styles.bcSum }}>
              <span>Summe Nutzen</span>
              <span style={{ textAlign: 'right' }}>+ {formatEuro(sumNutzen)}</span>
            </div>

            <div style={{ ...styles.bcRow, ...styles.bcSum, fontSize: theme.typography.sizes.base }}>
              <span>Saldo (ROI)</span>
              <span style={{ textAlign: 'right', color: saldo >= 0 ? theme.colors.success : theme.colors.error }}>
                {formatEuro(saldo)}
              </span>
            </div>
          </>
        )}
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Unternehmensrisiken</div>
        {(idee.unternehmensrisiken || []).length === 0 ? (
          <div style={styles.noContent}>Keine Risiken erfasst</div>
        ) : (
          <>
            <div style={{ ...styles.riskRow, fontWeight: theme.typography.weights.semibold }}>
              <div>Beschreibung</div>
              <div>Wahrsch.</div>
              <div>Auswirkung</div>
            </div>
            {idee.unternehmensrisiken.map((r) => (
              <div key={r.id} style={styles.riskRow}>
                <div>
                  {r.description || <em style={{ color: theme.colors.textMuted }}>—</em>}
                  {r.type && <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>{r.type}</div>}
                </div>
                <div>{LEVEL_LABELS[r.probability] ?? '—'}</div>
                <div>{LEVEL_LABELS[r.impact] ?? '—'}</div>
              </div>
            ))}
          </>
        )}
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Abgeleitete Projektaufträge</div>
        {auftraege.length === 0 ? (
          <div style={styles.noContent}>
            Noch kein Projektauftrag aus dieser Idee erzeugt.
            {onCreateAuftrag && (
              <div style={{ marginTop: theme.spacing.md }}>
                Klicken Sie oben auf <strong>„Auftrag aus Idee erstellen"</strong>.
              </div>
            )}
          </div>
        ) : (
          <div style={styles.auftraegeList}>
            {auftraege.map((a) => (
              <div key={a.id} style={styles.auftragRow}>
                <a href={`/apps/projektmanagement/${a.id}`} style={styles.link}>{a.name}</a>
                <span style={{ color: theme.colors.textMuted }}>{a.status} · {a.created_at?.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
