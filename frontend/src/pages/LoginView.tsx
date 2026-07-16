import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { User, Lock, Wrench, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { setCredentials } from '../store/authSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const LoginView: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [employeeNo, setEmployeeNo] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const pendingNo = sessionStorage.getItem('pending_employee_no');
    if (pendingNo) {
      navigate('/approval-pending');
      return;
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, [navigate]);

  const handleEmployeeNoChange = (val: string) => {
    const clean = val.replace(/\D/g, '');
    setEmployeeNo(clean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeNo || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/accounts/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employee_no: employeeNo, password }),
      });

      const data = await response.json();

      if (response.status === 200) {
        dispatch(setCredentials({
          token: data.token,
          user: data.user,
          permissions: data.permissions,
          accessibleStores: data.accessible_stores,
          store: data.store
        }));
        sessionStorage.removeItem('pending_employee_no');
        sessionStorage.removeItem('pending_password');
        navigate('/');
      } else if (response.status === 403) {
        sessionStorage.setItem('pending_employee_no', employeeNo);
        sessionStorage.setItem('pending_password', password);
        navigate('/approval-pending');
      } else {
        setError(data.error || 'Invalid credentials.');
      }
    } catch (err) {
      setError('Failed to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-surface-container dark:bg-dark-surface-container p-8 rounded-2xl shadow-xl border border-outline-variant dark:border-dark-outline-variant"
      >
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-accent-light/20 dark:bg-primary/20 rounded-xl mb-3">
            <Wrench className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface">
            Maintenance Tracker
          </h2>
          <p className="text-sm text-on-surface-variant dark:text-dark-on-surface-variant mt-1">
            Sign in to manage your facilities
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-2 p-3.5 mb-6 text-sm text-red-800 bg-red-50 dark:bg-red-950/30 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-900/50"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
              Employee Number
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-outline dark:text-dark-on-surface-variant">
                <User className="w-5 h-5" />
              </span>
              <input
                type="text"
                value={employeeNo}
                onChange={(e) => handleEmployeeNoChange(e.target.value)}
                placeholder="12345"
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant">
                Password
              </label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-xs text-primary hover:underline font-medium cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-outline dark:text-dark-on-surface-variant">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-medium text-sm rounded-lg shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-focus transition-all duration-150"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 pt-6 border-t border-outline-variant dark:border-dark-outline-variant">
          <p className="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            New employee?{' '}
            <button
              onClick={() => navigate('/signup')}
              className="text-primary hover:underline font-medium cursor-pointer"
            >
              Request Access
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
