/**
 * KnowledgePanel
 * Displays PM Masterclass knowledge for the current wizard step
 * Shown in the right sidebar of the wizard
 */

import { useState, useEffect } from 'react';
import { theme } from '../../../config/theme';
import { apiGet, apiPost } from '../../../utils/apiFetch';
import AnalysisResult from './AnalysisResult';

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.primaryLight,
  },
  headerIcon: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  title: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.primary,
  },
  stepTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  stepDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 1.5,
  },
  // Pill-Style Tabs (nur 2 Tabs)
  tabs: {
    display: 'flex',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  tab: {
    flex: 1,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  tabActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: theme.spacing.lg,
  },
  // Akkordeon Styles
  accordion: {
    marginBottom: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  accordionHeader: {
    width: '100%',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    border: 'none',
    borderRadius: 0,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    transition: `all ${theme.transitions.fast}`,
  },
  accordionHeaderActive: {
    backgroundColor: theme.colors.background,
  },
  accordionHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  accordionIcon: {
    color: theme.colors.textMuted,
    transition: `transform ${theme.transitions.fast}`,
  },
  accordionIconOpen: {
    transform: 'rotate(180deg)',
  },
  accordionContent: {
    padding: theme.spacing.md,
    paddingTop: 0,
    backgroundColor: theme.colors.surface,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  list: {
    margin: 0,
    paddingLeft: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: 1.7,
  },
  listItem: {
    marginBottom: theme.spacing.sm,
  },
  category: {
    marginBottom: theme.spacing.lg,
  },
  categoryTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  tip: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.successLight,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    borderLeft: `3px solid ${theme.colors.success}`,
  },
  warning: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.warningLight,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    borderLeft: `3px solid ${theme.colors.warning}`,
  },
  error: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    borderLeft: `3px solid ${theme.colors.error}`,
  },
  exampleBlock: {
    marginBottom: theme.spacing.md,
  },
  exampleLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  loading: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  empty: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
  },
  emptyIcon: {
    marginBottom: theme.spacing.md,
    opacity: 0.5,
  },
  // Analysis button and section
  analyzeSection: {
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
  },
  analyzeButton: {
    width: '100%',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    transition: `all ${theme.transitions.fast}`,
  },
  analyzeButtonDisabled: {
    backgroundColor: theme.colors.border,
    cursor: 'not-allowed',
  },
  analyzeButtonLoading: {
    backgroundColor: theme.colors.primaryHover,
  },
  analysisContent: {
    padding: theme.spacing.lg,
  },
  analysisError: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    marginTop: theme.spacing.md,
  },
  // Empty analysis state
  emptyAnalysis: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['2xl'],
    textAlign: 'center',
  },
  emptyAnalysisIcon: {
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
    opacity: 0.5,
  },
  emptyAnalysisText: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyAnalysisHint: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    lineHeight: 1.5,
    maxWidth: '280px',
  },
};

// Map step numbers to knowledge step numbers (steps 8-9 don't have knowledge)
const KNOWLEDGE_STEP_MAP = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
};

// Akkordeon-Sektionen Konfiguration
const ACCORDION_SECTIONS = [
  { id: 'pruefkriterien', label: 'Prüfkriterien', icon: ChecklistIcon, color: theme.colors.primary },
  { id: 'fehler', label: 'Typische Fehler', icon: WarningIcon, color: theme.colors.error },
  { id: 'tipps', label: 'Tipps & Beispiele', icon: LightbulbIcon, color: theme.colors.success },
  { id: 'konzepte', label: 'Kernkonzepte', icon: BookIcon, color: theme.colors.info },
];

