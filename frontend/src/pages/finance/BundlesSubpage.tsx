import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt, PlusCircle, FileText, Trash2, Search, X, Check, Paperclip, ExternalLink, Loader2, Eye, Maximize2, ShieldCheck, Layers
} from 'lucide-react';
import type { WorkerClaimItem, ExpenseItem, MediaFileItem } from './types';
import { getUserId } from './types';
import { Pagination } from './Pagination';
import { DateRangePickerCard } from '../ticket/DateRangePickerCard';
import { EditBundleModal } from './EditBundleModal';
import { ApprovalsSubpage, type ApprovalsSubpageProps } from './ApprovalsSubpage';

interface BundlesSubpageProps {
  filteredBundles: WorkerClaimItem[];
  bundles: WorkerClaimItem[];
  unclaimedExpenses: ExpenseItem[];
  loading: boolean;
  submitting: boolean;
  renderStatusBadge: (status: string) => React.ReactNode;
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
  uniqueExpenseWorkers: { id: number; name: string; username?: string; employee_no?: string; unclaimed_count?: number; unclaimed_total?: number }[];
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
  previewMediaUrl: { url: string; title: string } | null;
  setPreviewMediaUrl: (media: { url: string; title: string } | null) => void;
  setShowPaymentModal: (b: WorkerClaimItem) => void;
  approvalsProps?: ApprovalsSubpageProps;
}

