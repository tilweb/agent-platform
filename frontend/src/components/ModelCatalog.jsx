/**
 * ModelCatalog — flache Modell-Liste über alle aktiven Provider.
 *
 * Kundensicht "Adacor als Modellrouter": Modelle werden aus einer Hand
 * bereitgestellt; die Provider-/Vertragsebene ist Technik und lebt in der
 * eingeklappten Provider-Verwaltung. Das sichtbare Datenschutz-Signal ist
 * bewusst nur die Data Residency (Flagge) — volle Transparenz (Betreiber,
 * Firmensitz, Einordnung) liegt einen Klick entfernt im Detail-Dialog.
 */

import { useMemo, useState } from 'react';
import { theme } from '../config/theme';
import CountryFlag from './CountryFlag';
import {
  getModelResidency,
  getModelManufacturer,
  calculateSecurityTier,
  dataProtectionSummaries,
  getRegionLabel,
  typeColors,
  capabilityLabels,
  formatContextLength,
  EU_EEA_COUNTRIES,
} from '../utils/providerMeta';

const styles = {
  section: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  countBadge: {
    fontSize: theme.typography.sizes.xs,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
    padding: `1px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  sectionSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  toolbar: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.lg,
  },
  searchInput: {
    flex: 1,
    minWidth: '200px',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    boxSizing: 'border-box',
  },
  filterChips: {
    display: 'flex',
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  filterChip: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  euFilter: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  // Zeilen
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
    padding: `${theme.spacing.md} ${theme.spacing.sm}`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  rowManufacturer: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  rowMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: '3px',
    flexWrap: 'wrap',
  },
  modelIdText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontMono,
  },
  capChip: {
    fontSize: '10px',
    padding: `1px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  typeChip: {
    fontSize: '10px',
    padding: `1px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    fontWeight: theme.typography.weights.semibold,
    letterSpacing: '0.03em',
  },
  contextCol: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontMono,
    width: '48px',
    textAlign: 'right',
    flexShrink: 0,
  },
  residencySectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.lg} ${theme.spacing.sm} ${theme.spacing.sm}`,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  residencySectionCount: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    textTransform: 'none',
    letterSpacing: 'normal',
  },
  residencyCol: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    width: '150px',
    flexShrink: 0,
  },
  residencyFlag: {
    fontSize: theme.typography.sizes.base,
  },
  actionsCol: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexShrink: 0,
  },
  iconButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.textMuted,
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    display: 'flex',
    alignItems: 'center',
    transition: `color ${theme.transitions.fast}`,
  },
  toggle: {
    position: 'relative',
    width: '36px',
    height: '20px',
    borderRadius: theme.borderRadius.full,
    border: 'none',
    cursor: 'pointer',
    transition: `background-color ${theme.transitions.fast}`,
    flexShrink: 0,
    padding: 0,
  },
  toggleKnob: {
    position: 'absolute',
    top: '2px',
    width: '16px',
    height: '16px',
    borderRadius: theme.borderRadius.full,
    backgroundColor: '#fff',
    transition: `left ${theme.transitions.fast}`,
  },
  empty: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  // Detail-Modal
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    width: '90%',
    maxWidth: '520px',
    maxHeight: '85vh',
    overflow: 'auto',
    padding: theme.spacing.xl,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  modalSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontMono,
    marginBottom: theme.spacing.lg,
  },
  detailGroup: {
    marginBottom: theme.spacing.lg,
  },
  detailLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.xs,
  },
  detailValue: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: 1.5,
  },
  trustNote: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 1.5,
    backgroundColor: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  closeButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
};

// Fähigkeits-Filter: fasst die Modell-Typen kundenfreundlich zusammen
const CAPABILITY_FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'chat', label: 'Chat' },
  { id: 'vision', label: 'Vision' },
  { id: 'image', label: 'Bild' },
  { id: 'audio', label: 'Audio' },
  { id: 'embedding', label: 'Embedding' },
];

// Data-Residency-Sektionen: Deutschland zuerst (Positionierung Datenschutz &
// Souveränität), dann Europa, dann USA. Fallback "International" für alles
// andere bzw. Modelle ohne hinterlegten Standort.
// Sektionen entsprechen den fünf Flaggen-Kategorien (s. CountryFlag):
// DE, EU/EWR, Schweiz, USA, Welt.
const RESIDENCY_SECTIONS = [
  { id: 'de', label: 'Deutschland', code: 'de' },
  { id: 'eu', label: 'Europa', code: 'eu' },
  { id: 'ch', label: 'Schweiz', code: 'ch' },
  { id: 'us', label: 'USA', code: 'us' },
  { id: 'other', label: 'International', code: 'un' },
];

