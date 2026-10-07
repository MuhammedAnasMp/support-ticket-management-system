import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  DollarSign, Plus, Search, RefreshCw, Filter, ShieldCheck,
  CreditCard, Calendar, RotateCcw, Building2, Receipt, Layers, AlertCircle, CheckCircle2, X
} from 'lucide-react';
import type { RootState } from '../store';
import { TicketDetailModal } from './ticket/TicketDetailModal';
import { DateRangePickerCard } from './ticket/DateRangePickerCard';
import { SearchableSelect, type SelectOption } from '../components/SearchableSelect';

import { API_URL, getUserId } from './finance/types';
import type {
  ExpenseItem,
  WorkerClaimItem,
  LedgerItem,
  LedgerGroupItem,
  ApprovalInstanceItem,
  AuditEventItem,
  PaymentItem
} from './finance/types';

import { BundlesSubpage } from './finance/BundlesSubpage';
import { LedgersSubpage } from './finance/LedgersSubpage';
import { ApprovalsSubpage } from './finance/ApprovalsSubpage';
import { PaymentsSubpage } from './finance/PaymentsSubpage';
import { EditBundleModal } from './finance/EditBundleModal';
import { ExpensesSubpage } from './finance/ExpensesSubpage';
import Can from '../hooks/Can';

const getCurrentMonthRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    from: format(start),
    to: format(end)
  };
};

