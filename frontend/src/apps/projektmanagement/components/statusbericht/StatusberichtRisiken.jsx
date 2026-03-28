/**
 * StatusberichtRisiken
 * Risikomanagement-Tracking: Bedrohungen und Chancen mit
 * Strategie, Status, Verantwortlich, Datumsfelder, Ampel, Bewertung, Beschreibung, Auswirkung, Maßnahmen
 * + Risikobewegungsmatrix (Soll/Ist Vergleich mit Projektauftrag)
 */

import { useState } from 'react';
import { theme } from '../../../../config/theme';
import RiskMovementMatrix from '../steps/RiskMovementMatrix';

const AMPEL_COLORS = {
  gruen: theme.colors.success,
  gelb: theme.colors.warning,
  rot: theme.colors.error,
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  tabs: {
    display: 'flex',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  tab: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  tabActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  sectionLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.md,
  },
  itemList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  itemCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemIndex: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  removeBtn: {
    padding: theme.spacing.xs,
    backgroundColor: 'transparent',
    border: 'none',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    borderRadius: theme.borderRadius.sm,
    display: 'flex',
    alignItems: 'center',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: theme.spacing.md,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  select: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    cursor: 'pointer',
    outline: 'none',
  },
  input: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    outline: 'none',
  },
  readonlyInput: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surfaceHover,
    outline: 'none',
  },
  ampelGroup: {
    display: 'flex',
    gap: theme.spacing.xs,
    alignItems: 'center',
    paddingTop: theme.spacing.xs,
  },
  ampelDot: {
    width: '24px',
    height: '24px',
    borderRadius: theme.borderRadius.full,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    border: '2px solid transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textareaRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: theme.spacing.md,
  },
  textarea: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    outline: 'none',
    resize: 'vertical',
    minHeight: '60px',
    fontFamily: 'inherit',
  },
  addBtn: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    border: `1px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  emptyState: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    padding: theme.spacing.xl,
    textAlign: 'center',
  },
};

function StatusberichtRisiken({ data, onChange, projektauftrag, config }) {
  const [activeView, setActiveView] = useState('liste');
  const riskTracking = data.risk_tracking || [];
  const teamMembers = projektauftrag?.organization || [];

  const strategieOptions = config?.risk_strategie || [];
  const statusOptions = config?.risk_status || [];
  const probabilityOptions = config?.probability || [];
  const impactOptions = config?.impact || [];

  const bedrohungen = riskTracking.filter((r) => r.type === 'bedrohung');
  const chancen = riskTracking.filter((r) => r.type === 'chance');

  const handleItemChange = (id, field, value) => {
    const updated = riskTracking.map((r) => {
      if (r.id !== id) return r;
      return {
        ...r,
        [field]: value,
        aktualisiert: new Date().toISOString().split('T')[0],
      };
    });
    onChange({ risk_tracking: updated });
  };

  const addItem = (type) => {
    const today = new Date().toISOString().split('T')[0];
    const newItem = {
      id: `rt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      strategie: '',
      status: 'identifiziert',
      verantwortlich: '',
      erkannt: today,
      aktualisiert: today,
      erwartet_bis: '',
      ampel: 'gruen',
      beschreibung: '',
      auswirkung: '',
      massnahmen: '',
      wahrscheinlichkeit: '',
      auswirkung_bewertung: '',
    };
    onChange({ risk_tracking: [...riskTracking, newItem] });
  };

  const removeItem = (id) => {
    onChange({ risk_tracking: riskTracking.filter((r) => r.id !== id) });
  };

  const renderItem = (item, index) => {
    const typeStrategies = item.type === 'bedrohung'
      ? strategieOptions.filter((s) => s.value.startsWith('B-'))
      : strategieOptions.filter((s) => s.value.startsWith('C-'));

    return (
      <div key={item.id} style={styles.itemCard}>
        {/* Header */}
        <div style={styles.itemHeader}>
          <span style={styles.itemIndex}>#{index + 1}</span>
          <button
            style={styles.removeBtn}
            onClick={() => removeItem(item.id)}
            onMouseEnter={(e) => { e.currentTarget.style.color = theme.colors.error; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = theme.colors.textMuted; }}
          >
            <TrashIcon />
          </button>
        </div>

        {/* Row 1: Strategie, Status, Verantwortlich, Ampel */}
        <div style={styles.fieldGrid}>
          <div style={styles.fieldGroup}>
            <span style={styles.label}>Strategie</span>
            <select
              style={styles.select}
              value={item.strategie}
              onChange={(e) => handleItemChange(item.id, 'strategie', e.target.value)}
              onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
              onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
            >
              <option value="">-- Auswählen --</option>
              {typeStrategies.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div style={styles.fieldGroup}>
            <span style={styles.label}>Status</span>
            <select
              style={styles.select}
              value={item.status}
              onChange={(e) => handleItemChange(item.id, 'status', e.target.value)}
              onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
              onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
            >
              <option value="">-- Auswählen --</option>
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div style={styles.fieldGroup}>
            <span style={styles.label}>Verantwortlich</span>
            <select
              style={styles.select}
              value={item.verantwortlich}
              onChange={(e) => handleItemChange(item.id, 'verantwortlich', e.target.value)}
              onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
              onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
            >
              <option value="">-- Auswählen --</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>

          <div style={styles.fieldGroup}>
            <span style={styles.label}>Ampel</span>
            <div style={styles.ampelGroup}>
              {Object.entries(AMPEL_COLORS).map(([key, color]) => {
                const isSelected = item.ampel === key;
                return (
                  <div
                    key={key}
                    style={{
                      ...styles.ampelDot,
                      backgroundColor: isSelected ? color : `${color}30`,
                      borderColor: isSelected ? color : 'transparent',
                    }}
                    onClick={() => handleItemChange(item.id, 'ampel', key)}
                    title={key.charAt(0).toUpperCase() + key.slice(1)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 1.5: Neubewertung (Wahrscheinlichkeit + Auswirkung) */}
        {probabilityOptions.length > 0 && impactOptions.length > 0 && (
          <div style={styles.fieldGrid}>
            <div style={styles.fieldGroup}>
              <span style={styles.label}>Wahrscheinlichkeit</span>
              <select
                style={styles.select}
                value={item.wahrscheinlichkeit || ''}
                onChange={(e) => handleItemChange(item.id, 'wahrscheinlichkeit', e.target.value)}
                onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
                onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
              >
                <option value="">-- Auswählen --</option>
                {probabilityOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div style={styles.fieldGroup}>
              <span style={styles.label}>Auswirkung (Bewertung)</span>
              <select
                style={styles.select}
                value={item.auswirkung_bewertung || ''}
                onChange={(e) => handleItemChange(item.id, 'auswirkung_bewertung', e.target.value)}
                onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
                onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
              >
                <option value="">-- Auswählen --</option>
                {impactOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Row 2: Dates */}
        <div style={styles.fieldGrid}>
          <div style={styles.fieldGroup}>
            <span style={styles.label}>Erkannt</span>
            <input
              type="date"
              style={styles.input}
              value={item.erkannt}
              onChange={(e) => handleItemChange(item.id, 'erkannt', e.target.value)}
              onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
              onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
            />
          </div>
          <div style={styles.fieldGroup}>
            <span style={styles.label}>Aktualisiert</span>
            <input
              type="date"
              style={styles.readonlyInput}
              value={item.aktualisiert}
              readOnly
            />
          </div>
          <div style={styles.fieldGroup}>
            <span style={styles.label}>Erwartet bis</span>
            <input
              type="date"
              style={styles.input}
              value={item.erwartet_bis}
              onChange={(e) => handleItemChange(item.id, 'erwartet_bis', e.target.value)}
              onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
              onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
            />
          </div>
        </div>

        {/* Row 3: Text fields */}
        <div style={styles.textareaRow}>
          <div style={styles.fieldGroup}>
            <span style={styles.label}>Beschreibung</span>
            <textarea
              style={styles.textarea}
              value={item.beschreibung}
              onChange={(e) => handleItemChange(item.id, 'beschreibung', e.target.value)}
              placeholder="Beschreibung..."
              onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
              onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
            />
          </div>
          <div style={styles.fieldGroup}>
            <span style={styles.label}>Auswirkung</span>
            <textarea
              style={styles.textarea}
              value={item.auswirkung}
              onChange={(e) => handleItemChange(item.id, 'auswirkung', e.target.value)}
              placeholder="Auswirkung..."
              onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
              onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
            />
          </div>
          <div style={styles.fieldGroup}>
            <span style={styles.label}>Maßnahmen</span>
            <textarea
              style={styles.textarea}
              value={item.massnahmen}
              onChange={(e) => handleItemChange(item.id, 'massnahmen', e.target.value)}
              placeholder="Maßnahmen..."
              onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
              onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Risiken</h2>
        <p style={styles.subtitle}>
          Verfolgen Sie Bedrohungen und Chancen mit Strategie, Status und Maßnahmen.
        </p>
      </div>

      {/* View tabs */}
      <div style={styles.tabs}>
        {[
          { id: 'liste', label: `Liste (${riskTracking.length})` },
          { id: 'matrix', label: 'Risikobewegung' },
        ].map((tab) => {
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
              onClick={() => setActiveView(tab.id)}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Liste View */}
      {activeView === 'liste' && (
        <>
          {/* Bedrohungen */}
          <div>
            <div style={styles.sectionLabel}>Bedrohungen</div>
            <div style={styles.itemList}>
              {bedrohungen.map((item, i) => renderItem(item, i))}
              {bedrohungen.length === 0 && (
                <div style={styles.emptyState}>Keine Bedrohungen erfasst.</div>
              )}
              <button
                style={styles.addBtn}
                onClick={() => addItem('bedrohung')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.primary;
                  e.currentTarget.style.color = theme.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.border;
                  e.currentTarget.style.color = theme.colors.textMuted;
                }}
              >
                <PlusIcon /> Bedrohung hinzufügen
              </button>
            </div>
          </div>

          {/* Chancen */}
          <div>
            <div style={styles.sectionLabel}>Chancen</div>
            <div style={styles.itemList}>
              {chancen.map((item, i) => renderItem(item, i))}
              {chancen.length === 0 && (
                <div style={styles.emptyState}>Keine Chancen erfasst.</div>
              )}
              <button
                style={styles.addBtn}
                onClick={() => addItem('chance')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.primary;
                  e.currentTarget.style.color = theme.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.border;
                  e.currentTarget.style.color = theme.colors.textMuted;
                }}
              >
                <PlusIcon /> Chance hinzufügen
              </button>
            </div>
          </div>
        </>
      )}

      {/* Risikobewegung View */}
      {activeView === 'matrix' && (
        <RiskMovementMatrix
          riskTracking={riskTracking}
          projektauftragRisks={projektauftrag?.risks || []}
          probabilityOptions={probabilityOptions}
          impactOptions={impactOptions}
        />
      )}
    </div>
  );
}

// ============== Icons ==============

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default StatusberichtRisiken;
