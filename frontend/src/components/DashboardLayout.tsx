import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 768;
  });
  const location = useLocation();

  // Map pathnames to human readable page titles
  const getPageTitle = (path: string): string => {
    if (path === '/') return 'Dashboard Overview';

    // Split and capitalize path segments
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return 'Dashboard';

    // Capitalize each word and replace hyphens with spaces
    const formatSegment = (s: string) => {
      return s
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    };

    if (segments[0] === 'tickets') {
      if (segments[1] === 'create') return 'Create Support Ticket';
      return `${formatSegment(segments[1] || 'all')} Tickets`;
    }
    if (segments[0] === 'stores') {
      if (segments[1] === 'all') return 'Manage Locations';
      return formatSegment(segments[1] || 'stores');
    }
    if (segments[0] === 'maintenance') {
      return `Maintenance: ${formatSegment(segments[1] || 'Natures')}`;
    }
    if (segments[0] === 'workforce') {
      return `Workforce: ${formatSegment(segments[1] || 'Employees')}`;
    }
    if (segments[0] === 'expenses') {
      return `Expense Approvals: ${formatSegment(segments[1] || 'Claims')}`;
    }
    if (segments[0] === 'reports') {
      return `Report: ${formatSegment(segments[1] || 'Overview')}`;
    }
    if (segments[0] === 'admin') {
      return `Administration: ${formatSegment(segments[1] || 'Settings')}`;
    }

    return formatSegment(segments[segments.length - 1]);
  };

  return (
    <div className="flex min-h-screen bg-surface dark:bg-dark-surface transition-colors duration-200">
      {/* Navigation Sidebar Drawer */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Container */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top Header */}
        <Header
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          pageTitle={getPageTitle(location.pathname)}
          isSidebarOpen={sidebarOpen}
        />

        {/* Scrollable Work Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 .max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
