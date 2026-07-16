import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, Lock, AlertCircle, ArrowRight, RefreshCw, 
  MessageSquare, CheckCircle2, ArrowLeft, KeyRound
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const ForgotPasswordView: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [employeeNo, setEmployeeNo] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maskedWhatsapp, setMaskedWhatsapp] = useState('');

  const handleEmployeeNoChange = (val: string) => {
    const clean = val.replace(/\D/g, '');
    setEmployeeNo(clean);
  };

  const handleOtpChange = (val: string) => {
    const clean = val.replace(/\D/g, '');
    setOtp(clean);
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeNo) {
      setError('Please enter your employee number.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/accounts/forgot-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employee_no: employeeNo }),
      });

      const data = await response.json();

      if (response.ok) {
        setMaskedWhatsapp(data.whatsapp_number_masked);
        setStep(2);
      } else {
        setError(data.error || 'Failed to send reset code.');
      }
    } catch (err) {
      setError('Failed to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !newPassword || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (otp.length !== 6) {
      setError('Verification code must be exactly 6 digits.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }


    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/accounts/reset-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_no: employeeNo,
          otp,
          new_password: newPassword
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep(3);
      } else {
        setError(data.error || 'Failed to reset password.');
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
        {step === 1 && (
          <div>
            <div className="text-center mb-8">
              <div className="inline-flex p-3 bg-accent-light/20 dark:bg-primary/20 rounded-xl mb-3">
                <KeyRound className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface">
                Forgot Password
              </h2>
              <p className="text-sm text-on-surface-variant dark:text-dark-on-surface-variant mt-1">
                Enter your Employee Number to receive a reset code on WhatsApp
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

            <form onSubmit={handleRequestOtp} className="space-y-5">
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
                    required
                    value={employeeNo}
                    onChange={(e) => handleEmployeeNoChange(e.target.value)}
                    placeholder="12345"
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
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center mt-6 pt-6 border-t border-outline-variant dark:border-dark-outline-variant">
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sign In</span>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="text-center mb-8">
              <div className="inline-flex p-3 bg-accent-light/20 dark:bg-primary/20 rounded-xl mb-3">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface">
                Verify WhatsApp Code
              </h2>
              <p className="text-sm text-on-surface-variant dark:text-dark-on-surface-variant mt-2 px-2">
                We've sent a 6-digit code to your WhatsApp number ending in <span className="font-semibold">{maskedWhatsapp}</span>.
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

            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
                  Verification Code (6 Digits)
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => handleOtpChange(e.target.value)}
                  placeholder="123456"
                  className="w-full text-center tracking-widest font-mono text-lg px-4 py-2.5 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-outline dark:text-dark-on-surface-variant">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-outline dark:text-dark-on-surface-variant">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                    <span>Reset Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="flex justify-between items-center mt-6 pt-6 border-t border-outline-variant dark:border-dark-outline-variant text-sm">
              <button
                onClick={() => setStep(1)}
                className="text-on-surface-variant dark:text-dark-on-surface-variant hover:text-primary font-medium cursor-pointer"
              >
                Change employee no.
              </button>
              <button
                onClick={handleRequestOtp}
                disabled={loading}
                className="text-primary hover:underline font-medium cursor-pointer disabled:opacity-50"
              >
                Resend code
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <div className="inline-flex p-3 bg-green-500/20 rounded-full mb-4">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface mb-2">
              Reset Completed
            </h2>
            <p className="text-sm text-on-surface-variant dark:text-dark-on-surface-variant mb-6 px-4">
              Your password has been successfully reset. You can now log in to your account with your new credentials.
            </p>

            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-medium text-sm rounded-lg shadow cursor-pointer transition-all"
            >
              Sign In
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
