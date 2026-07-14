import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { 
  User, Lock, Mail, Phone, Clock, 
  Sun, Moon, CheckCircle, MessageSquare, AlertCircle, 
  ArrowRight, Camera, Check, RefreshCw, FileText, 
  Store, Wrench, BarChart3, Settings,
  HelpCircle, Receipt
} from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardLayout } from './components/DashboardLayout';

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

// -------------------------------------------------------------
// THEME TOGGLE OVERLAY (Auth screens only)
// -------------------------------------------------------------
const ThemeToggleOverlay: React.FC<{ isDark: boolean; setIsDark: (val: boolean) => void }> = ({ isDark, setIsDark }) => {
  const location = useLocation();
  const showOverlay = ['/login', '/signup', '/approval-pending'].includes(location.pathname);
  if (!showOverlay) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setIsDark(!isDark)}
        className="p-3 rounded-full bg-surface-container dark:bg-dark-surface-container shadow-md border border-outline-variant dark:border-dark-outline-variant text-primary hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer"
        aria-label="Toggle Theme"
      >
        {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
      </button>
    </div>
  );
};

// -------------------------------------------------------------
// MAIN APP COMPONENT
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// PROTECTED ROUTE COMPONENT
// -------------------------------------------------------------
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);
    if (!user.active) {
      return <Navigate to="/approval-pending" replace />;
    }
  } catch (e) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// -------------------------------------------------------------
