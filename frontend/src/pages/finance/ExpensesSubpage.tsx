import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt, PlusCircle, Trash2, X, AlertCircle, Loader2, FileText, Eye, CheckCircle2, Building2, Calendar, DollarSign, User, Paperclip, Upload, RotateCcw, RotateCw, Image as ImageIcon, ShieldCheck, Headphones, Video, Check, ChevronDown, ChevronRight, MessageSquare, Ticket, ExternalLink, Pencil, SlidersHorizontal, Rows3, ChevronsUp
} from 'lucide-react';
import type { ExpenseItem, ApprovalInstanceItem, ApprovalStepInfo } from './types';
import { ApprovalsSubpage, type ApprovalsSubpageProps } from './ApprovalsSubpage';
import { MediaPreviewModal, MediaGrid, getMediaUrl, isImage, isAudio, isVideo, type Media } from '../ticket/TicketsTypesAndComponents';

interface PendingMediaItem {
  id: string;
  file: File;
  previewUrl: string;
  rotation: number;
}
import { Pagination } from './Pagination';
import { SearchableSelect, type SelectOption } from '../../components/SearchableSelect';
import Can from '../../hooks/Can';

interface ExpensesSubpageProps {
  expenses: ExpenseItem[];
  filteredExpenses?: ExpenseItem[];
  loading: boolean;
  submitting: boolean;
  renderStatusBadge: (status: string, isActionableForMe?: boolean, stepName?: string, hasCurrentUserApproved?: boolean) => React.ReactNode;
  showCreateExpenseModal: boolean;
  setShowCreateExpenseModal: (show: boolean) => void;
  handleCreateExpense: (formData: any) => Promise<void>;
  setSelectedTicketForModal: (ticket: any) => void;
  setPreviewMediaUrl: (media: { url: string; title: string } | null) => void;
  token: string;
  currentUser: any;
  API_URL: string;
  approvalsProps?: ApprovalsSubpageProps;
  onRefresh?: () => void;
  currentPage?: number;
  totalItems?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
  onItemsPerPageChange?: (num: number) => void;
}

