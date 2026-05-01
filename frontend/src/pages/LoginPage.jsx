import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useBranding } from '../hooks/useBranding';
import { theme } from '../config/theme';

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
    position: 'relative',
    zIndex: 1,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing['2xl'],
    width: '100%',
    maxWidth: '400px',
    boxShadow: theme.shadows.lg,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing['2xl'],
    justifyContent: 'center',
  },
  logoIcon: {
    width: '48px',
    height: '48px',
    borderRadius: theme.borderRadius.lg,
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryDark} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
  },
  logoText: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },
  input: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontSize: theme.typography.sizes.base,
    outline: 'none',
    transition: `border-color ${theme.transitions.fast}`,
  },
  button: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    backgroundColor: theme.colors.primary,
    color: 'white',
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `background-color ${theme.transitions.fast}`,
    marginTop: theme.spacing.md,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.textMuted,
    cursor: 'not-allowed',
  },
  error: {
    backgroundColor: `${theme.colors.error}15`,
    border: `1px solid ${theme.colors.error}30`,
    color: theme.colors.error,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
  },
  toggle: {
    textAlign: 'center',
    marginTop: theme.spacing.xl,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  toggleLink: {
    color: theme.colors.primary,
    cursor: 'pointer',
    fontWeight: theme.typography.weights.medium,
  },
  setupBanner: {
    backgroundColor: `${theme.colors.primary}15`,
    border: `1px solid ${theme.colors.primary}30`,
    color: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
};

function LogoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

export default function LoginPage() {
  const { login, register, initialized, loading: authLoading } = useAuth();
  const branding = useBranding();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Self-Registration ist generell aus. Die Register-Form erscheint nur
  // automatisch wenn die Instanz noch keinen User hat (Bootstrap-Admin).
  const showRegister = initialized === false;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (showRegister) {
        await register(username, password, email || undefined, displayName || undefined);
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', color: theme.colors.textMuted }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.title}
                style={{ width: 48, height: 48, objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <LogoIcon />
            )}
          </div>
          <span style={styles.logoText}>{branding.title}</span>
        </div>
        {branding.loginSubtitle && (
          <p style={{
            textAlign: 'center',
            color: theme.colors.textMuted,
            fontSize: theme.typography.sizes.sm,
            marginTop: theme.spacing.xs,
            marginBottom: theme.spacing.lg,
          }}>
            {branding.loginSubtitle}
          </p>
        )}

        {initialized === false && (
          <div style={styles.setupBanner}>
            Welcome! Create your admin account to get started.
          </div>
        )}

        <h1 style={styles.title}>
          {showRegister ? 'Create Account' : 'Sign In'}
        </h1>

        {!showRegister && (
          <p style={styles.subtitle}>
            Enter your credentials to access the platform
          </p>
        )}

        {error && <div style={styles.error}>{error}</div>}

        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              style={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoFocus
            />
          </div>

          {showRegister && (
            <>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Display Name (optional)</label>
                <input
                  type="text"
                  style={styles.input}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Email (optional)</label>
                <input
                  type="email"
                  style={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
            </>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              style={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
            disabled={loading}
          >
            {loading ? 'Please wait...' : showRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
