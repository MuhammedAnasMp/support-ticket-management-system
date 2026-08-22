import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, Lock, Mail, Phone, Clock, MessageSquare,
  AlertCircle, Camera, Check, RefreshCw
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const SignupView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const roleParam = searchParams.get('role') || '';
  const departmentParam = searchParams.get('department') || '';
  const storeParam = searchParams.get('store') || '';
  const natureParam = searchParams.get('nature') || '';

  const [employeeNo, setEmployeeNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [password, setPassword] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Metadata dropdowns
  const [roles, setRoles] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [natures, setNatures] = useState<any[]>([]);

  const isRoleLocked = Boolean(roleParam);
  const isStoreLocked = Boolean(storeParam);
  const isDepartmentLocked = Boolean(departmentParam);
  const isNatureLocked = Boolean(natureParam);

  // Selected values
  const [selectedRole, setSelectedRole] = useState(roleParam);
  const [selectedStore, setSelectedStore] = useState(storeParam);
  const [selectedDepartment, setSelectedDepartment] = useState(departmentParam);
  const [selectedNatures, setSelectedNatures] = useState<string[]>(natureParam ? natureParam.split(',') : []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [phoneError, setPhoneError] = useState('');
  const [whatsappError, setWhatsappError] = useState('');

  useEffect(() => {
    const pendingNo = sessionStorage.getItem('pending_employee_no');
    if (pendingNo) {
      navigate('/approval-pending');
    }
  }, [navigate]);

  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      const response = await fetch(`${API_URL}/accounts/signup/`);
      if (response.ok) {
        const data = await response.json();
        if (data.roles) setRoles(data.roles);
        if (data.stores) setStores(data.stores);
        if (data.departments) setDepartments(data.departments);
        if (data.natures) setNatures(data.natures);
      }
    } catch (err) {
      console.error('Failed to load metadata', err);
    }
  };

  const selectedRoleObj = roles.find(r => String(r.role_id) === String(selectedRole));
  const selectedRoleName = selectedRoleObj?.role_name?.toLowerCase() || '';

  const isStoreManager = String(selectedRole) === '3' || selectedRoleName === 'store manager';
  const isTechnician = String(selectedRole) === '5' || selectedRoleName === 'technician';

  const handleEmployeeNoChange = (val: string) => {
    const clean = val.replace(/\D/g, '');
    setEmployeeNo(clean);
  };

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

    if (!selectedRole) {
      setError('Please select a Role.');
      return;
    }

    if (isStoreManager && !selectedStore) {
      setError('Please select a Store for Store Manager role.');
      return;
    }

    if (isTechnician && !selectedDepartment) {
      setError('Please select a Department for Technician role.');
      return;
    }

    if (isTechnician && selectedNatures.length === 0) {
      setError('Please select at least one Work Nature for Technician role.');
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
    formData.append('role', selectedRole);
    if (isStoreManager && selectedStore) {
      formData.append('store', selectedStore);
    }
    if (isTechnician && selectedDepartment) {
      formData.append('department', selectedDepartment);
    }
    if (isTechnician && selectedNatures.length > 0) {
      formData.append('nature', selectedNatures.join(','));
    }

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
            Your registration was successful! Your account is currently pending activation. An admin will review and approve your account.
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

          {/* Role Selection Dropdown */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
              Role
            </label>
            <select
              required
              value={selectedRole}
              disabled={isRoleLocked}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setSelectedStore('');
                setSelectedDepartment('');
                setSelectedNatures([]);
              }}
              className="w-full px-4 py-2.5 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed text-on-surface dark:text-dark-on-surface"
            >
              {!isRoleLocked && <option value="">Select Role</option>}
              {roles.map(r => (
                <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
              ))}
            </select>
          </div>

          {/* Store Selection Dropdown for Store Manager */}
          {isStoreManager && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
                Store (Unmanaged Locations)
              </label>
              <select
                required
                value={selectedStore}
                disabled={isStoreLocked}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed text-on-surface dark:text-dark-on-surface"
              >
                {!isStoreLocked && <option value="">Select Store</option>}
                {stores
                  .filter(s => !s.manager || String(s.store_id) === String(selectedStore))
                  .map(s => (
                    <option key={s.store_id} value={s.store_id}>{s.store_id} - {s.store_name} </option>
                  ))
                }
              </select>
            </div>
          )}

          {/* Department and Work Nature Selection for Technician */}
          {isTechnician && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
                  Department
                </label>
                <select
                  required
                  value={selectedDepartment}
                  disabled={isDepartmentLocked}
                  onChange={(e) => {
                    setSelectedDepartment(e.target.value);
                    setSelectedNatures([]); // Reset natures when department changes
                  }}
                  className="w-full px-4 py-2.5 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed text-on-surface dark:text-dark-on-surface"
                >
                  {!isDepartmentLocked && <option value="">Select Department</option>}
                  {departments.map(d => (
                    <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                  ))}
                </select>
              </div>

              {selectedDepartment && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
                    Work Natures / Skills (Multiple)
                  </label>
                  {(() => {
                    const filteredNatures = natures.filter(n => String(n.department_id) === String(selectedDepartment));
                    if (filteredNatures.length === 0) {
                      return <p className="text-xs text-outline italic">No work natures found for this department.</p>;
                    }
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-40 overflow-y-auto border border-outline-variant dark:border-dark-outline-variant rounded-lg p-4 bg-surface-container-low dark:bg-dark-surface-container-low">
                        {filteredNatures.map(n => {
                          const checked = selectedNatures.includes(String(n.nature_id));
                          return (
                            <label
                              key={n.nature_id}
                              className={`flex items-center gap-2.5 text-sm cursor-pointer select-none text-on-surface dark:text-dark-on-surface ${isNatureLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isNatureLocked}
                                onChange={() => {
                                  if (checked) {
                                    setSelectedNatures(prev => prev.filter(id => id !== String(n.nature_id)));
                                  } else {
                                    setSelectedNatures(prev => [...prev, String(n.nature_id)]);
                                  }
                                }}
                                className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                              />
                              <span>{n.nature_name} [{n.sub_department_name || 'N/A'}]</span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant mb-2">
                Employee Number
              </label>
              <input
                type="text"
                required
                value={employeeNo}
                onChange={(e) => handleEmployeeNoChange(e.target.value)}
                placeholder="12345"
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
