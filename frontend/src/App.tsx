import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KanbanBoard from '@/pages/KanbanBoard';
import CsvImport from '@/pages/CsvImport';
import LeadsPage from '@/pages/LeadsPage';
import ScrapingsPage from '@/pages/ScrapingsPage';
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
      <Route path="/" element={<Navigate to="/dashboard/raspagens" replace />} />
      <Route path="/login" element={<Login />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        } 
      >
        <Route index element={<Navigate to="/dashboard/raspagens" replace />} />
        <Route path="raspagens" element={<ScrapingsPage />} />
        <Route path="raspagens/:id/leads" element={<LeadsPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="kanban" element={<KanbanBoard />} />
        <Route path="import" element={<CsvImport />} />
      </Route>
    </Routes>
  );
};

export default App;
