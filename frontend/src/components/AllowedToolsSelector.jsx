import { useState, useEffect } from 'react';
import { theme } from '../config/theme';
import { apiGet } from '../utils/apiFetch';

const styles = {
  container: {},
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  sectionHint: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  toolGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: theme.spacing.md,
  },
  toolCard: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  toolCardSelected: {
    borderColor: '#8b5cf6',
    backgroundColor: '#8b5cf610',
  },
  toolHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  toolName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    fontFamily: theme.typography.fontMono,
  },
  toolBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    fontWeight: theme.typography.weights.medium,
    backgroundColor: '#8b5cf620',
    color: '#8b5cf6',
  },
  toolDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  toolType: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  selectedList: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
  },
  selectedTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  selectedTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  tag: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    backgroundColor: '#8b5cf620',
    color: '#8b5cf6',
  },
  tagRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    marginLeft: theme.spacing.xs,
    color: 'inherit',
    opacity: 0.7,
    fontSize: '12px',
  },
  loading: {
    textAlign: 'center',
    padding: theme.spacing.xl,
    color: theme.colors.textMuted,
  },
  emptyState: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
  },
};

function AllowedToolsSelector({ allowedTools, onChange }) {
  const [availableTools, setAvailableTools] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const response = await apiGet('/tools');
      if (!response.ok) throw new Error('Failed to fetch tools');
      const data = await response.json();
      setAvailableTools(data.tools || []);
    } catch (err) {
      console.error('Error fetching tools:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isSelected = (toolName) => allowedTools.includes(toolName);

  const handleToggle = (toolName) => {
    if (isSelected(toolName)) {
      onChange(allowedTools.filter(t => t !== toolName));
    } else {
      onChange([...allowedTools, toolName]);
    }
  };

  const handleRemove = (toolName) => {
    onChange(allowedTools.filter(t => t !== toolName));
  };

  if (isLoading) {
    return <div style={styles.loading}>Lade verfügbare Tools...</div>;
  }

  return (
    <div style={styles.container}>
      {/* Selected Summary */}
      {allowedTools.length > 0 && (
        <div style={styles.selectedList}>
          <div style={styles.selectedTitle}>
            Tools die der Skill hinzufügt ({allowedTools.length})
          </div>
          <div style={styles.selectedTags}>
            {allowedTools.map((toolName) => (
              <span key={toolName} style={styles.tag}>
                {toolName}
                <button
                  style={styles.tagRemove}
                  onClick={() => handleRemove(toolName)}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Available Tools */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Verfügbare Tools</div>
        <div style={styles.sectionHint}>
          Wähle Tools aus, die diesem Skill-Benutzer temporär zur Verfügung gestellt werden.
          Diese Tools werden dem Agent hinzugefügt wenn er den Skill lädt.
        </div>

        {availableTools.length === 0 ? (
          <div style={styles.emptyState}>Keine Tools verfügbar</div>
        ) : (
          <div style={styles.toolGrid}>
            {availableTools.map((tool) => {
              const selected = isSelected(tool.name);

              return (
                <div
                  key={tool.name}
                  style={{
                    ...styles.toolCard,
                    ...(selected ? styles.toolCardSelected : {}),
                  }}
                  onClick={() => handleToggle(tool.name)}
                >
                  <div style={styles.toolHeader}>
                    <span style={styles.toolName}>{tool.name}</span>
                    {selected && (
                      <span style={styles.toolBadge}>
                        Ausgewählt
                      </span>
                    )}
                  </div>
                  <div style={styles.toolDescription}>
                    {tool.description?.substring(0, 100) || 'Keine Beschreibung'}
                    {tool.description?.length > 100 ? '...' : ''}
                  </div>
                  <div style={styles.toolType}>
                    Typ: {tool.type}
                    {tool.category && ` | ${tool.category}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AllowedToolsSelector;
