import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Loader2, AlertCircle, Upload, X, CheckCircle2 } from 'lucide-react';
import type { RootState } from '../store';
import { setCredentials } from '../store/authSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const ProfileCompletionModal: React.FC = () => {
  const dispatch = useDispatch();
  const { token, user, permissions, accessibleStores } = useSelector((state: RootState) => state.auth);
  
  const [isOpen, setIsOpen] = useState(false);
  const [employeeNo, setEmployeeNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);

  // Check if profile is incomplete and needs completion (for Managers only)
  const isManager = user?.role?.toLowerCase().includes('manager');
  const isProfileIncomplete = !!isManager && (
    !user?.employee_no || 
    !user?.full_name || 
    !user?.phone || 
    !user?.whatsapp_number || 
    !user?.profile_image
  );

  const hasCheckedAutoOpen = useRef(false);

  useEffect(() => {
    if (!token) {
      hasCheckedAutoOpen.current = false;
      setIsOpen(false);
    }
  }, [token]);

  // Listen for manual edit profile trigger
  useEffect(() => {
    const handleOpen = () => {
      if (user) {
        setEmployeeNo(user.employee_no || '');
        setFullName(user.full_name || '');
        setPhone(user.phone || '');
        setWhatsappNumber(user.whatsapp_number || '');
        setImagePreview(user.profile_image || null);
        setImageFile(null);
        setErrorMsg(null);
        setSuccess(false);
        setIsManualOpen(true);
        setIsOpen(true);
      }
    };
    window.addEventListener('open-profile-edit', handleOpen);
    return () => window.removeEventListener('open-profile-edit', handleOpen);
  }, [user]);

  // Auto-open logic on load
  useEffect(() => {
    if (!token || !user || !isProfileIncomplete || hasCheckedAutoOpen.current) {
      return;
    }

    hasCheckedAutoOpen.current = true;

    // Set initial values from user profile (filling what exists)
    setEmployeeNo(user.employee_no || '');
    setFullName(user.full_name || '');
    setPhone(user.phone || '');
    setWhatsappNumber(user.whatsapp_number || '');
    setImagePreview(user.profile_image || null);

    const today = new Date().toISOString().split('T')[0];
    const storageKey = `profile_popup_shows_${user.user_id}`;
    const dataStr = localStorage.getItem(storageKey);
    let count = 0;

    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        if (data.date === today) {
          count = data.count;
        }
      } catch (e) {}
    }

    if (count < 2) {
      setIsManualOpen(false);
      setIsOpen(true);
      // Increment show count
      localStorage.setItem(storageKey, JSON.stringify({ date: today, count: count + 1 }));
    }
  }, [token, user, isProfileIncomplete]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!employeeNo || !fullName || !phone || !whatsappNumber || (!imageFile && !imagePreview)) {
      setErrorMsg('All fields, including profile image, are required to complete your profile.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('employee_no', employeeNo);
      formData.append('full_name', fullName);
      formData.append('phone', phone);
      formData.append('whatsapp_number', whatsappNumber);
      if (imageFile) {
        formData.append('profile_image', imageFile);
      }

      const response = await fetch(`${API_URL}/accounts/profile/`, {
        method: 'PATCH',
        headers: {
          Authorization: `Token ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        // Update credentials in Redux and localStorage
        dispatch(setCredentials({
          token,
          user: data.user,
          permissions,
          accessibleStores
        }));
        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
        }, 1500);
      } else {
        const errData = await response.json();
        setErrorMsg(errData.error || 'Failed to update profile.');
      }
    } catch (err) {
      setErrorMsg('Network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-2xl shadow-xl overflow-hidden z-10 transition-all p-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant dark:border-dark-outline-variant mb-5">
          <div>
            <h3 className="text-base font-bold text-on-surface dark:text-dark-on-surface">
              {isManualOpen ? 'Edit Your Profile' : 'Complete Your Profile'}
            </h3>
            <p className="text-[10px] text-outline mt-0.5">
              {isManualOpen ? 'Update your account details below' : 'Please update your manager details to continue'}
            </p>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high text-outline cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {success ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-bounce" />
            <h4 className="font-bold text-sm text-on-surface dark:text-dark-on-surface">Profile Completed!</h4>
            <p className="text-xs text-outline">Your details have been successfully saved.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Profile Image Upload */}
            <div className="flex flex-col items-center gap-2 mb-2">
              <div className="relative w-20 h-20 rounded-full border-2 border-primary/30 overflow-hidden bg-surface-container-high flex items-center justify-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Upload className="w-6 h-6 text-outline" />
                )}
              </div>
              <label className="text-[11px] font-bold text-primary hover:underline cursor-pointer">
                Upload Profile Image *
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageChange}
                />
              </label>
            </div>

            {/* Employee No */}
            <div>
              <label className="block text-xs font-semibold text-outline mb-1.5">Employee Number *</label>
              <input 
                type="text"
                required
                value={employeeNo}
                onChange={e => setEmployeeNo(e.target.value)}
                placeholder="e.g. 10045"
                className="w-full text-xs bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded-lg outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-outline mb-1.5">Full Name *</label>
              <input 
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full text-xs bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded-lg outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-outline mb-1.5">Phone Number *</label>
                <input 
                  type="text"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="8 digits"
                  className="w-full text-xs bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded-lg outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                />
              </div>

              {/* Whatsapp */}
              <div>
                <label className="block text-xs font-semibold text-outline mb-1.5">WhatsApp Number *</label>
                <input 
                  type="text"
                  required
                  value={whatsappNumber}
                  onChange={e => setWhatsappNumber(e.target.value)}
                  placeholder="8 or 10 digits"
                  className="w-full text-xs bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded-lg outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant dark:border-dark-outline-variant">
              {!isManualOpen && (
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-outline hover:text-on-surface rounded-lg cursor-pointer"
                >
                  Remind Me Later
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-75"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Details
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
