import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers, PlusCircle, Trash2, X, AlertCircle, Loader2, Building2, ShieldCheck
} from 'lucide-react';
import type { LedgerItem, WorkerClaimItem, LedgerGroupItem, ExpenseItem } from './types';
import { Pagination } from './Pagination';
import { SearchableSelect, type SelectOption } from '../../components/SearchableSelect';
import { ApprovalsSubpage, type ApprovalsSubpageProps } from './ApprovalsSubpage';

interface LedgersSubpageProps {
  filteredLedgers: LedgerItem[];
  ledgers: LedgerItem[];
  bundles: WorkerClaimItem[];
  ledgerGroups: LedgerGroupItem[];
  loading: boolean;
  submitting: boolean;
  renderStatusBadge: (status: string) => React.ReactNode;
  expandedLedgerIds: Record<number, boolean>;
  toggleExpandLedger: (ledgerId: number) => void;
  handleSubmitLedger: (ledgerId: number) => void;
  setShowPaymentModal: (item: LedgerItem) => void;
  handleDeleteLedger: (ledgerId: number) => void;
  openEditBundleModal: (bundle: WorkerClaimItem) => void;
  openAddExpenseModal?: (ledger: LedgerItem) => void;
  handleRemoveExpenseFromLedger: (ledgerId: number, expenseId: number) => void;
  handleAddBundleToLedger?: (ledgerId: number, bundleId: number) => Promise<void>;
  handleRemoveBundleFromLedger?: (ledgerId: number, bundleId: number) => Promise<void>;
  showCreateLedgerModal: boolean;
  setShowCreateLedgerModal: (show: boolean) => void;
  selectedBundleIds: number[];
  setSelectedBundleIds: (ids: number[]) => void;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  newGroupName: string;
  setNewGroupName: (name: string) => void;
  handleCreateLedger: () => void;
  showAddExpenseModal?: LedgerItem | null;
  setShowAddExpenseModal?: (item: LedgerItem | null) => void;
  loadingAvailableExpenses?: boolean;
  availableApprovedExpenses?: ExpenseItem[];
  selectedAddExpenseId?: number | null;
  setSelectedAddExpenseId?: (id: number | null) => void;
  handleAddExpenseToLedger?: () => void;
  token?: string;
  API_URL?: string;
  approvalsProps?: ApprovalsSubpageProps;
}

