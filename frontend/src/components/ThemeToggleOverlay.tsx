import React from 'react';
import { useLocation } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleOverlayProps {
  isDark: boolean;
  setIsDark: (val: boolean) => void;
}

export const ThemeToggleOverlay: React.FC<ThemeToggleOverlayProps> = ({ isDark, setIsDark }) => {
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
