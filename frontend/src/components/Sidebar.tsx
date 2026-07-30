import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
  Home, Ticket, Store, Wrench, Users, Receipt,
  BarChart3, Settings, ChevronDown, X, User, Shield
} from 'lucide-react';
import type { RootState } from '../store';
import { usePermission } from '../hooks/usePermission';
import type { PermissionKey } from '@/hooks/Can';
import Can from '@/hooks/Can';


interface SubItem {
  title: string;
  path: string;
  permission?: PermissionKey;
}

interface MenuItem {
  title: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: SubItem[];
  permission?: PermissionKey;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [profileExpanded, setProfileExpanded] = useState(false);

  const { user, accessibleStores } = useSelector((state: RootState) => state.auth);
  const { hasPermission } = usePermission();

  const toggleExpand = (title: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  // Define sidebar menu structure mapping to ERD and design guidelines
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
        { title: 'All Tickets', path: '/tickets/all', permission: 'maintenance.view_ticket' },
        { title: 'Create Ticket', path: '/tickets/create', permission: 'maintenance.create_ticket' },
      ],
    },
    {
      title: 'Stores',
      icon: <Store className="w-5 h-5" />,
      subItems: [
        { title: 'Stores', path: '/stores/all', permission: 'stores.view_store' },
        { title: 'Areas', path: '/stores/areas', permission: 'stores.view_area' },
        // { title: 'Departments', path: '/stores/departments', permission: 'stores.view_department' },
        { title: 'Sub Departments', path: '/stores/sub-departments', permission: 'stores.view_subdepartment' },
      ],
    },
    {
      title: 'Maintenance',
      icon: <Wrench className="w-5 h-5" />,
      subItems: [
        { title: 'Maintenance Nature', path: '/maintenance/natures', permission: 'maintenance.view_worknature' },
        { title: 'Default Assignments', path: '/maintenance/worker-assignments', permission: 'maintenance.view_natureworker' },
        { title: 'Priorities', path: '/maintenance/priorities', permission: 'maintenance.view_priority' },
        { title: 'Statuses', path: '/maintenance/statuses', permission: 'maintenance.view_status' },
        { title: 'Media Categories', path: '/maintenance/media-categories', permission: 'common.view_mediacategory' },
      ],
    },
    {
      title: 'Workforce',
      icon: <Users className="w-5 h-5" />,
      subItems: [
        { title: 'Employees', path: '/workforce/employees', permission: 'accounts.view_customuser' },
        { title: 'Employee Rates', path: '/workforce/rates', permission: 'finance.view_employeerate' },
        // { title: 'Worker Skills', path: '/workforce/skills', permission: 'maintenance.view_natureworker' },
      ],
    }
  ];

  // Check if a path or any subitem path matches the current location
  const isPathActive = (path?: string, subItems?: SubItem[]) => {
    if (path) return location.pathname === path;
    if (subItems) {
      return subItems.some((subItem) => location.pathname === subItem.path);
    }
    return false;
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
        {menuItems
          .map(item => {
            const filteredSubItems = item.subItems?.filter(sub => hasPermission(sub.permission));
            return { ...item, subItems: filteredSubItems };
          })
          .filter(item => {
            if (item.subItems) {
              return item.subItems.length > 0;
            }
            return hasPermission(item.permission);
          })
          .map((item, idx) => {
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const active = isPathActive(item.path, item.subItems);
            const expanded = expandedMenus[item.title] || (active && expandedMenus[item.title] !== false);

            return (
              <div key={idx} className="space-y-1">
                {hasSubItems ? (
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
                                <Can permission={sub.permission ?? false}>
                                  {sub.title}
                                </Can>
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

      {/* Footer / User Profile Card */}
      {user && (
        <div className="p-4 border-t border-outline-variant dark:border-dark-outline-variant bg-surface-container-low dark:bg-dark-surface-container-low transition-all duration-200 shrink-0">
          <button
            onClick={() => setProfileExpanded(!profileExpanded)}
            className="w-full flex items-center justify-between text-left focus:outline-none hover:opacity-90 transition-opacity cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-outline-variant dark:border-dark-outline-variant bg-surface flex items-center justify-center shrink-0">
                {user.profile_image ? (
                  <img src={user.profile_image} alt={user.full_name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-outline" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-on-surface dark:text-dark-on-surface truncate leading-tight">
                  {user.full_name}
                </p>
                <p className="text-[10px] text-on-surface-variant dark:text-dark-on-surface-variant truncate font-semibold uppercase tracking-wider leading-tight mt-0.5">
                  {user.role || 'No Role'}
                </p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-outline transition-transform duration-200 ${profileExpanded ? 'transform rotate-180' : ''}`} />
          </button>

          <AnimatePresence initial={false}>
            {profileExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden space-y-3 pt-3 mt-3 border-t border-outline-variant/50 dark:border-dark-outline-variant/30 text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
              >
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Emp ID: <span className="font-semibold text-on-surface dark:text-dark-on-surface">{user.employee_no}</span></span>
                </div>



                {user.sub_departments && user.sub_departments.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Wrench className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-outline block leading-none">Assigned Departments</span>
                      <span className="font-medium text-on-surface dark:text-dark-on-surface block mt-0.5">
                        {user.sub_departments.join(', ')}
                      </span>
                    </div>
                  </div>
                )}

                {user.natures && user.natures.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Wrench className="w-3.5 h-3.5 text-tertiary shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-outline block leading-none">Work Skills / Natures</span>
                      <span className="font-medium text-on-surface dark:text-dark-on-surface block mt-0.5">
                        {user.natures.join(', ')}
                      </span>
                    </div>
                  </div>
                )}

                {(user.tickets_created_count !== undefined || user.tickets_assigned_count !== undefined) && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {user.tickets_created_count !== undefined && (
                      <div className="p-2 rounded bg-surface-container-high dark:bg-dark-surface-container-low text-center">
                        <span className="text-[9px] text-outline block uppercase tracking-wider">Created</span>
                        <span className="text-xs font-bold text-on-surface dark:text-dark-on-surface">{user.tickets_created_count}</span>
                      </div>
                    )}
                    {user.tickets_assigned_count !== undefined && (
                      <div className="p-2 rounded bg-surface-container-high dark:bg-dark-surface-container-low text-center">
                        <span className="text-[9px] text-outline block uppercase tracking-wider">Assigned</span>
                        <span className="text-xs font-bold text-on-surface dark:text-dark-on-surface">{user.tickets_assigned_count}</span>
                      </div>
                    )}
                  </div>
                )}

                {accessibleStores && accessibleStores.length > 0 && (
                  <div className="pt-2 border-t border-outline-variant/30 dark:border-dark-outline-variant/20">
                    <span className="text-[9px] text-outline block uppercase tracking-wider mb-1">Accessible Stores ({accessibleStores.length})</span>
                    <p className="text-[10px] leading-tight font-medium text-on-surface dark:text-dark-on-surface">
                      {accessibleStores.map(s => s.store_name).join(', ')}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
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