function residencySectionId(model, provider) {
  const code = model.datacenter_country || provider.datacenter_country;
  if (code === 'DE') return 'de';
  if (code === 'CH') return 'ch';
  if (code === 'US') return 'us';
  if (code && EU_EEA_COUNTRIES.includes(code)) return 'eu';
  return 'other';
}

function matchesCapabilityFilter(model, filterId) {
  const caps = Array.isArray(model.capabilities) ? model.capabilities : [];
  switch (filterId) {
    case 'all': return true;
    case 'chat': return caps.includes('chat');
    case 'vision': return caps.includes('vision');
    case 'image': return model.type === 'image_gen';
    case 'audio': return model.type === 'tts' || model.type === 'stt';
    case 'embedding': return model.type === 'embedding' || caps.includes('embedding');
    default: return true;
  }
}

function ModelToggle({ enabled, onChange, title }) {
  return (
    <button
      type="button"
      style={{
        ...styles.toggle,
        backgroundColor: enabled ? theme.colors.primary : theme.colors.border,
      }}
      onClick={onChange}
      title={title}
    >
      <span style={{ ...styles.toggleKnob, left: enabled ? '18px' : '2px' }} />
    </button>
  );
}

function InfoIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function PenIconSmall({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function ModelDetailModal({ entry, onClose }) {
  const { model, provider } = entry;
  const residency = getModelResidency(model, provider);
  const manufacturer = getModelManufacturer(model);
  const effectiveTier = calculateSecurityTier(provider.company_region, model.datacenter_country || provider.datacenter_country);
  const region = getRegionLabel(provider.company_region);
  const caps = Array.isArray(model.capabilities) ? model.capabilities : [];
  const context = formatContextLength(model.context_length);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalTitle}>{model.name}</div>
        <div style={styles.modalSubtitle}>{model.id}</div>

        {manufacturer && (
          <div style={styles.detailGroup}>
            <div style={styles.detailLabel}>Hersteller</div>
            <div style={styles.detailValue}>{manufacturer}</div>
          </div>
        )}

        <div style={styles.detailGroup}>
          <div style={styles.detailLabel}>Datenverarbeitung</div>
          <div style={styles.detailValue}>
            {residency
              ? <>Rechenzentrum: <CountryFlag code={residency.code} size={14} title={residency.name} /> {residency.name}</>
              : 'Rechenzentrum-Standort nicht hinterlegt'}
            <br />
            Betreiber: {provider.name}
            {region && <> · Firmensitz: <CountryFlag region={provider.company_region} size={14} title={region.label} /> {region.label}</>}
            <br />
            {dataProtectionSummaries[effectiveTier]}
          </div>
        </div>

        <div style={styles.detailGroup}>
          <div style={styles.detailLabel}>Eigenschaften</div>
          <div style={styles.detailValue}>
            {caps.map((c) => capabilityLabels[c] || c).join(' · ') || '—'}
            {context ? ` · Kontextfenster: ${context} Tokens` : ''}
          </div>
        </div>

        <div style={{ ...styles.detailGroup, ...styles.trustNote }}>
          Dieses Modell wird über die Adacor-Plattform bereitgestellt und abgerechnet.
          Auftragsverarbeitung, Datenschutzprüfung und Subdienstleister-Management sind
          zentral über Adacor geregelt — es entsteht keine eigene Vertragsbeziehung zum
          Modellbetreiber.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" style={styles.closeButton} onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

/**
 * @param providers  alle Provider (enabled werden gelistet)
 * @param onToggleModel  (providerId, model, nextEnabled) => Promise
 * @param onEditModel    (providerId, model) => void — öffnet das technische Modell-Modal
 */
function ModelCatalog({ providers, onToggleModel, onEditModel }) {
  const [search, setSearch] = useState('');
  const [capFilter, setCapFilter] = useState('all');
  const [euOnly, setEuOnly] = useState(false);
  const [detailEntry, setDetailEntry] = useState(null);

  // Flache Liste (nur aktive Provider), alphabetisch nach Anzeigename
  const entries = useMemo(() => {
    const list = [];
    for (const provider of providers) {
      if (!provider.enabled) continue;
      for (const model of provider.models || []) {
        list.push({ provider, model });
      }
    }
    return list.sort((a, b) => (a.model.name || '').localeCompare(b.model.name || '', 'de', { sensitivity: 'base' }));
  }, [providers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(({ provider, model }) => {
      if (!matchesCapabilityFilter(model, capFilter)) return false;
      if (euOnly) {
        const code = model.datacenter_country || provider.datacenter_country;
        if (!code || !EU_EEA_COUNTRIES.includes(code)) return false;
      }
      if (q) {
        const manufacturer = getModelManufacturer(model) || '';
        const hay = `${model.name} ${model.id} ${manufacturer}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, search, capFilter, euOnly]);

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>
        Modellkatalog
        <span style={styles.countBadge}>{filtered.length}{filtered.length !== entries.length ? ` / ${entries.length}` : ''}</span>
      </div>
      <p style={styles.sectionSubtitle}>
        Freigegebene Modelle stehen den Nutzern und Agenten dieser Instanz zur Verfügung.
      </p>

      <div style={styles.toolbar}>
        <input
          type="text"
          style={styles.searchInput}
          placeholder="Modell oder Hersteller suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
          onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
        />
        <div style={styles.filterChips}>
          {CAPABILITY_FILTERS.map((f) => {
            const isActive = capFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                style={{ ...styles.filterChip, ...(isActive ? styles.filterChipActive : {}) }}
                onClick={() => setCapFilter(f.id)}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <label style={styles.euFilter}>
          <input type="checkbox" checked={euOnly} onChange={(e) => setEuOnly(e.target.checked)} />
          Nur EU/EWR-Verarbeitung
        </label>
      </div>

      {filtered.length === 0 ? (
        <div style={styles.empty}>Keine Modelle für diese Filter.</div>
      ) : (
        RESIDENCY_SECTIONS.map((section) => {
          const sectionEntries = filtered.filter(
            (e) => residencySectionId(e.model, e.provider) === section.id,
          );
          if (sectionEntries.length === 0) return null;
          return (
            <div key={section.id}>
              <div style={styles.residencySectionHeader}>
                <CountryFlag code={section.code} size={16} title={section.label} />
                <span>Data Residency {section.label}</span>
                <span style={styles.residencySectionCount}>({sectionEntries.length})</span>
              </div>
              {sectionEntries.map((entry) => {
          const { provider, model } = entry;
          const enabled = model.enabled !== false;
          const residency = getModelResidency(model, provider);
          const manufacturer = getModelManufacturer(model);
          const typeColor = typeColors[model.type] || typeColors.llm;
          const caps = Array.isArray(model.capabilities) ? model.capabilities : [];
          const context = formatContextLength(model.context_length);

          return (
            <div
              key={`${provider.id}::${model.id}`}
              style={{ ...styles.row, ...(enabled ? {} : styles.rowDisabled) }}
            >
              <ModelToggle
                enabled={enabled}
                onChange={() => onToggleModel(provider.id, model, !enabled)}
                title={enabled ? 'Modell sperren (für Nutzer ausblenden)' : 'Modell freigeben'}
              />
              <div style={styles.rowMain}>
                <div style={styles.rowName}>
                  {model.name}
                  {manufacturer && <span style={styles.rowManufacturer}>{manufacturer}</span>}
                  <span style={{ ...styles.typeChip, backgroundColor: typeColor.bg, color: typeColor.color }}>
                    {model.type === 'image_gen' ? 'IMAGE' : model.type.toUpperCase()}
                  </span>
                </div>
                <div style={styles.rowMeta}>
                  <span style={styles.modelIdText}>{model.id}</span>
                  {caps.filter((c) => c !== 'chat').map((cap) => (
                    <span key={cap} style={styles.capChip}>{capabilityLabels[cap] || cap}</span>
                  ))}
                </div>
              </div>
              <div style={styles.contextCol} title={model.context_length ? `Kontextfenster: ${model.context_length.toLocaleString('de-DE')} Tokens` : undefined}>
                {context || ''}
              </div>
              <div
                style={styles.residencyCol}
                title={residency ? `Datenverarbeitung: ${residency.name}` : 'Rechenzentrum-Standort nicht hinterlegt'}
              >
                <span style={styles.residencyFlag}>
                  {residency ? <CountryFlag code={residency.code} size={16} title={residency.name} /> : '—'}
                </span>
                <span>{residency?.name || 'k.A.'}</span>
              </div>
              <div style={styles.actionsCol}>
                <button
                  type="button"
                  style={styles.iconButton}
                  onClick={() => setDetailEntry(entry)}
                  title="Details zu Datenschutz & Eigenschaften"
                  onMouseEnter={(e) => { e.currentTarget.style.color = theme.colors.primary; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = theme.colors.textMuted; }}
                >
                  <InfoIcon />
                </button>
                {onEditModel && (
                  <button
                    type="button"
                    style={styles.iconButton}
                    onClick={() => onEditModel(provider.id, model)}
                    title="Modell bearbeiten (technisch)"
                    onMouseEnter={(e) => { e.currentTarget.style.color = theme.colors.primary; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = theme.colors.textMuted; }}
                  >
                    <PenIconSmall />
                  </button>
                )}
              </div>
            </div>
          );
              })}
            </div>
          );
        })
      )}

      {detailEntry && (
        <ModelDetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} />
      )}
    </div>
  );
}

export default ModelCatalog;
