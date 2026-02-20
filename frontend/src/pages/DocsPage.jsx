import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { theme } from '../config/theme';

// Vite glob: lazy-load all doc markdown files
const docModules = import.meta.glob('@docs/**/*.md', { query: '?raw', import: 'default' });

// Build slug → loader lookup (handles both alias keys and resolved paths)
const docLoaders = {};
for (const [path, loader] of Object.entries(docModules)) {
  const m = path.match(/(?:@docs|docs\/anwenderdoku\/docs)\/(.+)\.md$/);
  if (m) docLoaders[m[1]] = loader;
}

const NAV = [
  { section: 'Start', pages: [
    { slug: 'index', title: 'Willkommen' },
  ]},
  { section: 'Erste Schritte', pages: [
    { slug: 'erste-schritte/registrierung', title: 'Registrierung & Login' },
    { slug: 'erste-schritte/oberflaeche', title: 'Oberfläche im Überblick' },
  ]},
  { section: 'Chat', pages: [
    { slug: 'chat/nachrichten', title: 'Nachrichten & Konversationen' },
    { slug: 'chat/materialien', title: 'Dateien & Materialien' },
    { slug: 'chat/export', title: 'Chat exportieren' },
  ]},
  { section: 'Agenten', pages: [
    { slug: 'agenten/index', title: 'Überblick' },
    { slug: 'agenten/system-agenten', title: 'System-Agenten' },
    { slug: 'agenten/eigene-agenten', title: 'Eigene Agenten erstellen' },
  ]},
  { section: 'Skills', pages: [
    { slug: 'skills/index', title: 'Überblick' },
    { slug: 'skills/verfuegbare-skills', title: 'Verfügbare Skills' },
  ]},
  { section: 'Wissensbasis', pages: [
    { slug: 'wissensbasisis/index', title: 'Knowledge Base' },
    { slug: 'wissensbasisis/speicher', title: 'Benutzer-Speicher' },
  ]},
  { section: 'Suche', pages: [
    { slug: 'suche/index', title: 'Übergreifende Suche' },
  ]},
  { section: 'Aufgaben', pages: [
    { slug: 'aufgaben/index', title: 'Hintergrund-Tasks' },
  ]},
  { section: 'Spaces', pages: [
    { slug: 'spaces/index', title: 'Spaces & Zusammenarbeit' },
  ]},
  { section: 'Tabellen', pages: [
    { slug: 'tabellen/index', title: 'Datenmanagement' },
  ]},
  { section: 'Bilder', pages: [
    { slug: 'bilder/index', title: 'Bildgenerierung' },
  ]},
  { section: 'Tools & MCP', pages: [
    { slug: 'tools/index', title: 'Tools' },
    { slug: 'mcp/index', title: 'MCP Server' },
  ]},
  { section: 'Benachrichtigungen', pages: [
    { slug: 'benachrichtigungen/index', title: 'Benachrichtigungen' },
  ]},
  { section: 'Transkription', pages: [
    { slug: 'transkription/index', title: 'Audio-Transkription' },
  ]},
  { section: 'Einstellungen', pages: [
    { slug: 'einstellungen/profil', title: 'Profil & Modelle' },
    { slug: 'einstellungen/benutzer', title: 'Benutzerverwaltung' },
    { slug: 'einstellungen/provider', title: 'KI-Modelle & Provider' },
    { slug: 'einstellungen/nutzung', title: 'Nutzungsstatistiken' },
    { slug: 'einstellungen/verbindungen', title: 'Verbindungen' },
    { slug: 'einstellungen/apps', title: 'Apps' },
    { slug: 'einstellungen/audit', title: 'Audit Log' },
  ]},
  { section: 'Sicherheit', pages: [
    { slug: 'sicherheit/authentifizierung', title: 'Authentifizierung' },
    { slug: 'sicherheit/berechtigungen', title: 'Berechtigungen & RBAC' },
  ]},
];

