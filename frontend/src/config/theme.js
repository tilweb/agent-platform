export const theme = {
  colors: {
    // Primary colors (Teal/Cyan accent like in screenshot)
    primary: '#14b8a6',
    primaryHover: '#0d9488',
    primaryLight: '#ccfbf1',
    primaryDark: '#0f766e',

    // Background colors
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceHover: '#f1f5f9',
    surfaceElevated: '#ffffff',

    // Sidebar (dark theme)
    sidebarBg: '#0f172a',
    sidebarText: '#94a3b8',
    sidebarTextActive: '#ffffff',
    sidebarHover: '#1e293b',
    sidebarAccent: '#14b8a6',

    // Text colors
    text: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    textLight: '#cbd5e1',

    // Border colors
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    borderFocus: '#14b8a6',

    // Status colors
    success: '#10b981',
    successLight: '#d1fae5',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    error: '#ef4444',
    errorLight: '#fee2e2',
    info: '#3b82f6',
    infoLight: '#dbeafe',

    // Agent status colors
    thinking: '#8b5cf6',
    thinkingLight: '#ede9fe',
    toolUse: '#f59e0b',
    delegation: '#3b82f6',
  },

  typography: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',

    sizes: {
      xs: '0.75rem',      // 12px
      sm: '0.8125rem',    // 13px
      base: '0.875rem',   // 14px
      md: '1rem',         // 16px
      lg: '1.125rem',     // 18px
      xl: '1.25rem',      // 20px
      '2xl': '1.5rem',    // 24px
      '3xl': '1.875rem',  // 30px
    },

    weights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },

    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.625,
    },
  },

  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '0.75rem',    // 12px
    lg: '1rem',       // 16px
    xl: '1.5rem',     // 24px
    '2xl': '2rem',    // 32px
    '3xl': '3rem',    // 48px
  },

  borderRadius: {
    sm: '0.25rem',    // 4px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    xl: '1rem',       // 16px
    '2xl': '1.5rem',  // 24px
    full: '9999px',
  },

  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.05)',
    panel: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
  },

  transitions: {
    fast: '150ms ease',
    normal: '200ms ease',
    slow: '300ms ease',
  },

  layout: {
    sidebarWidth: '240px',
    headerHeight: '64px',
    maxContentWidth: '900px',
    chatPanelWidth: '400px',
  },
};
