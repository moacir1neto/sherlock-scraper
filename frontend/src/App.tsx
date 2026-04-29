import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import DashboardLayout from '@/components/layout/DashboardLayout';
import LeadsPage from '@/pages/LeadsPage';
import ScrapingsPage from '@/pages/ScrapingsPage';
import ListsPage from '@/pages/ListsPage';
import SettingsPage from '@/pages/SettingsPage';
import Pipeline from '@/pages/Pipeline';
import DashboardHome from '@/pages/DashboardHome';
import { useAuth } from '@/contexts/AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="raspagens" element={<ScrapingsPage />} />
        <Route path="listas" element={<ListsPage />} />
        <Route path="listas/:id/leads" element={<LeadsPage />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="configuracoes" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
};

export default App;
