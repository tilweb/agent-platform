import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { theme } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { useApps } from '../hooks/useApps';

const sidebarStyles = {
  sidebar: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    width: theme.layout.sidebarWidth,
    backgroundColor: theme.colors.surface,
    borderRight: `1px solid ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  scrollableContent: {
    flex: 1,
    overflowY: 'auto',
    padding: `${theme.spacing.xl} 0`,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `0 ${theme.spacing.xl}`,
    marginBottom: theme.spacing['2xl'],
  },
  logoIcon: {
    width: '40px',
    height: '40px',
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surfaceHover,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    display: 'flex',
    flexDirection: 'column',
  },
  logoTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    lineHeight: 1,
    marginTop: '-2px',
  },
  logoSubtitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    lineHeight: 1,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: `0 ${theme.spacing.xl}`,
    marginBottom: theme.spacing.xs,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    textDecoration: 'none',
  },
  navItemActive: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.text,
  },
  navItemHover: {
    backgroundColor: theme.colors.surfaceHover,
  },
  iconWrapper: {
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // User menu styles - fixed at bottom
  userSection: {
    flexShrink: 0,
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    borderTop: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
    position: 'relative',
  },
  userButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    width: '100%',
    padding: theme.spacing.md,
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    textAlign: 'left',
  },
  userAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: theme.borderRadius.full,
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryDark} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    overflow: 'hidden',
  },
  userName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userEmail: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userChevron: {
    width: '16px',
    height: '16px',
    color: theme.colors.textMuted,
    flexShrink: 0,
    transition: `transform ${theme.transitions.fast}`,
  },
  // Dropdown menu
  dropdownOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 999,
  },
  dropdown: {
    position: 'absolute',
    bottom: '100%',
    left: theme.spacing.xl,
    right: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    boxShadow: theme.shadows.lg,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
    zIndex: 1000,
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    width: '100%',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    textDecoration: 'none',
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  dropdownItemIcon: {
    width: '18px',
    height: '18px',
    color: theme.colors.textMuted,
  },
  dropdownDivider: {
    height: '1px',
    backgroundColor: theme.colors.border,
    margin: `${theme.spacing.xs} 0`,
  },
  dropdownItemDanger: {
    color: theme.colors.error,
  },
  // Guest state
  loginButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    width: '100%',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primary,
    color: 'white',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
};

const navIconColors = {
  chat: '#14b8a6',
  search: '#06b6d4',
  projects: '#9333ea',
  agents: '#3b82f6',
  skills: '#8b5cf6',
  tools: '#f59e0b',
  mcp: '#10b981',
  knowledge: '#f97316',
  memory: '#ec4899',
  tasks: '#6366f1',
  tables: '#059669',
  providers: '#0ea5e9',
  connections: '#8b5cf6',
  settings: '#6b7280',
  apps: '#7c3aed',
  contract: '#0891b2',
  supplier: '#d97706',
  vsm: '#0369a1',
  extraction: '#0d9488',
};

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { user, isAuthenticated, logout } = useAuth();
  const { enabledApps } = useApps();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [verwaltungOpen, setVerwaltungOpen] = useState(() => {
    try { return localStorage.getItem('sidebar-verwaltung-open') !== 'false'; } catch { return true; }
  });
  const [appsOpen, setAppsOpen] = useState(() => {
    try { return localStorage.getItem('sidebar-apps-open') !== 'false'; } catch { return true; }
  });
  const dropdownRef = useRef(null);

  const isActive = (path) => currentPath === path;

  // Persist collapse states
  useEffect(() => {
    try { localStorage.setItem('sidebar-verwaltung-open', String(verwaltungOpen)); } catch {}
  }, [verwaltungOpen]);
  useEffect(() => {
    try { localStorage.setItem('sidebar-apps-open', String(appsOpen)); } catch {}
  }, [appsOpen]);

  // Auto-open sections if an item inside is active
  const verwaltungPaths = ['/agents', '/skills', '/tools', '/memory', '/tasks', '/tables', '/extraction'];
  useEffect(() => {
    if (verwaltungPaths.some(p => currentPath === p || currentPath.startsWith(p + '/'))) {
      setVerwaltungOpen(true);
    }
    if (currentPath.startsWith('/apps/')) {
      setAppsOpen(true);
    }
  }, [currentPath]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  const handleSettingsClick = () => {
    setDropdownOpen(false);
    navigate('/settings');
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (!user) return '?';
    if (user.displayName) {
      const parts = user.displayName.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return user.displayName.slice(0, 2).toUpperCase();
    }
    return user.username?.slice(0, 2).toUpperCase() || '?';
  };

  return (
    <aside style={sidebarStyles.sidebar}>
      {/* Scrollable Navigation Area */}
      <div style={sidebarStyles.scrollableContent}>
        {/* Logo */}
        <div style={sidebarStyles.logo}>
          <div style={sidebarStyles.logoIcon}>
            <LogoIcon />
          </div>
          <div style={sidebarStyles.logoText}>
            <span style={sidebarStyles.logoSubtitle}>Adacor</span>
            <span style={sidebarStyles.logoTitle}>Workplace</span>
          </div>
        </div>

        {/* Main Navigation */}
        <div style={sidebarStyles.section}>
          <div style={sidebarStyles.sectionTitle}>Hauptmenü</div>

          <Link
            to="/"
            style={{
              ...sidebarStyles.navItem,
              ...(isActive('/') ? sidebarStyles.navItemActive : {}),
            }}
          >
            <div style={sidebarStyles.iconWrapper}>
              <ChatIcon color={navIconColors.chat} />
            </div>
            <span>Chat</span>
          </Link>

          <Link
            to="/search"
            style={{
              ...sidebarStyles.navItem,
              ...(isActive('/search') ? sidebarStyles.navItemActive : {}),
            }}
          >
            <div style={sidebarStyles.iconWrapper}>
              <SearchIcon color={navIconColors.search} />
            </div>
            <span>Suche</span>
          </Link>

          <Link
            to="/projects"
            style={{
              ...sidebarStyles.navItem,
              ...(currentPath.startsWith('/projects') ? sidebarStyles.navItemActive : {}),
            }}
          >
            <div style={sidebarStyles.iconWrapper}>
              <ProjectsIcon color={navIconColors.projects} />
            </div>
            <span>Spaces</span>
          </Link>

          <Link
            to="/knowledge"
            style={{
              ...sidebarStyles.navItem,
              ...(isActive('/knowledge') ? sidebarStyles.navItemActive : {}),
            }}
          >
            <div style={sidebarStyles.iconWrapper}>
              <KnowledgeIcon color={navIconColors.knowledge} />
            </div>
            <span>Knowledge Base</span>
          </Link>
        </div>

        {/* Apps Section - collapsible, above Verwaltung */}
        {enabledApps.length > 0 && (
          <div style={sidebarStyles.section}>
            <div
              style={{ ...sidebarStyles.sectionTitle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
              onClick={() => setAppsOpen(prev => !prev)}
            >
              <span>Apps</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: `transform ${theme.transitions.fast}`, transform: appsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {appsOpen && <>
            {enabledApps.map((app) => (
              <Link
                key={app.id}
                to={`/apps/${app.id}`}
                style={{
                  ...sidebarStyles.navItem,
                  ...(currentPath.startsWith(`/apps/${app.id}`) ? sidebarStyles.navItemActive : {}),
                }}
              >
                <div style={sidebarStyles.iconWrapper}>
                  <AppNavIcon iconId={app.icon} />
                </div>
                <span>{app.name}</span>
              </Link>
            ))}
            </>}
          </div>
        )}

        {/* Management - collapsible */}
        <div style={sidebarStyles.section}>
          <div
            style={{ ...sidebarStyles.sectionTitle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
            onClick={() => setVerwaltungOpen(prev => !prev)}
          >
            <span>Verwaltung</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: `transform ${theme.transitions.fast}`, transform: verwaltungOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {verwaltungOpen && <>
          <Link
            to="/agents"
            style={{
              ...sidebarStyles.navItem,
              ...(isActive('/agents') ? sidebarStyles.navItemActive : {}),
            }}
          >
            <div style={sidebarStyles.iconWrapper}>
              <AgentsIcon color={navIconColors.agents} />
            </div>
            <span>Agenten</span>
          </Link>

          <Link
            to="/skills"
            style={{
              ...sidebarStyles.navItem,
              ...(isActive('/skills') ? sidebarStyles.navItemActive : {}),
            }}
          >
            <div style={sidebarStyles.iconWrapper}>
              <SkillsIcon color={navIconColors.skills} />
            </div>
            <span>Skills</span>
          </Link>

          <Link
            to="/tools"
            style={{
              ...sidebarStyles.navItem,
              ...(isActive('/tools') ? sidebarStyles.navItemActive : {}),
            }}
          >
            <div style={sidebarStyles.iconWrapper}>
              <ToolsIcon color={navIconColors.tools} />
            </div>
            <span>Tools</span>
          </Link>

          <Link
            to="/memory"
            style={{
              ...sidebarStyles.navItem,
              ...(isActive('/memory') ? sidebarStyles.navItemActive : {}),
            }}
          >
            <div style={sidebarStyles.iconWrapper}>
              <MemoryIcon color={navIconColors.memory} />
            </div>
            <span>Memory</span>
          </Link>

          <Link
            to="/tasks"
            style={{
              ...sidebarStyles.navItem,
              ...(isActive('/tasks') ? sidebarStyles.navItemActive : {}),
            }}
          >
            <div style={sidebarStyles.iconWrapper}>
              <TasksIcon color={navIconColors.tasks} />
            </div>
            <span>Tasks</span>
          </Link>

          <Link
            to="/tables"
            style={{
              ...sidebarStyles.navItem,
              ...(currentPath.startsWith('/tables') ? sidebarStyles.navItemActive : {}),
            }}
          >
            <div style={sidebarStyles.iconWrapper}>
              <TablesIcon color={navIconColors.tables} />
            </div>
            <span>Tabellen</span>
          </Link>

          <Link
            to="/extraction"
            style={{
              ...sidebarStyles.navItem,
              ...(isActive('/extraction') ? sidebarStyles.navItemActive : {}),
            }}
          >
            <div style={sidebarStyles.iconWrapper}>
              <ExtractionIcon color={navIconColors.extraction} />
            </div>
            <span>Extraktion</span>
          </Link>
          </>}
        </div>

      </div>

      {/* User Section */}
      <div style={sidebarStyles.userSection} ref={dropdownRef}>
        {isAuthenticated && user ? (
          <>
            {/* User Button */}
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                ...sidebarStyles.userButton,
                backgroundColor: dropdownOpen ? theme.colors.surfaceHover : 'transparent',
              }}
              onMouseOver={(e) => {
                if (!dropdownOpen) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
              }}
              onMouseOut={(e) => {
                if (!dropdownOpen) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={sidebarStyles.userAvatar}>
                {getInitials()}
              </div>
              <div style={sidebarStyles.userInfo}>
                <div style={sidebarStyles.userName}>
                  {user.displayName || user.username}
                </div>
                {user.email && (
                  <div style={sidebarStyles.userEmail}>
                    {user.email}
                  </div>
                )}
              </div>
              <svg
                style={{
                  ...sidebarStyles.userChevron,
                  transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <>
                <div
                  style={sidebarStyles.dropdownOverlay}
                  onClick={() => setDropdownOpen(false)}
                />
                <div style={sidebarStyles.dropdown}>
                  <button
                    onClick={handleSettingsClick}
                    style={sidebarStyles.dropdownItem}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = theme.colors.surfaceHover}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <SettingsIcon style={sidebarStyles.dropdownItemIcon} />
                    <span>Einstellungen</span>
                  </button>

                  <div style={sidebarStyles.dropdownDivider} />

                  <button
                    onClick={handleLogout}
                    style={{
                      ...sidebarStyles.dropdownItem,
                      ...sidebarStyles.dropdownItemDanger,
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = theme.colors.errorLight}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <LogoutIcon style={{ ...sidebarStyles.dropdownItemIcon, color: theme.colors.error }} />
                    <span>Abmelden</span>
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <Link
            to="/login"
            style={sidebarStyles.loginButton}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = theme.colors.primaryHover}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = theme.colors.primary}
          >
            <LoginIcon />
            <span>Anmelden</span>
          </Link>
        )}
      </div>
    </aside>
  );
}

function LogoIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 167 162" fill="url(#logo-gradient)">
      <path d="M27.215 147.417c0 7.526-6.068 13.583-13.608 13.583C6.067 161 0 154.943 0 147.417c0-7.527 6.067-13.584 13.607-13.584 7.54 0 13.608 6.057 13.608 13.584ZM60.32 80.97l50.483-58.331c4.889-5.704 4.241-14.23-1.414-19.17-5.714-4.88-14.255-4.292-19.203 1.412L36.169 67.328h-8.954V13.583C27.215 6.057 21.088 0 13.607 0 6.127 0 0 6.057 0 13.583v90.849c0 7.527 6.067 13.584 13.607 13.584 7.54 0 13.608-6.057 13.608-13.584v-9.878h8.895l53.605 61.801c4.889 5.645 13.489 6.291 19.203 1.352 5.655-4.88 6.303-13.466 1.355-19.169L60.32 80.97Zm79.465-67.387C139.785 6.057 145.853 0 153.393 0 160.933 0 167 6.057 167 13.583c0 7.527-6.067 13.583-13.607 13.583-7.54 0-13.608-6.056-13.608-13.583Zm0 43.043c0-7.526 6.068-13.583 13.608-13.583 7.54 0 13.607 6.057 13.607 13.583v90.85c0 7.526-6.067 13.583-13.607 13.583-7.54 0-13.608-6.057-13.608-13.583v-90.85Z"/>
      <defs>
        <linearGradient id="logo-gradient" x1="0" x2="167" y1="79.456" y2="79.456" gradientUnits="userSpaceOnUse">
          <stop offset=".02" stopColor="#B173D9"/>
          <stop offset=".22" stopColor="#B173D9"/>
          <stop offset="1" stopColor="#03ADCF"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function ChatIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SearchIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function AgentsIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SkillsIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function ToolsIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function KnowledgeIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function McpIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function MemoryIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
      <path d="M8 14h.01" />
      <path d="M16 14h.01" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function TasksIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function ProjectsIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function ProvidersIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
      <polyline points="7.5 19.79 7.5 14.6 3 12" />
      <polyline points="21 12 16.5 14.6 16.5 19.79" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function TablesIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

function ExtractionIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <path d="M10 9l-2 2 2 2" />
    </svg>
  );
}

function ConnectionsIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function SettingsIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function LogoutIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

function VsmNavIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M3 12h4l3-9 4 18 3-9h4" />
    </svg>
  );
}

function AppNavIcon({ iconId }) {
  switch (iconId) {
    case 'contract':
      return <ContractNavIcon color={navIconColors.contract} />;
    case 'supplier':
      return <SupplierNavIcon color={navIconColors.supplier} />;
    case 'vsm':
      return <VsmNavIcon color={navIconColors.vsm} />;
    default:
      return <AppsNavIcon color={navIconColors.apps} />;
  }
}

function ContractNavIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function SupplierNavIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function AppsNavIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export default Sidebar;
