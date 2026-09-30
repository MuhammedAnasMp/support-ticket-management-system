import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt, PlusCircle, Trash2, X, AlertCircle, Loader2, FileText, Eye, CheckCircle2, Building2, Calendar, DollarSign, User, Paperclip, Upload, RotateCcw, RotateCw, Image as ImageIcon, ShieldCheck, Headphones, Video
} from 'lucide-react';
import type { ExpenseItem } from './types';
import { ApprovalsSubpage, type ApprovalsSubpageProps } from './ApprovalsSubpage';
import { MediaPreviewModal, getMediaUrl, isImage, isAudio, isVideo, type Media } from '../ticket/TicketsTypesAndComponents';

interface PendingMediaItem {
  id: string;
  file: File;
  previewUrl: string;
  rotation: number;
}
import { Pagination } from './Pagination';
import { SearchableSelect, type SelectOption } from '../../components/SearchableSelect';

interface ExpensesSubpageProps {
  expenses: ExpenseItem[];
  filteredExpenses: ExpenseItem[];
  loading: boolean;
  submitting: boolean;
  renderStatusBadge: (status: string) => React.ReactNode;
  showCreateExpenseModal: boolean;
  setShowCreateExpenseModal: (show: boolean) => void;
  handleCreateExpense: (formData: any) => Promise<void>;
  setSelectedTicketForModal: (ticket: any) => void;
  setPreviewMediaUrl: (media: { url: string; title: string } | null) => void;
  token: string;
  currentUser: any;
  API_URL: string;
  approvalsProps?: ApprovalsSubpageProps;
}

