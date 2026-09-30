import React, { useState, useEffect, useMemo } from 'react';
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

  // Global Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'IN_LEDGER' | 'NOT_IN_LEDGER'>('ALL');

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

  const parseList = (data: any) => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
  };

  // Fetch API data (with silent background mode)
  const fetchData = async (isSilent = false) => {
    if (!token) return;
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
          fetch(`${API_URL}/finance/expense/?page_size=all`, { headers }),
          fetch(approvalsUrl, { headers })
        ]);
        if (resExp.ok) setExpenses(parseList(await resExp.json()));
        if (resApp.ok) setApprovals(parseList(await resApp.json()));
      } else if (subpage === 'bundles') {
        const [resClaims, resExp, resApp] = await Promise.all([
          fetch(`${API_URL}/finance/claim/?page_size=all`, { headers }),
          fetch(`${API_URL}/finance/expense/?is_claimed=false&page_size=all`, { headers }),
          fetch(approvalsUrl, { headers })
        ]);
        if (resClaims.ok) setBundles(parseList(await resClaims.json()));
        if (resExp.ok) setUnclaimedExpenses(parseList(await resExp.json()));
        if (resApp.ok) setApprovals(parseList(await resApp.json()));
      } else if (subpage === 'ledgers') {
        const [resL, resG, resApprovedBundles, resExp, resApp] = await Promise.all([
          fetch(`${API_URL}/finance/ledgers/?page_size=all`, { headers }),
          fetch(`${API_URL}/finance/ledger-groups/?page_size=all`, { headers }),
          fetch(`${API_URL}/finance/claim/?status=Approved&page_size=all`, { headers }),
          fetch(`${API_URL}/finance/expense/?is_claimed=false&approved=true&page_size=all`, { headers }),
          fetch(approvalsUrl, { headers })
        ]);
        if (resL.ok) setLedgers(parseList(await resL.json()));
        if (resG.ok) setLedgerGroups(parseList(await resG.json()));
        if (resApprovedBundles.ok) setBundles(parseList(await resApprovedBundles.json()));
        if (resExp.ok) setUnclaimedExpenses(parseList(await resExp.json()));
        if (resApp.ok) setApprovals(parseList(await resApp.json()));
      } else if (subpage === 'approvals') {
        const res = await fetch(approvalsUrl, { headers });
        if (res.ok) setApprovals(parseList(await res.json()));
      } else if (subpage === 'payments') {
        const [resPay, resAudit] = await Promise.all([
          fetch(`${API_URL}/finance/payments/?page_size=all`, { headers }),
          fetch(`${API_URL}/finance/audit-events/?page_size=all`, { headers })
        ]);
        if (resPay.ok) setPayments(parseList(await resPay.json()));
        if (resAudit.ok) setAuditEvents(parseList(await resAudit.json()));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect to backend server.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(false);
  }, [subpage, token, roleFilterOnly]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Status Badge Renderer
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Draft':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-container-high text-on-surface-variant border border-outline-variant">Draft</span>;
      case 'Submitted':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">Submitted</span>;
      case 'In Review':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">In Review</span>;
      case 'Approved':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Approved</span>;
      case 'Rejected':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-error-container text-error border border-error/20">Rejected</span>;
      case 'Rework':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">Rework Needed</span>;
      case 'Paid':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">Paid & Settled</span>;
      default:
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
        const userRoleStr = (
          (currentUser?.role as any)?.role_name ||
          (typeof currentUser?.role === 'string' ? currentUser.role : '') ||
          ''
        ).toLowerCase().trim();

        const stepRoleStr = (a.assigned_role_name || '').toLowerCase().trim();
        if (!userRoleStr || stepRoleStr !== userRoleStr) {
          return false;
        }
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
        const step = a.step_name.toLowerCase();
        const role = a.assigned_role_name.toLowerCase();
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
        const method = p.payment_method.toLowerCase();
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
      if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
      setSuccessMessage(`Bundle ${data.claim_id} created successfully.`);
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

  const handleActionApproval = async () => {
    if (!showApprovalModal) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_URL}/finance/approvals/${showApprovalModal.instance_id}/action/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: approvalAction, comments: approvalComments })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Approval action failed');
      setSuccessMessage(`Approval step actioned: ${approvalAction}`);
      setShowApprovalModal(null);
      setApprovalComments('');
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
    <div className="p-6 min-h-screen flex flex-col gap-6 bg-surface dark:bg-dark-surface text-on-surface dark:text-dark-on-surface">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-on-surface dark:text-dark-on-surface flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Financial Management & Workflow System
          </h1>
          <p className="text-xs text-on-surface-variant dark:text-dark-on-surface-variant mt-0.5">
            Expense bundling, multi-step approval workflows, ledger grouping, payments, and immutable audit logs.
          </p>
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
            <button
              onClick={() => setShowCreateBundleModal(true)}
              className="bg-primary hover:bg-primary-container text-on-primary text-xs font-medium px-3 py-2 rounded flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Bundle</span>
            </button>
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

      {/* Notifications */}
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
      <div className="flex items-center gap-1 border-b border-outline-variant overflow-x-auto pb-0.5">
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
              setFilterDateFrom('');
              setFilterDateTo('');
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
                  { value: 'Submitted', label: 'Submitted' },
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
        {(searchQuery || filterDateFrom || filterDateTo || statusFilter !== 'ALL' || ledgerFilter !== 'ALL') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterDateFrom('');
              setFilterDateTo('');
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
          handleDeleteBundle={handleDeleteBundle}
          previewMediaUrl={previewMediaUrl}
          setPreviewMediaUrl={setPreviewMediaUrl}
          setShowPaymentModal={setShowPaymentModal}
          approvalsProps={approvalsProps}
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
          handleRemoveBundleFromLedger={handleRemoveBundleFromLedger}
          token={token || ''}
          API_URL={API_URL}
          setShowPaymentModal={setShowPaymentModal}
          approvalsProps={approvalsProps}
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
