import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { AgentProvider } from './context/AgentContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './components/Toast';
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
const ContractDetailPage = lazy(() => import('./apps/vertragsmanagement/ContractDetail'));
const ProjektePage = lazy(() => import('./apps/projektmanagement/ProjektePage'));
const WizardPage = lazy(() => import('./apps/projektmanagement/WizardPage'));
const LieferantenPage = lazy(() => import('./apps/lieferantenmanagement/LieferantenPage'));
const SupplierDetailPage = lazy(() => import('./apps/lieferantenmanagement/SupplierDetailPage'));
const VsmPage = lazy(() => import('./apps/vsm/VsmPage'));
const VsmDetailPage = lazy(() => import('./apps/vsm/VsmDetailPage'));

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
                  <Route path="/apps/vertragsmanagement" element={<ContractsPage />} />
                  <Route path="/apps/vertragsmanagement/upload" element={<ContractUploadPage />} />
                  <Route path="/apps/vertragsmanagement/:id" element={<ContractDetailPage />} />
                  <Route path="/apps/projektmanagement" element={<ProjektePage />} />
                  <Route path="/apps/projektmanagement/neu" element={<WizardPage />} />
                  <Route path="/apps/projektmanagement/:id" element={<WizardPage />} />
                  <Route path="/apps/lieferantenmanagement" element={<LieferantenPage />} />
                  <Route path="/apps/lieferantenmanagement/:id" element={<SupplierDetailPage />} />
                  <Route path="/apps/vsm" element={<VsmPage />} />
                  <Route path="/apps/vsm/:id" element={<VsmDetailPage />} />
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
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
              <AgentProvider>
                <AppRoutes />
              </AgentProvider>
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </>
  );
}

export default App;