export const BundlesSubpage: React.FC<BundlesSubpageProps> = ({
  filteredBundles,
  bundles,
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
  previewMediaUrl,
  setPreviewMediaUrl,
  approvalsProps
}) => {
  // Sub-Tab View State
  const [activeViewTab, setActiveViewTab] = useState<'list' | 'approvals'>('list');

  const pendingApprovalsCount = useMemo(() => {
    if (!approvalsProps?.displayedApprovals) return 0;
    return approvalsProps.displayedApprovals.filter(a => {
      const type = a.target_summary?.type || (a.claim ? 'Bundle' : (a.ledger ? 'Ledger' : 'Expense'));
      return type === 'Bundle' && a.status === 'Pending';
    }).length;
  }, [approvalsProps]);

  // Main Table Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Expanded bundle accordion state
  const [expandedBundleIds, setExpandedBundleIds] = useState<Record<number, boolean>>({});
  const toggleExpandBundle = (bundleId: number) =>
    setExpandedBundleIds(prev => ({ ...prev, [bundleId]: !prev[bundleId] }));

  // Create Bundle Modal Pagination State
  const [modalPage, setModalPage] = useState(1);
  const modalItemsPerPage = 5;

  // Employee List Pagination & Filter State inside Create Bundle Modal
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [previewExpense, setPreviewExpense] = useState<ExpenseItem | null>(null);
  const [activeReceiptIndex, setActiveReceiptIndex] = useState<number>(0);
  const employeeItemsPerPage = 6;

  const filteredEmployees = useMemo(() => {
    return uniqueExpenseWorkers.filter(w => {
      if (employeeSearchQuery.trim()) {
        const q = employeeSearchQuery.toLowerCase();
        const nameMatch = w.name.toLowerCase().includes(q);
        const empNoMatch = (w.employee_no || '').toLowerCase().includes(q);
        const userMatch = (w.username || '').toLowerCase().includes(q);
        return nameMatch || empNoMatch || userMatch;
      }
      return true;
    });
  }, [uniqueExpenseWorkers, employeeSearchQuery]);

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
    setCurrentPage(1);
  }, [filteredBundles.length]);

  useEffect(() => {
    setModalPage(1);
  }, [filteredUnclaimedExpenses.length, expenseSearchWorker, expenseSearchText, expenseFilterFrom, expenseFilterTo]);

  const paginatedBundles = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBundles.slice(start, start + itemsPerPage);
  }, [filteredBundles, currentPage, itemsPerPage]);

  const paginatedModalExpenses = useMemo(() => {
    const start = (modalPage - 1) * modalItemsPerPage;
    return filteredUnclaimedExpenses.slice(start, start + modalItemsPerPage);
  }, [filteredUnclaimedExpenses, modalPage, modalItemsPerPage]);

  const totalModalPages = Math.ceil(filteredUnclaimedExpenses.length / modalItemsPerPage) || 1;

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
              <Layers className="w-3.5 h-3.5" />
              <span>Worker Claim Bundles</span>
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
              <span>Bundle Approvals Queue</span>
              {pendingApprovalsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {activeViewTab === 'approvals' && approvalsProps ? (
        <ApprovalsSubpage {...approvalsProps} fixedEntityType="Bundle" />
      ) : (
        <>
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
            <div className="p-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface">Worker Expense Claims & Bundles</span>
              <span className="text-xs text-on-surface-variant font-medium">Showing {filteredBundles.length} of {bundles.length}</span>
            </div>

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
                    <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-wider border-b border-outline-variant">
                      <tr>
                        <th className="w-8 px-2 py-3"></th>
                        <th className="px-4 py-3">Bundle ID</th>
                        <th className="px-4 py-3">Worker Name</th>
                        <th className="px-4 py-3">Claim Date</th>
                        <th className="px-4 py-3">Period</th>
                        <th className="px-4 py-3">Ledger Batch</th>
                        <th className="px-4 py-3 text-right">Amount ($)</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {paginatedBundles.map((b) => {
                        const isExpanded = !!expandedBundleIds[b.claim_id];
                        const bundleExpenses = Array.isArray(b.expenses) ? b.expenses : [];

                        return (
                          <React.Fragment key={b.claim_id}>
                            <tr
                              onClick={() => toggleExpandBundle(b.claim_id)}
                              className="hover:bg-surface-container-high transition-colors cursor-pointer"
                            >
                              <td className="px-2 py-3 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpandBundle(b.claim_id);
                                  }}
                                  className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant transition-colors cursor-pointer"
                                >
                                  {isExpanded ? '▼' : '▶'}
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
                                {b.worker_detail ? `${b.worker_detail.full_name || b.worker_detail.username}` : `Worker ${(b.worker_detail as any)?.id || ''}`}
                              </td>
                              <td className="px-4 py-3 text-on-surface-variant">{new Date(b.claim_date).toLocaleDateString()}</td>
                              <td className="px-4 py-3 text-on-surface-variant text-[11px]">
                                {b.period_from && b.period_to ? `${b.period_from} → ${b.period_to}` : 'All Expenses'}
                              </td>
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
                              <td className="px-4 py-3">{renderStatusBadge(b.status)}</td>
                              <td className="px-4 py-3 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                                {(b.status === 'Draft' || b.status === 'Rework' || b.status === 'Rejected') && (
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
                                )}
                                {(b.status === 'Draft' || b.status === 'Rework' || b.status === 'Rejected') && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSubmitBundle(b.claim_id);
                                    }}
                                    disabled={submitting}
                                    className="px-2.5 py-1 rounded bg-primary text-on-primary text-[11px] font-medium hover:bg-primary-container transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    {b.status === 'Rework' || b.status === 'Rejected' ? 'Resubmit Claim' : 'Submit Approval'}
                                  </button>
                                )}
                                {b.status !== 'Approved' && b.status !== 'Paid' && (
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
                                )}
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="bg-primary/5 dark:bg-primary/10">
                                <td colSpan={9} className="px-6 py-4 border-b border-outline-variant space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface">
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
                                        <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[9px] tracking-wider border-b border-outline-variant">
                                          <tr>
                                            <th className="px-3 py-2">Exp #</th>
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
                                                <td className="px-3 py-2 text-on-surface-variant font-mono">{ticketNo}</td>
                                                <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                  {parseFloat(exp.amount || '0').toFixed(2)}
                                                </td>
                                                <td className="px-3 py-2 text-right">
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
                  totalItems={filteredBundles.length}
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

      {/* MODAL: CREATE BUNDLE DIRECT MODAL */}
      {showCreateBundleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-surface-container rounded border border-outline-variant/80 max-w-5xl w-full h-[88vh] max-h-[860px] min-h-[640px] flex flex-col p-6 sm:p-7 shadow-2xl overflow-hidden transition-all">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-outline-variant/80 pb-3.5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface tracking-tight">Create Worker Claim Bundle</h3>
                  <p className="text-xs text-on-surface-variant font-normal mt-0.5">
                    Select worker, choose unclaimed expenses, and provide claim remarks.
                  </p>
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
              {/* 1. SELECT EMPLOYEE / TECHNICIAN */}
              <div className="p-3 bg-surface-container-low border border-outline-variant/80 rounded space-y-2.5 shrink-0 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-on-surface text-xs block uppercase tracking-wider text-primary">
                    1. Select Technician ({filteredEmployees.length})
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
                          placeholder="Search employee name / ID..."
                          value={employeeSearchQuery}
                          onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                          className="w-full bg-surface-container border border-outline-variant text-on-surface text-xs rounded pl-9 pr-3 py-2 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs hover:border-outline"
                        />
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
                                  <div className={`w-7 h-7 rounded flex items-center justify-center font-bold text-xs shrink-0 ${isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface'
                                    }`}>
                                    {emp.name.charAt(0).toUpperCase()}
                                  </div>
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
                  <div className="p-2.5 px-3.5 rounded bg-primary/10 border border-primary/30 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-primary text-on-primary font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                        {expenseSearchWorker.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-on-surface truncate">{expenseSearchWorker}</h4>
                        </div>
                        <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
                          {uniqueExpenseWorkers.find(w => w.name === expenseSearchWorker)?.unclaimed_count !== undefined ? ` • ${uniqueExpenseWorkers.find(w => w.name === expenseSearchWorker)?.unclaimed_count} unclaimed expenses` : ''}
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
                )}
              </div>

              {/* 2. UNCLAIMED EXPENSES LIST FOR SELECTED EMPLOYEE */}
              <div className="flex-1 min-h-0 flex flex-col space-y-1.5 overflow-hidden">
                <div className="flex items-center justify-between text-xs px-1 shrink-0">
                  <span className="font-bold text-on-surface flex items-center gap-2">
                    <span>Unclaimed Expenses ({filteredUnclaimedExpenses.length})</span>
                    {filteredUnclaimedExpenses.some(e => !(e.approved === true || ((e.expense_type as any)?.approve_required === false))) && (
                      <span className=" text-green-600 dark:text-green-400 font-semibold px-2 py-0.5 ">
                        Eligible to claim
                        {filteredUnclaimedExpenses.filter(e => e.approved === true || ((e.expense_type as any)?.approve_required === false)).length}
                      </span>
                    )}
                  </span>

                  <div className="flex items-center gap-3">
                    {filteredUnclaimedExpenses.length > 0 && (
                      <div className="space-x-3">
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
                        <button
                          type="button"
                          onClick={() => setSelectedExpenseIds([])}
                          className="text-on-surface-variant hover:underline font-medium text-xs cursor-pointer"
                        >
                          Deselect All
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
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`font-semibold truncate transition-colors ${!isExpApproved ? 'text-on-surface-variant' : 'text-on-surface hover:text-primary'}`}>
                                    {exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || `Expense #${exp.expense_id}`}
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
                                        WO: {wo}
                                      </span>
                                    );
                                  })()}
                                  {exp.remarks && <span className="italic truncate max-w-[200px]"> • {exp.remarks}</span>}
                                </span>
                                <span className="shrink-0">{exp.expense_date}</span>
                              </div>
                            </div>
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
                  Bundle Remarks / Notes <span className="text-red-500 font-bold">*</span>
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
                    Selected: <strong className="text-on-surface font-bold text-xs">{selectedExpenseIds.length} expenses</strong>
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
                    {renderStatusBadge(selectedBundleForView.status)}
                  </h3>
                  <p className="text-xs text-on-surface-variant font-normal mt-0.5">
                    Worker: <span className="font-semibold text-on-surface">{selectedBundleForView.worker_detail?.full_name || selectedBundleForView.worker_detail?.username || 'Technician'}</span>
                    {selectedBundleForView.claim_date && ` • Created: ${new Date(selectedBundleForView.claim_date).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedBundleForView(null)} className="p-2 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded bg-surface-container-low border border-outline-variant/80 shadow-2xs">
                <span className="text-on-surface-variant block text-[10px] uppercase tracking-wider font-semibold">Total Amount</span>
                <span className="font-bold text-sm text-primary mt-0.5 block">${parseFloat(selectedBundleForView.total_claimed_amount).toFixed(2)}</span>
              </div>
              <div className="p-3 rounded bg-surface-container-low border border-outline-variant/80 shadow-2xs">
                <span className="text-on-surface-variant block text-[10px] uppercase tracking-wider font-semibold">Coverage Period</span>
                <span className="font-semibold text-on-surface mt-0.5 block">
                  {selectedBundleForView.period_from && selectedBundleForView.period_to ? `${selectedBundleForView.period_from} → ${selectedBundleForView.period_to}` : 'All Expenses'}
                </span>
              </div>
              <div className="p-3 rounded bg-surface-container-low border border-outline-variant/80 shadow-2xs">
                <span className="text-on-surface-variant block text-[10px] uppercase tracking-wider font-semibold">Tied Bills / Expenses</span>
                <span className="font-semibold text-on-surface mt-0.5 block">{selectedBundleForView.expenses?.length || 0} Bills</span>
              </div>
            </div>

            {selectedBundleForView.ledger_details && (
              <div className="p-3.5 rounded bg-blue-500/10 border border-blue-500/20 text-xs">
                <span className="text-blue-600 dark:text-blue-400 font-semibold block text-[10px] uppercase tracking-wider flex items-center gap-1 mb-1">
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

            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center justify-between">
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
                                <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-primary font-semibold">
                                  {exp.ticket_details.work_order_no}
                                </span>
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
                          </div>
                        </div>

                        {receiptsList.length > 0 && (
                          <div className="pt-2.5 border-t border-outline-variant/60">
                            <span className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1.5 flex items-center gap-1">
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

            <div className="flex items-center justify-between pt-3.5 border-t border-outline-variant/80">
              <div className="flex items-center gap-2">
                {(selectedBundleForView.status === 'Draft' || selectedBundleForView.status === 'Rework') && (
                  <button
                    onClick={() => openEditBundleModal(selectedBundleForView)}
                    className="px-3.5 py-2 rounded border border-primary text-primary hover:bg-primary/10 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Edit Bundle</span>
                  </button>
                )}
                {selectedBundleForView.status !== 'Approved' && selectedBundleForView.status !== 'Paid' && (
                  <button
                    onClick={() => handleDeleteBundle(selectedBundleForView.claim_id)}
                    className="px-3.5 py-2 rounded border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Bundle</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {(selectedBundleForView.status === 'Draft' || selectedBundleForView.status === 'Rework') && (
                  <button
                    onClick={() => {
                      handleSubmitBundle(selectedBundleForView.claim_id);
                      setSelectedBundleForView(null);
                    }}
                    disabled={submitting}
                    className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-all cursor-pointer shadow-md hover:shadow-primary/25 active:scale-[0.98]"
                  >
                    {selectedBundleForView.status === 'Rework' ? 'Resubmit Approval' : 'Submit Approval'}
                  </button>
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
          workOrderNo: rawTicket.work_order_no || (rawTicket as any).wo_no || '',
          title: rawTicket.title || '',
          description: rawTicket.description || '',
          status: rawTicket.status || '',
          priority: rawTicket.priority || '',
          createdDate: rawTicket.created_date ? new Date(rawTicket.created_date).toLocaleDateString() : '',
          department: typeof rawTicket.department === 'object' ? rawTicket.department?.department_name : (rawTicket.department || (rawTicket as any).department_name || ''),
          location: typeof rawTicket.location === 'object' ? rawTicket.location?.location_name : (rawTicket.location || (rawTicket as any).location_name || ''),
          store: typeof rawTicket.store === 'object' ? rawTicket.store?.store_name : (rawTicket.store || (rawTicket as any).store_name || ''),
          createdBy: typeof rawTicket.created_by === 'object' ? (rawTicket.created_by?.full_name || rawTicket.created_by?.username) : (rawTicket.created_by || '')
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
            <div className="bg-surface-container rounded border border-outline-variant/80 max-w-2xl w-full p-6 sm:p-7 space-y-5 shadow-2xl my-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between border-b border-outline-variant/80 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-on-surface tracking-tight">Expense #{previewExpense.expense_id}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                        {expTypeName}
                      </span>
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
                  <span className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-primary" />
                    <span>Expense Bill / Receipt Visual Preview</span>
                  </span>
                  {receiptsList.length > 0 && (
                    <span className="text-xs text-on-surface-variant font-medium">
                      Showing {safeIndex + 1} of {receiptsList.length} receipt attachments
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
                  <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block">Total Amount</span>
                  <span className="text-lg font-extrabold text-primary block mt-0.5">
                    ${parseFloat(previewExpense.amount || '0').toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block">Expense Date</span>
                  <span className="font-semibold text-on-surface block mt-1">{previewExpense.expense_date || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block">Worker / Technician</span>
                  <span className="font-semibold text-on-surface block mt-1 truncate" title={workerDisplayName}>{workerDisplayName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block">Responsible Store</span>
                  <span className="font-semibold text-on-surface block mt-1 truncate" title={storeDisplayName}>{storeDisplayName}</span>
                </div>
              </div>

              {/* REMARKS / NOTES */}
              <div className="p-4 rounded bg-surface-container-low border border-outline-variant/80 space-y-1.5 text-xs shadow-2xs">
                <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block">Expense Remarks / Description</span>
                <p className="text-on-surface text-xs leading-relaxed italic bg-surface-container p-3 rounded border border-outline-variant/60">
                  {previewExpense.remarks || 'No remarks recorded.'}
                </p>
              </div>

              {/* LINKED TICKET DETAILS */}
              {ticketInfo ? (
                <div className="p-4 rounded bg-surface-container-low border border-primary/30 space-y-2.5 text-xs shadow-2xs">
                  <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> Linked Ticket Information
                    </span>
                    {ticketInfo.id && (
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[11px] border border-primary/20">
                        Ticket #{ticketInfo.id}
                      </span>
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
                      <span className="text-on-surface-variant text-[10px] uppercase font-semibold block">Ticket Title</span>
                      <p className="font-semibold text-on-surface text-xs mt-0.5">{ticketInfo.title}</p>
                    </div>
                  )}

                  {ticketInfo.description && (
                    <div>
                      <span className="text-on-surface-variant text-[10px] uppercase font-semibold block">Description</span>
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
