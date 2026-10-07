import React from 'react';
import { X, Layers, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
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
  if (!selectedBundleForEdit) return null;

  const currentExpenses = selectedBundleForEdit.expenses || [];
  const targetWorkerId = getUserId((selectedBundleForEdit as any).worker) ?? getUserId(selectedBundleForEdit.worker_detail);

  // Combine current expenses in bundle with unclaimed expenses of this worker
  const availableForWorker = unclaimedExpenses.filter(e => {
    const expWorkerId = getUserId(e.worker) ?? getUserId(e.worker_detail);
    return targetWorkerId !== null && expWorkerId !== null && targetWorkerId === expWorkerId;
  });

  const combinedExpenses = Array.from(
    new Map([...currentExpenses, ...availableForWorker].map(e => [e.expense_id, e])).values()
  );

  const isConnectedToLedger = Boolean(selectedBundleForEdit.ledger_details || (selectedBundleForEdit as any).ledger_id);

  const updatedTotal = combinedExpenses
    .filter(e => editBundleForm.selectedExpenseIds.includes(e.expense_id))
    .reduce((acc, curr) => acc + parseFloat(curr.amount || '0'), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-surface-container rounded border border-outline-variant/80 max-w-xl w-full p-6 sm:p-7 space-y-5 shadow-2xl text-on-surface relative overflow-hidden transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/80 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface tracking-tight">
                Edit Claim Bundle #{selectedBundleForEdit.claim_id}
              </h3>
              <p className="text-xs text-on-surface-variant font-normal mt-0.5">
                Adjust billing period, remarks, or tied expense line items
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedBundleForEdit(null)}
            className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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



        <div>
          <label className="block font-semibold text-on-surface mb-1.5 text-xs">Remarks / Notes:</label>
          <textarea
            rows={2}
            value={editBundleForm.remarks}
            onChange={(e) => setEditBundleForm({ ...editBundleForm, remarks: e.target.value })}
            placeholder="Optional remarks for this bundle..."
            className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-xs rounded-xl p-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs hover:border-outline resize-none"
          />
        </div>

        {/* Expenses List */}
        <div className="space-y-3 pt-2 border-t border-outline-variant/80">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface">
              Add or Remove Tied Expenses ({combinedExpenses.length})
            </h4>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Updated Total: ${updatedTotal.toFixed(2)}
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto border border-outline-variant/80 rounded-xl divide-y divide-outline-variant/60 bg-surface-container-low scrollbar-thin shadow-2xs">
            {combinedExpenses.length === 0 ? (
              <div className="p-6 text-center text-xs text-on-surface-variant italic">
                No expenses found for this worker.
              </div>
            ) : (
              combinedExpenses.map((exp) => {
                const isAlreadyInBundle = currentExpenses.some(c => c.expense_id === exp.expense_id);
                const isSelected = editBundleForm.selectedExpenseIds.includes(exp.expense_id);

                const statusText = (exp.expense_type && (exp.expense_type as any).approve_required === false)
                  ? 'Approved'
                  : (exp.status_display || (exp.approved ? 'Approved' : ((exp.claim?.status === 'Rejected' || exp.claim?.status === 'Rework') ? exp.claim.status : 'Pending Approval')));

                const isExpApproved = statusText === 'Approved' || exp.approved === true || ((exp.expense_type as any)?.approve_required === false);

                // Expenses already in the bundle cannot be removed if bundle is attached to a ledger batch.
                // Unclaimed expenses MUST be approved before they can be added.
                const isLockedInLedger = isConnectedToLedger && isAlreadyInBundle;
                const isSelectable = isLockedInLedger ? false : (isAlreadyInBundle || isExpApproved);

                return (
                  <div
                    key={exp.expense_id}
                    onClick={() => {
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
                    }}
                    className={`flex items-center justify-between p-3 text-xs transition-colors ${!isSelectable
                      ? 'bg-surface-container-low/60 opacity-60 cursor-not-allowed border-l-4 border-l-amber-500/40'
                      : isSelected
                        ? 'bg-primary/10 border-l-4 border-l-primary font-medium cursor-pointer hover:bg-primary/15'
                        : 'cursor-pointer hover:bg-surface-container'
                      }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!isSelectable}
                        onChange={() => { }}
                        className={`rounded w-4 h-4 text-primary focus:ring-primary ${!isSelectable ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        title={!isSelectable ? 'Unapproved expense - Approval required before adding to bundle' : 'Select expense'}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-semibold ${!isSelectable ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                            {exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || `Expense #${exp.expense_id}`}
                          </p>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            ${parseFloat(exp.amount).toFixed(2)}
                          </span>

                          {/* Status Badges */}
                          {isAlreadyInBundle && (
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
                        <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
                          Date: {exp.expense_date} {exp.ticket_details?.work_order_no ? `• WO: ${exp.ticket_details.work_order_no}` : ''} {exp.remarks ? `• ${exp.remarks}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {!isSelectable ? (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium italic">
                          {isLockedInLedger ? 'In Ledger Batch' : 'Unapproved'}
                        </span>
                      ) : isSelected ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditBundleForm({
                              ...editBundleForm,
                              selectedExpenseIds: editBundleForm.selectedExpenseIds.filter(id => id !== exp.expense_id)
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg border border-rose-500/40 text-rose-600 dark:text-rose-400 text-[10px] font-semibold hover:bg-rose-500/10 cursor-pointer transition-colors"
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditBundleForm({
                              ...editBundleForm,
                              selectedExpenseIds: [...editBundleForm.selectedExpenseIds, exp.expense_id]
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[10px] font-semibold hover:bg-primary/90 cursor-pointer transition-colors shadow-xs"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/80">
          <button
            onClick={() => setSelectedBundleForEdit(null)}
            className="px-4 py-2 rounded-xl border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveUpdateBundle}
            disabled={submitting || editBundleForm.selectedExpenseIds.length === 0}
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-all cursor-pointer shadow-md hover:shadow-primary/25 active:scale-[0.98]"
          >
            {submitting ? 'Saving Changes...' : 'Save Bundle Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
