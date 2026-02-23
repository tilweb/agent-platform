/**
 * ExportDropdown
 * Reusable dropdown component for document export with multiple formats
 */

import { useState, useRef, useEffect } from 'react';
import { theme } from '../config/theme';
import { DownloadIcon } from './Icons';

const styles = {
  container: {
    position: 'relative',
    display: 'inline-block',
  },
  button: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    right: 0,
    minWidth: '180px',
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    boxShadow: theme.shadows.lg,
    zIndex: 100,
    overflow: 'hidden',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    cursor: 'pointer',
    border: 'none',
    backgroundColor: 'transparent',
    width: '100%',
    textAlign: 'left',
    transition: `background-color ${theme.transitions.fast}`,
  },
  dropdownItemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  formatIcon: {
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
  },
  formatLabel: {
    flex: 1,
  },
  loadingSpinner: {
    width: '14px',
    height: '14px',
    border: '2px solid transparent',
    borderTopColor: 'currentColor',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};

// Format configurations
const FORMAT_CONFIG = {
  md: {
    label: 'Markdown (.md)',
    description: 'Markdown Textdatei',
    color: '#6B7280',
    bgColor: '#F3F4F6',
  },
  xlsx: {
    label: 'Excel (.xlsx)',
    description: 'Microsoft Excel Tabelle',
    color: '#107C41',
    bgColor: '#E7F5EF',
  },
  pdf: {
    label: 'PDF (.pdf)',
    description: 'Adobe PDF Dokument',
    color: '#E34234',
    bgColor: '#FEEAEA',
  },
  docx: {
    label: 'Word (.docx)',
    description: 'Microsoft Word Dokument',
    color: '#2B579A',
    bgColor: '#E8F1FC',
  },
};

function ExportDropdown({
  onExport,
  formats = ['xlsx', 'pdf', 'docx'],
  isLoading = false,
  loadingFormat = null,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleExport = (format) => {
    if (isLoading || disabled) return;
    setIsOpen(false);
    onExport(format);
  };

  const toggleDropdown = () => {
    if (!disabled && !isLoading) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Main button */}
      <button
        style={{
          ...styles.button,
          ...((disabled || isLoading) ? styles.buttonDisabled : {}),
        }}
        onClick={toggleDropdown}
        disabled={disabled || isLoading}
        onMouseEnter={(e) => {
          if (!disabled && !isLoading) {
            e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <DownloadIcon />
        {isLoading ? 'Exportieren...' : 'Download'}
        <ChevronDownIcon style={{ marginLeft: '2px' }} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div style={styles.dropdown}>
          {formats.map((format) => {
            const config = FORMAT_CONFIG[format];
            if (!config) return null;

            const isFormatLoading = loadingFormat === format;

            return (
              <button
                key={format}
                style={{
                  ...styles.dropdownItem,
                  ...(isFormatLoading ? styles.dropdownItemDisabled : {}),
                }}
                onClick={() => handleExport(format)}
                disabled={isFormatLoading}
                onMouseEnter={(e) => {
                  if (!isFormatLoading) {
                    e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div
                  style={{
                    ...styles.formatIcon,
                    backgroundColor: config.bgColor,
                    color: config.color,
                  }}
                >
                  {format.toUpperCase().slice(0, 3)}
                </div>
                <span style={styles.formatLabel}>{config.label}</span>
                {isFormatLoading && (
                  <div style={styles.loadingSpinner} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Icons
function ChevronDownIcon({ style = {} }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default ExportDropdown;
