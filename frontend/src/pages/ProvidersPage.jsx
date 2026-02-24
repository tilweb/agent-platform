import { useState, useEffect, useRef, useCallback } from 'react';
import { theme } from '../config/theme';
import { useProviders } from '../hooks/useProviders';
import { useToast } from '../components/Toast';
import Select from '../components/Select';
import { PlusIcon, EditIcon, UploadIcon, TrashIcon } from '../components/Icons';

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
  activeCardTier: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  activeCardShields: {
    display: 'flex',
    gap: '1px',
  },
  activeCardTierLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
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
  providerCardDisabled: {
    opacity: 0.55,
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
  bulkToggleButton: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  modelsHeaderActions: {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
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
  // Test Config (collapsible)
  testConfigToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  testConfigChevron: {
    width: 16,
    height: 16,
    transition: `transform ${theme.transitions.fast}`,
  },
  testConfigPanel: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
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
  syncProgress: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
  },
  syncSpinner: {
    width: 14,
    height: 14,
    border: `2px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.primary,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
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
  // Avatar Upload
  avatarUpload: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  avatarPreview: {
    width: '48px',
    height: '48px',
    borderRadius: theme.borderRadius.lg,
    border: `2px dashed ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
    transition: `all ${theme.transitions.fast}`,
    flexShrink: 0,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  secondaryButtonSm: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text,
    cursor: 'pointer',
  },
  modelCheckbox: {
    accentColor: theme.colors.primary,
    width: '16px',
    height: '16px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  selectionInfo: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.medium,
  },
  bulkDeleteButton: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  headerCheckbox: {
    accentColor: theme.colors.primary,
    width: '16px',
    height: '16px',
    cursor: 'pointer',
    flexShrink: 0,
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
 * Standard endpoint templates per api_mode, used for deriving display paths from capabilities.
 */
const STANDARD_ENDPOINT_TEMPLATES = {
  openai: [
    { label: '/v1/chat/completions', path: '/v1/chat/completions', capability: 'chat' },
    { label: '/v1/embeddings', path: '/v1/embeddings', capability: 'embeddings' },
    { label: '/v1/audio/transcriptions', path: '/v1/audio/transcriptions', capability: 'transcription' },
    { label: '/v1/audio/speech', path: '/v1/audio/speech', capability: 'speech' },
    { label: '/v1/images/generations', path: '/v1/images/generations', capability: 'text_to_image' },
  ],
  ollama: [
    { label: '/api/chat', path: '/api/chat', capability: 'chat' },
    { label: '/api/embeddings', path: '/api/embeddings', capability: 'embeddings' },
  ],
  google_gemini: [
    { label: ':generateContent', path: ':generateContent', capability: 'chat' },
    { label: ':embedContent', path: ':embedContent', capability: 'embeddings' },
  ],
};

/** API modes that support model sync */
const SYNCABLE_API_MODES = ['openai', 'ollama', 'google_gemini'];

/**
 * Check if a provider supports model synchronization.
 * Adacor requires modelSyncConfigured; others need syncable api_mode + base_url + api_key.
 */
function canSyncProvider(provider, modelSyncConfigured) {
  if (provider.id === 'adacor') return modelSyncConfigured;
  if (!SYNCABLE_API_MODES.includes(provider.api_mode)) return false;
  if (!provider.base_url) return false;
  // Ollama doesn't need an API key
  if (provider.api_mode === 'ollama') return true;
  return !!(provider.has_api_key || provider.api_key_env);
}

/**
 * Derive endpoint paths from model capabilities and provider api_mode.
 */
function deriveEndpointsFromCapabilities(capabilities, provider) {
  const templates = STANDARD_ENDPOINT_TEMPLATES[provider.api_mode];
  if (!templates) return null;

  const paths = {};
  for (const t of templates) {
    if (capabilities.includes(t.capability)) {
      paths[t.label] = t.path;
    }
  }
  return Object.keys(paths).length > 0 ? paths : null;
}

/**
 * Get feature endpoint paths for a model (without domain).
 * Uses stored feature_urls if available, otherwise derives from base_url + feature_set,
 * then falls back to deriving from capabilities + api_mode.
 */
function getModelFeaturePaths(model, provider) {
  // 1. Stored feature_urls (synced models)
  if (model.feature_urls && Object.keys(model.feature_urls).length > 0) {
    const paths = {};
    for (const [suffix, url] of Object.entries(model.feature_urls)) {
      paths[suffix] = stripDomain(url);
    }
    return paths;
  }
  // 2. feature_set bitcode fallback (Adacor legacy)
  if (model.feature_set != null && model.base_url) {
    const basePath = stripDomain(model.base_url);
    const paths = {};
    for (const f of featureBits) {
      if (!(model.feature_set & f.bit)) continue;
      for (const suffix of f.suffixes) {
        paths[suffix] = basePath + suffix;
      }
    }
    if (Object.keys(paths).length > 0) return paths;
  }
  // 3. Derive from capabilities + api_mode
  if (model.capabilities?.length > 0 && provider) {
    const derived = deriveEndpointsFromCapabilities(model.capabilities, provider);
    if (derived) return derived;
  }
  // 4. base_url only
  const baseUrl = model.base_url || provider?.base_url;
  if (baseUrl) return { '': stripDomain(baseUrl) };
  return null;
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
  api_key: '',
  enabled: true,
  company_region: '',
  datacenter_country: '',
  icon_url: '',
  test_enabled: false,
  test_method: 'GET',
  test_path: '/models',
  test_auth_header: 'Authorization',
  test_auth_prefix: 'Bearer ',
  test_headers: '',
  test_body: '',
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
    bulkUpdateModels,
    getModelsForPurpose,
  } = useProviders();

  const toast = useToast();
  const logoInputRef = useRef(null);
  const [expandedProviders, setExpandedProviders] = useState({});
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [editingModel, setEditingModel] = useState(null);
  const [providerForm, setProviderForm] = useState(defaultProviderForm);
  const [modelForm, setModelForm] = useState(defaultModelForm);
  const [modelProviderId, setModelProviderId] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [syncingProviders, setSyncingProviders] = useState({}); // { [id]: { syncing: boolean, step?: string, message?: string } }
  // Multi-select: Map<providerId, Set<modelId>>
  const [selectedModels, setSelectedModels] = useState({});

  // Selection helpers
  const getSelection = (providerId) => selectedModels[providerId] || new Set();
  const getSelectableModels = (provider) =>
    provider.models.filter(m => m.workplace !== false && !m.protected && !(m.feature_set != null && m.enabled === false));

  const toggleModelSelection = (providerId, modelId) => {
    setSelectedModels(prev => {
      const current = new Set(prev[providerId] || []);
      if (current.has(modelId)) {
        current.delete(modelId);
      } else {
        current.add(modelId);
      }
      return { ...prev, [providerId]: current };
    });
  };

  const toggleAllModels = (providerId, provider) => {
    setSelectedModels(prev => {
      const selectable = getSelectableModels(provider);
      const current = prev[providerId] || new Set();
      const allSelected = selectable.length > 0 && selectable.every(m => current.has(m.id));
      if (allSelected) {
        return { ...prev, [providerId]: new Set() };
      } else {
        return { ...prev, [providerId]: new Set(selectable.map(m => m.id)) };
      }
    });
  };

  const clearSelection = (providerId) => {
    setSelectedModels(prev => ({ ...prev, [providerId]: new Set() }));
  };

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
    const test = provider.test;
    setProviderForm({
      name: provider.name,
      api_mode: provider.api_mode,
      base_url: provider.base_url,
      api_key: '',  // Never pre-fill — user enters new key or leaves empty to keep existing
      enabled: provider.enabled,
      company_region: provider.company_region || '',
      datacenter_country: provider.datacenter_country || '',
      icon_url: provider.icon_url || '',
      test_enabled: !!test,
      test_method: test?.method || 'GET',
      test_path: test?.path || '/models',
      test_auth_header: test?.auth_header || 'Authorization',
      test_auth_prefix: test?.auth_prefix ?? 'Bearer ',
      test_headers: test?.headers ? JSON.stringify(test.headers, null, 2) : '',
      test_body: test?.body ? JSON.stringify(test.body, null, 2) : '',
    });
    setShowProviderModal(true);
  };

  const handleSaveProvider = async () => {
    try {
      const { test_enabled, test_method, test_path, test_auth_header, test_auth_prefix, test_headers, test_body, ...rest } = providerForm;

      const data = { ...rest };
      if (editingProvider) {
        // Only send api_key when user entered a new one
        if (!data.api_key) delete data.api_key;
      }

      // Build test config
      if (test_enabled) {
        const testConfig = {};
        if (test_method && test_method !== 'GET') testConfig.method = test_method;
        if (test_path && test_path !== '/models') testConfig.path = test_path;
        if (test_auth_header && test_auth_header !== 'Authorization') testConfig.auth_header = test_auth_header;
        if (test_auth_prefix !== 'Bearer ') testConfig.auth_prefix = test_auth_prefix;
        if (test_headers) {
          try { testConfig.headers = JSON.parse(test_headers); } catch { /* ignore invalid JSON */ }
        }
        if (test_body) {
          try { testConfig.body = JSON.parse(test_body); } catch { /* ignore invalid JSON */ }
        }
        data.test = testConfig;
      } else if (editingProvider?.test) {
        // Explicitly remove test config
        data.test = null;
      }

      if (editingProvider) {
        await updateProvider(editingProvider.id, data);
        toast.success('Gespeichert', `Provider "${providerForm.name}" gespeichert`);
      } else {
        await createProvider(data);
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

    try {
      const result = await testConnection(providerId);
      const provider = providers.find(p => p.id === providerId);
      const name = provider?.name || providerId;
      if (result.success) {
        const details = [result.message];
        if (result.latency_ms) details.push(`${result.latency_ms}ms`);
        if (result.models_found !== undefined) details.push(`${result.models_found} Modelle`);
        toast.success(name, details.join(' · '));
      } else {
        toast.error(name, result.message);
      }
    } catch (err) {
      toast.error('Verbindungstest', err.message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncModels = async (providerId) => {
    setSyncingProviders(prev => ({ ...prev, [providerId]: { syncing: true, step: 'fetch', message: 'Starte Synchronisierung...' } }));
    try {
      const result = await syncModels(providerId, {
        onStep: ({ step, message }) => {
          setSyncingProviders(prev => ({ ...prev, [providerId]: { syncing: true, step, message } }));
        },
      });
      setSyncingProviders(prev => ({ ...prev, [providerId]: null }));
      if (result) {
        const parts = [];
        if (result.added > 0) parts.push(`+${result.added} neu`);
        if (result.updated > 0) parts.push(`${result.updated} aktualisiert`);
        if (result.deactivated > 0) parts.push(`-${result.deactivated} deaktiviert`);
        if (result.unchanged > 0) parts.push(`${result.unchanged} unverändert`);
        toast.success('Synchronisierung abgeschlossen', parts.join(', ') || 'Keine Änderungen');
      }
    } catch (err) {
      setSyncingProviders(prev => ({ ...prev, [providerId]: null }));
      toast.error('Synchronisierung fehlgeschlagen', err.message);
    }
  };

  const handleToggleModel = async (providerId, model) => {
    try {
      const newEnabled = model.enabled === false ? true : false;
      await updateModel(providerId, model.id, { enabled: newEnabled });
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  const handleBulkToggleSelected = async (providerId, enabled) => {
    const selection = getSelection(providerId);
    if (selection.size === 0) return;
    try {
      const result = await bulkUpdateModels(providerId, { enabled, modelIds: [...selection] });
      clearSelection(providerId);
      if (result.updated > 0) {
        toast.success('Aktualisiert', `${result.updated} Modell${result.updated !== 1 ? 'e' : ''} ${enabled ? 'aktiviert' : 'deaktiviert'}`);
      } else {
        toast.info('Keine Änderung', 'Alle ausgewählten Modelle sind bereits im gewünschten Zustand');
      }
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  const handleBulkDeleteSelected = async (providerId) => {
    const selection = getSelection(providerId);
    if (selection.size === 0) return;
    if (!confirm(`${selection.size} Modell${selection.size !== 1 ? 'e' : ''} wirklich löschen?`)) return;
    try {
      let deleted = 0;
      for (const modelId of selection) {
        await deleteModel(providerId, modelId);
        deleted++;
      }
      clearSelection(providerId);
      toast.success('Gelöscht', `${deleted} Modell${deleted !== 1 ? 'e' : ''} gelöscht`);
    } catch (err) {
      clearSelection(providerId);
      toast.error('Fehler', err.message);
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

  // Logo upload handler
  const MAX_LOGO_SIZE = 100 * 1024; // 100 KB
  const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

  const handleLogoFile = (file) => {
    if (!file) return;
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error('Ungültiger Dateityp', 'Erlaubt: SVG, PNG, JPEG, WebP');
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error('Datei zu groß', `Maximum: 100 KB (aktuell: ${(file.size / 1024).toFixed(0)} KB)`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setProviderForm(prev => ({ ...prev, icon_url: e.target.result }));
    };
    reader.readAsDataURL(file);
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
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
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

            // Determine security tier for selected provider
            const selectedProvider = active?.provider_id
              ? providers.find(p => p.id === active.provider_id)
              : null;
            const tier = selectedProvider
              ? calculateSecurityTier(selectedProvider.company_region, selectedProvider.datacenter_country)
              : null;
            const tierConfig = tier ? securityTiers[tier] : null;

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
                  {(() => {
                    // Group models by security tier
                    const tierGroups = {};
                    for (const { provider, model } of models) {
                      const t = calculateSecurityTier(provider.company_region, provider.datacenter_country);
                      if (!tierGroups[t]) tierGroups[t] = [];
                      tierGroups[t].push({ provider, model });
                    }
                    const shieldChar = '\u25A0'; // ■
                    const emptyChar = '\u25A1';  // □
                    return [1, 2, 3, 4].filter(t => tierGroups[t]).map(t => {
                      const tc = securityTiers[t];
                      const shields = shieldChar.repeat(tc.shieldCount) + emptyChar.repeat(4 - tc.shieldCount);
                      return (
                        <optgroup key={t} label={`${shields} ${tc.label}`}>
                          {tierGroups[t].map(({ provider, model }) => (
                            <option key={`${provider.id}::${model.id}`} value={`${provider.id}::${model.id}`}>
                              {provider.name} - {model.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    });
                  })()}
                </Select>
                {tierConfig && (
                  <div style={styles.activeCardTier}>
                    <div style={styles.activeCardShields}>
                      {[...Array(4)].map((_, i) => (
                        <ShieldIcon key={i} size={12} filled={i < tierConfig.shieldCount} color={tierConfig.color} />
                      ))}
                    </div>
                    <span style={{ ...styles.activeCardTierLabel, color: tierConfig.color }}>
                      {tierConfig.label}
                    </span>
                  </div>
                )}
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
          return (
            <div
              key={provider.id}
              style={{
                ...styles.providerCard,
                ...(!provider.enabled ? styles.providerCardDisabled : {}),
                ...(isExpanded ? styles.providerCardExpanded : {}),
              }}
            >
              <div style={styles.providerHeader} onClick={() => toggleProvider(provider.id)}>
                {provider.icon_url ? (
                  <img
                    src={provider.icon_url}
                    alt={provider.name}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: theme.borderRadius.lg,
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      ...styles.providerIcon,
                      backgroundColor: iconConfig.bg,
                      color: iconConfig.color,
                    }}
                  >
                    {iconConfig.icon}
                  </div>
                )}
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
                  {canSyncProvider(provider, modelSyncConfigured) && (() => {
                    const syncState = syncingProviders[provider.id];
                    const isSyncing = syncState?.syncing;
                    return isSyncing ? (
                      <span style={styles.syncProgress}>
                        <span style={styles.syncSpinner} />
                        {syncState.message || 'Synchronisiere...'}
                      </span>
                    ) : (
                      <button
                        style={styles.syncButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSyncModels(provider.id);
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = theme.colors.primary; e.currentTarget.style.color = theme.colors.primary; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = theme.colors.border; e.currentTarget.style.color = theme.colors.text; }}
                      >
                        <RefreshIcon size={14} />
                        Modelle synchronisieren
                      </button>
                    );
                  })()}
                  <button
                    style={styles.testButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTestConnection(provider.id);
                    }}
                    disabled={isTesting}
                  >
                    {isTesting ? 'Teste...' : 'Testen'}
                  </button>
                  {!provider.protected && (
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
                  )}
                  {!provider.protected && (
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
                  )}
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
                      <div style={styles.detailLabel}>API Key</div>
                      <div style={styles.detailValue}>
                        {provider.has_api_key
                          ? 'Verschlüsselt gespeichert'
                          : (provider.api_key_env || 'Nicht konfiguriert')}
                      </div>
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


                  <div style={styles.modelsSection}>
                    {(() => {
                      const selection = getSelection(provider.id);
                      const selectable = getSelectableModels(provider);
                      const hasSelection = selection.size > 0;
                      const allSelected = selectable.length > 0 && selectable.every(m => selection.has(m.id));
                      const someSelected = selectable.some(m => selection.has(m.id));
                      return (
                    <div style={styles.modelsSectionHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                        {selectable.length > 0 && (
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                            onChange={() => toggleAllModels(provider.id, provider)}
                            style={styles.headerCheckbox}
                            title={allSelected ? 'Alle abwählen' : 'Alle auswählen'}
                          />
                        )}
                        <div style={styles.modelsSectionTitle}>
                          {hasSelection ? (
                            <span style={styles.selectionInfo}>{selection.size} ausgewählt</span>
                          ) : (
                            'Modelle'
                          )}
                        </div>
                      </div>
                      <div style={styles.modelsHeaderActions}>
                        {hasSelection && (
                          <>
                            <button
                              style={styles.bulkToggleButton}
                              onClick={() => handleBulkToggleSelected(provider.id, true)}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = theme.colors.success; e.currentTarget.style.color = theme.colors.success; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.colors.border; e.currentTarget.style.color = theme.colors.textMuted; }}
                            >
                              Aktivieren
                            </button>
                            <button
                              style={styles.bulkToggleButton}
                              onClick={() => handleBulkToggleSelected(provider.id, false)}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = theme.colors.warning; e.currentTarget.style.color = theme.colors.warning; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.colors.border; e.currentTarget.style.color = theme.colors.textMuted; }}
                            >
                              Deaktivieren
                            </button>
                            <button
                              style={styles.bulkDeleteButton}
                              onClick={() => handleBulkDeleteSelected(provider.id)}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = theme.colors.error; e.currentTarget.style.color = theme.colors.error; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.colors.border; e.currentTarget.style.color = theme.colors.textMuted; }}
                            >
                              Löschen
                            </button>
                          </>
                        )}
                        {!canSyncProvider(provider, modelSyncConfigured) && allowCustomProviders && (
                          <button
                            style={styles.addModelButton}
                            onClick={() => handleCreateModel(provider.id)}
                          >
                            <PlusIcon size={14} /> Modell
                          </button>
                        )}
                        {canSyncProvider(provider, modelSyncConfigured) && (
                          <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                            Verwaltet via Synchronisierung
                          </span>
                        )}
                      </div>
                    </div>
                      );
                    })()}

                    {provider.models.length > 0 ? (
                      <div style={styles.modelsList}>
                        {provider.models.map((model, index) => {
                          const typeColor = typeColors[model.type] || typeColors.llm;
                          const isLast = index === provider.models.length - 1;
                          const isDisabled = model.enabled === false;
                          const isListedOnly = model.workplace === false;
                          const isSelectable = model.workplace !== false && !model.protected && !(model.feature_set != null && model.enabled === false);
                          const isSelected = getSelection(provider.id).has(model.id);

                          return (
                            <div
                              key={model.id}
                              style={{
                                ...styles.modelItem,
                                ...(isLast ? styles.modelItemLast : {}),
                                ...((isDisabled || isListedOnly) ? { opacity: 0.5 } : {}),
                              }}
                            >
                              {isSelectable ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleModelSelection(provider.id, model.id)}
                                  style={styles.modelCheckbox}
                                />
                              ) : (
                                <div style={{ width: '16px', flexShrink: 0 }} />
                              )}
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
                                            style={styles.capabilityBadge}
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
                                const paths = getModelFeaturePaths(model, provider);
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
                              {/* Toggle — not for sync-disabled or listed-only models */}
                              {!(model.feature_set != null && model.enabled === false) && model.workplace !== false && (
                                <button
                                  style={styles.actionButton}
                                  onClick={() => handleToggleModel(provider.id, model)}
                                  title={model.enabled === false ? 'Aktivieren' : 'Deaktivieren'}
                                >
                                  {model.enabled === false ? <ToggleOffIcon /> : <ToggleOnIcon />}
                                </button>
                              )}
                              {!(model.feature_set != null && model.enabled === false) && (
                                <button
                                  style={styles.actionButton}
                                  onClick={() => handleEditModel(provider.id, model)}
                                  onMouseOver={(e) => (e.currentTarget.style.color = theme.colors.primary)}
                                  onMouseOut={(e) => (e.currentTarget.style.color = theme.colors.textMuted)}
                                >
                                  <EditIcon />
                                </button>
                              )}
                              {!model.protected && (
                                <button
                                  style={styles.actionButton}
                                  onClick={async () => {
                                    if (!confirm(`Modell "${model.name}" wirklich löschen?`)) return;
                                    try {
                                      await deleteModel(provider.id, model.id);
                                      toast.success('Gelöscht', `Modell "${model.name}" gelöscht`);
                                    } catch (err) {
                                      toast.error('Fehler', err.message);
                                    }
                                  }}
                                  title="Löschen"
                                  onMouseOver={(e) => (e.currentTarget.style.color = theme.colors.error)}
                                  onMouseOut={(e) => (e.currentTarget.style.color = theme.colors.textMuted)}
                                >
                                  <TrashIcon size={16} />
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
                  <label style={styles.label}>API Key</label>
                  <input
                    type="password"
                    style={{ ...styles.input, ...styles.inputMono }}
                    value={providerForm.api_key}
                    onChange={(e) => setProviderForm({ ...providerForm, api_key: e.target.value })}
                    placeholder={editingProvider
                      ? (editingProvider.has_api_key ? 'Gespeichert — leer lassen zum Beibehalten' : 'sk-...')
                      : 'sk-...'}
                    autoComplete="off"
                  />
                  <div style={styles.hint}>
                    Wird AES-256-GCM verschlüsselt gespeichert
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

              <div style={styles.formGroup}>
                <label style={styles.label}>Logo</label>
                <div style={styles.avatarUpload}>
                  <div
                    style={styles.avatarPreview}
                    onClick={() => logoInputRef.current?.click()}
                    onDrop={(e) => { e.preventDefault(); handleLogoFile(e.dataTransfer?.files?.[0]); }}
                    onDragOver={(e) => e.preventDefault()}
                    title="Klicken oder Bild hierher ziehen"
                  >
                    {providerForm.icon_url ? (
                      <img src={providerForm.icon_url} alt="Logo" style={styles.avatarImage} />
                    ) : (
                      <UploadIcon size={20} color={theme.colors.textMuted} />
                    )}
                  </div>
                  <div>
                    <button type="button" style={styles.secondaryButtonSm}
                      onClick={() => logoInputRef.current?.click()}>
                      Hochladen
                    </button>
                    {providerForm.icon_url && (
                      <button type="button" style={{ ...styles.secondaryButtonSm, marginLeft: theme.spacing.sm, color: theme.colors.textMuted }}
                        onClick={() => setProviderForm(prev => ({...prev, icon_url: ''}))}>
                        Entfernen
                      </button>
                    )}
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.xs }}>
                      SVG, PNG, JPEG, WebP · max. 100 KB
                    </div>
                  </div>
                </div>
                <input ref={logoInputRef} type="file" accept=".svg,.png,.jpg,.jpeg,.webp"
                  style={{ display: 'none' }} onChange={(e) => { handleLogoFile(e.target.files?.[0]); e.target.value = ''; }} />
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

              {/* Verbindungstest-Konfiguration (collapsible) */}
              <div style={{ marginBottom: theme.spacing.lg }}>
                <button
                  type="button"
                  style={{
                    ...styles.testConfigToggle,
                    color: providerForm.test_enabled ? theme.colors.primary : theme.colors.textMuted,
                  }}
                  onClick={() => setProviderForm({ ...providerForm, test_enabled: !providerForm.test_enabled })}
                >
                  <ChevronIcon style={{
                    ...styles.testConfigChevron,
                    transform: providerForm.test_enabled ? 'rotate(0deg)' : 'rotate(-90deg)',
                  }} />
                  Eigene Verbindungstest-Konfiguration
                </button>

                {providerForm.test_enabled && (
                  <div style={styles.testConfigPanel}>
                    <div style={styles.hint}>
                      Überschreibt den Standard-Test für diesen API-Modus. Nutze <code>{'{{model}}'}</code> als Platzhalter für die Modell-ID im Body.
                    </div>

                    <div style={{ ...styles.formRow, marginTop: theme.spacing.md }}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>HTTP-Methode</label>
                        <Select
                          value={providerForm.test_method}
                          onChange={(e) => setProviderForm({ ...providerForm, test_method: e.target.value })}
                          options={[
                            { value: 'GET', label: 'GET' },
                            { value: 'POST', label: 'POST' },
                          ]}
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Pfad</label>
                        <input
                          style={{ ...styles.input, ...styles.inputMono }}
                          value={providerForm.test_path}
                          onChange={(e) => setProviderForm({ ...providerForm, test_path: e.target.value })}
                          placeholder="/models"
                        />
                        <div style={styles.hint}>Wird an die Base URL angehängt</div>
                      </div>
                    </div>

                    <div style={{ ...styles.formRow }}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Auth-Header</label>
                        <input
                          style={{ ...styles.input, ...styles.inputMono }}
                          value={providerForm.test_auth_header}
                          onChange={(e) => setProviderForm({ ...providerForm, test_auth_header: e.target.value })}
                          placeholder="Authorization"
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Auth-Prefix</label>
                        <input
                          style={{ ...styles.input, ...styles.inputMono }}
                          value={providerForm.test_auth_prefix}
                          onChange={(e) => setProviderForm({ ...providerForm, test_auth_prefix: e.target.value })}
                          placeholder="Bearer "
                        />
                        <div style={styles.hint}>Leer lassen für Raw-Key ohne Prefix</div>
                      </div>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Zusätzliche Header (JSON)</label>
                      <textarea
                        style={{ ...styles.input, ...styles.inputMono, minHeight: '60px', resize: 'vertical' }}
                        value={providerForm.test_headers}
                        onChange={(e) => setProviderForm({ ...providerForm, test_headers: e.target.value })}
                        placeholder={'{\n  "anthropic-version": "2023-06-01"\n}'}
                      />
                    </div>

                    {providerForm.test_method === 'POST' && (
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Request Body (JSON)</label>
                        <textarea
                          style={{ ...styles.input, ...styles.inputMono, minHeight: '80px', resize: 'vertical' }}
                          value={providerForm.test_body}
                          onChange={(e) => setProviderForm({ ...providerForm, test_body: e.target.value })}
                          placeholder={'{\n  "model": "{{model}}",\n  "max_tokens": 1,\n  "messages": [{"role": "user", "content": "Hi"}]\n}'}
                        />
                        <div style={styles.hint}>{'{{model}}'} wird durch die Standard-Modell-ID ersetzt</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Info Box für API Key Sicherheit */}
              <div style={styles.infoBox}>
                <div style={styles.infoBoxTitle}>
                  <InfoIcon /> Sicherheitshinweis
                </div>
                <p style={{ ...styles.hint, margin: 0, fontSize: theme.typography.sizes.sm, color: theme.colors.text, lineHeight: theme.typography.lineHeight.relaxed }}>
                  Der API Key wird mit <strong>AES-256-GCM</strong> verschlüsselt und in der Provider-Konfiguration gespeichert.
                  Er wird niemals im Klartext persistiert und ist nur zur Laufzeit verfügbar.
                </p>
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
        const modelProvider = providers.find(p => p.id === modelProviderId);
        const isSyncManaged = editingModel && modelProvider && canSyncProvider(modelProvider, modelSyncConfigured);
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
