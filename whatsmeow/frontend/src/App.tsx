import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AIAnalysisProvider } from './contexts/AIAnalysisContext';
import { BulkCampaignProvider } from './contexts/BulkCampaignContext';
import CampaignProgressBadge from './components/CampaignProgressBadge';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Instances } from './pages/Instances';
import { Messages } from './pages/Messages';
import { Chat } from './pages/Chat';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { SuperAdmin } from './pages/SuperAdmin';
import { Admin } from './pages/Admin';
import { Profile } from './pages/Profile';
import { Monitoramento, IncidentesPage, AuditoriaPage, LogsAoVivoPage } from './pages/Monitoramento';

function RootRedirect() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900"
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}
      >
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"
            style={{ width: 48, height: 48, borderWidth: 2, borderStyle: 'solid', borderColor: '#00af4b', borderBottomColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}
          />
          <p className="text-gray-600 dark:text-gray-400" style={{ color: '#4b5563', marginTop: 16 }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
            <AIAnalysisProvider>
            <BulkCampaignProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={<RootRedirect />}
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/instances"
                element={
                  <ProtectedRoute>
                    <Instances />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/messages/:instanceId"
                element={
                  <ProtectedRoute>
                    <Messages />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <Chat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <SuperAdmin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/companies"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <SuperAdmin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/users"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <SuperAdmin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/instances"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <SuperAdmin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/monitoramento"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <Monitoramento />
                  </ProtectedRoute>
                }
              >
                <Route path="incidentes" element={<IncidentesPage />} />
                <Route path="auditoria" element={<AuditoriaPage />} />
                <Route path="logs" element={<LogsAoVivoPage />} />
                <Route index element={<Navigate to="incidentes" replace />} />
              </Route>
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/company"
                element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/webhook"
                element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/webhook-logs"
                element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/api"
                element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/sectors"
                element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tags"
                element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/quick-replies" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/admin/scheduling" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/admin/kanban" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/admin/flows" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/admin/flows/:flowId" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/admin/sherlock" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
              <Route path="/admin/leads" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <CampaignProgressBadge />
            </BulkCampaignProvider>
            </AIAnalysisProvider>
            </NotificationProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--toast-bg, #363636)',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#00af4b',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 4000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

