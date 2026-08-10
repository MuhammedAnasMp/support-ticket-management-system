import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { setCredentials, clearCredentials } from '../store/authSlice';
import { disablePushNotifications } from '@/services/pushNotifications';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const ApprovalPendingView: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'error'>('info');

  const handleCheckStatus = async () => {
    const employeeNo = sessionStorage.getItem('pending_employee_no');
    const password = sessionStorage.getItem('pending_password');

    if (!employeeNo || !password) {
      setMessage('Session expired. Please log in again.');
      setType('error');
      return;
    }

    setChecking(true);
    setMessage('');

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
          accessibleStores: data.accessible_stores
        }));
        sessionStorage.removeItem('pending_employee_no');
        sessionStorage.removeItem('pending_password');
        navigate('/');
      } else if (response.status === 403) {
        setMessage('Your account is still waiting for approval');
        setType('info');
      } else {
        setMessage(data.error || 'Check failed.');
        setType('error');
      }
    } catch (err) {
      setMessage('Failed to connect to the backend server.');
      setType('error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-surface-container dark:bg-dark-surface-container p-8 rounded-2xl shadow-xl text-center border border-outline-variant dark:border-dark-outline-variant"
      >
        <div className="inline-flex p-4 bg-amber-500/10 rounded-full mb-4">
          <Clock className="w-12 h-12 text-amber-500 animate-pulse" />
        </div>

        <h2 className="text-2xl font-bold text-on-surface dark:text-dark-on-surface mb-2">
          Waiting for Approval
        </h2>

        <p className="text-sm text-on-surface-variant dark:text-dark-on-surface-variant mb-6">
          Your account registration has been logged in our system. You will be activated once your sub-departments are assigned by the manager.
        </p>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 text-sm rounded-lg mb-6 border text-left flex gap-2 ${
              type === 'error'
                ? 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900/50'
                : 'bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/50'
            }`}
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{message}</span>
          </motion.div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-medium text-sm rounded-lg shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all"
          >
            {checking ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Check Status</span>
              </>
            )}
          </button>

          <button
            onClick={async () => {
              try {
                await disablePushNotifications();
              } catch (err) {
                console.warn('Failed to unsubscribe push notifications on logout:', err);
              }
              sessionStorage.clear();
              dispatch(clearCredentials());
              navigate('/login');
            }}
            className="w-full py-2.5 px-4 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high text-on-surface dark:text-dark-on-surface font-medium text-sm rounded-lg cursor-pointer transition-all"
          >
            Back to Login
          </button>
        </div>
      </motion.div>
    </div>
  );
};
