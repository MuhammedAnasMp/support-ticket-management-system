import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, User, LogOut, Sun, Moon, ChevronDown,
  Mail, Phone, Shield, MessageSquare
} from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
  pageTitle: string;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, pageTitle }) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<any>(null);

  // Sync with document theme and read user profile
  useEffect(() => {
    const isDarkTheme = document.documentElement.classList.contains('dark');
    setIsDark(isDarkTheme);

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Handle outside clicks to close the user dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleTheme = () => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.remove('dark');
      localStorage.setItem('color-theme', 'light');
      setIsDark(false);
    } else {
      root.classList.add('dark');
      localStorage.setItem('color-theme', 'dark');
      setIsDark(true);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-surface-container dark:bg-dark-surface-container border-b border-outline-variant dark:border-dark-outline-variant shadow-sm transition-colors duration-200">
      {/* Left section: Hamburger & Breadcrumbs */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-lg text-on-surface-variant dark:text-dark-on-surface-variant hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high cursor-pointer transition-colors"
          aria-label="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>

          <h2 className="text-lg font-bold text-on-surface dark:text-dark-on-surface tracking-tight leading-tight md:text-xl">
            {pageTitle}
          </h2>
        </div>
      </div>

      {/* Right section: Action controls & Profile */}
      <div className="flex items-center gap-3">
        {/* Inline Theme Switcher */}
        <button
          onClick={handleToggleTheme}
          className="p-2.5 rounded-lg text-on-surface-variant dark:text-dark-on-surface-variant hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low cursor-pointer transition-colors"
          aria-label="Toggle dark mode"
        >
          {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
        </button>

        {/* Vertical divider */}
        <div className="w-px h-6 bg-outline-variant dark:bg-dark-outline-variant" />

        {/* User Dropdown Ref */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low transition-colors cursor-pointer text-left focus:outline-none"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant dark:border-dark-outline-variant bg-surface flex items-center justify-center">
              {user?.profile_image ? (
                <img src={user.profile_image} alt={user.full_name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-outline" />
              )}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-on-surface dark:text-dark-on-surface max-w-[120px] truncate leading-tight">
                {user?.full_name || 'Guest User'}
              </p>
              <p className="text-[10px] text-on-surface-variant dark:text-dark-on-surface-variant capitalize">
                {user?.role || 'User'}
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-outline hidden sm:block" />
          </button>

          {/* User Profile Overlay menu */}
          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2.5 w-72 bg-surface-container-high dark:bg-dark-surface-container-high rounded-xl shadow-xl border border-outline-variant dark:border-dark-outline-variant overflow-hidden"
              >
                {/* Header User Card */}
                <div className="p-5 bg-surface-container-low dark:bg-dark-surface-container-low border-b border-outline-variant dark:border-dark-outline-variant text-center">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary mx-auto mb-3 bg-surface flex items-center justify-center shadow-sm">
                    {user?.profile_image ? (
                      <img src={user.profile_image} alt={user.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-outline" />
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-on-surface dark:text-dark-on-surface leading-tight">
                    {user?.full_name}
                  </h4>
                  <span className="inline-block mt-1 py-0.5 px-2.5 bg-primary/10 dark:bg-primary/20 text-primary text-[10px] font-bold uppercase rounded-full">
                    {user?.role || 'Employee'}
                  </span>
                </div>

                {/* Details Section */}
                <div className="p-4 space-y-3 border-b border-outline-variant dark:border-dark-outline-variant text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-outline" />
                    <span>ID: <span className="font-semibold text-on-surface dark:text-dark-on-surface">{user?.employee_no}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-outline" />
                    <span className="truncate">{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-outline" />
                    <span>{user?.phone}</span>
                  </div>
                  {user?.whatsapp_number && (
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-outline" />
                      <span>{user?.whatsapp_number}</span>
                    </div>
                  )}
                </div>

                {/* Logout Trigger */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-5 py-3.5 hover:bg-red-500/10 text-red-600 dark:text-red-400 font-semibold text-xs transition-colors cursor-pointer text-left border-none"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out Session</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
