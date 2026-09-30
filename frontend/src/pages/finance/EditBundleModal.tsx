import React from 'react';
import { X, Layers, PlusCircle } from 'lucide-react';
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
}

export const EditBundleModal: React.FC<EditBundleModalProps> = ({
  selectedBundleForEdit,
  setSelectedBundleForEdit,
  editBundleForm,
  setEditBundleForm,
  unclaimedExpenses,
  submitting,
  handleSaveUpdateBundle
}) => {
  if (!selectedBundleForEdit) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-surface-container rounded-2xl border border-outline-variant/80 max-w-xl w-full p-6 sm:p-7 space-y-5 shadow-2xl text-on-surface relative overflow-hidden transition-all">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div>
            <label className="block font-semibold text-on-surface mb-1.5">Period From:</label>
            <input
              type="date"
              value={editBundleForm.period_from}
              onChange={(e) => setEditBundleForm({ ...editBundleForm, period_from: e.target.value })}
              className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs hover:border-outline cursor-pointer"
            />
          </div>
          <div>
            <label className="block font-semibold text-on-surface mb-1.5">Period To:</label>
            <input
              type="date"
              value={editBundleForm.period_to}
              onChange={(e) => setEditBundleForm({ ...editBundleForm, period_to: e.target.value })}
              className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs hover:border-outline cursor-pointer"
            />
          </div>
        </div>

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

        <div className="space-y-3 pt-2 border-t border-outline-variant/80">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface">Add or Remove Tied Expenses</h4>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Updated Total: {
                (() => {
                  const currentExpenses = selectedBundleForEdit.expenses || [];
                  const targetWorkerId = getUserId((selectedBundleForEdit as any).worker) ?? getUserId(selectedBundleForEdit.worker_detail);
                  const availableForWorker = unclaimedExpenses.filter(e => {
                    const isApproved = e.approved === true || ((e.expense_type as any)?.approve_required === false);
                    if (!isApproved) return false;
                    const expWorkerId = getUserId(e.worker) ?? getUserId(e.worker_detail);
                    return targetWorkerId !== null && expWorkerId !== null && targetWorkerId === expWorkerId;
                  });
                  const combined = Array.from(new Map([...currentExpenses, ...availableForWorker].map(e => [e.expense_id, e])).values());
                  const sumAmt = combined
                    .filter(e => editBundleForm.selectedExpenseIds.includes(e.expense_id))
                    .reduce((acc, curr) => acc + parseFloat(curr.amount || '0'), 0);
                  return sumAmt.toFixed(2);
                })()
              }
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto border border-outline-variant/80 rounded-xl divide-y divide-outline-variant/60 bg-surface-container-low scrollbar-thin shadow-2xs">
            {(() => {
              const currentExpenses = selectedBundleForEdit.expenses || [];
              const targetWorkerId = getUserId((selectedBundleForEdit as any).worker) ?? getUserId(selectedBundleForEdit.worker_detail);
              const availableForWorker = unclaimedExpenses.filter(e => {
                const isApproved = e.approved === true || ((e.expense_type as any)?.approve_required === false);
                if (!isApproved) return false;
                const expWorkerId = getUserId(e.worker) ?? getUserId(e.worker_detail);
                return targetWorkerId !== null && expWorkerId !== null && targetWorkerId === expWorkerId;
              });
              const combined = Array.from(new Map([...currentExpenses, ...availableForWorker].map(e => [e.expense_id, e])).values());

              if (combined.length === 0) {
                return (
                  <div className="p-6 text-center text-xs text-on-surface-variant">
                    No eligible expenses found for this worker.
                  </div>
                );
              }

              return combined.map((exp) => {
                const isSelected = editBundleForm.selectedExpenseIds.includes(exp.expense_id);
                const isAlreadyInBundle = currentExpenses.some(c => c.expense_id === exp.expense_id);

                return (
                  <div
                    key={exp.expense_id}
                    onClick={() => {
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
                    className={`flex items-center justify-between p-3 text-xs cursor-pointer hover:bg-surface-container transition-colors ${isSelected ? 'bg-primary/10 border-l-4 border-l-primary font-medium' : ''
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => { }}
                        className="text-primary focus:ring-primary rounded cursor-pointer w-4 h-4"
                      />
                      <div>
                        <p className="font-semibold text-on-surface">
                          {exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || `Expense #${exp.expense_id}`} - <span className="text-emerald-600 dark:text-emerald-400 font-bold">${parseFloat(exp.amount).toFixed(2)}</span>
                        </p>
                        <p className="text-[10px] text-on-surface-variant">
                          Date: {exp.expense_date} {exp.ticket_details?.work_order_no ? `• WO: ${exp.ticket_details.work_order_no}` : ''} {exp.remarks ? `• ${exp.remarks}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAlreadyInBundle && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">In Bundle</span>
                      )}
                      {isSelected ? (
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
              });
            })()}
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
