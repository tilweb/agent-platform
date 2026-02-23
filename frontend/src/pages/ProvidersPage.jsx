import { useState, useEffect, useRef } from 'react';
import { theme } from '../config/theme';
import { useProviders } from '../hooks/useProviders';
import { useToast } from '../components/Toast';
import Select from '../components/Select';
import { PlusIcon, EditIcon } from '../components/Icons';

const styles = {
  container: {
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xl,
  },
  headerContent: {},
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textMuted,
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  // Active Models Section
  activeSection: {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
  },
  activeSectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  activeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: theme.spacing.lg,
  },
  activeCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  activeCardLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.sm,
  },
  // Provider List
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  // Provider Card
  providerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  providerCardExpanded: {
    borderColor: theme.colors.primary,
  },
  providerHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing.lg,
    cursor: 'pointer',
    gap: theme.spacing.md,
  },
  providerIcon: {
    width: '40px',
    height: '40px',
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    flexShrink: 0,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  providerMeta: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginTop: '2px',
    fontFamily: theme.typography.fontMono,
  },
  providerActions: {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  statusActive: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  statusInactive: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  actionButton: {
    padding: theme.spacing.sm,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    color: theme.colors.textMuted,
    transition: `all ${theme.transitions.fast}`,
  },
  testButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  chevron: {
    transition: `transform ${theme.transitions.fast}`,
  },
  chevronExpanded: {
    transform: 'rotate(180deg)',
  },
  // Provider Details
  providerDetails: {
    padding: `0 ${theme.spacing.lg} ${theme.spacing.lg}`,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  detailItem: {
    fontSize: theme.typography.sizes.sm,
  },
  detailLabel: {
    color: theme.colors.textMuted,
    marginBottom: '2px',
  },
  detailValue: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontMono,
    wordBreak: 'break-all',
  },
  // Models List
  modelsSection: {
    marginTop: theme.spacing.lg,
  },
  modelsSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modelsSectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  addModelButton: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  modelsList: {
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  modelItem: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
    gap: theme.spacing.md,
  },
  modelItemLast: {
    borderBottom: 'none',
  },
  modelInfo: {
    flex: '0 0 40%',
    minWidth: 0,
  },
  modelName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  modelId: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontMono,
  },
  typeBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    fontWeight: theme.typography.weights.medium,
  },
  capabilityBadge: {
    fontSize: '10px',
    padding: `1px ${theme.spacing.xs}`,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.xs,
  },
  defaultBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `1px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    marginLeft: theme.spacing.sm,
  },
  protectedBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `1px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.infoLight,
    color: theme.colors.info,
    marginLeft: theme.spacing.sm,
  },
  // Modal
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: theme.spacing.xl,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: theme.shadows.xl,
  },
  modalHeader: {
    padding: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  modalBody: {
    padding: theme.spacing.xl,
  },
  modalFooter: {
    padding: theme.spacing.xl,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
  },
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  input: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  inputMono: {
    fontFamily: theme.typography.fontMono,
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.md,
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  cancelButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  saveButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  deleteButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    marginRight: 'auto',
  },
  // Loading
  loading: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  testResult: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
  },
  testSuccess: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  testError: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    cursor: 'pointer',
  },
  checkboxInput: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  // Info Box
  infoBox: {
    backgroundColor: theme.colors.infoLight,
    border: `1px solid ${theme.colors.info}30`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  infoBoxTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.info,
    marginBottom: theme.spacing.sm,
  },
  infoBoxList: {
    margin: 0,
    paddingLeft: theme.spacing.xl,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  codeBlock: {
    display: 'inline-block',
    backgroundColor: theme.colors.background,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    fontFamily: theme.typography.fontMono,
    fontSize: theme.typography.sizes.xs,
    marginTop: theme.spacing.xs,
  },
  // Location badges in provider list
  locationBadges: {
    marginLeft: theme.spacing.md,
    display: 'inline-flex',
    gap: theme.spacing.xs,
  },
  locationBadge: {
    fontSize: '14px',
    cursor: 'help',
  },
  // Security tier section
  tierSection: {
    marginBottom: theme.spacing.xl,
  },
  tierHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  tierShields: {
    display: 'flex',
    gap: '2px',
    flexShrink: 0,
    marginTop: '2px',
  },
  tierInfo: {
    flex: 1,
  },
  tierLabel: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    marginBottom: '2px',
  },
  tierSubtitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.xs,
  },
  tierDescription: {
    fontSize: theme.typography.sizes.sm,
    lineHeight: '1.5',
  },
  tierProviders: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  securityBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    marginLeft: theme.spacing.sm,
  },
  disabledBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `1px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.sm,
  },
  listedOnlyBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `1px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
    marginLeft: theme.spacing.sm,
  },
  syncButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  syncResult: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  syncStat: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontMono,
  },
  featureBadges: {
    display: 'inline-flex',
    gap: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  featureBadge: {
    fontSize: '10px',
    padding: `1px ${theme.spacing.xs}`,
    borderRadius: theme.borderRadius.sm,
    fontWeight: theme.typography.weights.medium,
  },
};

const typeColors = {
  llm: { bg: '#3b82f620', color: '#3b82f6' },
  vllm: { bg: '#8b5cf620', color: '#8b5cf6' },
  tts: { bg: '#10b98120', color: '#10b981' },
  stt: { bg: '#f59e0b20', color: '#f59e0b' },
  image_gen: { bg: '#ec489920', color: '#ec4899' },
};

