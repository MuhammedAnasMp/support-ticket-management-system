import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { 
  FileText, Store, Wrench, User, Receipt, BarChart3, Settings 
} from 'lucide-react';
import { DashboardLayout } from './components/DashboardLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ThemeToggleOverlay } from './components/ThemeToggleOverlay';
import { PlaceholderView } from './components/PlaceholderView';
import type { RootState } from './store';
import { setCredentials, clearCredentials } from './store/authSlice';

// Page Views
import { LoginView } from './pages/LoginView';
import { SignupView } from './pages/SignupView';
import { ApprovalPendingView } from './pages/ApprovalPendingView';
import { DashboardView } from './pages/DashboardView';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

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
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.auth.token);
  const [refetching, setRefetching] = useState<boolean>(!!token);

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

  useEffect(() => {
    if (!token) {
      setRefetching(false);
      return;
    }

    const refetchProfile = async () => {
      try {
        const response = await fetch(`${API_URL}/accounts/profile/`, {
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const data = await response.json();
          dispatch(setCredentials({
            token,
            user: data.user,
            permissions: data.permissions,
            accessibleStores: data.accessible_stores,
            store: data.store
          }));
        } else {
          dispatch(clearCredentials());
        }
      } catch (err) {
        console.error('Failed to refetch user profile:', err);
      } finally {
        setRefetching(false);
      }
    };

    refetchProfile();
  }, [token, dispatch]);

  if (refetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-dark-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
            Loading profile...
          </span>
        </div>
      </div>
    );
  }

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