export const FinanceView: React.FC = () => {
  const { subpage = 'bundles' } = useParams<{ subpage: string }>();
  const navigate = useNavigate();
  const token = useSelector((state: RootState) => state.auth.token);
  const currentUser = useSelector((state: RootState) => state.auth.user);

  // Data states
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [bundles, setBundles] = useState<WorkerClaimItem[]>([]);
  const [ledgers, setLedgers] = useState<LedgerItem[]>([]);
  const [ledgerGroups, setLedgerGroups] = useState<LedgerGroupItem[]>([]);
  const [approvals, setApprovals] = useState<ApprovalInstanceItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [unclaimedExpenses, setUnclaimedExpenses] = useState<ExpenseItem[]>([]);
  const [selectedTicketForModal, setSelectedTicketForModal] = useState<any | null>(null);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Global Filter States (Default: Current Month or from localStorage)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>(() => {
    const stored = localStorage.getItem('finance_filter_date_from');
    if (stored !== null && stored !== undefined) return stored;
    return getCurrentMonthRange().from;
  });
  const [filterDateTo, setFilterDateTo] = useState<string>(() => {
    const stored = localStorage.getItem('finance_filter_date_to');
    if (stored !== null && stored !== undefined) return stored;
    return getCurrentMonthRange().to;
  });
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'IN_LEDGER' | 'NOT_IN_LEDGER'>('ALL');

  // Sync date filter changes with localStorage
  useEffect(() => {
    if (filterDateFrom) {
      localStorage.setItem('finance_filter_date_from', filterDateFrom);
    } else {
      localStorage.removeItem('finance_filter_date_from');
    }
  }, [filterDateFrom]);

  useEffect(() => {
    if (filterDateTo) {
      localStorage.setItem('finance_filter_date_to', filterDateTo);
    } else {
      localStorage.removeItem('finance_filter_date_to');
    }
  }, [filterDateTo]);

  // Modal States
  const [showCreateExpenseModal, setShowCreateExpenseModal] = useState(false);
  const [showCreateBundleModal, setShowCreateBundleModal] = useState(false);
  const [showCreateLedgerModal, setShowCreateLedgerModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState<ApprovalInstanceItem | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<PaymentItem | WorkerClaimItem | LedgerItem | null>(null);

  // Bundle Detail View & Edit Modal States
  const [selectedBundleForView, setSelectedBundleForView] = useState<WorkerClaimItem | null>(null);
  const [selectedBundleForEdit, setSelectedBundleForEdit] = useState<WorkerClaimItem | null>(null);
  const [editBundleForm, setEditBundleForm] = useState<{
    period_from: string;
    period_to: string;
    remarks: string;
    selectedExpenseIds: number[];
  }>({ period_from: '', period_to: '', remarks: '', selectedExpenseIds: [] });
  const [previewMediaUrl, setPreviewMediaUrl] = useState<{ url: string; title: string } | null>(null);

  // Create Bundle Modal Filters
  const [expenseSearchWorker, setExpenseSearchWorker] = useState('');
  const [expenseSearchText, setExpenseSearchText] = useState('');
  const [expenseFilterFrom, setExpenseFilterFrom] = useState('');
  const [expenseFilterTo, setExpenseFilterTo] = useState('');
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<number[]>([]);
  const [bundlePeriodFrom, setBundlePeriodFrom] = useState('');
  const [bundlePeriodTo, setBundlePeriodTo] = useState('');
  const [bundleRemarks, setBundleRemarks] = useState('');

  // Create Ledger Modal Form
  const [selectedBundleIds, setSelectedBundleIds] = useState<number[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [newGroupName, setNewGroupName] = useState('');
  const [ledgerRemarks, setLedgerRemarks] = useState('');

  // Approval Modal Form
  const [approvalAction, setApprovalAction] = useState<'APPROVED' | 'REJECTED' | 'REWORK'>('APPROVED');
  const [approvalComments, setApprovalComments] = useState('');

  // Payment Modal Form
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');

  // Approval Queue Filters
  const [roleFilterOnly, setRoleFilterOnly] = useState(true);
  const [approvalEntityTab, setApprovalEntityTab] = useState<'ALL' | 'Bundle' | 'Ledger' | 'Expense'>('ALL');
  const [approvalStatusTab, setApprovalStatusTab] = useState<string>('ALL');
  const [expandedApprovalIds, setExpandedApprovalIds] = useState<Record<number, boolean>>({});

  const toggleExpandApproval = (id: number) => {
    setExpandedApprovalIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Flash Notifications
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Expanded Ledger Rows & Add Expense Modal
  const [expandedLedgerIds, setExpandedLedgerIds] = useState<Record<number, boolean>>({});
  const [showAddExpenseModal, setShowAddExpenseModal] = useState<LedgerItem | null>(null);
  const [availableApprovedExpenses, setAvailableApprovedExpenses] = useState<ExpenseItem[]>([]);
  const [loadingAvailableExpenses, setLoadingAvailableExpenses] = useState(false);
  const [selectedAddExpenseId, setSelectedAddExpenseId] = useState<number | null>(null);

  const toggleExpandLedger = (ledgerId: number) => {
    setExpandedLedgerIds(prev => ({ ...prev, [ledgerId]: !prev[ledgerId] }));
  };

  const openAddExpenseModal = async (ledger: LedgerItem) => {
    setShowAddExpenseModal(ledger);
    setSelectedAddExpenseId(null);
    setLoadingAvailableExpenses(true);
    try {
      const storeId = ledger.store_detail?.store_id || '';
      const res = await fetch(`${API_URL}/finance/ledgers/available-approved-expenses/?store_id=${storeId}`, {
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableApprovedExpenses(data);
      }
    } catch (err: any) {
      console.error("Failed to load approved expenses", err);
    } finally {
      setLoadingAvailableExpenses(false);
    }
  };

  const openEditBundleModal = (bundle: WorkerClaimItem) => {
    setSelectedBundleForEdit(bundle);
    const existingIds = bundle.expenses ? bundle.expenses.map(e => e.expense_id) : [];
    setEditBundleForm({
      period_from: bundle.period_from || '',
      period_to: bundle.period_to || '',
      remarks: bundle.remarks || '',
      selectedExpenseIds: existingIds
    });
  };

  const handleSaveUpdateBundle = async () => {
    if (!selectedBundleForEdit) return;
    if (editBundleForm.selectedExpenseIds.length === 0) {
      setErrorMessage("A bundle must contain at least one expense.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_URL}/finance/claim/${selectedBundleForEdit.claim_id}/update-bundle/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expense_ids: editBundleForm.selectedExpenseIds,
          period_from: editBundleForm.period_from || undefined,
          period_to: editBundleForm.period_to || undefined,
          remarks: editBundleForm.remarks || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update bundle');

      setSuccessMessage(`Bundle ${selectedBundleForEdit.claim_id} updated successfully.`);
      setSelectedBundleForEdit(null);
      setSelectedBundleForView(null);
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveExpenseFromBundle = async (bundleId: number, expenseId: number) => {
    if (!window.confirm(`Are you sure you want to remove Expense #${expenseId} from Bundle #${bundleId}? The bundle status will reset to Draft.`)) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_URL}/finance/claim/${bundleId}/remove-expense/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ expense_id: expenseId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to remove expense from bundle');

      setSuccessMessage(`Expense #${expenseId} removed from Bundle #${bundleId}. Bundle status reset to Draft.`);
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBundle = async (claimId: number) => {
    if (!window.confirm(`Are you sure you want to delete Bundle ${claimId}? All tied expenses will be unlinked and returned to unclaimed status.`)) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_URL}/finance/claim/${claimId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to delete bundle');
      }
      setSuccessMessage(`Bundle ${claimId} deleted. All tied expenses have been released back to unclaimed status.`);
      setSelectedBundleForView(null);
      setSelectedBundleForEdit(null);
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLedger = async (ledgerId: number) => {
    if (!window.confirm(`Are you sure you want to delete Ledger Batch ${ledgerId}?`)) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_URL}/finance/ledgers/${ledgerId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to delete ledger');
      }
      setSuccessMessage(`Ledger Batch ${ledgerId} deleted successfully.`);
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddExpenseToLedger = async () => {
    if (!showAddExpenseModal || !selectedAddExpenseId) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_URL}/finance/ledgers/${showAddExpenseModal.ledger_id}/add-expense/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense_id: selectedAddExpenseId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add expense');
      setSuccessMessage(`Expense ${selectedAddExpenseId} added to Ledger ${showAddExpenseModal.ledger_id}.`);
      setShowAddExpenseModal(null);
      setSelectedAddExpenseId(null);
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveExpenseFromLedger = async (ledgerId: number, expenseId: number) => {
    if (!window.confirm(`Are you sure you want to remove Expense ${expenseId} from this Ledger Batch?`)) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_URL}/finance/ledgers/${ledgerId}/remove-expense/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense_id: expenseId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to remove expense');
      setSuccessMessage(`Expense ${expenseId} removed from Ledger ${ledgerId}.`);
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddBundleToLedger = async (ledgerId: number, bundleId: number) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_URL}/finance/ledgers/${ledgerId}/add-bundle/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle_id: bundleId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add bundle to ledger');
      setSuccessMessage(`Bundle #${bundleId} attached to Ledger Batch #${ledgerId}.`);
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddBundleToGroup = async (groupId: number, bundleId: number | number[]) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const bundleIds = Array.isArray(bundleId) ? bundleId : [bundleId];
      if (bundleIds.length === 0) return;

      for (const bId of bundleIds) {
        const res = await fetch(`${API_URL}/finance/ledger-groups/${groupId}/add-bundle/`, {
          method: 'POST',
          headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ bundle_id: bId, bundle_ids: [bId] })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Failed to add Bundle #${bId} to ledger group`);
      }

      const count = bundleIds.length;
      setSuccessMessage(`${count} bundle${count > 1 ? 's' : ''} successfully added to Ledger Group #${groupId}.`);
      await fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveBundleFromLedger = async (ledgerId: number, bundleId: number) => {
    if (!window.confirm(`Are you sure you want to detach Bundle #${bundleId} from Ledger #${ledgerId}?`)) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_URL}/finance/ledgers/${ledgerId}/remove-bundle/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle_id: bundleId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to remove bundle');
      setSuccessMessage(`Bundle #${bundleId} detached from Ledger #${ledgerId}.`);
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveBundleFromGroup = async (groupId: number, bundleId: number) => {
    if (!window.confirm(`Are you sure you want to remove Bundle #${bundleId} from this Ledger Group?`)) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_URL}/finance/ledger-groups/${groupId}/remove-bundle/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle_id: bundleId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to remove bundle from group');
      setSuccessMessage(`Bundle #${bundleId} removed from Ledger Group.`);
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLedgerGroup = async (groupId: number) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_URL}/finance/ledger-groups/${groupId}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || 'Failed to delete Ledger Group');
      }
      setSuccessMessage(`Ledger Group #${groupId} deleted successfully.`);
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const parseList = (data: any) => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
  };

  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch API data (with silent background mode and cancellation support)
  const fetchData = async (isSilent = false) => {
    if (!token) return;

    // Cancel any previous in-flight fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    if (!isSilent) setLoading(true);
    setErrorMessage(null);

    const headers = {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    };

    const approvalsUrl = roleFilterOnly
      ? `${API_URL}/finance/approvals/?assigned_to_me=true&page_size=all`
      : `${API_URL}/finance/approvals/?page_size=all`;

    try {
      if (subpage === 'expenses') {
        const [resExp, resApp] = await Promise.all([
          fetch(`${API_URL}/finance/expense/?page_size=all`, { headers, signal }),
          fetch(`${API_URL}/finance/approvals/?page_size=all`, { headers, signal })
        ]);
        if (signal.aborted) return;
        if (resExp.ok) setExpenses(parseList(await resExp.json()));
        if (resApp.ok) setApprovals(parseList(await resApp.json()));
      } else if (subpage === 'bundles') {
        const [resClaims, resExp, resApp] = await Promise.all([
          fetch(`${API_URL}/finance/claim/?page_size=all`, { headers, signal }),
          fetch(`${API_URL}/finance/expense/?is_claimed=false&page_size=all`, { headers, signal }),
          fetch(`${API_URL}/finance/approvals/?page_size=all`, { headers, signal })
        ]);
        if (signal.aborted) return;
        if (resClaims.ok) setBundles(parseList(await resClaims.json()));
        if (resExp.ok) setUnclaimedExpenses(parseList(await resExp.json()));
        if (resApp.ok) setApprovals(parseList(await resApp.json()));
      } else if (subpage === 'ledgers') {
        const [resL, resG, resApprovedBundles, resExp, resApp] = await Promise.all([
          fetch(`${API_URL}/finance/ledgers/?page_size=all`, { headers, signal }),
          fetch(`${API_URL}/finance/ledger-groups/?page_size=all`, { headers, signal }),
          fetch(`${API_URL}/finance/claim/?status=Approved&page_size=all`, { headers, signal }),
          fetch(`${API_URL}/finance/expense/?is_claimed=false&approved=true&page_size=all`, { headers, signal }),
          fetch(approvalsUrl, { headers, signal })
        ]);
        if (signal.aborted) return;
        if (resL.ok) setLedgers(parseList(await resL.json()));
        if (resG.ok) setLedgerGroups(parseList(await resG.json()));
        if (resApprovedBundles.ok) setBundles(parseList(await resApprovedBundles.json()));
        if (resExp.ok) setUnclaimedExpenses(parseList(await resExp.json()));
        if (resApp.ok) setApprovals(parseList(await resApp.json()));
      } else if (subpage === 'approvals') {
        const res = await fetch(approvalsUrl, { headers, signal });
        if (signal.aborted) return;
        if (res.ok) setApprovals(parseList(await res.json()));
      } else if (subpage === 'payments') {
        const [resPay, resAudit] = await Promise.all([
          fetch(`${API_URL}/finance/payments/?page_size=all`, { headers, signal }),
          fetch(`${API_URL}/finance/audit-events/?page_size=all`, { headers, signal })
        ]);
        if (signal.aborted) return;
        if (resPay.ok) setPayments(parseList(await resPay.json()));
        if (resAudit.ok) setAuditEvents(parseList(await resAudit.json()));
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || signal.aborted) {
        // Silently return on tab cancellation
        return;
      }
      setErrorMessage(err.message || 'Failed to connect to backend server.');
    } finally {
      if (!signal.aborted) {
        if (!isSilent) setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(false);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [subpage, token, roleFilterOnly]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Status Badge Renderer
  const renderStatusBadge = (
    status: string,
    isActionableForMe?: boolean,
    stepName?: string,
    hasCurrentUserApproved?: boolean
  ) => {
    switch (status) {
      case 'Draft':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-container-high text-on-surface-variant border border-outline-variant">Draft</span>;
      case 'Submitted':
      case 'In Review':
        if (hasCurrentUserApproved) {
          return (
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              In Review
            </span>
          );
        }
        return (
          <div className="inline-flex flex-col items-start gap-0.5">
            <span className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${isActionableForMe
              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50 animate-pulse font-bold ring-2 ring-amber-400/60 shadow-xs'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}>
              In Review
            </span>
            {stepName && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 leading-tight">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                {stepName}
              </span>
            )}
          </div>
        );
      case 'Pending Approval':
      case 'Pending':
        if (hasCurrentUserApproved) {
          return (
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              In Review
            </span>
          );
        }
        return (
          <div className="inline-flex flex-col items-start gap-0.5">
            <span className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${isActionableForMe
              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50 animate-pulse font-bold ring-2 ring-amber-400/60 shadow-xs'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}>
              Pending Approval
            </span>
            {stepName && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 leading-tight">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                {stepName}
              </span>
            )}
          </div>
        );
      case 'Approved':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Approved</span>;
      case 'Rejected':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-error-container text-error border border-error/20">Rejected</span>;
      case 'Rework':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">Rework Needed</span>;
      case 'Paid':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">Paid & Settled</span>;
      default:
        if (status?.toLowerCase().includes('pending')) {
          if (hasCurrentUserApproved) {
            return (
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                In Review
              </span>
            );
          }
          return (
            <div className="inline-flex flex-col items-start gap-0.5">
              <span className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${isActionableForMe
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50 animate-pulse font-bold ring-2 ring-amber-400/60 shadow-xs'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                }`}>
                {status}
              </span>
              {stepName && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 leading-tight">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  {stepName}
                </span>
              )}
            </div>
          );
        }
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-container text-on-surface">{status}</span>;
    }
  };

  // Helper date checker
  const isWithinDateRange = (targetDateStr: string, fromDateStr: string, toDateStr: string) => {
    if (!targetDateStr) return true;
    const target = new Date(targetDateStr).getTime();
    if (fromDateStr && target < new Date(fromDateStr).getTime()) return false;
    if (toDateStr && target > new Date(toDateStr + 'T23:59:59').getTime()) return false;
    return true;
  };

  // Filtered lists for main tables
  const filteredBundles = useMemo(() => {
    return bundles.filter((b) => {
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      if (ledgerFilter === 'IN_LEDGER' && !b.ledger_details) return false;
      if (ledgerFilter === 'NOT_IN_LEDGER' && b.ledger_details) return false;
      if (!isWithinDateRange(b.claim_date, filterDateFrom, filterDateTo)) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const workerName = (b.worker_detail?.full_name || b.worker_detail?.username || '').toLowerCase();
        const claimIdStr = b.claim_id.toString();
        const ticketStr = b.ticket_details?.work_order_no?.toLowerCase() || '';
        const remarksStr = (b.remarks || '').toLowerCase();
        const ledgerName = (b.ledger_details?.group_name || '').toLowerCase();
        return workerName.includes(query) || claimIdStr.includes(query) || ticketStr.includes(query) || remarksStr.includes(query) || ledgerName.includes(query);
      }
      return true;
    });
  }, [bundles, statusFilter, ledgerFilter, filterDateFrom, filterDateTo, searchQuery]);

  const filteredLedgers = useMemo(() => {
    return ledgers.filter((l) => {
      if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
      if (!isWithinDateRange(l.created_at, filterDateFrom, filterDateTo)) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const groupName = (l.ledger_group_detail?.group_name || '').toLowerCase();
        const idStr = l.ledger_id.toString();
        const userStr = (l.created_by_detail?.full_name || l.created_by_detail?.username || '').toLowerCase();
        return groupName.includes(query) || idStr.includes(query) || userStr.includes(query);
      }
      return true;
    });
  }, [ledgers, statusFilter, filterDateFrom, filterDateTo, searchQuery]);

  const roleFilteredApprovals = useMemo(() => {
    return approvals.filter((a) => {
      if (roleFilterOnly && currentUser) {
        const userRoleName = (
          (currentUser?.role as any)?.role_name ||
          (typeof currentUser?.role === 'string' ? currentUser.role : '') ||
          ''
        ).toLowerCase().trim();

        const isAdmin = !!(
          currentUser?.is_superuser ||
          (currentUser as any)?.is_staff ||
          userRoleName === 'administrator' ||
          userRoleName === 'admin'
        );
        if (isAdmin) return true;

        if (a.can_action) return true;

        const currentUsername = currentUser.username;
        const assignedUsers = a.workflow_steps?.flatMap(s => s.assigned_users_names || []) || [];
        if (currentUsername && assignedUsers.includes(currentUsername)) return true;

        const userRoleStr = (
          (currentUser?.role as any)?.role_name ||
          (typeof currentUser?.role === 'string' ? currentUser.role : '') ||
          ''
        ).toLowerCase().trim();

        const stepRoleStr = (a.assigned_role_name || '').toLowerCase().trim();
        if (userRoleStr && stepRoleStr && stepRoleStr === userRoleStr) {
          return true;
        }
        return false;
      }
      return true;
    });
  }, [approvals, roleFilterOnly, currentUser]);

  const displayedApprovals = useMemo(() => {
    return roleFilteredApprovals.filter((a) => {
      if (approvalEntityTab !== 'ALL') {
        const entityType = a.target_summary?.type || (a.claim ? 'Bundle' : (a.ledger ? 'Ledger' : 'Expense'));
        if (entityType !== approvalEntityTab) return false;
      }
      if (approvalStatusTab !== 'ALL') {
        if (a.status !== approvalStatusTab) return false;
      }
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (!isWithinDateRange(a.created_at, filterDateFrom, filterDateTo)) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const step = (a.step_name || '').toLowerCase();
        const role = (a.assigned_role_name || '').toLowerCase();
        const targetLabel = a.target_summary?.label?.toLowerCase() || '';
        const storeName = a.target_summary?.store_name?.toLowerCase() || '';
        const workerName = a.target_summary?.worker?.toLowerCase() || '';
        return step.includes(query) || role.includes(query) || targetLabel.includes(query) || storeName.includes(query) || workerName.includes(query);
      }
      return true;
    });
  }, [roleFilteredApprovals, approvalEntityTab, approvalStatusTab, statusFilter, filterDateFrom, filterDateTo, searchQuery]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (!isWithinDateRange(p.paid_at, filterDateFrom, filterDateTo)) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const method = (p.payment_method || '').toLowerCase();
        const ref = (p.transaction_reference || '').toLowerCase();
        const idStr = p.payment_id.toString();
        return method.includes(query) || ref.includes(query) || idStr.includes(query);
      }
      return true;
    });
  }, [payments, filterDateFrom, filterDateTo, searchQuery]);

  const filteredUnclaimedExpenses = useMemo(() => {
    const list = unclaimedExpenses.filter((exp) => {
      if (exp.is_claimed || exp.claim) return false;
      if (!isWithinDateRange(exp.expense_date, expenseFilterFrom, expenseFilterTo)) return false;

      // Filter by Technician / Employee selection
      if (expenseSearchWorker.trim()) {
        const query = expenseSearchWorker.toLowerCase();
        const workerObj = typeof exp.worker === 'object' && exp.worker ? exp.worker : (exp.worker_detail || (exp as any).added_by);
        const workerId = getUserId(exp.worker) ?? getUserId(exp.worker_detail) ?? getUserId((exp as any).added_by);
        const workerName = (workerObj?.full_name || workerObj?.username || `Worker ${workerId || ''}`).toLowerCase();
        if (!workerName.includes(query)) return false;
      }

      // Search by Expense Details (Ticket #, Expense Type/Name, Remarks, Store, Expense ID, Amount)
      if (expenseSearchText.trim()) {
        const query = expenseSearchText.toLowerCase();
        const ticketNo = exp.ticket_details?.work_order_no?.toLowerCase() || '';
        const ticketTitle = exp.ticket_details?.title?.toLowerCase() || '';
        const expIdStr = exp.expense_id.toString();
        const remarksStr = (exp.remarks || '').toLowerCase();
        const expTypeStr = (exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || '').toLowerCase();
        const storeStr = (exp.responsible_store?.store_name || '').toLowerCase();
        const amountStr = exp.amount ? exp.amount.toString() : '';

        const matches = ticketNo.includes(query) ||
          ticketTitle.includes(query) ||
          expIdStr.includes(query) ||
          remarksStr.includes(query) ||
          expTypeStr.includes(query) ||
          storeStr.includes(query) ||
          amountStr.includes(query);
        if (!matches) return false;
      }

      return true;
    });

    // Sort: Approved expenses first (top), unapproved expenses at the bottom
    return list.sort((a, b) => {
      const aApproved = a.approved === true || ((a.expense_type as any)?.approve_required === false);
      const bApproved = b.approved === true || ((b.expense_type as any)?.approve_required === false);

      if (aApproved && !bApproved) return -1;
      if (!aApproved && bApproved) return 1;

      // Secondary sort: by expense date descending, then expense ID descending
      const dateA = new Date(a.expense_date || 0).getTime();
      const dateB = new Date(b.expense_date || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return b.expense_id - a.expense_id;
    });
  }, [unclaimedExpenses, expenseSearchWorker, expenseSearchText, expenseFilterFrom, expenseFilterTo]);

  const selectedExpensesTotal = useMemo(() => {
    return unclaimedExpenses
      .filter((exp) => selectedExpenseIds.includes(exp.expense_id))
      .reduce((sum, exp) => sum + parseFloat(exp.amount || '0'), 0);
  }, [unclaimedExpenses, selectedExpenseIds]);

  const uniqueExpenseWorkers = useMemo(() => {
    const map = new Map<number, { id: number; name: string; username: string; employee_no?: string; department_name?: string; unclaimed_count: number; unclaimed_total: number }>();
    unclaimedExpenses.forEach((exp) => {
      if (exp.is_claimed || exp.claim) return;
      if (!isWithinDateRange(exp.expense_date, expenseFilterFrom, expenseFilterTo)) return;
      const workerId = getUserId(exp.worker) ?? getUserId(exp.worker_detail) ?? getUserId((exp as any).added_by);
      if (workerId !== null) {
        const workerObj = typeof exp.worker === 'object' && exp.worker ? exp.worker : (exp.worker_detail || (exp as any).added_by);
        const displayName = workerObj?.full_name || workerObj?.username || `Worker ${workerId}`;
        const deptName = (exp.ticket_details as any)?.department_name || (exp.expense_type_detail as any)?.department_name || (exp.expense_type as any)?.department?.department_name || 'General Maintenance';
        const amt = parseFloat(exp.amount || '0');
        const existing = map.get(workerId);
        if (existing) {
          existing.unclaimed_count += 1;
          existing.unclaimed_total += amt;
          if (!existing.department_name && deptName) {
            existing.department_name = deptName;
          }
        } else {
          map.set(workerId, {
            id: workerId,
            name: displayName,
            username: workerObj?.username || '',
            employee_no: workerObj?.employee_no || '',
            department_name: deptName,
            unclaimed_count: 1,
            unclaimed_total: amt
          });
        }
      }
    });
    return Array.from(map.values());
  }, [unclaimedExpenses, expenseFilterFrom, expenseFilterTo]);

  // Actions
  const handleCreateBundle = async () => {
    if (selectedExpenseIds.length === 0) {
      setErrorMessage('Please select at least one expense to create a bundle.');
      return;
    }
    if (!bundleRemarks || !bundleRemarks.trim()) {
      setErrorMessage('Bundle Remarks are required.');
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);

    const firstSelected = unclaimedExpenses.find(e => selectedExpenseIds.includes(e.expense_id));
    const firstWorkerObj = firstSelected ? (typeof firstSelected.worker === 'object' ? firstSelected.worker : firstSelected.worker_detail) : null;
    const targetWorkerId = firstWorkerObj ? firstWorkerObj.id : undefined;

    try {
      const res = await fetch(`${API_URL}/finance/claim/create-bundle/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          worker_id: targetWorkerId,
          expense_ids: selectedExpenseIds,
          period_from: bundlePeriodFrom || undefined,
          period_to: bundlePeriodTo || undefined,
          remarks: bundleRemarks || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.detail || (typeof data === 'object' ? Object.values(data).flat().join(' ') : 'Failed to create claim bundle');
        throw new Error(errorMsg);
      }
      setSuccessMessage(`Bundle #${data.claim_id} created successfully.`);
      setShowCreateBundleModal(false);
      setSelectedExpenseIds([]);
      setBundleRemarks('');
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBundle = async (claimId: number) => {
    const bundleToSubmit = (bundles || []).find(c => c.claim_id === claimId);
    if (bundleToSubmit && (!bundleToSubmit.expenses || bundleToSubmit.expenses.length === 0)) {
      setErrorMessage(`Cannot submit Bundle #${claimId}: No expenses attached to this bundle.`);
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_URL}/finance/claim/${claimId}/submit/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Submission failed');
      setSuccessMessage(`Bundle ${claimId} submitted into multi-step approval workflow.`);
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLedger = async () => {
    if (selectedBundleIds.length === 0) {
      setErrorMessage('Select at least one approved bundle.');
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    try {
      let gId = selectedGroupId ? parseInt(selectedGroupId, 10) : undefined;
      if (!gId && newGroupName.trim()) {
        const resG = await fetch(`${API_URL}/finance/ledger-groups/`, {
          method: 'POST',
          headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_name: newGroupName.trim() })
        });
        const groupData = await resG.json();
        gId = groupData.ledger_group_id;
      }

      const res = await fetch(`${API_URL}/finance/ledgers/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundle_ids: selectedBundleIds,
          ledger_group: gId,
          remarks: ledgerRemarks || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
      setSuccessMessage(`Ledger ${data.ledger_id} assembled successfully.`);
      setShowCreateLedgerModal(false);
      setSelectedBundleIds([]);
      setNewGroupName('');
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitLedger = async (ledgerId: number) => {
    const targetLedger = (ledgers || []).find(l => l.ledger_id === ledgerId);
    const bundleCount = (targetLedger?.bundles?.length || 0) + (targetLedger?.expenses?.length || 0);
    if (targetLedger && bundleCount === 0) {
      setErrorMessage(`Cannot submit Ledger Batch #${ledgerId}: Must have at least one claim bundle attached.`);
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_URL}/finance/ledgers/${ledgerId}/submit/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Submission failed');
      setSuccessMessage(`Ledger ${ledgerId} submitted for approval.`);
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleActionApproval = async (
    customAction?: 'APPROVED' | 'REJECTED' | 'REWORK',
    customComments?: string,
    customApp?: ApprovalInstanceItem,
    customLedgerGroupId?: number | string | null,
    customNewGroupName?: string
  ) => {
    const targetApp = customApp || showApprovalModal;
    if (!targetApp) return;
    const actionToPerform = customAction || approvalAction;
    const commentsToSend = customComments !== undefined ? customComments : approvalComments;

    if (actionToPerform === 'REWORK' && !commentsToSend?.trim()) {
      setErrorMessage('A reason or comment is required when requesting rework.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const isDirectExp = (targetApp as any).is_direct_expense;
      const expId = targetApp.expense || targetApp.expense_id || targetApp.instance_id;
      let res: Response;

      const bodyPayload: any = { action: actionToPerform, comments: commentsToSend };
      if (customLedgerGroupId) {
        bodyPayload.ledger_group_id = Number(customLedgerGroupId);
      }
      if (customNewGroupName && customNewGroupName.trim()) {
        bodyPayload.new_group_name = customNewGroupName.trim();
      }

      if (isDirectExp && expId) {
        res = await fetch(`${API_URL}/finance/expense/${expId}/action/`, {
          method: 'POST',
          headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload)
        });
      } else {
        res = await fetch(`${API_URL}/finance/approvals/${targetApp.instance_id}/action/`, {
          method: 'POST',
          headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload)
        });

        if (!res.ok && expId) {
          res = await fetch(`${API_URL}/finance/expense/${expId}/action/`, {
            method: 'POST',
            headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload)
          });
        }
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Approval action failed');
      setSuccessMessage(`Approval step actioned: ${actionToPerform}`);
      setShowApprovalModal(null);
      setApprovalComments('');

      // In-Memory Optimistic Frontend Update (No full table loading spinner)
      const updatedInstance = data.instance || (typeof data === 'object' && data.instance_id ? data : null);
      const updatedLedgerObj = data.ledger || (updatedInstance && updatedInstance.ledger_details) || null;

      // 1. Update Approvals state
      setApprovals(prev => prev.map(a => {
        if (a.instance_id === targetApp.instance_id) {
          if (updatedInstance && typeof updatedInstance === 'object') {
            return { ...a, ...updatedInstance };
          }
          return {
            ...a,
            status: actionToPerform === 'APPROVED' ? (data.all_completed ? 'Approved' : a.status) : actionToPerform === 'REWORK' ? 'Rework' : 'Rejected'
          };
        }
        return a;
      }));

      // 2. Update Ledgers state directly in memory
      const targetLedgerId = targetApp.ledger || targetApp.ledger_id || (targetApp.target_summary?.type === 'Ledger' ? targetApp.target_summary?.id : undefined) || (updatedLedgerObj && updatedLedgerObj.ledger_id);
      if (targetLedgerId) {
        setLedgers(prev => prev.map(l => {
          if (l.ledger_id === targetLedgerId) {
            if (updatedLedgerObj && typeof updatedLedgerObj === 'object') {
              return { ...l, ...updatedLedgerObj };
            }
            const nextStatus = actionToPerform === 'REWORK'
              ? 'Rework'
              : actionToPerform === 'REJECTED'
                ? 'Rejected'
                : data.all_completed || data.status === 'Approved'
                  ? 'Approved'
                  : l.status;
            return {
              ...l,
              status: nextStatus
            };
          }
          return l;
        }));
      }

      // 3. Update Expenses state directly if applicable
      if (expId) {
        setExpenses(prev => prev.map(e => {
          if (e.expense_id === expId) {
            if (data.expense && typeof data.expense === 'object') {
              return { ...e, ...data.expense };
            }
            const nextApproved = actionToPerform === 'APPROVED' && data.all_completed;
            const nextStatus = actionToPerform === 'REWORK'
              ? 'Rework'
              : actionToPerform === 'REJECTED'
                ? 'Rejected'
                : data.all_completed
                  ? 'Approved'
                  : (e.status_display || (e.approved ? 'Approved' : 'Pending Approval'));
            return { ...e, approved: !!nextApproved, status_display: nextStatus };
          }
          return e;
        }));
      }

      // 4. Silent background sync without table spinner
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!showPaymentModal) return;
    setSubmitting(true);
    setErrorMessage(null);

    const isClaim = 'claim_id' in showPaymentModal;
    const claimId = isClaim ? (showPaymentModal as WorkerClaimItem).claim_id : undefined;
    const ledgerId = !isClaim ? (showPaymentModal as LedgerItem).ledger_id : undefined;

    try {
      const res = await fetch(`${API_URL}/finance/payments/process-payment/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundle_id: claimId,
          ledger_id: ledgerId,
          payment_method: paymentMethod,
          amount_paid: paymentAmount || ('total_claimed_amount' in showPaymentModal ? showPaymentModal.total_claimed_amount : 'total_amount' in showPaymentModal ? showPaymentModal.total_amount : showPaymentModal.amount_paid),
          transaction_reference: paymentRef || undefined,
          remarks: paymentRemarks || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
      setSuccessMessage(`Payment ${data.payment_id} recorded successfully.`);
      setShowPaymentModal(null);
      setPaymentRef('');
      setPaymentRemarks('');
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateExpense = async (payload: any) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      // 1. Separate JSON fields from File attachments
      const { files, media_rotations, ...expenseBody } = payload;

      const res = await fetch(`${API_URL}/finance/expense/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(expenseBody)
      });
      const data = await res.json();
      if (!res.ok) {
        let msg = 'Failed to create expense entry';
        if (data && typeof data === 'object') {
          if (data.detail) {
            msg = data.detail;
          } else {
            const errEntries = Object.entries(data).map(([field, errs]) => {
              const formattedField = field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const errStr = Array.isArray(errs) ? errs.join(', ') : String(errs);
              return `${formattedField}: ${errStr}`;
            });
            if (errEntries.length > 0) msg = errEntries.join(' • ');
          }
        }
        throw new Error(msg);
      }

      // 2. Upload attached receipt files to /common/media/ linked to the new expense
      if (files && Array.isArray(files) && files.length > 0) {
        const createdExpenseId = data.expense_id;
        const uploadPromises = files.map(async (file: File) => {
          const mediaFormData = new FormData();
          if (expenseBody.ticket) mediaFormData.append('ticket', String(expenseBody.ticket));
          mediaFormData.append('file_url', file);
          mediaFormData.append('file_name', file.name);
          const workerId = expenseBody.worker || currentUser?.user_id || (currentUser as any)?.id;
          if (workerId) {
            mediaFormData.append('uploaded_by', String(workerId));
          }
          mediaFormData.append('expense', String(createdExpenseId));

          const rotObj = (media_rotations || []).find((r: any) => r.file_name === file.name);
          if (rotObj && rotObj.rotation) {
            mediaFormData.append('rotation', String(rotObj.rotation));
          }

          const mRes = await fetch(`${API_URL}/common/media/`, {
            method: 'POST',
            headers: { 'Authorization': `Token ${token}` },
            body: mediaFormData
          });
          if (!mRes.ok) {
            console.error('Failed to upload receipt file for expense:', file.name);
          }
        });

        await Promise.all(uploadPromises);
      }

      setSuccessMessage(`Expense ${data.expense_id} created successfully.`);
      fetchData(true);
    } catch (err: any) {
      setErrorMessage(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (filterDateFrom && e.expense_date && e.expense_date < filterDateFrom) return false;
      if (filterDateTo && e.expense_date && e.expense_date > filterDateTo) return false;

      if (statusFilter !== 'ALL') {
        const st = e.status_display || (e.approved ? 'Approved' : 'Pending Approval');
        if (st.toLowerCase() !== statusFilter.toLowerCase()) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const catName = (e.expense_type_detail?.expense_name || (e.expense_type as any)?.expense_name || '').toLowerCase();
        const workerObj = e.worker_detail || (typeof e.worker === 'object' ? e.worker : null);
        const workerName = (workerObj?.full_name || workerObj?.username || '').toLowerCase();
        const remarks = (e.remarks || '').toLowerCase();
        const amountStr = String(e.amount || '');
        const expIdStr = String(e.expense_id || '');

        const rawTicket: any = e.ticket_details || e.ticket;
        const ticketWo = typeof rawTicket === 'object' && rawTicket ? (rawTicket.work_order_no || '').toLowerCase() : '';
        const ticketTitle = typeof rawTicket === 'object' && rawTicket ? (rawTicket.title || '').toLowerCase() : '';
        const ticketIdStr = typeof rawTicket === 'object' && rawTicket ? String(rawTicket.ticket_id || rawTicket.id || '') : (rawTicket ? String(rawTicket) : '');
        const storeName = (e.responsible_store?.store_name || (typeof rawTicket === 'object' ? rawTicket?.store?.store_name || rawTicket?.store_name : '') || '').toLowerCase();

        return catName.includes(q) ||
          workerName.includes(q) ||
          remarks.includes(q) ||
          amountStr.includes(q) ||
          expIdStr.includes(q) ||
          ticketWo.includes(q) ||
          ticketTitle.includes(q) ||
          ticketIdStr.includes(q) ||
          storeName.includes(q);
      }

      return true;
    });
  }, [expenses, filterDateFrom, filterDateTo, statusFilter, searchQuery]);

  // Subpage Navigation Tabs
  const navTabs = [
    { key: 'expenses', label: 'Expenses', icon: Receipt },
    { key: 'bundles', label: 'Bundles', icon: Layers },
    { key: 'ledgers', label: 'Ledgers', icon: Building2 },
    { key: 'payments', label: 'Disbursements & Audit', icon: CreditCard }
  ];

  const approvalsProps = {
    approvals,
    roleFilteredApprovals,
    displayedApprovals,
    loading,
    submitting,
    roleFilterOnly,
    setRoleFilterOnly,
    currentUser,
    approvalEntityTab,
    setApprovalEntityTab,
    approvalStatusTab,
    setApprovalStatusTab,
    expandedApprovalIds,
    toggleExpandApproval,
    renderStatusBadge,
    showApprovalModal,
    setShowApprovalModal,
    approvalAction,
    setApprovalAction,
    approvalComments,
    setApprovalComments,
    handleActionApproval,
    setSelectedTicketForModal,
    setPreviewMediaUrl
  };

  return (
    <div className=" min-h-screen flex flex-col gap-2 bg-surface dark:bg-dark-surface text-on-surface dark:text-dark-on-surface">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-on-surface dark:text-dark-on-surface flex items-center gap-2">
            Financial Management & Workflow
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData(false)}
            disabled={loading}
            className="border border-outline bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium px-3 py-2 rounded flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {subpage === 'expenses' && (
            <button
              onClick={() => setShowCreateExpenseModal(true)}
              className="bg-primary hover:bg-primary-container text-on-primary text-xs font-medium px-3 py-2 rounded flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Expense</span>
            </button>
          )}

          {subpage === 'bundles' && (
            <Can permission={["finance.create_bundle", "finance.create_workerclaim", "finance.add_workerclaim"] as any}>
              <button
                onClick={() => setShowCreateBundleModal(true)}
                className="bg-primary hover:bg-primary-container text-on-primary text-xs font-medium px-3 py-2 rounded flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Bundle</span>
              </button>
            </Can>
          )}

          {subpage === 'ledgers' && (
            <button
              onClick={() => setShowCreateLedgerModal(true)}
              className="bg-primary hover:bg-primary-container text-on-primary text-xs font-medium px-3 py-2 rounded flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Assemble Ledger</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Floating Popup Toast (visible above all modals & full viewport) */}
      {(errorMessage || successMessage) && (
        <div className="fixed top-5 right-5 z-[9999] max-w-md w-full animate-in slide-in-from-top-3 fade-in duration-200 pointer-events-auto">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-600 text-white text-xs flex items-start justify-between shadow-2xl border border-red-700 gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-white" />
                <div className="min-w-0">
                  <strong className="block font-bold text-white mb-0.5">Error</strong>
                  <span className="text-white/95 break-words leading-relaxed">{errorMessage}</span>
                </div>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white shrink-0 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-600 text-white text-xs flex items-start justify-between shadow-2xl border border-emerald-700 gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-white" />
                <div className="min-w-0">
                  <strong className="block font-bold text-white mb-0.5">Success</strong>
                  <span className="text-white/95 break-words leading-relaxed">{successMessage}</span>
                </div>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white shrink-0 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Inline Notifications */}
      {errorMessage && (
        <div className="p-3.5 rounded bg-error-container text-on-error-container text-xs flex items-center justify-between border border-error/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-error" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:opacity-75"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between border border-emerald-500/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:opacity-75"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Navigation Subpage Tabs */}
      <div className="flex items-center gap-1  border-outline-variant overflow-x-auto pb-0.5">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = subpage === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => navigate(`/finance/${tab.key}`)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${isActive
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SEARCH AND DATEWISE FILTER TOOLBAR */}
      <div className="p-3.5 rounded border border-outline-variant bg-surface-container flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search by worker name, ID, ticket , amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-low border border-outline text-on-surface text-xs rounded pl-8 pr-3 py-1.5 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Popover Date Range Picker */}
          <DateRangePickerCard
            fromDate={filterDateFrom}
            toDate={filterDateTo}
            onDateRangeChange={(from, to) => {
              setFilterDateFrom(from);
              setFilterDateTo(to);
            }}
            onReset={() => {
              const currentMonth = getCurrentMonthRange();
              setFilterDateFrom(currentMonth.from);
              setFilterDateTo(currentMonth.to);
            }}
          />

          {/* Status Dropdown Filter */}
          {subpage !== 'payments' && (
            <div className="w-44 shrink-0">
              <SearchableSelect
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'Draft', label: 'Draft' },
                  { value: 'In Review', label: 'In Review' },
                  { value: 'Approved', label: 'Approved' },
                  { value: 'Rejected', label: 'Rejected' },
                  { value: 'Rework', label: 'Rework' },
                  { value: 'Paid', label: 'Paid' },
                ]}
                placeholder="All Statuses"
                />
            </div>
          )}

          {/* Ledger Attachment Filter (Applicable for Bundles subpage) */}
          {subpage === 'bundles' && (
            <div className="w-60 shrink-0">
              <SearchableSelect
                value={ledgerFilter}
                onChange={(val) => setLedgerFilter(val as any)}
                options={[
                  { value: 'ALL', label: 'All Bundles (With & Without Ledger)' },
                  { value: 'IN_LEDGER', label: 'Attached to Ledger Batch' },
                  { value: 'NOT_IN_LEDGER', label: 'Not in Ledger Batch' },
                ]}
                placeholder="Ledger Filter"
              />
            </div>
          )}
        </div>

        {/* Clear Filters Button */}
        {(searchQuery || statusFilter !== 'ALL' || ledgerFilter !== 'ALL' || filterDateFrom !== getCurrentMonthRange().from || filterDateTo !== getCurrentMonthRange().to) && (
          <button
            onClick={() => {
              const currentMonth = getCurrentMonthRange();
              setSearchQuery('');
              setFilterDateFrom(currentMonth.from);
              setFilterDateTo(currentMonth.to);
              setStatusFilter('ALL');
              setLedgerFilter('ALL');
            }}
            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded border border-outline text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* SUBPAGES */}
      {subpage === 'expenses' && (
        <ExpensesSubpage
          expenses={expenses}
          filteredExpenses={filteredExpenses}
          loading={loading}
          submitting={submitting}
          renderStatusBadge={renderStatusBadge}
          showCreateExpenseModal={showCreateExpenseModal}
          setShowCreateExpenseModal={setShowCreateExpenseModal}
          handleCreateExpense={handleCreateExpense}
          setSelectedTicketForModal={setSelectedTicketForModal}
          setPreviewMediaUrl={setPreviewMediaUrl}
          token={token || ''}
          currentUser={currentUser}
          API_URL={API_URL}
          approvalsProps={approvalsProps}
          onRefresh={() => fetchData(true)}
        />
      )}

      {subpage === 'bundles' && (
        <BundlesSubpage
          filteredBundles={filteredBundles}
          bundles={bundles}
          unclaimedExpenses={unclaimedExpenses}
          loading={loading}
          submitting={submitting}
          renderStatusBadge={renderStatusBadge}
          showCreateBundleModal={showCreateBundleModal}
          setShowCreateBundleModal={setShowCreateBundleModal}
          expenseSearchWorker={expenseSearchWorker}
          setExpenseSearchWorker={setExpenseSearchWorker}
          expenseSearchText={expenseSearchText}
          setExpenseSearchText={setExpenseSearchText}
          expenseFilterFrom={expenseFilterFrom}
          setExpenseFilterFrom={setExpenseFilterFrom}
          expenseFilterTo={expenseFilterTo}
          setExpenseFilterTo={setExpenseFilterTo}
          uniqueExpenseWorkers={uniqueExpenseWorkers}
          filteredUnclaimedExpenses={filteredUnclaimedExpenses}
          selectedExpenseIds={selectedExpenseIds}
          setSelectedExpenseIds={setSelectedExpenseIds}
          selectedExpensesTotal={selectedExpensesTotal}
          bundlePeriodFrom={bundlePeriodFrom}
          setBundlePeriodFrom={setBundlePeriodFrom}
          bundlePeriodTo={bundlePeriodTo}
          setBundlePeriodTo={setBundlePeriodTo}
          bundleRemarks={bundleRemarks}
          setBundleRemarks={setBundleRemarks}
          handleCreateBundle={handleCreateBundle}
          handleSubmitBundle={handleSubmitBundle}
          selectedBundleForView={selectedBundleForView}
          setSelectedBundleForView={setSelectedBundleForView}
          selectedBundleForEdit={selectedBundleForEdit}
          setSelectedBundleForEdit={setSelectedBundleForEdit}
          editBundleForm={editBundleForm}
          setEditBundleForm={setEditBundleForm}
          openEditBundleModal={openEditBundleModal}
          handleSaveUpdateBundle={handleSaveUpdateBundle}
          handleRemoveExpenseFromBundle={handleRemoveExpenseFromBundle}
          handleDeleteBundle={handleDeleteBundle}
          previewMediaUrl={previewMediaUrl}
          setPreviewMediaUrl={setPreviewMediaUrl}
          setShowPaymentModal={setShowPaymentModal}
          approvalsProps={approvalsProps}
          token={token || ''}
          currentUser={currentUser}
          API_URL={API_URL}
          errorMessage={errorMessage}
          setErrorMessage={setErrorMessage}
          setSelectedTicketForModal={setSelectedTicketForModal}
          onRefresh={() => fetchData(true)}
        />
      )}

      {subpage === 'ledgers' && (
        <LedgersSubpage
          filteredLedgers={filteredLedgers}
          ledgers={ledgers}
          bundles={bundles}
          ledgerGroups={ledgerGroups}
          loading={loading}
          submitting={submitting}
          renderStatusBadge={renderStatusBadge}
          showCreateLedgerModal={showCreateLedgerModal}
          setShowCreateLedgerModal={setShowCreateLedgerModal}
          selectedBundleIds={selectedBundleIds}
          setSelectedBundleIds={setSelectedBundleIds}
          selectedGroupId={selectedGroupId}
          setSelectedGroupId={setSelectedGroupId}
          newGroupName={newGroupName}
          setNewGroupName={setNewGroupName}
          handleCreateLedger={handleCreateLedger}
          handleSubmitLedger={handleSubmitLedger}
          handleDeleteLedger={handleDeleteLedger}
          expandedLedgerIds={expandedLedgerIds}
          toggleExpandLedger={toggleExpandLedger}
          openEditBundleModal={openEditBundleModal}
          showAddExpenseModal={showAddExpenseModal}
          setShowAddExpenseModal={setShowAddExpenseModal}
          openAddExpenseModal={openAddExpenseModal}
          loadingAvailableExpenses={loadingAvailableExpenses}
          availableApprovedExpenses={availableApprovedExpenses}
          selectedAddExpenseId={selectedAddExpenseId}
          setSelectedAddExpenseId={setSelectedAddExpenseId}
          handleAddExpenseToLedger={handleAddExpenseToLedger}
          handleRemoveExpenseFromLedger={handleRemoveExpenseFromLedger}
          handleAddBundleToLedger={handleAddBundleToLedger}
          handleAddBundleToGroup={handleAddBundleToGroup}
          handleRemoveBundleFromLedger={handleRemoveBundleFromLedger}
          handleRemoveBundleFromGroup={handleRemoveBundleFromGroup}
          handleDeleteLedgerGroup={handleDeleteLedgerGroup}
          token={token || ''}
          API_URL={API_URL}
          setShowPaymentModal={setShowPaymentModal}
          approvalsProps={approvalsProps}
          setSelectedTicketForModal={setSelectedTicketForModal}
          onRefresh={() => fetchData(true)}
          onLedgerUpdated={(updatedLedger) => {
            setLedgers(prev => prev.map(l => l.ledger_id === updatedLedger.ledger_id ? updatedLedger : l));
            if (updatedLedger.ledger_group_detail) {
              setLedgerGroups(prev => prev.map(g => g.ledger_group_id === updatedLedger.ledger_group_detail?.ledger_group_id ? { ...g, ...updatedLedger.ledger_group_detail } : g));
            }
          }}
          onLedgersUpdated={(updatedList) => {
            const updateMap = new Map(updatedList.map(l => [l.ledger_id, l]));
            setLedgers(prev => prev.map(l => updateMap.get(l.ledger_id) || l));
            updatedList.forEach(l => {
              if (l.ledger_group_detail) {
                setLedgerGroups(prev => prev.map(g => g.ledger_group_id === l.ledger_group_detail?.ledger_group_id ? { ...g, ...l.ledger_group_detail } : g));
              }
            });
            // Instantly sync Approvals state in memory so status badges update with zero delay
            setApprovals(prev => prev.map(a => {
              const matchedLedger = updatedList.find(l => {
                const aLedgerId = a.ledger ?? a.ledger_id ?? (a.target_summary?.type === 'Ledger' ? a.target_summary?.id : undefined);
                return aLedgerId === l.ledger_id;
              });
              if (matchedLedger) {
                if (matchedLedger.status === 'Approved' || matchedLedger.status === 'Paid') {
                  return { ...a, status: 'Approved' };
                } else if (matchedLedger.status === 'Rework') {
                  return { ...a, status: 'Rework' };
                } else if (matchedLedger.status === 'Rejected') {
                  return { ...a, status: 'Rejected' };
                }
              }
              return a;
            }));
          }}
        />
      )}

      {subpage === 'payments' && (
        <PaymentsSubpage
          filteredPayments={filteredPayments}
          payments={payments}
          auditEvents={auditEvents}
          showPaymentModal={showPaymentModal}
          setShowPaymentModal={setShowPaymentModal}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          paymentAmount={paymentAmount}
          setPaymentAmount={setPaymentAmount}
          paymentRef={paymentRef}
          setPaymentRef={setPaymentRef}
          paymentRemarks={paymentRemarks}
          setPaymentRemarks={setPaymentRemarks}
          handleProcessPayment={handleProcessPayment}
          submitting={submitting}
        />
      )}

      {/* POPUP MODAL: EDIT BUNDLE & MANAGE TIED EXPENSES */}
      <EditBundleModal
        selectedBundleForEdit={selectedBundleForEdit}
        setSelectedBundleForEdit={setSelectedBundleForEdit}
        editBundleForm={editBundleForm}
        setEditBundleForm={setEditBundleForm}
        unclaimedExpenses={unclaimedExpenses}
        submitting={submitting}
        handleSaveUpdateBundle={handleSaveUpdateBundle}
        errorMessage={errorMessage}
        setErrorMessage={setErrorMessage}
      />

      {/* POPUP MODAL: TICKET DETAIL MODAL */}
      {selectedTicketForModal && (
        <TicketDetailModal
          selectedTicket={selectedTicketForModal}
          token={token}
          user={currentUser}
          statuses={[]}
          workers={[]}
          subDepartments={[]}
          expenseTypes={[]}
          readOnly={true}
          onClose={() => setSelectedTicketForModal(null)}
          onRefreshList={() => fetchData(true)}
        />
      )}

      {/* POPUP MODAL: RECEIPT LIGHTBOX */}
      {previewMediaUrl && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewMediaUrl(null)}>
          <div className="relative max-w-4xl max-h-[90vh] bg-surface-container rounded border border-outline-variant overflow-hidden p-2" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-2 border-b border-outline-variant mb-2">
              <span className="text-xs font-semibold text-on-surface">{previewMediaUrl.title}</span>
              <button onClick={() => setPreviewMediaUrl(null)} className="p-1 text-on-surface-variant hover:text-on-surface cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            {previewMediaUrl.url.toLowerCase().endsWith('.pdf') || previewMediaUrl.url.includes('/pdf') ? (
              <iframe
                src={previewMediaUrl.url.startsWith('http') ? previewMediaUrl.url : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${previewMediaUrl.url}`}
                title={previewMediaUrl.title}
                className="w-[80vw] h-[75vh] border-0 rounded"
              />
            ) : (
              <img
                src={previewMediaUrl.url.startsWith('http') ? previewMediaUrl.url : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${previewMediaUrl.url}`}
                alt={previewMediaUrl.title}
                className="max-h-[75vh] w-auto mx-auto object-contain rounded"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceView;
