
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, AlertTriangle, Eye, Paperclip, DollarSign,
  X, Loader2, FileText, Camera, CheckCircle2, Clock, Image,
  Receipt, UserCircle2, Building2, Wrench, AlertCircle, User,
  Edit2, Trash2, Settings
} from 'lucide-react';
import type { RootState } from '../store';
import { usePermission } from '../hooks/usePermission';
import Can from '@/hooks/Can';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const MEDIA_BASE = import.meta.env.VITE_MEDIA_URL || 'http://localhost:8000';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface UserStub {
  user_id: number;
  full_name: string;
  employee_no?: string | null;
  profile_image?: string | null;
  role?: { role_id: number; role_name: string } | null;
}

interface Ticket {
  ticket_id: number;
  work_order_no: string;
  store: { store_id: string; store_name: string };
  department: { department_id: number; department_name: string };
  nature: { nature_id: number; nature_name: string };
  priority: { priority_id: number; priority_name: string; level: number };
  status: { status_id: number; status_name: string };
  title: string;
  description: string;
  created_by: UserStub;
  created_date: string;
  approved_by?: UserStub | null;
  approved_date?: string | null;
  rejected_by?: UserStub | null;
  rejected_date?: string | null;
  reject_reason?: string | null;
  closed_by?: UserStub | null;
  closed_date?: string | null;
}

interface Allocation {
  allocation_id: number;
  worker: UserStub;
  assigned_by: UserStub;
  assigned_date: string;
  planned_hours: string;
  remarks: string;
}

interface WorkLog {
  worklog_id: number;
  worker: UserStub;
  work_date: string;
  hours: string;
  hourly_rate: string;
  labour_amount: string;
  work_done: string;
}

interface Expense {
  expense_id: number;
  worker: UserStub;
  expense_type: { expense_type_id: number; expense_name: string; parent?: { expense_name: string } | null; required?: boolean };
  amount: string;
  expense_date: string;
  remarks: string;
  approved: boolean;
  receipt?: Media | null;
  receipts?: Media[] | null;
}

interface MediaCategory {
  category_id: number;
  category_name: string;
  department?: { department_id: number; department_name: string } | null;
}

interface Media {
  media_id: number;
  file_name: string;
  file_url: string;
  uploaded_by: UserStub;
  uploaded_date: string;
  category: MediaCategory | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getMediaUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${MEDIA_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
};

const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name);
const isVideo = (name: string) => /\.(mp4|mov|avi|mkv|webm)$/i.test(name);

