import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { AgentProvider } from './context/AgentContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './components/Toast';
import { BrandingProvider } from './hooks/useBranding';
import { theme } from './config/theme';

// Lazy-loaded pages for code splitting
const ChatPage = lazy(() => import('./pages/ChatPage'));
const AgentsPage = lazy(() => import('./pages/AgentsPage'));
const SkillsPage = lazy(() => import('./pages/SkillsPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));
const McpServersPage = lazy(() => import('./pages/McpServersPage'));
const KnowledgeBasePage = lazy(() => import('./pages/KnowledgeBasePage'));
const UserMemoryPage = lazy(() => import('./pages/UserMemoryPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const TablesPage = lazy(() => import('./pages/TablesPage'));
const TableDetailPage = lazy(() => import('./pages/TableDetailPage'));
const ProvidersPage = lazy(() => import('./pages/ProvidersPage'));
const ConnectionsPage = lazy(() => import('./pages/ConnectionsPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const ProjectChatPage = lazy(() => import('./pages/ProjectChatPage'));
const SharedChatPage = lazy(() => import('./pages/SharedChatPage'));
const AppsPage = lazy(() => import('./pages/AppsPage'));
const ExtractionProjectsPage = lazy(() => import('./pages/ExtractionProjectsPage'));
const ContractsPage = lazy(() => import('./apps/vertragsmanagement/ContractsPage'));
const ContractUploadPage = lazy(() => import('./apps/vertragsmanagement/UploadPage'));
const ContractImportPage = lazy(() => import('./apps/vertragsmanagement/ImportPage'));
const ContractDetailPage = lazy(() => import('./apps/vertragsmanagement/ContractDetail'));
const ProjektePage = lazy(() => import('./apps/projektmanagement/ProjektePage'));
const ImportPage = lazy(() => import('./apps/projektmanagement/ImportPage'));
const WizardPage = lazy(() => import('./apps/projektmanagement/WizardPage'));
const IdeeWizardPage = lazy(() => import('./apps/projektmanagement/IdeeWizardPage'));
const IdeenPage = lazy(() => import('./apps/projektmanagement/IdeenPage'));
const PortfolioDetail = lazy(() => import('./apps/projektmanagement/PortfolioDetail'));
const LieferantenPage = lazy(() => import('./apps/lieferantenmanagement/LieferantenPage'));
const SupplierDetailPage = lazy(() => import('./apps/lieferantenmanagement/SupplierDetailPage'));
const VsmPage = lazy(() => import('./apps/vsm/VsmPage'));
const VsmDetailPage = lazy(() => import('./apps/vsm/VsmDetailPage'));
const WzbarMatcherPage = lazy(() => import('./apps/wzbar-matcher/MatcherPage'));
const VorgangListPage = lazy(() => import('./apps/vorgangsmappe/VorgangListPage'));
const VorgangDetailPage = lazy(() => import('./apps/vorgangsmappe/VorgangDetailPage'));
const VorgangSettingsPage = lazy(() => import('./apps/vorgangsmappe/SettingsPage'));
const PodcastEpisodesPage = lazy(() => import('./apps/podcast-repurposing/EpisodesListPage'));
const PodcastUploadPage = lazy(() => import('./apps/podcast-repurposing/UploadPage'));
const PodcastSettingsPage = lazy(() => import('./apps/podcast-repurposing/SettingsPage'));
const PodcastEpisodeDetailPage = lazy(() => import('./apps/podcast-repurposing/EpisodeDetailPage'));
import RequireAppPermission from './components/RequireAppPermission';

// Loading fallback component
const PageLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '200px',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  }}>
    Laden...
  </div>
);

// Global styles with Inter font
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    font-family: ${theme.typography.fontFamily};
    background-color: ${theme.colors.background};
    color: ${theme.colors.text};
    line-height: ${theme.typography.lineHeight.normal};
  }

  ::placeholder {
    color: ${theme.colors.textMuted};
  }

  button {
    font-family: ${theme.typography.fontFamily};
  }

  textarea {
    font-family: ${theme.typography.fontFamily};
  }

  a {
    text-decoration: none;
    color: inherit;
  }

  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: ${theme.colors.border};
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${theme.colors.textMuted};
  }

  /* Smooth scrolling */
  html {
    scroll-behavior: smooth;
  }

  /* Selection color */
  ::selection {
    background-color: ${theme.colors.primaryLight};
    color: ${theme.colors.primaryDark};
  }
`;

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: theme.colors.textMuted,
      }}>
        Loading...
      </div>
    );
  }

  // Public routes (accessible without authentication)
  // SharedChatPage must be accessible without login
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public route for shared chats */}
        <Route path="/shared/:token" element={<SharedChatPage />} />

        {/* Auth-protected routes */}
        {!isAuthenticated ? (
          <Route path="*" element={<LoginPage />} />
        ) : (
          <Route path="/*" element={
            <Layout>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<ChatPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/agents" element={<AgentsPage />} />
                  <Route path="/skills" element={<SkillsPage />} />
                  <Route path="/tools" element={<ToolsPage />} />
                  <Route path="/mcp" element={<McpServersPage />} />
                  <Route path="/knowledge" element={<KnowledgeBasePage />} />
                  <Route path="/memory" element={<UserMemoryPage />} />
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/tables" element={<TablesPage />} />
                  <Route path="/tables/:tableId" element={<TableDetailPage />} />
                  <Route path="/providers" element={<ProvidersPage />} />
                  <Route path="/connections" element={<ConnectionsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
                  <Route path="/projects/:projectId/chat" element={<ProjectChatPage />} />
                  <Route path="/extraction" element={<ExtractionProjectsPage />} />
                  <Route path="/apps" element={<AppsPage />} />
                  <Route path="/apps/vertragsmanagement" element={<RequireAppPermission appId="vertragsmanagement"><ContractsPage /></RequireAppPermission>} />
                  <Route path="/apps/vertragsmanagement/upload" element={<RequireAppPermission appId="vertragsmanagement"><ContractUploadPage /></RequireAppPermission>} />
                  <Route path="/apps/vertragsmanagement/import" element={<RequireAppPermission appId="vertragsmanagement"><ContractImportPage /></RequireAppPermission>} />
                  <Route path="/apps/vertragsmanagement/:id" element={<RequireAppPermission appId="vertragsmanagement"><ContractDetailPage /></RequireAppPermission>} />
                  <Route path="/apps/projektmanagement" element={<RequireAppPermission appId="projektmanagement"><ProjektePage /></RequireAppPermission>} />
                  <Route path="/apps/projektmanagement/import" element={<RequireAppPermission appId="projektmanagement"><ImportPage /></RequireAppPermission>} />
                  <Route path="/apps/projektmanagement/neu" element={<RequireAppPermission appId="projektmanagement"><WizardPage /></RequireAppPermission>} />
                  <Route path="/apps/projektmanagement/ideen" element={<RequireAppPermission appId="projektmanagement"><IdeenPage /></RequireAppPermission>} />
                  <Route path="/apps/projektmanagement/ideen/import" element={<RequireAppPermission appId="projektmanagement"><ImportPage mode="idee" /></RequireAppPermission>} />
                  <Route path="/apps/projektmanagement/ideen/neu" element={<RequireAppPermission appId="projektmanagement"><IdeeWizardPage /></RequireAppPermission>} />
                  <Route path="/apps/projektmanagement/ideen/:id" element={<RequireAppPermission appId="projektmanagement"><IdeeWizardPage /></RequireAppPermission>} />
                  <Route path="/apps/projektmanagement/portfolios/:id" element={<RequireAppPermission appId="projektmanagement"><PortfolioDetail /></RequireAppPermission>} />
                  <Route path="/apps/projektmanagement/:id" element={<RequireAppPermission appId="projektmanagement"><WizardPage /></RequireAppPermission>} />
                  <Route path="/apps/lieferantenmanagement" element={<RequireAppPermission appId="lieferantenmanagement"><LieferantenPage /></RequireAppPermission>} />
                  <Route path="/apps/lieferantenmanagement/:id" element={<RequireAppPermission appId="lieferantenmanagement"><SupplierDetailPage /></RequireAppPermission>} />
                  <Route path="/apps/vsm" element={<RequireAppPermission appId="vsm"><VsmPage /></RequireAppPermission>} />
                  <Route path="/apps/vsm/:id" element={<RequireAppPermission appId="vsm"><VsmDetailPage /></RequireAppPermission>} />
                  <Route path="/apps/wzbar-matcher" element={<RequireAppPermission appId="wzbar-matcher"><WzbarMatcherPage /></RequireAppPermission>} />
                  <Route path="/apps/vorgangsmappe" element={<RequireAppPermission appId="vorgangsmappe"><VorgangListPage /></RequireAppPermission>} />
                  <Route path="/apps/vorgangsmappe/settings" element={<RequireAppPermission appId="vorgangsmappe"><VorgangSettingsPage /></RequireAppPermission>} />
                  <Route path="/apps/vorgangsmappe/:reference" element={<RequireAppPermission appId="vorgangsmappe"><VorgangDetailPage /></RequireAppPermission>} />
                  <Route path="/apps/podcast-repurposing" element={<RequireAppPermission appId="podcast-repurposing"><PodcastEpisodesPage /></RequireAppPermission>} />
                  <Route path="/apps/podcast-repurposing/upload" element={<RequireAppPermission appId="podcast-repurposing"><PodcastUploadPage /></RequireAppPermission>} />
                  <Route path="/apps/podcast-repurposing/settings" element={<RequireAppPermission appId="podcast-repurposing"><PodcastSettingsPage /></RequireAppPermission>} />
                  <Route path="/apps/podcast-repurposing/:id" element={<RequireAppPermission appId="podcast-repurposing"><PodcastEpisodeDetailPage /></RequireAppPermission>} />
                  <Route path="/login" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </Layout>
          } />
        )}
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <>
      <style>{globalStyles}</style>
      <BrowserRouter>
        <BrandingProvider>
          <ToastProvider>
            <AuthProvider>
              <NotificationProvider>
                <AgentProvider>
                  <AppRoutes />
                </AgentProvider>
              </NotificationProvider>
            </AuthProvider>
          </ToastProvider>
        </BrandingProvider>
      </BrowserRouter>
    </>
  );
}

export default App;