export const ExpensesSubpage: React.FC<ExpensesSubpageProps> = ({
  expenses,
  filteredExpenses,
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
  approvalsProps
}) => {
  // Sub-Tab View State
  const [activeViewTab, setActiveViewTab] = useState<'list' | 'approvals'>('list');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Form State for Create Expense Modal
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [selectedExpenseTypeId, setSelectedExpenseTypeId] = useState<string>('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState<string>('');
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

  // Lightbox Media Preview State
  const [mediaPreviewState, setMediaPreviewState] = useState<{ items: any[]; index: number } | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredExpenses.length]);

  // Fetch dropdown metadata when modal opens (tickets fetched via page=1&page_size=100)
  useEffect(() => {
    if (showCreateExpenseModal && token) {
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
  }, [showCreateExpenseModal, token, API_URL]);

  // Dynamic Ticket Search via API effect (debounced)
  useEffect(() => {
    if (!showCreateExpenseModal || !token) return;
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
  }, [ticketSearchQuery, showCreateExpenseModal, token, API_URL, selectedTicketId]);

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

  const totalAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (parseFloat(String(e.amount)) || 0), 0);
  }, [filteredExpenses]);

  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredExpenses.slice(start, start + itemsPerPage);
  }, [filteredExpenses, currentPage, itemsPerPage]);

  const pendingApprovalsCount = useMemo(() => {
    if (!approvalsProps?.displayedApprovals) return 0;
    return approvalsProps.displayedApprovals.filter(a => {
      const type = a.target_summary?.type || (a.claim ? 'Bundle' : (a.ledger ? 'Ledger' : 'Expense'));
      return type === 'Expense' && a.status === 'Pending';
    }).length;
  }, [approvalsProps]);

  return (
    <div className="space-y-4">
      {/* Sub-Navigation Tabs */}
      {approvalsProps && (
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveViewTab('list')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${activeViewTab === 'list'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant'
                }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Expense Line Items</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewTab('approvals')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${activeViewTab === 'approvals'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant'
                }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Expense Approvals Queue</span>
              {pendingApprovalsCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500 text-white font-bold">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          </div>


        </div>
      )}

      {activeViewTab === 'approvals' && approvalsProps ? (
        <ApprovalsSubpage {...approvalsProps} fixedEntityType="Expense" />
      ) : (
        <>
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
            <div className="p-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface">Expense Line Items</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-on-surface-variant font-medium">
                  Showing {filteredExpenses.length} of {expenses.length}
                </span>

              </div>
            </div>

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
                        <th className="px-4 py-3">Exp</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Worker / Technician</th>
                        <th className="px-4 py-3">Linked Ticket</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Responsible Store</th>
                        <th className="px-4 py-3">Expense Bill</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3">Approval</th>
                        <th className="px-4 py-3">Claim Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {paginatedExpenses.map((exp: any) => {
                        const catName = exp.expense_type_detail?.expense_name || (typeof exp.expense_type === 'object' ? exp.expense_type?.expense_name : 'General');
                        const workerName = exp.worker_detail?.full_name || exp.worker_detail?.username || `Worker ${exp.worker}`;
                        const rawTicket = exp.ticket_details || exp.ticket;
                        const ticketNo = typeof rawTicket === 'object' && rawTicket ? (rawTicket.work_order_no || `${rawTicket.ticket_id || rawTicket.id}`) : (rawTicket ? `${rawTicket}` : 'N/A');
                        const storeName = typeof exp.responsible_store === 'object' && exp.responsible_store ? exp.responsible_store.store_name : (exp.store_detail?.store_name || 'General');
                        const statusText = exp.status_display || (exp.approved ? 'Approved' : 'Pending Approval');
                        const mediaList: any[] = [
                          ...(exp.receipts || []),
                          ...(exp.receipt && !exp.receipts?.some((r: any) => r.media_id === exp.receipt?.media_id) ? [exp.receipt] : [])
                        ];

                        return (
                          <tr key={exp.expense_id} className="hover:bg-surface-container-high transition-colors">
                            <td className="px-4 py-3 font-semibold text-primary">{exp.expense_id}</td>
                            <td className="px-4 py-3 font-medium text-on-surface">{catName}</td>
                            <td className="px-4 py-3 text-on-surface-variant">{workerName}</td>
                            <td className="px-4 py-3">
                              {rawTicket ? (
                                <button
                                  onClick={() => setSelectedTicketForModal(typeof rawTicket === 'object' ? rawTicket : { ticket_id: rawTicket })}
                                  className="font-mono font-medium text-primary hover:underline text-[11px]"
                                >
                                  {ticketNo}
                                </button>
                              ) : (
                                <span className="text-on-surface-variant/60 italic text-[11px]">No Ticket</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-on-surface-variant">{exp.expense_date || 'N/A'}</td>
                            <td className="px-4 py-3 text-on-surface-variant">{storeName}</td>
                            <td className="px-4 py-3">
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
                            <td className="px-4 py-3">{renderStatusBadge(statusText)}</td>
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
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => setPreviewExpenseItem(exp)}
                                className="px-2 py-1 rounded border border-outline text-[11px] text-on-surface-variant hover:text-primary hover:border-primary/40 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="View Expense Details & Receipts"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Component */}
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredExpenses.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(num) => {
                    setItemsPerPage(num);
                    setCurrentPage(1);
                  }}
                />
              </>
            )}
          </div>
        </>
      )}

      {/* MODAL: CREATE NEW EXPENSE */}
      {showCreateExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-surface-container rounded-2xl border border-outline-variant/80 max-w-xl w-full p-6 sm:p-7 space-y-5 shadow-2xl text-on-surface relative overflow-hidden transition-all">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-outline-variant/80 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs shrink-0">
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
                className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs flex items-start justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-start gap-2.5 min-w-0">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span className="whitespace-pre-line leading-relaxed font-medium">{formError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormError(null)}
                  className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-500/15 shrink-0 cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {loadingDropdowns ? (
              <div className="p-10 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading form options...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <div className="p-4 rounded-xl bg-surface-container-low border border-dashed border-outline-variant text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
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
                          {ticketWorkers.length > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                              {ticketWorkers.length} assigned to ticket
                            </span>
                          )}
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
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
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
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
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
                      <div className="p-3.5 rounded-xl bg-surface-container-low border border-dashed border-outline-variant text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
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
                              className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs hover:border-outline"
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
                              className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs hover:border-outline cursor-pointer"
                              required
                            />
                          </div>
                        </div>

                        {(!amount || parseFloat(amount) <= 0) ? (
                          <div className="p-3 rounded-xl bg-surface-container-low border border-dashed border-outline-variant text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
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
                                className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-xs rounded-xl p-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs hover:border-outline resize-none"
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
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20 ml-1">
                                        * Required
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20 ml-1">
                                        Optional
                                      </span>
                                    )}
                                  </span>
                                  {attachedMediaList.length > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
                                      {attachedMediaList.length} file(s) attached
                                    </span>
                                  )}
                                </label>
                                <div
                                  onClick={() => document.getElementById('expense-receipt-file-input')?.click()}
                                  className="border-2 border-dashed border-outline-variant hover:border-primary hover:bg-primary/5 rounded-2xl p-4 sm:p-5 text-center cursor-pointer bg-surface-container-low/70 transition-all group"
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
                                    <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-on-primary transition-all duration-200 shadow-xs">
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
                                      <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-high border border-outline-variant/80 text-xs shadow-2xs hover:border-outline transition-all">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          {item.file.type.startsWith('image/') ? (
                                            <div className="w-9 h-9 rounded-lg bg-black/80 border border-outline-variant/60 overflow-hidden flex items-center justify-center shrink-0">
                                              <img
                                                src={item.previewUrl}
                                                alt={item.file.name}
                                                style={{ transform: `rotate(${item.rotation}deg)` }}
                                                className="w-full h-full object-contain"
                                              />
                                            </div>
                                          ) : (
                                            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
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
                                            className="px-2.5 py-1 rounded-lg border border-outline-variant text-[11px] font-medium text-on-surface hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
                                            title="Rotate / Review file"
                                          >
                                            Rotate
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveAttachedMedia(item.id)}
                                            className="p-1.5 rounded-lg text-on-surface-variant hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
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

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/80">
                  <button
                    type="button"
                    onClick={() => { resetForm(); setShowCreateExpenseModal(false); }}
                    className="px-4 py-2 rounded-xl border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedTicketId || !selectedExpenseTypeId || !amount}
                    className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 active:scale-[0.98] shadow-md hover:shadow-primary/25 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer inline-flex items-center gap-2"
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
          <div className="bg-surface-container rounded-2xl border border-outline-variant/80 max-w-2xl w-full p-6 space-y-5 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/80">
              <div>
                <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Review & Adjust Orientation</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">Rotate image(s) upright before attaching ({pendingUploadQueue.length} selected)</p>
              </div>
              <button
                type="button"
                onClick={handleCancelPendingUpload}
                className="p-2 rounded-xl hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-2 overflow-y-auto max-h-[60vh] space-y-4 my-2 scrollbar-thin">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pendingUploadQueue.map((item, idx) => (
                  <div key={item.id} className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant flex flex-col gap-2.5 relative shadow-2xs">
                    <div className="w-full h-44 bg-black/80 rounded-xl overflow-hidden flex items-center justify-center relative p-1 border border-outline-variant/50">
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
                        <div className="flex items-center gap-1 bg-surface-container-high px-2 py-1 rounded-lg border border-outline-variant">
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
                className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-high cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPendingUpload}
                className="px-5 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-xl hover:bg-primary/90 shadow-md hover:shadow-primary/25 transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98]"
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
          <div className="bg-surface-container rounded-2xl border border-outline-variant/80 max-w-md w-full p-6 sm:p-7 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-outline-variant/80 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface tracking-tight">Expense #{previewExpenseItem.expense_id}</h3>
                  <p className="text-xs text-on-surface-variant font-normal">Line item transaction summary</p>
                </div>
              </div>
              <button onClick={() => setPreviewExpenseItem(null)} className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

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
                  ${parseFloat(previewExpenseItem.amount || '0').toFixed(2)}
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
              {previewExpenseItem.remarks && (
                <div className="pt-2">
                  <span className="text-on-surface-variant font-medium block mb-1">Remarks:</span>
                  <p className="p-2 rounded bg-surface-container-low border border-outline-variant italic text-on-surface">
                    {previewExpenseItem.remarks}
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
                            className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-container-high border border-outline-variant/80 hover:border-primary text-xs transition-all cursor-pointer text-left group shadow-2xs"
                          >
                            <div className="w-9 h-9 rounded-lg overflow-hidden bg-black/10 shrink-0 flex items-center justify-center relative border border-outline-variant/50">
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

            <div className="flex justify-end pt-3 border-t border-outline-variant/80">
              <button
                onClick={() => setPreviewExpenseItem(null)}
                className="px-4 py-2 rounded-xl border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
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