// LOGIN COMPONENT
// -------------------------------------------------------------
const LoginView: React.FC = () => {
  const navigate = useNavigate();
  const [employeeNo, setEmployeeNo] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

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
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
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
                onChange={(e) => setEmployeeNo(e.target.value)}
                placeholder="EMP-12345"
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
              Password
            </label>
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

// -------------------------------------------------------------
// SIGNUP COMPONENT
// -------------------------------------------------------------
const SignupView: React.FC = () => {
  const navigate = useNavigate();
  const [employeeNo, setEmployeeNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [password, setPassword] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [phoneError, setPhoneError] = useState('');
  const [whatsappError, setWhatsappError] = useState('');

  const handlePhoneChange = (val: string) => {
    const clean = val.replace(/\D/g, '');
    setPhone(clean);
    if (clean.length > 0 && clean.length !== 8) {
      setPhoneError('Phone number must be exactly 8 digits.');
    } else {
      setPhoneError('');
    }
  };

  const handleWhatsappChange = (val: string) => {
    const clean = val.replace(/\D/g, '');
    setWhatsappNumber(clean);
    if (clean.length > 0 && clean.length !== 8 && clean.length !== 10) {
      setWhatsappError('WhatsApp number must be 8 or 10 digits.');
    } else {
      setWhatsappError('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!employeeNo || !fullName || !email || !phone || !whatsappNumber || !password || !imageFile) {
      setError('All fields including the profile image are required.');
      return;
    }

    if (phone.length !== 8) {
      setError('Phone number must be exactly 8 digits.');
      return;
    }
    if (whatsappNumber.length !== 8 && whatsappNumber.length !== 10) {
      setError('WhatsApp number must be either 8 or 10 digits.');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('employee_no', employeeNo);
    formData.append('full_name', fullName);
    formData.append('email', email);
    formData.append('phone', phone);
    formData.append('whatsapp_number', whatsappNumber);
    formData.append('password', password);
    formData.append('profile_image', imageFile);

    try {
      const response = await fetch(`${API_URL}/accounts/signup/`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.status === 201) {
        setSuccess(true);
        sessionStorage.setItem('pending_employee_no', employeeNo);
        sessionStorage.setItem('pending_password', password);
      } else {
        setError(data.error || 'Signup failed.');
      }
    } catch (err) {
      setError('Failed to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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
            Your registration was successful! Your account is currently pending activation. An admin must assign a sub-department to your account to confirm approval.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/approval-pending')}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-medium text-sm rounded-lg shadow cursor-pointer transition-all"
            >
              Go to Status Page
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 px-4 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high text-on-surface dark:text-dark-on-surface font-medium text-sm rounded-lg cursor-pointer transition-all"
            >
              Back to Login
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-surface-container dark:bg-dark-surface-container p-8 rounded-2xl shadow-xl border border-outline-variant dark:border-dark-outline-variant"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface">
            Employee Registration
          </h2>
          <p className="text-sm text-on-surface-variant dark:text-dark-on-surface-variant mt-1">
            Create an account to submit your credentials
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center justify-center mb-4">
            <div className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary bg-surface-container-low dark:bg-dark-surface-container-low flex items-center justify-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-outline" />
                )}
              </div>
              <label htmlFor="avatar-file" className="absolute bottom-0 right-0 p-2 bg-primary hover:bg-primary-hover text-white rounded-full cursor-pointer shadow-md transform translate-x-1 translate-y-1 transition-all">
                <Camera className="w-4 h-4" />
                <input
                  id="avatar-file"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            <span className="text-xs text-on-surface-variant dark:text-dark-on-surface-variant mt-2 font-medium">
              Profile Photo (Required)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
                Employee Number
              </label>
              <input
                type="text"
                required
                value={employeeNo}
                onChange={(e) => setEmployeeNo(e.target.value)}
                placeholder="EMP-12345"
                className="w-full px-4 py-2.5 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-2.5 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-outline dark:text-dark-on-surface-variant">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.doe@company.com"
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
                Phone (8 digits)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-outline dark:text-dark-on-surface-variant">
                  <Phone className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="87654321"
                  maxLength={8}
                  className={`w-full pl-10 pr-4 py-2.5 bg-surface-container-low dark:bg-dark-surface-container-low border ${phoneError ? 'border-red-500' : 'border-outline-variant dark:border-dark-outline-variant'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all`}
                />
              </div>
              {phoneError && <span className="text-xs text-red-500 mt-1 block">{phoneError}</span>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
                WhatsApp No (8 or 10 digits)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-outline dark:text-dark-on-surface-variant">
                  <MessageSquare className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  required
                  value={whatsappNumber}
                  onChange={(e) => handleWhatsappChange(e.target.value)}
                  placeholder="9876543210"
                  maxLength={10}
                  className={`w-full pl-10 pr-4 py-2.5 bg-surface-container-low dark:bg-dark-surface-container-low border ${whatsappError ? 'border-red-500' : 'border-outline-variant dark:border-dark-outline-variant'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all`}
                />
              </div>
              {whatsappError && <span className="text-xs text-red-500 mt-1 block">{whatsappError}</span>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-outline dark:text-dark-on-surface-variant">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !!phoneError || !!whatsappError}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-medium text-sm rounded-lg shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-focus transition-all duration-150"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Submit Access Request</span>
                <Check className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 pt-6 border-t border-outline-variant dark:border-dark-outline-variant">
          <p className="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            Already registered?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-primary hover:underline font-medium cursor-pointer"
            >
              Sign In
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// -------------------------------------------------------------
// APPROVAL PENDING COMPONENT
// -------------------------------------------------------------
const ApprovalPendingView: React.FC = () => {
  const navigate = useNavigate();
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
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
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
            className={`p-3 text-sm rounded-lg mb-6 border text-left flex gap-2 ${type === 'error'
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
            onClick={() => {
              sessionStorage.clear();
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

// -------------------------------------------------------------
// DASHBOARD VIEW
// -------------------------------------------------------------
const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        navigate('/login');
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Welcome Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary to-indigo-600 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden"
      >
        <div className="relative z-10 max-w-xl">
          <span className="py-1 px-2.5 bg-white/20 text-white text-xs font-bold uppercase rounded-full tracking-wider">
            Approved Employee
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-3">
            Welcome back, {user.full_name}!
          </h1>
          <p className="text-sm text-white/80 mt-2 font-medium">
            You have access to the FixMngr workspace. Use the navigation sidebar to log tickets, track workforce records, and manage stores.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-15 translate-x-10 translate-y-10 scale-150 pointer-events-none">
          <Wrench className="w-48 h-48" />
        </div>
      </motion.div>

      {/* Grid of Profile Details & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-surface-container dark:bg-dark-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant dark:border-dark-outline-variant flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary bg-surface shadow-md mb-4">
            {user.profile_image ? (
              <img src={user.profile_image} alt={user.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-accent-light/30 dark:bg-primary/20">
                <User className="w-10 h-10 text-primary" />
              </div>
            )}
          </div>
          <h3 className="font-bold text-lg text-on-surface dark:text-dark-on-surface">
            {user.full_name}
          </h3>
          <span className="mt-1 py-0.5 px-2.5 bg-primary/10 dark:bg-primary/20 text-primary text-xs font-bold uppercase rounded-full">
            {user.role || 'Employee'}
          </span>

          <div className="w-full mt-6 space-y-3.5 text-left border-t border-outline-variant dark:border-dark-outline-variant pt-6 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            <div className="flex justify-between">
              <span className="font-medium">Employee ID:</span>
              <span className="font-semibold text-on-surface dark:text-dark-on-surface">{user.employee_no}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Email:</span>
              <span className="font-semibold text-on-surface dark:text-dark-on-surface truncate max-w-[150px]">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Phone:</span>
              <span className="font-semibold text-on-surface dark:text-dark-on-surface">{user.phone}</span>
            </div>
            {user.whatsapp_number && (
              <div className="flex justify-between">
                <span className="font-medium">WhatsApp:</span>
                <span className="font-semibold text-on-surface dark:text-dark-on-surface">{user.whatsapp_number}</span>
              </div>
            )}
          </div>
        </div>

        {/* Assigned Sub-Departments Card */}
        <div className="bg-surface-container dark:bg-dark-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant dark:border-dark-outline-variant flex flex-col">
          <h3 className="font-bold text-sm uppercase tracking-wider text-outline dark:text-dark-on-surface-variant mb-4">
            Assigned Sub-Departments
          </h3>
          <div className="flex-1 flex flex-col justify-center">
            {user.sub_departments && user.sub_departments.length > 0 ? (
              <div className="flex flex-wrap gap-2.5">
                {user.sub_departments.map((sd: string, index: number) => (
                  <span
                    key={index}
                    className="py-1.5 px-3 bg-accent-light/35 dark:bg-primary/20 text-primary text-xs font-semibold rounded-full border border-primary/20"
                  >
                    {sd}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant dark:text-dark-on-surface-variant italic">
                No sub-departments currently assigned.
              </p>
            )}
          </div>
        </div>

        {/* Quick Stats Card */}
        <div className="bg-surface-container dark:bg-dark-surface-container p-6 rounded-2xl shadow-sm border border-outline-variant dark:border-dark-outline-variant flex flex-col">
          <h3 className="font-bold text-sm uppercase tracking-wider text-outline dark:text-dark-on-surface-variant mb-4">
            Account Status
          </h3>
          <div className="flex-1 flex flex-col justify-center items-center">
            <div className="p-4 bg-emerald-500/10 rounded-full border border-emerald-500/20 mb-3">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              Approved & Activated
            </p>
            <p className="text-xs text-on-surface-variant dark:text-dark-on-surface-variant text-center mt-1.5 max-w-[200px]">
              Your account has full operational access privileges.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// PLACEHOLDER SUBPAGE COMPONENT
// -------------------------------------------------------------
interface PlaceholderViewProps {
  moduleName: string;
  icon: React.ReactNode;
}

const PlaceholderView: React.FC<PlaceholderViewProps> = ({ moduleName, icon }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-container dark:bg-dark-surface-container p-8 rounded-2xl shadow-sm border border-outline-variant dark:border-dark-outline-variant text-center max-w-lg mx-auto my-12"
    >
      <div className="inline-flex p-4 bg-primary/10 rounded-2xl mb-4">
        {icon}
      </div>
      <h2 className="text-xl font-bold text-on-surface dark:text-dark-on-surface mb-2">
        {moduleName} Section
      </h2>
      <p className="text-sm text-on-surface-variant dark:text-dark-on-surface-variant mb-6">
        This sub-module navigation path is fully configured. The operational user interface views for this department segment are currently under active development.
      </p>
      <div className="inline-flex items-center gap-2 text-xs font-semibold py-1.5 px-3 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant rounded-full text-outline">
        <HelpCircle className="w-4 h-4" />
        <span>Sub-path: {window.location.pathname}</span>
      </div>
    </motion.div>
  );
};

export default App;