export const LedgersSubpage: React.FC<LedgersSubpageProps> = ({
  filteredLedgers,
  ledgers,
  bundles,
  ledgerGroups,
  loading,
  submitting,
  renderStatusBadge,
  expandedLedgerIds,
  toggleExpandLedger,
  handleSubmitLedger,
  setShowPaymentModal,
  handleDeleteLedger,
  openEditBundleModal,
  openAddExpenseModal,
  handleRemoveExpenseFromLedger,
  handleAddBundleToLedger,
  handleRemoveBundleFromLedger,
  showCreateLedgerModal,
  setShowCreateLedgerModal,
  selectedBundleIds,
  setSelectedBundleIds,
  selectedGroupId,
  setSelectedGroupId,
  newGroupName,
  setNewGroupName,
  handleCreateLedger,
  showAddExpenseModal,
  setShowAddExpenseModal,
  loadingAvailableExpenses,
  availableApprovedExpenses,
  selectedAddExpenseId,
  setSelectedAddExpenseId,
  handleAddExpenseToLedger,
  token,
  API_URL,
  approvalsProps
}) => {
  // Sub-Tab View State
  const [activeViewTab, setActiveViewTab] = useState<'list' | 'approvals'>('list');

  // Attach bundle modal state
  const [showAddBundleModal, setShowAddBundleModal] = useState<LedgerItem | null>(null);
  const [selectedBundleToAttach, setSelectedBundleToAttach] = useState<number | null>(null);
  const [attachingBundle, setAttachingBundle] = useState<boolean>(false);

  const handleAttachBundle = async () => {
    if (!showAddBundleModal || !selectedBundleToAttach || !handleAddBundleToLedger) return;
    setAttachingBundle(true);
    try {
      await handleAddBundleToLedger(showAddBundleModal.ledger_id, selectedBundleToAttach);
      setShowAddBundleModal(null);
      setSelectedBundleToAttach(null);
    } catch (e) {
      // Error handled by parent
    } finally {
      setAttachingBundle(false);
    }
  };

  const pendingApprovalsCount = useMemo(() => {
    if (!approvalsProps?.displayedApprovals) return 0;
    return approvalsProps.displayedApprovals.filter(a => {
      const type = a.target_summary?.type || (a.claim ? 'Bundle' : (a.ledger ? 'Ledger' : 'Expense'));
      return type === 'Ledger' && a.status === 'Pending';
    }).length;
  }, [approvalsProps]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Nested bundle accordion state
  const [expandedBundleIds, setExpandedBundleIds] = useState<Record<number, boolean>>({});
  const toggleExpandBundle = (bundleId: number) =>
    setExpandedBundleIds(prev => ({ ...prev, [bundleId]: !prev[bundleId] }));

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredLedgers.length]);

  const paginatedLedgers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLedgers.slice(start, start + itemsPerPage);
  }, [filteredLedgers, currentPage, itemsPerPage]);

  return (
    <div className="space-y-4">
      {/* Sub-Navigation Tabs */}
      {approvalsProps && (
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveViewTab('list')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeViewTab === 'list'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Ledger Batches</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewTab('approvals')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeViewTab === 'approvals'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Ledger Approvals Queue</span>
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
        <ApprovalsSubpage {...approvalsProps} fixedEntityType="Ledger" />
      ) : (
        <>
          <div className="border border-outline-variant rounded overflow-hidden bg-surface-container flex flex-col">
        <div className="p-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
          <span className="text-xs font-semibold text-on-surface">Ledgers & Group Batches</span>
          <span className="text-xs text-on-surface-variant font-medium">Showing {filteredLedgers.length} of {ledgers.length}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading ledgers...
          </div>
        ) : filteredLedgers.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant space-y-2">
            <Layers className="w-8 h-8 mx-auto text-outline" />
            <p className="text-xs font-medium text-on-surface">No ledgers match filters</p>
            <p className="text-xs">Assemble multiple approved worker claims into a unified Ledger batch.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs text-left text-on-surface">
                <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-wider border-b border-outline-variant">
                  <tr>
                    <th className="w-8 px-2 py-3"></th>
                    <th className="px-4 py-3">Ledger ID</th>
                    <th className="px-4 py-3">Ledger Group</th>
                    <th className="px-4 py-3">Bundles Count</th>
                    <th className="px-4 py-3">Expenses Count</th>
                    <th className="px-4 py-3">Created By</th>
                    <th className="px-4 py-3 text-right">Total ($)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {paginatedLedgers.map((l) => {
                    const isExpanded = !!expandedLedgerIds[l.ledger_id];
                    return (
                      <React.Fragment key={l.ledger_id}>
                        <tr
                          onClick={() => toggleExpandLedger(l.ledger_id)}
                          className="hover:bg-surface-container-high transition-colors cursor-pointer"
                        >
                          <td className="px-2 py-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandLedger(l.ledger_id);
                              }}
                              className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant transition-colors cursor-pointer"
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          </td>
                          <td className="px-4 py-3  font-semibold text-primary">{l.ledger_id}</td>
                          <td className="px-4 py-3 font-medium text-on-surface">
                            {l.ledger_group_detail?.group_name || `Ledger Batch ${l.ledger_id}`}
                          </td>
                          <td className="px-4 py-3 ">{l.bundles?.length || 0} Bundles</td>
                          <td className="px-4 py-3  text-on-surface-variant">{l.expenses?.length || 0} Expenses</td>
                          <td className="px-4 py-3 text-on-surface-variant font-medium">
                            {l.created_by_detail?.full_name || l.created_by_detail?.username || 'User'}
                          </td>
                          <td className="px-4 py-3 text-right  font-bold text-on-surface">
                            {parseFloat(l.total_amount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">{renderStatusBadge(l.status)}</td>
                          <td className="px-4 py-3 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                            {(l.status === 'Draft' || l.status === 'Rework' || l.status === 'Rejected') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSubmitLedger(l.ledger_id);
                                }}
                                disabled={submitting}
                                className="px-2.5 py-1 rounded bg-primary text-on-primary text-[11px] font-medium hover:bg-primary-container transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {l.status === 'Rework' || l.status === 'Rejected' ? 'Resubmit Batch' : 'Submit Batch'}
                              </button>
                            )}
                            {l.status !== 'Approved' && l.status !== 'Paid' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteLedger(l.ledger_id);
                                }}
                                disabled={submitting}
                                className="p-1 rounded border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer inline-flex items-center disabled:opacity-50"
                                title="Delete Ledger Batch"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-surface-container-low/60">
                            <td colSpan={9} className="px-6 py-4 border-b border-outline-variant space-y-3">
                              {/* Level 1 Accordion Header: Included Worker Bundles + Add Bundle Button */}
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-2">
                                  <span>Included Worker Bundles ({l.bundles?.length || 0})</span>
                                </span>
                                {(l.status === 'Draft' || l.status === 'Rework' || l.status === 'Rejected') && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowAddBundleModal(l);
                                      setSelectedBundleToAttach(null);
                                    }}
                                    className="px-2.5 py-1 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                    title="Attach Approved Worker Claim Bundle to this Ledger"
                                  >
                                    <PlusCircle className="w-3.5 h-3.5" />
                                    <span>+ Add Bundle</span>
                                  </button>
                                )}
                              </div>

                              {(!l.bundles || l.bundles.length === 0) ? (
                                <p className="text-xs text-on-surface-variant italic">No bundles attached to this ledger.</p>
                              ) : (
                                <div className="border border-outline-variant rounded overflow-hidden bg-surface-container">
                                  <table className="w-full text-xs text-left text-on-surface">
                                    <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[9px] tracking-wider border-b border-outline-variant">
                                      <tr>
                                        <th className="w-6 px-2 py-2"></th>
                                        <th className="px-3 py-2">Claim ID</th>
                                        <th className="px-3 py-2">Technician / Worker</th>
                                        <th className="px-3 py-2">Period</th>
                                        <th className="px-3 py-2 text-right">Amount ($)</th>
                                        <th className="px-3 py-2">Status</th>
                                        <th className="px-3 py-2 text-right">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-outline-variant">
                                      {l.bundles.map((b) => {
                                        const isBundleExpanded = !!expandedBundleIds[b.claim_id];
                                        const bundleExpenses = Array.isArray(b.expenses) ? b.expenses : [];
                                        const isLedgerEditable = l.status === 'Draft' || l.status === 'Rework' || l.status === 'Rejected';

                                        return (
                                          <React.Fragment key={b.claim_id}>
                                            {/* Level 2: Bundle Row */}
                                            <tr
                                              className={`transition-colors cursor-pointer ${isBundleExpanded
                                                ? 'bg-primary/15 dark:bg-primary/25 border-l-4 border-l-primary'
                                                : 'hover:bg-surface-container-high'
                                                }`}
                                              onClick={() => toggleExpandBundle(b.claim_id)}
                                            >
                                              <td className="px-2 py-2 text-center">
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); toggleExpandBundle(b.claim_id); }}
                                                  className="p-0.5 rounded hover:bg-surface-container-highest text-on-surface-variant transition-colors cursor-pointer text-[10px]"
                                                >
                                                  {isBundleExpanded ? '▼' : '▶'}
                                                </button>
                                              </td>
                                              <td className="px-3 py-2 font-medium text-primary">
                                                Bundle {b.claim_id}
                                                {bundleExpenses.length > 0 && (
                                                  <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                                                    {bundleExpenses.length} exp
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-3 py-2 font-medium">{b.worker_detail?.full_name || b.worker_detail?.username || `Worker ${b.worker}`}</td>
                                              <td className="px-3 py-2 text-on-surface-variant">{b.period_from && b.period_to ? `${b.period_from} → ${b.period_to}` : 'All Expenses'}</td>
                                              <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">{parseFloat(b.total_claimed_amount).toFixed(2)}</td>
                                              <td className="px-3 py-2">{renderStatusBadge(b.status)}</td>
                                              <td className="px-3 py-2 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                                                {isLedgerEditable && (
                                                  <>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        openEditBundleModal(b);
                                                      }}
                                                      className="px-2 py-0.5 rounded border border-primary/40 text-primary text-[11px] font-medium hover:bg-primary/10 transition-colors cursor-pointer inline-flex items-center gap-1"
                                                      title="Add or Remove Expenses in Bundle"
                                                    >
                                                      <PlusCircle className="w-3 h-3" />
                                                      <span>+ Expense</span>
                                                    </button>

                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (handleRemoveBundleFromLedger) {
                                                          handleRemoveBundleFromLedger(l.ledger_id, b.claim_id);
                                                        }
                                                      }}
                                                      className="px-2 py-0.5 rounded border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                                                      title="Remove / Detach Bundle from this Ledger"
                                                    >
                                                      <Trash2 className="w-3 h-3" />
                                                      <span>Remove</span>
                                                    </button>
                                                  </>
                                                )}
                                              </td>
                                            </tr>

                                            {/* Level 3: Expenses inside Bundle */}
                                            {isBundleExpanded && (
                                              <tr className="bg-primary/5 dark:bg-primary/10">
                                                <td colSpan={7} className="px-4 py-3 border-b border-outline-variant">
                                                  <div className="ml-4 space-y-1.5">
                                                    <div className="flex items-center justify-between mb-2">
                                                      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                                                        Expenses in Bundle {b.claim_id} ({bundleExpenses.length})
                                                      </p>
                                                      {isLedgerEditable && (
                                                        <button
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            openEditBundleModal(b);
                                                          }}
                                                          className="px-2 py-0.5 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-medium hover:bg-primary/10 transition-colors cursor-pointer inline-flex items-center gap-1"
                                                          title="Add or Remove Expenses in Bundle"
                                                        >
                                                          <PlusCircle className="w-3 h-3" />
                                                          <span>+ Add Expense to Bundle</span>
                                                        </button>
                                                      )}
                                                    </div>
                                                    {bundleExpenses.length === 0 ? (
                                                      <p className="text-[11px] text-on-surface-variant italic">No expenses recorded in this bundle.</p>
                                                    ) : (
                                                      <div className="border border-outline-variant rounded overflow-hidden bg-surface-container">
                                                        <table className="w-full text-[11px] text-left text-on-surface">
                                                          <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[9px] tracking-wider border-b border-outline-variant">
                                                            <tr>
                                                              <th className="px-3 py-1.5">Exp #</th>
                                                              <th className="px-3 py-1.5">Category</th>
                                                              <th className="px-3 py-1.5">Worker</th>
                                                              <th className="px-3 py-1.5">Date</th>
                                                              <th className="px-3 py-1.5 text-right">Amount ($)</th>
                                                              <th className="px-3 py-1.5 text-right">Action</th>
                                                            </tr>
                                                          </thead>
                                                          <tbody className="divide-y divide-outline-variant">
                                                            {bundleExpenses.map((exp: any) => (
                                                              <tr key={exp.expense_id} className="hover:bg-surface-container-high transition-colors">
                                                                <td className="px-3 py-1.5 font-medium text-primary">#{exp.expense_id}</td>
                                                                <td className="px-3 py-1.5 text-on-surface">{exp.expense_type_detail?.expense_name || 'General'}</td>
                                                                <td className="px-3 py-1.5 text-on-surface-variant">
                                                                  {exp.worker_detail?.full_name || exp.worker_detail?.username || `Worker ${exp.worker}`}
                                                                </td>
                                                                <td className="px-3 py-1.5 text-on-surface-variant">{exp.expense_date}</td>
                                                                <td className="px-3 py-1.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                                  {parseFloat(exp.amount).toFixed(2)}
                                                                </td>
                                                                <td className="px-3 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                                                                  {isLedgerEditable && (
                                                                    <button
                                                                      onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRemoveExpenseFromLedger(l.ledger_id, exp.expense_id);
                                                                      }}
                                                                      className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline font-medium cursor-pointer inline-flex items-center gap-0.5"
                                                                      title="Remove Expense from Bundle and Ledger"
                                                                    >
                                                                      <Trash2 className="w-3 h-3" />
                                                                      <span>Remove</span>
                                                                    </button>
                                                                  )}
                                                                </td>
                                                              </tr>
                                                            ))}
                                                          </tbody>
                                                        </table>
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
              totalItems={filteredLedgers.length}
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

      {/* MODAL: ASSEMBLE LEDGER */}
      {showCreateLedgerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface-container rounded border border-outline-variant max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="text-sm font-semibold text-on-surface">Assemble Ledger Batch</h3>
              <button onClick={() => setShowCreateLedgerModal(false)}><X className="w-4 h-4 text-on-surface-variant" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Select Approved Bundles</label>
                {bundles.filter(b => b.status === 'Approved' && !b.ledger_details).length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic">No unattached approved bundles available to assemble into ledger.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-outline-variant rounded p-2 space-y-1 bg-surface-container-low">
                    {bundles.filter(b => b.status === 'Approved' && !b.ledger_details).map((b) => (
                      <label key={b.claim_id} className="flex items-center gap-2 p-1.5 hover:bg-surface-container rounded cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={selectedBundleIds.includes(b.claim_id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedBundleIds([...selectedBundleIds, b.claim_id]);
                            else setSelectedBundleIds(selectedBundleIds.filter(id => id !== b.claim_id));
                          }}
                        />
                        <span className=" font-medium">Bundle {b.claim_id}</span>
                        <span className="text-on-surface-variant">({b.worker_detail?.full_name || b.worker_detail?.username})</span>
                        <span className="text-emerald-600  font-semibold ml-auto">{parseFloat(b.total_claimed_amount).toFixed(2)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Ledger Group</label>
                <SearchableSelect
                  value={selectedGroupId}
                  onChange={(val) => setSelectedGroupId(val)}
                  options={[
                    { value: '', label: '-- Create New Group or Select Existing --' },
                    ...ledgerGroups.map(g => ({ value: String(g.ledger_group_id), label: g.group_name }))
                  ]}
                  placeholder="-- Create New Group or Select Existing --"
                />
              </div>

              {!selectedGroupId && (
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">New Group Name</label>
                  <input
                    type="text"
                    placeholder="e.g. September Batch A"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full bg-surface-container border border-outline text-on-surface text-xs rounded p-2"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
              <button onClick={() => setShowCreateLedgerModal(false)} className="px-3 py-1.5 rounded border border-outline text-xs text-on-surface">Cancel</button>
              <button
                onClick={handleCreateLedger}
                disabled={submitting || selectedBundleIds.length === 0 || (!selectedGroupId && !newGroupName.trim())}
                className="px-3 py-1.5 rounded bg-primary text-on-primary text-xs font-medium hover:bg-primary-container disabled:opacity-50"
              >
                {submitting ? 'Assembling...' : 'Assemble Ledger'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ATTACH BUNDLE TO LEDGER */}
      {showAddBundleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface-container rounded border border-outline-variant max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-on-surface">
                  Attach Bundle to Ledger #{showAddBundleModal.ledger_id}
                </h3>
              </div>
              <button onClick={() => setShowAddBundleModal(null)} className="cursor-pointer">
                <X className="w-4 h-4 text-on-surface-variant" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-on-surface-variant">
                Select an approved worker claim bundle to attach to Ledger Batch #{showAddBundleModal.ledger_id} ({showAddBundleModal.ledger_group_detail?.group_name || `Ledger #${showAddBundleModal.ledger_id}`}).
              </p>

              {(() => {
                const currentBundleIds = new Set((showAddBundleModal.bundles || []).map(b => b.claim_id));
                const available = bundles.filter(b => b.status === 'Approved' && !currentBundleIds.has(b.claim_id) && (!b.ledger_details || b.ledger_details.ledger_id === showAddBundleModal.ledger_id));
                if (available.length === 0) {
                  return (
                    <div className="p-4 rounded border border-outline-variant bg-surface-container-low text-xs text-on-surface-variant italic text-center">
                      No unattached approved bundles available to add.
                    </div>
                  );
                }

                return (
                  <div className="max-h-60 overflow-y-auto border border-outline-variant rounded divide-y divide-outline-variant bg-surface-container-low scrollbar-thin">
                    {available.map((b) => {
                      const isSelected = selectedBundleToAttach === b.claim_id;
                      return (
                        <div
                          key={b.claim_id}
                          onClick={() => setSelectedBundleToAttach(b.claim_id)}
                          className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-surface-container'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name="bundleToAttach"
                              checked={isSelected}
                              onChange={() => setSelectedBundleToAttach(b.claim_id)}
                              className="accent-primary"
                            />
                            <div>
                              <span className="font-semibold text-primary block">Bundle #{b.claim_id}</span>
                              <span className="text-[11px] text-on-surface font-medium">
                                {b.worker_detail?.full_name || b.worker_detail?.username || `Worker ${b.worker}`}
                              </span>
                              <span className="text-[10px] text-on-surface-variant block">
                                Period: {b.period_from && b.period_to ? `${b.period_from} → ${b.period_to}` : 'All Expenses'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                              ${parseFloat(b.total_claimed_amount).toFixed(2)}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                              Approved
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant">
              <button
                type="button"
                onClick={() => setShowAddBundleModal(null)}
                className="px-3 py-1.5 rounded border border-outline text-xs text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAttachBundle}
                disabled={submitting || attachingBundle || !selectedBundleToAttach}
                className="px-4 py-1.5 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {attachingBundle ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Attaching...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Attach Bundle</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