const FEATURES = [
  { title: 'Chat', desc: 'KI-gestützter Chat mit mehreren Agenten. Stellen Sie Fragen, lassen Sie Texte verfassen oder Analysen durchführen.', slug: 'chat/nachrichten' },
  { title: 'Agenten', desc: 'Spezialisierte KI-Assistenten für verschiedene Aufgabenbereiche. Vom Recherche-Agenten bis zum Code-Experten.', slug: 'agenten/index' },
  { title: 'Wissensbasis', desc: 'RAG-basierte Dokumentensuche über Ihre eigenen Inhalte. Laden Sie PDFs, Word-Dokumente und andere Dateien hoch.', slug: 'wissensbasisis/index' },
  { title: 'Suche', desc: 'Übergreifende Suche über alle Quellen — Chats, Wissensbasis, Tabellen und verbundene Systeme.', slug: 'suche/index' },
  { title: 'Aufgaben', desc: 'Hintergrund-Tasks für komplexe Analysen und langwierige Verarbeitungen.', slug: 'aufgaben/index' },
  { title: 'Spaces', desc: 'Teamarbeit in gemeinsamen Spaces. Teilen Sie Chats, Dokumente und Ergebnisse.', slug: 'spaces/index' },
  { title: 'Tabellen', desc: 'Strukturierte Datenverwaltung direkt in der Plattform. Erstellen, bearbeiten und durchsuchen Sie Tabellen.', slug: 'tabellen/index' },
  { title: 'Bilder', desc: 'KI-Bildgenerierung aus Textbeschreibungen mit verschiedenen Bildmodellen.', slug: 'bilder/index' },
  { title: 'Skills', desc: 'Erweiterbare Arbeitsabläufe, die komplexe Aufgaben automatisieren.', slug: 'skills/index' },
  { title: 'Tools', desc: 'Werkzeuge für KI-Agenten — von Websuche bis Tabellen-Zugriff. Erstellen Sie eigene API-Tools.', slug: 'tools/index' },
];

const styles = {
  container: {
    display: 'flex',
    height: '100%',
  },
  sidebar: {
    width: '260px',
    minWidth: '260px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    paddingTop: theme.spacing.xl,
    paddingLeft: theme.spacing.lg,
  },
  sidebarHeader: {
    paddingLeft: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  sidebarTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  sidebarSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  navContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    overflowY: 'auto',
    flex: 1,
  },
  sectionTitle: {
    padding: `${theme.spacing.lg} ${theme.spacing.md} ${theme.spacing.sm}`,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    userSelect: 'none',
  },
  sectionTitleFirst: {
    paddingTop: 0,
  },
  chevron: {
    width: '14px',
    height: '14px',
    color: theme.colors.textMuted,
    transition: `transform ${theme.transitions.fast}`,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: `all ${theme.transitions.fast}`,
  },
  navItemActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: theme.colors.background,
  },
  contentInner: {
    maxWidth: '860px',
    margin: '0 auto',
    padding: `${theme.spacing['2xl']} ${theme.spacing['3xl']}`,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  error: {
    padding: theme.spacing.xl,
    color: theme.colors.error,
    fontSize: theme.typography.sizes.sm,
  },
  // Feature card grid
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.md,
  },
  featureCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    transition: `all ${theme.transitions.fast}`,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
  },
  featureCardTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  featureCardDesc: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed,
    flex: 1,
  },
  featureCardLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.medium,
    marginTop: theme.spacing.md,
    textDecoration: 'none',
  },
  // Markdown styles
  mdH1: {
    fontSize: theme.typography.sizes['3xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    marginTop: theme.spacing['2xl'],
    lineHeight: theme.typography.lineHeight.tight,
  },
  mdH2: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginTop: theme.spacing['2xl'],
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  mdH3: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
  },
  mdH4: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
  },
  mdP: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.md,
  },
  mdUl: {
    paddingLeft: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  mdOl: {
    paddingLeft: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  mdLi: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.xs,
  },
  mdA: {
    color: theme.colors.primary,
    textDecoration: 'none',
    fontWeight: theme.typography.weights.medium,
  },
  mdBlockquote: {
    borderLeft: `3px solid ${theme.colors.primary}`,
    paddingLeft: theme.spacing.lg,
    margin: `${theme.spacing.md} 0`,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  mdHr: {
    border: 'none',
    borderTop: `1px solid ${theme.colors.border}`,
    margin: `${theme.spacing.xl} 0`,
  },
  mdTable: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
  },
  mdTh: {
    textAlign: 'left',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `2px solid ${theme.colors.border}`,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceHover,
  },
  mdTd: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    color: theme.colors.textSecondary,
  },
  mdInlineCode: {
    fontFamily: theme.typography.fontMono,
    fontSize: '0.85em',
    backgroundColor: theme.colors.surfaceHover,
    padding: '0.15em 0.4em',
    borderRadius: theme.borderRadius.sm,
    color: theme.colors.primary,
  },
  mdImg: {
    maxWidth: '100%',
    borderRadius: theme.borderRadius.lg,
    margin: `${theme.spacing.md} 0`,
  },
  mdStrong: {
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  // Callout styles
  callout: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    border: '1px solid',
  },
  calloutTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.sm,
  },
  calloutContent: {
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  // Code block wrapper
  codeBlockWrapper: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  codeBlockHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: '#282c34',
    fontSize: theme.typography.sizes.xs,
    color: '#abb2bf',
  },
  copyButton: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    backgroundColor: 'transparent',
    color: '#abb2bf',
    border: '1px solid #3e4451',
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.typography.sizes.xs,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
};