// Feature-bit to badge mapping for Adacor featureSet
const featureBits = [
  { bit: 1,   label: 'Chat',       bg: '#3b82f620', color: '#3b82f6', suffixes: ['/v1/chat/completions', '/completions'] },
  { bit: 2,   label: 'Vision',     bg: '#ec489920', color: '#ec4899', suffixes: [] },
  { bit: 4,   label: 'Tools',      bg: '#6366f120', color: '#6366f1', suffixes: [] },
  { bit: 32,  label: 'Embeddings', bg: '#8b5cf620', color: '#8b5cf6', suffixes: ['/v1/embeddings'] },
  { bit: 64,  label: 'Audio',      bg: '#f59e0b20', color: '#f59e0b', suffixes: ['/v1/transcriptions', '/v1/translations'] },
  { bit: 128, label: 'Tokenize',   bg: '#10b98120', color: '#10b981', suffixes: ['/tokenize', '/detokenize'] },
];

/**
 * Strip the domain from a URL, returning only the path.
 */
function stripDomain(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Extract the base domain from a model's base_url or feature_urls.
 */
function getModelBaseDomain(model) {
  const url = model.base_url
    || (model.feature_urls && Object.values(model.feature_urls)[0]);
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/**
 * Get feature endpoint paths for a model (without domain).
 * Uses stored feature_urls if available, otherwise derives from base_url + feature_set.
 */
function getModelFeaturePaths(model) {
  if (model.feature_urls && Object.keys(model.feature_urls).length > 0) {
    const paths = {};
    for (const [suffix, url] of Object.entries(model.feature_urls)) {
      paths[suffix] = stripDomain(url);
    }
    return paths;
  }
  if (!model.base_url) return null;
  const basePath = stripDomain(model.base_url);
  // Fallback: derive from base_url + feature_set
  if (model.feature_set != null) {
    const paths = {};
    for (const f of featureBits) {
      if (!(model.feature_set & f.bit)) continue;
      for (const suffix of f.suffixes) {
        paths[suffix] = basePath + suffix;
      }
    }
    if (Object.keys(paths).length > 0) return paths;
  }
  // No feature_set — show base_url path as single entry
  return { '': basePath };
}

const providerIcons = {
  adacor: { icon: 'A', bg: '#3b82f620', color: '#3b82f6' },
  openai: { icon: 'O', bg: '#10b98120', color: '#10b981' },
  anthropic: { icon: 'C', bg: '#f59e0b20', color: '#f59e0b' },
  ollama: { icon: 'L', bg: '#8b5cf620', color: '#8b5cf6' },
  custom: { icon: '+', bg: '#ec489920', color: '#ec4899' },
};

// Company region options
const companyRegions = [
  { value: 'germany', label: 'Deutschland', flag: '🇩🇪' },
  { value: 'eu', label: 'EU', flag: '🇪🇺' },
  { value: 'world', label: 'International', flag: '🌍' },
];

// EU/EEA countries for security tier calculation
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', // EEA
  'CH', 'GB' // Adequate countries
];

// Security tier calculation
function calculateSecurityTier(companyRegion, datacenterCountry) {
  const isGermanCompany = companyRegion === 'germany';
  const isEuCompany = companyRegion === 'eu' || isGermanCompany;
  const isGermanDC = datacenterCountry === 'DE';
  const isEuDC = datacenterCountry ? EU_COUNTRIES.includes(datacenterCountry) : false;

  if (isGermanCompany && isGermanDC) return 1;
  if (isEuCompany && isEuDC) return 2;
  if (!isEuCompany && isEuDC) return 3;
  return 4;
}

// Security tier definitions
const securityTiers = {
  1: {
    label: 'Maximale Sicherheit',
    subtitle: 'Deutscher Anbieter · Deutsches Rechenzentrum',
    description: 'Höchstes Datenschutzniveau. Deutscher Anbieter mit Serverinfrastruktur in deutschen Rechenzentren. Vollständige DSGVO-Konformität unter deutschem Recht.',
    color: '#10b981', // green
    bgColor: '#10b98115',
    borderColor: '#10b98140',
    shieldCount: 4,
  },
  2: {
    label: 'Sehr hohe Sicherheit',
    subtitle: 'EU-Anbieter · EU-Rechenzentrum',
    description: 'Europäischer Anbieter mit Rechenzentren innerhalb der EU/EWR. DSGVO-konform ohne Drittlandtransfer.',
    color: '#3b82f6', // blue
    bgColor: '#3b82f615',
    borderColor: '#3b82f640',
    shieldCount: 3,
  },
  3: {
    label: 'Hohe Sicherheit',
    subtitle: 'Internationaler Anbieter · EU-Datenresidenz',
    description: 'Internationaler Anbieter (z.B. US-Hyperscaler) mit garantierter Datenverarbeitung in europäischen Rechenzentren. EU-Datenresidenz vertraglich zugesichert.',
    color: '#f59e0b', // amber
    bgColor: '#f59e0b15',
    borderColor: '#f59e0b40',
    shieldCount: 2,
  },
  4: {
    label: 'Standard',
    subtitle: 'Internationaler Anbieter · Weltweite Rechenzentren',
    description: 'Internationaler Anbieter ohne EU-Datenresidenz. Datenverarbeitung kann außerhalb der EU erfolgen. Zusätzliche vertragliche Absicherungen empfohlen.',
    color: '#6b7280', // gray
    bgColor: '#6b728015',
    borderColor: '#6b728040',
    shieldCount: 1,
  },
};

// Country list with favorites first, then alphabetically sorted
const favoriteCountries = [
  { code: 'DE', name: 'Deutschland', flag: '🇩🇪' },
  { code: 'NL', name: 'Niederlande', flag: '🇳🇱' },
  { code: 'FR', name: 'Frankreich', flag: '🇫🇷' },
  { code: 'CH', name: 'Schweiz', flag: '🇨🇭' },
  { code: 'FI', name: 'Finnland', flag: '🇫🇮' },
  { code: 'SE', name: 'Schweden', flag: '🇸🇪' },
  { code: 'US', name: 'USA', flag: '🇺🇸' },
  { code: 'GB', name: 'Großbritannien', flag: '🇬🇧' },
];

const allCountries = [
  { code: 'AF', name: 'Afghanistan', flag: '🇦🇫' },
  { code: 'AL', name: 'Albanien', flag: '🇦🇱' },
  { code: 'DZ', name: 'Algerien', flag: '🇩🇿' },
  { code: 'AD', name: 'Andorra', flag: '🇦🇩' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴' },
  { code: 'AR', name: 'Argentinien', flag: '🇦🇷' },
  { code: 'AM', name: 'Armenien', flag: '🇦🇲' },
  { code: 'AU', name: 'Australien', flag: '🇦🇺' },
  { code: 'AT', name: 'Österreich', flag: '🇦🇹' },
  { code: 'AZ', name: 'Aserbaidschan', flag: '🇦🇿' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭' },
  { code: 'BD', name: 'Bangladesch', flag: '🇧🇩' },
  { code: 'BY', name: 'Belarus', flag: '🇧🇾' },
  { code: 'BE', name: 'Belgien', flag: '🇧🇪' },
  { code: 'BA', name: 'Bosnien und Herzegowina', flag: '🇧🇦' },
  { code: 'BR', name: 'Brasilien', flag: '🇧🇷' },
  { code: 'BG', name: 'Bulgarien', flag: '🇧🇬' },
  { code: 'CA', name: 'Kanada', flag: '🇨🇦' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'CO', name: 'Kolumbien', flag: '🇨🇴' },
  { code: 'HR', name: 'Kroatien', flag: '🇭🇷' },
  { code: 'CY', name: 'Zypern', flag: '🇨🇾' },
  { code: 'CZ', name: 'Tschechien', flag: '🇨🇿' },
  { code: 'DK', name: 'Dänemark', flag: '🇩🇰' },
  { code: 'DE', name: 'Deutschland', flag: '🇩🇪' },
  { code: 'EG', name: 'Ägypten', flag: '🇪🇬' },
  { code: 'EE', name: 'Estland', flag: '🇪🇪' },
  { code: 'FI', name: 'Finnland', flag: '🇫🇮' },
  { code: 'FR', name: 'Frankreich', flag: '🇫🇷' },
  { code: 'GE', name: 'Georgien', flag: '🇬🇪' },
  { code: 'GR', name: 'Griechenland', flag: '🇬🇷' },
  { code: 'GB', name: 'Großbritannien', flag: '🇬🇧' },
  { code: 'HK', name: 'Hongkong', flag: '🇭🇰' },
  { code: 'HU', name: 'Ungarn', flag: '🇭🇺' },
  { code: 'IS', name: 'Island', flag: '🇮🇸' },
  { code: 'IN', name: 'Indien', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesien', flag: '🇮🇩' },
  { code: 'IR', name: 'Iran', flag: '🇮🇷' },
  { code: 'IQ', name: 'Irak', flag: '🇮🇶' },
  { code: 'IE', name: 'Irland', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'IT', name: 'Italien', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordanien', flag: '🇯🇴' },
  { code: 'KZ', name: 'Kasachstan', flag: '🇰🇿' },
  { code: 'KE', name: 'Kenia', flag: '🇰🇪' },
  { code: 'KR', name: 'Südkorea', flag: '🇰🇷' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼' },
  { code: 'LV', name: 'Lettland', flag: '🇱🇻' },
  { code: 'LB', name: 'Libanon', flag: '🇱🇧' },
  { code: 'LI', name: 'Liechtenstein', flag: '🇱🇮' },
  { code: 'LT', name: 'Litauen', flag: '🇱🇹' },
  { code: 'LU', name: 'Luxemburg', flag: '🇱🇺' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'MT', name: 'Malta', flag: '🇲🇹' },
  { code: 'MX', name: 'Mexiko', flag: '🇲🇽' },
  { code: 'MD', name: 'Moldawien', flag: '🇲🇩' },
  { code: 'MC', name: 'Monaco', flag: '🇲🇨' },
  { code: 'ME', name: 'Montenegro', flag: '🇲🇪' },
  { code: 'MA', name: 'Marokko', flag: '🇲🇦' },
  { code: 'NL', name: 'Niederlande', flag: '🇳🇱' },
  { code: 'NZ', name: 'Neuseeland', flag: '🇳🇿' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'MK', name: 'Nordmazedonien', flag: '🇲🇰' },
  { code: 'NO', name: 'Norwegen', flag: '🇳🇴' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'PA', name: 'Panama', flag: '🇵🇦' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: 'PH', name: 'Philippinen', flag: '🇵🇭' },
  { code: 'PL', name: 'Polen', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'QA', name: 'Katar', flag: '🇶🇦' },
  { code: 'RO', name: 'Rumänien', flag: '🇷🇴' },
  { code: 'RU', name: 'Russland', flag: '🇷🇺' },
  { code: 'SA', name: 'Saudi-Arabien', flag: '🇸🇦' },
  { code: 'RS', name: 'Serbien', flag: '🇷🇸' },
  { code: 'SG', name: 'Singapur', flag: '🇸🇬' },
  { code: 'SK', name: 'Slowakei', flag: '🇸🇰' },
  { code: 'SI', name: 'Slowenien', flag: '🇸🇮' },
  { code: 'ZA', name: 'Südafrika', flag: '🇿🇦' },
  { code: 'ES', name: 'Spanien', flag: '🇪🇸' },
  { code: 'SE', name: 'Schweden', flag: '🇸🇪' },
  { code: 'CH', name: 'Schweiz', flag: '🇨🇭' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'TR', name: 'Türkei', flag: '🇹🇷' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'AE', name: 'Vereinigte Arabische Emirate', flag: '🇦🇪' },
  { code: 'US', name: 'USA', flag: '🇺🇸' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'UZ', name: 'Usbekistan', flag: '🇺🇿' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
].sort((a, b) => a.name.localeCompare(b.name, 'de'));

// Helper to get country by code
const getCountryByCode = (code) => {
  return allCountries.find(c => c.code === code) || favoriteCountries.find(c => c.code === code);
};

// Helper to get region label
const getRegionLabel = (region) => {
  return companyRegions.find(r => r.value === region) || null;
};

const defaultProviderForm = {
  name: '',
  api_mode: 'openai',
  base_url: '',
  api_key_env: '',
  enabled: true,
  company_region: '',
  datacenter_country: '',
};

const defaultModelForm = {
  id: '',
  name: '',
  type: 'llm',
  capabilities: ['chat'],
  default: false,
};

function ProvidersPage({ embedded = false }) {
  const {
    providers,
    activeSelection,
    allowCustomProviders,
    modelSyncConfigured,
    isLoading,
    error: hookError,
    createProvider,
    updateProvider,
    deleteProvider,
    addModel,
    updateModel,
    deleteModel,
    setActiveModel,
    testConnection,
    syncModels,
    getModelsForPurpose,
  } = useProviders();

  const toast = useToast();
  const [expandedProviders, setExpandedProviders] = useState({});
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [editingModel, setEditingModel] = useState(null);
  const [providerForm, setProviderForm] = useState(defaultProviderForm);
  const [modelForm, setModelForm] = useState(defaultModelForm);
  const [modelProviderId, setModelProviderId] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const toggleProvider = (id) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCreateProvider = () => {
    setEditingProvider(null);
    setProviderForm(defaultProviderForm);
    setShowProviderModal(true);
  };

  const handleEditProvider = (provider) => {
    setEditingProvider(provider);
    setProviderForm({
      name: provider.name,
      api_mode: provider.api_mode,
      base_url: provider.base_url,
      api_key_env: provider.api_key_env || '',
      enabled: provider.enabled,
      company_region: provider.company_region || '',
      datacenter_country: provider.datacenter_country || '',
    });
    setShowProviderModal(true);
  };

  const handleSaveProvider = async () => {
    try {
      if (editingProvider) {
        await updateProvider(editingProvider.id, providerForm);
        toast.success('Gespeichert', `Provider "${providerForm.name}" gespeichert`);
      } else {
        await createProvider(providerForm);
        toast.success('Erstellt', `Provider "${providerForm.name}" erstellt`);
      }
      setShowProviderModal(false);
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  const handleDeleteProvider = async () => {
    if (!editingProvider) return;
    if (!confirm(`Provider "${editingProvider.name}" wirklich löschen?`)) return;

    try {
      await deleteProvider(editingProvider.id);
      setShowProviderModal(false);
      toast.success('Gelöscht', `Provider "${editingProvider.name}" gelöscht`);
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  const handleToggleProvider = async (provider) => {
    try {
      await updateProvider(provider.id, { enabled: !provider.enabled });
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  const handleTestConnection = async (providerId) => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(providerId);
      setTestResult({ providerId, ...result });
    } catch (err) {
      setTestResult({ providerId, success: false, message: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncModels = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncModels();
      setSyncResult(result);
    } catch (err) {
      toast.error('Fehler', err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateModel = (providerId) => {
    setEditingModel(null);
    setModelProviderId(providerId);
    setModelForm(defaultModelForm);
    setShowModelModal(true);
  };

  const handleEditModel = (providerId, model) => {
    setEditingModel(model);
    setModelProviderId(providerId);
    setModelForm({
      id: model.id,
      name: model.name,
      type: model.type,
      capabilities: model.capabilities || [],
      default: model.default || false,
    });
    setShowModelModal(true);
  };

  const handleSaveModel = async () => {
    try {
      if (editingModel) {
        await updateModel(modelProviderId, editingModel.id, modelForm);
        toast.success('Gespeichert', `Modell "${modelForm.name}" gespeichert`);
      } else {
        await addModel(modelProviderId, modelForm);
        toast.success('Erstellt', `Modell "${modelForm.name}" erstellt`);
      }
      setShowModelModal(false);
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  const handleDeleteModel = async () => {
    if (!editingModel || !modelProviderId) return;
    if (!confirm(`Modell "${editingModel.name}" wirklich löschen?`)) return;

    try {
      await deleteModel(modelProviderId, editingModel.id);
      setShowModelModal(false);
      toast.success('Gelöscht', `Modell "${editingModel.name}" gelöscht`);
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  const handleActiveModelChange = async (purpose, value) => {
    const purposeLabels = {
      chat: 'Chat', vision: 'Vision', tts: 'TTS', stt: 'STT',
      text_to_image: 'Text → Bild', image_to_image: 'Bild → Bild',
    };
    const label = purposeLabels[purpose] || purpose;

    if (!value) {
      try {
        await setActiveModel(purpose, null, null);
        toast.success('Gespeichert', `${label}-Standard zurückgesetzt`);
      } catch (err) {
        toast.error('Fehler', err.message);
      }
      return;
    }

    const [providerId, modelId] = value.split('::');
    try {
      await setActiveModel(purpose, providerId, modelId);
      toast.success('Gespeichert', `${label}-Modell gespeichert`);
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  const toggleCapability = (cap) => {
    const caps = modelForm.capabilities || [];
    if (caps.includes(cap)) {
      setModelForm({ ...modelForm, capabilities: caps.filter((c) => c !== cap) });
    } else {
      setModelForm({ ...modelForm, capabilities: [...caps, cap] });
    }
  };

  // Show hookError as toast
  const hookErrorRef = useRef(null);
  useEffect(() => {
    if (hookError && hookError !== hookErrorRef.current) {
      toast.error('Fehler', hookError);
    }
    hookErrorRef.current = hookError;
  }, [hookError, toast]);

  if (isLoading) {
    return <div style={styles.loading}>Lade Provider...</div>;
  }

  return (
    <div style={styles.container}>
      {!embedded && (
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <h1 style={styles.title}>KI-Modelle</h1>
            <p style={styles.subtitle}>
              Verwalte Provider und Modelle für Chat, Vision, Text-to-Speech und Speech-to-Text.
            </p>
          </div>
          {allowCustomProviders && (
            <button
              style={styles.addButton}
              onClick={handleCreateProvider}
              onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <PlusIcon />
              Neuer Provider
            </button>
          )}
        </div>
      )}

      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.xl }}>
          <div>
            <h2 style={{ fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginBottom: theme.spacing.xs, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
                <polyline points="7.5 19.79 7.5 14.6 3 12" />
                <polyline points="21 12 16.5 14.6 16.5 19.79" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              KI-Modelle
            </h2>
            <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
              Verwalte Provider und Modelle für Chat, Vision, TTS, STT und Bildgenerierung.
            </p>
          </div>
          {allowCustomProviders && (
            <button
              style={styles.addButton}
              onClick={handleCreateProvider}
              onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <PlusIcon />
              Neuer Provider
            </button>
          )}
        </div>
      )}

      {/* Active Models Section - System Defaults */}
      <div style={styles.activeSection}>
        <h2 style={styles.activeSectionTitle}>System Defaults</h2>
        <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}>
          Diese Einstellungen gelten für alle Benutzer ohne eigene Modell-Präferenzen.
        </p>
        <div style={styles.activeGrid}>
          {['chat', 'vision', 'tts', 'stt', 'text_to_image', 'image_to_image'].map((purpose) => {
            const models = getModelsForPurpose(purpose);
            const active = activeSelection[purpose];
            const currentValue = active?.provider_id && active?.model_id
              ? `${active.provider_id}::${active.model_id}`
              : '';

            const purposeLabels = {
              chat: 'Chat',
              vision: 'Vision',
              tts: 'TTS',
              stt: 'STT',
              text_to_image: 'Text → Bild',
              image_to_image: 'Bild → Bild',
            };

            return (
              <div key={purpose} style={styles.activeCard}>
                <div style={styles.activeCardLabel}>
                  {purposeLabels[purpose] || purpose.toUpperCase()}
                </div>
                <Select
                  value={currentValue}
                  onChange={(e) => handleActiveModelChange(purpose, e.target.value)}
                >
                  <option value="">Nicht konfiguriert</option>
                  {models.map(({ provider, model }) => (
                    <option key={`${provider.id}::${model.id}`} value={`${provider.id}::${model.id}`}>
                      {provider.name} - {model.name}
                    </option>
                  ))}
                </Select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Providers List - Grouped by Security Tier */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>
            Provider nach Datensicherheit
            <span style={styles.sectionBadge}>{providers.length}</span>
          </h2>
        </div>

        {[1, 2, 3, 4].map((tier) => {
          const tierConfig = securityTiers[tier];
          const tierProviders = providers.filter(
            (p) => calculateSecurityTier(p.company_region, p.datacenter_country) === tier
          );

          if (tierProviders.length === 0) return null;

          return (
            <div key={tier} style={styles.tierSection}>
              {/* Tier Header */}
              <div
                style={{
                  ...styles.tierHeader,
                  backgroundColor: tierConfig.bgColor,
                  border: `1px solid ${tierConfig.borderColor}`,
                }}
              >
                <div style={styles.tierShields}>
                  {[...Array(4)].map((_, i) => (
                    <ShieldIcon
                      key={i}
                      size={18}
                      filled={i < tierConfig.shieldCount}
                      color={tierConfig.color}
                    />
                  ))}
                </div>
                <div style={styles.tierInfo}>
                  <div style={{ ...styles.tierLabel, color: tierConfig.color }}>
                    {tierConfig.label}
                  </div>
                  <div style={{ ...styles.tierSubtitle, color: tierConfig.color }}>
                    {tierConfig.subtitle}
                  </div>
                  <div style={{ ...styles.tierDescription, color: theme.colors.textMuted }}>
                    {tierConfig.description}
                  </div>
                </div>
              </div>

              {/* Providers in this tier */}
              <div style={styles.tierProviders}>
                {tierProviders.map((provider) => {
          const isExpanded = expandedProviders[provider.id];
          const iconConfig = providerIcons[provider.id] || providerIcons.custom;
          const providerTestResult = testResult?.providerId === provider.id ? testResult : null;

          return (
            <div
              key={provider.id}
              style={{
                ...styles.providerCard,
                ...(isExpanded ? styles.providerCardExpanded : {}),
              }}
            >
              <div style={styles.providerHeader} onClick={() => toggleProvider(provider.id)}>
                <div
                  style={{
                    ...styles.providerIcon,
                    backgroundColor: iconConfig.bg,
                    color: iconConfig.color,
                  }}
                >
                  {iconConfig.icon}
                </div>
                <div style={styles.providerInfo}>
                  <div style={styles.providerName}>
                    {provider.name}
                    {provider.protected && (
                      <span style={styles.protectedBadge}>System</span>
                    )}
                    <span
                      style={{
                        ...styles.statusBadge,
                        ...(provider.enabled ? styles.statusActive : styles.statusInactive),
                      }}
                    >
                      {provider.enabled ? 'Aktiv' : 'Deaktiviert'}
                    </span>
                  </div>
                  <div style={styles.providerMeta}>
                    {(() => {
                      // Show base domain from models if available (for providers with per-model URLs)
                      const modelDomain = provider.models?.length > 0 && getModelBaseDomain(provider.models[0]);
                      return modelDomain || provider.base_url || 'Keine URL';
                    })()}
                    {(provider.company_region || provider.datacenter_country) && (
                      <span style={styles.locationBadges}>
                        {provider.company_region && (
                          <span style={styles.locationBadge} title={`Firmensitz: ${getRegionLabel(provider.company_region)?.label}`}>
                            {getRegionLabel(provider.company_region)?.flag}
                          </span>
                        )}
                        {provider.datacenter_country && (
                          <span style={styles.locationBadge} title={`Rechenzentrum: ${getCountryByCode(provider.datacenter_country)?.name}`}>
                            {getCountryByCode(provider.datacenter_country)?.flag}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div style={styles.providerActions}>
                  {provider.id === 'adacor' && modelSyncConfigured && (
                    <button
                      style={styles.syncButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSyncModels();
                      }}
                      disabled={isSyncing}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = theme.colors.primary; e.currentTarget.style.color = theme.colors.primary; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = theme.colors.border; e.currentTarget.style.color = theme.colors.text; }}
                    >
                      <RefreshIcon size={14} />
                      {isSyncing ? 'Synchronisiere...' : 'Modelle synchronisieren'}
                    </button>
                  )}
                  <button
                    style={styles.testButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTestConnection(provider.id);
                    }}
                    disabled={isTesting}
                  >
                    {isTesting && testResult?.providerId === provider.id ? 'Teste...' : 'Testen'}
                  </button>
                  <button
                    style={styles.actionButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleProvider(provider);
                    }}
                    title={provider.enabled ? 'Deaktivieren' : 'Aktivieren'}
                  >
                    {provider.enabled ? <ToggleOnIcon /> : <ToggleOffIcon />}
                  </button>
                  <button
                    style={styles.actionButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditProvider(provider);
                    }}
                    title="Bearbeiten"
                    onMouseOver={(e) => (e.currentTarget.style.color = theme.colors.primary)}
                    onMouseOut={(e) => (e.currentTarget.style.color = theme.colors.textMuted)}
                  >
                    <EditIcon />
                  </button>
                  <ChevronIcon
                    style={{
                      ...styles.chevron,
                      ...(isExpanded ? styles.chevronExpanded : {}),
                    }}
                  />
                </div>
              </div>

              {isExpanded && (
                <div style={styles.providerDetails}>
                  <div style={styles.detailsGrid}>
                    <div style={styles.detailItem}>
                      <div style={styles.detailLabel}>API Modus</div>
                      <div style={styles.detailValue}>{provider.api_mode}</div>
                    </div>
                    {allowCustomProviders && (
                    <div style={styles.detailItem}>
                      <div style={styles.detailLabel}>API Key Variable</div>
                      <div style={styles.detailValue}>{provider.api_key_env || '-'}</div>
                    </div>
                    )}
                    <div style={styles.detailItem}>
                      <div style={styles.detailLabel}>Firmensitz</div>
                      <div style={styles.detailValue}>
                        {provider.company_region ? (
                          <>
                            {getRegionLabel(provider.company_region)?.flag}{' '}
                            {getRegionLabel(provider.company_region)?.label}
                          </>
                        ) : '-'}
                      </div>
                    </div>
                    <div style={styles.detailItem}>
                      <div style={styles.detailLabel}>Rechenzentrum</div>
                      <div style={styles.detailValue}>
                        {provider.datacenter_country ? (
                          <>
                            {getCountryByCode(provider.datacenter_country)?.flag}{' '}
                            {getCountryByCode(provider.datacenter_country)?.name}
                          </>
                        ) : '-'}
                      </div>
                    </div>
                    <div style={styles.detailItem}>
                      <div style={styles.detailLabel}>Modelle</div>
                      <div style={styles.detailValue}>{provider.models.length}</div>
                    </div>
                  </div>

                  {providerTestResult && (
                    <div
                      style={{
                        ...styles.testResult,
                        ...(providerTestResult.success ? styles.testSuccess : styles.testError),
                      }}
                    >
                      {providerTestResult.success ? '✓ ' : '✕ '}
                      {providerTestResult.message}
                      {providerTestResult.latency_ms && ` (${providerTestResult.latency_ms}ms)`}
                      {providerTestResult.models_found !== undefined &&
                        ` - ${providerTestResult.models_found} Modelle gefunden`}
                    </div>
                  )}

                  {provider.id === 'adacor' && syncResult && (
                    <div style={styles.syncResult}>
                      <span>Synchronisierung abgeschlossen:</span>
                      {syncResult.added > 0 && (
                        <span style={styles.syncStat}>+{syncResult.added} neu</span>
                      )}
                      {syncResult.reactivated > 0 && (
                        <span style={styles.syncStat}>~{syncResult.reactivated} reaktiviert</span>
                      )}
                      {syncResult.deactivated > 0 && (
                        <span style={{ ...styles.syncStat, color: theme.colors.warning }}>-{syncResult.deactivated} deaktiviert</span>
                      )}
                      {syncResult.unchanged > 0 && (
                        <span style={styles.syncStat}>{syncResult.unchanged} unverändert</span>
                      )}
                    </div>
                  )}

                  <div style={styles.modelsSection}>
                    <div style={styles.modelsSectionHeader}>
                      <div style={styles.modelsSectionTitle}>Modelle</div>
                      {provider.id !== 'adacor' && allowCustomProviders && (
                        <button
                          style={styles.addModelButton}
                          onClick={() => handleCreateModel(provider.id)}
                        >
                          <PlusIcon size={14} /> Modell
                        </button>
                      )}
                      {provider.id === 'adacor' && modelSyncConfigured && (
                        <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                          Verwaltet via Synchronisierung
                        </span>
                      )}
                    </div>

                    {provider.models.length > 0 ? (
                      <div style={styles.modelsList}>
                        {provider.models.map((model, index) => {
                          const typeColor = typeColors[model.type] || typeColors.llm;
                          const isLast = index === provider.models.length - 1;
                          const isDisabled = model.enabled === false;
                          const isListedOnly = model.workplace === false;

                          return (
                            <div
                              key={model.id}
                              style={{
                                ...styles.modelItem,
                                ...(isLast ? styles.modelItemLast : {}),
                                ...((isDisabled || isListedOnly) ? { opacity: 0.5 } : {}),
                              }}
                            >
                              <div style={styles.modelInfo}>
                                <div style={styles.modelName}>
                                  {model.name}
                                  <span
                                    style={{
                                      ...styles.typeBadge,
                                      backgroundColor: typeColor.bg,
                                      color: typeColor.color,
                                    }}
                                  >
                                    {model.type === 'image_gen' ? 'IMAGE' : model.type.toUpperCase()}
                                  </span>
                                  {model.protected && (
                                    <span style={styles.protectedBadge}>System</span>
                                  )}
                                  {model.default && (
                                    <span style={styles.defaultBadge}>Standard</span>
                                  )}
                                  {isDisabled && (
                                    <span style={styles.disabledBadge}>Deaktiviert</span>
                                  )}
                                  {isListedOnly && !isDisabled && (
                                    <span style={styles.listedOnlyBadge}>Nur gelistet</span>
                                  )}
                                </div>
                                <div style={styles.modelId}>
                                  {model.id}
                                  {model.feature_set != null ? (
                                    <span style={styles.featureBadges}>
                                      {featureBits
                                        .filter((f) => model.feature_set & f.bit)
                                        .map((f) => (
                                          <span
                                            key={f.bit}
                                            style={{
                                              ...styles.featureBadge,
                                              backgroundColor: f.bg,
                                              color: f.color,
                                            }}
                                          >
                                            {f.label}
                                          </span>
                                        ))}
                                    </span>
                                  ) : (
                                    model.capabilities?.map((cap) => {
                                      const capLabels = {
                                        chat: 'Chat',
                                        function_calling: 'Functions',
                                        vision: 'Vision',
                                        speech: 'Speech',
                                        transcription: 'STT',
                                        text_to_image: 'Text→Image',
                                        image_to_image: 'Image→Image',
                                        embeddings: 'Embeddings',
                                      };
                                      return (
                                        <span key={cap} style={styles.capabilityBadge}>
                                          {capLabels[cap] || cap}
                                        </span>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                              {(() => {
                                const paths = getModelFeaturePaths(model);
                                if (!paths) return null;
                                return (
                                  <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1px',
                                    minWidth: 0,
                                  }}>
                                    {Object.entries(paths).map(([suffix, path]) => (
                                      <div
                                        key={suffix}
                                        style={{
                                          fontSize: '10px',
                                          fontFamily: theme.typography.fontMono,
                                          color: theme.colors.textMuted,
                                          lineHeight: '1.4',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {path}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                              {!isDisabled && (
                                <button
                                  style={styles.actionButton}
                                  onClick={() => handleEditModel(provider.id, model)}
                                  onMouseOver={(e) => (e.currentTarget.style.color = theme.colors.primary)}
                                  onMouseOut={(e) => (e.currentTarget.style.color = theme.colors.textMuted)}
                                >
                                  <EditIcon />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
                        Keine Modelle konfiguriert
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Provider Modal */}
      {showProviderModal && (
        <div style={styles.modalOverlay} onClick={() => setShowProviderModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingProvider ? 'Provider bearbeiten' : 'Neuer Provider'}
              </h2>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Name</label>
                <input
                  style={styles.input}
                  value={providerForm.name}
                  onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                  placeholder="Mein Provider"
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>API Modus</label>
                  <Select
                    value={providerForm.api_mode}
                    onChange={(e) => setProviderForm({ ...providerForm, api_mode: e.target.value })}
                    options={[
                      { value: 'openai', label: 'OpenAI-kompatibel' },
                      { value: 'ollama', label: 'Ollama' },
                    ]}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>API Key Variable</label>
                  <input
                    style={{ ...styles.input, ...styles.inputMono }}
                    value={providerForm.api_key_env}
                    onChange={(e) => setProviderForm({ ...providerForm, api_key_env: e.target.value })}
                    placeholder="z.B. OPENAI_API_KEY"
                  />
                  <div style={styles.hint}>
                    Name der Umgebungsvariable (nicht der Key selbst!)
                  </div>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Base URL</label>
                <input
                  style={{ ...styles.input, ...styles.inputMono }}
                  value={providerForm.base_url}
                  onChange={(e) => setProviderForm({ ...providerForm, base_url: e.target.value })}
                  placeholder="https://api.example.com/v1"
                />
              </div>

              {/* Company Region and Datacenter Country */}
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Firmensitz</label>
                  <Select
                    value={providerForm.company_region}
                    onChange={(e) => setProviderForm({ ...providerForm, company_region: e.target.value })}
                  >
                    <option value="">-- Bitte wählen --</option>
                    {companyRegions.map((region) => (
                      <option key={region.value} value={region.value}>
                        {region.flag} {region.label}
                      </option>
                    ))}
                  </Select>
                  <div style={styles.hint}>Wo hat die Firma ihren Hauptsitz?</div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Rechenzentrum-Land</label>
                  <Select
                    value={providerForm.datacenter_country}
                    onChange={(e) => setProviderForm({ ...providerForm, datacenter_country: e.target.value })}
                  >
                    <option value="">-- Bitte wählen --</option>
                    <optgroup label="Favoriten">
                      {favoriteCountries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.flag} {country.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Alle Länder">
                      {allCountries
                        .filter(c => !favoriteCountries.some(f => f.code === c.code))
                        .map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.flag} {country.name}
                          </option>
                        ))}
                    </optgroup>
                  </Select>
                  <div style={styles.hint}>In welchem Land stehen die Server?</div>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    style={styles.checkboxInput}
                    checked={providerForm.enabled}
                    onChange={(e) => setProviderForm({ ...providerForm, enabled: e.target.checked })}
                  />
                  Provider aktiviert
                </label>
              </div>

              {/* Info Box für API Key Setup */}
              <div style={styles.infoBox}>
                <div style={styles.infoBoxTitle}>
                  <InfoIcon /> So richtest du den API Key ein:
                </div>
                <ol style={styles.infoBoxList}>
                  <li>Trage oben den <strong>Namen</strong> der Variable ein (z.B. <code>NEBIUS_API_KEY</code>)</li>
                  <li>Füge den echten API Key in die <code>.env</code> Datei im Backend ein:<br/>
                    <code style={styles.codeBlock}>NEBIUS_API_KEY=dein-geheimer-api-key</code>
                  </li>
                  <li>Starte das Backend neu</li>
                </ol>
              </div>
            </div>

            <div style={styles.modalFooter}>
              {editingProvider && !editingProvider.protected && (
                <button style={styles.deleteButton} onClick={handleDeleteProvider}>
                  Löschen
                </button>
              )}
              <button style={styles.cancelButton} onClick={() => setShowProviderModal(false)}>
                Abbrechen
              </button>
              <button style={styles.saveButton} onClick={handleSaveProvider}>
                {editingProvider ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Model Modal */}
      {showModelModal && (() => {
        const isSyncManaged = editingModel && modelProviderId === 'adacor' && modelSyncConfigured;
        const isSynced = editingModel?.feature_set != null;
        const isListedOnly = editingModel?.workplace === false;
        return (
        <div style={styles.modalOverlay} onClick={() => setShowModelModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingModel ? 'Modell bearbeiten' : 'Neues Modell'}
              </h2>
              {isSyncManaged && (
                <div style={{
                  fontSize: theme.typography.sizes.xs,
                  color: theme.colors.textMuted,
                  marginTop: theme.spacing.xs,
                }}>
                  Dieses Modell wird via Synchronisierung verwaltet und kann nicht manuell bearbeitet werden.
                </div>
              )}
            </div>

            <div style={styles.modalBody}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Modell ID</label>
                  <input
                    style={{ ...styles.input, ...styles.inputMono, ...(isSyncManaged ? { opacity: 0.6 } : {}) }}
                    value={modelForm.id}
                    onChange={(e) => setModelForm({ ...modelForm, id: e.target.value })}
                    placeholder="gpt-4o-mini"
                    disabled={!!editingModel}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Anzeigename</label>
                  <input
                    style={{ ...styles.input, ...(isSynced ? { opacity: 0.6 } : {}) }}
                    value={modelForm.name}
                    onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                    placeholder="GPT-4o Mini"
                    disabled={isSynced}
                  />
                  {isSynced && (
                    <div style={styles.hint}>Name wird durch Synchronisierung verwaltet</div>
                  )}
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Typ</label>
                <Select
                  value={modelForm.type}
                  onChange={(e) => setModelForm({ ...modelForm, type: e.target.value })}
                  disabled={isSyncManaged}
                  options={[
                    { value: 'llm', label: 'LLM (Text)' },
                    { value: 'vllm', label: 'VLLM (Vision)' },
                    { value: 'tts', label: 'TTS (Text-to-Speech)' },
                    { value: 'stt', label: 'STT (Speech-to-Text)' },
                    { value: 'image_gen', label: 'Image Gen (Bildgenerierung)' },
                  ]}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Fähigkeiten</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm, ...(isSyncManaged ? { opacity: 0.6 } : {}) }}>
                  {[
                    { id: 'chat', label: 'Chat' },
                    { id: 'function_calling', label: 'Function Calling' },
                    { id: 'vision', label: 'Vision' },
                    { id: 'speech', label: 'Speech' },
                    { id: 'transcription', label: 'Transcription' },
                    { id: 'text_to_image', label: 'Text-to-Image' },
                    { id: 'image_to_image', label: 'Image-to-Image' },
                  ].map((cap) => (
                    <label key={cap.id} style={styles.checkbox}>
                      <input
                        type="checkbox"
                        style={styles.checkboxInput}
                        checked={modelForm.capabilities?.includes(cap.id)}
                        onChange={() => toggleCapability(cap.id)}
                        disabled={isSyncManaged}
                      />
                      {cap.label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={{ ...styles.checkbox, ...(isListedOnly ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}>
                  <input
                    type="checkbox"
                    style={styles.checkboxInput}
                    checked={modelForm.default}
                    onChange={(e) => setModelForm({ ...modelForm, default: e.target.checked })}
                    disabled={isListedOnly}
                  />
                  Standard-Modell für diesen Provider
                </label>
                {isListedOnly && (
                  <div style={styles.hint}>Nur-gelistete Modelle können nicht als Standard gesetzt werden</div>
                )}
              </div>
            </div>

            <div style={styles.modalFooter}>
              {editingModel && !editingModel.protected && !isSyncManaged && (
                <button style={styles.deleteButton} onClick={handleDeleteModel}>
                  Löschen
                </button>
              )}
              <button style={styles.cancelButton} onClick={() => setShowModelModal(false)}>
                Abbrechen
              </button>
              <button style={styles.saveButton} onClick={handleSaveModel}>
                {editingModel ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

// Icons
function ChevronIcon({ style }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ShieldIcon({ size = 18, filled = true, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" opacity={filled ? 1 : 0.3} />
    </svg>
  );
}

function ToggleOnIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2">
      <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
      <circle cx="16" cy="12" r="3" fill={theme.colors.success} />
    </svg>
  );
}

function ToggleOffIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
      <circle cx="8" cy="12" r="3" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function RefreshIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

export default ProvidersPage;
