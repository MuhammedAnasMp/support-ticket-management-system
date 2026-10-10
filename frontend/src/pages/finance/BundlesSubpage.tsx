import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt, PlusCircle, FileText, Trash2, Search, X, Check, Paperclip, ExternalLink, Loader2, Eye, Maximize2, ShieldCheck, Layers, AlertCircle,
  Clock, RotateCcw, MessageSquare, CheckCircle2, DollarSign, ChevronDown, ChevronRight, Rows3, ChevronsUp, RefreshCw, Plus
} from 'lucide-react';
import type { WorkerClaimItem, ExpenseItem, MediaFileItem, ApprovalStepInfo, ApprovalInstanceItem } from './types';
import { getUserId } from './types';
import { Pagination } from './Pagination';
import { DateRangePickerCard } from '../ticket/DateRangePickerCard';
import { EditBundleModal } from './EditBundleModal';
import type { ApprovalsSubpageProps } from './ApprovalsSubpage';
import { AvatarCircle } from '../ticket/TicketsTypesAndComponents';
import Can from '../../hooks/Can';

interface BundlesSubpageProps {
  filteredBundles?: WorkerClaimItem[];
  bundles: WorkerClaimItem[];
  unclaimedExpenses: ExpenseItem[];
  loading: boolean;
  submitting: boolean;
  renderStatusBadge: (status: string, isActionableForMe?: boolean, stepName?: string, hasCurrentUserApproved?: boolean) => React.ReactNode;
  setSelectedBundleForView: (b: WorkerClaimItem | null) => void;
  selectedBundleForView: WorkerClaimItem | null;
  openEditBundleModal: (b: WorkerClaimItem) => void;
  handleSubmitBundle: (claimId: number) => void;
  handleDeleteBundle: (claimId: number) => void;
  showCreateBundleModal: boolean;
  setShowCreateBundleModal: (show: boolean) => void;
  handleCreateBundle: () => void;
  expenseSearchWorker: string;
  setExpenseSearchWorker: (v: string) => void;
  expenseSearchText?: string;
  setExpenseSearchText?: (v: string) => void;
  expenseFilterFrom: string;
  setExpenseFilterFrom: (v: string) => void;
  expenseFilterTo: string;
  setExpenseFilterTo: (v: string) => void;
  uniqueExpenseWorkers: { id: number; name: string; username?: string; employee_no?: string; profile_image?: string | null; unclaimed_count?: number; unclaimed_total?: number }[];
  filteredUnclaimedExpenses: ExpenseItem[];
  selectedExpenseIds: number[];
  setSelectedExpenseIds: (ids: number[]) => void;
  selectedExpensesTotal: number;
  bundlePeriodFrom: string;
  setBundlePeriodFrom: (v: string) => void;
  bundlePeriodTo: string;
  setBundlePeriodTo: (v: string) => void;
  bundleRemarks: string;
  setBundleRemarks: (v: string) => void;
  selectedBundleForEdit: WorkerClaimItem | null;
  setSelectedBundleForEdit: (b: WorkerClaimItem | null) => void;
  editBundleForm: { period_from: string; period_to: string; remarks: string; selectedExpenseIds: number[] };
  setEditBundleForm: React.Dispatch<React.SetStateAction<{ period_from: string; period_to: string; remarks: string; selectedExpenseIds: number[] }>>;
  handleSaveUpdateBundle: () => void;
  handleRemoveExpenseFromBundle?: (bundleId: number, expenseId: number) => Promise<void>;
  previewMediaUrl: { url: string; title: string } | null;
  setPreviewMediaUrl: (media: { url: string; title: string } | null) => void;
  approvalsProps?: ApprovalsSubpageProps;
  token?: string;
  currentUser?: any;
  API_URL?: string;
  errorMessage?: string | null;
  setErrorMessage?: (msg: string | null) => void;
  setShowPaymentModal?: (item: any) => void;
  setSelectedTicketForModal?: (ticket: any) => void;
  onRefresh?: () => Promise<void> | void;
  currentPage?: number;
  totalItems?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
  onItemsPerPageChange?: (num: number) => void;
}