export const ExpensesSubpage: React.FC<ExpensesSubpageProps> = ({
  expenses,
  filteredExpenses = expenses,
  loading,
  submitting,
  renderStatusBadge,
  showCreateExpenseModal,
  setShowCreateExpenseModal,
  handleCreateExpense,
  setSelectedTicketForModal,
  setPreviewMediaUrl,
  token,
  currentUser,
  API_URL,
  approvalsProps,
  onRefresh,
  currentPage: propCurrentPage,
  totalItems: propTotalItems,
  itemsPerPage: propItemsPerPage,
  onPageChange: propOnPageChange,
  onItemsPerPageChange: propOnItemsPerPageChange
}) => {
  // Expanded row state for accordion / stepper view
  const [expandedExpenseIds, setExpandedExpenseIds] = useState<Record<number, boolean>>({});
  const toggleExpandExpense = (id: number) => {
    setExpandedExpenseIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Check administrator privileges (Only Administrator role or Django superuser is the main admin; all others are role-based)
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const roleName = (
      (currentUser?.role as any)?.role_name ||
      (typeof currentUser?.role === 'string' ? currentUser.role : '') ||
      currentUser?.role_name ||
      ''
    ).toLowerCase().trim();
    const isSuper = !!currentUser?.is_superuser;
    const isAdmRole = roleName === 'administrator';
    return isSuper || isAdmRole;
  }, [currentUser]);

  // Pagination State
  const [localPage, setLocalPage] = useState(1);
  const [localItemsPerPage, setLocalItemsPerPage] = useState(10);

  const currentPage = propCurrentPage !== undefined ? propCurrentPage : localPage;
  const itemsPerPage = propItemsPerPage !== undefined ? propItemsPerPage : localItemsPerPage;
  const handlePageChange = propOnPageChange || setLocalPage;
  const handleItemsPerPageChange = propOnItemsPerPageChange || ((num: number) => {
    setLocalItemsPerPage(num);
    setLocalPage(1);
  });

  const isServerPaginated = propOnPageChange !== undefined;
  const totalItemsCount = propTotalItems !== undefined ? propTotalItems : filteredExpenses.length;

  // Form State for Create / Edit Expense Modal
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [selectedExpenseTypeId, setSelectedExpenseTypeId] = useState<string>('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState<string>('');

  const getCleanRemarks = (raw?: string) => {
    if (!raw) return '';
    const lines = raw.split('\n');
    const cleanLines = lines.filter(line => !line.trim().match(/^\[.+?\]:/));
    return cleanLines.join('\n').trim();
  };
  const [formError, setFormError] = useState<string | null>(null);

  // Media / Receipt Attachment State
  const [attachedMediaList, setAttachedMediaList] = useState<PendingMediaItem[]>([]);
  const [pendingUploadQueue, setPendingUploadQueue] = useState<PendingMediaItem[] | null>(null);

  // Lists for dropdown options
  const [ticketsList, setTicketsList] = useState<any[]>([]);
  const [expenseTypesList, setExpenseTypesList] = useState<any[]>([]);
  const [workersList, setWorkersList] = useState<any[]>([]);
  const [storesList, setStoresList] = useState<any[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState<boolean>(false);

  // Dynamic ticket search states
  const [ticketSearchQuery, setTicketSearchQuery] = useState<string>('');
  const [ticketSearching, setTicketSearching] = useState<boolean>(false);

  // Preview expense modal state
  const [previewExpenseItem, setPreviewExpenseItem] = useState<ExpenseItem | null>(null);

  // Per-expense approval remarks state and inline action status
  const [expenseRemarks, setExpenseRemarks] = useState<Record<number, string>>({});
  const [reworkErrors, setReworkErrors] = useState<Record<number, string>>({});
  const [actioningExpenseId, setActioningExpenseId] = useState<number | null>(null);
  const [actioningActionType, setActioningActionType] = useState<'APPROVED' | 'REWORK' | null>(null);
  const [updatingExpenseId, setUpdatingExpenseId] = useState<number | null>(null);

  // Multi-line View Toggle State
  const [isMultiLineView, setIsMultiLineView] = useState<boolean>(false);

  // Receipts attached to existing expense for edit modal
  const [existingReceipts, setExistingReceipts] = useState<any[]>([]);

  // Bulk Approval State
  const [selectedExpenseIdsForBulk, setSelectedExpenseIdsForBulk] = useState<number[]>([]);
  const [bulkApproving, setBulkApproving] = useState<boolean>(false);
  const [bulkActionMsg, setBulkActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Lightbox Media Preview State
  const [mediaPreviewState, setMediaPreviewState] = useState<{ items: any[]; index: number } | null>(null);

  useEffect(() => {
    setLocalPage(1);
    setSelectedExpenseIdsForBulk([]);
  }, [filteredExpenses.length]);

  // Fetch dropdown metadata when modal opens (tickets fetched via page=1&page_size=100)
  useEffect(() => {
    if ((showCreateExpenseModal || editingExpense) && token) {
      setLoadingDropdowns(true);
      const headers = { Authorization: `Token ${token}` };

      Promise.all([
        fetch(`${API_URL}/maintenance/ticket/?page=1&page_size=100&search=`, { headers }).then(res => res.ok ? res.json() : []),
        fetch(`${API_URL}/finance/expensetype/?page_size=all`, { headers }).then(res => res.ok ? res.json() : []),
        fetch(`${API_URL}/accounts/users/?page_size=all`, { headers }).then(res => res.ok ? res.json() : []),
        fetch(`${API_URL}/stores/store/?page_size=all`, { headers }).then(res => res.ok ? res.json() : [])
      ]).then(([ticketsRes, expTypesRes, usersRes, storesRes]) => {
        const rawTickets = Array.isArray(ticketsRes) ? ticketsRes : (ticketsRes?.results || []);
        setTicketsList(rawTickets);

        const rawExpTypes = Array.isArray(expTypesRes) ? expTypesRes : (expTypesRes?.results || []);
        setExpenseTypesList(rawExpTypes);

        const rawUsers = Array.isArray(usersRes) ? usersRes : (usersRes?.results || []);
        setWorkersList(rawUsers);

        const rawStores = Array.isArray(storesRes) ? storesRes : (storesRes?.results || []);
        setStoresList(rawStores);
      }).catch(err => {
        console.error('Error fetching dropdown metadata for expense creation:', err);
      }).finally(() => {
        setLoadingDropdowns(false);
      });
    }
  }, [showCreateExpenseModal, editingExpense, token, API_URL]);

  // Dynamic Ticket Search via API effect (debounced)
  useEffect(() => {
    if ((!showCreateExpenseModal && !editingExpense) || !token) return;
    const timer = setTimeout(() => {
      setTicketSearching(true);
      const headers = { Authorization: `Token ${token}` };
      const url = `${API_URL}/maintenance/ticket/?page=1&page_size=100&search=${encodeURIComponent(ticketSearchQuery)}`;
      fetch(url, { headers })
        .then(res => res.ok ? res.json() : [])
        .then(resData => {
          const rawTickets = Array.isArray(resData) ? resData : (resData?.results || []);
          setTicketsList(prev => {
            const selectedTicketObj = prev.find(t => String(t.ticket_id || t.id) === String(selectedTicketId));
            if (selectedTicketObj && !rawTickets.some((t: any) => String(t.ticket_id || t.id) === String(selectedTicketId))) {
              return [selectedTicketObj, ...rawTickets];
            }
            return rawTickets;
          });
        })
        .catch(err => console.error('Error searching tickets API:', err))
        .finally(() => setTicketSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [ticketSearchQuery, showCreateExpenseModal, editingExpense, token, API_URL, selectedTicketId]);

  // Ensure full ticket with allocated workers is loaded when selectedTicketId changes
  useEffect(() => {
    if (!selectedTicketId || !token) return;
    const existing = ticketsList.find(t => String(t.ticket_id || t.id) === String(selectedTicketId));
    if (!existing || !existing.allocations || existing.allocations.length === 0) {
      fetch(`${API_URL}/maintenance/ticket/${selectedTicketId}/`, {
        headers: { Authorization: `Token ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(ticketData => {
          if (ticketData) {
            setTicketsList(prev => {
              const idx = prev.findIndex(t => String(t.ticket_id || t.id) === String(selectedTicketId));
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = ticketData;
                return next;
              }
              return [ticketData, ...prev];
            });
          }
        })
        .catch(err => console.error('Error loading ticket details for allocations:', err));
    }
  }, [selectedTicketId, token, API_URL]);

  // 1. Derived store object for selected ticket
  const selectedTicketStore = useMemo(() => {
    if (!selectedTicketId || !ticketsList.length) return null;
    const ticket = ticketsList.find(t => String(t.ticket_id || t.id) === String(selectedTicketId));
    if (!ticket) return null;

    const rawStore = ticket.store || ticket.store_detail || ticket.store_details;
    if (typeof rawStore === 'object' && rawStore !== null) {
      const sId = String(rawStore.store_id || rawStore.id || '');
      const sName = rawStore.store_name || rawStore.name || `Store #${sId}`;
      return { storeId: sId, storeName: sName };
    } else if (typeof rawStore === 'number' || (typeof rawStore === 'string' && rawStore !== '')) {
      const sId = String(rawStore);
      const foundStore = storesList.find(s => String(s.store_id || s.id) === sId);
      return {
        storeId: sId,
        storeName: foundStore ? (foundStore.store_name || foundStore.name) : `Store #${sId}`
      };
    } else if (ticket.store_id) {
      const sId = String(ticket.store_id);
      const foundStore = storesList.find(s => String(s.store_id || s.id) === sId);
      return {
        storeId: sId,
        storeName: foundStore ? (foundStore.store_name || foundStore.name) : `Store #${sId}`
      };
    }
    return null;
  }, [selectedTicketId, ticketsList, storesList]);

  // Options for Responsible Store dropdown (restricted ONLY to the selected ticket's store, NOT selected by default)
  const storeDropdownOptions = useMemo(() => {
    if (!selectedTicketId) {
      return [{ value: '', label: 'Select Ticket First' }];
    }
    if (!selectedTicketStore || !selectedTicketStore.storeId) {
      return [{ value: '', label: 'Ticket Has No Store Linked' }];
    }
    return [
      { value: '', label: 'Select Responsible Store (Optional)' },
      { value: selectedTicketStore.storeId, label: selectedTicketStore.storeName }
    ];
  }, [selectedTicketId, selectedTicketStore]);

  // 2. Derived workers working on the selected ticket (Allocated technicians only)
  const ticketWorkers = useMemo(() => {
    if (!selectedTicketId || !ticketsList.length) return [];
    const ticket = ticketsList.find(t => String(t.ticket_id || t.id) === String(selectedTicketId));
    if (!ticket) return [];

    const workersMap = new Map<string, any>();

    // Check ticket.allocations
    if (Array.isArray(ticket.allocations)) {
      ticket.allocations.forEach((alloc: any) => {
        const w = alloc.worker || alloc.worker_detail || alloc.user || alloc;
        if (typeof w === 'object' && w !== null) {
          const id = String(w.user_id || w.id || '');
          if (id) {
            const matchedUser = workersList.find(u => String(u.id || u.user_id) === id);
            workersMap.set(id, matchedUser || w);
          }
        } else if (typeof w === 'number' || typeof w === 'string') {
          const id = String(w);
          const found = workersList.find(u => String(u.id || u.user_id) === id);
          if (found) workersMap.set(id, found);
        }
      });
    }

    // Check ticket.allocated_workers / ticket.assigned_workers / ticket.workers
    const otherWorkerLists = (ticket as any).allocated_workers || (ticket as any).assigned_workers || (ticket as any).workers;
    if (Array.isArray(otherWorkerLists)) {
      otherWorkerLists.forEach((w: any) => {
        if (typeof w === 'object' && w !== null) {
          const id = String(w.user_id || w.id || '');
          if (id) {
            const matchedUser = workersList.find(u => String(u.id || u.user_id) === id);
            workersMap.set(id, matchedUser || w);
          }
        } else if (typeof w === 'number' || typeof w === 'string') {
          const id = String(w);
          const found = workersList.find(u => String(u.id || u.user_id) === id);
          if (found) workersMap.set(id, found);
        }
      });
    }

    return Array.from(workersMap.values());
  }, [selectedTicketId, ticketsList, workersList]);

  // Options for Worker dropdown (Strictly allocated workers only)
  const workerDropdownOptions = useMemo(() => {
    if (!selectedTicketId) {
      return [{ value: '', label: 'Select Ticket First' }];
    }
    if (ticketWorkers.length > 0) {
      return [
        { value: '', label: 'Select Allocated Worker' },
        ...ticketWorkers.map(w => ({
          value: String(w.user_id || w.id),
          label: `${w.full_name || w.username || `User #${w.user_id || w.id}`}${w.employee_no ? ` (${w.employee_no})` : ''}`
        }))
      ];
    }
    return [
      { value: '', label: 'No Allocated Workers on This Ticket' }
    ];
  }, [selectedTicketId, ticketWorkers]);

  // 3. Derived ticket department ID and filtered expense categories
  const selectedTicketDepartment = useMemo(() => {
    if (!selectedTicketId || !ticketsList.length) return null;
    const ticket = ticketsList.find(t => String(t.ticket_id || t.id) === String(selectedTicketId));
    if (!ticket) return null;

    const dep = ticket.department || ticket.department_detail || ticket.department_details;
    if (typeof dep === 'object' && dep !== null) {
      const dId = String(dep.department_id || dep.id || '');
      const dName = dep.department_name || dep.name || `Dept #${dId}`;
      return { departmentId: dId, departmentName: dName };
    } else if (typeof dep === 'number' || (typeof dep === 'string' && dep !== '')) {
      return { departmentId: String(dep), departmentName: `Dept #${dep}` };
    } else if (ticket.department_id) {
      return { departmentId: String(ticket.department_id), departmentName: `Dept #${ticket.department_id}` };
    }
    return null;
  }, [selectedTicketId, ticketsList]);

  const filteredExpenseTypes = useMemo(() => {
    if (!selectedTicketId) return [];
    if (!selectedTicketDepartment?.departmentId) return expenseTypesList;

    return expenseTypesList.filter(et => {
      const etDep = et.department || et.department_detail;
      let etDepId = '';
      if (typeof etDep === 'object' && etDep !== null) {
        etDepId = String(etDep.department_id || etDep.id || '');
      } else if (typeof etDep === 'number' || typeof etDep === 'string') {
        etDepId = String(etDep);
      } else if (et.department_id) {
        etDepId = String(et.department_id);
      }
      return !etDepId || etDepId === selectedTicketDepartment.departmentId;
    });
  }, [selectedTicketId, selectedTicketDepartment, expenseTypesList]);

  const expenseTypeDropdownOptions = useMemo(() => {
    if (!selectedTicketId) {
      return [{ value: '', label: 'Select Ticket First' }];
    }
    if (filteredExpenseTypes.length === 0) {
      return [{ value: '', label: 'No Categories for Ticket Department' }];
    }
    return [
      { value: '', label: 'Select Expense Category' },
      ...filteredExpenseTypes.map(et => ({
        value: String(et.expense_type_id || et.id),
        label: et.expense_name
      }))
    ];
  }, [selectedTicketId, filteredExpenseTypes]);

  // Selected Expense Type Object & Requirement Check
  const selectedExpenseTypeObj = useMemo(() => {
    if (!selectedExpenseTypeId || !expenseTypesList.length) return null;
    return expenseTypesList.find(et => String(et.expense_type_id || et.id) === String(selectedExpenseTypeId)) || null;
  }, [selectedExpenseTypeId, expenseTypesList]);

  const isReceiptRequired = useMemo(() => {
    if (!selectedExpenseTypeObj) return false;
    return selectedExpenseTypeObj.required !== false;
  }, [selectedExpenseTypeObj]);

  // Handler when ticket selection changes
  const handleTicketChange = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setSelectedExpenseTypeId('');
    setSelectedStoreId(''); // By default Responsible Store NOT selected

    // Preselect worker if current user is allocated or if only 1 worker is allocated to this ticket
    const ticket = ticketsList.find(t => String(t.ticket_id || t.id) === String(ticketId));
    let preselectedId = '';
    if (ticket) {
      const allocs = Array.isArray(ticket.allocations) ? ticket.allocations : [];
      const workerIds = allocs.map((a: any) => String(a.worker?.id || a.worker?.user_id || a.worker || ''));
      const currentId = String(currentUser?.user_id || currentUser?.id || '');
      if (currentId && workerIds.includes(currentId)) {
        preselectedId = currentId;
      } else if (workerIds.length === 1 && workerIds[0]) {
        preselectedId = workerIds[0];
      }
    }
    setSelectedWorkerId(preselectedId);
  };

  // Media Handlers
  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const queueItems: PendingMediaItem[] = files.map(file => ({
        id: Math.random().toString(36).substring(2, 9),
        file,
        previewUrl: URL.createObjectURL(file),
        rotation: 0
      }));
      setPendingUploadQueue(queueItems);
    }
    e.target.value = '';
  };

  const handleConfirmPendingUpload = () => {
    if (pendingUploadQueue && pendingUploadQueue.length > 0) {
      setAttachedMediaList(prev => [...prev, ...pendingUploadQueue]);
    }
    setPendingUploadQueue(null);
  };

  const handleCancelPendingUpload = () => {
    if (pendingUploadQueue) {
      pendingUploadQueue.forEach(item => URL.revokeObjectURL(item.previewUrl));
    }
    setPendingUploadQueue(null);
  };

  const handleRemoveAttachedMedia = (id: string) => {
    setAttachedMediaList(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const resetForm = () => {
    setSelectedTicketId('');
    setSelectedWorkerId('');
    setSelectedExpenseTypeId('');
    setSelectedStoreId('');
    setAmount('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setRemarks('');
    setFormError(null);
    attachedMediaList.forEach(item => URL.revokeObjectURL(item.previewUrl));
    setAttachedMediaList([]);
    setPendingUploadQueue(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const missingFields: string[] = [];
    if (!selectedTicketId) {
      missingFields.push('Ticket (Please select a maintenance ticket)');
    }
    if (!selectedExpenseTypeId) {
      missingFields.push('Expense Category (Please select category)');
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      missingFields.push('Amount (Must be a valid positive number)');
    }
    if (!expenseDate) {
      missingFields.push('Expense Date (Please select date)');
    }
    if (isReceiptRequired && attachedMediaList.length === 0) {
      missingFields.push(`Expense Bill / Receipt (Attachment is mandatory for category "${selectedExpenseTypeObj?.expense_name || 'selected category'}")`);
    }

    if (missingFields.length > 0) {
      if (missingFields.length === 1) {
        setFormError(missingFields[0]);
      } else {
        setFormError(`Please fill in all required fields:\n• ${missingFields.join('\n• ')}`);
      }
      return;
    }

    const payload = {
      ticket: parseInt(selectedTicketId, 10),
      worker: selectedWorkerId ? parseInt(selectedWorkerId, 10) : currentUser?.id,
      expense_type: parseInt(selectedExpenseTypeId, 10),
      amount: parseFloat(amount),
      expense_date: expenseDate,
      responsible_store: selectedStoreId ? parseInt(selectedStoreId, 10) : null,
      remarks: remarks.trim() || undefined,
      files: attachedMediaList.map(item => item.file),
      media_rotations: attachedMediaList.map(item => ({ file_name: item.file.name, rotation: item.rotation }))
    };

    try {
      await handleCreateExpense(payload);
      resetForm();
      setShowCreateExpenseModal(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create expense entry.');
    }
  };

  const openEditExpenseModal = (exp: ExpenseItem) => {
    setEditingExpense(exp);
    const expAny = exp as any;
    const tId = expAny.ticket_details?.ticket_id || expAny.ticket_details?.id || (typeof expAny.ticket === 'object' && expAny.ticket ? (expAny.ticket.ticket_id || expAny.ticket.id) : expAny.ticket);
    const wId = expAny.worker_detail?.user_id || expAny.worker_detail?.id || (typeof expAny.worker === 'object' && expAny.worker ? (expAny.worker.id || expAny.worker.user_id) : expAny.worker);
    const cId = expAny.expense_type_detail?.expense_type_id || expAny.expense_type_detail?.id || (typeof expAny.expense_type === 'object' && expAny.expense_type ? (expAny.expense_type.expense_type_id || expAny.expense_type.id) : expAny.expense_type);
    const sId = expAny.responsible_store?.store_id || expAny.responsible_store?.id || expAny.store_detail?.store_id || expAny.store_detail?.id || (typeof expAny.responsible_store === 'object' && expAny.responsible_store ? expAny.responsible_store.store_id : expAny.responsible_store);

    setSelectedTicketId(tId ? String(tId) : '');
    setSelectedWorkerId(wId ? String(wId) : '');
    setSelectedExpenseTypeId(cId ? String(cId) : '');
    setSelectedStoreId(sId ? String(sId) : '');
    setAmount(String(exp.amount || ''));
    setExpenseDate(exp.expense_date ? String(exp.expense_date).split('T')[0] : new Date().toISOString().split('T')[0]);
    setRemarks(getCleanRemarks(exp.remarks));
    setFormError(null);
    setAttachedMediaList([]);

    const modalMedia: any[] = [
      ...(exp.receipts || []),
      ...(exp.receipt && !exp.receipts?.some((r: any) => r.media_id === exp.receipt?.media_id) ? [exp.receipt] : [])
    ];
    setExistingReceipts(modalMedia);
  };

  const handleDeleteExistingReceipt = async (mediaId: number) => {
    if (!window.confirm('Are you sure you want to delete this attached receipt?')) return;
    try {
      const res = await fetch(`${API_URL}/common/media/${mediaId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` }
      });
      if (res.ok) {
        setExistingReceipts(prev => prev.filter(m => m.media_id !== mediaId));
        if (editingExpense) {
          setEditingExpense(prev => {
            if (!prev) return null;
            return {
              ...prev,
              receipts: prev.receipts?.filter((r: any) => r.media_id !== mediaId),
              receipt: prev.receipt?.media_id === mediaId ? undefined : prev.receipt
            };
          });
        }
      }
    } catch (err) {
      console.error('Failed to delete media receipt:', err);
    }
  };

  const handleUpdateExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    setFormError(null);

    const missingFields: string[] = [];
    if (!selectedTicketId) missingFields.push('Ticket (Please select a maintenance ticket)');
    if (!selectedExpenseTypeId) missingFields.push('Expense Category (Please select category)');
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) missingFields.push('Amount (Must be a valid positive number)');
    if (!expenseDate) missingFields.push('Expense Date (Please select date)');

    if (missingFields.length > 0) {
      setFormError(`Please fill in all required fields:\n• ${missingFields.join('\n• ')}`);
      return;
    }

    const currentUpdatingId = editingExpense.expense_id;
    setUpdatingExpenseId(currentUpdatingId);

    const payload: any = {
      ticket: parseInt(selectedTicketId, 10),
      worker: selectedWorkerId ? parseInt(selectedWorkerId, 10) : currentUser?.id,
      expense_type: parseInt(selectedExpenseTypeId, 10),
      amount: parseFloat(amount),
      expense_date: expenseDate,
      responsible_store: selectedTicketStore?.storeId ? parseInt(selectedTicketStore.storeId, 10) : (selectedStoreId ? parseInt(selectedStoreId, 10) : null),
      remarks: remarks.trim() || undefined,
    };

    try {
      const res = await fetch(`${API_URL}/finance/expense/${editingExpense.expense_id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        let msg = 'Failed to update expense';
        if (data && typeof data === 'object') {
          if (data.detail) msg = data.detail;
          else {
            const errEntries = Object.entries(data).map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(', ') : errs}`);
            if (errEntries.length) msg = errEntries.join(' • ');
          }
        }
        throw new Error(msg);
      }

      // Upload newly attached media files if any
      if (attachedMediaList.length > 0) {
        const uploadPromises = attachedMediaList.map(async (item) => {
          const mediaFormData = new FormData();
          if (selectedTicketId) mediaFormData.append('ticket', String(selectedTicketId));
          mediaFormData.append('file_url', item.file);
          mediaFormData.append('file_name', item.file.name);
          const workerId = selectedWorkerId || currentUser?.user_id || currentUser?.id;
          if (workerId) {
            mediaFormData.append('uploaded_by', String(workerId));
          }
          mediaFormData.append('expense', String(editingExpense.expense_id));
          if (item.rotation) {
            mediaFormData.append('rotation', String(item.rotation));
          }

          const mRes = await fetch(`${API_URL}/common/media/`, {
            method: 'POST',
            headers: { 'Authorization': `Token ${token}` },
            body: mediaFormData
          });
          if (!mRes.ok) {
            console.error('Failed to upload receipt file for expense:', item.file.name);
          }
        });

        await Promise.all(uploadPromises);
      }

      resetForm();
      setEditingExpense(null);
      if (onRefresh) {
        await onRefresh();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to update expense.');
    } finally {
      setUpdatingExpenseId(null);
    }
  };

  const totalAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (parseFloat(String(e.amount)) || 0), 0);
  }, [filteredExpenses]);

  const paginatedExpenses = useMemo(() => {
    if (isServerPaginated) return expenses;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredExpenses.slice(start, start + itemsPerPage);
  }, [isServerPaginated, expenses, filteredExpenses, currentPage, itemsPerPage]);

  const pendingApprovalsCount = useMemo(() => {
    if (!approvalsProps?.displayedApprovals) return 0;
    return approvalsProps.displayedApprovals.filter(a => {
      const type = a.target_summary?.type || (a.claim ? 'Bundle' : (a.ledger ? 'Ledger' : 'Expense'));
      return type === 'Expense' && a.status === 'Pending';
    }).length;
  }, [approvalsProps]);

  // Helper to extract approval data and workflow pipeline for an expense
  const getExpenseApprovalGroup = (exp: ExpenseItem) => {
    // 1. Direct approval instances on the expense object from API serializer
    const expDirectInstances: ApprovalInstanceItem[] = (exp as any).approval_instances || [];

    // 2. Global matching approval instances
    const allApprovals = [
      ...(approvalsProps?.approvals || []),
      ...(approvalsProps?.displayedApprovals || []),
      ...(approvalsProps?.roleFilteredApprovals || [])
    ];

    const matchingApp = allApprovals.find(a =>
      a.expense === exp.expense_id ||
      a.expense_id === exp.expense_id ||
      (a.target_summary?.type === 'Expense' && a.target_summary?.id === exp.expense_id)
    ) || (expDirectInstances.length > 0 ? expDirectInstances.find(a => a.status === 'Pending') || expDirectInstances[0] : null);

    // Combine history items
    let historyItems: ApprovalInstanceItem[] = [];
    if (matchingApp?.approval_history && matchingApp.approval_history.length > 0) {
      historyItems = matchingApp.approval_history as any;
    } else if (expDirectInstances.length > 0) {
      historyItems = expDirectInstances;
    } else if (matchingApp) {
      historyItems = [matchingApp];
    }

    // Try to find full workflow steps (e.g. all 4 levels)
    let workflowSteps: ApprovalStepInfo[] = [];
    if (matchingApp?.workflow_steps && matchingApp.workflow_steps.length > 0) {
      workflowSteps = matchingApp.workflow_steps;
    } else {
      for (const inst of expDirectInstances) {
        if (inst.workflow_steps && inst.workflow_steps.length > 0) {
          workflowSteps = inst.workflow_steps;
          break;
        }
      }
    }

    if (workflowSteps.length === 0 && allApprovals.length > 0) {
      const anyExpenseApp = allApprovals.find(a => a.workflow_steps && a.workflow_steps.length > 0 && (a.target_summary?.type === 'Expense' || a.expense || a.expense_id));
      if (anyExpenseApp?.workflow_steps) {
        workflowSteps = anyExpenseApp.workflow_steps;
      }
    }

    if (matchingApp || historyItems.length > 0) {
      if (workflowSteps.length > 0 && historyItems.length > 0) {
        historyItems[0] = { ...historyItems[0], workflow_steps: workflowSteps };
      }

      return {
        app: matchingApp,
        group: {
          label: `Expense #${exp.expense_id}`,
          type: 'Expense' as const,
          id: exp.expense_id,
          items: historyItems,
          isApproved: exp.approved,
          remarks: typeof exp.remarks === 'string' ? exp.remarks : ''
        }
      };
    }

    if (exp.approved) {
      const approvedItems = workflowSteps.length > 0 ? workflowSteps.map(s => ({
        instance_id: exp.expense_id,
        step_id: s.step_id,
        step_name: s.step_name,
        step_order: s.step_order,
        assigned_role_name: s.assigned_role_name || 'Finance / Admin',
        assigned_users_names: s.assigned_users_names || [],
        status: 'Approved' as const,
        created_at: exp.expense_date || '',
        workflow_steps: workflowSteps
      })) : [
        {
          instance_id: exp.expense_id,
          step_name: 'Approval',
          step_order: 1,
          assigned_role_name: 'Finance / Admin',
          status: 'Approved' as const,
          created_at: exp.expense_date || ''
        }
      ];

      return {
        app: null,
        group: {
          label: `Expense #${exp.expense_id}`,
          type: 'Expense' as const,
          id: exp.expense_id,
          items: approvedItems as any,
          isApproved: true
        }
      };
    }

    // Pending approval fallback for expense items without a workflow instance record
    const approveRequired = (exp.expense_type_detail as any)?.approve_required !== false && (exp.expense_type as any)?.approve_required !== false;
    if (!exp.approved && approveRequired) {
      const fallbackItems = workflowSteps.length > 0 ? workflowSteps.map((s, idx) => ({
        instance_id: exp.expense_id,
        step_id: s.step_id,
        step_name: s.step_name,
        step_order: s.step_order,
        assigned_role_name: s.assigned_role_name || 'Authorized Approver',
        assigned_users_names: s.assigned_users_names || [],
        status: idx === 0 ? ('Pending' as const) : ('Pending' as const),
        created_at: exp.expense_date || '',
        can_action: idx === 0,
        expense: exp.expense_id,
        expense_id: exp.expense_id,
        is_direct_expense: true,
        workflow_steps: workflowSteps
      })) : [
        {
          instance_id: exp.expense_id,
          step_name: 'Expense Approval',
          step_order: 1,
          assigned_role_name: 'Authorized Approver',
          status: 'Pending' as const,
          created_at: exp.expense_date || '',
          can_action: true,
          expense: exp.expense_id,
          expense_id: exp.expense_id,
          is_direct_expense: true
        }
      ];

      return {
        app: fallbackItems[0] as any,
        group: {
          label: `Expense #${exp.expense_id}`,
          type: 'Expense' as const,
          id: exp.expense_id,
          items: fallbackItems as any,
          isApproved: false
        }
      };
    }

    return null;
  };

  // Inline approval / rework action handler with remarks
  const handleInlineExpenseAction = async (exp: ExpenseItem, action: 'APPROVED' | 'REWORK') => {
    const approvalData = getExpenseApprovalGroup(exp);
    let remark = (expenseRemarks[exp.expense_id] || '').trim();

    if (action === 'REWORK' && !remark) {
      setReworkErrors(prev => ({ ...prev, [exp.expense_id]: 'Please enter a reason for rework' }));
      return;
    }

    // Clear error on this expense
    setReworkErrors(prev => {
      if (!prev[exp.expense_id]) return prev;
      const next = { ...prev };
      delete next[exp.expense_id];
      return next;
    });

    setActioningExpenseId(exp.expense_id);
    setActioningActionType(action);

    try {
      if (approvalsProps?.handleActionApproval) {
        if (approvalData?.app && !(approvalData.app as any).is_direct_expense) {
          await (approvalsProps.handleActionApproval as any)(action, remark, approvalData.app);
        } else {
          const directApp: any = {
            instance_id: exp.expense_id,
            expense_id: exp.expense_id,
            is_direct_expense: true
          };
          await (approvalsProps.handleActionApproval as any)(action, remark, directApp);
        }
      } else {
        const res = await fetch(`${API_URL}/finance/expense/${exp.expense_id}/action_expense/`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action, remarks: remark })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'Failed to action expense');
        }
        if (onRefresh) {
          onRefresh();
        }
      }
    } catch (err: any) {
      setReworkErrors(prev => ({ ...prev, [exp.expense_id]: err.message || 'Failed to action expense' }));
    } finally {
      setActioningExpenseId(null);
      setActioningActionType(null);
    }
  };

  // Pending Expenses that the current logged-in user is authorized to action right now
  const pendingExpenses = useMemo(() => {
    return filteredExpenses.filter((exp: any) => {
      const rawStatus = exp.status_display || (exp.approved ? 'Approved' : 'Pending Approval');
      const approvalData = getExpenseApprovalGroup(exp);
      const activePendingInstance = approvalData?.group?.items?.find(i => i.status === 'Pending');
      const isApproved = exp.approved === true || rawStatus === 'Approved';
      const isRework = !isApproved && !activePendingInstance && (
        rawStatus === 'Rework' ||
        (approvalData?.app?.status === 'Rework')
      );
      const isRejected = !isApproved && !activePendingInstance && !isRework && (
        rawStatus === 'Rejected' ||
        (approvalData?.app?.status === 'Rejected')
      );
      const requiresApproval = (exp.expense_type_detail as any)?.approve_required !== false && (exp.expense_type as any)?.approve_required !== false;
      if (isApproved || isRework || isRejected || !requiresApproval) return false;

      // Check if current user is authorized to approve this specific active pending step
      if (isAdmin) return true;

      const activeApp: any = activePendingInstance || approvalData?.app;
      if (activeApp?.can_action === true) return true;
      if (!activeApp) return false;

      const currentUserId = currentUser?.id ?? currentUser?.user_id;
      const currentUsername = currentUser?.username;
      const currentRoleName = (
        (currentUser?.role as any)?.role_name ||
        (typeof currentUser?.role === 'string' ? currentUser.role : '') ||
        currentUser?.role_name ||
        ''
      ).toLowerCase().trim();

      const currentStepInfo = activeApp.workflow_steps?.find(
        (s: any) => s.step_id === activeApp.step_id || s.step_name === activeApp.step_name || s.step_order === activeApp.step_order
      );

      const assignedUserIds: any[] = currentStepInfo?.assigned_users_ids || activeApp?.assigned_users_ids || [];
      const assignedUserNames: string[] = currentStepInfo?.assigned_users_names || activeApp?.assigned_users_names || [];

      if (assignedUserIds.length > 0 || assignedUserNames.length > 0) {
        return Boolean(
          (currentUserId && assignedUserIds.some(id => String(id) === String(currentUserId))) ||
          (currentUsername && assignedUserNames.some(u => u.toLowerCase() === currentUsername.toLowerCase())) ||
          (currentUser?.full_name && assignedUserNames.some(u => u.toLowerCase() === currentUser.full_name.toLowerCase()))
        );
      }

      const stepRoleName = (currentStepInfo?.assigned_role_name || activeApp?.assigned_role_name || '').toLowerCase().trim();
      return Boolean(stepRoleName && currentRoleName && stepRoleName === currentRoleName);
    });
  }, [filteredExpenses, approvalsProps, isAdmin, currentUser]);

  const handleSelectAllPending = () => {
    const pendingIds = pendingExpenses.map(e => e.expense_id);
    if (selectedExpenseIdsForBulk.length === pendingIds.length && pendingIds.length > 0) {
      setSelectedExpenseIdsForBulk([]);
    } else {
      setSelectedExpenseIdsForBulk(pendingIds);
    }
  };

  const handleToggleSelectExpense = (id: number) => {
    setSelectedExpenseIdsForBulk(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkApprove = async (idsToApprove?: number[]) => {
    const ids = idsToApprove || selectedExpenseIdsForBulk;
    if (ids.length === 0) return;
    setBulkApproving(true);
    setBulkActionMsg(null);
    try {
      const res = await fetch(`${API_URL}/finance/expense/bulk-approve/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expense_ids: ids,
          comments: 'Bulk approved'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Bulk approval failed');

      const approvedCount = data.approved_count ?? ids.length;
      setBulkActionMsg({
        type: 'success',
        text: `Successfully approved ${approvedCount} expense(s)!`
      });
      setSelectedExpenseIdsForBulk([]);
      if (onRefresh) {
        onRefresh();
      }
      setTimeout(() => setBulkActionMsg(null), 4000);
    } catch (err: any) {
      setBulkActionMsg({
        type: 'error',
        text: err.message || 'Error occurred during bulk approval.'
      });
    } finally {
      setBulkApproving(false);
    }
  };

  // Render Visual Stepper Pipeline UI (Start -> Steps -> End)
  const renderApprovalStepper = (group: { label: string; type: 'Bundle' | 'Ledger' | 'Expense'; id: number; items: ApprovalInstanceItem[]; isApproved?: boolean; remarks?: string }, compact = false) => {
    let steps: ApprovalStepInfo[] = [];
    for (const item of group.items) {
      if (item.workflow_steps && item.workflow_steps.length > 0) {
        steps = item.workflow_steps;
        break;
      }
    }

    if (steps.length === 0 && approvalsProps?.approvals) {
      const matchInAll = approvalsProps.approvals.find(a =>
        (a.workflow_steps && a.workflow_steps.length > 0) &&
        (a.target_summary?.type === group.type || (group.type === 'Expense' && (a.expense || a.expense_id)))
      );
      if (matchInAll?.workflow_steps) {
        steps = matchInAll.workflow_steps;
      }
    }

    if (steps.length === 0) {
      const stepNamesSeen = new Set<string>();
      group.items.forEach(i => {
        if (!stepNamesSeen.has(i.step_name)) {
          stepNamesSeen.add(i.step_name);
          steps.push({
            step_id: steps.length + 1,
            step_order: steps.length + 1,
            step_name: i.step_name,
            assigned_role_name: i.assigned_role_name || ''
          });
        }
      });
    }

    // Is the overall pipeline completely finished/approved?
    const isFinished = group.isApproved || (steps.length > 0 && group.items.some(i => i.status === 'Approved' && ((i as any).is_final_step || i.step_order === steps.length))) || (group.items.length > 0 && group.items.every(i => i.status === 'Approved'));

    // Find the current active step index if pending
    const activePendingItem = group.items.find(i => i.status === 'Pending');
    const activePendingOrder: number = (activePendingItem && typeof activePendingItem.step_order === 'number') ? activePendingItem.step_order : (isFinished ? steps.length + 1 : 1);

    return (
      <div className={compact ? "p-1.5 bg-transparent overflow-x-auto" : "p-4 bg-surface-container-low border border-outline-variant/60 rounded overflow-x-auto shadow-2xs"}>
        <div className={`flex items-start justify-between px-1 py-1 ${compact ? 'min-w-[480px]' : 'min-w-[650px]'}`}>
          {/* START NODE */}
          <div className={`flex flex-col items-center shrink-0 ${compact ? 'w-12' : 'w-16'}`}>
            <div className={`${compact ? 'w-6 h-6 text-[9px]' : 'w-7 h-7 text-[10px]'} rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/40 shrink-0`}>
              Start
            </div>
            <span className="text-[9px] text-on-surface-variant mt-0.5 font-medium">Submitted</span>
          </div>

          {/* STEP NODES & CONNECTORS */}
          {steps.map((step, idx) => {
            const stepOrderNum = typeof step.step_order === 'number' ? step.step_order : (idx + 1);
            const stepInst = group.items.find(i => (i.step_name === step.step_name || i.step_order === step.step_order) && i.status === 'Pending')
              || group.items.find(i => i.step_name === step.step_name || i.step_order === step.step_order);

            const isPending = !isFinished && (activePendingItem ? (stepOrderNum === activePendingOrder) : (stepInst?.status === 'Pending'));
            const isApproved = !isPending && (isFinished || (activePendingItem ? (stepOrderNum < activePendingOrder && stepInst?.status === 'Approved') : (stepInst?.status === 'Approved')));
            const isRejected = !isFinished && !activePendingItem && (stepInst?.status === 'Rejected');
            const isRework = !isFinished && !activePendingItem && (stepInst?.status === 'Rework');
            const isUpcoming = !isApproved && !isPending && !isRejected && !isRework;

            let circleClass = "bg-surface-container-high text-on-surface-variant border-outline";
            let labelBadge = step.assigned_role_name;
            if (step.assigned_users_names && step.assigned_users_names.length > 0) {
              labelBadge = `${step.assigned_role_name ? step.assigned_role_name + ': ' : ''}${step.assigned_users_names.join(', ')}`;
            }
            let iconNode: React.ReactNode = step.step_order;

            const actionUserDisplay = stepInst?.action_by_full_name || stepInst?.action_by_username || (typeof (stepInst as any)?.action_by === 'object' ? ((stepInst as any).action_by?.full_name || (stepInst as any).action_by?.username) : '') || '';

            if (isApproved) {
              circleClass = "bg-emerald-500 text-white border-emerald-600 font-bold shadow-sm";
              iconNode = <Check className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />;
              labelBadge = actionUserDisplay ? `Approved by ${actionUserDisplay}` : `Approved (${labelBadge || 'Level ' + stepOrderNum})`;
            } else if (isPending) {
              circleClass = "bg-amber-500 text-white border-amber-600 font-bold animate-pulse shadow-md ring-2 ring-amber-500/30";
              iconNode = step.step_order;
              labelBadge = `Pending (${labelBadge || 'Level ' + stepOrderNum})`;
            } else if (isRejected) {
              circleClass = "bg-error text-on-error border-error font-bold shadow-sm";
              iconNode = <X className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />;
              labelBadge = `Rejected by ${actionUserDisplay || 'User'}`;
            } else if (isRework) {
              circleClass = "bg-purple-600 text-white border-purple-700 font-bold shadow-sm";
              iconNode = <RotateCcw className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />;
              labelBadge = `Rework requested by ${actionUserDisplay || 'User'}`;
            } else if (isUpcoming) {
              circleClass = "bg-surface-container text-on-surface-variant/70 border-outline-variant/60";
              iconNode = step.step_order;
              labelBadge = `Upcoming (${labelBadge || 'Level ' + stepOrderNum})`;
            }

            // Connector line before this step (from previous node)
            const isPrevCompleted = idx === 0 ? true : (isFinished || (stepOrderNum <= activePendingOrder));

            return (
              <React.Fragment key={step.step_id || idx}>
                {/* CONNECTOR LINE */}
                <div className={`flex-1 h-0.5 mx-1 ${compact ? 'mt-3' : 'mt-3.5'} transition-colors ${isPrevCompleted && (isApproved || isPending) ? 'bg-emerald-500' : 'bg-outline-variant'}`} />

                {/* STEP NODE */}
                <div className={`flex flex-col items-center text-center shrink-0 ${compact ? 'w-[130px]' : 'w-[170px]'}`}>
                  <div className={`${compact ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-xs'} rounded flex items-center justify-center transition-all border shrink-0 ${circleClass}`}>
                    {iconNode}
                  </div>
                  <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-semibold text-on-surface mt-1 line-clamp-1 w-full`}>{step.step_name}</span>
                  <span className="text-[9px] text-on-surface-variant line-clamp-1 w-full">{labelBadge}</span>

                  {stepInst && stepInst.actioned_at && (
                    <span className="text-[8px] text-on-surface-variant mt-0.5">
                      {new Date(stepInst.actioned_at).toLocaleDateString()}
                    </span>
                  )}

                  {(() => {
                    const stepNameNormalized = (step.step_name || '').toLowerCase().trim();
                    const collectedComments: Array<{
                      comment: string;
                      author?: string;
                      status?: string;
                      date?: string;
                    }> = [];

                    const seenComments = new Set<string>();

                    // Gather comments from all approval history instances for this step
                    group.items.forEach(i => {
                      const itemStepName = (i.step_name || '').toLowerCase().trim();
                      if (itemStepName === stepNameNormalized || i.step_order === step.step_order) {
                        if (i.comments && String(i.comments).trim()) {
                          const cleanComment = String(i.comments).trim();
                          const authorName = i.action_by_full_name || i.action_by_username || (typeof (i as any).action_by === 'object' ? ((i as any).action_by?.full_name || (i as any).action_by?.username) : (i as any).action_by) || '';
                          const key = `${cleanComment}_${authorName}`;
                          if (!seenComments.has(key)) {
                            seenComments.add(key);
                            collectedComments.push({
                              comment: cleanComment,
                              author: authorName,
                              status: i.status,
                              date: i.actioned_at ? new Date(i.actioned_at).toLocaleDateString() : undefined
                            });
                          }
                        }
                      }
                    });

                    if (collectedComments.length === 0) return null;

                    return (
                      <div className="mt-1.5 p-1.5 rounded bg-surface-container border border-outline-variant text-[10px] text-on-surface w-full shadow-xs text-left font-sans space-y-1">
                        <div className="flex items-center gap-1 font-semibold text-[8px] text-primary not-italic uppercase tracking-wider">
                          <MessageSquare className="w-2.5 h-2.5 shrink-0" /> Comment{collectedComments.length > 1 ? `s (${collectedComments.length})` : ''}:
                        </div>
                        {collectedComments.map((c, cIdx) => (
                          <div key={cIdx} className={`text-[9px] ${cIdx > 0 ? 'pt-1 border-t border-outline-variant/60' : ''}`}>
                            <p className="italic text-on-surface font-normal">"{c.comment}"</p>
                            {(c.author || c.date) && (
                              <span className="text-[8px] text-on-surface-variant/80 block mt-0.5 font-medium">
                                - {c.author} {c.date ? `(${c.date})` : ''}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </React.Fragment>
            );
          })}

          {/* CONNECTOR LINE TO END */}
          <div className={`flex-1 h-0.5 mx-1 ${compact ? 'mt-3' : 'mt-3.5'} transition-colors ${isFinished ? 'bg-emerald-500' : 'bg-outline-variant'}`} />

          {/* END NODE */}
          <div className={`flex flex-col items-center shrink-0 ${compact ? 'w-12' : 'w-16'}`}>
            <div className={`${compact ? 'w-6 h-6 text-[9px]' : 'w-7 h-7 text-[10px]'} rounded flex items-center justify-center font-bold border shrink-0 ${isFinished ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-surface-container-high text-on-surface-variant border-outline'}`}>
              End
            </div>
            <span className="text-[9px] text-on-surface-variant mt-0.5 font-medium">Disbursement</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded border border-outline-variant bg-surface-container">
          <span className="text-xs font-medium text-on-surface-variant block">Total Expenses Recorded</span>
          <span className="text-2xl font-semibold text-on-surface mt-1 block">{filteredExpenses.length}</span>
          <span className="text-xs text-on-surface-variant mt-1 block">{totalAmount.toFixed(2)} total</span>
        </div>
        <div className="p-4 rounded border border-outline-variant bg-surface-container">
          <span className="text-xs font-medium text-on-surface-variant block">Approved Expenses</span>
          <span className="text-2xl font-semibold text-emerald-500 mt-1 block">
            {filteredExpenses.filter(e => e.approved || (e.expense_type as any)?.approve_required === false).length}
          </span>
        </div>
        <div className="p-4 rounded border border-outline-variant bg-surface-container">
          <span className="text-xs font-medium text-on-surface-variant block">Pending Approval</span>
          <span className="text-2xl font-semibold text-amber-500 mt-1 block">
            {filteredExpenses.filter(e => !e.approved && (e.expense_type as any)?.approve_required !== false).length}
          </span>
        </div>
        <div className="p-4 rounded border border-outline-variant bg-surface-container">
          <span className="text-xs font-medium text-on-surface-variant block">Unclaimed (Available)</span>
          <span className="text-2xl font-semibold text-blue-500 mt-1 block">
            {filteredExpenses.filter(e => !e.is_claimed && !e.claim).length}
          </span>
        </div>
      </div>

      {/* Main Expenses Table */}
      <div className="border border-outline-variant rounded overflow-hidden bg-surface-container flex flex-col">
        <div className="p-3 bg-surface-container-low border-b border-outline-variant flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-on-surface">Expense Line Items</span>
            <span className="text-xs text-on-surface-variant font-medium">
              Showing {filteredExpenses.length} of {expenses.length}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Multi-line Stepper View Toggle */}
            <button
              type="button"
              onClick={() => setIsMultiLineView(prev => !prev)}
              className={`px-2.5 py-1.5 rounded border text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer ${isMultiLineView
                ? 'bg-primary/15 border-primary text-primary dark:bg-primary/25 font-semibold shadow-2xs'
                : 'border-outline-variant text-on-surface hover:bg-surface-container'
                }`}
              title="Toggle multi-line view: shows approval steps & quick approve/rework buttons on every row"
            >
              <Rows3 className="w-3.5 h-3.5" />
              <span>{isMultiLineView ? 'Multi-line: ON' : 'Multi-line: OFF'}</span>
            </button>

            {/* Close All Button */}
            <button
              type="button"
              onClick={() => {
                setExpandedExpenseIds({});
                setIsMultiLineView(false);
              }}
              className="px-2.5 py-1.5 rounded border border-outline-variant text-[11px] font-medium text-on-surface hover:bg-surface-container flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Collapse all opened accordions and multi-line rows (single-line view)"
            >
              <ChevronsUp className="w-3.5 h-3.5 text-on-surface-variant" />
              <span>Close All</span>
            </button>

            {pendingExpenses.length > 0 && (
              <>


                <button
                  type="button"
                  disabled={bulkApproving}
                  onClick={() => handleBulkApprove(selectedExpenseIdsForBulk.length > 0 ? selectedExpenseIdsForBulk : pendingExpenses.map(e => e.expense_id))}
                  className="px-3.5 py-1.5 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Approve pending expenses in one click"
                >
                  {bulkApproving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Approving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {selectedExpenseIdsForBulk.length > 0
                          ? `Bulk Approve (${selectedExpenseIdsForBulk.length})`
                          : `Approve All Pending (${pendingExpenses.length})`}
                      </span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {bulkActionMsg && (
          <div className={`px-4 py-2 text-xs flex items-center justify-between border-b ${bulkActionMsg.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900'
            : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900'
            }`}>
            <div className="flex items-center gap-2">
              {bulkActionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
              <span>{bulkActionMsg.text}</span>
            </div>
            <button onClick={() => setBulkActionMsg(null)} className="text-on-surface-variant hover:text-on-surface cursor-pointer ml-2">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading expenses...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant space-y-2">
            <Receipt className="w-8 h-8 mx-auto text-outline" />
            <p className="text-xs font-medium text-on-surface">No expenses found</p>
            <p className="text-xs">Create a new expense entry linked to a maintenance ticket.</p>
            <button
              onClick={() => setShowCreateExpenseModal(true)}
              className="mt-2 px-3 py-1.5 rounded bg-primary text-on-primary text-xs font-medium hover:bg-primary-container inline-flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create First Expense</span>
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs text-left text-on-surface">
                <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-wider border-b border-outline-variant">
                  <tr>
                    <th className="w-8 px-2 py-3"></th>
                    <th className="px-4 py-3">Exp</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Worker / Technician</th>
                    <th className="px-4 py-3">Linked Ticket</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Responsible Store</th>
                    <th className="px-4 py-3">Expense Bill</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Approval Status & Assignee</th>
                    <th className="px-4 py-3">Claim Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                    <th className="w-10 px-2 py-3 text-center" title="Select All Pending Expenses">
                      <input
                        type="checkbox"
                        className="rounded border-outline-variant text-primary focus:ring-primary cursor-pointer h-3.5 w-3.5"
                        checked={selectedExpenseIdsForBulk.length === pendingExpenses.length && pendingExpenses.length > 0}
                        onChange={handleSelectAllPending}
                        disabled={pendingExpenses.length === 0}
                        title={pendingExpenses.length > 0 ? "Select all pending expenses" : "No pending expenses"}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className={isMultiLineView ? "" : "divide-y divide-outline-variant"}>
                  {paginatedExpenses.map((exp: any, expIdx: number) => {
                    const isOdd = expIdx % 2 === 1;
                    const catName = exp.expense_type_detail?.expense_name || (typeof exp.expense_type === 'object' ? exp.expense_type?.expense_name : 'General');
                    const workerName = exp.worker_detail?.full_name || exp.worker_detail?.username || `Worker ${exp.worker}`;
                    const rawTicket = exp.ticket_details || exp.ticket;
                    const ticketNo = typeof rawTicket === 'object' && rawTicket ? (rawTicket.work_order_no || `${rawTicket.ticket_id || rawTicket.id}`) : (rawTicket ? `${rawTicket}` : 'N/A');
                    const storeName = typeof exp.responsible_store === 'object' && exp.responsible_store ? exp.responsible_store.store_name : (exp.store_detail?.store_name || 'General');
                    const rawStatus = exp.status_display || (exp.approved ? 'Approved' : 'Pending Approval');
                    const isExpanded = !!expandedExpenseIds[exp.expense_id];
                    const approvalData = getExpenseApprovalGroup(exp);

                    const mediaList: any[] = [
                      ...(exp.receipts || []),
                      ...(exp.receipt && !exp.receipts?.some((r: any) => r.media_id === exp.receipt?.media_id) ? [exp.receipt] : [])
                    ];

                    const activePendingInstance = approvalData?.group?.items?.find(i => i.status === 'Pending');
                    const reworkInstance = approvalData?.group?.items?.find((i: any) => i.status === 'Rework');
                    const rejectedInstance = approvalData?.group?.items?.find((i: any) => i.status === 'Rejected');
                    const latestInstance = approvalData?.group?.items?.[0] || approvalData?.app;

                    const isExpenseApproved = exp.approved === true || rawStatus === 'Approved';

                    // An expense is actively in Rework ONLY if it has not yet been resubmitted to Pending
                    const isCurrentlyRework = !isExpenseApproved && !activePendingInstance && (
                      rawStatus === 'Rework' ||
                      (approvalData?.app?.status === 'Rework') ||
                      (latestInstance?.status === 'Rework')
                    );

                    // An expense is actively in Rejected ONLY if it has not yet been resubmitted to Pending
                    const isCurrentlyRejected = !isExpenseApproved && !activePendingInstance && !isCurrentlyRework && (
                      rawStatus === 'Rejected' ||
                      (approvalData?.app?.status === 'Rejected') ||
                      (latestInstance?.status === 'Rejected')
                    );

                    const isRework = isCurrentlyRework;
                    const isRejected = isCurrentlyRejected;
                    const isRejectedOrRework = isRework || isRejected;

                    const statusText = isExpenseApproved ? 'Approved' : isRework ? 'Rework' : isRejected ? 'Rejected' : 'Pending Approval';

                    const isPendingState = !isExpenseApproved && !isRejectedOrRework && (!!activePendingInstance || approvalData?.app?.status === 'Pending' || rawStatus === 'Pending Approval');
                    const isExpensePending = isPendingState && ((exp.expense_type_detail as any)?.approve_required !== false && (exp.expense_type as any)?.approve_required !== false);

                    const activeApp: any = activePendingInstance || reworkInstance || rejectedInstance || approvalData?.app || {
                      instance_id: exp.expense_id,
                      step_name: 'Expense Approval',
                      step_order: 1,
                      assigned_role_name: 'Administrator',
                      status: isRework ? ('Rework' as const) : isRejected ? ('Rejected' as const) : ('Pending' as const),
                      created_at: exp.expense_date || '',
                      can_action: isAdmin,
                      expense: exp.expense_id,
                      expense_id: exp.expense_id,
                      is_direct_expense: true
                    };
                    const currentUserId = currentUser?.id ?? currentUser?.user_id;
                    const currentUsername = currentUser?.username;
                    const currentRoleName = (
                      (currentUser?.role as any)?.role_name ||
                      (typeof currentUser?.role === 'string' ? currentUser.role : '') ||
                      currentUser?.role_name ||
                      ''
                    ).toLowerCase().trim();

                    const currentStepInfo = activeApp.workflow_steps?.find(
                      (s: any) => s.step_id === activeApp.step_id || s.step_name === activeApp.step_name || s.step_order === activeApp.step_order
                    );

                    let canUserActionActiveStep = false;
                    if (isAdmin) {
                      canUserActionActiveStep = true;
                    } else if (activeApp?.can_action === true) {
                      canUserActionActiveStep = true;
                    } else {
                      const assignedUserIds: any[] = currentStepInfo?.assigned_users_ids || activeApp?.assigned_users_ids || [];
                      const assignedUserNames: string[] = currentStepInfo?.assigned_users_names || activeApp?.assigned_users_names || [];

                      const stepRoleName = (currentStepInfo?.assigned_role_name || activeApp?.assigned_role_name || '').toLowerCase().trim();
                      const isRoleMatch = Boolean(stepRoleName && currentRoleName && stepRoleName === currentRoleName);

                      const isUserMatch = Boolean(
                        (currentUserId && assignedUserIds.some(id => String(id) === String(currentUserId))) ||
                        (currentUsername && assignedUserNames.some(u => u.toLowerCase() === currentUsername.toLowerCase())) ||
                        (currentUser?.full_name && assignedUserNames.some(u => u.toLowerCase() === currentUser.full_name.toLowerCase()))
                      );

                      canUserActionActiveStep = isUserMatch || isRoleMatch;
                    }

                    const canActionExpense = canUserActionActiveStep;

                    // Person / Approver info
                    let approverDetailText = '';
                    if (isExpenseApproved) {
                      approverDetailText = 'Approved';
                    } else if (isRework) {
                      const reworkUsername = reworkInstance?.action_by_full_name || reworkInstance?.action_by_username || (typeof reworkInstance?.action_by === 'object' ? (reworkInstance.action_by.full_name || reworkInstance.action_by.username) : reworkInstance?.action_by) || (typeof activeApp?.action_by === 'object' ? (activeApp.action_by.full_name || activeApp.action_by.username) : (activeApp?.action_by_full_name || activeApp?.action_by_username)) || '';
                      approverDetailText = reworkUsername ? `Rework requested by ${reworkUsername}` : 'Rework requested';
                    } else if (isRejected) {
                      const rejectedUsername = rejectedInstance?.action_by_full_name || rejectedInstance?.action_by_username || (typeof rejectedInstance?.action_by === 'object' ? (rejectedInstance.action_by.full_name || rejectedInstance.action_by.username) : rejectedInstance?.action_by) || (typeof activeApp?.action_by === 'object' ? (activeApp.action_by.full_name || activeApp.action_by.username) : (activeApp?.action_by_full_name || activeApp?.action_by_username)) || '';
                      approverDetailText = rejectedUsername ? `Rejected by ${rejectedUsername}` : 'Rejected';
                    } else if (activePendingInstance || activeApp) {
                      const appToUse = activePendingInstance || activeApp;
                      const userNames = appToUse.workflow_steps?.find((s: any) => s.step_name === appToUse.step_name)?.assigned_users_names || appToUse.assigned_users_names;
                      if (userNames && userNames.length > 0) {
                        approverDetailText = `Pending: ${userNames.join(', ')}`;
                      } else {
                        approverDetailText = `Pending: ${appToUse.assigned_role_name || 'Assigned Approver'}`;
                      }
                    }

                    // Authorized user check: Same assigned worker, submitter/creator, or administrator
                    const expenseWorkerId = exp.worker_detail?.id ?? exp.worker_detail?.user_id ?? (typeof exp.worker === 'object' ? (exp.worker?.id ?? exp.worker?.user_id) : exp.worker);
                    const expenseCreatorId = exp.added_by?.id ?? exp.added_by?.user_id ?? (typeof exp.added_by === 'object' ? (exp.added_by?.id ?? exp.added_by?.user_id) : exp.added_by) ?? exp.created_by?.id ?? exp.created_by?.user_id ?? exp.created_by;
                    const isSameUser = Boolean(
                      currentUserId && (
                        String(expenseWorkerId) === String(currentUserId) ||
                        String(expenseCreatorId) === String(currentUserId)
                      )
                    );
                    const canEditExpense = Boolean(isAdmin || isSameUser);

                    return (
                      <React.Fragment key={exp.expense_id}>
                        <tr
                          onClick={() => toggleExpandExpense(exp.expense_id)}
                          className={`cursor-pointer transition-colors ${isExpanded
                            ? 'bg-primary/10 dark:bg-primary/20 border-l-4 border-l-primary'
                            : isMultiLineView
                              ? 'bg-amber-50/75 dark:bg-amber-950/30 hover:bg-amber-100/75 dark:hover:bg-amber-950/45 border-l-4 border-l-amber-500 dark:border-l-amber-400 border-t border-amber-200/60 dark:border-amber-900/40'
                              : 'hover:bg-surface-container-high'
                            }`}
                        >
                          <td className="w-8 px-2 py-3 text-center" onClick={(e) => { e.stopPropagation(); toggleExpandExpense(exp.expense_id); }}>
                            <button
                              type="button"
                              className={`p-1 rounded transition-colors cursor-pointer ${isExpanded ? 'bg-primary text-on-primary shadow-xs' : 'hover:bg-surface-container-highest text-on-surface-variant'}`}
                            >
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-semibold text-primary">
                            <div className="flex items-center gap-1.5">
                              <span>{exp.expense_id}</span>
                              {updatingExpenseId === exp.expense_id && (
                                <span title="Updating expense...">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600 dark:text-purple-400" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-on-surface">{catName}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{workerName}</td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {rawTicket ? (
                              <button
                                onClick={() => setSelectedTicketForModal(typeof rawTicket === 'object' ? rawTicket : { ticket_id: rawTicket })}
                                className="font-mono font-medium text-primary hover:underline text-[11px] cursor-pointer"
                              >
                                {ticketNo}
                              </button>
                            ) : (
                              <span className="text-on-surface-variant/60 italic text-[11px]">No Ticket</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant">{exp.expense_date || 'N/A'}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{storeName}</td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {mediaList.length === 0 ? (
                              <span className="text-on-surface-variant/40 italic text-[11px]">None</span>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {mediaList.slice(0, 2).map((m: any, mIdx: number) => {
                                  const url = getMediaUrl(m.file_url);
                                  const isImg = isImage(m.file_name);
                                  const isAud = isAudio(m.file_name);
                                  const isVid = isVideo(m.file_name);

                                  return (
                                    <button
                                      key={m.media_id || mIdx}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMediaPreviewState({ items: mediaList, index: mIdx });
                                      }}
                                      className="w-7 h-7 rounded border border-outline-variant bg-surface-container-high overflow-hidden hover:border-primary transition-all relative flex items-center justify-center cursor-pointer shadow-xs group"
                                      title={`Preview ${m.file_name || 'Receipt'}`}
                                    >
                                      {isImg ? (
                                        <img
                                          src={url}
                                          alt={m.file_name}
                                          style={{ transform: `rotate(${m.rotation || 0}deg)` }}
                                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                        />
                                      ) : isAud ? (
                                        <Headphones className="w-3.5 h-3.5 text-primary" />
                                      ) : isVid ? (
                                        <Video className="w-3.5 h-3.5 text-primary" />
                                      ) : (
                                        <FileText className="w-3.5 h-3.5 text-on-surface-variant" />
                                      )}
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                    </button>
                                  );
                                })}
                                {mediaList.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMediaPreviewState({ items: mediaList, index: 2 });
                                    }}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer"
                                    title={`+${mediaList.length - 2} more media files`}
                                  >
                                    +{mediaList.length - 2}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {parseFloat(exp.amount || '0').toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5">
                              {updatingExpenseId === exp.expense_id ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Updating...
                                </span>
                              ) : (
                                <div>
                                  {renderStatusBadge(
                                    statusText,
                                    isExpensePending && !isRejectedOrRework && canActionExpense,
                                    statusText === 'Pending Approval'
                                      ? (activePendingInstance || activeApp)?.step_name
                                      : undefined,
                                    isExpensePending && Boolean(
                                      (approvalData?.group?.items || (exp as any).approval_instances || []).some(
                                        (inst: any) => inst.status === 'Approved' && (
                                          (inst.action_by_username && currentUsername && inst.action_by_username.toLowerCase() === currentUsername.toLowerCase()) ||
                                          (inst.action_by && currentUserId && (String(inst.action_by) === String(currentUserId) || String((inst.action_by as any)?.id) === String(currentUserId)))
                                        )
                                      )
                                    )
                                  )}
                                  {isExpensePending && !isRejectedOrRework && approverDetailText && (
                                    <div className="text-[10px] text-on-surface-variant font-medium mt-0.5 truncate max-w-[190px]" title={approverDetailText}>
                                      {approverDetailText}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {exp.claim ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                Bundle {typeof exp.claim === 'object' ? exp.claim.claim_id : exp.claim}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Unclaimed
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            {!exp.claim ? (
                              (isRejectedOrRework || isExpenseApproved) ? (
                                <Can permission={canEditExpense ? true : ["maintenance.change_my_expence", "accounts.change_others_expence", "finance.change_expense", "finance.add_expense"] as any}>
                                  <button
                                    type="button"
                                    disabled={updatingExpenseId === exp.expense_id}
                                    onClick={() => openEditExpenseModal(exp)}
                                    className="px-2.5 py-1 rounded border border-outline hover:border-primary text-on-surface text-[11px] font-semibold hover:bg-surface-container-high transition-colors inline-flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-50"
                                    title={isExpenseApproved ? "Edit approved expense (Will move back to Approval)" : "Edit & Resubmit"}
                                  >
                                    <Pencil className="w-3 h-3 text-primary" />
                                    <span>Edit</span>
                                  </button>
                                </Can>
                              ) : (
                                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium italic">In Review</span>
                              )
                            ) : (
                              <span className="text-[11px] text-on-surface-variant/60 font-medium">In Bundle</span>
                            )}
                          </td>
                          {/* CHECKBOX CELL ON RIGHT */}


                          <td className="w-10 px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {isExpensePending && !isRejectedOrRework && canActionExpense ? (
                              <input
                                type="checkbox"
                                className="rounded border-outline-variant text-primary focus:ring-primary cursor-pointer h-3.5 w-3.5"
                                checked={selectedExpenseIdsForBulk.includes(exp.expense_id)}
                                onChange={() => handleToggleSelectExpense(exp.expense_id)}
                                title="Select expense for bulk approval"
                              />
                            ) : isExpensePending && !isRejectedOrRework ? (
                              <span className="inline-block text-amber-500/80 font-mono text-[11px] cursor-help" title={`Pending action by: ${approverDetailText || 'previous step approver'}`}>⏳</span>
                            ) : isExpenseApproved ? (
                              <span className="inline-block text-emerald-600 font-bold text-xs" title="Already Approved">✓</span>
                            ) : (
                              <span className="inline-block text-outline text-xs">-</span>
                            )}
                          </td>
                        </tr>

                        {/* MULTI-LINE VIEW SECOND ROW (Pipeline 1-----2-----3-----4 + Quick Approve/Rework) */}
                        {isMultiLineView && !isExpanded && (
                          <tr className={`border-b-2 border-outline-variant/80 transition-colors ${isOdd
                            ? 'bg-slate-100/90 dark:bg-slate-800/45'
                            : 'bg-white dark:bg-surface-container-lowest'
                            }`}>
                            <td colSpan={13} className="px-4 py-2.5">
                              <div className={`flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5 p-2.5 rounded border ${isOdd
                                ? 'bg-white dark:bg-surface-container/70 border-outline-variant/80 shadow-xs'
                                : 'bg-surface-container-low dark:bg-surface-container-low/70 border-outline-variant/60 shadow-2xs'
                                }`}>
                                {/* Left/Main: Compact Horizontal Stepper Pipeline */}
                                <div className="flex-1 overflow-x-auto min-w-0">
                                  {approvalData?.group ? (
                                    renderApprovalStepper(approvalData.group, true)
                                  ) : (
                                    <div className="text-xs text-on-surface-variant/70 italic px-2 py-1">
                                      No approval workflow required for this expense.
                                    </div>
                                  )}
                                </div>

                                {/* Right: Quick Action Controls (Comment Box + Approve + Rework) */}
                                <div className="shrink-0 flex flex-col items-end gap-1.5 pt-2 xl:pt-0 border-t xl:border-t-0 border-outline-variant/40">
                                  {isExpensePending && !isRejectedOrRework && canActionExpense ? (
                                    <>
                                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full xl:w-auto">
                                        <input
                                          type="text"
                                          value={expenseRemarks[exp.expense_id] || ''}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setExpenseRemarks(prev => ({ ...prev, [exp.expense_id]: val }));
                                            if (val.trim() && reworkErrors[exp.expense_id]) {
                                              setReworkErrors(prev => {
                                                const next = { ...prev };
                                                delete next[exp.expense_id];
                                                return next;
                                              });
                                            }
                                          }}
                                          placeholder="Comment (Required for Rework)..."
                                          className={`px-2.5 py-1.5 rounded border text-xs text-on-surface focus:outline-none placeholder:text-on-surface-variant/60 w-full sm:w-48 xl:w-56 transition-all ${reworkErrors[exp.expense_id]
                                            ? 'border-rose-500 bg-rose-500/10 focus:border-rose-600 focus:ring-1 focus:ring-rose-500'
                                            : 'border-outline bg-surface-container-low focus:border-primary'
                                            }`}
                                        />
                                        <button
                                          type="button"
                                          disabled={actioningExpenseId === exp.expense_id}
                                          onClick={() => handleInlineExpenseAction(exp, 'APPROVED')}
                                          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                                          title="Approve this step"
                                        >
                                          {actioningExpenseId === exp.expense_id && actioningActionType === 'APPROVED' ? (
                                            <>
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              <span>Approving...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Check className="w-3.5 h-3.5" />
                                              <span>Approve</span>
                                            </>
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={actioningExpenseId === exp.expense_id}
                                          onClick={() => handleInlineExpenseAction(exp, 'REWORK')}
                                          className="px-3 py-1.5 rounded bg-gray-400 hover:bg-black text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                                          title="Request rework for this expense"
                                        >
                                          {actioningExpenseId === exp.expense_id && actioningActionType === 'REWORK' ? (
                                            <>
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              <span>Reworking...</span>
                                            </>
                                          ) : (
                                            <>
                                              <RotateCcw className="w-3.5 h-3.5" />
                                              <span>Rework</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                      {reworkErrors[exp.expense_id] && (
                                        <div className="text-[11px]  text-rose-600 dark:text-rose-400 flex items-center gap-1 animate-pulse self-start sm:self-auto">

                                          <span>{reworkErrors[exp.expense_id]}</span>
                                        </div>
                                      )}
                                    </>
                                  ) : isRejectedOrRework ? (
                                    <Can permission={canEditExpense ? true : ["maintenance.change_my_expence", "accounts.change_others_expence", "finance.change_expense", "finance.add_expense"] as any}>
                                      <button
                                        type="button"
                                        disabled={updatingExpenseId === exp.expense_id}
                                        onClick={() => openEditExpenseModal(exp)}
                                        className={`px-3 py-1.5 rounded text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 ${isRejected ? 'bg-rose-600 hover:bg-rose-700' : 'bg-purple-600 hover:bg-purple-700'
                                          }`}
                                      >
                                        {updatingExpenseId === exp.expense_id ? (
                                          <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>Updating...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Pencil className="w-3.5 h-3.5" />
                                            <span>Edit & Resubmit</span>
                                          </>
                                        )}
                                      </button>
                                    </Can>
                                  ) : isExpenseApproved ? (
                                    <div className="flex items-center gap-2">
                                      <span className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                                      </span>
                                      {!exp.claim && (
                                        <Can permission={canEditExpense ? true : ["maintenance.change_my_expence", "accounts.change_others_expence", "finance.change_expense", "finance.add_expense"] as any}>
                                          <button
                                            type="button"
                                            disabled={updatingExpenseId === exp.expense_id}
                                            onClick={() => openEditExpenseModal(exp)}
                                            className="px-2.5 py-1 rounded border border-outline hover:border-primary text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                                            title="Edit approved expense (Will move back to Approval)"
                                          >
                                            <Pencil className="w-3.5 h-3.5 text-primary" />
                                            <span>Edit</span>
                                          </button>
                                        </Can>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* EXPANDED ACCORDION VIEW: VISUAL APPROVAL STEPPER PIPELINE */}
                        {isExpanded && (
                          <tr className="bg-primary/5 dark:bg-primary/10 border-l-4 border-l-primary">
                            <td colSpan={13} className="px-6 py-4 border-b border-outline-variant space-y-4">
                              {/* Visual Stepper Pipeline */}
                              {approvalData?.group ? (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                                      <ShieldCheck className="w-4 h-4 text-primary" /> Approval Progress Pipeline
                                    </span>
                                    {approvalData.app && (
                                      <span className="text-[11px] text-on-surface-variant font-medium">
                                        Current Step: <strong className="text-primary">{approvalData.app.step_name}</strong>
                                      </span>
                                    )}
                                  </div>
                                  {renderApprovalStepper(approvalData.group)}
                                </div>
                              ) : (
                                <div className="p-3 bg-surface-container-low rounded border border-outline-variant text-xs text-on-surface-variant italic">
                                  No approval workflow required or assigned for this expense item.
                                </div>
                              )}

                              {/* Rejected or Rework Banner & Edit Button */}
                              {isRejectedOrRework && (
                                <div className={`p-3.5 rounded border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs ${isRejected ? 'border-rose-500/30 bg-rose-500/10' : 'border-purple-500/30 bg-purple-500/10'
                                  }`}>
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold text-white shadow-xs ${isRejected ? 'bg-rose-600' : 'bg-purple-600'}`}>
                                        {isRejected ? 'Rejected' : 'Rework'}
                                      </span>
                                      <span className="text-xs font-semibold text-on-surface">
                                        {(reworkInstance?.step_name || rejectedInstance?.step_name || activeApp.step_name) || 'Approval'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-on-surface-variant">
                                      {(reworkInstance?.comments || rejectedInstance?.comments || activeApp.comments)
                                        ? `Reason: ${reworkInstance?.comments || rejectedInstance?.comments || activeApp.comments}`
                                        : isRejected
                                          ? 'Rejected. Please edit and resubmit.'
                                          : 'Rework needed. Please edit and resubmit.'}
                                    </p>
                                  </div>

                                  <Can permission={canEditExpense ? true : ["maintenance.change_my_expence", "accounts.change_others_expence", "finance.change_expense", "finance.add_expense"] as any}>
                                    <button
                                      type="button"
                                      disabled={updatingExpenseId === exp.expense_id}
                                      onClick={() => openEditExpenseModal(exp)}
                                      className={`px-3.5 py-1.5 rounded text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 disabled:opacity-50 ${isRejected ? 'bg-rose-600 hover:bg-rose-700' : 'bg-purple-600 hover:bg-purple-700'
                                        }`}
                                    >
                                      {updatingExpenseId === exp.expense_id ? (
                                        <>
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          <span>Updating...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Pencil className="w-3.5 h-3.5" />
                                          <span>Resubmit</span>
                                        </>
                                      )}
                                    </button>
                                  </Can>
                                </div>
                              )}

                              {/* Action / Review Card if pending, not rework/rejected, and user can action or is administrator */}
                              {isExpensePending && !isRejectedOrRework && canActionExpense && (
                                <div className="p-3.5 rounded border border-outline-variant bg-surface-container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        Pending Action
                                      </span>
                                      <span className="text-xs font-semibold text-on-surface">
                                        {activeApp.step_name || 'Expense Approval'} ({activeApp.assigned_role_name || 'Administrator'})
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-on-surface-variant">
                                      {isAdmin
                                        ? 'Administrator permission: You can review and action this approval step directly.'
                                        : (activeApp.can_action
                                          ? 'You are assigned as an authorized approver for this step.'
                                          : `Assigned to ${activeApp.assigned_role_name || 'Administrator'}`)}
                                    </p>
                                  </div>

                                  <div className="flex flex-col items-end gap-1.5 w-full md:w-auto">
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                                      <input
                                        type="text"
                                        value={expenseRemarks[exp.expense_id] || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setExpenseRemarks(prev => ({ ...prev, [exp.expense_id]: val }));
                                          if (val.trim() && reworkErrors[exp.expense_id]) {
                                            setReworkErrors(prev => {
                                              const next = { ...prev };
                                              delete next[exp.expense_id];
                                              return next;
                                            });
                                          }
                                        }}
                                        placeholder="Add remark (Required for Rework)..."
                                        className={`px-3 py-1.5 rounded border text-xs text-on-surface focus:outline-none placeholder:text-on-surface-variant/60 w-full sm:w-56 transition-all ${reworkErrors[exp.expense_id]
                                          ? 'border-rose-500 bg-rose-500/10 focus:border-rose-600 focus:ring-1 focus:ring-rose-500'
                                          : 'border-outline bg-surface-container-low focus:border-primary'
                                          }`}
                                      />
                                      <div className="flex items-center gap-2 shrink-0">
                                        <button
                                          type="button"
                                          disabled={actioningExpenseId === exp.expense_id}
                                          onClick={() => handleInlineExpenseAction(exp, 'APPROVED')}
                                          className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                                        >
                                          {actioningExpenseId === exp.expense_id && actioningActionType === 'APPROVED' ? (
                                            <>
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              <span>Approving...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Check className="w-3.5 h-3.5" />
                                              <span>Approve</span>
                                            </>
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={actioningExpenseId === exp.expense_id}
                                          onClick={() => handleInlineExpenseAction(exp, 'REWORK')}
                                          className="px-3 py-1.5 rounded bg-gray-400 text-white text-xs font-semibold hover:bg-black transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                                        >
                                          {actioningExpenseId === exp.expense_id && actioningActionType === 'REWORK' ? (
                                            <>
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              <span>Reworking...</span>
                                            </>
                                          ) : (
                                            <>
                                              <RotateCcw className="w-3.5 h-3.5" />
                                              <span>Rework</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                    {reworkErrors[exp.expense_id] && (
                                      <div className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 animate-pulse self-start sm:self-auto">
                                        <span>{reworkErrors[exp.expense_id]}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Expense Context Details Card */}
                              <div className="p-3.5 rounded border border-outline-variant bg-surface-container space-y-3">
                                <div className="flex items-center justify-between pb-1 border-b border-outline-variant/60">
                                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface">Expense Information</span>
                                  {!exp.claim && (isRejectedOrRework || isExpenseApproved) && (
                                    <Can permission={canEditExpense ? true : ["maintenance.change_my_expence", "accounts.change_others_expence", "finance.change_expense", "finance.add_expense"] as any}>
                                      <button
                                        type="button"
                                        disabled={updatingExpenseId === exp.expense_id}
                                        onClick={() => openEditExpenseModal(exp)}
                                        className="px-3 py-1.5 rounded border border-outline hover:border-primary text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                                        title={isExpenseApproved ? "Edit approved expense (Will move back to Approval)" : "Edit expense"}
                                      >
                                        <Pencil className="w-3.5 h-3.5 text-primary" />
                                        <span>{isExpenseApproved ? 'Edit (Moves to Approval)' : 'Edit Expense'}</span>
                                      </button>
                                    </Can>
                                  )}
                                </div>


                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                  <div>
                                    <span className="text-[10px] text-on-surface-variant font-medium block">Expense Category</span>
                                    <span className="text-on-surface font-semibold">{catName}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-on-surface-variant font-medium block">Technician / Worker</span>
                                    <span className="text-on-surface font-medium">{workerName}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-on-surface-variant font-medium block">Responsible Store</span>
                                    <span className="text-on-surface font-medium">{storeName}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-on-surface-variant font-medium block">Amount</span>
                                    <span className="text-emerald-600 font-bold">{parseFloat(exp.amount || '0').toFixed(2)}</span>
                                  </div>
                                </div>

                                {getCleanRemarks(exp.remarks) && (
                                  <div className="pt-2 border-t border-outline-variant/60">
                                    <span className="text-[10px] text-on-surface-variant font-medium block mb-1">Remarks / Description:</span>
                                    <p className="p-2.5 rounded bg-surface-container-low border border-outline-variant/80 italic text-on-surface text-xs">
                                      "{getCleanRemarks(exp.remarks)}"
                                    </p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Component */}
            <Pagination
              currentPage={currentPage}
              totalItems={totalItemsCount}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </>
        )}
      </div>

      {/* MODAL: CREATE NEW EXPENSE */}
      {showCreateExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-surface-container rounded border border-outline-variant/80 max-w-xl w-full p-6 sm:p-7 shadow-2xl text-on-surface relative overflow-hidden transition-all h-[85vh] max-h-[720px] min-h-[560px] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-outline-variant/80 pb-3.5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface tracking-tight">Create New Expense Entry</h3>
                  <p className="text-xs text-on-surface-variant font-normal mt-0.5">Submit maintenance costs, parts, travel, or service bills</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { resetForm(); setShowCreateExpenseModal(false); }}
                className="p-2 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs flex items-start justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-1 duration-150 shrink-0 mt-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span className="whitespace-pre-line leading-relaxed font-medium">{formError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormError(null)}
                  className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-500/15 shrink-0 cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {loadingDropdowns ? (
              <div className="flex-1 flex items-center justify-center p-10 text-center text-xs text-on-surface-variant gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading form options...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col justify-between pt-4 pr-1 space-y-4">
                <div className="space-y-4">
                  {/* STEP 1: TICKET SELECTION OPTION (Always visible) */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span>Select Maintenance Ticket *</span>
                      </span>
                      {ticketSearching && (
                        <span className="text-[10px] text-primary font-normal flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Searching API...
                        </span>
                      )}
                    </label>
                    <SearchableSelect
                      value={selectedTicketId}
                      onChange={(val) => handleTicketChange(val)}
                      onSearchChange={(q) => setTicketSearchQuery(q)}
                      loading={ticketSearching}
                      options={[
                        { value: '', label: 'Select Linked Maintenance Ticket' },
                        ...ticketsList.map(t => ({
                          value: String(t.ticket_id || t.id),
                          label: `Ticket #${t.ticket_id || t.id} ${t.work_order_no ? `(WO: ${t.work_order_no})` : ''} - ${t.title || 'Support Ticket'}`
                        }))
                      ]}
                      placeholder="-- Search Ticket by WO# or Title"
                    />
                  </div>

                  {!selectedTicketId ? (
                    <div className="p-8 rounded bg-surface-container-low border border-dashed border-outline-variant text-center text-xs text-on-surface-variant flex flex-col items-center justify-center gap-2 my-4">
                      <Ticket className="w-8 h-8 text-on-surface-variant/40" />
                      <span>Select a maintenance ticket above to unlock workers, store, and expense details.</span>
                    </div>
                  ) : (
                    <>
                      {/* STEP 2: WORKER, STORE & CATEGORY (Shown after ticket is selected) */}
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* WORKER / TECHNICIAN */}
                        <div>
                          <label className="block text-xs font-semibold text-on-surface mb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-primary" />
                              <span>Allocated Worker / Technician</span>
                            </span>
                            {/* {ticketWorkers.length > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium border border-primary/20">
                                {ticketWorkers.length} assigned to ticket
                              </span>
                            )} */}
                          </label>
                          <SearchableSelect
                            value={selectedWorkerId}
                            onChange={(val) => setSelectedWorkerId(val)}
                            options={workerDropdownOptions}
                            placeholder="-- Select Worker --"
                          />
                        </div>

                        {/* RESPONSIBLE STORE */}
                        <div>
                          <label className="block text-xs font-semibold text-on-surface mb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-primary" />
                              <span>Responsible Store</span>
                            </span>
                            {selectedTicketStore && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium border border-primary/20">
                                Restricted to Ticket's Store
                              </span>
                            )}
                          </label>
                          <SearchableSelect
                            value={selectedStoreId}
                            onChange={(val) => setSelectedStoreId(val)}
                            options={storeDropdownOptions}
                            placeholder="-- Select Store --"
                          />
                        </div>

                        {/* EXPENSE TYPE CATEGORY */}
                        <div>
                          <label className="block text-xs font-semibold text-on-surface mb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Receipt className="w-3.5 h-3.5 text-primary" />
                              <span>Expense Category *</span>
                            </span>
                            {selectedTicketDepartment && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium border border-primary/20">
                                Restricted to {selectedTicketDepartment.departmentName}
                              </span>
                            )}
                          </label>
                          <SearchableSelect
                            value={selectedExpenseTypeId}
                            onChange={(val) => setSelectedExpenseTypeId(val)}
                            options={expenseTypeDropdownOptions}
                            placeholder="-- Select Expense Category --"
                          />
                        </div>
                      </div>

                      {!selectedExpenseTypeId ? (
                        <div className="p-3.5 rounded bg-surface-container-low border border-dashed border-outline-variant text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
                          <span>Select an expense category to enter amount and bill details.</span>
                        </div>
                      ) : (
                        <>
                          {/* STEP 3: AMOUNT & EXPENSE DATE (Shown after category is selected) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div>
                              <label className="block text-xs font-semibold text-on-surface mb-1.5 flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5 text-primary" />
                                <span>Amount ($) *</span>
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-xs rounded px-3.5 py-2.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs hover:border-outline"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-on-surface mb-1.5 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-primary" />
                                <span>Expense Date *</span>
                              </label>
                              <input
                                type="date"
                                value={expenseDate}
                                onChange={(e) => setExpenseDate(e.target.value)}
                                className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-xs rounded px-3.5 py-2.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs hover:border-outline cursor-pointer"
                                required
                              />
                            </div>
                          </div>

                          {(!amount || parseFloat(amount) <= 0) ? (
                            <div className="p-3 rounded bg-surface-container-low border border-dashed border-outline-variant text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
                              <span>Enter the expense amount above to add remarks and receipts.</span>
                            </div>
                          ) : (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                              {/* STEP 4: REMARKS / DESCRIPTION */}
                              <div>
                                <label className="block text-xs font-semibold text-on-surface mb-1.5">Remarks / Description</label>
                                <textarea
                                  rows={2}
                                  placeholder="Optional notes or details about this expense..."
                                  value={remarks}
                                  onChange={(e) => setRemarks(e.target.value)}
                                  className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-xs rounded p-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs hover:border-outline resize-none"
                                />
                              </div>

                              {/* STEP 5: RECEIPT & MEDIA FILES SELECTION */}
                              {selectedExpenseTypeObj && (
                                <div className="space-y-2 pt-1">
                                  <label className="block text-xs font-semibold text-on-surface mb-1.5 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                      <Paperclip className="w-3.5 h-3.5 text-primary" />
                                      <span>Receipt / Attachments</span>
                                      {isReceiptRequired ? (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20 ml-1">
                                          * Required
                                        </span>
                                      ) : (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20 ml-1">
                                          Optional
                                        </span>
                                      )}
                                    </span>
                                    {attachedMediaList.length > 0 && (
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold border border-primary/20">
                                        {attachedMediaList.length} file(s) attached
                                      </span>
                                    )}
                                  </label>
                                  <div
                                    onClick={() => document.getElementById('expense-receipt-file-input')?.click()}
                                    className="border-2 border-dashed border-outline-variant hover:border-primary hover:bg-primary/5 rounded p-4 sm:p-5 text-center cursor-pointer bg-surface-container-low/70 transition-all group"
                                  >
                                    <input
                                      id="expense-receipt-file-input"
                                      type="file"
                                      multiple
                                      accept="image/*,application/pdf,video/*"
                                      className="hidden"
                                      onChange={handleFilePicked}
                                    />
                                    <div className="flex flex-col items-center gap-1.5 text-on-surface-variant">
                                      <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-on-primary transition-all duration-200 shadow-xs">
                                        <Upload className="w-5 h-5" />
                                      </div>
                                      <p className="text-xs font-semibold text-on-surface">Click or drag receipts (Images, PDFs, Videos)</p>
                                      <p className="text-[10px] text-on-surface-variant">
                                        {isReceiptRequired ? 'Receipt files are mandatory for this category' : 'Receipt files are optional for this category'}
                                      </p>
                                    </div>
                                  </div>

                                  {/* ATTACHED MEDIA PREVIEW BADGES */}
                                  {attachedMediaList.length > 0 && (
                                    <div className="mt-2.5 space-y-2 max-h-36 overflow-y-auto scrollbar-thin">
                                      {attachedMediaList.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between p-2.5 rounded bg-surface-container-high border border-outline-variant/80 text-xs shadow-2xs hover:border-outline transition-all">
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            {item.file.type.startsWith('image/') ? (
                                              <div className="w-9 h-9 rounded bg-black/80 border border-outline-variant/60 overflow-hidden flex items-center justify-center shrink-0">
                                                <img
                                                  src={item.previewUrl}
                                                  alt={item.file.name}
                                                  style={{ transform: `rotate(${item.rotation}deg)` }}
                                                  className="w-full h-full object-contain"
                                                />
                                              </div>
                                            ) : (
                                              <div className="w-9 h-9 rounded bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                                <Paperclip className="w-4 h-4 text-primary" />
                                              </div>
                                            )}
                                            <div className="min-w-0">
                                              <p className="font-semibold text-on-surface truncate text-xs">{item.file.name}</p>
                                              <p className="text-[10px] text-on-surface-variant">
                                                {(item.file.size / 1024).toFixed(1)} KB {item.rotation ? `• Rotated ${item.rotation}°` : ''}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => setPendingUploadQueue([item])}
                                              className="px-2.5 py-1 rounded border border-outline-variant text-[11px] font-medium text-on-surface hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
                                              title="Rotate / Review file"
                                            >
                                              Rotate
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveAttachedMedia(item.id)}
                                              className="p-1.5 rounded text-on-surface-variant hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                              title="Remove file"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/80 shrink-0 mt-auto">
                  <button
                    type="button"
                    onClick={() => { resetForm(); setShowCreateExpenseModal(false); }}
                    className="px-4 py-2 rounded border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedTicketId || !selectedExpenseTypeId || !amount}
                    className="px-5 py-2.5 rounded bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 active:scale-[0.98] shadow-md hover:shadow-primary/25 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <span>Submit Expense Entry</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: PRE-UPLOAD MEDIA ROTATION & REVIEW */}
      {pendingUploadQueue && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-surface-container rounded border border-outline-variant/80 max-w-2xl w-full p-6 space-y-5 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/80">
              <div>
                <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Review & Adjust Orientation</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">Rotate image(s) upright before attaching ({pendingUploadQueue.length} selected)</p>
              </div>
              <button
                type="button"
                onClick={handleCancelPendingUpload}
                className="p-2 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-2 overflow-y-auto max-h-[60vh] space-y-4 my-2 scrollbar-thin">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pendingUploadQueue.map((item, idx) => (
                  <div key={item.id} className="bg-surface-container-low p-3.5 rounded border border-outline-variant flex flex-col gap-2.5 relative shadow-2xs">
                    <div className="w-full h-44 bg-black/80 rounded overflow-hidden flex items-center justify-center relative p-1 border border-outline-variant/50">
                      {item.file.type.startsWith('image/') ? (
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          style={{
                            transform: `rotate(${item.rotation}deg)`,
                            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : item.file.type.startsWith('video/') ? (
                        <video
                          src={item.previewUrl}
                          controls
                          style={{
                            transform: `rotate(${item.rotation}deg)`,
                            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <div className="text-white text-xs font-semibold p-4 text-center">
                          <Paperclip className="w-8 h-8 mx-auto mb-2 text-primary" />
                          <span>{item.file.name}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-medium text-on-surface truncate max-w-[140px]" title={item.file.name}>
                        {item.file.name}
                      </span>

                      {(item.file.type.startsWith('image/') || item.file.type.startsWith('video/')) && (
                        <div className="flex items-center gap-1 bg-surface-container-high px-2 py-1 rounded border border-outline-variant">
                          <button
                            type="button"
                            onClick={() => {
                              setPendingUploadQueue(prev => prev ? prev.map((it, i) => i === idx ? { ...it, rotation: (it.rotation - 90 + 360) % 360 } : it) : null);
                            }}
                            className="p-1 text-on-surface hover:text-primary rounded cursor-pointer transition-colors"
                            title="Rotate 90° Left"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] font-bold text-primary px-1">{item.rotation}°</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingUploadQueue(prev => prev ? prev.map((it, i) => i === idx ? { ...it, rotation: (it.rotation + 90) % 360 } : it) : null);
                            }}
                            className="p-1 text-on-surface hover:text-primary rounded cursor-pointer transition-colors"
                            title="Rotate 90° Right"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-outline-variant/80">
              <button
                type="button"
                onClick={handleCancelPendingUpload}
                className="px-4 py-2 border border-outline-variant rounded text-xs font-semibold text-on-surface hover:bg-surface-container-high cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPendingUpload}
                className="px-5 py-2.5 bg-primary text-on-primary text-xs font-bold rounded hover:bg-primary/90 shadow-md hover:shadow-primary/25 transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                Attach Media ({pendingUploadQueue.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: EXPENSE ITEM DETAILS */}
      {previewExpenseItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150" onClick={() => setPreviewExpenseItem(null)}>
          <div className="bg-surface-container rounded border border-outline-variant/80 max-w-xl w-full p-6 sm:p-7 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-outline-variant/80 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface tracking-tight">Expense #{previewExpenseItem.expense_id}</h3>
                  <p className="text-xs text-on-surface-variant font-normal">Line item transaction summary</p>
                </div>
              </div>
              <button onClick={() => setPreviewExpenseItem(null)} className="p-2 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {/* Visual Approval Stepper Pipeline in Preview Modal */}
            {(() => {
              const modalApprovalData = getExpenseApprovalGroup(previewExpenseItem);
              if (!modalApprovalData?.group) return null;
              return (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-on-surface flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Multi-Step Approval Progress
                  </span>
                  {renderApprovalStepper(modalApprovalData.group)}
                </div>
              );
            })()}

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-outline-variant/50">
                <span className="text-on-surface-variant font-medium">Category:</span>
                <span className="font-semibold text-on-surface">
                  {previewExpenseItem.expense_type_detail?.expense_name || 'General'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-outline-variant/50">
                <span className="text-on-surface-variant font-medium">Amount:</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                  {parseFloat(previewExpenseItem.amount || '0').toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-outline-variant/50">
                <span className="text-on-surface-variant font-medium">Expense Date:</span>
                <span className="font-semibold text-on-surface">{previewExpenseItem.expense_date || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-outline-variant/50">
                <span className="text-on-surface-variant font-medium">Worker:</span>
                <span className="font-semibold text-on-surface">
                  {previewExpenseItem.worker_detail?.full_name || previewExpenseItem.worker_detail?.username || `Worker #${previewExpenseItem.worker}`}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-outline-variant/50">
                <span className="text-on-surface-variant font-medium">Store Location:</span>
                <span className="font-semibold text-on-surface">
                  {typeof previewExpenseItem.responsible_store === 'object' && previewExpenseItem.responsible_store ? previewExpenseItem.responsible_store.store_name : ((previewExpenseItem as any).store_detail?.store_name || 'General')}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-outline-variant/50">
                <span className="text-on-surface-variant font-medium">Linked Ticket:</span>
                <span className="font-semibold text-primary font-mono">
                  {(() => {
                    const rawTicket: any = previewExpenseItem.ticket_details || previewExpenseItem.ticket;
                    if (typeof rawTicket === 'object' && rawTicket) {
                      return rawTicket.work_order_no || (rawTicket.ticket_id ? `#${rawTicket.ticket_id}` : 'Linked Ticket');
                    }
                    return rawTicket ? `#${rawTicket}` : 'None';
                  })()}
                </span>
              </div>
              {getCleanRemarks(previewExpenseItem.remarks) && (
                <div className="pt-2">
                  <span className="text-on-surface-variant font-medium block mb-1">Remarks / Description:</span>
                  <p className="p-2 rounded bg-surface-container-low border border-outline-variant italic text-on-surface text-xs">
                    {getCleanRemarks(previewExpenseItem.remarks)}
                  </p>
                </div>
              )}

              {(() => {
                const modalMedia: any[] = [
                  ...(previewExpenseItem.receipts || []),
                  ...(previewExpenseItem.receipt && !previewExpenseItem.receipts?.some((r: any) => r.media_id === previewExpenseItem.receipt?.media_id) ? [previewExpenseItem.receipt] : [])
                ];
                if (modalMedia.length === 0) return null;
                return (
                  <div className="pt-3 border-t border-outline-variant/60">
                    <span className="text-[11px] font-semibold text-on-surface flex items-center gap-1.5 mb-2">
                      <Paperclip className="w-3.5 h-3.5 text-primary" /> Attached Expense Bill ({modalMedia.length})
                    </span>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {modalMedia.map((m, mIdx) => {
                        const url = getMediaUrl(m.file_url);
                        const isImg = isImage(m.file_name);
                        return (
                          <button
                            key={m.media_id || mIdx}
                            type="button"
                            onClick={() => setMediaPreviewState({ items: modalMedia, index: mIdx })}
                            className="flex items-center gap-2.5 p-2 rounded bg-surface-container-high border border-outline-variant/80 hover:border-primary text-xs transition-all cursor-pointer text-left group shadow-2xs"
                          >
                            <div className="w-9 h-9 rounded overflow-hidden bg-black/10 shrink-0 flex items-center justify-center relative border border-outline-variant/50">
                              {isImg ? (
                                <img
                                  src={url}
                                  alt={m.file_name}
                                  style={{ transform: `rotate(${m.rotation || 0}deg)` }}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : isAudio(m.file_name) ? (
                                <Headphones className="w-4 h-4 text-primary" />
                              ) : isVideo(m.file_name) ? (
                                <Video className="w-4 h-4 text-primary" />
                              ) : (
                                <FileText className="w-4 h-4 text-on-surface-variant" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-on-surface truncate text-[11px]">{m.file_name || `Receipt #${m.media_id}`}</p>
                              <p className="text-[9px] text-primary font-semibold flex items-center gap-0.5 mt-0.5">
                                <Eye className="w-2.5 h-2.5" /> Preview
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-outline-variant/80">
              {(() => {
                const previewApprovalData = getExpenseApprovalGroup(previewExpenseItem);
                const isPreviewReworkOrRejected = Boolean(
                  previewExpenseItem.status_display === 'Rework' ||
                  previewExpenseItem.status_display === 'Rejected' ||
                  previewApprovalData?.app?.status === 'Rework' ||
                  previewApprovalData?.app?.status === 'Rejected'
                );
                const canEditPreview = !previewExpenseItem.claim && (previewExpenseItem.approved || isPreviewReworkOrRejected);
                if (!canEditPreview) return <div />;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      const itemToEdit = previewExpenseItem;
                      setPreviewExpenseItem(null);
                      openEditExpenseModal(itemToEdit);
                    }}
                    className="px-3.5 py-2 rounded bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Edit expense details"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Expense</span>
                  </button>
                );
              })()}
              <button
                onClick={() => setPreviewExpenseItem(null)}
                className="px-4 py-2 rounded border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: EDIT & RESUBMIT EXPENSE */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-surface-container rounded border border-outline-variant/80 max-w-3xl w-full p-6 sm:p-7 space-y-5 shadow-2xl text-on-surface relative overflow-hidden transition-all max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-outline-variant/80 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs shrink-0">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface tracking-tight">Edit & Resubmit Expense #{editingExpense.expense_id}</h3>
                  <p className="text-xs text-on-surface-variant font-normal mt-0.5">Saving updates will reset approval to the initial step (Step 1)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { resetForm(); setEditingExpense(null); }}
                className="p-2 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs flex items-start justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5 min-w-0">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span className="whitespace-pre-line leading-relaxed font-medium">{formError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormError(null)}
                  className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-500/15 shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleUpdateExpenseSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Linked Maintenance Ticket */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      <span>Linked Maintenance Ticket *</span>
                    </span>
                    {ticketSearching && (
                      <span className="text-[10px] text-primary font-normal flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Searching...
                      </span>
                    )}
                  </label>
                  <SearchableSelect
                    value={selectedTicketId}
                    onChange={(val) => handleTicketChange(val)}
                    onSearchChange={(q) => setTicketSearchQuery(q)}
                    loading={ticketSearching}
                    options={[
                      { value: '', label: 'Select Linked Maintenance Ticket' },
                      ...ticketsList.map(t => ({
                        value: String(t.ticket_id || t.id),
                        label: `Ticket #${t.ticket_id || t.id} ${t.work_order_no ? `(WO: ${t.work_order_no})` : ''} - ${t.title || 'Support Ticket'}`
                      }))
                    ]}
                    placeholder="-- Select Linked Maintenance Ticket"
                  />
                </div>

                {/* Worker / Technician */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary" />
                      <span>Worker / Technician</span>
                    </span>
                    {/* {ticketWorkers.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium border border-primary/20">
                        {ticketWorkers.length} assigned to ticket
                      </span>
                    )} */}
                  </label>
                  <SearchableSelect
                    value={selectedWorkerId}
                    onChange={(val) => setSelectedWorkerId(val)}
                    options={workerDropdownOptions}
                    placeholder="-- Select Worker --"
                  />
                </div>

                {/* Responsible Store (Disabled by default, bound to ticket) */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-primary" />
                      <span>Responsible Store</span>
                    </span>
                    {/* <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium border border-outline-variant">
                      Auto-linked to Ticket
                    </span> */}
                  </label>
                  <input
                    type="text"
                    disabled
                    value={selectedTicketStore ? selectedTicketStore.storeName : (selectedTicketId ? 'No store linked to ticket' : 'Select ticket first')}
                    className="w-full bg-surface-container-high/60 border border-outline-variant text-on-surface-variant text-xs rounded px-3.5 py-2.5 cursor-not-allowed font-medium"
                  />
                </div>

                {/* Expense Category */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-primary" />
                      <span>Expense Category *</span>
                    </span>
                    {/* {selectedTicketDepartment && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium border border-primary/20">
                        {selectedTicketDepartment.departmentName}
                      </span>
                    )} */}
                  </label>
                  <SearchableSelect
                    value={selectedExpenseTypeId}
                    onChange={(val) => setSelectedExpenseTypeId(val)}
                    options={expenseTypeDropdownOptions}
                    placeholder="-- Select Expense Category --"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1.5 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-primary" />
                    <span>Amount *</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 rounded border border-outline bg-surface-container-low text-xs text-on-surface focus:outline-none focus:border-primary font-semibold shadow-2xs"
                    required
                  />
                </div>

                {/* Expense Date */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>Expense Date *</span>
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded border border-outline bg-surface-container-low text-xs text-on-surface focus:outline-none focus:border-primary cursor-pointer shadow-2xs"
                    required
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  <span>Remarks / Explanation</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="Provide updated information or response to rework request..."
                  className="w-full px-3.5 py-2.5 rounded border border-outline bg-surface-container-low text-xs text-on-surface focus:outline-none focus:border-primary placeholder:text-on-surface-variant/60 resize-none shadow-2xs"
                />
              </div>

              {/* Existing Receipts Component using MediaGrid */}
              <div className="pt-3 border-t border-outline-variant/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-primary" />
                    <span>Current Attached Receipts ({existingReceipts.length})</span>
                  </span>
                  <span className="text-[10px] text-on-surface-variant">Click receipt to preview / rotate</span>
                </div>

                {existingReceipts.length > 0 ? (
                  <MediaGrid
                    items={existingReceipts}
                    emptyLabel="No receipts attached yet"
                    onDelete={handleDeleteExistingReceipt}
                    token={token}
                  />
                ) : (
                  <div className="p-3 bg-surface-container-low border border-dashed border-outline-variant rounded text-center text-xs text-on-surface-variant">
                    No receipts currently attached.
                  </div>
                )}
              </div>

              {/* Upload New / Additional Receipts */}
              <div className="space-y-2 pt-2 border-t border-outline-variant/60">
                <label className="block text-xs font-semibold text-on-surface mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-primary" />
                    <span>Attach New / Additional Receipts</span>
                  </span>
                  {attachedMediaList.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold border border-primary/20">
                      {attachedMediaList.length} new file(s) added
                    </span>
                  )}
                </label>
                <div
                  onClick={() => document.getElementById('edit-expense-receipt-input')?.click()}
                  className="border-2 border-dashed border-outline-variant hover:border-primary hover:bg-primary/5 rounded p-4 text-center cursor-pointer bg-surface-container-low/70 transition-all group"
                >
                  <input
                    id="edit-expense-receipt-input"
                    type="file"
                    multiple
                    accept="image/*,application/pdf,video/*"
                    className="hidden"
                    onChange={handleFilePicked}
                  />
                  <div className="flex flex-col items-center gap-1 text-on-surface-variant">
                    <Upload className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                    <p className="text-xs font-medium text-on-surface">Click to add receipts (Images, PDFs, Videos)</p>
                    <p className="text-[10px] text-on-surface-variant">Files will be attached when you resubmit</p>
                  </div>
                </div>

                {/* Newly Picked Media Preview Badges */}
                {attachedMediaList.length > 0 && (
                  <div className="space-y-2 max-h-36 overflow-y-auto scrollbar-thin">
                    {attachedMediaList.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded bg-surface-container-high border border-outline-variant/80 text-xs shadow-2xs">
                        <div className="flex items-center gap-2 min-w-0">
                          {item.file.type.startsWith('image/') ? (
                            <div className="w-8 h-8 rounded bg-black/80 border border-outline-variant/60 overflow-hidden flex items-center justify-center shrink-0">
                              <img
                                src={item.previewUrl}
                                alt={item.file.name}
                                style={{ transform: `rotate(${item.rotation}deg)` }}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                              <Paperclip className="w-3.5 h-3.5 text-primary" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-on-surface truncate text-xs">{item.file.name}</p>
                            <p className="text-[10px] text-on-surface-variant">
                              {(item.file.size / 1024).toFixed(1)} KB {item.rotation ? `• Rotated ${item.rotation}°` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPendingUploadQueue([item])}
                            className="px-2 py-1 rounded border border-outline-variant text-[11px] font-medium text-on-surface hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
                            title="Rotate / Review file"
                          >
                            Rotate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachedMedia(item.id)}
                            className="p-1 rounded text-on-surface-variant hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/80">
                <button
                  type="button"
                  onClick={() => { resetForm(); setEditingExpense(null); }}
                  className="px-4 py-2 border border-outline-variant rounded text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(updatingExpenseId) || submitting}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {Boolean(updatingExpenseId) || submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Expense...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Save & Resubmit to Step 1</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX MEDIA PREVIEW MODAL */}
      {mediaPreviewState && (
        <MediaPreviewModal
          items={mediaPreviewState.items}
          previewIndex={mediaPreviewState.index}
          onClose={() => setMediaPreviewState(null)}
          token={token}
        />
      )}
    </div>
  );
};
