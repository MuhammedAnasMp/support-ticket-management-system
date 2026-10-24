import React, { useState, useMemo } from 'react';
import { 
  X, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Search, 
  PlusCircle, 
  Trash2, 
  Check, 
  Lock,
  Plus,
  Minus
} from 'lucide-react';
import type { WorkerClaimItem, ExpenseItem } from './types';
import { getUserId } from './types';

interface EditBundleModalProps {
  selectedBundleForEdit: WorkerClaimItem | null;
  setSelectedBundleForEdit: (b: WorkerClaimItem | null) => void;
  editBundleForm: { period_from: string; period_to: string; remarks: string; selectedExpenseIds: number[] };
  setEditBundleForm: React.Dispatch<React.SetStateAction<{ period_from: string; period_to: string; remarks: string; selectedExpenseIds: number[] }>>;
  unclaimedExpenses: ExpenseItem[];
  submitting: boolean;
  handleSaveUpdateBundle: () => void;
  errorMessage?: string | null;
  setErrorMessage?: (msg: string | null) => void;
}

export const EditBundleModal: React.FC<EditBundleModalProps> = ({
  selectedBundleForEdit,
  setSelectedBundleForEdit,
  editBundleForm,
  setEditBundleForm,
  unclaimedExpenses,
  submitting,
  handleSaveUpdateBundle,
  errorMessage,
  setErrorMessage
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'added' | 'unadded'>('all');

  if (!selectedBundleForEdit) return null;

  const currentExpenses = selectedBundleForEdit.expenses || [];
  const targetWorkerId = getUserId((selectedBundleForEdit as any).worker) ?? getUserId(selectedBundleForEdit.worker_detail);

  // Combine current expenses in bundle with unclaimed expenses of this worker
  const availableForWorker = unclaimedExpenses.filter(e => {
    const expWorkerId = getUserId(e.worker) ?? getUserId(e.worker_detail);
    return targetWorkerId !== null && expWorkerId !== null && targetWorkerId === expWorkerId;
  });

  const combinedExpenses = useMemo(() => {
    return Array.from(
      new Map([...currentExpenses, ...availableForWorker].map(e => [e.expense_id, e])).values()
    );
  }, [currentExpenses, availableForWorker]);

  const isConnectedToLedger = Boolean(selectedBundleForEdit.ledger_details || (selectedBundleForEdit as any).ledger_id);

  // Separate expenses into added vs unadded
  const addedExpenses = useMemo(() => {
    return combinedExpenses.filter(e => editBundleForm.selectedExpenseIds.includes(e.expense_id));
  }, [combinedExpenses, editBundleForm.selectedExpenseIds]);

  const unaddedExpenses = useMemo(() => {
    return combinedExpenses.filter(e => !editBundleForm.selectedExpenseIds.includes(e.expense_id));
  }, [combinedExpenses, editBundleForm.selectedExpenseIds]);

  // Search filter predicate
  const matchesSearch = (exp: ExpenseItem) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const expIdStr = String(exp.expense_id || '');
    const categoryName = (exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || '').toLowerCase();
    const remarks = (exp.remarks || '').toLowerCase();
    const ticketObj = (exp as any).ticket_details || (exp as any).ticket;
    const workOrderNo = (typeof ticketObj === 'object' && ticketObj ? (ticketObj.work_order_no || '') : String(ticketObj || '')).toLowerCase();
    const amountStr = String(exp.amount || '');
    const dateStr = (exp.expense_date || '').toLowerCase();
    return (
      expIdStr.includes(q) ||
      `#${expIdStr}`.includes(q) ||
      `exp-${expIdStr}`.includes(q) ||
      categoryName.includes(q) ||
      remarks.includes(q) ||
      workOrderNo.includes(q) ||
      amountStr.includes(q) ||
      dateStr.includes(q)
    );
  };

  const filteredAdded = useMemo(() => {
    return addedExpenses.filter(matchesSearch);
  }, [addedExpenses, searchQuery]);

  const filteredUnadded = useMemo(() => {
    return unaddedExpenses.filter(matchesSearch);
  }, [unaddedExpenses, searchQuery]);

  // Totals calculation
  const addedTotal = addedExpenses.reduce((acc, curr) => acc + parseFloat(curr.amount || '0'), 0);
  const unaddedTotal = unaddedExpenses.reduce((acc, curr) => acc + parseFloat(curr.amount || '0'), 0);

  // Actions
  const handleToggleExpense = (exp: ExpenseItem) => {
    const isAlreadyInBundle = currentExpenses.some(c => c.expense_id === exp.expense_id);
    const isSelected = editBundleForm.selectedExpenseIds.includes(exp.expense_id);

    const statusText = (exp.expense_type && (exp.expense_type as any).approve_required === false)
      ? 'Approved'
      : (exp.status_display || (exp.approved ? 'Approved' : ((exp.claim?.status === 'Rejected' || exp.claim?.status === 'Rework') ? exp.claim.status : 'Pending Approval')));
    const isExpApproved = statusText === 'Approved' || exp.approved === true || ((exp.expense_type as any)?.approve_required === false);
    const isLockedInLedger = isConnectedToLedger && isAlreadyInBundle;
    const isSelectable = isLockedInLedger ? false : (isAlreadyInBundle || isExpApproved);

    if (!isSelectable) return;

    if (isSelected) {
      setEditBundleForm({
        ...editBundleForm,
        selectedExpenseIds: editBundleForm.selectedExpenseIds.filter(id => id !== exp.expense_id)
      });
    } else {
      setEditBundleForm({
        ...editBundleForm,
        selectedExpenseIds: [...editBundleForm.selectedExpenseIds, exp.expense_id]
      });
    }
  };

  const handleAddAllEligible = () => {
    const eligibleToAdd = filteredUnadded.filter(exp => {
      const isAlreadyInBundle = currentExpenses.some(c => c.expense_id === exp.expense_id);
      const statusText = (exp.expense_type && (exp.expense_type as any).approve_required === false)
        ? 'Approved'
        : (exp.status_display || (exp.approved ? 'Approved' : ((exp.claim?.status === 'Rejected' || exp.claim?.status === 'Rework') ? exp.claim.status : 'Pending Approval')));
      const isExpApproved = statusText === 'Approved' || exp.approved === true || ((exp.expense_type as any)?.approve_required === false);
      return isAlreadyInBundle || isExpApproved;
    }).map(e => e.expense_id);

    if (eligibleToAdd.length === 0) return;

    setEditBundleForm({
      ...editBundleForm,
      selectedExpenseIds: Array.from(new Set([...editBundleForm.selectedExpenseIds, ...eligibleToAdd]))
    });
  };

  const handleRemoveAllAdded = () => {
    // Cannot remove items locked in ledger
    const lockedIds = currentExpenses
      .filter(() => isConnectedToLedger)
      .map(exp => exp.expense_id);

    const idsToRemove = filteredAdded
      .filter(exp => !lockedIds.includes(exp.expense_id))
      .map(exp => exp.expense_id);

    if (idsToRemove.length === 0) return;

    setEditBundleForm({
      ...editBundleForm,
      selectedExpenseIds: editBundleForm.selectedExpenseIds.filter(id => !idsToRemove.includes(id))
    });
  };

  // Render individual expense card
  const renderExpenseCard = (exp: ExpenseItem, isAdded: boolean) => {
    const isAlreadyInBundle = currentExpenses.some(c => c.expense_id === exp.expense_id);
    const isSelected = editBundleForm.selectedExpenseIds.includes(exp.expense_id);

    const statusText = (exp.expense_type && (exp.expense_type as any).approve_required === false)
      ? 'Approved'
      : (exp.status_display || (exp.approved ? 'Approved' : ((exp.claim?.status === 'Rejected' || exp.claim?.status === 'Rework') ? exp.claim.status : 'Pending Approval')));

    const isExpApproved = statusText === 'Approved' || exp.approved === true || ((exp.expense_type as any)?.approve_required === false);
    const isLockedInLedger = isConnectedToLedger && isAlreadyInBundle;
    const isSelectable = isLockedInLedger ? false : (isAlreadyInBundle || isExpApproved);

    const cleanRemarks = (exp.remarks || '').split('\n').filter(l => !l.trim().match(/^\[.+?\]:/)).join('\n').trim();

    return (
      <div
        key={exp.expense_id}
        onClick={() => handleToggleExpense(exp)}
        className={`flex items-center justify-between p-2.5 sm:p-3 text-xs transition-all border-b border-outline-variant/40 last:border-b-0 ${
          !isSelectable
            ? 'bg-surface-container-low/50 opacity-65 cursor-not-allowed border-l-4 border-l-amber-500/40'
            : isAdded
              ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border-l-4 border-l-emerald-500 cursor-pointer'
              : 'hover:bg-surface-container/60 border-l-4 border-l-transparent cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 pr-2">
          <input
            type="checkbox"
            checked={isSelected}
            disabled={!isSelectable}
            onChange={() => handleToggleExpense(exp)}
            onClick={(e) => e.stopPropagation()}
            className={`rounded w-4 h-4 text-primary focus:ring-primary shrink-0 ${
              !isSelectable ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title={!isSelectable ? (isLockedInLedger ? 'Locked in ledger batch' : 'Needs approval before adding') : (isSelected ? 'Remove from bundle' : 'Add to bundle')}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-on-surface truncate">
                {exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || `Expense #${exp.expense_id}`}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant font-mono font-bold">
                #{exp.expense_id}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-auto sm:ml-0 font-mono">
                {parseFloat(exp.amount).toFixed(3)} KD
              </span>

              {/* Status Badges */}
              {isLockedInLedger && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/20 inline-flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> In Ledger
                </span>
              )}
              {isAlreadyInBundle && !isLockedInLedger && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">
                  In Bundle
                </span>
              )}
              {!isExpApproved && !isAlreadyInBundle && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20 inline-flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" /> Needs Approval
                </span>
              )}
              {isExpApproved && !isAlreadyInBundle && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 inline-flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-on-surface-variant truncate mt-0.5">
              <span>{exp.expense_date}</span>
              {exp.ticket_details?.work_order_no && (
                <span>• WO: <strong className="text-on-surface font-mono">{exp.ticket_details.work_order_no}</strong></span>
              )}
              {cleanRemarks && (
                <span className="truncate" title={cleanRemarks}>• {cleanRemarks}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Action Button */}
        <div className="shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
          {!isSelectable ? (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium italic">
              {isLockedInLedger ? 'Locked in Ledger' : 'Unapproved'}
            </span>
          ) : isAdded ? (
            <button
              type="button"
              onClick={() => handleToggleExpense(exp)}
              className="px-2.5 py-1 rounded border border-rose-500/40 text-rose-600 dark:text-rose-400 text-[10px] font-semibold hover:bg-rose-500/10 cursor-pointer transition-colors inline-flex items-center gap-1 shadow-2xs"
              title="Remove expense from this bundle"
            >
              <Minus className="w-3 h-3" />
              <span>Remove</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleToggleExpense(exp)}
              className="px-2.5 py-1 rounded bg-primary text-on-primary text-[10px] font-semibold hover:bg-primary/90 cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1 active:scale-95"
              title="Add expense to this bundle"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-surface-container rounded-xl border border-outline-variant/80 max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl text-on-surface relative overflow-hidden transition-all">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/80 px-4 py-3 shrink-0 bg-surface-container-high/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-on-surface tracking-tight">
                  Edit Bundle #{selectedBundleForEdit.claim_id}
                </h3>
                {isConnectedToLedger && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/20 inline-flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Ledger Linked
                  </span>
                )}
              </div>
              <div className="text-xs text-on-surface-variant font-normal">
                Technician: <strong className="text-on-surface font-semibold">{selectedBundleForEdit.worker_detail?.full_name || selectedBundleForEdit.worker_detail?.username || 'Technician'}</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedBundleForEdit(null)}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
          
          {/* Modal Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between shadow-2xs animate-in fade-in">
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

          {/* Remarks input */}
          <div>
            <label className="block font-semibold text-on-surface mb-1 text-xs">Remarks / Bundle Notes:</label>
            <textarea
              rows={2}
              value={editBundleForm.remarks}
              onChange={(e) => setEditBundleForm({ ...editBundleForm, remarks: e.target.value })}
              placeholder="Optional remarks or description for this bundle..."
              className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-xs rounded-lg p-2.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs hover:border-outline resize-none"
            />
          </div>

          {/* Search bar & View Filter Tabs */}
          <div className="pt-2 border-t border-outline-variant/70 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/70" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by ID, Category, WO#, Remarks, Amount..."
                  className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-xs rounded-lg pl-8 pr-8 py-2 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs hover:border-outline placeholder:text-on-surface-variant/50"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-0.5 rounded cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* View filter toggles */}
              <div className="flex items-center gap-1 bg-surface-container-low border border-outline-variant p-0.5 rounded-lg shrink-0 text-xs font-semibold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('all')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    activeFilterTab === 'all'
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  All ({combinedExpenses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('added')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeFilterTab === 'added'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span>Added</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeFilterTab === 'added' ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {addedExpenses.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('unadded')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeFilterTab === 'unadded'
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span>Available</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeFilterTab === 'unadded' ? 'bg-white/20 text-white' : 'bg-surface-container-high text-on-surface-variant'
                  }`}>
                    {unaddedExpenses.length}
                  </span>
                </button>
              </div>
            </div>

            {searchQuery && (
              <div className="text-[11px] text-on-surface-variant flex items-center justify-between px-1">
                <span>
                  Filtering by: "<strong className="text-on-surface">{searchQuery}</strong>"
                </span>
                <span className="font-semibold">
                  Found: {filteredAdded.length} added, {filteredUnadded.length} available
                </span>
              </div>
            )}
          </div>

          {/* SECTION 1: ADDED TIED EXPENSES */}
          {(activeFilterTab === 'all' || activeFilterTab === 'added') && (
            <div className="border border-emerald-500/30 rounded-xl overflow-hidden bg-surface-container-low shadow-xs">
              
              {/* Added Section Header */}
              <div className="bg-emerald-500/10 px-3.5 py-2.5 border-b border-emerald-500/20 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                  <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 tracking-wide uppercase">
                    Added to Bundle ({addedExpenses.length})
                  </h4>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                    • {addedTotal.toFixed(3)} KD
                  </span>
                </div>

                {filteredAdded.length > 0 && !isConnectedToLedger && (
                  <button
                    type="button"
                    onClick={handleRemoveAllAdded}
                    className="text-[10px] text-rose-600 dark:text-rose-400 hover:text-rose-700 font-semibold cursor-pointer transition-colors hover:underline"
                  >
                    Remove All ({filteredAdded.length})
                  </button>
                )}
              </div>

              {/* Added Expenses List */}
              <div className={`${activeFilterTab === 'added' ? 'max-h-96' : 'max-h-56'} overflow-y-auto divide-y divide-outline-variant/40 scrollbar-thin`}>
                {filteredAdded.length === 0 ? (
                  <div className="p-5 text-center text-xs text-on-surface-variant italic">
                    {searchQuery 
                      ? 'No added expenses match your search.'
                      : 'No expenses added to this bundle yet. Select from the available expenses below.'}
                  </div>
                ) : (
                  filteredAdded.map(exp => renderExpenseCard(exp, true))
                )}
              </div>
            </div>
          )}

          {/* SECTION 2: UNADDED / AVAILABLE EXPENSES */}
          {(activeFilterTab === 'all' || activeFilterTab === 'unadded') && (
            <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-low shadow-xs">
              
              {/* Unadded Section Header */}
              <div className="bg-surface-container-high/60 px-3.5 py-2.5 border-b border-outline-variant flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Plus className="w-3 h-3 stroke-[3]" />
                  </span>
                  <h4 className="text-xs font-bold text-on-surface tracking-wide uppercase">
                    Available Unadded Expenses ({unaddedExpenses.length})
                  </h4>
                  <span className="text-xs font-bold text-on-surface-variant font-mono">
                    • {unaddedTotal.toFixed(3)} KD
                  </span>
                </div>

                {filteredUnadded.some(e => e.approved || (e.expense_type as any)?.approve_required === false) && (
                  <button
                    type="button"
                    onClick={handleAddAllEligible}
                    className="text-[10px] text-primary hover:text-primary/80 font-semibold cursor-pointer transition-colors hover:underline"
                  >
                    + Add All Eligible
                  </button>
                )}
              </div>

              {/* Unadded Expenses List */}
              <div className={`${activeFilterTab === 'unadded' ? 'max-h-96' : 'max-h-56'} overflow-y-auto divide-y divide-outline-variant/40 scrollbar-thin`}>
                {filteredUnadded.length === 0 ? (
                  <div className="p-5 text-center text-xs text-on-surface-variant italic">
                    {searchQuery 
                      ? 'No available expenses match your search.'
                      : 'No unclaimed expenses available for this technician.'}
                  </div>
                ) : (
                  filteredUnadded.map(exp => renderExpenseCard(exp, false))
                )}
              </div>
            </div>
          )}

        </div>

        {/* Fixed Modal Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-outline-variant/80 bg-surface-container-high/30 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-variant">
              Bundle Total:
            </span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {addedTotal.toFixed(3)} KD
            </span>
            <span className="text-xs text-on-surface-variant hidden sm:inline">
              ({addedExpenses.length} {addedExpenses.length === 1 ? 'expense' : 'expenses'})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedBundleForEdit(null)}
              className="px-3.5 py-1.5 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveUpdateBundle}
              disabled={submitting || editBundleForm.selectedExpenseIds.length === 0}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-all cursor-pointer shadow-md hover:shadow-primary/25 active:scale-[0.98]"
            >
              {submitting ? 'Saving Changes...' : 'Save Bundle Changes'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