function KnowledgePanel({ currentStep, projektauftrag, analyses = {}, onAnalysisComplete }) {
  const [knowledge, setKnowledge] = useState(null);
  const [activeTab, setActiveTab] = useState('wissen');
  const [isLoading, setIsLoading] = useState(false);

  // Akkordeon State - welche Sektionen sind offen
  const [openSections, setOpenSections] = useState(['pruefkriterien']);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  const knowledgeStep = KNOWLEDGE_STEP_MAP[currentStep];
  const canAnalyze = currentStep >= 2 && currentStep <= 7;

  // Aktuelle Analyse für diesen Step (aus Props)
  const analysis = analyses[currentStep] || null;

  useEffect(() => {
    if (knowledgeStep) {
      loadKnowledge();
    } else {
      setKnowledge(null);
    }
    // Reset error when step changes
    setAnalysisError(null);
  }, [knowledgeStep]);

  // Switch tab when step changes based on whether analysis exists
  useEffect(() => {
    setActiveTab(analyses[currentStep] ? 'analyse' : 'wissen');
  }, [currentStep]); // Nur bei Step-Wechsel, nicht bei analyses-Änderung

  // Toggle Akkordeon-Sektion
  const toggleSection = (sectionId) => {
    setOpenSections((prev) => {
      if (prev.includes(sectionId)) {
        return prev.filter((id) => id !== sectionId);
      }
      return [...prev, sectionId];
    });
  };

  // Handle KI analysis
  const handleAnalyze = async () => {
    if (!projektauftrag || isAnalyzing) return;

    try {
      setIsAnalyzing(true);
      setAnalysisError(null);

      const response = await apiPost(
        `/apps/projektmanagement/analyse/step/${currentStep}`,
        { projektauftrag }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Analyse fehlgeschlagen');
      }

      const data = await response.json();
      // Notify parent about the new analysis
      if (onAnalysisComplete) {
        onAnalysisComplete(currentStep, data.analysis);
      }
      setActiveTab('analyse');
    } catch (error) {
      console.error('Error analyzing step:', error);
      setAnalysisError(error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadKnowledge = async () => {
    try {
      setIsLoading(true);
      const response = await apiGet(`/apps/projektmanagement/knowledge/${knowledgeStep}`);
      if (response.ok) {
        const data = await response.json();
        setKnowledge(data.knowledge);
      } else {
        console.error('Knowledge API returned error:', response.status);
        setKnowledge(null);
      }
    } catch (error) {
      console.error('Error loading knowledge:', error);
      setKnowledge(null);
    } finally {
      setIsLoading(false);
    }
  };

  // No knowledge for steps 8-9
  if (!knowledgeStep) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>
            <BookIcon size={32} />
          </div>
          <p>Kein Masterclass-Wissen für diesen Schritt verfügbar.</p>
        </div>
      </div>
    );
  }

  const renderPruefkriterien = () => {
    if (!knowledge?.pruefkriterien) return <p style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>Keine Prüfkriterien verfügbar.</p>;

    return (
      <div>
        {Object.entries(knowledge.pruefkriterien).map(([category, criteria]) => (
          <div key={category} style={styles.category}>
            <div style={styles.categoryTitle}>{formatCategoryName(category)}</div>
            {Array.isArray(criteria) ? (
              <ul style={styles.list}>
                {criteria.map((criterion, idx) => (
                  <li key={idx} style={styles.listItem}>{criterion}</li>
                ))}
              </ul>
            ) : typeof criteria === 'string' ? (
              <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text }}>{criteria}</p>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  const renderTypischeFehler = () => {
    if (!knowledge?.typische_fehler) return <p style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>Keine typischen Fehler dokumentiert.</p>;

    if (Array.isArray(knowledge.typische_fehler)) {
      return (
        <div>
          {knowledge.typische_fehler.map((fehler, idx) => (
            <div key={idx} style={styles.error}>
              {fehler}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div>
        {Object.entries(knowledge.typische_fehler).map(([category, fehler]) => (
          <div key={category} style={styles.category}>
            <div style={styles.categoryTitle}>{formatCategoryName(category)}</div>
            {Array.isArray(fehler) && fehler.map((f, idx) => (
              <div key={idx} style={styles.error}>{f}</div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  // Helper function to render array items (strings or objects)
  const renderArrayItem = (item, idx) => {
    // Handle string items
    if (typeof item === 'string') {
      return (
        <div key={idx} style={{ ...styles.tip, marginBottom: theme.spacing.xs }}>
          {item}
        </div>
      );
    }
    // Handle object items - render all properties
    if (typeof item === 'object' && item !== null) {
      return (
        <div key={idx} style={{ ...styles.tip, marginBottom: theme.spacing.xs }}>
          {/* Common patterns: name/aufwand, item/berechnung, rolle/beschreibung, description/probability/impact/mitigation */}
          {item.name && <strong>{item.name}</strong>}
          {item.item && <strong>{item.item}</strong>}
          {item.rolle && <strong>{item.rolle}</strong>}
          {item.description && <strong>{item.description}</strong>}
          {item.aufwand && <span> - {item.aufwand}</span>}
          {item.berechnung && <span> - {item.berechnung}</span>}
          {item.beschreibung && <span> - {item.beschreibung}</span>}
          {(item.probability || item.impact) && (
            <span> ({item.probability && `W: ${item.probability}`}{item.probability && item.impact && ', '}{item.impact && `A: ${item.impact}`})</span>
          )}
          {item.mitigation && (
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
              → {item.mitigation}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const renderVerbesserungen = () => {
    if (!knowledge?.verbesserungsvorschlaege) return <p style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>Keine Tipps verfügbar.</p>;

    const suggestions = knowledge.verbesserungsvorschlaege;

    return (
      <div>
        {Object.entries(suggestions).map(([key, value]) => {
          // Simple string value
          if (typeof value === 'string') {
            return (
              <div key={key} style={styles.tip}>
                <strong>{formatCategoryName(key)}:</strong> {value}
              </div>
            );
          }

          // Object with various structures
          if (typeof value === 'object' && value !== null) {
            return (
              <div key={key} style={styles.exampleBlock}>
                <div style={styles.categoryTitle}>{formatCategoryName(key)}</div>

                {/* Handle "tipp" property */}
                {value.tipp && (
                  <div style={styles.tip}>
                    {value.tipp}
                  </div>
                )}

                {/* Handle "beispiel" object */}
                {value.beispiel && typeof value.beispiel === 'object' && (
                  <div style={{ marginTop: theme.spacing.sm }}>
                    {Object.entries(value.beispiel).map(([bKey, bValue]) => (
                      <div key={bKey} style={{ fontSize: theme.typography.sizes.sm, marginBottom: theme.spacing.xs }}>
                        <strong>{formatCategoryName(bKey)}:</strong> {bValue}
                      </div>
                    ))}
                  </div>
                )}

                {/* Handle schlecht/besser/optimal pattern */}
                {value.schlecht && (
                  <div style={styles.error}>
                    <div style={styles.exampleLabel}>Vermeiden</div>
                    {value.schlecht}
                  </div>
                )}
                {value.besser && (
                  <div style={styles.warning}>
                    <div style={styles.exampleLabel}>Besser</div>
                    {value.besser}
                  </div>
                )}
                {value.optimal && (
                  <div style={styles.tip}>
                    <div style={styles.exampleLabel}>Optimal</div>
                    {value.optimal}
                  </div>
                )}

                {/* Handle nested objects with arrays (like pm_aufgaben, fachliche_aufgaben, kategorien, risiko_beispiele) */}
                {Object.entries(value).map(([subKey, subValue]) => {
                  // Skip already handled keys
                  if (['tipp', 'beispiel', 'schlecht', 'besser', 'optimal'].includes(subKey)) return null;

                  // Handle array of objects or strings
                  if (Array.isArray(subValue)) {
                    return (
                      <div key={subKey} style={{ marginTop: theme.spacing.md }}>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, marginBottom: theme.spacing.sm }}>
                          {formatCategoryName(subKey)}:
                        </div>
                        {subValue.map((item, idx) => renderArrayItem(item, idx))}
                      </div>
                    );
                  }

                  // Handle simple string properties within the object
                  if (typeof subValue === 'string') {
                    return (
                      <div key={subKey} style={{ ...styles.tip, marginTop: theme.spacing.sm }}>
                        <strong>{formatCategoryName(subKey)}:</strong> {subValue}
                      </div>
                    );
                  }

                  // Handle nested objects (like organisation_struktur.auftraggeber_ebene, stakeholder_beispiele.intern)
                  if (typeof subValue === 'object' && subValue !== null) {
                    return (
                      <div key={subKey} style={{ marginTop: theme.spacing.md }}>
                        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, marginBottom: theme.spacing.sm }}>
                          {formatCategoryName(subKey)}:
                        </div>
                        {Object.entries(subValue).map(([nestedKey, nestedValue]) => {
                          // Handle arrays within nested objects
                          if (Array.isArray(nestedValue)) {
                            return (
                              <div key={nestedKey} style={{ marginTop: theme.spacing.sm, marginLeft: theme.spacing.md }}>
                                <div style={{ fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>
                                  {formatCategoryName(nestedKey)}:
                                </div>
                                {nestedValue.map((item, idx) => renderArrayItem(item, idx))}
                              </div>
                            );
                          }
                          // Handle string properties in nested objects
                          if (typeof nestedValue === 'string') {
                            return (
                              <div key={nestedKey} style={{ ...styles.tip, marginTop: theme.spacing.xs, marginLeft: theme.spacing.md }}>
                                <strong>{formatCategoryName(nestedKey)}:</strong> {nestedValue}
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  const renderKernkonzepte = () => {
    if (!knowledge?.kernkonzepte) return <p style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>Keine Kernkonzepte verfügbar.</p>;

    return (
      <div>
        {renderKernkonzepteRecursive(knowledge.kernkonzepte)}
      </div>
    );
  };

  const renderKernkonzepteRecursive = (konzepte, level = 0) => {
    return Object.entries(konzepte).map(([key, value]) => {
      if (typeof value === 'string') {
        return (
          <div key={key} style={{ marginBottom: theme.spacing.sm, marginLeft: level * 16 }}>
            <strong>{formatCategoryName(key)}:</strong> {value}
          </div>
        );
      }
      if (Array.isArray(value)) {
        return (
          <div key={key} style={{ marginBottom: theme.spacing.md, marginLeft: level * 16 }}>
            <div style={{ fontWeight: theme.typography.weights.medium, marginBottom: theme.spacing.xs }}>
              {formatCategoryName(key)}:
            </div>
            <ul style={{ ...styles.list, marginLeft: theme.spacing.md }}>
              {value.map((item, idx) => (
                <li key={idx} style={styles.listItem}>{item}</li>
              ))}
            </ul>
          </div>
        );
      }
      if (typeof value === 'object' && value !== null) {
        return (
          <div key={key} style={styles.category}>
            <div style={styles.categoryTitle}>{formatCategoryName(key)}</div>
            {renderKernkonzepteRecursive(value, level + 1)}
          </div>
        );
      }
      return null;
    });
  };

  const formatCategoryName = (name) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Render-Funktionen für Akkordeon
  const renderSectionContent = (sectionId) => {
    switch (sectionId) {
      case 'pruefkriterien':
        return renderPruefkriterien();
      case 'fehler':
        return renderTypischeFehler();
      case 'tipps':
        return renderVerbesserungen();
      case 'konzepte':
        return renderKernkonzepte();
      default:
        return null;
    }
  };

  // Tabs: 2 Tabs für Steps 2-7 (wo Analyse möglich), sonst nur Wissen
  const tabs = canAnalyze
    ? [
        { id: 'analyse', label: 'KI-Analyse', icon: SparklesIcon },
        { id: 'wissen', label: 'Wissen', icon: BookIcon },
      ]
    : [
        { id: 'wissen', label: 'Masterclass-Wissen', icon: BookIcon },
      ];

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Masterclass-Wissen...</div>
      </div>
    );
  }

  if (!knowledge) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>
          <p>Wissen konnte nicht geladen werden.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerIcon}>
          <BookIcon size={16} />
          <span style={styles.title}>PM Masterclass</span>
        </div>
        <div style={styles.stepTitle}>{knowledge.meta?.title}</div>
        <div style={styles.stepDescription}>{knowledge.meta?.description}</div>
      </div>

      {/* Analyze Button for Steps 2-7 */}
      {canAnalyze && (
        <div style={styles.analyzeSection}>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !projektauftrag}
            style={{
              ...styles.analyzeButton,
              ...(isAnalyzing ? styles.analyzeButtonLoading : {}),
              ...(!projektauftrag ? styles.analyzeButtonDisabled : {}),
            }}
          >
            {isAnalyzing ? (
              <>
                <LoadingSpinner />
                Analysiere...
              </>
            ) : (
              <>
                <SparklesIcon />
                KI-Analyse starten
              </>
            )}
          </button>
          {analysisError && (
            <div style={styles.analysisError}>
              {analysisError}
            </div>
          )}
        </div>
      )}

      {/* Tabs - immer anzeigen wenn mehr als 1 Tab */}
      {tabs.length > 1 && (
        <div style={styles.tabs}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                style={{
                  ...styles.tab,
                  ...(isActive ? styles.tabActive : {}),
                }}
                onClick={() => setActiveTab(tab.id)}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <IconComponent />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div style={styles.content}>
        {/* KI-Analyse Tab */}
        {activeTab === 'analyse' && (
          analysis ? (
            <AnalysisResult analysis={analysis} />
          ) : (
            <div style={styles.emptyAnalysis}>
              <div style={styles.emptyAnalysisIcon}>
                <SparklesIcon size={32} />
              </div>
              <p style={styles.emptyAnalysisText}>Noch keine KI-Analyse durchgeführt</p>
              <p style={styles.emptyAnalysisHint}>
                Klicken Sie oben auf "KI-Analyse starten", um Ihre Eingaben gegen die Masterclass-Kriterien prüfen zu lassen.
              </p>
            </div>
          )
        )}

        {/* Wissen Tab - Akkordeon */}
        {activeTab === 'wissen' && (
          <div>
            {ACCORDION_SECTIONS.map((section) => {
              const isOpen = openSections.includes(section.id);
              const IconComponent = section.icon;
              return (
                <div key={section.id} style={styles.accordion}>
                  <button
                    style={{
                      ...styles.accordionHeader,
                      ...(isOpen ? styles.accordionHeaderActive : {}),
                    }}
                    onClick={() => toggleSection(section.id)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isOpen
                        ? theme.colors.background
                        : theme.colors.surface;
                    }}
                  >
                    <div style={styles.accordionHeaderLeft}>
                      <span style={{ color: section.color }}>
                        <IconComponent />
                      </span>
                      <span>{section.label}</span>
                    </div>
                    <span
                      style={{
                        ...styles.accordionIcon,
                        ...(isOpen ? styles.accordionIconOpen : {}),
                      }}
                    >
                      <ChevronDownIcon />
                    </span>
                  </button>
                  {isOpen && (
                    <div style={styles.accordionContent}>
                      {renderSectionContent(section.id)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Icons
function BookIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}

function SparklesIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{
        animation: 'spin 1s linear infinite',
      }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  );
}

export default KnowledgePanel;
