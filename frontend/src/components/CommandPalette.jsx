import { useState, useEffect, useRef, useCallback } from 'react';
import { theme } from '../config/theme';
import { useCommands } from '../hooks/useCommands';
import { getCommandIcon, SlashIcon } from './Icons';
import { AgentGlyph } from './AgentAvatar';

const styles = {
  overlay: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    boxShadow: theme.shadows.xl,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
    zIndex: 1000,
    maxHeight: '320px',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.textSecondary,
    transition: `all ${theme.transitions.fast}`,
  },
  list: {
    overflowY: 'auto',
    flex: 1,
    padding: theme.spacing.sm,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.lg,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    backgroundColor: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    outline: 'none',
  },
  itemSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  itemHover: {
    backgroundColor: theme.colors.surfaceHover,
  },
  itemIcon: {
    width: '28px',
    height: '28px',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceHover,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: theme.colors.primary,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  itemCommand: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontMono,
  },
  itemDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemActive: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: theme.colors.success,
  },
  itemArrow: {
    color: theme.colors.textLight,
    flexShrink: 0,
  },
  filterInput: {
    display: 'none', // Hidden, we use the main input
  },
  hint: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    borderTop: `1px solid ${theme.colors.borderLight}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  hintKey: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '20px',
    height: '20px',
    padding: `0 ${theme.spacing.xs}`,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.xs,
  },
  empty: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
};

/**
 * CommandPalette Component
 * Dropdown overlay for slash command selection
 */
export function CommandPalette({
  isOpen,
  onClose,
  onExecute,
  inputValue = '',
  selectedAgentId = null,
  agents = [],
}) {
  const { commands, options, fetchCommands, fetchOptions, clearOptions, isLoading } = useCommands();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [level, setLevel] = useState('commands'); // 'commands' | 'options'
  const [activeCommand, setActiveCommand] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const listRef = useRef(null);

  // Parse the current filter from input
  const getFilter = () => {
    if (!inputValue.startsWith('/')) return '';
    const parts = inputValue.slice(1).split(/\s+/);
    if (level === 'commands') {
      return parts[0] || '';
    } else {
      return parts.slice(1).join(' ') || '';
    }
  };

  const filter = getFilter();

  // Get filtered items based on current level
  const getItems = () => {
    if (level === 'commands') {
      const filtered = filter
        ? commands.filter(
            (cmd) =>
              cmd.id.toLowerCase().includes(filter.toLowerCase()) ||
              cmd.name.toLowerCase().includes(filter.toLowerCase())
          )
        : commands;
      return filtered;
    } else {
      const filtered = filter
        ? options.filter(
            (opt) =>
              opt.id.toLowerCase().includes(filter.toLowerCase()) ||
              opt.name.toLowerCase().includes(filter.toLowerCase())
          )
        : options;
      // Mark active option based on selectedAgentId
      return filtered.map((opt) => ({
        ...opt,
        isActive: activeCommand?.id === 'agent' && opt.id === (selectedAgentId || 'auto'),
      }));
    }
  };

  const items = getItems();

  // Load commands when palette opens
  useEffect(() => {
    if (isOpen) {
      fetchCommands().then(cmds => {
        console.log('Commands received from backend:', cmds);
        if (cmds.length > 0) {
          console.log('First command icon:', cmds[0].icon);
        }
      });
      setLevel('commands');
      setActiveCommand(null);
      setSelectedIndex(0);
      clearOptions();
    }
  }, [isOpen, fetchCommands, clearOptions]);

  // Check if we should navigate to options based on input
  useEffect(() => {
    if (!isOpen || !inputValue.startsWith('/')) return;

    const parts = inputValue.slice(1).split(/\s+/);
    const commandId = parts[0];

    // If user typed a valid command and a space, go to options
    if (parts.length > 1 && level === 'commands') {
      const cmd = commands.find((c) => c.id === commandId);
      if (cmd && cmd.hasOptions) {
        setActiveCommand(cmd);
        setLevel('options');
        fetchOptions(cmd.id);
        setSelectedIndex(0);
      }
    }
  }, [inputValue, isOpen, commands, level, fetchOptions]);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter, level]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && items.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, items.length]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (items.length > 0) {
            handleSelect(items[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Backspace':
          // If filter is empty and we're at options level, go back
          if (filter === '' && level === 'options') {
            e.preventDefault();
            setLevel('commands');
            setActiveCommand(null);
            clearOptions();
            setSelectedIndex(0);
          }
          break;
        case 'Tab':
          // Tab completes the selection
          e.preventDefault();
          if (items.length > 0) {
            handleSelect(items[selectedIndex]);
          }
          break;
      }
    },
    [isOpen, items, selectedIndex, filter, level, onClose, clearOptions]
  );

  // Attach keyboard listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Handle item selection
  const handleSelect = (item) => {
    if (level === 'commands') {
      const cmd = item;
      if (cmd.hasOptions) {
        // Go to options level
        setActiveCommand(cmd);
        setLevel('options');
        fetchOptions(cmd.id);
        setSelectedIndex(0);
      } else if (cmd.requiresArg) {
        // Command needs argument - notify parent to update input
        onExecute(cmd.id, null, null, { needsArg: true, argPlaceholder: cmd.argPlaceholder });
      } else {
        // Execute immediately
        onExecute(cmd.id);
      }
    } else {
      // Options level - execute command with selected option
      onExecute(activeCommand.id, item.id);
    }
  };

  // Handle back button
  const handleBack = () => {
    setLevel('commands');
    setActiveCommand(null);
    clearOptions();
    setSelectedIndex(0);
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      {/* Header */}
      <div style={styles.header}>
        {level === 'options' && (
          <button
            style={styles.backButton}
            onClick={handleBack}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        {level === 'commands' ? 'Was möchtest du tun?' : `${activeCommand?.name} auswählen`}
      </div>

      {/* Item List */}
      <div style={styles.list} ref={listRef}>
        {isLoading ? (
          <div style={styles.empty}>Laden...</div>
        ) : items.length === 0 ? (
          <div style={styles.empty}>
            {filter ? `Keine Treffer für "${filter}"` : 'Keine Optionen verfügbar'}
          </div>
        ) : (
          items.map((item, index) => (
            <button
              key={item.id}
              style={{
                ...styles.item,
                ...(selectedIndex === index ? styles.itemSelected : {}),
                ...(hoveredIndex === index && selectedIndex !== index ? styles.itemHover : {}),
              }}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => {
                setHoveredIndex(index);
                setSelectedIndex(index);
              }}
              onMouseLeave={() => setHoveredIndex(-1)}
            >
              <div style={styles.itemIcon}>
                {(() => {
                  // Für Agenten-Optionen das echte Icon+Farbe des Agenten zeigen
                  // (die „auto"-Option und normale Commands behalten ihr Icon).
                  if (level === 'options' && activeCommand?.id === 'agent' && item.id !== 'auto') {
                    const ag = agents.find((a) => a.id === item.id);
                    if (ag) return <AgentGlyph icon={ag.icon} color={ag.color} size={16} />;
                  }
                  return item.icon ? getCommandIcon(item.icon, { size: 16 }) : (level === 'commands' ? <SlashIcon size={16} /> : '•');
                })()}
              </div>
              <div style={styles.itemContent}>
                <div style={styles.itemName}>
                  {level === 'commands' && <span style={styles.itemCommand}>/{item.id}</span>}
                  <span>{item.name}</span>
                  {item.isActive && <span style={styles.itemActive} />}
                </div>
                {item.description && <div style={styles.itemDescription}>{item.description}</div>}
              </div>
              {level === 'commands' && item.hasOptions && (
                <div style={styles.itemArrow}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              )}
            </button>
          ))
        )}
      </div>

      {/* Keyboard Hints */}
      <div style={styles.hint}>
        <span>
          <span style={styles.hintKey}>↑↓</span>
          Navigieren
        </span>
        <span>
          <span style={styles.hintKey}>↵</span>
          Auswählen
        </span>
        <span>
          <span style={styles.hintKey}>Esc</span>
          Schließen
        </span>
        {level === 'options' && (
          <span>
            <span style={styles.hintKey}>⌫</span>
            Zurück
          </span>
        )}
      </div>
    </div>
  );
}

export default CommandPalette;