const CALLOUT_STYLES = {
  tip: {
    backgroundColor: `${theme.colors.successLight}80`,
    borderColor: theme.colors.success,
    titleColor: theme.colors.success,
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    label: 'Tipp',
  },
  info: {
    backgroundColor: `${theme.colors.infoLight}80`,
    borderColor: theme.colors.info,
    titleColor: theme.colors.info,
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    label: 'Info',
  },
  warning: {
    backgroundColor: `${theme.colors.warningLight}80`,
    borderColor: theme.colors.warning,
    titleColor: theme.colors.warning,
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
    label: 'Achtung',
  },
  danger: {
    backgroundColor: `${theme.colors.errorLight}80`,
    borderColor: theme.colors.error,
    titleColor: theme.colors.error,
    icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    label: 'Warnung',
  },
  example: {
    backgroundColor: `${theme.colors.primaryLight}80`,
    borderColor: theme.colors.primary,
    titleColor: theme.colors.primary,
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    label: 'Beispiel',
  },
};

// Parse GFM-style callouts: > [!type] Optional title
function parseCallouts(md) {
  const segments = [];
  const lines = md.split('\n');
  let i = 0;
  let currentMd = [];

  const flushMd = () => {
    const content = currentMd.join('\n');
    if (content.trim()) {
      segments.push({ type: 'md', content });
    }
    currentMd = [];
  };

  while (i < lines.length) {
    const match = lines[i].match(/^> \[!(\w+)\]\s*(.*)$/);
    if (match) {
      flushMd();
      const calloutType = match[1].toLowerCase();
      const title = match[2].trim() || CALLOUT_STYLES[calloutType]?.label || calloutType;
      const contentLines = [];
      i++;
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
        contentLines.push(lines[i] === '>' ? '' : lines[i].slice(2));
        i++;
      }
      segments.push({
        type: 'callout',
        calloutType,
        title,
        content: contentLines.join('\n').trim(),
      });
    } else {
      currentMd.push(lines[i]);
      i++;
    }
  }

  flushMd();
  return segments;
}

