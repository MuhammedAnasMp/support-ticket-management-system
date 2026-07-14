import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Ticket, Store, Wrench, Users, Receipt,
  BarChart3, Settings, ChevronDown, X
} from 'lucide-react';

interface SubItem {
  title: string;
  path: string;
}

interface MenuItem {
  title: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: SubItem[];
  roles?: string[]; // Allowed roles (if empty, visible to all)
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, userRole }) => {
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

  const toggleExpand = (title: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  // Define sidebar menu structure mapping to sidebar.md
  const menuItems: MenuItem[] = [
    {
      title: 'Dashboard',
      icon: <Home className="w-5 h-5" />,
      path: '/',
    },
    {
      title: 'Tickets',
      icon: <Ticket className="w-5 h-5" />,
      subItems: [
        { title: 'All Tickets', path: '/tickets/all' },
        { title: 'Create Ticket', path: '/tickets/create' },

      ],
    },
    {
      title: 'Stores',
      icon: <Store className="w-5 h-5" />,
      subItems: [
        { title: 'Stores', path: '/stores/all' },
        { title: 'Departments', path: '/stores/departments' },
        { title: 'Sub Departments', path: '/stores/sub-departments' },
      ],
    },
    {
      title: 'Maintenance',
      icon: <Wrench className="w-5 h-5" />,
      subItems: [
        { title: 'Maintenance Nature', path: '/maintenance/natures' },
        { title: 'Default Assignments', path: '/maintenance/worker-assignments' },
        { title: 'Priorities', path: '/maintenance/priorities' },
        { title: 'Statuses', path: '/maintenance/statuses' },
      ],
    },
    {
      title: 'Workforce',
      icon: <Users className="w-5 h-5" />,
      subItems: [
        { title: 'Employees', path: '/workforce/employees' },
        { title: 'Employee Rates', path: '/workforce/rates' },
        { title: 'Worker Skills', path: '/workforce/skills' },
      ],
    },
    {
      title: 'Expense Approval',
      icon: <Receipt className="w-5 h-5" />,
      roles: ['Office Staff', 'Administrator'], // Restricted to Office Staff and Admin
      subItems: [
        { title: 'Pending Claims', path: '/expenses/pending' },
        { title: 'Approved Expenses', path: '/expenses/approved' },
        { title: 'Rejected Expenses', path: '/expenses/rejected' },
        { title: 'Expense Types', path: '/expenses/types' },
      ],
    },
    {
      title: 'Reports',
      icon: <BarChart3 className="w-5 h-5" />,
      subItems: [
        { title: 'Ticket Report', path: '/reports/tickets' },
        { title: 'Store Performance', path: '/reports/store-performance' },
        { title: 'Labour Cost', path: '/reports/labour-cost' },
        { title: 'Expense Report', path: '/reports/expenses' },
        { title: 'Worker Performance', path: '/reports/worker-performance' },
        { title: 'Monthly Summary', path: '/reports/monthly-summary' },
        { title: 'Reconciliation Report', path: '/reports/reconciliation' },
      ],
    },
    {
      title: 'Administration',
      icon: <Settings className="w-5 h-5" />,
      subItems: [
        { title: 'Users', path: '/admin/users' },
        { title: 'Roles', path: '/admin/roles' },
        { title: 'Permissions', path: '/admin/permissions' },
        { title: 'System Settings', path: '/admin/settings' },
      ],
    },
  ];

  // Check if a path or any subitem path matches the current location
  const isPathActive = (path?: string, subItems?: SubItem[]) => {
    if (path) return location.pathname === path;
    if (subItems) {
      return subItems.some((subItem) => location.pathname === subItem.path);
    }
    return false;
  };

  // Check role authorization
  const hasAccess = (roles?: string[]) => {
    if (!roles || roles.length === 0) return true;
    if (!userRole) return false;
    return roles.includes(userRole);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-surface-container dark:bg-dark-surface-container border-r border-outline-variant dark:border-dark-outline-variant w-64 md:w-72">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant dark:border-dark-outline-variant">
        <div className="flex items-center gap-2">
          <Wrench className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg text-on-surface dark:text-dark-on-surface tracking-tight">
            FixMngr
          </span>
        </div>
        {/* Mobile Close Button */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high cursor-pointer"
          aria-label="Close Sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Menu List */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 scrollbar-thin">
        {menuItems.filter(item => hasAccess(item.roles)).map((item, idx) => {
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const active = isPathActive(item.path, item.subItems);
          const expanded = expandedMenus[item.title] || (active && expandedMenus[item.title] !== false);

          return (
            <div key={idx} className="space-y-1">
              {hasSubItems ? (
                // Multi-tier Item (Accordion Trigger)
                <div>
                  <button
                    onClick={() => toggleExpand(item.title)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${active
                      ? 'text-primary bg-primary/5 dark:bg-primary/10'
                      : 'text-on-surface-variant dark:text-dark-on-surface-variant hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={active ? 'text-primary' : 'text-outline dark:text-dark-on-surface-variant'}>
                        {item.icon}
                      </span>
                      <span>{item.title}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-outline transition-transform duration-200 ${expanded ? 'transform rotate-180' : ''
                        }`}
                    />
                  </button>

                  {/* Submenu Accordion Container */}
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden pl-11 pr-2 space-y-1"
                      >
                        {item.subItems?.map((sub, subIdx) => {
                          const subActive = location.pathname === sub.path;
                          return (
                            <Link
                              key={subIdx}
                              to={sub.path}
                              onClick={() => {
                                if (window.innerWidth < 768) onClose();
                              }}
                              className={`block px-3 py-2 rounded-md text-xs font-medium transition-all ${subActive
                                ? 'text-primary bg-accent-light/40 dark:bg-primary/20'
                                : 'text-on-surface-variant dark:text-dark-on-surface-variant hover:text-on-surface dark:hover:text-dark-on-surface hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low'
                                }`}
                            >
                              {sub.title}
                            </Link>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                // Single Item Link
                <Link
                  to={item.path || '/'}
                  onClick={() => {
                    if (window.innerWidth < 768) onClose();
                  }}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${active
                    ? 'text-primary bg-accent-light/40 dark:bg-primary/20'
                    : 'text-on-surface-variant dark:text-dark-on-surface-variant hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low'
                    }`}
                >
                  <span className={active ? 'text-primary' : 'text-outline dark:text-dark-on-surface-variant'}>
                    {item.icon}
                  </span>
                  <span>{item.title}</span>
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer / Role indicator */}
      {userRole && (
        <div className="p-4 border-t border-outline-variant dark:border-dark-outline-variant bg-surface-container-low dark:bg-dark-surface-container-low">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant">
              Role: {userRole}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Permanent) */}
      <div className="hidden md:flex shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar (Drawer Overlay) */}
      <AnimatePresence>
        {isOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative z-50 flex h-full shadow-2xl"
            >
              {sidebarContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
