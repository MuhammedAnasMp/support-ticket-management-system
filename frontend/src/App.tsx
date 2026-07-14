import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { 
  FileText, Store, Wrench, User, Receipt, BarChart3, Settings 
} from 'lucide-react';
import { DashboardLayout } from './components/DashboardLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ThemeToggleOverlay } from './components/ThemeToggleOverlay';
import { PlaceholderView } from './components/PlaceholderView';

// Page Views
import { LoginView } from './pages/LoginView';
import { SignupView } from './pages/SignupView';
import { ApprovalPendingView } from './pages/ApprovalPendingView';
import { DashboardView } from './pages/DashboardView';

// Theme helper functions
const getInitialTheme = (): boolean => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedPrefs = window.localStorage.getItem('color-theme');
    if (typeof storedPrefs === 'string') {
      return storedPrefs === 'dark';
    }
    const userMedia = window.matchMedia('(prefers-color-scheme: dark)');
    if (userMedia.matches) {
      return true;
    }
  }
  return false;
};

const App: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(getInitialTheme());

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('color-theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('color-theme', 'light');
    }
  }, [isDark]);

  return (
    <div className="min-h-screen bg-surface dark:bg-dark-surface text-on-surface dark:text-dark-on-surface transition-colors duration-200">
      <Router>
        <ThemeToggleOverlay isDark={isDark} setIsDark={setIsDark} />
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route path="/signup" element={<SignupView />} />
          <Route path="/approval-pending" element={<ApprovalPendingView />} />
          
          {/* Dashboard and Subpage Routes wrapped with DashboardLayout */}
          <Route path="/" element={
            <ProtectedRoute>
              <DashboardLayout>
                <DashboardView />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/tickets/:subpage" element={
            <ProtectedRoute>
              <DashboardLayout>
                <PlaceholderView moduleName="Tickets" icon={<FileText className="w-12 h-12 text-primary" />} />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/stores/:subpage" element={
            <ProtectedRoute>
              <DashboardLayout>
                <PlaceholderView moduleName="Stores" icon={<Store className="w-12 h-12 text-primary" />} />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/maintenance/:subpage" element={
            <ProtectedRoute>
              <DashboardLayout>
                <PlaceholderView moduleName="Maintenance" icon={<Wrench className="w-12 h-12 text-primary" />} />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/workforce/:subpage" element={
            <ProtectedRoute>
              <DashboardLayout>
                <PlaceholderView moduleName="Workforce" icon={<User className="w-12 h-12 text-primary" />} />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/expenses/:subpage" element={
            <ProtectedRoute>
              <DashboardLayout>
                <PlaceholderView moduleName="Expense Approval" icon={<Receipt className="w-12 h-12 text-primary" />} />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/reports/:subpage" element={
            <ProtectedRoute>
              <DashboardLayout>
                <PlaceholderView moduleName="Reports" icon={<BarChart3 className="w-12 h-12 text-primary" />} />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/admin/:subpage" element={
            <ProtectedRoute>
              <DashboardLayout>
                <PlaceholderView moduleName="Administration" icon={<Settings className="w-12 h-12 text-primary" />} />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
};

export default App;
