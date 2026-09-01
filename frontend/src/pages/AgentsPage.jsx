import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../config/theme';
import AccessManager from '../components/AccessManager';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiFetch';
import { useProviders } from '../hooks/useProviders';
import { LockIcon, RobotIcon, PlugIcon, PenIcon } from '../components/Icons';
import RoleBadge from '../components/RoleBadge';
import ReadOnlyBanner from '../components/ReadOnlyBanner';
import ConfirmModal from '../components/ConfirmModal';
import PageHeader from '../components/overview/PageHeader';
import SearchInput from '../components/overview/SearchInput';
import GroupTabs from '../components/overview/GroupTabs';
import ResourceCard, { CardGrid } from '../components/overview/ResourceCard';
import EmptyState from '../components/overview/EmptyState';
import HelpPanel from '../components/overview/HelpPanel';
import { deriveAccessGroups, filterBySearch, sortByName } from '../components/overview/grouping';
import { AgentAvatar, AgentGlyph } from '../components/AgentAvatar';
import { DEFAULT_AGENT_ICON, DEFAULT_AGENT_COLOR } from '../components/agentIcons';
import AgentIconPicker from '../components/AgentIconPicker';

// ==========================================
// Styles
// ==========================================

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
  // Card Grid
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  cardHover: {
    borderColor: theme.colors.primary,
    boxShadow: theme.shadows.md,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  cardIcon: {
    width: '48px',
    height: '48px',
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  cardDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.lg,
  },
  capabilitiesTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.sm,
  },
  capabilities: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  capability: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.full,
    color: theme.colors.textSecondary,
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: theme.spacing.lg,
  },
  badge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  badgeDelegatable: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  badgeSystem: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  badgeMuted: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  // Section
  section: {
    marginBottom: theme.spacing['2xl'],
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  sectionCount: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surfaceHover,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
  },
  sectionDivider: {
    height: '1px',
    backgroundColor: theme.colors.border,
    margin: `${theme.spacing.xl} 0`,
  },
  // Empty state
  emptyState: {
    padding: theme.spacing['2xl'],
    textAlign: 'center',
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.xl,
    border: `1px dashed ${theme.colors.border}`,
  },
  emptyStateText: {
    marginBottom: theme.spacing.md,
    fontSize: theme.typography.sizes.sm,
  },
  // Buttons
  button: {
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
  buttonSecondary: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  buttonDanger: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    color: theme.colors.error,
    border: `1px solid ${theme.colors.error}30`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  // Back link
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    cursor: 'pointer',
    marginBottom: theme.spacing.lg,
    border: 'none',
    background: 'none',
    padding: 0,
    fontWeight: theme.typography.weights.medium,
  },
  // Detail header
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xl,
  },
  detailHeaderLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.lg,
  },
  detailIcon: {
    width: '64px',
    height: '64px',
    borderRadius: theme.borderRadius.xl,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailTitle: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  detailSubtitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  detailActions: {
    display: 'flex',
    gap: theme.spacing.md,
  },
  // Two column layout
  twoColumn: {
    display: 'flex',
    gap: theme.spacing.xl,
    alignItems: 'flex-start',
  },
  mainColumn: {
    flex: 2,
    minWidth: 0,
  },
  sideColumn: {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'calc(100vh - 240px)',
  },
  // Form
  formCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  formCardTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
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
  inputDisabled: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
    cursor: 'not-allowed',
  },
  textarea: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    resize: 'vertical',
    minHeight: '100px',
    fontFamily: theme.typography.fontFamily,
  },
  textareaLarge: {
    minHeight: '200px',
    fontFamily: theme.typography.fontMono,
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
  },
  toggleButton: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
  },
  toggleContent: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  toggleDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  formCardHint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    lineHeight: theme.typography.lineHeight.relaxed,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  // Tabs
  tabsContainer: {
    display: 'flex',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
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
    backgroundColor: `${theme.colors.primary}15`,
    color: theme.colors.primary,
  },
  tabContent: {
    flex: 1,
    overflow: 'auto',
    padding: theme.spacing.lg,
  },
  // Tool selection
  toolCategory: {
    marginBottom: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  toolCategoryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHover,
    cursor: 'pointer',
  },
  toolCategoryTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  toolCategoryCount: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surface,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
  },
  toolCategoryContent: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  toolGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: theme.spacing.sm,
  },
  toolItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  toolItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}10`,
  },
  toolItemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  toolName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  toolDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  selectedToolsSummary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  selectedToolTag: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
  },
  // Model selection
  modelSelect: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    cursor: 'pointer',
  },
  modelInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  modelCapability: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: `2px ${theme.spacing.sm}`,
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  // Status
  loading: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  error: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.error,
    marginBottom: theme.spacing.lg,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  systemHint: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
};

// ==========================================
// Agent Colors
// ==========================================

const agentColors = {
  general: { bg: '#14b8a620', color: '#14b8a6' },
  researcher: { bg: '#3b82f620', color: '#3b82f6' },
  writer: { bg: '#8b5cf620', color: '#8b5cf6' },
  knowledge: { bg: '#f59e0b20', color: '#f59e0b' },
  'kb-indexer': { bg: '#6366f120', color: '#6366f1' },
  'google-drive': { bg: '#4285f420', color: '#4285f4' },
  confluence: { bg: '#0052cc20', color: '#0052cc' },
  pipedrive: { bg: '#00800020', color: '#008000' },
  default: { bg: '#6b728020', color: '#6b7280' },
};

// ==========================================
// Model Selector Component
// ==========================================

function ModelSelector({
  formData,
  setFormData,
  enabledProviders,
  getModelsForAgent,
  getExtendedCapabilities,
  isViewOnly,
}) {
  const availableModels = useMemo(() => {
    return getModelsForAgent({
      id: formData.id || 'new-agent',
      tools: formData.tools || [],
      capabilities: formData.capabilities?.split(',').map(s => s.trim()).filter(Boolean) || [],
    });
  }, [getModelsForAgent, formData.id, formData.tools, formData.capabilities]);

  const selectedModel = useMemo(() => {
    if (!formData.model?.provider_id || !formData.model?.model_id) return null;

    const found = availableModels.find(
      m => m.provider.id === formData.model.provider_id && m.model.id === formData.model.model_id
    );

    if (!found) {
      for (const provider of enabledProviders) {
        if (provider.id === formData.model.provider_id) {
          const model = provider.models.find(m => m.id === formData.model.model_id);
          if (model) {
            return { provider, model };
          }
        }
      }
    }

    return found;
  }, [formData.model, availableModels, enabledProviders]);

  const handleModelChange = (e) => {
    const value = e.target.value;
    if (!value) {
      setFormData({ ...formData, model: { provider_id: '', model_id: '' } });
      return;
    }

    const [providerId, modelId] = value.split('|');
    setFormData({
      ...formData,
      model: { provider_id: providerId, model_id: modelId },
    });
  };

  const selectedModelCaps = selectedModel ? getExtendedCapabilities(selectedModel.model) : null;

  return (
    <>
      <select
        style={{
          ...styles.modelSelect,
          ...(isViewOnly ? styles.inputDisabled : {}),
        }}
        value={
          formData.model?.provider_id && formData.model?.model_id
            ? `${formData.model.provider_id}|${formData.model.model_id}`
            : ''
        }
        onChange={handleModelChange}
        disabled={isViewOnly}
      >
        <option value="">System-Standard verwenden</option>
        {availableModels.map(({ provider, model }) => (
          <option key={`${provider.id}|${model.id}`} value={`${provider.id}|${model.id}`}>
            {provider.name}: {model.name}
          </option>
        ))}
      </select>

      {selectedModel && (
        <div style={styles.modelInfo}>
          <span>Ausgewählt: {selectedModel.provider.name} - {selectedModel.model.name}</span>
          {selectedModelCaps?.tool_use && (
            <span style={styles.modelCapability}>Tool-Calling</span>
          )}
          {selectedModelCaps?.vision && (
            <span style={styles.modelCapability}>Vision</span>
          )}
        </div>
      )}

      {!formData.model?.provider_id && (
        <div style={styles.hint}>
          Ohne Modell-Auswahl wird das System-Standardmodell oder deine persönliche Präferenz verwendet.
        </div>
      )}
    </>
  );
}

// ==========================================
// Main Component
// ==========================================

function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [availableTools, setAvailableTools] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Navigation state
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // Confirm-Modal state — `agent` haelt eine Kopie des Agents zum Zeitpunkt
  // des Klicks fest, damit der Modal-Inhalt (Name) auch dann stabil bleibt
  // wenn `selectedAgent` zwischenzeitlich neu geladen wird.
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    capabilities: '',
    tools: [],
    skills: [],
    skillMode: 'all',
    delegatable: true,
    systemPrompt: '',
    model: { provider_id: '', model_id: '' },
    icon: DEFAULT_AGENT_ICON,
    color: DEFAULT_AGENT_COLOR,
  });
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Detail view state
  const [activeTab, setActiveTab] = useState('tools');

  // Overview state (Suche / Gruppen-Tab / Hilfe)
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('all');
  const [helpOpen, setHelpOpen] = useState(false);

  // Provider hook for model selection
  const { enabledProviders, getModelsForAgent, getExtendedCapabilities } = useProviders();

  // ==========================================
  // Data Loading
  // ==========================================

  const fetchAgents = async () => {
    try {
      const response = await apiGet('/agents');
      if (!response.ok) throw new Error('Failed to fetch agents');
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTools = async () => {
    setIsLoadingTools(true);
    try {
      const response = await apiGet('/tools');
      if (!response.ok) throw new Error('Failed to fetch tools');
      const data = await response.json();
      setAvailableTools(data.tools || []);
    } catch (err) {
      console.error('Error fetching tools:', err);
    } finally {
      setIsLoadingTools(false);
    }
  };

  const fetchSkills = async () => {
    setIsLoadingSkills(true);
    try {
      const response = await apiGet('/skills');
      if (!response.ok) throw new Error('Failed to fetch skills');
      const data = await response.json();
      setAvailableSkills(data.skills || []);
    } catch (err) {
      console.error('Error fetching skills:', err);
    } finally {
      setIsLoadingSkills(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    if (selectedAgent || isCreating) {
      fetchTools();
      fetchSkills();
    }
  }, [selectedAgent, isCreating]);

  // ==========================================
  // Navigation Handlers
  // ==========================================

  const handleBackToOverview = () => {
    setSelectedAgent(null);
    setIsCreating(false);
    setError(null);
    setActiveTab('tools');
  };

  const handleCreateNew = () => {
    setSelectedAgent(null);
    setIsCreating(true);
    setFormData({
      id: '',
      name: '',
      description: '',
      capabilities: '',
      tools: ['file_read', 'file_list'],
      skills: [],
      skillMode: 'all',
      delegatable: true,
      active: true,
      systemPrompt: '',
      model: { provider_id: '', model_id: '' },
      icon: DEFAULT_AGENT_ICON,
      color: DEFAULT_AGENT_COLOR,
    });
    setActiveTab('tools');
  };

  const handleSelectAgent = async (agent) => {
    try {
      const response = await apiGet(`/agents/${agent.id}/full`);
      if (!response.ok) throw new Error('Failed to load agent');
      const fullAgent = await response.json();

      setSelectedAgent(fullAgent);
      setIsCreating(false);
      setFormData({
        id: fullAgent.id,
        name: fullAgent.name || '',
        description: typeof fullAgent.description === 'string' ? fullAgent.description : '',
        capabilities: Array.isArray(fullAgent.capabilities) ? fullAgent.capabilities.join(', ') : '',
        tools: Array.isArray(fullAgent.tools) ? fullAgent.tools : [],
        skills: Array.isArray(fullAgent.skills) ? fullAgent.skills : [],
        skillMode: fullAgent.skillMode || 'all',
        delegatable: fullAgent.delegatable ?? true,
        active: fullAgent.active !== false,
        systemPrompt: typeof fullAgent.systemPrompt === 'string' ? fullAgent.systemPrompt : '',
        model: (fullAgent.model && fullAgent.model.provider_id && fullAgent.model.model_id)
          ? fullAgent.model
          : { provider_id: '', model_id: '' },
        icon: fullAgent.icon || DEFAULT_AGENT_ICON,
        color: fullAgent.color || DEFAULT_AGENT_COLOR,
      });
      setActiveTab('tools');
    } catch (err) {
      setError(err.message);
    }
  };

  // ==========================================
  // Action Handlers
  // ==========================================

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const modelConfig = formData.model?.provider_id && formData.model?.model_id
        ? formData.model
        : undefined;

      const payload = {
        id: formData.id,
        name: formData.name,
        description: formData.description,
        capabilities: formData.capabilities.split(',').map(s => s.trim()).filter(Boolean),
        tools: formData.tools,
        skills: formData.skillMode === 'allow' ? formData.skills : undefined,
        skillMode: formData.skillMode,
        delegatable: formData.delegatable,
        active: formData.active,
        systemPrompt: formData.systemPrompt,
        model: modelConfig,
        icon: formData.icon || DEFAULT_AGENT_ICON,
        color: formData.color || DEFAULT_AGENT_COLOR,
      };

      const response = isCreating
        ? await apiPost('/agents', payload)
        : await apiPut(`/agents/${selectedAgent.id}`, payload);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save agent');
      }

      await fetchAgents();
      handleBackToOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Step 1: Klick auf "Löschen" oeffnet das Confirm-Modal. Die zu loeschende
  // Agent-Referenz wird in `deleteCandidate` festgehalten, damit der Modal-
  // Inhalt unabhaengig von State-Reloads stabil bleibt.
  const requestDelete = () => {
    if (!selectedAgent?.id) {
      setError('Kein Agent ausgewählt');
      return;
    }
    setDeleteCandidate(selectedAgent);
  };

  // Step 2: Bestaetigung im Modal triggert den eigentlichen DELETE-Call.
  const confirmDelete = async () => {
    if (!deleteCandidate?.id) return;
    setIsDeleting(true);
    setError(null);
    try {
      const response = await apiDelete(`/agents/${deleteCandidate.id}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Löschen fehlgeschlagen (${response.status})`);
      }
      setDeleteCandidate(null);
      await fetchAgents();
      handleBackToOverview();
    } catch (err) {
      // Modal offen lassen, damit der User den Fehler sieht und nochmal probieren kann.
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    if (isDeleting) return;
    setDeleteCandidate(null);
  };

  const handleToolToggle = (toolName) => {
    if (isViewOnly) return;
    const currentTools = formData.tools || [];
    const newTools = currentTools.includes(toolName)
      ? currentTools.filter(t => t !== toolName)
      : [...currentTools, toolName];
    setFormData({ ...formData, tools: newTools });
  };

  const handleSkillToggle = (skillId) => {
    if (isViewOnly) return;
    const currentSkills = formData.skills || [];
    const newSkills = currentSkills.includes(skillId)
      ? currentSkills.filter(s => s !== skillId)
      : [...currentSkills, skillId];
    setFormData({ ...formData, skills: newSkills });
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // ==========================================
  // Helpers
  // ==========================================

  const isSystemAgent = selectedAgent?.system;
  // Phase-2: Auch nicht-Editor-Rollen (z.B. viewer) → read-only.
  const isAgentViewerRole = !isSystemAgent && selectedAgent?.role && selectedAgent.role !== 'owner' && selectedAgent.role !== 'admin' && selectedAgent.role !== 'editor';
  const isViewOnly = isSystemAgent || isAgentViewerRole;

  const getToolsByCategory = () => {
    const grouped = {};
    availableTools.forEach(tool => {
      const category = tool.category || 'Sonstige';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(tool);
    });
    const sortedCategories = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'de'));
    return sortedCategories.map(category => ({
      name: category,
      tools: grouped[category]
    }));
  };


  // Generate unique ID from name
  const generateUniqueId = (name) => {
    const baseId = name
      .toLowerCase()
      .replace(/[äöüß]/g, c => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' }[c]))
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!baseId) return '';

    // Check if ID already exists (exclude current agent when editing)
    const currentAgentId = selectedAgent?.id;
    const existingIds = agents
      .map(a => a.id)
      .filter(id => id !== currentAgentId);

    if (!existingIds.includes(baseId)) {
      return baseId;
    }

    // Auto-increment until unique
    let counter = 2;
    while (existingIds.includes(`${baseId}-${counter}`)) {
      counter++;
    }
    return `${baseId}-${counter}`;
  };

  // ==========================================
  // RENDER: Loading
  // ==========================================

  if (isLoading) {
    return <div style={styles.loading}>Lade Agenten...</div>;
  }

  // ==========================================
  // RENDER: Detail View (Edit/Create/View)
  // ==========================================

  if (selectedAgent || isCreating) {
    const pageTitle = isCreating
      ? 'Neuer Agent'
      : selectedAgent.name;

    return (
      <div style={styles.container}>
        {/* Back Link */}
        <button style={styles.backLink} onClick={handleBackToOverview}>
          <ArrowLeftIcon /> Agenten
        </button>

        {/* Detail Header */}
        <div style={styles.detailHeader}>
          <div style={styles.detailHeaderLeft}>
            {/* Avatar — klickbar öffnet den Icon-Picker */}
            <button
              type="button"
              onClick={() => { if (!isViewOnly) setShowIconPicker(true); }}
              disabled={isViewOnly}
              title={isViewOnly ? undefined : 'Icon & Farbe ändern'}
              style={{ position: 'relative', padding: 0, border: 'none', background: 'none', cursor: isViewOnly ? 'default' : 'pointer', flexShrink: 0 }}
            >
              <AgentAvatar icon={formData.icon} color={formData.color} size={56} style={{ borderRadius: theme.borderRadius.lg }} />
              {!isViewOnly && (
                <span style={{
                  position: 'absolute', bottom: -4, right: -4, width: 20, height: 20,
                  borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.surface,
                  border: `1px solid ${theme.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.colors.textMuted,
                }}>
                  <PenIcon size={11} />
                </span>
              )}
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
                {isViewOnly ? (
                  <h1 style={styles.detailTitle}>{pageTitle}</h1>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flex: 1, minWidth: 0, maxWidth: 560 }}>
                    <input
                      value={formData.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        const updates = { name };
                        // ID nur bei NEUEN Agents generieren, nicht bei Bearbeitung
                        if (isCreating) updates.id = generateUniqueId(name);
                        setFormData({ ...formData, ...updates });
                      }}
                      placeholder="Name des Agenten"
                      style={{
                        fontSize: theme.typography.sizes['2xl'],
                        fontWeight: theme.typography.weights.bold,
                        color: theme.colors.text,
                        background: 'transparent',
                        border: 'none',
                        borderBottom: `2px solid ${theme.colors.border}`,
                        borderRadius: 0,
                        padding: `${theme.spacing.xs} 2px`,
                        outline: 'none',
                        width: '100%',
                        fontFamily: 'inherit',
                      }}
                      onFocus={(e) => { e.target.style.borderBottomColor = theme.colors.primary; }}
                      onBlur={(e) => { e.target.style.borderBottomColor = theme.colors.border; }}
                      onMouseEnter={(e) => { if (document.activeElement !== e.target) e.target.style.borderBottomColor = theme.colors.textMuted; }}
                      onMouseLeave={(e) => { if (document.activeElement !== e.target) e.target.style.borderBottomColor = theme.colors.border; }}
                    />
                    <PenIcon size={15} color={theme.colors.textMuted} style={{ flexShrink: 0, opacity: 0.7 }} />
                  </div>
                )}
                {!isCreating && !isSystemAgent && selectedAgent?.role && <RoleBadge role={selectedAgent.role} size="sm" />}
              </div>
              <div style={styles.detailSubtitle}>
                {!isCreating && (
                  <>
                    {isSystemAgent && (
                      <span style={{ ...styles.badge, ...styles.badgeSystem }}>
                        System-Agent
                      </span>
                    )}
                    {selectedAgent.active === false && (
                      <span style={{ ...styles.badge, ...styles.badgeMuted }}>
                        Inaktiv
                      </span>
                    )}
                  </>
                )}
                {isCreating && (
                  <span style={{ color: theme.colors.textMuted }}>
                    Erstelle einen neuen benutzerdefinierten Agenten
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          {!isViewOnly && (
            <div style={styles.detailActions}>
              {!isCreating && (
                <button type="button" style={styles.buttonDanger} onClick={requestDelete}>
                  Löschen
                </button>
              )}
              <button
                style={{
                  ...styles.button,
                  opacity: isSaving ? 0.6 : 1,
                }}
                onClick={handleSave}
                disabled={isSaving || (!isCreating && !formData.id)}
              >
                {isSaving ? 'Speichere...' : (isCreating ? 'Erstellen' : 'Speichern')}
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={styles.error}>
            {error}
            <button
              onClick={() => setError(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.error }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Read-Only Banner fuer Agents wo der User nur Viewer ist */}
        {isAgentViewerRole && (
          <ReadOnlyBanner message="Sie haben Lesezugriff auf diesen Agent. Anfrage fuer Bearbeitungsrechte an einen Owner." />
        )}

        {/* System Agent Hint */}
        {isSystemAgent && (
          <div style={styles.systemHint}>
            <LockIcon />
            Dieser System-Agent kann nicht bearbeitet werden.
          </div>
        )}

        {/* Two Column Layout */}
        <div style={styles.twoColumn}>
          {/* Main Column - Form */}
          <div style={styles.mainColumn}>
            {/* Description & Capabilities - for other agents */}
            <div style={styles.formCard}>
              <h3 style={styles.formCardTitle}>Für andere Agenten</h3>
              <div style={styles.formCardHint}>
                Diese Informationen helfen dem KI-System zu verstehen, wofür dieser Agent zuständig ist.
                Wenn ein anderer Agent Hilfe bei einer Aufgabe braucht, nutzt er diese Beschreibung und
                die Fähigkeiten, um zu entscheiden, ob dieser Agent der richtige Helfer ist.
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Beschreibung</label>
                <textarea
                  style={{
                    ...styles.textarea,
                    ...(isViewOnly ? styles.inputDisabled : {}),
                  }}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="z.B. Spezialist für Web-Recherche und Faktenprüfung. Kann im Internet nach aktuellen Informationen suchen und Fakten verifizieren."
                  disabled={isViewOnly}
                />
                <div style={styles.hint}>
                  Beschreibe in 1-2 Sätzen, was dieser Agent kann und wofür er eingesetzt werden sollte.
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Fähigkeiten (Schlagwörter)</label>
                <input
                  style={{
                    ...styles.input,
                    ...(isViewOnly ? styles.inputDisabled : {}),
                  }}
                  value={formData.capabilities}
                  onChange={(e) => setFormData({ ...formData, capabilities: e.target.value })}
                  placeholder="z.B. Recherche, Faktenprüfung, Zusammenfassung"
                  disabled={isViewOnly}
                />
                <div style={styles.hint}>
                  Kommagetrennte Schlagwörter, die die Stärken des Agenten beschreiben.
                </div>
              </div>
            </div>

            {/* Verfügbarkeit */}
            <div style={styles.formCard}>
              <h3 style={styles.formCardTitle}>Verfügbarkeit</h3>

              {/* Active Toggle */}
              <div style={{ ...styles.toggleRow, marginBottom: theme.spacing.lg }}>
                <button
                  style={{
                    ...styles.toggleButton,
                    ...(isViewOnly ? { cursor: 'not-allowed', opacity: 0.5 } : {}),
                  }}
                  onClick={() => !isViewOnly && setFormData({ ...formData, active: !formData.active })}
                  disabled={isViewOnly}
                  type="button"
                >
                  {formData.active ? <ToggleOnIcon /> : <ToggleOffIcon />}
                </button>
                <div style={styles.toggleContent}>
                  <div style={styles.toggleTitle}>
                    {formData.active ? 'Aktiv' : 'Inaktiv'}
                  </div>
                  <div style={styles.toggleDescription}>
                    {formData.active ? (
                      <>
                        Der Agent ist aktiv und kann im Chat ausgewählt sowie per Delegation angesprochen werden.
                      </>
                    ) : (
                      <>
                        Der Agent ist deaktiviert und weder im Chat noch per Delegation verfügbar.
                        Er bleibt in der Admin-Ansicht sichtbar und kann jederzeit wieder aktiviert werden.
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Delegation Toggle */}
              <div style={styles.toggleRow}>
                <button
                  style={{
                    ...styles.toggleButton,
                    ...(isViewOnly || !formData.active ? { cursor: 'not-allowed', opacity: 0.5 } : {}),
                  }}
                  onClick={() => !isViewOnly && formData.active && setFormData({ ...formData, delegatable: !formData.delegatable })}
                  disabled={isViewOnly || !formData.active}
                  type="button"
                >
                  {formData.delegatable ? <ToggleOnIcon /> : <ToggleOffIcon />}
                </button>
                <div style={styles.toggleContent}>
                  <div style={styles.toggleTitle}>
                    {formData.delegatable ? 'Automatisch verfügbar' : 'Nur bei direkter Auswahl'}
                  </div>
                  <div style={styles.toggleDescription}>
                    {formData.delegatable ? (
                      <>
                        Andere Agenten können diesen Agenten automatisch einschalten, wenn sie
                        Hilfe bei einer passenden Aufgabe benötigen. Der Supervisor-Agent entscheidet
                        basierend auf der Beschreibung und den Fähigkeiten, wann dieser Agent zum Einsatz kommt.
                      </>
                    ) : (
                      <>
                        Dieser Agent wird nur aktiv, wenn du ihn explizit im Chat auswählst.
                        Andere Agenten können ihn nicht automatisch hinzuziehen. Nutze diese Einstellung
                        für Agenten, die du nur gezielt für bestimmte Aufgaben einsetzen möchtest.
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* System Prompt */}
            <div style={styles.formCard}>
              <h3 style={styles.formCardTitle}>Instruktionen (System Prompt)</h3>
              <textarea
                style={{
                  ...styles.textarea,
                  ...styles.textareaLarge,
                  ...(isViewOnly ? styles.inputDisabled : {}),
                }}
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                placeholder="Beschreibe, wie der Agent sich verhalten soll..."
                disabled={isViewOnly}
              />
              <div style={styles.hint}>
                Diese Instruktionen definieren, wie der Agent sich verhält, denkt und kommuniziert.
              </div>
            </div>
          </div>

          {/* Side Column - Tabbed Panel */}
          <div style={styles.sideColumn}>
            {/* Tab Navigation */}
            <div style={styles.tabsContainer}>
              {[
                { id: 'tools', label: 'Tools' },
                { id: 'skills', label: 'Skills' },
                { id: 'model', label: 'Modell' },
                ...(!isSystemAgent && !isCreating ? [{ id: 'access', label: 'Berechtigungen' }] : []),
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    style={{
                      ...styles.tab,
                      ...(isActive ? styles.tabActive : {}),
                    }}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div style={styles.tabContent}>
              {/* Tools Tab */}
              {activeTab === 'tools' && (
                <div>
                  {isLoadingTools ? (
                    <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
                      Lade verfügbare Tools...
                    </div>
                  ) : (
                    <>
                      {formData.tools.length > 0 && (
                        <div style={styles.selectedToolsSummary}>
                          {formData.tools.map(toolName => (
                            <span key={toolName} style={styles.selectedToolTag}>
                              {availableTools.find(t => t.name === toolName)?.name || toolName}
                            </span>
                          ))}
                        </div>
                      )}

                      {getToolsByCategory().map(category => {
                        const isExpanded = expandedCategories[category.name];
                        const selectedInCategory = category.tools.filter(t =>
                          formData.tools.includes(t.name)
                        ).length;

                        return (
                          <div key={category.name} style={styles.toolCategory}>
                            <div
                              style={styles.toolCategoryHeader}
                              onClick={() => toggleCategory(category.name)}
                            >
                              <div style={styles.toolCategoryTitle}>
                                <ChevronIcon
                                  style={{
                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: `transform ${theme.transitions.fast}`,
                                  }}
                                />
                                {category.name}
                                <span style={styles.toolCategoryCount}>
                                  {category.tools.length}
                                </span>
                                {selectedInCategory > 0 && (
                                  <span style={{
                                    ...styles.toolCategoryCount,
                                    backgroundColor: theme.colors.primaryLight,
                                    color: theme.colors.primary,
                                  }}>
                                    {selectedInCategory} ausgewählt
                                  </span>
                                )}
                              </div>
                            </div>
                            {isExpanded && (
                              <div style={styles.toolCategoryContent}>
                                <div style={styles.toolGrid}>
                                  {category.tools.map(tool => {
                                    const isSelected = formData.tools.includes(tool.name);
                                    return (
                                      <div
                                        key={tool.name}
                                        style={{
                                          ...styles.toolItem,
                                          ...(isSelected ? styles.toolItemSelected : {}),
                                          ...(isViewOnly ? styles.toolItemDisabled : {}),
                                        }}
                                        onClick={() => handleToolToggle(tool.name)}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => {}}
                                          disabled={isViewOnly}
                                          style={{ marginTop: '2px', accentColor: theme.colors.primary }}
                                        />
                                        <div>
                                          <div style={styles.toolName}>{tool.name}</div>
                                          <div style={styles.toolDescription}>
                                            {tool.description || 'Keine Beschreibung'}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

              {/* Skills Tab */}
              {activeTab === 'skills' && (
                <div>
                  {/* Skill Mode Selection */}
                  <div style={{ marginBottom: theme.spacing.lg }}>
                    <label style={styles.label}>Skill-Zugriff</label>
                    <select
                      style={{
                        ...styles.modelSelect,
                        ...(isViewOnly ? styles.inputDisabled : {}),
                      }}
                      value={formData.skillMode || 'all'}
                      onChange={(e) => setFormData({ ...formData, skillMode: e.target.value })}
                      disabled={isViewOnly}
                    >
                      <option value="all">Alle Skills verfügbar</option>
                      <option value="allow">Nur ausgewählte Skills</option>
                      <option value="none">Keine Skills</option>
                    </select>
                    <div style={styles.hint}>
                      {formData.skillMode === 'all'
                        ? 'Der Agent kann alle aktivierten Skills nutzen.'
                        : formData.skillMode === 'none'
                        ? 'Der Agent kann keine Skills nutzen.'
                        : 'Der Agent kann nur die unten ausgewählten Skills nutzen.'}
                    </div>
                  </div>

                  {/* Skill Selection (only when mode is 'allow') */}
                  {formData.skillMode === 'allow' && (
                    <>
                      {isLoadingSkills ? (
                        <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
                          Lade verfügbare Skills...
                        </div>
                      ) : (
                        <>
                          {formData.skills.length > 0 && (
                            <div style={styles.selectedToolsSummary}>
                              {formData.skills.map(skillId => (
                                <span key={skillId} style={styles.selectedToolTag}>
                                  {availableSkills.find(s => s.id === skillId)?.name || skillId}
                                </span>
                              ))}
                            </div>
                          )}

                          {availableSkills.length === 0 ? (
                            <div style={{
                              padding: theme.spacing.lg,
                              backgroundColor: theme.colors.surfaceHover,
                              borderRadius: theme.borderRadius.lg,
                              textAlign: 'center',
                              color: theme.colors.textMuted,
                              fontSize: theme.typography.sizes.sm,
                            }}>
                              Keine Skills verfügbar
                            </div>
                          ) : (
                            <div style={styles.toolGrid}>
                              {availableSkills.map(skill => {
                                const isSelected = formData.skills.includes(skill.id);
                                return (
                                  <div
                                    key={skill.id}
                                    style={{
                                      ...styles.toolItem,
                                      ...(isSelected ? styles.toolItemSelected : {}),
                                      ...(isViewOnly ? styles.toolItemDisabled : {}),
                                    }}
                                    onClick={() => handleSkillToggle(skill.id)}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {}}
                                      disabled={isViewOnly}
                                      style={{ marginTop: '2px', accentColor: theme.colors.primary }}
                                    />
                                    <div>
                                      <div style={styles.toolName}>{skill.name}</div>
                                      <div style={styles.toolDescription}>
                                        {skill.description || 'Keine Beschreibung'}
                                      </div>
                                      {skill.triggers?.keywords?.length > 0 && (
                                        <div style={{
                                          fontSize: theme.typography.sizes.xs,
                                          color: theme.colors.textMuted,
                                          marginTop: theme.spacing.xs,
                                        }}>
                                          Keywords: {skill.triggers.keywords.slice(0, 3).join(', ')}
                                          {skill.triggers.keywords.length > 3 && '...'}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {formData.skillMode === 'all' && (
                    <div style={{
                      padding: theme.spacing.lg,
                      backgroundColor: theme.colors.surfaceHover,
                      borderRadius: theme.borderRadius.lg,
                      fontSize: theme.typography.sizes.sm,
                      color: theme.colors.textMuted,
                    }}>
                      <div style={{ fontWeight: theme.typography.weights.medium, marginBottom: theme.spacing.sm, color: theme.colors.text }}>
                        Alle Skills aktiv
                      </div>
                      Dieser Agent kann alle verfügbaren Skills automatisch nutzen, wenn ein Keyword in der Benutzernachricht erkannt wird.
                      {availableSkills.length > 0 && (
                        <div style={{ marginTop: theme.spacing.md }}>
                          Verfügbar: {availableSkills.map(s => s.name).join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  {formData.skillMode === 'none' && (
                    <div style={{
                      padding: theme.spacing.lg,
                      backgroundColor: theme.colors.surfaceHover,
                      borderRadius: theme.borderRadius.lg,
                      fontSize: theme.typography.sizes.sm,
                      color: theme.colors.textMuted,
                    }}>
                      <div style={{ fontWeight: theme.typography.weights.medium, marginBottom: theme.spacing.sm, color: theme.colors.text }}>
                        Skills deaktiviert
                      </div>
                      Dieser Agent kann keine Skills nutzen. Weder automatisches Skill-Matching noch manuelles Laden von Skills ist möglich.
                    </div>
                  )}
                </div>
              )}

              {/* Model Tab */}
              {activeTab === 'model' && (
                <div>
                  <div style={{ marginBottom: theme.spacing.md }}>
                    <label style={styles.label}>KI-Modell auswählen</label>
                    {formData.tools.length > 0 && (
                      <div style={{
                        fontSize: theme.typography.sizes.xs,
                        color: theme.colors.warning,
                        marginBottom: theme.spacing.sm,
                      }}>
                        Dieser Agent hat Tools - nur Modelle mit Tool-Calling werden angezeigt.
                      </div>
                    )}
                  </div>

                  <ModelSelector
                    formData={formData}
                    setFormData={setFormData}
                    enabledProviders={enabledProviders}
                    getModelsForAgent={getModelsForAgent}
                    getExtendedCapabilities={getExtendedCapabilities}
                    isViewOnly={isViewOnly}
                  />

                  <div style={{ marginTop: theme.spacing.lg, paddingTop: theme.spacing.lg, borderTop: `1px solid ${theme.colors.border}` }}>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                      Das ausgewählte Modell wird bei jeder Nutzung dieses Agenten verwendet, unabhängig von den Benutzereinstellungen.
                    </div>
                  </div>
                </div>
              )}

              {/* Access Tab */}
              {activeTab === 'access' && selectedAgent && !isSystemAgent && (
                <AccessManager
                  resourceType="agent"
                  resourceId={selectedAgent.id}
                  resourceName={selectedAgent.name}
                />
              )}
            </div>
          </div>
        </div>

        <ConfirmModal
          open={!!deleteCandidate}
          title="Agent löschen"
          message={
            deleteCandidate ? (
              <>
                Möchten Sie den Agenten <strong>{deleteCandidate.name}</strong> wirklich löschen?
                <br />
                Diese Aktion kann nicht rückgängig gemacht werden.
              </>
            ) : null
          }
          confirmLabel="Löschen"
          cancelLabel="Abbrechen"
          destructive
          busy={isDeleting}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />

        {showIconPicker && (
          <AgentIconPicker
            icon={formData.icon}
            color={formData.color}
            onApply={({ icon, color }) => { setFormData({ ...formData, icon, color }); setShowIconPicker(false); }}
            onClose={() => setShowIconPicker(false)}
          />
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: Overview (Default)
  // ==========================================

  const groups = deriveAccessGroups(agents);
  const groupDefs = [
    { id: 'all', label: 'Alle', items: agents, always: true },
    { id: 'own', label: 'Eigene', items: groups.own },
    { id: 'shared', label: 'Geteilt', items: groups.shared },
    { id: 'locked', label: 'Gesperrt', items: groups.locked },
    { id: 'system', label: 'System', items: groups.system },
  ];
  const tabs = groupDefs.map((g) => ({ id: g.id, label: g.label, count: g.items.length, always: g.always }));
  const activeDef = groupDefs.find((g) => g.id === activeGroup) || groupDefs[0];
  const visibleAgents = sortByName(filterBySearch(activeDef.items, search));

  const secondaryBtn = {
    ...styles.buttonSecondary,
    display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm,
  };

  return (
    <div style={styles.container}>
      <PageHeader
        title="Agenten"
        subtitle="Spezialisierte KI-Assistenten für wiederkehrende Aufgaben — vom Bewerbungscheck bis zum Sortieren von E-Mails. Du startest sie im Chat oder lässt passende Anfragen automatisch übernehmen."
        onToggleHelp={() => setHelpOpen((v) => !v)}
        helpOpen={helpOpen}
        actions={(
          <>
            <button style={secondaryBtn} onClick={() => navigate('/tools')} title="Werkzeuge, die Agenten nutzen können">
              <PlugIcon size={16} /> Tool-Katalog
            </button>
            <button style={styles.button} onClick={handleCreateNew}>
              <PlusIcon /> Neuer Agent
            </button>
          </>
        )}
      />

      <HelpPanel
        open={helpOpen}
        title="Was sind Agenten?"
        paragraphs={[
          'Ein Agent ist ein KI-Assistent für eine bestimmte Aufgabe — mit eigenen Anweisungen, Werkzeugen und Fähigkeiten. Du startest ihn im Chat, oder er wird automatisch für passende Anfragen genutzt.',
        ]}
        points={[
          { term: 'Eigene', desc: 'Agenten, die dir gehören und die du bearbeiten kannst.' },
          { term: 'Geteilt', desc: 'Von anderen für dich freigegeben — je nach Rolle nur ansehen oder mitbearbeiten.' },
          { term: 'Gesperrt', desc: 'Existieren, aber du hast (noch) keinen Zugriff. Zugriff bei der genannten Stelle anfragen.' },
          { term: 'System', desc: 'Fest eingebaute Agenten der Plattform — als Vorlage/Katalog nutzbar.' },
        ]}
      />

      {error && (
        <div style={styles.error}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.error }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={{ marginBottom: theme.spacing.lg }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Agenten suchen…" />
      </div>

      <GroupTabs tabs={tabs} active={activeGroup} onChange={setActiveGroup} />

      {visibleAgents.length === 0 ? (
        <EmptyState
          boxed
          icon={<RobotIcon size={44} color={theme.colors.textMuted} />}
          title={search ? 'Keine Agenten gefunden' : 'Keine Agenten in dieser Gruppe'}
          subtitle={search ? 'Passe deine Suche oder die Gruppe an.' : 'Erstelle einen neuen Agenten, um zu beginnen.'}
          action={!search && (
            <button style={styles.button} onClick={handleCreateNew}><PlusIcon /> Neuer Agent</button>
          )}
        />
      ) : (
        <CardGrid>
          {visibleAgents.map((agent) => {
            const colors = agentColors[agent.id] || agentColors.default;
            const locked = agent.accessible === false;
            const isInactive = agent.active === false;
            const ownerLabel = agent.owner
              ? (agent.owner.principalType === 'group' ? `Gruppe ${agent.owner.name}` : agent.owner.name)
              : 'Admin';
            // Rollen-Badge nur bei GETEILTEN Agenten (Zugriffsstufe) — bei eigenen
            // wäre „Owner" auf jeder Kachel redundant.
            const sharedRole = !agent.system && agent.role && agent.role !== 'owner' ? agent.role : null;
            const badges = [];
            if (isInactive) badges.push({ label: 'Inaktiv', variant: 'muted' });
            if (agent.delegatable && !isInactive) badges.push({ label: 'Delegierbar', variant: 'success' });
            if (agent.system) badges.push({ label: 'System', variant: 'primary' });
            // Gewähltes Icon/Farbe (falls gesetzt), sonst Fallback auf die per-ID-Verdrahtung.
            const glyphColor = agent.color || colors.color;
            const glyphBg = agent.color ? `${agent.color}22` : colors.bg;
            return (
              <ResourceCard
                key={agent.id}
                icon={agent.icon
                  ? <AgentGlyph icon={agent.icon} size={22} color={locked ? theme.colors.textMuted : glyphColor} />
                  : <AgentIcon agentId={agent.id} color={locked ? theme.colors.textMuted : colors.color} size={22} />}
                iconBg={glyphBg}
                title={agent.name}
                titleAccessory={sharedRole ? <RoleBadge role={sharedRole} size="sm" /> : null}
                description={typeof agent.description === 'string' ? agent.description : ''}
                badges={badges}
                locked={locked}
                lockedHint={`Zugriff anfragen bei ${ownerLabel}`}
                onClick={() => handleSelectAgent(agent)}
              />
            );
          })}
        </CardGrid>
      )}
    </div>
  );
}

// ==========================================
// Icons
// ==========================================

function AgentIcon({ agentId, color, size = 24 }) {
  switch (agentId) {
    case 'general':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      );
    case 'researcher':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      );
    case 'writer':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      );
    case 'knowledge':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
  }
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function ChevronIcon({ style = {} }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ToggleOnIcon() {
  return (
    <svg width="44" height="24" viewBox="0 0 44 24" fill="none">
      <rect x="2" y="4" width="40" height="16" rx="8" fill={theme.colors.success} />
      <circle cx="34" cy="12" r="6" fill="white" />
    </svg>
  );
}

function ToggleOffIcon() {
  return (
    <svg width="44" height="24" viewBox="0 0 44 24" fill="none">
      <rect x="2" y="4" width="40" height="16" rx="8" fill={theme.colors.border} stroke={theme.colors.border} />
      <circle cx="10" cy="12" r="6" fill="white" />
    </svg>
  );
}

export default AgentsPage;