export const BundlesSubpage: React.FC<BundlesSubpageProps> = ({
  bundles,
  filteredBundles = bundles,
  unclaimedExpenses,
  loading,
  submitting,
  renderStatusBadge,
  setSelectedBundleForView,
  selectedBundleForView,
  openEditBundleModal,
  handleSubmitBundle,
  handleDeleteBundle,
  showCreateBundleModal,
  setShowCreateBundleModal,
  handleCreateBundle,
  expenseSearchWorker,
  setExpenseSearchWorker,
  expenseSearchText = '',
  setExpenseSearchText,
  expenseFilterFrom,
  setExpenseFilterFrom,
  expenseFilterTo,
  setExpenseFilterTo,
  uniqueExpenseWorkers,
  filteredUnclaimedExpenses,
  selectedExpenseIds,
  setSelectedExpenseIds,
  selectedExpensesTotal,
  bundlePeriodFrom,
  setBundlePeriodFrom,
  bundlePeriodTo,
  setBundlePeriodTo,
  bundleRemarks,
  setBundleRemarks,
  selectedBundleForEdit,
  setSelectedBundleForEdit,
  editBundleForm,
  setEditBundleForm,
  handleSaveUpdateBundle,
  handleRemoveExpenseFromBundle,
  previewMediaUrl,
  setPreviewMediaUrl,
  approvalsProps,
  token = '',
  currentUser,
  API_URL = '',
  errorMessage,
  setErrorMessage,
  setSelectedTicketForModal,
  onRefresh,
  currentPage: propCurrentPage,
  totalItems: propTotalItems,
  itemsPerPage: propItemsPerPage,
  onPageChange: propOnPageChange,
  onItemsPerPageChange: propOnItemsPerPageChange
}) => {
  // Inline Approval State
  const [reworkComments, setReworkComments] = useState<Record<number, string>>({});
  const [reworkErrors, setReworkErrors] = useState<Record<number, string>>({});
  const [actioningBundleId, setActioningBundleId] = useState<number | null>(null);
  const [actioningActionType, setActioningActionType] = useState<'APPROVED' | 'REWORK' | null>(null);

  // Refreshing State
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleRefreshClick = async () => {
    if (isRefreshing || loading || !onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Multi-line & Bulk Action State
  const [isMultiLineView, setIsMultiLineView] = useState<boolean>(false);
  const [bulkApproving, setBulkApproving] = useState<boolean>(false);
  const [submittingBundleId, setSubmittingBundleId] = useState<number | null>(null);

  const onHandleSubmitBundle = async (claimId: number) => {
    const targetBundle = (bundles || []).find(b => b.claim_id === claimId);
    if (!targetBundle?.expenses || targetBundle.expenses.length === 0) {
      if (setErrorMessage) setErrorMessage(`Cannot submit Bundle #${claimId}: No expenses attached to this bundle.`);
      return;
    }
    setSubmittingBundleId(claimId);
    try {
      await handleSubmitBundle(claimId);
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setSubmittingBundleId(null);
    }
  };
  const [bulkActionMsg, setBulkActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Main Table Pagination State
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
  const totalItemsCount = propTotalItems !== undefined ? propTotalItems : filteredBundles.length;

  // Expanded bundle accordion state
  const [expandedBundleIds, setExpandedBundleIds] = useState<Record<number, boolean>>({});
  const toggleExpandBundle = (bundleId: number) =>
    setExpandedBundleIds(prev => ({ ...prev, [bundleId]: !prev[bundleId] }));

  // Find all pending bundles that the current user can action
  const pendingActionableBundles = useMemo(() => {
    return filteredBundles.filter(b => {
      if (b.status !== 'Submitted' && b.status !== 'In Review') return false;
      const bundleApp = (approvalsProps?.displayedApprovals || approvalsProps?.approvals || []).find(
        a => (a.claim === b.claim_id || a.claim_id === b.claim_id || (a.target_summary?.type === 'Bundle' && a.target_summary?.id === b.claim_id)) && a.status === 'Pending'
      );
      if (!bundleApp) return false;
      return Boolean(
        bundleApp.can_action ||
        currentUser?.is_superuser ||
        (currentUser?.role && bundleApp.assigned_role_name && (
          (currentUser.role.role_name && currentUser.role.role_name.toLowerCase() === bundleApp.assigned_role_name.toLowerCase()) ||
          (typeof currentUser.role === 'string' && currentUser.role.toLowerCase() === bundleApp.assigned_role_name.toLowerCase())
        )) ||
        (bundleApp.workflow_steps?.some(s => s.assigned_users_names?.includes(currentUser?.username)))
      );
    });
  }, [filteredBundles, approvalsProps?.approvals, approvalsProps?.displayedApprovals, currentUser]);

  const handleBulkApproveBundles = async () => {
    if (pendingActionableBundles.length === 0) return;
    setBulkApproving(true);
    setBulkActionMsg(null);
    try {
      let count = 0;
      for (const b of pendingActionableBundles) {
        const bundleApp = (approvalsProps?.displayedApprovals || approvalsProps?.approvals || []).find(
          a => (a.claim === b.claim_id || a.claim_id === b.claim_id || (a.target_summary?.type === 'Bundle' && a.target_summary?.id === b.claim_id)) && a.status === 'Pending'
        );
        if (bundleApp && approvalsProps?.handleActionApproval) {
          await approvalsProps.handleActionApproval('APPROVED', 'Bulk approved', bundleApp);
          count++;
        }
      }
      if (onRefresh) {
        await onRefresh();
      }
      setBulkActionMsg({
        type: 'success',
        text: `Successfully approved ${count} pending claim bundle(s)!`
      });
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

  // Create Bundle Modal Pagination State
  const [modalPage, setModalPage] = useState(1);
  const modalItemsPerPage = 5;

  // Employee List Pagination & Filter State inside Create Bundle Modal
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [apiSearchedWorkers, setApiSearchedWorkers] = useState<any[]>([]);
  const [isSearchingWorkers, setIsSearchingWorkers] = useState<boolean>(false);
  const [previewExpense, setPreviewExpense] = useState<ExpenseItem | null>(null);
  const [activeReceiptIndex, setActiveReceiptIndex] = useState<number>(0);
  const employeeItemsPerPage = 10;

  // API Search for Workers / Technicians
  useEffect(() => {
    if (!showCreateBundleModal) {
      setApiSearchedWorkers([]);
      setIsSearchingWorkers(false);
      return;
    }

    const trimmed = employeeSearchQuery.trim();
    if (!trimmed) {
      setApiSearchedWorkers([]);
      setIsSearchingWorkers(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingWorkers(true);
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Token ${token}`;
        const baseApi = API_URL || '';
        const res = await fetch(`${baseApi}/accounts/users/?search=${encodeURIComponent(trimmed)}&page_size=10`, { headers });
        if (res.ok) {
          const data = await res.json();
          const results = Array.isArray(data) ? data : (data.results || []);

          const mapped = results.slice(0, 10).map((u: any) => {
            const uid = u.user_id || u.id;
            const uName = u.full_name || u.username || `Worker ${uid}`;

            const existing = uniqueExpenseWorkers.find(w => w.id === uid || w.name.toLowerCase() === uName.toLowerCase());
            if (existing) {
              return existing;
            }

            const workerExps = unclaimedExpenses.filter(exp => {
              if (exp.is_claimed || exp.claim) return false;
              const expWid = getUserId(exp.worker) ?? getUserId(exp.worker_detail) ?? getUserId((exp as any).added_by);
              return expWid === uid || (exp.worker as any)?.username === u.username;
            });

            const count = workerExps.length;
            const total = workerExps.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);

            return {
              id: uid,
              name: uName,
              username: u.username || '',
              employee_no: u.employee_no || '',
              profile_image: u.profile_image || null,
              department_name: u.sub_departments?.[0]?.sub_department_name || u.role?.role_name || '',
              unclaimed_count: count,
              unclaimed_total: total
            };
          });

          setApiSearchedWorkers(mapped);
        }
      } catch (err) {
        console.error('Error searching workers via API:', err);
      } finally {
        setIsSearchingWorkers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [employeeSearchQuery, showCreateBundleModal, token, API_URL, uniqueExpenseWorkers, unclaimedExpenses]);

  const filteredEmployees = useMemo(() => {
    if (employeeSearchQuery.trim()) {
      if (apiSearchedWorkers.length > 0) {
        return apiSearchedWorkers;
      }
      const q = employeeSearchQuery.toLowerCase();
      return uniqueExpenseWorkers.filter(w => {
        const nameMatch = w.name.toLowerCase().includes(q);
        const empNoMatch = (w.employee_no || '').toLowerCase().includes(q);
        const userMatch = (w.username || '').toLowerCase().includes(q);
        return nameMatch || empNoMatch || userMatch;
      });
    }
    return uniqueExpenseWorkers;
  }, [uniqueExpenseWorkers, employeeSearchQuery, apiSearchedWorkers]);

  const paginatedEmployees = useMemo(() => {
    const start = (employeePage - 1) * employeeItemsPerPage;
    return filteredEmployees.slice(start, start + employeeItemsPerPage);
  }, [filteredEmployees, employeePage, employeeItemsPerPage]);

  const totalEmployeePages = Math.ceil(filteredEmployees.length / employeeItemsPerPage) || 1;

  useEffect(() => {
    setEmployeePage(1);
  }, [filteredEmployees.length, employeeSearchQuery]);

  // Reset page when filter length changes
  useEffect(() => {
    setLocalPage(1);
  }, [filteredBundles.length]);

  useEffect(() => {
    setModalPage(1);
  }, [filteredUnclaimedExpenses.length, expenseSearchWorker, expenseSearchText, expenseFilterFrom, expenseFilterTo]);

  const paginatedBundles = useMemo(() => {
    if (isServerPaginated) return bundles;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBundles.slice(start, start + itemsPerPage);
  }, [isServerPaginated, bundles, filteredBundles, currentPage, itemsPerPage]);

  const paginatedModalExpenses = useMemo(() => {
    const start = (modalPage - 1) * modalItemsPerPage;
    return filteredUnclaimedExpenses.slice(start, start + modalItemsPerPage);
  }, [filteredUnclaimedExpenses, modalPage, modalItemsPerPage]);

  const totalModalPages = Math.ceil(filteredUnclaimedExpenses.length / modalItemsPerPage) || 1;

  // Inline Bundle Approval Action (Approve / Rework)
  const handleInlineBundleAction = async (bundle: WorkerClaimItem, action: 'APPROVED' | 'REWORK') => {
    const bundleApp = (approvalsProps?.displayedApprovals || approvalsProps?.approvals || []).find(
      a => (a.claim === bundle.claim_id || a.claim_id === bundle.claim_id || (a.target_summary?.type === 'Bundle' && a.target_summary?.id === bundle.claim_id)) && a.status === 'Pending'
    );

    const comment = reworkComments[bundle.claim_id] || '';
    if (action === 'REWORK' && !comment.trim()) {
      setReworkErrors(prev => ({ ...prev, [bundle.claim_id]: 'Comment is required for rework.' }));
      return;
    }
    setReworkErrors(prev => ({ ...prev, [bundle.claim_id]: '' }));

    if (bundleApp && approvalsProps?.handleActionApproval) {
      setActioningBundleId(bundle.claim_id);
      setActioningActionType(action);
      try {
        await approvalsProps.handleActionApproval(action, comment, bundleApp);
        setReworkComments(prev => ({ ...prev, [bundle.claim_id]: '' }));
      } finally {
        setActioningBundleId(null);
        setActioningActionType(null);
      }
    } else if (approvalsProps?.setShowApprovalModal && bundleApp) {
      approvalsProps.setApprovalAction(action);
      approvalsProps.setApprovalComments(comment);
      approvalsProps.setShowApprovalModal(bundleApp);
    }
  };

  // Visual Approval Stepper Pipeline Renderer for Bundles
  const renderBundleApprovalStepper = (bundle: WorkerClaimItem) => {
    const allInstances = (approvalsProps?.approvals || []).filter(
      a => a.claim === bundle.claim_id || a.claim_id === bundle.claim_id || (a.target_summary?.type === 'Bundle' && a.target_summary?.id === bundle.claim_id)
    );

    let steps: ApprovalStepInfo[] = [];
    for (const item of allInstances) {
      if (item.workflow_steps && item.workflow_steps.length > 0) {
        steps = item.workflow_steps;
        break;
      }
    }

    if (steps.length === 0 && approvalsProps?.approvals) {
      const matchAny = approvalsProps.approvals.find(a => (a.workflow_steps && a.workflow_steps.length > 0) && (a.target_summary?.type === 'Bundle' || a.claim));
      if (matchAny?.workflow_steps) {
        steps = matchAny.workflow_steps;
      }
    }

    if (steps.length === 0) {
      const stepNamesSeen = new Set<string>();
      allInstances.forEach(i => {
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

    if (steps.length === 0) return null;

    const isFinished = bundle.status === 'Approved' || bundle.status === 'Paid';
    const activePendingItem = allInstances.find(i => i.status === 'Pending');
    const activePendingOrder: number = (activePendingItem && typeof activePendingItem.step_order === 'number') ? activePendingItem.step_order : (isFinished ? steps.length + 1 : 1);

    return (
      <div className="p-3.5 bg-surface-container-low rounded-lg border border-outline-variant/60 overflow-x-auto shadow-2xs mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-on-surface flex items-center gap-1.5  tracking-wider">
            <ShieldCheck className="w-4 h-4 text-primary" /> Multi-Step Approval Pipeline
          </span>
          {activePendingItem && (
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Current Step: {activePendingItem.step_name} ({activePendingItem.assigned_role_name || 'Approver'})
            </span>
          )}
        </div>
        <div className="flex items-start justify-between min-w-[550px] px-2 py-2">
          {/* START NODE */}
          <div className="flex flex-col items-center shrink-0 w-16">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold border border-emerald-500/40 shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] text-on-surface-variant mt-1 font-medium text-center">Submitted</span>
          </div>

          {/* STEP NODES */}
          {steps.map((step, idx) => {
            const stepOrderNum = typeof step.step_order === 'number' ? step.step_order : (idx + 1);
            const stepInst = allInstances.find(i => i.step_name === step.step_name || i.step_order === step.step_order);
            const isApproved = isFinished || (stepInst && stepInst.status === 'Approved') || (stepOrderNum < activePendingOrder && !stepInst);
            const isPending = !isFinished && ((stepInst && stepInst.status === 'Pending') || (!stepInst && stepOrderNum === activePendingOrder));
            const isRejected = stepInst && stepInst.status === 'Rejected';
            const isRework = stepInst && stepInst.status === 'Rework';
            const isUpcoming = !isApproved && !isPending && !isRejected && !isRework;

            let circleClass = "bg-surface-container-high text-on-surface-variant border-outline";
            let labelBadge = step.assigned_role_name;
            let iconNode: React.ReactNode = step.step_order;

            const actionUserDisplay = stepInst?.action_by_full_name || stepInst?.action_by_username || '';

            if (isApproved) {
              circleClass = "bg-emerald-500 text-white border-emerald-600 font-bold shadow-xs";
              iconNode = <Check className="w-3.5 h-3.5" />;
              labelBadge = actionUserDisplay ? `Approved: ${actionUserDisplay}` : `Approved (${labelBadge || 'Step ' + stepOrderNum})`;
            } else if (isPending) {
              circleClass = "bg-amber-500 text-white border-amber-600 font-bold animate-pulse shadow-xs ring-2 ring-amber-500/30";
              iconNode = step.step_order;
              labelBadge = `Pending: ${labelBadge || 'Step ' + stepOrderNum}`;
            } else if (isRejected) {
              circleClass = "bg-rose-600 text-white border-rose-700 font-bold shadow-xs";
              iconNode = <X className="w-3.5 h-3.5" />;
              labelBadge = `Rejected: ${actionUserDisplay || 'User'}`;
            } else if (isRework) {
              circleClass = "bg-purple-600 text-white border-purple-700 font-bold shadow-xs";
              iconNode = <RotateCcw className="w-3.5 h-3.5" />;
              labelBadge = `Rework: ${actionUserDisplay || 'User'}`;
            } else if (isUpcoming) {
              circleClass = "bg-surface-container text-on-surface-variant/70 border-outline-variant/60";
              iconNode = step.step_order;
              labelBadge = `Upcoming (${labelBadge || 'Step ' + stepOrderNum})`;
            }

            const isPrevCompleted = idx === 0 ? true : (isFinished || (stepOrderNum <= activePendingOrder));

            return (
              <React.Fragment key={step.step_id || idx}>
                <div className={`flex-1 h-0.5 mx-1 mt-3 transition-colors ${isPrevCompleted && (isApproved || isPending) ? 'bg-emerald-500' : 'bg-outline-variant'}`} />
                <div className="flex flex-col items-center shrink-0 w-28 text-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border transition-all ${circleClass}`}>
                    {iconNode}
                  </div>
                  <span className="text-[10px] font-bold text-on-surface mt-1 truncate max-w-full" title={step.step_name}>
                    {step.step_name}
                  </span>
                  <span className="text-[9px] text-on-surface-variant truncate max-w-full font-medium" title={labelBadge}>
                    {labelBadge}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded border border-outline-variant bg-surface-container">
          <span className="text-xs font-medium text-on-surface-variant block">Total Bundles</span>
          <span className="text-2xl font-semibold text-on-surface mt-1 block">{filteredBundles.length}</span>
        </div>
        <div className="p-4 rounded border border-outline-variant bg-surface-container">
          <span className="text-xs font-medium text-on-surface-variant block">Pending Approval</span>
          <span className="text-2xl font-semibold text-amber-500 mt-1 block">
            {filteredBundles.filter(b => b.status === 'Submitted' || b.status === 'In Review').length}
          </span>
        </div>
        <div className="p-4 rounded border border-outline-variant bg-surface-container">
          <span className="text-xs font-medium text-on-surface-variant block">Approved & Ready</span>
          <span className="text-2xl font-semibold text-emerald-500 mt-1 block">
            {filteredBundles.filter(b => b.status === 'Approved').length}
          </span>
        </div>
        <div className="p-4 rounded border border-outline-variant bg-surface-container">
          <span className="text-xs font-medium text-on-surface-variant block">Unclaimed Expenses</span>
          <span className="text-2xl font-semibold text-blue-500 mt-1 block">{unclaimedExpenses.length}</span>
        </div>
      </div>

      {/* Table Container */}
      <div className="border border-outline-variant rounded overflow-hidden bg-surface-container flex flex-col">
        <div className="p-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-on-surface">Worker Expense Claims & Bundles</span>
            <span className="text-xs text-on-surface-variant font-medium">Showing {filteredBundles.length} of {bundles.length}</span>
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
                setExpandedBundleIds({});
                setIsMultiLineView(false);
              }}
              className="px-2.5 py-1.5 rounded border border-outline-variant text-[11px] font-medium text-on-surface hover:bg-surface-container flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Collapse all opened accordions and multi-line rows (single-line view)"
            >
              <ChevronsUp className="w-3.5 h-3.5 text-on-surface-variant" />
              <span>Close All</span>
            </button>

            {pendingActionableBundles.length > 0 && (
              <button
                type="button"
                disabled={bulkApproving}
                onClick={handleBulkApproveBundles}
                className="px-3.5 py-1.5 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title="Approve pending claim bundles in one click"
              >
                {bulkApproving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve All Pending ({pendingActionableBundles.length})</span>
                  </>
                )}
              </button>
            )}

            {onRefresh && (
              <button
                type="button"
                onClick={handleRefreshClick}
                disabled={isRefreshing || loading}
                className="px-2.5 py-1.5 rounded border border-outline-variant text-[11px] font-medium text-on-surface hover:bg-surface-container flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={isRefreshing ? "Refreshing Bundles..." : "Refresh Bundles"}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || loading ? 'animate-spin text-primary' : ''}`} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            )}

            <Can permission={["finance.create_bundle", "finance.create_workerclaim", "finance.add_workerclaim"] as any}>
              <button
                type="button"
                onClick={() => setShowCreateBundleModal(true)}
                className="bg-primary hover:bg-primary/90 text-on-primary text-[11px] font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Bundle</span>
              </button>
            </Can>
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
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading bundles...
          </div>
        ) : filteredBundles.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant space-y-2">
            <Receipt className="w-8 h-8 mx-auto text-outline" />
            <p className="text-xs font-medium text-on-surface">No worker claims match your search/filters</p>
            <p className="text-xs">Try resetting the date range or search query, or create a new bundle.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs text-left text-on-surface">
                <thead className="bg-surface-container-low text-on-surface-variant  text-[10px] tracking-wider border-b border-outline-variant">
                  <tr>
                    <th className="w-8 px-2 py-3"></th>
                    <th className="px-4 py-3">Bundle ID</th>
                    <th className="px-4 py-3">Worker Name</th>
                    <th className="px-4 py-3">Claim Date</th>
                    <th className="px-4 py-3">Ledger Batch</th>
                    <th className="px-4 py-3 text-right">Amount ($)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {paginatedBundles.map((b, idx) => {
                    const isExpanded = !!expandedBundleIds[b.claim_id];
                    const isOdd = idx % 2 === 1;
                    const bundleExpenses = Array.isArray(b.expenses) ? b.expenses : [];

                    return (
                      <React.Fragment key={b.claim_id}>
                        <tr
                          onClick={() => toggleExpandBundle(b.claim_id)}
                          className={`cursor-pointer transition-colors ${isExpanded
                            ? 'bg-primary/10 dark:bg-primary/20 border-l-4 border-l-primary'
                            : isMultiLineView
                              ? isOdd
                                ? 'bg-slate-100/90 dark:bg-slate-800/45 hover:bg-slate-200/90 dark:hover:bg-slate-700/60'
                                : 'bg-white dark:bg-surface-container-lowest hover:bg-slate-50 dark:hover:bg-slate-800/30'
                              : 'hover:bg-surface-container-high'
                            }`}
                        >
                          <td className="w-8 px-2 py-3 text-center" onClick={(e) => { e.stopPropagation(); toggleExpandBundle(b.claim_id); }}>
                            <button
                              type="button"
                              className={`p-1 rounded transition-colors cursor-pointer ${isExpanded ? 'bg-primary text-on-primary shadow-xs' : 'hover:bg-surface-container-highest text-on-surface-variant'}`}
                            >
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-semibold text-primary">
                            Bundle {b.claim_id}
                            {bundleExpenses.length > 0 && (
                              <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                                {bundleExpenses.length} exp
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-2 min-w-0">
                              <AvatarCircle
                                user={b.worker_detail}
                                name={b.worker_detail ? (b.worker_detail.full_name || b.worker_detail.username) : `Worker ${(b.worker_detail as any)?.id || ''}`}
                                size="xs"
                              />
                              <span className="truncate">{b.worker_detail ? `${b.worker_detail.full_name || b.worker_detail.username}` : `Worker ${(b.worker_detail as any)?.id || ''}`}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant">{new Date(b.claim_date).toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-medium">
                            {b.ledger_details ? (
                              <span
                                className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 inline-flex items-center gap-1"
                                title={`Ledger ID #${b.ledger_details.ledger_id} (${b.ledger_details.status})`}
                              >
                                <span>{b.ledger_details.group_name} ({b.ledger_details.status})</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-on-surface-variant/60 italic">No Ledger</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{parseFloat(b.total_claimed_amount).toFixed(2)}</td>
                          <td className="px-4 py-3">
                            {(() => {
                              const bundleApp = (approvalsProps?.displayedApprovals || approvalsProps?.approvals || []).find(
                                a => (a.claim === b.claim_id || a.claim_id === b.claim_id || (a.target_summary?.type === 'Bundle' && a.target_summary?.id === b.claim_id)) && a.status === 'Pending'
                              );
                              const canApprove = Boolean(
                                bundleApp && (
                                  bundleApp.can_action ||
                                  currentUser?.is_superuser ||
                                  (currentUser?.role && bundleApp.assigned_role_name && (
                                    (currentUser.role.role_name && currentUser.role.role_name.toLowerCase() === bundleApp.assigned_role_name.toLowerCase()) ||
                                    (typeof currentUser.role === 'string' && currentUser.role.toLowerCase() === bundleApp.assigned_role_name.toLowerCase())
                                  )) ||
                                  (bundleApp.workflow_steps?.some(s => s.assigned_users_names?.includes(currentUser?.username)))
                                )
                              );
                              const pendingStep = b.approval_history?.find(i => i.status === 'Pending')?.step_name || bundleApp?.step_name;
                              const currentUserId = currentUser?.id ?? currentUser?.user_id;
                              const currentUsername = currentUser?.username;
                              const hasCurrentUserApproved = (b.status === 'In Review' || b.status === 'Submitted') && Boolean(
                                b.approval_history?.some(
                                  (inst: any) => inst.status === 'Approved' && (
                                    (inst.action_by_username && currentUsername && inst.action_by_username.toLowerCase() === currentUsername.toLowerCase()) ||
                                    (inst.action_by && currentUserId && (String(inst.action_by) === String(currentUserId) || String(inst.action_by?.id) === String(currentUserId)))
                                  )
                                )
                              );
                              return (
                                <>
                                  {renderStatusBadge(b.status, (b.status === 'Submitted' || b.status === 'In Review') && canApprove, pendingStep, hasCurrentUserApproved)}
                                </>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const bundleApp = (approvalsProps?.displayedApprovals || approvalsProps?.approvals || []).find(
                                a => (a.claim === b.claim_id || a.claim_id === b.claim_id || (a.target_summary?.type === 'Bundle' && a.target_summary?.id === b.claim_id)) && a.status === 'Pending'
                              );

                              const canApprove = Boolean(
                                bundleApp && (
                                  bundleApp.can_action ||
                                  currentUser?.is_superuser ||
                                  (currentUser?.role && bundleApp.assigned_role_name && (
                                    (currentUser.role.role_name && currentUser.role.role_name.toLowerCase() === bundleApp.assigned_role_name.toLowerCase()) ||
                                    (typeof currentUser.role === 'string' && currentUser.role.toLowerCase() === bundleApp.assigned_role_name.toLowerCase())
                                  )) ||
                                  (bundleApp.workflow_steps?.some(s => s.assigned_users_names?.includes(currentUser?.username)))
                                )
                              );

                              if (b.status === 'Draft' || b.status === 'Rework' || b.status === 'Rejected') {
                                return (
                                  <div className="inline-flex items-center gap-1.5">
                                    <Can permission={["finance.edit_bundle", "finance.edit_workerclaim", "finance.change_workerclaim"] as any}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEditBundleModal(b);
                                        }}
                                        className="px-2.5 py-1 rounded border border-primary/40 text-primary text-[11px] font-medium hover:bg-primary/10 transition-colors cursor-pointer inline-flex items-center gap-1"
                                        title="Edit Bundle & Modify Tied Expenses"
                                      >
                                        <PlusCircle className="w-3.5 h-3.5" />
                                        <span>Edit</span>
                                      </button>
                                    </Can>
                                    <Can permission={["finance.submit_bundle", "finance.submit_workerclaim"] as any}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onHandleSubmitBundle(b.claim_id);
                                        }}
                                        disabled={submittingBundleId === b.claim_id || submitting}
                                        className="px-2.5 py-1 rounded bg-primary text-on-primary text-[11px] font-medium hover:bg-primary-container transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 shadow-xs"
                                      >
                                        {submittingBundleId === b.claim_id ? (
                                          <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>Submitting...</span>
                                          </>
                                        ) : (
                                          <span>{b.status === 'Rework' || b.status === 'Rejected' ? 'Resubmit Claim' : 'Submit Approval'}</span>
                                        )}
                                      </button>
                                    </Can>
                                    <Can permission={["finance.delete_bundle", "finance.delete_workerclaim"] as any}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteBundle(b.claim_id);
                                        }}
                                        disabled={submitting}
                                        className="p-1 rounded border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer inline-flex items-center disabled:opacity-50"
                                        title="Delete Bundle & Release Tied Expenses"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </Can>
                                  </div>
                                );
                              }

                              if (b.status === 'Submitted' || b.status === 'In Review') {
                                if (canApprove && bundleApp) {
                                  return (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleExpandBundle(b.claim_id);
                                        }}
                                        className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-[11px] font-semibold hover:bg-amber-500/25 transition-all cursor-pointer inline-flex items-center gap-1"
                                        title="Click to expand row and action approval"
                                      >
                                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Review / Action</span>
                                      </button>
                                    </div>
                                  );
                                }
                                return null;
                              }

                              return null;
                            })()}
                          </td>
                        </tr>

                        {/* MULTI-LINE VIEW SECOND ROW (Pipeline 1-----2-----3-----4 + Quick Approve/Rework) */}
                        {isMultiLineView && !isExpanded && (
                          <tr className={`border-b-2 border-outline-variant/80 transition-colors ${isOdd ? 'bg-slate-100/90 dark:bg-slate-800/45' : 'bg-white dark:bg-surface-container-lowest'
                            }`}>
                            <td colSpan={8} className="px-4 py-2.5">
                              <div className={`flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5 p-2.5 rounded border ${isOdd
                                ? 'bg-white dark:bg-surface-container/70 border-outline-variant/80 shadow-xs'
                                : 'bg-surface-container-low dark:bg-surface-container-low/70 border-outline-variant/60 shadow-2xs'
                                }`}>
                                {/* Left/Main: Compact Horizontal Stepper Pipeline */}
                                <div className="flex-1 overflow-x-auto min-w-0">
                                  {renderBundleApprovalStepper(b)}
                                </div>

                                {/* Right: Quick Action Controls (Comment Box + Approve + Rework) */}
                                <div className="shrink-0 flex flex-col items-end gap-1.5 pt-2 xl:pt-0 border-t xl:border-t-0 border-outline-variant/40">
                                  {(() => {
                                    const bundleApp = (approvalsProps?.displayedApprovals || approvalsProps?.approvals || []).find(
                                      a => (a.claim === b.claim_id || a.claim_id === b.claim_id || (a.target_summary?.type === 'Bundle' && a.target_summary?.id === b.claim_id)) && a.status === 'Pending'
                                    );
                                    const canApprove = Boolean(
                                      bundleApp && (
                                        bundleApp.can_action ||
                                        currentUser?.is_superuser ||
                                        (currentUser?.role && bundleApp.assigned_role_name && (
                                          (currentUser.role.role_name && currentUser.role.role_name.toLowerCase() === bundleApp.assigned_role_name.toLowerCase()) ||
                                          (typeof currentUser.role === 'string' && currentUser.role.toLowerCase() === bundleApp.assigned_role_name.toLowerCase())
                                        )) ||
                                        (bundleApp.workflow_steps?.some(s => s.assigned_users_names?.includes(currentUser?.username)))
                                      )
                                    );

                                    if ((b.status === 'Submitted' || b.status === 'In Review') && canApprove && bundleApp) {
                                      return (
                                        <>
                                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full xl:w-auto">
                                            <input
                                              type="text"
                                              value={reworkComments[b.claim_id] || ''}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                setReworkComments(prev => ({ ...prev, [b.claim_id]: val }));
                                                if (val.trim() && reworkErrors[b.claim_id]) {
                                                  setReworkErrors(prev => {
                                                    const next = { ...prev };
                                                    delete next[b.claim_id];
                                                    return next;
                                                  });
                                                }
                                              }}
                                              placeholder="Comment (Required for Rework)..."
                                              className={`px-2.5 py-1.5 rounded border text-xs text-on-surface focus:outline-none placeholder:text-on-surface-variant/60 w-full sm:w-48 xl:w-56 transition-all ${reworkErrors[b.claim_id]
                                                ? 'border-rose-500 bg-rose-500/10 focus:border-rose-600 focus:ring-1 focus:ring-rose-500'
                                                : 'border-outline bg-surface-container-low focus:border-primary'
                                                }`}
                                            />
                                            <button
                                              type="button"
                                              disabled={actioningBundleId === b.claim_id}
                                              onClick={() => handleInlineBundleAction(b, 'APPROVED')}
                                              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                                              title="Approve this claim bundle step"
                                            >
                                              {actioningBundleId === b.claim_id && actioningActionType === 'APPROVED' ? (
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
                                              disabled={actioningBundleId === b.claim_id}
                                              onClick={() => handleInlineBundleAction(b, 'REWORK')}
                                              className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                                              title="Request rework for this claim bundle"
                                            >
                                              {actioningBundleId === b.claim_id && actioningActionType === 'REWORK' ? (
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
                                          {reworkErrors[b.claim_id] && (
                                            <div className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 animate-pulse self-start sm:self-auto">
                                              <span>{reworkErrors[b.claim_id]}</span>
                                            </div>
                                          )}
                                        </>
                                      );
                                    }

                                    if (b.status === 'Draft' || b.status === 'Rework' || b.status === 'Rejected') {
                                      return (
                                        <div className="flex items-center gap-1.5">
                                          <Can permission={["finance.edit_bundle", "finance.edit_workerclaim", "finance.change_workerclaim"] as any}>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openEditBundleModal(b);
                                              }}
                                              className="px-2.5 py-1.5 rounded border border-primary/40 text-primary text-xs font-medium hover:bg-primary/10 transition-colors cursor-pointer inline-flex items-center gap-1"
                                            >
                                              <PlusCircle className="w-3.5 h-3.5" />
                                              <span>Edit</span>
                                            </button>
                                          </Can>
                                          <Can permission={["finance.submit_bundle", "finance.submit_workerclaim"] as any}>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onHandleSubmitBundle(b.claim_id);
                                              }}
                                              disabled={submittingBundleId === b.claim_id || submitting}
                                              className="px-3 py-1.5 rounded bg-primary text-on-primary text-xs font-medium hover:bg-primary-container transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 shadow-xs"
                                            >
                                              {submittingBundleId === b.claim_id ? (
                                                <>
                                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                  <span>Submitting...</span>
                                                </>
                                              ) : (
                                                <span>{b.status === 'Rework' || b.status === 'Rejected' ? 'Resubmit' : 'Submit'}</span>
                                              )}
                                            </button>
                                          </Can>
                                        </div>
                                      );
                                    }

                                    if (b.status === 'Approved') {
                                      return (
                                        <span className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                          <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                                        </span>
                                      );
                                    }

                                    if (b.status === 'Paid') {
                                      return (
                                        <span className="px-2.5 py-1 rounded text-[11px] font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center gap-1">
                                          <DollarSign className="w-3.5 h-3.5" /> Paid
                                        </span>
                                      );
                                    }

                                    return null;
                                  })()}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* EXPANDED ACCORDION VIEW: VISUAL APPROVAL STEPPER PIPELINE & TIED EXPENSES */}
                        {isExpanded && (
                          <tr className="bg-primary/5 dark:bg-primary/10">
                            <td colSpan={8} className="px-6 py-4 border-b border-outline-variant space-y-3">
                              {/* Multi-Step Approval Pipeline */}
                              {renderBundleApprovalStepper(b)}

                              {/* Action Controls for Stepper in Expanded View */}
                              {(() => {
                                const bundleApp = (approvalsProps?.displayedApprovals || approvalsProps?.approvals || []).find(
                                  a => (a.claim === b.claim_id || a.claim_id === b.claim_id || (a.target_summary?.type === 'Bundle' && a.target_summary?.id === b.claim_id)) && a.status === 'Pending'
                                );
                                const canApprove = Boolean(
                                  bundleApp && (
                                    bundleApp.can_action ||
                                    currentUser?.is_superuser ||
                                    (currentUser?.role && bundleApp.assigned_role_name && (
                                      (currentUser.role.role_name && currentUser.role.role_name.toLowerCase() === bundleApp.assigned_role_name.toLowerCase()) ||
                                      (typeof currentUser.role === 'string' && currentUser.role.toLowerCase() === bundleApp.assigned_role_name.toLowerCase())
                                    )) ||
                                    (bundleApp.workflow_steps?.some(s => s.assigned_users_names?.includes(currentUser?.username)))
                                  )
                                );

                                if ((b.status === 'Submitted' || b.status === 'In Review') && canApprove && bundleApp) {
                                  return (
                                    <div className="p-3 bg-surface-container rounded border border-outline-variant/80 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                                      <div className="flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-primary" />
                                        <span className="text-xs font-bold text-on-surface">Action Pending Approval Step: {bundleApp.step_name}</span>
                                      </div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <input
                                          type="text"
                                          value={reworkComments[b.claim_id] || ''}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setReworkComments(prev => ({ ...prev, [b.claim_id]: val }));
                                            if (val.trim()) setReworkErrors(prev => ({ ...prev, [b.claim_id]: '' }));
                                          }}
                                          placeholder="Review comments (required for rework)..."
                                          className={`px-2.5 py-1.5 rounded border text-xs text-on-surface focus:outline-none placeholder:text-on-surface-variant/60 w-64 ${reworkErrors[b.claim_id]
                                            ? 'border-rose-500 bg-rose-500/10'
                                            : 'border-outline-variant bg-surface-container-low focus:border-primary'
                                            }`}
                                        />
                                        <button
                                          type="button"
                                          disabled={actioningBundleId === b.claim_id}
                                          onClick={() => handleInlineBundleAction(b, 'APPROVED')}
                                          className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                          {actioningBundleId === b.claim_id && actioningActionType === 'APPROVED' ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                          )}
                                          <span>Approve</span>
                                        </button>
                                        <button
                                          type="button"
                                          disabled={actioningBundleId === b.claim_id}
                                          onClick={() => handleInlineBundleAction(b, 'REWORK')}
                                          className="px-3.5 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                          {actioningBundleId === b.claim_id && actioningActionType === 'REWORK' ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <RotateCcw className="w-3.5 h-3.5" />
                                          )}
                                          <span>Rework</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold  tracking-wider text-on-surface">
                                  Expenses in Bundle {b.claim_id} ({bundleExpenses.length})
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBundleForView(b);
                                  }}
                                  className="text-xs text-primary hover:underline font-medium cursor-pointer flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Full</span>
                                </button>
                              </div>

                              {bundleExpenses.length === 0 ? (
                                <p className="text-xs text-on-surface-variant italic">No expenses recorded in this bundle.</p>
                              ) : (
                                <div className="border border-outline-variant rounded overflow-hidden bg-surface-container shadow-sm">
                                  <table className="w-full text-xs text-left text-on-surface">
                                    <thead className="bg-surface-container-low text-on-surface-variant  text-[9px] tracking-wider border-b border-outline-variant">
                                      <tr>
                                        <th className="px-3 py-2">Exp</th>
                                        <th className="px-3 py-2">Category</th>
                                        <th className="px-3 py-2">Date</th>
                                        <th className="px-3 py-2">Responsible Store</th>
                                        <th className="px-3 py-2">Ticket / Work Order</th>
                                        <th className="px-3 py-2 text-right">Amount ($)</th>
                                        <th className="px-3 py-2 text-right">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-outline-variant">
                                      {bundleExpenses.map((exp: any) => {
                                        const storeName = typeof exp.responsible_store === 'object' && exp.responsible_store ? exp.responsible_store.store_name : (exp.store_detail?.store_name || 'N/A');
                                        const ticketNo = exp.ticket_details?.work_order_no || (typeof exp.ticket === 'object' && exp.ticket ? exp.ticket.work_order_no : (exp.ticket ? `#${exp.ticket}` : 'N/A'));
                                        const catName = exp.expense_type_detail?.expense_name || (typeof exp.expense_type === 'object' && exp.expense_type ? exp.expense_type.expense_name : 'General');
                                        return (
                                          <tr key={exp.expense_id} className="hover:bg-surface-container-high transition-colors">
                                            <td className="px-3 py-2 font-semibold text-primary">#{exp.expense_id}</td>
                                            <td className="px-3 py-2 text-on-surface">{catName}</td>
                                            <td className="px-3 py-2 text-on-surface-variant">{exp.expense_date || 'N/A'}</td>
                                            <td className="px-3 py-2 text-on-surface-variant">{storeName}</td>
                                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                              {((exp.ticket_details || exp.ticket) && setSelectedTicketForModal) ? (
                                                <button
                                                  type="button"
                                                  onClick={() => setSelectedTicketForModal(typeof (exp.ticket_details || exp.ticket) === 'object' ? (exp.ticket_details || exp.ticket) : { ticket_id: (exp.ticket_details || exp.ticket) })}
                                                  className="font-mono font-medium text-primary hover:underline text-[11px] cursor-pointer"
                                                >
                                                  {ticketNo}
                                                </button>
                                              ) : (
                                                <span className="text-on-surface-variant/60 font-mono text-[11px]">{ticketNo}</span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                              {parseFloat(exp.amount || '0').toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                              <div className="inline-flex items-center justify-end gap-1.5">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPreviewExpense(exp);
                                                  }}
                                                  className="px-2 py-0.5 rounded border border-outline text-[11px] text-on-surface-variant hover:text-primary hover:border-primary/40 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                                  title="Preview Expense Receipt & Details"
                                                >
                                                  {/* <Eye className="w-3 h-3" /> */}
                                                  <span>Receipt</span>
                                                </button>
                                                {b.status !== 'Paid' && !b.ledger_details && !(b as any).ledger_id && handleRemoveExpenseFromBundle && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleRemoveExpenseFromBundle(b.claim_id, exp.expense_id);
                                                    }}
                                                    className="px-2 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 text-[11px] text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                                    title="Remove Expense from Bundle"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                    <span>Remove</span>
                                                  </button>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
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

      {/* MODAL: CREATE BUNDLE DIRECT MODAL */}
      {showCreateBundleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-surface-container rounded border border-outline-variant/80 max-w-5xl w-full h-[88vh] max-h-[860px] min-h-[640px] flex flex-col p-4 sm:p-4 shadow-2xl overflow-hidden transition-all">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-outline-variant/80 pb-3.5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface tracking-tight">Create Worker Claim Bundle</h3>

                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateBundleModal(false)}
                className="p-2 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DIRECT MODAL BODY */}
            <div className="flex-1 min-h-0 flex flex-col justify-between space-y-3 pt-3 overflow-hidden">
              {/* Modal-level Error Banner */}
              {errorMessage && (
                <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between shadow-2xs shrink-0 animate-in fade-in">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    <span className="font-semibold">{errorMessage}</span>
                  </div>
                  {setErrorMessage && (
                    <button
                      type="button"
                      onClick={() => setErrorMessage(null)}
                      className="p-1 hover:bg-red-500/10 rounded transition-colors text-red-500 shrink-0 cursor-pointer"
                      title="Dismiss error"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* 1. SELECT EMPLOYEE / TECHNICIAN */}
              <div className="p-3 bg-surface-container-low border border-outline-variant/80 rounded space-y-2.5 shrink-0 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-on-surface text-xs block tracking-wider text-primary">
                    Select Technician
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-medium">
                    Workers with unclaimed expenses
                  </span>
                </div>

                {!expenseSearchWorker ? (
                  <>
                    {/* Search & Date Filter Header */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                      {/* Search Employee Name */}
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-on-surface-variant" />
                        <input
                          type="text"
                          placeholder="Search technician by name, username, employee ID... (API Search)"
                          value={employeeSearchQuery}
                          onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                          className="w-full bg-surface-container border border-outline-variant text-on-surface text-xs rounded pl-9 pr-8 py-2 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs hover:border-outline"
                        />
                        {isSearchingWorkers ? (
                          <Loader2 className="w-4 h-4 absolute right-2.5 top-2.5 text-primary animate-spin" />
                        ) : employeeSearchQuery ? (
                          <button
                            type="button"
                            onClick={() => setEmployeeSearchQuery('')}
                            className="absolute right-2.5 top-2.5 text-on-surface-variant hover:text-on-surface p-0.5 rounded cursor-pointer"
                            title="Clear search"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>

                      {/* Date Filter */}
                      <div className="shrink-0 flex justify-end">
                        <DateRangePickerCard
                          fromDate={expenseFilterFrom}
                          toDate={expenseFilterTo}
                          onDateRangeChange={(from, to) => {
                            setExpenseFilterFrom(from);
                            setExpenseFilterTo(to);
                          }}
                          onReset={() => {
                            setExpenseFilterFrom('');
                            setExpenseFilterTo('');
                          }}
                        />
                      </div>
                    </div>

                    {/* Paginated Employee Cards Grid */}
                    {filteredEmployees.length === 0 ? (
                      <div className="p-4 text-center text-xs text-on-surface-variant italic border border-outline-variant/80 rounded bg-surface-container">
                        No employees with unclaimed expenses match the search/date criteria.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {paginatedEmployees.map((emp) => {
                            const isSelected = expenseSearchWorker === emp.name;
                            return (
                              <div
                                key={emp.id}
                                onClick={() => {
                                  setExpenseSearchWorker(emp.name);
                                  setSelectedExpenseIds([]);
                                }}
                                className={`p-2.5 rounded border cursor-pointer transition-all flex items-center justify-between gap-2.5 ${isSelected
                                  ? 'bg-primary/10 border-primary shadow-sm ring-1 ring-primary/30'
                                  : 'bg-surface-container hover:bg-surface-container-high border-outline-variant/80 shadow-2xs'
                                  }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <AvatarCircle
                                    user={emp}
                                    name={emp.name}
                                    image={emp.profile_image}
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-bold text-on-surface truncate flex items-center gap-1">
                                      <span>{emp.name}</span>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                                    </h4>
                                    {/* <p className="text-[10px] text-on-surface-variant truncate">
                                      {(emp as any).department_name || 'General Maintenance'}
                                      {emp.employee_no ? ` • EMP: ${emp.employee_no}` : ''}
                                    </p> */}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-[10px] text-primary font-bold block">
                                    {emp.unclaimed_count ?? 0} Expenses
                                  </span>
                                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                    {(emp.unclaimed_total ?? 0).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Employee List Pagination Bar */}
                        {totalEmployeePages > 1 && (
                          <div className="px-3 py-1.5 bg-surface-container rounded border border-outline-variant/80 flex items-center justify-between text-xs">
                            <span className="text-on-surface-variant text-[10px]">
                              Page <strong className="text-on-surface">{employeePage}</strong> of <strong>{totalEmployeePages}</strong> ({filteredEmployees.length} workers)
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={employeePage === 1}
                                onClick={() => setEmployeePage(p => Math.max(1, p - 1))}
                                className="px-2.5 py-1 rounded-lg border border-outline-variant text-[10px] font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                              >
                                Prev
                              </button>
                              <button
                                type="button"
                                disabled={employeePage >= totalEmployeePages}
                                onClick={() => setEmployeePage(p => Math.min(totalEmployeePages, p + 1))}
                                className="px-2.5 py-1 rounded-lg border border-outline-variant text-[10px] font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  /* Selected Worker Banner */
                  (() => {
                    const selectedWorkerItem = uniqueExpenseWorkers.find(w => w.name === expenseSearchWorker) || apiSearchedWorkers.find(w => w.name === expenseSearchWorker);
                    return (
                      <div className="p-2.5 px-3.5 rounded bg-primary/10 border border-primary/30 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarCircle
                            user={selectedWorkerItem}
                            name={expenseSearchWorker}
                            image={selectedWorkerItem?.profile_image}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-on-surface truncate">{expenseSearchWorker}</h4>
                            </div>
                            <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
                              {selectedWorkerItem?.unclaimed_count !== undefined ? ` • ${selectedWorkerItem.unclaimed_count} unclaimed expenses` : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setExpenseSearchWorker('');
                            setSelectedExpenseIds([]);
                          }}
                          className="p-1.5 rounded bg-surface-container border border-outline-variant hover:bg-error/10 hover:border-error/30 hover:text-error text-on-surface transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
                          title="Clear worker selection to choose another worker or change date filter"
                        >
                          <X className="w-4 h-4 text-error" />
                        </button>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* 2. UNCLAIMED EXPENSES LIST FOR SELECTED EMPLOYEE */}
              <div className="flex-1 min-h-0 flex flex-col space-y-1.5 overflow-hidden">
                <div className="flex items-center justify-between text-xs px-1 shrink-0">
                  <span className="font-bold text-on-surface flex items-center gap-2">
                    <span>Unclaimed Expenses - {filteredUnclaimedExpenses.length}</span>
                    {filteredUnclaimedExpenses.some(e => !(e.approved === true || ((e.expense_type as any)?.approve_required === false))) && (
                      <span className=" text-green-600 dark:text-green-400 font-semibold px-2 py-0.5 ">
                        Eligible to claim {filteredUnclaimedExpenses.filter(e => e.approved === true || ((e.expense_type as any)?.approve_required === false)).length}
                      </span>
                    )}
                  </span>

                  <div className="flex items-center gap-3">
                    {filteredUnclaimedExpenses.length > 0 && (
                      <div className="space-x-3">
                        <button
                          type="button"
                          onClick={() => setSelectedExpenseIds([])}
                          className="text-on-surface-variant hover:underline font-medium text-xs cursor-pointer"
                        >
                          Deselect All
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const eligibleIds = filteredUnclaimedExpenses
                              .filter(e => e.approved === true || ((e.expense_type as any)?.approve_required === false))
                              .map(e => e.expense_id);
                            setSelectedExpenseIds(Array.from(new Set([...selectedExpenseIds, ...eligibleIds])));
                          }}
                          className="text-primary hover:underline font-bold text-xs cursor-pointer"
                        >
                          Select All
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {!expenseSearchWorker ? (
                  <div className="p-6 text-center text-xs text-on-surface-variant border border-outline-variant/80 rounded bg-surface-container-low">
                    Select an employee above to view available unclaimed expenses.
                  </div>
                ) : filteredUnclaimedExpenses.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic p-6 text-center border border-outline-variant/80 rounded bg-surface-container-low">
                    No unclaimed expenses match this employee and date filter.
                  </p>
                ) : (
                  <div className="flex-1 min-h-0 border border-outline-variant/80 rounded overflow-hidden bg-surface-container-low flex flex-col shadow-2xs">
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 p-2 divide-y divide-outline-variant/60">
                      {paginatedModalExpenses.map((exp) => {
                        const isChecked = selectedExpenseIds.includes(exp.expense_id);

                        const statusText = (exp.expense_type && (exp.expense_type as any).approve_required === false)
                          ? 'Approved'
                          : (exp.status_display || (exp.approved ? 'Approved' : ((exp.claim?.status === 'Rejected' || exp.claim?.status === 'Rework') ? exp.claim.status : 'Pending Approval')));
                        const isExpApproved = statusText === 'Approved';
                        const isExpRejected = statusText === 'Rejected';
                        const isExpRework = statusText === 'Rework';

                        return (
                          <div
                            key={exp.expense_id}
                            onClick={() => setPreviewExpense(exp)}
                            className={`flex items-center gap-3 p-2.5 px-3 rounded cursor-pointer text-xs transition-colors border ${!isExpApproved
                              ? 'bg-surface-container-low/70 border-outline-variant/40 opacity-80 hover:bg-surface-container/70'
                              : isChecked
                                ? 'bg-primary/10 border-primary/40 font-medium'
                                : 'hover:bg-surface-container border-transparent'
                              }`}
                          >

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`font-semibold truncate transition-colors ${!isExpApproved ? 'text-on-surface-variant' : 'text-on-surface hover:text-primary'}`}>
                                    {exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || `Expense ${exp.expense_id}`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  {!isExpApproved && (
                                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isExpApproved
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                      : isExpRejected
                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                        : isExpRework
                                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                      }`}>
                                      {statusText}
                                    </span>
                                  )}
                                  <span className={`font-bold text-xs ${isExpApproved ? 'text-primary' : 'text-on-surface-variant'}`}>
                                    {parseFloat(exp.amount).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-on-surface-variant mt-1">
                                <span className="flex items-center gap-1.5 min-w-0 truncate">
                                  <span>Exp {exp.expense_id}</span>
                                  {(() => {
                                    const wo = exp.ticket_details?.work_order_no || (typeof exp.ticket === 'object' && exp.ticket !== null ? (exp.ticket as any).work_order_no : '');
                                    if (!wo) return null;
                                    return (
                                      <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-primary text-[10px] font-semibold">
                                        {wo}
                                      </span>
                                    );
                                  })()}
                                  {exp.remarks && <span className="italic truncate max-w-[200px]"> Remark : {exp.remarks}</span>}
                                </span>
                                <span className="shrink-0">{exp.expense_date}</span>
                              </div>
                            </div>
                            {isExpApproved && (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={!isExpApproved}
                                title={!isExpApproved ? "Unapproved expenses cannot be added to a claim bundle" : undefined}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  if (!isExpApproved) return;
                                  if (e.target.checked) setSelectedExpenseIds([...selectedExpenseIds, exp.expense_id]);
                                  else setSelectedExpenseIds(selectedExpenseIds.filter(id => id !== exp.expense_id));
                                }}
                                className={`rounded w-4 h-4 shrink-0 ${!isExpApproved
                                  ? 'opacity-40 cursor-not-allowed accent-gray-400'
                                  : 'text-primary focus:ring-primary cursor-pointer'
                                  }`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Modal List Pagination Bar */}
                    {totalModalPages > 1 && (
                      <div className="shrink-0 px-3 py-1.5 bg-surface-container flex items-center justify-between border-t border-outline-variant/80 text-xs">
                        <span className="text-on-surface-variant text-[10px]">
                          Page <strong className="text-on-surface">{modalPage}</strong> of <strong>{totalModalPages}</strong>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={modalPage === 1}
                            onClick={() => setModalPage(p => Math.max(1, p - 1))}
                            className="px-2.5 py-1 rounded-lg border border-outline-variant text-[10px] font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            disabled={modalPage >= totalModalPages}
                            onClick={() => setModalPage(p => Math.min(totalModalPages, p + 1))}
                            className="px-2.5 py-1 rounded-lg border border-outline-variant text-[10px] font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. BUNDLE REMARKS / NOTES */}
              <div className="p-3 bg-surface-container-low border border-outline-variant/80 rounded space-y-1.5 shrink-0 shadow-2xs">
                <label className="block text-xs font-semibold text-on-surface">
                  Bundle Remarks <span className="text-red-500 font-bold">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={bundleRemarks}
                  onChange={(e) => setBundleRemarks(e.target.value)}
                  placeholder="Notes or description for this worker claim bundle (Required)..."
                  className="w-full bg-surface-container border border-outline-variant text-on-surface text-xs rounded p-2.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none shadow-2xs hover:border-outline"
                />
              </div>

              {/* 4. SELECTION SUMMARY & ACTION FOOTER */}
              <div className="shrink-0 pt-2 border-t border-outline-variant/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-on-surface-variant font-medium text-[11px]">
                    <strong className="text-on-surface font-bold text-xs">{selectedExpenseIds.length} expenses</strong>
                  </span>
                  <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                    Total: {selectedExpensesTotal.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowCreateBundleModal(false)}
                    className="px-4 py-2 rounded border border-outline-variant text-xs text-on-surface hover:bg-surface-container-high transition-colors font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateBundle}
                    disabled={submitting || selectedExpenseIds.length === 0 || !bundleRemarks.trim()}
                    className="px-5 py-2 rounded bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md hover:shadow-primary/25 active:scale-[0.98] cursor-pointer flex items-center gap-2"
                  >
                    {submitting ? 'Creating Bundle...' : `Create Bundle (${selectedExpensesTotal.toFixed(2)})`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL 1: VIEW BUNDLE BILLS & MEDIA */}
      {selectedBundleForView && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-surface-container rounded border border-outline-variant/80 max-w-3xl w-full p-6 sm:p-7 space-y-5 shadow-2xl my-8 text-on-surface">
            <div className="flex items-center justify-between border-b border-outline-variant/80 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface flex items-center gap-2 tracking-tight">
                    Bundle #{selectedBundleForView.claim_id} Details
                    {(() => {
                      const currentUserId = currentUser?.id ?? currentUser?.user_id;
                      const currentUsername = currentUser?.username;
                      const hasModalUserApproved = (selectedBundleForView.status === 'In Review' || selectedBundleForView.status === 'Submitted') && Boolean(
                        selectedBundleForView.approval_history?.some(
                          (inst: any) => inst.status === 'Approved' && (
                            (inst.action_by_username && currentUsername && inst.action_by_username.toLowerCase() === currentUsername.toLowerCase()) ||
                            (inst.action_by && currentUserId && (String(inst.action_by) === String(currentUserId) || String(inst.action_by?.id) === String(currentUserId)))
                          )
                        )
                      );
                      return renderStatusBadge(
                        selectedBundleForView.status,
                        false,
                        selectedBundleForView.approval_history?.find(i => i.status === 'Pending')?.step_name,
                        hasModalUserApproved
                      );
                    })()}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-normal mt-0.5">
                    <span>Worker:</span>
                    <AvatarCircle
                      user={selectedBundleForView.worker_detail}
                      name={selectedBundleForView.worker_detail?.full_name || selectedBundleForView.worker_detail?.username || 'Technician'}
                      size="xs"
                    />
                    <span className="font-semibold text-on-surface">{selectedBundleForView.worker_detail?.full_name || selectedBundleForView.worker_detail?.username || 'Technician'}</span>
                    {selectedBundleForView.claim_date && ` • Created: ${new Date(selectedBundleForView.claim_date).toLocaleDateString()}`}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedBundleForView(null)} className="p-2 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded bg-surface-container-low border border-outline-variant/80 shadow-2xs">
                <span className="text-on-surface-variant block text-[10px]  tracking-wider font-semibold">Total Amount</span>
                <span className="font-bold text-sm text-primary mt-0.5 block">${parseFloat(selectedBundleForView.total_claimed_amount).toFixed(2)}</span>
              </div>
              <div className="p-3 rounded bg-surface-container-low border border-outline-variant/80 shadow-2xs">
                <span className="text-on-surface-variant block text-[10px]  tracking-wider font-semibold">Coverage Period</span>
                <span className="font-semibold text-on-surface mt-0.5 block">
                  {selectedBundleForView.period_from && selectedBundleForView.period_to ? `${selectedBundleForView.period_from} → ${selectedBundleForView.period_to}` : 'All Expenses'}
                </span>
              </div>
              <div className="p-3 rounded bg-surface-container-low border border-outline-variant/80 shadow-2xs">
                <span className="text-on-surface-variant block text-[10px]  tracking-wider font-semibold">Tied Bills / Expenses</span>
                <span className="font-semibold text-on-surface mt-0.5 block">{selectedBundleForView.expenses?.length || 0} Bills</span>
              </div>
            </div>

            {selectedBundleForView.ledger_details && (
              <div className="p-3.5 rounded bg-blue-500/10 border border-blue-500/20 text-xs">
                <span className="text-blue-600 dark:text-blue-400 font-semibold block text-[10px]  tracking-wider flex items-center gap-1 mb-1">
                  Attached Ledger Batch
                </span>
                <span className="font-semibold text-xs text-on-surface">
                  {selectedBundleForView.ledger_details.group_name} <span className="text-on-surface-variant font-normal">(Ledger #{selectedBundleForView.ledger_details.ledger_id} • Status: {selectedBundleForView.ledger_details.status})</span>
                </span>
              </div>
            )}

            {selectedBundleForView.remarks && (
              <div className="p-3.5 rounded bg-surface-container-low border border-outline-variant/80 text-xs shadow-2xs">
                <span className="font-semibold text-on-surface block mb-1">Remarks:</span>
                <p className="text-on-surface-variant italic">{selectedBundleForView.remarks}</p>
              </div>
            )}

            {/* Visual Approval Pipeline Stepper inside View Modal */}
            {renderBundleApprovalStepper(selectedBundleForView)}

            <div className="space-y-2.5">
              <h4 className="text-xs font-bold  tracking-wider text-on-surface flex items-center justify-between">
                <span>Tied Bills & Receipts ({selectedBundleForView.expenses?.length || 0})</span>
              </h4>

              {(!selectedBundleForView.expenses || selectedBundleForView.expenses.length === 0) ? (
                <div className="p-6 text-center text-xs text-on-surface-variant border border-outline-variant/80 rounded bg-surface-container-low">
                  No expenses currently attached to this bundle.
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                  {selectedBundleForView.expenses.map((exp) => {
                    const receiptsList: MediaFileItem[] = [];
                    if (exp.receipt) receiptsList.push(exp.receipt);
                    if (exp.receipts && Array.isArray(exp.receipts)) {
                      exp.receipts.forEach(r => {
                        if (!receiptsList.some(ex => ex.media_id === r.media_id)) {
                          receiptsList.push(r);
                        }
                      });
                    }

                    const statusText = (exp.expense_type && (exp.expense_type as any).approve_required === false)
                      ? 'Approved'
                      : (exp.status_display || (exp.approved ? 'Approved' : ((exp.claim?.status === 'Rejected' || exp.claim?.status === 'Rework') ? exp.claim.status : 'Pending Approval')));
                    const isExpApproved = statusText === 'Approved';
                    const isExpRejected = statusText === 'Rejected';
                    const isExpRework = statusText === 'Rework';

                    return (
                      <div key={exp.expense_id} className="p-3.5 rounded border border-outline-variant/80 bg-surface-container-low space-y-2.5 text-xs shadow-2xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-on-surface text-sm">
                              {exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || 'Expense'}
                            </span>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant mt-0.5">
                              <span>Date: {exp.expense_date}</span>
                              {exp.ticket_details && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedTicketForModal && setSelectedTicketForModal(exp.ticket_details)}
                                  className="px-2 py-0.5 rounded-md bg-surface-container-high text-primary font-semibold hover:underline cursor-pointer"
                                >
                                  {exp.ticket_details.work_order_no}
                                </button>
                              )}
                              {exp.responsible_store && (
                                <span className="text-on-surface-variant font-medium">
                                  Store: {exp.responsible_store.store_name}
                                </span>
                              )}
                            </div>
                            {exp.remarks && <p className="text-[11px] text-on-surface-variant italic mt-1">{exp.remarks}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isExpApproved
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : isExpRejected
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : isExpRework
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              }`}>
                              {statusText}
                            </span>
                            <span className="font-bold text-sm text-on-surface shrink-0">
                              ${parseFloat(exp.amount).toFixed(2)}
                            </span>
                            {selectedBundleForView?.status !== 'Paid' && !selectedBundleForView?.ledger_details && !(selectedBundleForView as any)?.ledger_id && handleRemoveExpenseFromBundle && (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await handleRemoveExpenseFromBundle(selectedBundleForView.claim_id, exp.expense_id);
                                  const updatedExpenses = (selectedBundleForView.expenses || []).filter(item => item.expense_id !== exp.expense_id);
                                  if (updatedExpenses.length === 0) {
                                    setSelectedBundleForView(null);
                                  } else {
                                    const updatedTotal = updatedExpenses.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
                                    setSelectedBundleForView({
                                      ...selectedBundleForView,
                                      status: 'Draft',
                                      expenses: updatedExpenses,
                                      total_claimed_amount: updatedTotal.toFixed(2)
                                    });
                                  }
                                }}
                                className="p-1 rounded hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:border-rose-500/40 transition-colors cursor-pointer"
                                title="Remove Expense from Bundle"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {receiptsList.length > 0 && (
                          <div className="pt-2.5 border-t border-outline-variant/60">
                            <span className="text-[10px] font-bold  text-on-surface-variant block mb-1.5 flex items-center gap-1">
                              <Paperclip className="w-3.5 h-3.5" /> Receipts / Media ({receiptsList.length})
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {receiptsList.map((m) => (
                                <div
                                  key={m.media_id}
                                  onClick={() => setPreviewMediaUrl({ url: m.file_url, title: m.file_name || `Receipt ${m.media_id}` })}
                                  className="group relative w-16 h-16 rounded border border-outline-variant overflow-hidden bg-black/10 cursor-pointer hover:border-primary transition-all shadow-2xs"
                                >
                                  <img
                                    src={m.file_url.startsWith('http') ? m.file_url : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${m.file_url}`}
                                    alt={m.file_name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* View Modal Footer & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-outline-variant/80">
              <div className="flex items-center gap-2">
                {(selectedBundleForView.status === 'Draft' || selectedBundleForView.status === 'Rework') && (
                  <Can permission={["finance.edit_bundle", "finance.edit_workerclaim", "finance.change_workerclaim"] as any}>
                    <button
                      onClick={() => {
                        const b = selectedBundleForView;
                        setSelectedBundleForView(null);
                        openEditBundleModal(b);
                      }}
                      className="px-3.5 py-2 rounded border border-primary text-primary hover:bg-primary/10 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Edit Bundle</span>
                    </button>
                  </Can>
                )}
                {selectedBundleForView.status !== 'Approved' && selectedBundleForView.status !== 'Paid' && (
                  <Can permission={["finance.delete_bundle", "finance.delete_workerclaim"] as any}>
                    <button
                      onClick={() => {
                        const id = selectedBundleForView.claim_id;
                        setSelectedBundleForView(null);
                        handleDeleteBundle(id);
                      }}
                      className="px-3.5 py-2 rounded border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Bundle</span>
                    </button>
                  </Can>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {(selectedBundleForView.status === 'Submitted' || selectedBundleForView.status === 'In Review') && (() => {
                  const viewBundleApp = approvalsProps?.approvals?.find(a =>
                    (a.claim === selectedBundleForView.claim_id || a.claim_id === selectedBundleForView.claim_id || (a.target_summary?.type === 'Bundle' && a.target_summary?.id === selectedBundleForView.claim_id)) &&
                    a.status === 'Pending'
                  );
                  const canApproveView = viewBundleApp && (
                    viewBundleApp.can_action ||
                    currentUser?.is_superuser ||
                    (viewBundleApp.assigned_role_name && currentUser?.role?.name === viewBundleApp.assigned_role_name)
                  );

                  if (!canApproveView) return null;

                  const isActing = actioningBundleId === selectedBundleForView.claim_id;

                  return (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Add review comment..."
                        value={reworkComments[selectedBundleForView.claim_id] || ''}
                        onChange={(e) => setReworkComments(prev => ({ ...prev, [selectedBundleForView.claim_id]: e.target.value }))}
                        className="px-2.5 py-1.5 text-xs bg-surface border border-outline-variant rounded focus:outline-hidden focus:border-primary w-48 text-on-surface"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await handleInlineBundleAction(selectedBundleForView, 'APPROVED');
                          setSelectedBundleForView(null);
                        }}
                        disabled={isActing}
                        className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await handleInlineBundleAction(selectedBundleForView, 'REWORK');
                          setSelectedBundleForView(null);
                        }}
                        disabled={isActing}
                        className="px-3.5 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        <span>Rework</span>
                      </button>
                    </div>
                  );
                })()}

                {(selectedBundleForView.status === 'Draft' || selectedBundleForView.status === 'Rework') && (
                  <Can permission={["finance.submit_bundle", "finance.submit_workerclaim"] as any}>
                    <button
                      onClick={async () => {
                        await onHandleSubmitBundle(selectedBundleForView.claim_id);
                        setSelectedBundleForView(null);
                      }}
                      disabled={submittingBundleId === selectedBundleForView.claim_id || submitting}
                      className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-all cursor-pointer shadow-md hover:shadow-primary/25 active:scale-[0.98] inline-flex items-center gap-1.5"
                    >
                      {submittingBundleId === selectedBundleForView.claim_id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <span>{selectedBundleForView.status === 'Rework' ? 'Resubmit Approval' : 'Submit Approval'}</span>
                      )}
                    </button>
                  </Can>
                )}
                <button
                  onClick={() => setSelectedBundleForView(null)}
                  className="px-4 py-2 rounded border border-outline-variant text-xs text-on-surface hover:bg-surface-container-high transition-colors font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL 2: EDIT BUNDLE & MANAGE TIED EXPENSES */}
      <EditBundleModal
        selectedBundleForEdit={selectedBundleForEdit}
        setSelectedBundleForEdit={setSelectedBundleForEdit}
        editBundleForm={editBundleForm}
        setEditBundleForm={setEditBundleForm}
        unclaimedExpenses={unclaimedExpenses}
        submitting={submitting}
        handleSaveUpdateBundle={handleSaveUpdateBundle}
      />

      {/* POPUP MODAL: EXPENSE MAIN PREVIEW & DETAILS */}
      {previewExpense && (() => {
        const rawTicket = (previewExpense.ticket_details || previewExpense.ticket) as any;
        const ticketInfo = (typeof rawTicket === 'object' && rawTicket !== null) ? {
          id: rawTicket.ticket_id || (rawTicket as any).id || null,
          workOrderNo: String(rawTicket.work_order_no || (rawTicket as any).wo_no || ''),
          title: typeof rawTicket.title === 'string' ? rawTicket.title : (rawTicket.title ? String(rawTicket.title) : ''),
          description: typeof rawTicket.description === 'string' ? rawTicket.description : (rawTicket.description ? String(rawTicket.description) : ''),
          status: typeof rawTicket.status === 'object' ? (rawTicket.status?.status_name || '') : (rawTicket.status ? String(rawTicket.status) : ''),
          priority: typeof rawTicket.priority === 'object' ? (rawTicket.priority?.priority_name || '') : (rawTicket.priority ? String(rawTicket.priority) : ''),
          createdDate: rawTicket.created_date ? new Date(rawTicket.created_date).toLocaleDateString() : '',
          department: typeof rawTicket.department === 'object' ? (rawTicket.department?.department_name || '') : (rawTicket.department || (rawTicket as any).department_name || ''),
          location: typeof rawTicket.location === 'object' ? (rawTicket.location?.location_name || '') : (rawTicket.location || (rawTicket as any).location_name || ''),
          store: typeof rawTicket.store === 'object' ? (rawTicket.store?.store_name || '') : (rawTicket.store || (rawTicket as any).store_name || ''),
          createdBy: typeof rawTicket.created_by === 'object' ? (rawTicket.created_by?.full_name || rawTicket.created_by?.username || '') : (rawTicket.created_by ? String(rawTicket.created_by) : '')
        } : (typeof rawTicket === 'number' || typeof rawTicket === 'string') ? {
          id: rawTicket,
          workOrderNo: '',
          title: '',
          description: '',
          status: '',
          priority: '',
          createdDate: '',
          department: '',
          location: '',
          store: '',
          createdBy: ''
        } : null;

        const workerDisplayName = (() => {
          const w = previewExpense.worker_detail || previewExpense.worker;
          if (typeof w === 'object' && w !== null) {
            return w.full_name || w.username || (w.id ? `Worker #${w.id}` : 'Technician');
          }
          if (typeof w === 'number' || typeof w === 'string') {
            return `Worker #${w}`;
          }
          return 'Technician';
        })();

        const storeDisplayName = (() => {
          const s = previewExpense.responsible_store;
          if (typeof s === 'object' && s !== null) {
            return s.store_name || (s.store_id ? `Store #${s.store_id}` : 'N/A');
          }
          if (typeof s === 'number' || typeof s === 'string') {
            return `Store #${s}`;
          }
          return 'N/A';
        })();

        const expTypeName = (() => {
          const et = previewExpense.expense_type_detail || previewExpense.expense_type;
          if (typeof et === 'object' && et !== null) {
            return et.expense_name || 'General Expense';
          }
          if (typeof et === 'string') return et;
          return 'General Expense';
        })();

        const receiptsList: MediaFileItem[] = [];
        if (previewExpense.receipt) receiptsList.push(previewExpense.receipt);
        if (previewExpense.receipts && Array.isArray(previewExpense.receipts)) {
          previewExpense.receipts.forEach(r => {
            if (!receiptsList.some(ex => ex.media_id === r.media_id)) receiptsList.push(r);
          });
        }

        const safeIndex = activeReceiptIndex < receiptsList.length ? activeReceiptIndex : 0;
        const currentReceipt = receiptsList[safeIndex];

        return (
          <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150" onClick={() => setPreviewExpense(null)}>
            <div className="bg-surface-container rounded border border-outline-variant/80 max-w-2xl w-full p-4 sm:p-4 space-y-4 shadow-2xl my-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between border-b border-outline-variant/80 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-on-surface tracking-tight">Expense {previewExpense.expense_id}</h3>

                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Submitted by <strong className="text-on-surface">{workerDisplayName}</strong> on {previewExpense.expense_date || 'N/A'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewExpense(null)}
                  className="p-2 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* MAIN EXPENSE VISUAL RECEIPT PREVIEW (PRIMARY DISPLAY AT TOP) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface tracking-wider flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-primary" />
                    <span>Expense Preview</span>
                  </span>
                  {receiptsList.length > 0 && (
                    <span className="text-xs text-on-surface-variant font-medium">
                      Showing {safeIndex + 1}/{receiptsList.length}
                    </span>
                  )}
                </div>

                {receiptsList.length > 0 ? (
                  <div className="space-y-2.5">
                    {/* Main Showcase Image Display Box */}
                    <div
                      onClick={() => currentReceipt && setPreviewMediaUrl({ url: currentReceipt.file_url, title: currentReceipt.file_name || `Expense #${previewExpense.expense_id} Receipt` })}
                      className="group relative w-full h-72 sm:h-80 rounded border border-outline-variant bg-black/60 overflow-hidden cursor-pointer flex items-center justify-center transition-all shadow-inner"
                    >
                      <img
                        src={currentReceipt.file_url.startsWith('http') ? currentReceipt.file_url : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${currentReceipt.file_url}`}
                        alt={currentReceipt.file_name || 'Expense Receipt Preview'}
                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity duration-200 text-white backdrop-blur-[2px]">
                        <Maximize2 className="w-6 h-6" />
                        <span className="text-xs font-semibold">Click to view full screen</span>
                      </div>
                      <div className="absolute bottom-3 right-3 bg-black/75 backdrop-blur-md px-3 py-1 rounded text-[11px] font-medium text-white flex items-center gap-1.5 shadow-md">
                        <Paperclip className="w-3.5 h-3.5 text-primary" />
                        <span>{currentReceipt.file_name || `Receipt #${currentReceipt.media_id}`}</span>
                      </div>
                    </div>

                    {/* Thumbnail Ribbon Selector if Multiple Receipts */}
                    {receiptsList.length > 1 && (
                      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
                        {receiptsList.map((m, idx) => (
                          <div
                            key={m.media_id}
                            onClick={() => setActiveReceiptIndex(idx)}
                            className={`relative w-20 h-20 rounded border-2 overflow-hidden cursor-pointer transition-all shrink-0 bg-black/20 ${idx === safeIndex ? 'border-primary ring-2 ring-primary/30 scale-105' : 'border-outline-variant opacity-70 hover:opacity-100'}`}
                          >
                            <img
                              src={m.file_url.startsWith('http') ? m.file_url : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${m.file_url}`}
                              alt={m.file_name || 'Thumbnail'}
                              className="w-full h-full object-cover"
                            />
                            {idx === safeIndex && (
                              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-xs">
                                <Check className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 rounded border border-dashed border-outline-variant/80 bg-surface-container-low text-center space-y-2">
                    <Receipt className="w-10 h-10 mx-auto text-on-surface-variant/40" />
                    <p className="text-xs text-on-surface-variant font-medium">
                      No receipt images or media attachments uploaded for this expense.
                    </p>
                  </div>
                )}
              </div>

              {/* EXPENSE SUMMARY BANNER (AMOUNT, STORE, WORKER, DATE) */}
              <div className="p-4 rounded bg-surface-container-low border border-outline-variant/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shadow-2xs">
                <div>
                  <span className="text-[10px] font-semibold text-on-surface-variant  tracking-wider block">Total Amount</span>
                  <span className="text-lg font-extrabold text-primary block mt-0.5">
                    {parseFloat(previewExpense.amount || '0').toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-on-surface-variant  tracking-wider block">Expense Date</span>
                  <span className="font-semibold text-on-surface block mt-1">{previewExpense.expense_date || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-on-surface-variant  tracking-wider block">Worker / Technician</span>
                  <span className="font-semibold text-on-surface block mt-1 truncate" title={workerDisplayName}>{workerDisplayName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-on-surface-variant  tracking-wider block">Responsible Store</span>
                  <span className="font-semibold text-on-surface block mt-1 truncate" title={storeDisplayName}>{storeDisplayName}</span>
                </div>
              </div>

              {/* REMARKS / NOTES */}
              <div className="p-4 rounded bg-surface-container-low border border-outline-variant/80 space-y-1.5 text-xs shadow-2xs">
                <span className="text-[10px] font-semibold text-on-surface-variant  tracking-wider block">Expense Remarks / Description</span>
                <p className="text-on-surface text-xs leading-relaxed italic bg-surface-container p-3 rounded border border-outline-variant/60">
                  {previewExpense.remarks || 'No remarks recorded.'}
                </p>
              </div>

              {/* LINKED TICKET DETAILS */}
              {ticketInfo ? (
                <div className="p-4 rounded bg-surface-container-low border border-primary/30 space-y-2.5 text-xs shadow-2xs">
                  <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
                    <span className="text-xs font-bold text-primary  tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> Linked Ticket Information
                    </span>
                    {ticketInfo.id && (
                      <button
                        type="button"
                        onClick={() => setSelectedTicketForModal && setSelectedTicketForModal(rawTicket)}
                        className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[11px] border border-primary/20 hover:bg-primary/20 cursor-pointer"
                      >
                        Ticket #{ticketInfo.id}
                      </button>
                    )}
                  </div>

                  {ticketInfo.workOrderNo && (
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant font-medium text-xs">Work Order Number:</span>
                      <span className="font-bold text-on-surface font-mono">{ticketInfo.workOrderNo}</span>
                    </div>
                  )}

                  {ticketInfo.title && (
                    <div>
                      <span className="text-on-surface-variant text-[10px]  font-semibold block">Ticket Title</span>
                      <p className="font-semibold text-on-surface text-xs mt-0.5">{ticketInfo.title}</p>
                    </div>
                  )}

                  {ticketInfo.description && (
                    <div>
                      <span className="text-on-surface-variant text-[10px]  font-semibold block">Description</span>
                      <p className="text-on-surface-variant text-xs mt-0.5 leading-relaxed bg-surface-container p-3 rounded border border-outline-variant/80">
                        {ticketInfo.description}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1.5 border-t border-outline-variant/40">
                    {ticketInfo.status && (
                      <div>
                        <span className="text-[10px] text-on-surface-variant block">Status</span>
                        <span className="font-semibold text-on-surface block">{ticketInfo.status}</span>
                      </div>
                    )}
                    {ticketInfo.priority && (
                      <div>
                        <span className="text-[10px] text-on-surface-variant block">Priority</span>
                        <span className="font-semibold text-on-surface block">{ticketInfo.priority}</span>
                      </div>
                    )}
                    {ticketInfo.department && (
                      <div>
                        <span className="text-[10px] text-on-surface-variant block">Department</span>
                        <span className="font-semibold text-on-surface block">{ticketInfo.department}</span>
                      </div>
                    )}
                    {ticketInfo.location && (
                      <div>
                        <span className="text-[10px] text-on-surface-variant block">Location</span>
                        <span className="font-semibold text-on-surface block">{ticketInfo.location}</span>
                      </div>
                    )}
                    {ticketInfo.store && (
                      <div>
                        <span className="text-[10px] text-on-surface-variant block">Store</span>
                        <span className="font-semibold text-on-surface block">{ticketInfo.store}</span>
                      </div>
                    )}
                    {ticketInfo.createdDate && (
                      <div>
                        <span className="text-[10px] text-on-surface-variant block">Created Date</span>
                        <span className="font-semibold text-on-surface block">{ticketInfo.createdDate}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded bg-surface-container-low border border-outline-variant/80 text-xs text-on-surface-variant italic shadow-2xs">
                  No ticket linked to this expense.
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end pt-3.5 border-t border-outline-variant/80">
                <button
                  type="button"
                  onClick={() => setPreviewExpense(null)}
                  className="px-5 py-2.5 rounded border border-outline-variant text-xs text-on-surface hover:bg-surface-container-high transition-colors font-semibold cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* POPUP MODAL 3: MEDIA / RECEIPT LIGHTBOX */}
      {previewMediaUrl && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={() => setPreviewMediaUrl(null)}>
          <div className="relative max-w-4xl max-h-[90vh] bg-surface-container rounded border border-outline-variant/80 overflow-hidden p-3 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-2 border-b border-outline-variant/80 mb-2">
              <span className="text-xs font-bold text-on-surface">{previewMediaUrl.title}</span>
              <button onClick={() => setPreviewMediaUrl(null)} className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewMediaUrl.url.startsWith('http') ? previewMediaUrl.url : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${previewMediaUrl.url}`}
              alt={previewMediaUrl.title}
              className="max-h-[75vh] w-auto mx-auto object-contain rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
};