const AvatarCircle: React.FC<{ user: UserStub; size?: 'sm' | 'md' | 'lg' }> = ({ user, size = 'md' }) => {
  const sizeClass = { sm: 'w-7 h-7 text-[10px]', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' }[size];
  const imgUrl = user.profile_image ? getMediaUrl(user.profile_image) : null;
  const initials = user.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold bg-primary/20 text-primary border-2 border-primary/30`}>
      {imgUrl
        ? <img src={imgUrl} alt={user.full_name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        : <span>{initials}</span>
      }
    </div>
  );
};

interface MediaGridProps {
  items: Media[];
  emptyLabel: string;
  onEdit?: (mediaId: number) => void;
  onDelete?: (mediaId: number) => void;
}
const MediaGrid: React.FC<MediaGridProps> = ({ items, emptyLabel, onEdit, onDelete }) => {
  if (items.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-outline border-2 border-dashed border-outline-variant dark:border-dark-outline-variant rounded-xl">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {items.map(m => {
        const url = getMediaUrl(m.file_url);
        return (
          <div key={m.media_id} className="relative aspect-video bg-surface dark:bg-dark-surface rounded-lg overflow-hidden border border-outline-variant dark:border-dark-outline-variant group">
            <a href={url} target="_blank" rel="noopener noreferrer" className="block w-full h-full cursor-pointer">
              {isImage(m.file_name) ? (
                <img src={url} alt={m.file_name} className="w-full h-full object-cover" />
              ) : isVideo(m.file_name) ? (
                <video src={url} className="w-full h-full object-cover" muted />
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <FileText className="w-6 h-6 text-outline" />
                </div>
              )}
              {!onEdit && !onDelete && (
                <div className="absolute inset-0 bg-black/10 hover:bg-black/30 transition-all flex items-center justify-center">
                  <Eye className="w-6 h-6 text-white opacity-60 hover:opacity-100 transition-opacity" />
                </div>
              )}
            </a>

            {/* Editing overlays (only visible inside management modals) */}
            {(onEdit || onDelete) && (
              <div className="absolute top-1 right-1 flex gap-1 z-10">
                {/* {onEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onEdit(m.media_id);
                    }}
                    className="p-1 bg-black/60 hover:bg-black/85 text-white rounded cursor-pointer transition-colors"
                    title="Replace file"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )} */}
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(m.media_id);
                    }}
                    className="p-1 bg-red-600/80 hover:bg-red-600 text-white rounded cursor-pointer transition-colors"
                    title="Delete file"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
            <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5 text-[8px] text-white truncate pointer-events-none">{m.file_name}</div>
          </div>
        );
      })}
    </div>
  );
};

const SectionTitle: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="p-1.5 bg-primary/10 rounded-lg text-primary">{icon}</div>
    <h4 className="text-xs font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">{label}</h4>
  </div>
);

const Divider = () => <div className="border-t border-outline-variant dark:border-dark-outline-variant" />;

// ─── Main Component ───────────────────────────────────────────────────────────

export const TicketsViewx: React.FC = () => {
  const { subpage } = useParams<{ subpage: string }>();
  const navigate = useNavigate();
  const { token, user } = useSelector((state: RootState) => state.auth);
  const { hasPermission } = usePermission();

  // Lists
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [natures, setNatures] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [subDepartments, setSubDepartments] = useState<any[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<any[]>([]);
  const [mediaCategories, setMediaCategories] = useState<MediaCategory[]>([]);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Selected Ticket Modal State
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [natureWorkers, setNatureWorkers] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Active Tab State (Worker User ID)
  const [activeWorkerId, setActiveWorkerId] = useState<number | null>(null);
  const [selectedExpenseTypeId, setSelectedExpenseTypeId] = useState<string>('');

  // Sub-Modals Open/Close States (Addition Modals)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isLogHoursModalOpen, setIsLogHoursModalOpen] = useState(false);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);

  // Media Management Popups
  const [isManageIssueMediaOpen, setIsManageIssueMediaOpen] = useState(false);
  const [isManageCompletedMediaOpen, setIsManageCompletedMediaOpen] = useState(false);

  // Sub-Modals Edit Target Entities
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  const [editingWorkLog, setEditingWorkLog] = useState<WorkLog | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Action forms state
  const [newAllocation, setNewAllocation] = useState({ worker_id: '', planned_hours: '4.0', remarks: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Edit forms state
  const [editWorkLogForm, setEditWorkLogForm] = useState({ hours: '', work_done: '' });
  const [editExpenseForm, setEditExpenseForm] = useState({ amount: '', remarks: '', expense_type_id: '' });
  const [editAllocationForm, setEditAllocationForm] = useState({ planned_hours: '', remarks: '' });

  // Per-worker expense receipt files (workerId -> File[])
  const [expenseFiles, setExpenseFiles] = useState<Record<number, File[]>>({});

  // AbortController for in-flight uploads — aborted when modal closes
  const uploadAbortRef = React.useRef<AbortController | null>(null);

  const closeModal = () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setSelectedTicket(null);
    setActionLoading(false);
    setIsAssignModalOpen(false);
    setIsLogHoursModalOpen(false);
    setIsAddExpenseModalOpen(false);
    setSelectedExpenseTypeId('');
    setIsManageIssueMediaOpen(false);
    setIsManageCompletedMediaOpen(false);
    setEditingAllocation(null);
    setEditingWorkLog(null);
    setEditingExpense(null);
  };

  // Creation View Form State
  const [createForm, setCreateForm] = useState({
    store_id: '',
    department_id: '',
    nature_id: '',
    priority_id: '',
    title: '',
    description: '',
    work_order_no: 0
  });
  const [createTicketFiles, setCreateTicketFiles] = useState<File[]>([]);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);

  // Memoize preview URLs so typing in input/textarea fields doesn't cause thumbnail flickering/blinking
  const createTicketPreviews = useMemo(() => {
    return createTicketFiles.map(file => {
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      const url = (isImg || isVid) ? URL.createObjectURL(file) : null;
      return { file, isImg, isVid, url };
    });
  }, [createTicketFiles]);

  const canCreateAllDepts = hasPermission('create_ticket_all_departments');

  const userDepartmentIds = useMemo(() => {
    if (canCreateAllDepts) return null;
    if (!user?.sub_departments || user.sub_departments.length === 0) return null;
    const deptIds = new Set<number>();
    user.sub_departments.forEach((sd: any) => {
      let sdObj = sd;
      if (typeof sd === 'string' || typeof sd === 'number') {
        sdObj = subDepartments.find(item =>
          item.sub_department_id === Number(sd) ||
          item.sub_department_name.toLowerCase() === String(sd).toLowerCase()
        );
      }
      if (sdObj) {
        const parentDeptId = Number(sdObj.department?.department_id ?? sdObj.department);
        if (parentDeptId) {
          deptIds.add(parentDeptId);
        }
      }
    });
    return deptIds.size > 0 ? deptIds : null;
  }, [user, canCreateAllDepts, subDepartments]);

  const availableDepartments = useMemo(() => {
    if (canCreateAllDepts) return departments;
    if (!userDepartmentIds) return [];
    return departments.filter(d => userDepartmentIds.has(Number(d.department_id)));
  }, [departments, userDepartmentIds, canCreateAllDepts]);

  useEffect(() => {
    if (!canCreateAllDepts && availableDepartments.length > 0) {
      const defaultDeptId = String(availableDepartments[0].department_id);
      if (subpage === 'create') {
        if (createForm.department_id !== defaultDeptId) {
          setCreateForm(prev => ({ ...prev, department_id: defaultDeptId }));
        }
      }
      if (filterDept !== defaultDeptId && availableDepartments.length === 1) {
        setFilterDept(defaultDeptId);
      }
    }
  }, [subpage, canCreateAllDepts, availableDepartments, filterDept]);

  // Loader & message states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Helper: Get parent department IDs for the logged-in user to restrict worker list
  const getLoggedInUserDepartmentIds = (): Set<number> | null => {
    const roleName = ((user?.role as any)?.role_name || (user?.role as string) || '').toLowerCase();
    if ((user as any)?.is_superuser || roleName.includes('admin') || roleName.includes('administrator')) {
      return null; // Superusers / Admins see all workers under ticket's department
    }
    if (!user?.sub_departments || user.sub_departments.length === 0) {
      return null;
    }
    const deptIds = new Set<number>();
    user.sub_departments.forEach((sd: any) => {
      let sdObj = sd;
      if (typeof sd === 'string' || typeof sd === 'number') {
        sdObj = subDepartments.find(item =>
          item.sub_department_id === Number(sd) ||
          item.sub_department_name.toLowerCase() === String(sd).toLowerCase()
        );
      }
      if (sdObj) {
        const parentDeptId = Number(sdObj.department?.department_id ?? sdObj.department);
        if (parentDeptId) {
          deptIds.add(parentDeptId);
        }
      }
    });
    return deptIds.size > 0 ? deptIds : null;
  };

  // Helper: Check if worker belongs to target department and logged-in user department
  const isWorkerInDepartment = (w: any, targetDeptId: number) => {
    if (!w || !w.sub_departments || !Array.isArray(w.sub_departments) || w.sub_departments.length === 0) {
      return false;
    }
    const userDeptIds = getLoggedInUserDepartmentIds();

    return w.sub_departments.some((sd: any) => {
      let deptId: number | null = null;
      if (typeof sd === 'object' && sd !== null) {
        if (sd.department?.department_id) {
          deptId = Number(sd.department.department_id);
        } else if (typeof sd.department === 'number') {
          deptId = Number(sd.department);
        } else if (sd.sub_department_id) {
          const found = subDepartments.find(item => item.sub_department_id === Number(sd.sub_department_id));
          if (found) {
            deptId = Number(found.department?.department_id ?? found.department);
          }
        }
      } else if (typeof sd === 'number' || typeof sd === 'string') {
        const found = subDepartments.find(item =>
          item.sub_department_id === Number(sd) ||
          item.sub_department_name.toLowerCase() === String(sd).toLowerCase()
        );
        if (found) {
          deptId = Number(found.department?.department_id ?? found.department);
        }
      }

      if (!deptId) return false;

      // Check against ticket department ID
      const matchesTicketDept = deptId === targetDeptId;

      // Check against logged in user department IDs if restricted
      const matchesUserDept = userDeptIds === null || userDeptIds.has(deptId);

      return matchesTicketDept && matchesUserDept;
    });
  };

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetchMetadata();
    fetchTickets();
  }, [token]);

  // Keep activeWorkerId synced with allocations list
  useEffect(() => {
    if (allocations.length > 0) {
      const exists = allocations.some(a => a.worker.user_id === activeWorkerId);
      if (!exists) {
        setActiveWorkerId(allocations[0].worker.user_id);
      }
    } else {
      setActiveWorkerId(null);
    }
  }, [allocations, activeWorkerId]);

  const fetchMetadata = async () => {
    try {
      const headers = { Authorization: `Token ${token}` };
      const [resStores, resDepts, resSubDepts, resPri, resStat, resNat, resWork, resExp, resMediaCat] = await Promise.all([
        fetch(`${API_URL}/stores/store/`, { headers }),
        fetch(`${API_URL}/stores/department/`, { headers }),
        fetch(`${API_URL}/stores/subdepartment/`, { headers }),
        fetch(`${API_URL}/maintenance/priority/`, { headers }),
        fetch(`${API_URL}/maintenance/status/`, { headers }),
        fetch(`${API_URL}/maintenance/worknature/`, { headers }),
        fetch(`${API_URL}/accounts/customuser/`, { headers }),
        fetch(`${API_URL}/finance/expensetype/`, { headers }),
        fetch(`${API_URL}/common/mediacategory/`, { headers }),
      ]);

      if (resStores.ok) setStores(await resStores.json());
      if (resDepts.ok) setDepartments(await resDepts.json());
      if (resSubDepts.ok) setSubDepartments(await resSubDepts.json());
      if (resPri.ok) setPriorities(await resPri.json());
      if (resStat.ok) setStatuses(await resStat.json());
      if (resNat.ok) setNatures(await resNat.json());
      if (resWork.ok) {
        const uList = await resWork.json();
        setWorkers(uList.filter((u: any) => {
          const roleName = u.role?.role_name?.toLowerCase() ?? '';
          return roleName === 'technician' || roleName === 'worker';
        }));
      }
      if (resExp.ok) setExpenseTypes(await resExp.json());
      if (resMediaCat.ok) setMediaCategories(await resMediaCat.json());
    } catch (err) {
      console.error('Failed to load metadata', err);
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/maintenance/ticket/`, {
        headers: { Authorization: `Token ${token}` }
      });
      if (response.ok) setTickets(await response.json());
    } catch (err) {
      console.error('Failed to load tickets', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTicket = async (ticket: Ticket) => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = new AbortController();
    setSelectedTicket(ticket);
    setShowRejectForm(false);
    setRejectReason('');
    setAllocations([]);
    setWorkLogs([]);
    setExpenses([]);
    setMediaList([]);
    setMediaCategories([]);
    setNatureWorkers([]);
    setModalLoading(true);
    try {
      const headers = { Authorization: `Token ${token}` };
      const [resAlloc, resLog, resExp, resMed, resMediaCat, resNatureWorker] = await Promise.all([
        fetch(`${API_URL}/maintenance/allocation/?ticket=${ticket.ticket_id}`, { headers }),
        fetch(`${API_URL}/maintenance/worklog/?ticket=${ticket.ticket_id}`, { headers }),
        fetch(`${API_URL}/finance/expense/?ticket=${ticket.ticket_id}`, { headers }),
        fetch(`${API_URL}/common/media/?ticket=${ticket.ticket_id}`, { headers }),
        fetch(`${API_URL}/common/mediacategory/`, { headers }),
        fetch(`${API_URL}/maintenance/natureworker/?nature=${ticket.nature.nature_id}`, { headers }),
      ]);

      if (resAlloc.ok) setAllocations(await resAlloc.json());
      if (resLog.ok) setWorkLogs(await resLog.json());
      if (resExp.ok) setExpenses(await resExp.json());
      if (resMed.ok) setMediaList(await resMed.json());
      if (resMediaCat.ok) setMediaCategories(await resMediaCat.json());
      if (resNatureWorker.ok) {
        const rawNW = await resNatureWorker.json();
        const ticketDeptId = Number(ticket.department?.department_id ?? ticket.department);
        const filteredNW = rawNW.filter((nw: any) =>
          nw.worker && isWorkerInDepartment(nw.worker, ticketDeptId)
        );
        setNatureWorkers(filteredNW);
      }
    } catch (err) {
      console.error('Failed to load ticket details', err);
    } finally {
      setModalLoading(false);
    }
  };

  const refreshTicketData = async (ticket: Ticket) => {
    if (!ticket) return;
    const signal = uploadAbortRef.current?.signal;
    fetchTickets();
    try {
      const headers = { Authorization: `Token ${token}` };
      const [resTicket, resAlloc, resLog, resExp, resMed, resMediaCat, resNatureWorker] = await Promise.all([
        fetch(`${API_URL}/maintenance/ticket/${ticket.ticket_id}/`, { headers, signal }),
        fetch(`${API_URL}/maintenance/allocation/?ticket=${ticket.ticket_id}`, { headers, signal }),
        fetch(`${API_URL}/maintenance/worklog/?ticket=${ticket.ticket_id}`, { headers, signal }),
        fetch(`${API_URL}/finance/expense/?ticket=${ticket.ticket_id}`, { headers, signal }),
        fetch(`${API_URL}/common/media/?ticket=${ticket.ticket_id}`, { headers, signal }),
        fetch(`${API_URL}/common/mediacategory/`, { headers, signal }),
        fetch(`${API_URL}/maintenance/natureworker/?nature=${ticket.nature.nature_id}`, { headers, signal }),
      ]);

      let freshAllocations = [];
      let freshWorkLogs = [];
      let freshExpenses = [];
      let freshMedia: Media[] = [];

      if (resTicket.ok) {
        const freshTicket = await resTicket.json();
        setSelectedTicket(freshTicket);
      }
      if (resAlloc.ok) {
        freshAllocations = await resAlloc.json();
        setAllocations(freshAllocations);
      }
      if (resLog.ok) {
        freshWorkLogs = await resLog.json();
        setWorkLogs(freshWorkLogs);
      }
      if (resExp.ok) {
        freshExpenses = await resExp.json();
        setExpenses(freshExpenses);
      }
      if (resMed.ok) {
        freshMedia = await resMed.json();
        setMediaList(freshMedia);
      }
      if (resMediaCat.ok) setMediaCategories(await resMediaCat.json());
      if (resNatureWorker.ok) {
        const rawNW = await resNatureWorker.json();
        const ticketDeptId = Number(ticket.department?.department_id ?? ticket.department);
        const filteredNW = rawNW.filter((nw: any) =>
          nw.worker && isWorkerInDepartment(nw.worker, ticketDeptId)
        );
        setNatureWorkers(filteredNW);
      }

      // Re-align active modal state items to match current database fetch
      if (editingAllocation) {
        const match = freshAllocations.find((al: Allocation) => al.allocation_id === editingAllocation.allocation_id);
        if (match) setEditingAllocation(match);
      }
      if (editingWorkLog) {
        const match = freshWorkLogs.find((wl: WorkLog) => wl.worklog_id === editingWorkLog.worklog_id);
        if (match) setEditingWorkLog(match);
      }
      if (editingExpense) {
        const match = freshExpenses.find((ex: Expense) => ex.expense_id === editingExpense.expense_id);
        if (match) setEditingExpense(match);
      }

    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('Failed to refresh ticket data', err);
    }
  };

  // ── API Update Handlers (Recalls API After Completion) ─────────────────────

  const handleUpdateWorkLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !editingWorkLog) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/maintenance/worklog/${editingWorkLog.worklog_id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hours: editWorkLogForm.hours,
          work_done: editWorkLogForm.work_done
        })
      });
      if (response.ok) {
        setEditingWorkLog(null);
        await refreshTicketData(selectedTicket);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteWorkLog = async (worklogId: number) => {
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/maintenance/worklog/${worklogId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` }
      });
      if (response.ok) {
        setEditingWorkLog(null);
        await refreshTicketData(selectedTicket);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !editingExpense) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/finance/expense/${editingExpense.expense_id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: editExpenseForm.amount,
          remarks: editExpenseForm.remarks,
          expense_type: editExpenseForm.expense_type_id
        })
      });
      if (response.ok) {
        setEditingExpense(null);
        await refreshTicketData(selectedTicket);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/finance/expense/${expenseId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` }
      });
      if (response.ok) {
        setEditingExpense(null);
        await refreshTicketData(selectedTicket);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !editingAllocation) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/maintenance/allocation/${editingAllocation.allocation_id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planned_hours: editAllocationForm.planned_hours,
          remarks: editAllocationForm.remarks
        })
      });
      if (response.ok) {
        setEditingAllocation(null);
        await refreshTicketData(selectedTicket);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAllocation = async (allocationId: number) => {
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/maintenance/allocation/${allocationId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` }
      });
      if (response.ok) {
        setEditingAllocation(null);
        await refreshTicketData(selectedTicket);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Media Edit/Delete Handlers ─────────────────────────────────────────────
  const [replacingMediaId, setReplacingMediaId] = useState<number | null>(null);

  const triggerReplaceMedia = (mediaId: number) => {
    setReplacingMediaId(mediaId);
    setTimeout(() => {
      document.getElementById('media-replacement-input')?.click();
    }, 50);
  };

  const handleMediaReplacementSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingMediaId || !selectedTicket) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('file_url', file);
      formData.append('file_name', file.name);

      const response = await fetch(`${API_URL}/common/media/${replacingMediaId}/`, {
        method: 'PATCH',
        headers: { Authorization: `Token ${token}` },
        body: formData
      });

      if (response.ok) {
        await refreshTicketData(selectedTicket);
      } else {
        const err = await response.json();
        console.error('Failed to replace media', err);
        alert('Failed to replace media: ' + JSON.stringify(err));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
      setReplacingMediaId(null);
      e.target.value = '';
    }
  };

  const handleDeleteMedia = async (mediaId: number) => {
    if (!selectedTicket) return;
    if (!window.confirm('Are you sure you want to delete this media file?')) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/common/media/${mediaId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` }
      });
      if (response.ok) {
        await refreshTicketData(selectedTicket);
      } else {
        console.error('Failed to delete media');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Operations ─────────────────────────────────────────────────────────────

  const uploadMediaForTicket = async (ticketId: number, file: File) => {
    if (!user) return null;
    try {
      const cat = mediaCategories.find(c => c.category_name?.trim().toLowerCase() === 'before repair') ||
        mediaCategories.find(c => c.category_name?.trim().toLowerCase().includes('before'));

      const formData = new FormData();
      formData.append('ticket', ticketId.toString());
      formData.append('file_url', file);
      formData.append('file_name', file.name);
      formData.append('uploaded_by', user.user_id.toString());
      if (cat) formData.append('category', cat.category_id.toString());

      const response = await fetch(`${API_URL}/common/media/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}` },
        body: formData
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error('Failed to upload media for ticket', err);
    }
    return null;
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedNature = natures.find(n => Number(n.nature_id) === Number(createForm.nature_id));
    const isMediaRequired = selectedNature ? (selectedNature.media_required !== false) : true;

    if (isMediaRequired && createTicketFiles.length < 2) {
      setMessage({ text: 'Please attach a minimum of 2 media files (photos/videos/documents) for the selected Work Nature.', type: 'error' });
      return;
    }

    setActionLoading(true);
    setMessage(null);
    try {
      const payload: Record<string, any> = {
        store: createForm.store_id,
        department: createForm.department_id,
        nature: createForm.nature_id,
        title: createForm.title,
        description: createForm.description
      };

      const response = await fetch(`${API_URL}/maintenance/ticket/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        if (createTicketFiles.length > 0) {
          await Promise.all(
            createTicketFiles.map(file => uploadMediaForTicket(data.ticket_id, file))
          );
        }

        setMessage({ text: 'Support Ticket created successfully!', type: 'success' });
        setCreateForm({ store_id: '', department_id: '', nature_id: '', priority_id: '', title: '', description: '', work_order_no: 0 });
        setCreateTicketFiles([]);
        await fetchTickets();
        navigate('/tickets/all');
      } else {
        const errorMsg = typeof data === 'object' ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(' | ') : 'Failed to create ticket';
        setMessage({ text: errorMsg, type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Connection issue', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/maintenance/allocation/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket: selectedTicket.ticket_id,
          worker: newAllocation.worker_id,
          planned_hours: newAllocation.planned_hours,
          remarks: newAllocation.remarks
        })
      });
      if (response.ok) {
        const freshAlloc = await response.json();
        setNewAllocation({ worker_id: '', planned_hours: '4.0', remarks: '' });
        setIsAssignModalOpen(false);
        setActiveWorkerId(freshAlloc.worker?.user_id || Number(newAllocation.worker_id));
        await refreshTicketData(selectedTicket);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddWorkLog = async (e: React.FormEvent<HTMLFormElement>, workerId: number) => {
    e.preventDefault();
    if (!selectedTicket) return;
    const form = e.currentTarget;
    setActionLoading(true);
    const formData = new FormData(form);
    const hours = formData.get('hours');
    const work_done = formData.get('work_done');
    try {
      const response = await fetch(`${API_URL}/maintenance/worklog/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket: selectedTicket.ticket_id,
          worker: workerId,
          hours: hours,
          work_done: work_done,
          work_date: new Date().toISOString().split('T')[0]
        })
      });
      if (response.ok) {
        if (form) form.reset();
        setIsLogHoursModalOpen(false);
        await refreshTicketData(selectedTicket);
      }
    } catch (err) {
      console.error(err);
      alert(err);

    } finally {
      setActionLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>, workerId: number) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setActionLoading(true);
    const formData = new FormData(e.currentTarget);
    const expense_type = formData.get('expense_type_id');
    const amount = formData.get('amount');
    const remarks = formData.get('remarks');
    const validFiles = (expenseFiles[workerId] || []).filter(f => f.size > 0);

    try {
      const payload: Record<string, any> = {
        ticket: selectedTicket.ticket_id,
        worker: workerId,
        expense_type: expense_type,
        amount: amount,
        remarks: remarks,
        expense_date: new Date().toISOString().split('T')[0]
      };

      const signal = uploadAbortRef.current?.signal;
      const response = await fetch(`${API_URL}/finance/expense/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal
      });

      if (response.ok) {
        const createdExpense = await response.json();

        if (validFiles.length > 0) {
          await Promise.all(
            validFiles.map(file => uploadMedia(file, 'Bills', workerId, createdExpense.expense_id, true))
          );
        }

        setExpenseFiles(prev => { const next = { ...prev }; delete next[workerId]; return next; });
        await refreshTicketData(selectedTicket);
        setIsAddExpenseModalOpen(false);
      } else {
        const err = await response.json();
        console.error('Failed to create expense', err);
        alert(JSON.stringify(err));
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddExpenseReceiptInEdit = async (file: File) => {
    if (!selectedTicket || !editingExpense) return;
    await uploadMedia(file, 'Bills', editingExpense.worker.user_id, editingExpense.expense_id);
  };

  const uploadMedia = async (file: File, categoryName: string, workerId?: number, expenseId?: number, skipRefresh = false): Promise<Media | null> => {
    if (!selectedTicket || !user) return null;
    if (!skipRefresh) setActionLoading(true);
    const signal = uploadAbortRef.current?.signal;
    try {
      const ticketDeptId = Number(selectedTicket.department?.department_id ?? selectedTicket.department);
      const cat = mediaCategories.find(c => {
        const isMatchName = c.category_name.toLowerCase() === categoryName.toLowerCase() ||
          (categoryName.toLowerCase() === 'bills' && (c.category_name.toLowerCase() === 'bills' || c.category_name.toLowerCase() === 'bill' || c.category_name.toLowerCase() === 'receipt'));
        if (!isMatchName) return false;
        const cDeptId = Number(c.department?.department_id ?? c.department);
        return !cDeptId || cDeptId === ticketDeptId;
      }) || mediaCategories.find(c => c.category_name.toLowerCase() === categoryName.toLowerCase());
      const formData = new FormData();
      formData.append('ticket', selectedTicket.ticket_id.toString());
      formData.append('file_url', file);
      formData.append('file_name', file.name);
      formData.append('uploaded_by', (workerId || user.user_id).toString());
      if (cat) formData.append('category', cat.category_id.toString());
      if (expenseId) formData.append('expense', expenseId.toString());

      const response = await fetch(`${API_URL}/common/media/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}` },
        body: formData,
        signal
      });
      if (response.ok) {
        const createdMedia = await response.json();
        if (!skipRefresh) await refreshTicketData(selectedTicket);
        return createdMedia;
      } else {
        const err = await response.json();
        console.error('Upload error', err);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error(err);
    } finally {
      if (!skipRefresh) setActionLoading(false);
    }
    return null;
  };

  const handleUploadIssueMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMedia(file, 'Before Repair');
    e.target.value = '';
  };

  const handleUploadCompletedMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMedia(file, 'After Repair');
    e.target.value = '';
  };

  const handleUpdateStatus = async (targetStatus: string | number | undefined, extra: Record<string, any> = {}) => {
    if (!selectedTicket || !targetStatus) return;

    let targetStatusId: number | undefined;

    if (typeof targetStatus === 'number') {
      targetStatusId = targetStatus;
    } else {
      const ticketDeptId = Number(selectedTicket.department?.department_id ?? selectedTicket.department);

      let match = statuses.find(s => {
        const sDeptId = Number(s.department?.department_id ?? s.department);
        return s.status_name?.toLowerCase() === targetStatus.toLowerCase() && (!sDeptId || sDeptId === ticketDeptId);
      }) || statuses.find(s => s.status_name?.toLowerCase() === targetStatus.toLowerCase());

      if (!match) {
        try {
          const res = await fetch(`${API_URL}/maintenance/status/`, {
            headers: { Authorization: `Token ${token}` }
          });
          if (res.ok) {
            const fetchedStatuses: any[] = await res.json();
            setStatuses(fetchedStatuses);
            match = fetchedStatuses.find((s: any) => {
              const sDeptId = Number(s.department?.department_id ?? s.department);
              return s.status_name?.toLowerCase() === targetStatus.toLowerCase() && (!sDeptId || sDeptId === ticketDeptId);
            }) || fetchedStatuses.find((s: any) => s.status_name?.toLowerCase() === targetStatus.toLowerCase());
          }
        } catch (err) {
          console.error('Failed to fetch status list', err);
        }
      }

      targetStatusId = match?.status_id;
    }

    if (!targetStatusId) {
      console.error(`Status ID not found for targetStatus:`, targetStatus);
      alert(`Error: Status '${targetStatus}' is not configured in the database.`);
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/maintenance/ticket/${selectedTicket.ticket_id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatusId, ...extra })
      });
      if (response.ok) {
        setShowRejectForm(false);
        await refreshTicketData(selectedTicket);
      } else {
        const err = await response.json();
        console.error('Failed to update status', err);
        alert('Failed to update ticket status: ' + JSON.stringify(err));
      }
    } catch (err) {
      console.error(err);
      alert('Network error while updating status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveToNextStatus = async () => {
    if (!selectedTicket) return;

    const ticketDeptId = Number(selectedTicket.department?.department_id ?? selectedTicket.department);

    let deptStatuses = statuses
      .filter(s => {
        const sDeptId = Number(s.department?.department_id ?? s.department);
        return !sDeptId || sDeptId === ticketDeptId;
      })
      .sort((a, b) => a.status_id - b.status_id);

    if (deptStatuses.length === 0) {
      try {
        const res = await fetch(`${API_URL}/maintenance/status/`, {
          headers: { Authorization: `Token ${token}` }
        });
        if (res.ok) {
          const raw: any[] = await res.json();
          setStatuses(raw);
          deptStatuses = raw
            .filter((s: any) => {
              const sDeptId = Number(s.department?.department_id ?? s.department);
              return !sDeptId || sDeptId === ticketDeptId;
            })
            .sort((a, b) => a.status_id - b.status_id);
        }
      } catch (err) {
        console.error('Failed to fetch statuses', err);
      }
    }

    const forwardStatuses = deptStatuses.filter(s => s.status_name?.toLowerCase() !== 'rejected');
    const currentIdx = forwardStatuses.findIndex(s => s.status_id === selectedTicket.status.status_id);

    let nextStatusObj: any = null;
    if (currentIdx !== -1 && currentIdx + 1 < forwardStatuses.length) {
      nextStatusObj = forwardStatuses[currentIdx + 1];
    } else {
      const allCurrentIdx = deptStatuses.findIndex(s => s.status_id === selectedTicket.status.status_id);
      if (allCurrentIdx !== -1 && allCurrentIdx + 1 < deptStatuses.length) {
        nextStatusObj = deptStatuses[allCurrentIdx + 1];
      }
    }

    if (!nextStatusObj) {
      alert('This ticket is already at the final status stage.');
      return;
    }

    // 2-step confirmation requirement before changing status to Completed
    if (nextStatusObj.status_name?.toLowerCase() === 'completed') {
      const confirm1 = window.confirm(
        'Confirmation 1 of 2:\nAre you sure you want to mark this ticket as COMPLETED?'
      );
      if (!confirm1) return;

      const confirm2 = window.confirm(
        'Confirmation 2 of 2 (Final):\nAre you ABSOLUTELY SURE you want to change ticket status to COMPLETED?'
      );
      if (!confirm2) return;
    }

    await handleUpdateStatus(nextStatusObj.status_id);
  };




  // ── Derived data ───────────────────────────────────────────────────────────




  const canViewStatus = (statusName) => {
    const permission = `can_view_${statusName
      .toLowerCase()
      .replace(/\s+/g, "_")}_ticket`;

    return hasPermission(permission);
  };

  const getAllowedStatusPermissions = (statuses) => {
    return statuses
      .map(st =>
        `can_view_${st.status_name
          .toLowerCase()
          .replace(/\s+/g, "_")}_ticket`
      )
      .filter(permission => hasPermission(permission));
  };


  const filteredTickets =
    tickets

  // .filter(t => {
  //   const statusName = (t.status?.status_name || '').toLowerCase();
  //   // if (statusName === 'open' && !canViewOpenTicket) return false;
  //   // if (statusName === 'reconciled' && !canViewReconciledTicket) return false;

  //   const matchesSearch =
  //     t.title.toLowerCase().includes(search.toLowerCase()) ||
  //     t.work_order_no.toLowerCase().includes(search.toLowerCase()) ||
  //     t.description.toLowerCase().includes(search.toLowerCase());
  //   const matchesStore = filterStore ? t.store.store_id === filterStore : true;
  //   const matchesDept = filterDept ? t.department.department_id === Number(filterDept) : true;
  //   const matchesStatus = filterStatus ? t.status.status_name === filterStatus : true;
  //   return matchesSearch && matchesStore && matchesDept && matchesStatus;
  // });

  const ticketDeptId = Number(selectedTicket?.department?.department_id ?? selectedTicket?.department);

  const hasIssueCategoryForDept = mediaCategories.some(cat => {
    const isIssue = cat.category_name === 'Before Repair' || cat.category_name?.toLowerCase().includes('issue');
    if (!isIssue) return false;
    const catDeptId = Number(cat.department?.department_id ?? cat.department);
    return !catDeptId || catDeptId === ticketDeptId;
  });

  const issueMedia = mediaList.filter(m => {
    if (!m.category) return false;
    const isIssueCategory = m.category.category_name === 'Before Repair' || m.category.category_name?.toLowerCase().includes('issue');
    if (!isIssueCategory) return false;
    const catDeptId = Number(m.category.department?.department_id ?? m.category.department);
    return !catDeptId || catDeptId === ticketDeptId;
  });
  const completionCategoryNames = ['After Repair'];

  const hasCompletedCategoryForDept = mediaCategories.some(cat => {
    const isCompletionCat = completionCategoryNames.some(cName => cat.category_name?.toLowerCase() === cName.toLowerCase());
    if (!isCompletionCat) return false;
    const catDeptId = Number(cat.department?.department_id ?? cat.department);
    return !catDeptId || catDeptId === ticketDeptId;
  });

  const completedMedia = mediaList.filter(m => {
    if (!m.category) return false;
    const isCompletionCat = completionCategoryNames.some(cName => m.category?.category_name?.toLowerCase() === cName.toLowerCase());
    if (!isCompletionCat) return false;
    const catDeptId = Number(m.category.department?.department_id ?? m.category.department);
    return !catDeptId || catDeptId === ticketDeptId;
  });

  const hasBillsCategoryForDept = mediaCategories.some(cat => {
    const isBills = cat.category_name?.toLowerCase() === 'bills' || cat.category_name?.toLowerCase() === 'bill';
    if (!isBills) return false;
    const catDeptId = Number(cat.department?.department_id ?? cat.department);
    return !catDeptId || catDeptId === ticketDeptId;
  });


  const statusColor = (s: string) => {
    switch (s) {
      case 'Open': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'Approved': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'In Progress': return 'bg-primary/10 text-primary';
      case 'Completed': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
      case 'Rejected': return 'bg-red-500/10 text-red-600 dark:text-red-400';
      default: return 'bg-outline/10 text-outline';
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toast Messages */}
      {message && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${message.type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
          : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'}`}>
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm font-semibold">{message.text}</span>
        </div>
      )}

      {subpage === 'create' ? (
        /* ── Create Ticket Form ─────────────────────────────────────────── */
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container dark:bg-dark-surface-container p-6 rounded-2xl border border-outline-variant dark:border-dark-outline-variant"
        >
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-primary" />
            <h3 className="text-lg font-bold text-on-surface dark:text-dark-on-surface">Raise Support Ticket</h3>
          </div>

          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant mb-1.5">Store</label>
                <select required value={createForm.store_id}
                  onChange={e => setCreateForm({ ...createForm, store_id: e.target.value })}
                  className="w-full text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary transition-all text-on-surface dark:text-dark-on-surface">
                  <option value="">Select Store</option>
                  {stores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant mb-1.5">Department</label>
                <select required
                  disabled={!canCreateAllDepts}
                  value={createForm.department_id}
                  onChange={e => setCreateForm({ ...createForm, department_id: e.target.value, nature_id: '' })}
                  className="w-full text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary transition-all text-on-surface dark:text-dark-on-surface disabled:opacity-60 disabled:cursor-not-allowed">

                  <Can permission={"maintenance.create_ticket_all_departments"}><option value="">Select Department</option></Can>
                  {availableDepartments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                </select>
              </div>
            </div>

            {Boolean(createForm.department_id) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant mb-1.5">Nature of Work</label>
                  <select required value={createForm.nature_id}
                    onChange={e => setCreateForm({ ...createForm, nature_id: e.target.value })}
                    className="w-full text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary transition-all text-on-surface dark:text-dark-on-surface">
                    <option value="">Select Nature of Work</option>
                    {natures
                      .filter(n => {
                        const nDeptId = Number(n.sub_department?.department?.department_id ?? n.sub_department?.department ?? n.department);
                        return !nDeptId || nDeptId === Number(createForm.department_id);
                      })
                      .map(n => <option key={n.nature_id} value={n.nature_id}>{n.nature_name}</option>)}
                  </select>
                </div>

              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant mb-1.5">Issue Summary / Title</label>
              <input required type="text" placeholder="e.g. AC compressor failure in aisle 4"
                value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                className="w-full text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary transition-all text-on-surface dark:text-dark-on-surface" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant mb-1.5">Detailed Description</label>
              <textarea required rows={4} placeholder="Provide detailed description of the issue..."
                value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                className="w-full text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary transition-all text-on-surface dark:text-dark-on-surface" />
            </div>
            {(() => {
              const selNature = natures.find(n => Number(n.nature_id) === Number(createForm.nature_id));
              return selNature ? (selNature.media_required !== false) : true;
            })() && (
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant mb-1.5">
                    Attach Issue Media (Before Repair) - <span className="text-red-500 font-bold">Minimum 2 Files Required *</span>
                  </label>
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDraggingMedia(true); }}
                    onDragLeave={e => { e.preventDefault(); setIsDraggingMedia(false); }}
                    onDrop={e => {
                      e.preventDefault();
                      setIsDraggingMedia(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const newFiles = Array.from(e.dataTransfer.files);
                        setCreateTicketFiles(prev => [...prev, ...newFiles]);
                      }
                    }}
                    onClick={() => document.getElementById('ticket-create-media-input')?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${isDraggingMedia
                      ? 'border-primary bg-primary/10 dark:bg-primary/20'
                      : 'border-outline-variant dark:border-dark-outline-variant hover:border-primary/50 bg-surface dark:bg-dark-surface'
                      }`}
                  >
                    <input
                      id="ticket-create-media-input"
                      type="file"
                      multiple
                      accept="image/*,video/*,.pdf"
                      className="hidden"
                      onChange={e => {
                        if (e.target.files && e.target.files.length > 0) {
                          const newFiles = Array.from(e.target.files);
                          setCreateTicketFiles(prev => [...prev, ...newFiles]);
                          e.target.value = '';
                        }
                      }}
                    />
                    <Camera className="w-6 h-6 text-primary mx-auto mb-1 opacity-80" />
                    <p className="text-xs font-semibold text-on-surface dark:text-dark-on-surface">
                      Drag & drop issue files here, or <span className="text-primary underline">click to browse</span>
                    </p>
                    <p className="text-[10px] text-outline mt-0.5">Photos, videos, or PDF documents (Minimum 2 required)</p>
                  </div>

                  {/* Selected Media Preview Grid */}
                  {createTicketFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Selected Media ({createTicketFiles.length} file{createTicketFiles.length > 1 ? 's' : ''}):
                        </p>
                        {createTicketFiles.length < 2 && (
                          <span className="text-[11px] font-semibold text-amber-500">
                            (Need {2 - createTicketFiles.length} more file)
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {createTicketPreviews.map(({ file, isImg, isVid, url }, idx) => {
                          return (
                            <div key={idx} className="relative group bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-xl p-1.5 flex flex-col items-center">
                              {/* Delete button overlay */}
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setCreateTicketFiles(prev => prev.filter((_, i) => i !== idx));
                                }}
                                className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-md cursor-pointer transition-transform hover:scale-110 z-10"
                                title="Remove file"
                              >
                                <X className="w-3 h-3" />
                              </button>

                              {/* Thumbnail preview */}
                              <div className="w-full h-20 bg-surface-container dark:bg-dark-surface-container rounded-lg overflow-hidden flex items-center justify-center border border-outline-variant dark:border-dark-outline-variant">
                                {isImg && url ? (
                                  <img src={url} alt={file.name} className="w-full h-full object-cover" />
                                ) : isVid && url ? (
                                  <video src={url} className="w-full h-full object-cover" />
                                ) : (
                                  <FileText className="w-8 h-8 text-primary opacity-80" />
                                )}
                              </div>

                              {/* File detail info */}
                              <div className="w-full mt-1.5 px-0.5 text-center">
                                <p className="text-[11px] font-semibold text-on-surface dark:text-dark-on-surface truncate" title={file.name}>
                                  {file.name}
                                </p>
                                <p className="text-[9px] text-outline">
                                  {(file.size / 1024).toFixed(0)} KB
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

            <div className="flex justify-end pt-3">
              <button type="submit" disabled={actionLoading}
                className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 cursor-pointer disabled:opacity-50">
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Ticket
              </button>
            </div>
          </form>
        </motion.div>
      ) : (
        /* ── Ticket List ──────────────────────────────────────────────────── */
        <>
          {/* Header Controls */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input type="text" placeholder="Search work order no, title..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full text-sm bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select value={filterStore} onChange={e => setFilterStore(e.target.value)}
                className="text-xs bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl p-2.5 outline-none text-on-surface dark:text-dark-on-surface">
                <option value="">All Stores</option>
                {stores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
              </select>

              <Can permission={'maintenance.create_ticket_all_departments'}>

                <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                  disabled={!canCreateAllDepts}
                  className="text-xs bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl p-2.5 outline-none text-on-surface dark:text-dark-on-surface disabled:opacity-60 disabled:cursor-not-allowed">
                  {canCreateAllDepts && <option value="">All Departments</option>}
                  {availableDepartments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                </select>

              </Can>
              <Can permission={getAllowedStatusPermissions(statuses) || []}>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="text-xs bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl p-2.5 outline-none text-on-surface dark:text-dark-on-surface"
                >
                  <option value="">All Statuses</option>

                  {statuses
                    .filter(st => canViewStatus(st.status_name || ""))
                    .map(st => (
                      <option key={st.status_id} value={st.status_name}>
                        {st.status_name}
                      </option>
                    ))}


                </select>

              </Can>


              <Can permission={['maintenance.create_ticket', 'maintenance.add_ticket']} >

                <button onClick={() => navigate('/tickets/create')}
                  className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-primary/95 transition-all cursor-pointer shadow-sm">
                  <Plus className="w-4 h-4" />
                  Raise Ticket
                </button>
              </Can>
              {/* )} */}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 w-full bg-surface-container-high dark:bg-dark-surface-container-low animate-pulse rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-high dark:bg-dark-surface-container-high border-b border-outline-variant dark:border-dark-outline-variant text-[10px] uppercase font-bold text-outline tracking-wider">
                      <th className="px-6 py-4">Work Order No</th>
                      <th className="px-6 py-4">Store</th>
                      <th className="px-6 py-4">Title</th>
                      <th className="px-6 py-4">Priority</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Created</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant dark:divide-dark-outline-variant text-sm">
                    {filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-sm text-outline">No tickets found.</td>
                      </tr>
                    ) : filteredTickets.map(t => (
                      <tr key={t.ticket_id} className="hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low transition-all">
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{t.work_order_no}</td>
                        <td className="px-6 py-4 text-sm">{t.store.store_name}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{t.title}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${t.priority.level >= 2
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                            {t.priority.priority_name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusColor(t.status.status_name)}`}>
                            {t.status.status_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-outline">{new Date(t.created_date).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleSelectTicket(t)}
                            className="inline-flex items-center gap-1 bg-surface-container-high dark:bg-dark-surface-container-high text-xs font-semibold px-3 py-1.5 rounded-lg border border-outline-variant dark:border-dark-outline-variant text-on-surface-variant dark:text-dark-on-surface-variant hover:text-primary transition-all cursor-pointer">
                            <Eye className="w-3.5 h-3.5" />
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Ticket Detail Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }}
              onClick={() => closeModal()}
              className="absolute inset-0 bg-black"
            />

            {/* Modal Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl scrollbar-thin"
            >
              {/* Sticky header bar */}
              <div className="sticky top-0 z-10 bg-surface-container dark:bg-dark-surface-container border-b border-outline-variant dark:border-dark-outline-variant px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-outline shrink-0">{selectedTicket.work_order_no}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColor(selectedTicket.status.status_name)}`}>
                    {selectedTicket.status.status_name}
                  </span>
                  <span className="text-sm font-bold text-on-surface dark:text-dark-on-surface truncate">{selectedTicket.title}</span>
                </div>
                <button onClick={() => closeModal()}
                  className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high cursor-pointer shrink-0 ml-2">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Loading overlay */}
              {modalLoading && (
                <div className="absolute inset-0 z-20 bg-surface-container/80 dark:bg-dark-surface-container/80 flex items-center justify-center rounded-2xl">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}

              <div className="p-6 space-y-6">

                {/* Creator card */}
                <div className="flex items-start gap-4 p-4 bg-surface dark:bg-dark-surface rounded-2xl border border-outline-variant dark:border-dark-outline-variant">
                  <AvatarCircle user={selectedTicket.created_by} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base text-on-surface dark:text-dark-on-surface">{selectedTicket.created_by.full_name}</p>
                    {selectedTicket.created_by.role && (
                      <p className="text-xs text-primary font-semibold mt-0.5">{selectedTicket.created_by.role.role_name}</p>
                    )}
                    {selectedTicket.created_by.employee_no && (
                      <p className="text-xs text-outline mt-0.5">ID: {selectedTicket.created_by.employee_no}</p>
                    )}
                    <p className="text-xs text-outline mt-1">
                      Raised on {new Date(selectedTicket.created_date).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end shrink-0">
                    <div className="flex items-center gap-1.5 text-[10px] text-outline">
                      <Building2 className="w-3 h-3" />
                      <span>{selectedTicket.store.store_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-outline">
                      <Wrench className="w-3 h-3" />
                      <span>{selectedTicket.department.department_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-outline">
                      <AlertCircle className="w-3 h-3" />
                      <span>{selectedTicket.nature.nature_name}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedTicket.priority.level >= 2
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                      {selectedTicket.priority.priority_name} Priority
                    </span>
                  </div>
                </div>

                {/* Approved / Rejected by info */}
                {(selectedTicket.approved_by || selectedTicket.rejected_by) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedTicket.approved_by && (
                      <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                        <AvatarCircle user={selectedTicket.approved_by} size="sm" />
                        <div>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Approved by</p>
                          <p className="text-xs font-semibold text-on-surface dark:text-dark-on-surface">{selectedTicket.approved_by.full_name}</p>
                          {selectedTicket.approved_date && (
                            <p className="text-[10px] text-outline">{new Date(selectedTicket.approved_date).toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedTicket.rejected_by && (
                      <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                        <AvatarCircle user={selectedTicket.rejected_by} size="sm" />
                        <div>
                          <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">Rejected by</p>
                          <p className="text-xs font-semibold text-on-surface dark:text-dark-on-surface">{selectedTicket.rejected_by.full_name}</p>
                          {selectedTicket.reject_reason && (
                            <p className="text-[10px] text-outline mt-0.5 italic">"{selectedTicket.reject_reason}"</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Status action bar */}
                <div className="p-3 bg-surface dark:bg-dark-surface-container-low rounded-xl border border-outline-variant dark:border-dark-outline-variant flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-outline mr-1">Status:</span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${statusColor(selectedTicket.status.status_name)}`}>
                    {selectedTicket.status.status_name}
                  </span>
                  <div className="flex-1" />
                  {selectedTicket.status.status_name === 'Open' &&

                    <Can permission={['maintenance.can_move_open_to_rejected', 'maintenance.can_move_open_to_in_progress']}>

                      <button onClick={() => handleMoveToNextStatus()}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1 disabled:opacity-50">
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve
                      </button>
                      <button onClick={() => setShowRejectForm(true)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50">
                        Reject
                      </button>
                    </Can>

                  }
                  {selectedTicket.status.status_name === 'Approved' && (
                    <button onClick={() => handleMoveToNextStatus()}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1 disabled:opacity-50">
                      {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />} Start Progress
                    </button>
                  )}
                  {selectedTicket.status.status_name === 'In Progress' &&

                    <Can permission='maintenance.can_move_in_progress_to_completed'>
                      <button onClick={() => handleMoveToNextStatus()}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1 disabled:opacity-50">
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Mark Completed
                      </button>
                    </Can>
                  }
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-outline ml-1" />}
                </div>

                {/* Reject form */}
                {showRejectForm && (
                  <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-red-600 dark:text-red-400">Rejection Reason</h4>
                    <textarea rows={2}
                      className="w-full text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant p-2 rounded outline-none"
                      placeholder="Enter reason for rejection..."
                      value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowRejectForm(false)} disabled={actionLoading} className="px-3 py-1 text-xs border border-outline-variant rounded cursor-pointer disabled:opacity-50">Cancel</button>
                      <button onClick={() => handleUpdateStatus('Rejected', { reject_reason: rejectReason })}
                        disabled={actionLoading}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded cursor-pointer flex items-center gap-1 disabled:opacity-50">
                        {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />} Confirm Reject
                      </button>
                    </div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <h4 className="text-xs font-bold text-outline uppercase tracking-wider mb-1.5">Issue Description</h4>
                  <p className="text-sm text-on-surface dark:text-dark-on-surface leading-relaxed p-4 bg-surface dark:bg-dark-surface rounded-xl border border-outline-variant dark:border-dark-outline-variant whitespace-pre-wrap">
                    {selectedTicket.description}
                  </p>
                </div>

                {/* Before Repair - Only shown if department has Before Repair or issue category available */}
                {(issueMedia.length > 0 || hasIssueCategoryForDept) && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <SectionTitle icon={<Image className="w-4 h-4" />} label="Before Repair" />

                        {selectedTicket.status.status_name !== 'Rejected' &&
                          <Can permission={'maintenance.update_before_repair'}>
                            <button
                              type="button"
                              onClick={() => setIsManageIssueMediaOpen(true)}
                              className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-all cursor-pointer bg-primary/10 px-3 py-1.5 rounded-lg"
                            >
                              <Settings className="w-3.5 h-3.5" />
                              Manage Media
                            </button>
                          </Can>
                        }

                      </div>
                      <MediaGrid
                        items={issueMedia}
                        emptyLabel="No Before Repair uploaded yet"
                      />
                    </div>

                    <Divider />
                  </>
                )}

                {/* Allocated Persons Section (Tabbed View) - Only shown if ticket is Approved */}
                {Boolean(
                  selectedTicket.approved_by ||
                  (selectedTicket.status.status_name.toLowerCase() !== 'open' && selectedTicket.status.status_name.toLowerCase() !== 'rejected')
                ) && (
                    <div>
                      <SectionTitle icon={<User className="w-4 h-4" />} label="Allocated Persons" />

                      {/* Horizontal Tabs Header Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-outline-variant dark:border-dark-outline-variant mb-4 pb-2 gap-3">
                        {allocations.length > 0 ? (
                          <div className="flex gap-2 overflow-x-auto pb-1 max-w-full scrollbar-thin">
                            {allocations.map(a => {
                              const isActive = a.worker.user_id === activeWorkerId;
                              return (
                                <button
                                  key={a.allocation_id}
                                  type="button"
                                  onClick={() => setActiveWorkerId(a.worker.user_id)}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border cursor-pointer transition-all ${isActive
                                    ? 'bg-primary/10 border-primary text-primary'
                                    : 'bg-surface dark:bg-dark-surface border-outline-variant dark:border-dark-outline-variant text-outline hover:text-on-surface hover:border-outline'
                                    }`}
                                >
                                  <AvatarCircle user={a.worker} size="sm" />
                                  <span>{a.worker.full_name}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-outline italic">No workers allocated yet.</p>
                        )}

                        <Can permission={'maintenance.add_allocation'}>
                          <button
                            type="button"
                            onClick={() => setIsAssignModalOpen(true)}
                            className="flex items-center justify-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-primary/95 transition-all cursor-pointer shadow-sm shrink-0"
                          >
                            <Plus className="w-4 h-4" />
                            Assign Worker
                          </button>
                        </Can>

                      </div>

                      {/* Selected Worker Panel */}
                      {(() => {
                        const a = allocations.find(alloc => alloc.worker.user_id === activeWorkerId);
                        if (!a) return null;

                        const workerLogs = workLogs.filter(wl => wl.worker?.user_id === a.worker.user_id);
                        const workerExpenses = expenses.filter(exp => exp.worker?.user_id === a.worker.user_id);

                        const totalHours = workerLogs.reduce((s, wl) => s + parseFloat(wl.hours || '0'), 0);
                        const totalLabour = workerLogs.reduce((s, wl) => s + parseFloat(wl.labour_amount || '0'), 0);
                        const totalExpenses = workerExpenses.reduce((s, e) => s + parseFloat(e.amount || '0'), 0);

                        const isMyWorker = (user as any)?.user_id === a.worker.user_id;


                        return (
                          <div className="bg-surface dark:bg-dark-surface rounded-2xl border border-outline-variant dark:border-dark-outline-variant overflow-hidden">

                            {/* Selected Worker Stats bar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-outline-variant dark:border-dark-outline-variant">
                              <div className="flex items-center gap-3">
                                <AvatarCircle user={a.worker} size="md" />
                                <div>
                                  <p className="font-bold text-sm text-on-surface dark:text-dark-on-surface">{a.worker.full_name}</p>
                                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-outline">
                                    {a.worker.role && <span>{a.worker.role.role_name}</span>}
                                    {a.worker.employee_no && <span>· ID: {a.worker.employee_no}</span>}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-1 rounded-lg">
                                  {a.planned_hours}h Planned
                                </span>
                                {workerLogs.length > 0 && (
                                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-1 rounded-lg">
                                    {totalHours}h Logged ({totalLabour.toFixed(2)} KWD)
                                  </span>
                                )}
                                {workerExpenses.length > 0 && (
                                  <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-2 py-1 rounded-lg">
                                    {totalExpenses.toFixed(2)} KWD Expenses
                                  </span>
                                )}
                                <div className="flex items-center gap-1 ml-2">


                                  <Can permission='maintenance.change_allocation'>
                                    <button type="button" onClick={() => {
                                      setEditingAllocation(a);
                                      setEditAllocationForm({ planned_hours: a.planned_hours, remarks: a.remarks || '' });
                                    }} className="p-1.5 rounded-lg border border-outline-variant dark:border-dark-outline-variant hover:text-primary hover:bg-surface-container-high cursor-pointer transition-colors" title="Edit Allocation">
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  </Can>


                                </div>
                              </div>
                            </div>

                            {/* Content columns for active worker */}
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-outline-variant dark:divide-dark-outline-variant">

                              {/* Left Column: Work Logs */}
                              <div className="p-4 space-y-4 bg-surface-container dark:bg-dark-surface-container">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-bold text-outline uppercase tracking-wider flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" /> Work Hours Log
                                  </p>

                                  <Can permission={isMyWorker ? 'maintenance.can_change_my_log_time' : 'maintenance.can_change_others_log_time'}>

                                    <button
                                      type="button"
                                      onClick={() => setIsLogHoursModalOpen(true)}
                                      className="flex items-center gap-1 px-2.5 py-1.5 border border-primary text-primary text-[10px] font-bold rounded-lg hover:bg-primary/5 cursor-pointer transition-all shrink-0"
                                    >
                                      <Plus className="w-3.5 h-3.5" /> Log Hours
                                    </button>
                                  </Can>

                                </div>

                                {workerLogs.length === 0 ? (
                                  <p className="text-xs text-outline italic py-2">No hours logged yet.</p>
                                ) : (
                                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {workerLogs.map(wl => {
                                      return (
                                        <div key={wl.worklog_id} className="flex items-start justify-between text-xs p-3 bg-surface dark:bg-dark-surface rounded-xl border border-outline-variant/50">
                                          <div>
                                            <p className="font-medium text-on-surface dark:text-dark-on-surface leading-snug">{wl.work_done}</p>
                                            <p className="text-[10px] text-outline mt-0.5">{new Date(wl.work_date).toLocaleDateString()}</p>
                                          </div>
                                          <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-1.5">
                                              <span className="font-bold text-primary">{wl.hours}h</span>


                                              <Can permission={isMyWorker ? 'maintenance.can_change_my_log_time' : 'maintenance.can_change_others_log_time'}>

                                                <button type="button" onClick={() => {
                                                  setEditingWorkLog(wl);
                                                  setEditWorkLogForm({ hours: wl.hours, work_done: wl.work_done });
                                                }} className="p-1 rounded text-outline hover:text-primary transition-colors cursor-pointer" title="Edit Log">
                                                  <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                              </Can>

                                            </div>
                                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{wl.labour_amount} KWD</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              <div className="p-4 space-y-4 bg-surface-container-low dark:bg-dark-surface-container-low">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-bold text-outline uppercase tracking-wider flex items-center gap-1">
                                    <DollarSign className="w-3.5 h-3.5" /> Logged Expenses
                                  </p>


                                  <Can permission={isMyWorker ? 'maintenance.change_my_expence' : 'accounts.change_others_expence'}>
                                    <button
                                      type="button"
                                      onClick={() => setIsAddExpenseModalOpen(true)}
                                      className="flex items-center gap-1 px-2.5 py-1.5 border border-primary text-primary text-[10px] font-bold rounded-lg hover:bg-primary/5 cursor-pointer transition-all shrink-0"
                                    >
                                      <Plus className="w-3.5 h-3.5" /> Add Expense
                                    </button>
                                  </Can>

                                </div>

                                {workerExpenses.length === 0 ? (
                                  <p className="text-xs text-outline italic py-2">No expenses logged yet.</p>
                                ) : (
                                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                                    {workerExpenses.map(exp => {
                                      return (
                                        <div key={exp.expense_id} className="text-xs p-3 bg-surface dark:bg-dark-surface rounded-xl border border-outline-variant/50">
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                              <p className="font-semibold text-on-surface dark:text-dark-on-surface">
                                                {exp.expense_type.expense_name}
                                              </p>
                                              {exp.remarks && <p className="text-outline mt-0.5 italic">{exp.remarks}</p>}
                                              <p className="text-[10px] text-outline mt-0.5">{new Date(exp.expense_date).toLocaleDateString()}</p>
                                            </div>
                                            <div className="shrink-0 flex flex-col items-end gap-1">
                                              <span className="font-bold text-emerald-600 dark:text-emerald-400">{exp.amount} KWD</span>
                                              {exp.approved && <span className="text-[9px] text-emerald-500 font-semibold">✓ Approved</span>}

                                              <Can permission={isMyWorker ? 'maintenance.change_my_expence' : 'accounts.change_others_expence'}>
                                                <button type="button" onClick={() => {
                                                  setEditingExpense(exp);
                                                  setEditExpenseForm({
                                                    amount: exp.amount,
                                                    remarks: exp.remarks || '',
                                                    expense_type_id: exp.expense_type.expense_type_id.toString()
                                                  });
                                                }} className="p-1.5 rounded-lg text-outline hover:text-primary transition-colors cursor-pointer mt-1">
                                                  <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                              </Can>

                                            </div>
                                          </div>

                                          {/* Receipts list (Main visual display only - no edits inside main view) */}
                                          {(() => {
                                            const receiptsList: Media[] = [];
                                            if (exp.receipt) receiptsList.push(exp.receipt);
                                            if (exp.receipts) {
                                              exp.receipts.forEach(r => {
                                                if (!receiptsList.some(existing => existing.media_id === r.media_id)) {
                                                  receiptsList.push(r);
                                                }
                                              });
                                            }
                                            if (receiptsList.length === 0) return null;
                                            return (
                                              <div className="mt-2.5 pt-2 border-t border-outline-variant/30 space-y-2">
                                                {receiptsList.map(r => (
                                                  <div key={r.media_id} className="flex items-center gap-2 p-1.5 bg-surface-container dark:bg-dark-surface-container rounded-lg border border-outline-variant/40 min-w-0">
                                                    <a href={getMediaUrl(r.file_url)} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                                      {isImage(r.file_name) ? (
                                                        <img src={getMediaUrl(r.file_url)} alt={r.file_name} className="w-8 h-8 object-cover rounded" />
                                                      ) : (
                                                        <div className="w-8 h-8 flex items-center justify-center bg-surface-container dark:bg-dark-surface-container rounded">
                                                          <FileText className="w-4 h-4 text-outline" />
                                                        </div>
                                                      )}
                                                    </a>
                                                    <div className="min-w-0 flex-1 text-[10px]">
                                                      <p className="text-on-surface dark:text-dark-on-surface truncate font-semibold">{r.file_name}</p>
                                                      <p className="text-[9px] text-outline">Receipt Attachment</p>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                            </div>

                            {/* Assigned by Footer */}
                            <div className="px-4 py-2 border-t border-outline-variant dark:border-dark-outline-variant text-[10px] text-outline bg-surface-container-low dark:bg-dark-surface-container-low">
                              Assigned by <span className="font-semibold text-on-surface dark:text-dark-on-surface">{a.assigned_by?.full_name}</span>
                              {a.remarks ? ` · ${a.remarks}` : ''}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                {/* After Repair - Only shown if ticket is Approved */}
                {Boolean(
                  selectedTicket.approved_by ||
                  (selectedTicket.status.status_name.toLowerCase() !== 'open' && selectedTicket.status.status_name.toLowerCase() !== 'rejected')
                ) && (completedMedia.length > 0 || hasCompletedCategoryForDept) && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <SectionTitle icon={<CheckCircle2 className="w-4 h-4" />} label="After Repair" />

                        <Can permission='maintenance.update_after_repair'>
                          <button
                            type="button"
                            onClick={() => setIsManageCompletedMediaOpen(true)}
                            className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-all cursor-pointer bg-primary/10 px-3 py-1.5 rounded-lg"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            Manage Media
                          </button>
                        </Can>

                      </div>
                      <MediaGrid
                        items={completedMedia}
                        emptyLabel="No completion media uploaded yet"
                      />
                    </div>
                  )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAssignModalOpen && selectedTicket && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }}
              onClick={() => setIsAssignModalOpen(false)}
              className="absolute inset-0 bg-black"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-6 rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Assign Worker</h3>
                <button onClick={() => setIsAssignModalOpen(false)} className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddAllocation} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Select Worker</label>
                  <select required value={newAllocation.worker_id}
                    disabled={actionLoading}
                    onChange={e => setNewAllocation({ ...newAllocation, worker_id: e.target.value })}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface">
                    <option value="">Select Worker to Assign</option>
                    {(() => {
                      const ticketDeptId = Number(selectedTicket.department?.department_id ?? selectedTicket.department);
                      const allocatedIds = new Set(allocations.map(a => a.worker.user_id));

                      const skilledList = natureWorkers
                        .filter((nw: any) => nw.worker && !allocatedIds.has(nw.worker.user_id) && isWorkerInDepartment(nw.worker, ticketDeptId))
                        .map((nw: any) => nw.worker);
                      const skilledMap = new Map(skilledList.map((w: any) => [w.user_id, w]));
                      const uniqueSkilledList = Array.from(skilledMap.values());
                      const skilledIds = new Set(uniqueSkilledList.map((w: any) => w.user_id));

                      const otherList = workers.filter(w => {
                        if (skilledIds.has(w.user_id) || allocatedIds.has(w.user_id)) return false;
                        return isWorkerInDepartment(w, ticketDeptId);
                      });

                      return (
                        <>
                          {uniqueSkilledList.length > 0 && (
                            <optgroup label={`⭐ Skilled — ${selectedTicket.nature.nature_name}`}>
                              {uniqueSkilledList.map((w: any) => (
                                <option key={w.user_id} value={w.user_id}>{w.full_name}</option>
                              ))}
                            </optgroup>
                          )}
                          {otherList.length > 0 && (
                            <optgroup label="Other Workers in Department">
                              {otherList.map(w => (
                                <option key={w.user_id} value={w.user_id}>{w.full_name}</option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-outline mb-1.5">Planned Hours</label>
                    <input type="number" step="0.5" min="0.5" required value={newAllocation.planned_hours}
                      disabled={actionLoading}
                      onChange={e => setNewAllocation({ ...newAllocation, planned_hours: e.target.value })}
                      className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      placeholder="Planned hours" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-outline mb-1.5">Assignment Remarks</label>
                    <input type="text" value={newAllocation.remarks}
                      disabled={actionLoading}
                      onChange={e => setNewAllocation({ ...newAllocation, remarks: e.target.value })}
                      className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      placeholder="Assignment instructions (optional)" />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Assign Worker
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SUB-MODAL 2: LOG WORK HOURS ──────────────────────────────────────── */}
      <AnimatePresence>
        {isLogHoursModalOpen && activeWorkerId && selectedTicket && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }}
              onClick={() => setIsLogHoursModalOpen(false)}
              className="absolute inset-0 bg-black"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-6 rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Log Work Hours</h3>
                <button onClick={() => setIsLogHoursModalOpen(false)} className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-outline mb-4">
                Logging hours for:{' '}
                <span className="font-bold text-on-surface dark:text-dark-on-surface">
                  {allocations.find(a => a.worker.user_id === activeWorkerId)?.worker.full_name}
                </span>
              </p>

              <form onSubmit={e => handleAddWorkLog(e, activeWorkerId)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Hours Worked</label>
                  <input required name="hours" type="number" step="0.5" min="0.5" placeholder="e.g. 3.5"
                    disabled={actionLoading}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Work Description</label>
                  <textarea required name="work_done" rows={3} placeholder="Describe the tasks completed..."
                    disabled={actionLoading}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface" />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsLogHoursModalOpen(false)} className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Submit Log
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SUB-MODAL 3: ADD EXPENSE ─────────────────────────────────────────── */}
      <AnimatePresence>
        {isAddExpenseModalOpen && activeWorkerId && selectedTicket && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }}
              onClick={() => setIsAddExpenseModalOpen(false)}
              className="absolute inset-0 bg-black"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-6 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] scrollbar-thin"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Add Expense</h3>
                <button onClick={() => setIsAddExpenseModalOpen(false)} className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-outline mb-4">
                Adding expense for:{' '}
                <span className="font-bold text-on-surface dark:text-dark-on-surface">
                  {allocations.find(a => a.worker.user_id === activeWorkerId)?.worker.full_name}
                </span>
              </p>

              <form onSubmit={e => handleAddExpense(e, activeWorkerId)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Expense Category</label>
                  <select required name="expense_type_id" disabled={actionLoading}
                    value={selectedExpenseTypeId}
                    onChange={e => setSelectedExpenseTypeId(e.target.value)}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface">
                    <option value="">Select Expense Type</option>
                    {expenseTypes
                      .filter(et => (et.department?.department_id ?? et.department) === selectedTicket.department.department_id)
                      .map(et => (
                        <option key={et.expense_type_id} value={et.expense_type_id}>
                          {et.expense_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Amount (KWD)</label>
                  <input required name="amount" type="number" step="0.01" min="0" placeholder="0.00" disabled={actionLoading}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface" />
                </div>

                {(() => {
                  const selectedExpTypeObj = expenseTypes.find(et => String(et.expense_type_id) === String(selectedExpenseTypeId));
                  const isReceiptRequiredForType = selectedExpTypeObj ? selectedExpTypeObj.required !== false : true;
                  const showReceiptUploadInAdd = hasBillsCategoryForDept && isReceiptRequiredForType;

                  if (!showReceiptUploadInAdd) return null;

                  return (
                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1.5">Receipt Files</label>
                      <div
                        className={`relative border-2 border-dashed border-outline-variant dark:border-dark-outline-variant rounded-xl p-4 text-center hover:border-primary transition-all cursor-pointer ${actionLoading ? 'pointer-events-none opacity-50' : ''}`}
                        onClick={() => !actionLoading && document.getElementById(`receipt-input-modal-${activeWorkerId}`)?.click()}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
                        onDragLeave={e => e.currentTarget.classList.remove('border-primary')}
                        onDrop={e => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-primary');
                          const dropped = Array.from(e.dataTransfer.files).filter(f =>
                            f.type.startsWith('image/') || f.type === 'application/pdf'
                          );
                          if (dropped.length) setExpenseFiles(prev => ({
                            ...prev,
                            [activeWorkerId]: [...(prev[activeWorkerId] || []), ...dropped]
                          }));
                        }}
                      >
                        <input
                          id={`receipt-input-modal-${activeWorkerId}`}
                          type="file"
                          accept="image/*,application/pdf"
                          multiple
                          disabled={actionLoading}
                          className="sr-only"
                          onChange={e => {
                            const picked = Array.from(e.target.files || []);
                            if (picked.length) setExpenseFiles(prev => ({
                              ...prev,
                              [activeWorkerId]: [...(prev[activeWorkerId] || []), ...picked]
                            }));
                            e.target.value = '';
                          }}
                        />
                        <p className="text-xs text-outline">📎 Click or drag receipts (images / PDFs)</p>
                      </div>

                      {/* Attachment chips */}
                      {(expenseFiles[activeWorkerId] || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(expenseFiles[activeWorkerId] || []).map((f, idx) => (
                            <div key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-medium">
                              <span className="truncate max-w-[120px]">{f.name}</span>
                              <button type="button" disabled={actionLoading}
                                onClick={() => setExpenseFiles(prev => ({
                                  ...prev,
                                  [activeWorkerId]: prev[activeWorkerId].filter((_, i) => i !== idx)
                                }))}
                                className="text-primary/60 hover:text-red-500 transition-colors cursor-pointer leading-none">✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Remarks</label>
                  <input name="remarks" type="text" placeholder="Remarks (optional)" disabled={actionLoading}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface" />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsAddExpenseModalOpen(false)} className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Add Expense
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SUB-MODAL 4: EDIT ALLOCATION ─────────────────────────────────────── */}
      <AnimatePresence>
        {editingAllocation && selectedTicket && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }}
              onClick={() => setEditingAllocation(null)}
              className="absolute inset-0 bg-black"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-6 rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Edit Allocation</h3>
                <button onClick={() => setEditingAllocation(null)} className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateAllocation} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Planned Hours</label>
                  <input type="number" step="0.5" min="0.5" required
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                    value={editAllocationForm.planned_hours}
                    onChange={e => setEditAllocationForm({ ...editAllocationForm, planned_hours: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Remarks</label>
                  <input type="text"
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                    value={editAllocationForm.remarks}
                    onChange={e => setEditAllocationForm({ ...editAllocationForm, remarks: e.target.value })}
                    placeholder="Remarks (optional)"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to remove this worker allocation?')) {
                        handleDeleteAllocation(editingAllocation.allocation_id);
                      }
                    }}
                    className="px-4 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-500/10 rounded-lg mr-auto transition-all cursor-pointer"
                  >
                    Remove Allocation
                  </button>
                  <button type="button" onClick={() => setEditingAllocation(null)} className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SUB-MODAL 5: EDIT WORK LOG ───────────────────────────────────────── */}
      <AnimatePresence>
        {editingWorkLog && selectedTicket && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }}
              onClick={() => setEditingWorkLog(null)}
              className="absolute inset-0 bg-black"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-6 rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Edit Work Log</h3>
                <button onClick={() => setEditingWorkLog(null)} className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateWorkLog} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Hours Worked</label>
                  <input type="number" step="0.5" min="0.5" required
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                    value={editWorkLogForm.hours}
                    onChange={e => setEditWorkLogForm({ ...editWorkLogForm, hours: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Description of Work Done</label>
                  <textarea required rows={3}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                    value={editWorkLogForm.work_done}
                    onChange={e => setEditWorkLogForm({ ...editWorkLogForm, work_done: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this work log?')) {
                        handleDeleteWorkLog(editingWorkLog.worklog_id);
                      }
                    }}
                    className="px-4 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-500/10 rounded-lg mr-auto transition-all cursor-pointer"
                  >
                    Delete Log
                  </button>
                  <button type="button" onClick={() => setEditingWorkLog(null)} className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SUB-MODAL 6: EDIT EXPENSE ────────────────────────────────────────── */}
      <AnimatePresence>
        {editingExpense && selectedTicket && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }}
              onClick={() => setEditingExpense(null)}
              className="absolute inset-0 bg-black"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-6 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] scrollbar-thin"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Edit Expense</h3>
                <button onClick={() => setEditingExpense(null)} className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateExpense} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Expense Category</label>
                  <select required
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                    value={editExpenseForm.expense_type_id}
                    onChange={e => setEditExpenseForm({ ...editExpenseForm, expense_type_id: e.target.value })}
                  >
                    <option value="">Expense Type</option>
                    {expenseTypes
                      .filter(et => (et.department?.department_id ?? et.department) === selectedTicket.department.department_id)
                      .map(et => (
                        <option key={et.expense_type_id} value={et.expense_type_id}>
                          {et.expense_name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Amount (KWD)</label>
                  <input type="number" step="0.01" min="0" required
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                    value={editExpenseForm.amount}
                    onChange={e => setEditExpenseForm({ ...editExpenseForm, amount: e.target.value })}
                    placeholder="KWD"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Remarks</label>
                  <input type="text"
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                    value={editExpenseForm.remarks}
                    onChange={e => setEditExpenseForm({ ...editExpenseForm, remarks: e.target.value })}
                    placeholder="Remarks (optional)"
                  />
                </div>

                {/* Receipts Management (inside Edit Popup) */}
                <div className="pt-2 border-t border-outline-variant dark:border-dark-outline-variant space-y-3">
                  <h4 className="text-xs font-bold text-outline uppercase tracking-wider">Manage Receipt Attachments</h4>
                  {(() => {
                    const receiptsList: Media[] = [];
                    if (editingExpense.receipt) receiptsList.push(editingExpense.receipt);
                    if (editingExpense.receipts) {
                      editingExpense.receipts.forEach(r => {
                        if (!receiptsList.some(existing => existing.media_id === r.media_id)) {
                          receiptsList.push(r);
                        }
                      });
                    }
                    return (
                      <MediaGrid
                        items={receiptsList}
                        emptyLabel="No receipts attached to this expense"
                        onEdit={triggerReplaceMedia}
                        onDelete={handleDeleteMedia}
                      />
                    );
                  })()}

                  {(() => {
                    const currentEditExpTypeObj = expenseTypes.find(et => String(et.expense_type_id) === String(editExpenseForm.expense_type_id)) || editingExpense.expense_type;
                    const isReceiptRequiredInEdit = currentEditExpTypeObj ? (currentEditExpTypeObj as any).required !== false : true;
                    const showReceiptUploadInEdit = hasBillsCategoryForDept && isReceiptRequiredInEdit;

                    if (!showReceiptUploadInEdit) return null;

                    return (
                      <div
                        className={`relative border-2 border-dashed border-outline-variant dark:border-dark-outline-variant rounded-xl p-3 text-center hover:border-primary transition-all cursor-pointer ${actionLoading ? 'pointer-events-none opacity-50' : ''}`}
                        onClick={() => !actionLoading && document.getElementById(`receipt-edit-upload-${editingExpense.expense_id}`)?.click()}
                      >
                        <input
                          id={`receipt-edit-upload-${editingExpense.expense_id}`}
                          type="file"
                          accept="image/*,application/pdf"
                          disabled={actionLoading}
                          className="sr-only"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleAddExpenseReceiptInEdit(file);
                            e.target.value = '';
                          }}
                        />
                        <p className="text-[11px] text-outline">📎 Tap to upload and attach a new receipt</p>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant dark:border-dark-outline-variant">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this expense?')) {
                        handleDeleteExpense(editingExpense.expense_id);
                      }
                    }}
                    className="px-4 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-500/10 rounded-lg mr-auto transition-all cursor-pointer"
                  >
                    Delete Expense
                  </button>
                  <button type="button" onClick={() => setEditingExpense(null)} className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SUB-MODAL 7: MANAGE Before Repair ──────────────────────────────────── */}
      <AnimatePresence>
        {isManageIssueMediaOpen && selectedTicket && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }}
              onClick={() => setIsManageIssueMediaOpen(false)}
              className="absolute inset-0 bg-black"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-2xl p-6 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Manage Before Repair</h3>
                <button onClick={() => setIsManageIssueMediaOpen(false)} className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <MediaGrid
                  items={issueMedia}
                  emptyLabel="No Before Repair uploaded yet"
                  onEdit={triggerReplaceMedia}
                  onDelete={handleDeleteMedia}
                />

                <div className="pt-2 border-t border-outline-variant dark:border-dark-outline-variant">
                  <input type="file" accept="image/*,video/*" onChange={handleUploadIssueMedia}
                    disabled={actionLoading}
                    className="hidden" id="upload-issue-media-popup" />
                  <label htmlFor="upload-issue-media-popup"
                    className={`w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-outline-variant dark:border-dark-outline-variant rounded-xl cursor-pointer hover:border-primary text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant hover:text-primary transition-all ${actionLoading ? 'pointer-events-none opacity-50' : ''}`}>
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    Upload New Issue Photo / Video
                  </label>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SUB-MODAL 8: MANAGE After Repair ─────────────────────────── */}
      <AnimatePresence>
        {isManageCompletedMediaOpen && selectedTicket && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }}
              onClick={() => setIsManageCompletedMediaOpen(false)}
              className="absolute inset-0 bg-black"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-2xl p-6 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Manage After Repair</h3>
                <button onClick={() => setIsManageCompletedMediaOpen(false)} className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <MediaGrid
                  items={completedMedia}
                  emptyLabel="No completion media uploaded yet"
                  onEdit={triggerReplaceMedia}
                  onDelete={handleDeleteMedia}
                />

                <div className="pt-2 border-t border-outline-variant dark:border-dark-outline-variant">
                  <input type="file" accept="image/*,video/*" onChange={handleUploadCompletedMedia}
                    disabled={actionLoading}
                    className="hidden" id="upload-completed-media-popup" />
                  <label htmlFor="upload-completed-media-popup"
                    className={`w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-outline-variant dark:border-dark-outline-variant rounded-xl cursor-pointer hover:border-primary text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant hover:text-primary transition-all ${actionLoading ? 'pointer-events-none opacity-50' : ''}`}>
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    Upload After Repair / Completion Photo
                  </label>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