function FeatureGrid({ navigate }) {
  return (
    <>
      <h2 style={styles.mdH2}>Funktionsübersicht</h2>
      <div style={styles.cardGrid}>
        {FEATURES.map((f) => (
          <div
            key={f.slug}
            style={styles.featureCard}
            onClick={() => navigate(`/docs/${f.slug}`)}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
              e.currentTarget.style.boxShadow = theme.shadows.md;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={styles.featureCardTitle}>{f.title}</div>
            <div style={styles.featureCardDesc}>{f.desc}</div>
            <span style={styles.featureCardLink}>
              Mehr erfahren
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function Callout({ type, title, children }) {
  const style = CALLOUT_STYLES[type] || CALLOUT_STYLES.info;
  return (
    <div style={{
      ...styles.callout,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
    }}>
      <div style={{ ...styles.calloutTitle, color: style.titleColor }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d={style.icon} />
        </svg>
        {title}
      </div>
      <div style={styles.calloutContent}>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ language, children }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div style={styles.codeBlockWrapper}>
      <div style={styles.codeBlockHeader}>
        <span>{language || 'text'}</span>
        <button onClick={handleCopy} style={styles.copyButton}>
          {copied ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '1em',
          fontSize: '13px',
          lineHeight: 1.5,
        }}
        codeTagProps={{
          style: { fontFamily: theme.typography.fontMono },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

const markdownComponents = {
  h1: ({ children }) => <h1 style={styles.mdH1}>{children}</h1>,
  h2: ({ children }) => <h2 style={styles.mdH2}>{children}</h2>,
  h3: ({ children }) => <h3 style={styles.mdH3}>{children}</h3>,
  h4: ({ children }) => <h4 style={styles.mdH4}>{children}</h4>,
  p: ({ children }) => <p style={styles.mdP}>{children}</p>,
  ul: ({ children }) => <ul style={styles.mdUl}>{children}</ul>,
  ol: ({ children }) => <ol style={styles.mdOl}>{children}</ol>,
  li: ({ children }) => <li style={styles.mdLi}>{children}</li>,
  a: ({ href, children }) => {
    if (href && href.endsWith('.md') && !href.startsWith('http')) {
      const slug = href.replace(/\.md$/, '').replace(/^\.\//, '').replace(/^\.\.\//g, '');
      return <Link to={`/docs/${slug}`} style={styles.mdA}>{children}</Link>;
    }
    return <a href={href} style={styles.mdA} target="_blank" rel="noopener noreferrer">{children}</a>;
  },
  blockquote: ({ children }) => <blockquote style={styles.mdBlockquote}>{children}</blockquote>,
  hr: () => <hr style={styles.mdHr} />,
  table: ({ children }) => <table style={styles.mdTable}>{children}</table>,
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => <th style={styles.mdTh}>{children}</th>,
  td: ({ children }) => <td style={styles.mdTd}>{children}</td>,
  img: ({ src, alt }) => <img src={src} alt={alt} style={styles.mdImg} />,
  strong: ({ children }) => <strong style={styles.mdStrong}>{children}</strong>,
  code: ({ children, className, inline }) => {
    const codeContent = String(children);
    const hasLanguage = Boolean(className);
    const hasNewlines = codeContent.includes('\n');
    const isInline = inline === true || (!hasLanguage && !hasNewlines && inline !== false);

    if (isInline) {
      return <code style={styles.mdInlineCode}>{children}</code>;
    }

    const language = className?.replace('language-', '') || '';
    return <CodeBlock language={language}>{children}</CodeBlock>;
  },
};

function DocsMarkdown({ content }) {
  const navigate = useNavigate();
  const segments = useMemo(() => parseCallouts(content), [content]);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'callout') {
          return (
            <Callout key={i} type={seg.calloutType} title={seg.title}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {seg.content}
              </ReactMarkdown>
            </Callout>
          );
        }
        return (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {seg.content}
          </ReactMarkdown>
        );
      })}
    </>
  );
}

export default function DocsPage({ embedded = false }) {
  const params = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({});

  const slug = params['*'] || 'index';

  // Load page content via Vite glob loader
  useEffect(() => {
    setLoading(true);
    setError(null);

    const loader = docLoaders[slug];
    if (!loader) {
      setError('Seite nicht gefunden');
      setLoading(false);
      return;
    }

    loader()
      .then((md) => {
        setContent(md);
        setLoading(false);
      })
      .catch(() => {
        setError('Seite konnte nicht geladen werden');
        setLoading(false);
      });
  }, [slug]);

  const toggleSection = (sectionName) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  const handleNavClick = (pageSlug) => {
    navigate(`/docs/${pageSlug}`);
  };

  return (
    <div style={styles.container}>
      {/* Sidebar Navigation */}
      <div style={styles.sidebar}>
        {!embedded && (
          <div style={styles.sidebarHeader}>
            <div style={styles.sidebarTitle}>Dokumentation</div>
            <div style={styles.sidebarSubtitle}>Anwenderdokumentation</div>
          </div>
        )}

        <div style={styles.navContainer}>
          {NAV.map((section, idx) => {
            const isCollapsed = collapsedSections[section.section];
            return (
              <div key={section.section}>
                <div
                  style={{
                    ...styles.sectionTitle,
                    ...(idx === 0 ? styles.sectionTitleFirst : {}),
                  }}
                  onClick={() => toggleSection(section.section)}
                >
                  <span>{section.section}</span>
                  <svg
                    style={{
                      ...styles.chevron,
                      transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    }}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {!isCollapsed && section.pages.map(page => {
                  const isActive = slug === page.slug;
                  return (
                    <button
                      key={page.slug}
                      style={{
                        ...styles.navItem,
                        ...(isActive ? styles.navItemActive : {}),
                      }}
                      onClick={() => handleNavClick(page.slug)}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {page.title}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div style={styles.content}>
        <div style={styles.contentInner}>
          {loading && <div style={styles.loading}>Laden...</div>}
          {error && <div style={styles.error}>{error}</div>}
          {!loading && !error && (
            <>
              <DocsMarkdown content={content} />
              {slug === 'index' && <FeatureGrid navigate={navigate} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
