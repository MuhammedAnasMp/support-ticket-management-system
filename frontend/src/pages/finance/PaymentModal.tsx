import React, { useEffect } from 'react';
import { X, Banknote, Loader2, AlertCircle, Package, Layers, Calendar, User, DollarSign } from 'lucide-react';
import type { PaymentItem, WorkerClaimItem, LedgerItem } from './types';
import { formatDateDMY } from './types';
import { SearchableSelect } from '../../components/SearchableSelect';

interface PaymentModalProps {
  showPaymentModal: PaymentItem | WorkerClaimItem | LedgerItem | null;
  setShowPaymentModal: (item: PaymentItem | WorkerClaimItem | LedgerItem | null) => void;
  paymentMethod: string;
  setPaymentMethod: (m: string) => void;
  paymentAmount: string;
  setPaymentAmount: (a: string) => void;
  paymentRef: string;
  setPaymentRef: (r: string) => void;
  paymentRemarks: string;
  setPaymentRemarks: (rem: string) => void;
  paymentRecipient: string;
  setPaymentRecipient: (rec: string) => void;
  handleProcessPayment: () => Promise<void>;
  submitting: boolean;
  errorMessage?: string | null;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  showPaymentModal,
  setShowPaymentModal,
  paymentMethod,
  setPaymentMethod,
  paymentAmount,
  setPaymentAmount,
  paymentRef,
  setPaymentRef,
  paymentRemarks,
  setPaymentRemarks,
  paymentRecipient,
  setPaymentRecipient,
  handleProcessPayment,
  submitting,
  errorMessage,
}) => {
  if (!showPaymentModal) return null;

  const isClaim = 'claim_id' in showPaymentModal;
  const isLedger = 'ledger_id' in showPaymentModal;

  const claimItem = isClaim ? (showPaymentModal as WorkerClaimItem) : null;
  const ledgerItem = isLedger ? (showPaymentModal as LedgerItem) : null;

  const targetAmount = parseFloat(
    (isClaim
      ? claimItem?.total_claimed_amount
      : isLedger
      ? ledgerItem?.total_amount
      : (showPaymentModal as PaymentItem)?.amount_paid) || '0'
  );

  // Automatically initialize default values when opened
  useEffect(() => {
    if (claimItem) {
      const defaultName =
        claimItem.worker_detail?.full_name ||
        claimItem.worker_detail?.username ||
        (claimItem as any).worker_name ||
        '';
      if (!paymentRecipient) setPaymentRecipient(defaultName);
      if (!paymentAmount) setPaymentAmount(parseFloat(claimItem.total_claimed_amount || '0').toFixed(3));
    } else if (ledgerItem) {
      const defaultName =
        ledgerItem.ledger_group_detail?.recipient_name ||
        (ledgerItem as any).created_by_detail?.full_name ||
        (ledgerItem as any).created_by_detail?.username ||
        (ledgerItem as any).created_by_name ||
        '';
      if (!paymentRecipient) setPaymentRecipient(defaultName);
      if (!paymentAmount) setPaymentAmount(parseFloat(ledgerItem.total_amount || '0').toFixed(3));
    }
  }, [claimItem?.claim_id, ledgerItem?.ledger_id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container rounded-xl border border-outline-variant max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/25">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface">
                {isClaim
                  ? `Cash Settlement: Bundle #${claimItem?.claim_id}`
                  : isLedger
                  ? `Cash Settlement: Ledger #${ledgerItem?.ledger_id}`
                  : `Disbursement Payment`}
              </h3>
              <p className="text-[11px] text-on-surface-variant font-medium">
                {isClaim
                  ? 'Disburse payment for this approved worker claim bundle'
                  : isLedger
                  ? 'Disburse payment for this approved ledger and its attached bundles'
                  : 'Record payment transaction details'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowPaymentModal(null)}
            disabled={submitting}
            className="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Details Summary Box */}
        <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isClaim ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Package className="w-3.5 h-3.5" />
                  <span>Bundle {claimItem?.claim_id}</span>
                </div>
              ) : isLedger ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Layers className="w-3.5 h-3.5" />
                  <span>{ledgerItem?.ledger_group_detail?.group_name || `Ledger #${ledgerItem?.ledger_id}`}</span>
                </div>
              ) : null}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/30">
                Approved
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-on-surface-variant uppercase font-medium">Payable Total: </span>
              <span className="text-sm font-extrabold text-teal-600 dark:text-teal-400">
                KD {targetAmount.toFixed(3)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-outline-variant/60 text-xs">
            {isClaim && (
              <>
                <div>
                  <div className="text-[10px] text-on-surface-variant font-medium">Worker</div>
                  <div className="text-xs font-bold text-on-surface truncate">
                    {claimItem?.worker_detail?.full_name || claimItem?.worker_detail?.username || 'Worker'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-on-surface-variant font-medium">Claim Date</div>
                  <div className="text-xs font-semibold text-on-surface">
                    {formatDateDMY(claimItem?.claim_date)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-on-surface-variant font-medium">Expenses</div>
                  <div className="text-xs font-semibold text-on-surface">
                    {claimItem?.expenses?.length || 0} exp
                  </div>
                </div>
              </>
            )}

            {isLedger && (
              <>
                <div>
                  <div className="text-[10px] text-on-surface-variant font-medium">Group</div>
                  <div className="text-xs font-bold text-on-surface truncate">
                    {ledgerItem?.ledger_group_detail?.group_name || 'Independent'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-on-surface-variant font-medium">Bundles</div>
                  <div className="text-xs font-semibold text-on-surface">
                    {ledgerItem?.bundles?.length || 0} bundles
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-on-surface-variant font-medium">Expenses</div>
                  <div className="text-xs font-semibold text-on-surface">
                    {ledgerItem?.expenses?.length || 0} exp
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Form Inputs */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-on-surface mb-1">
              Recipient Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Technician / Worker / Site Engineer name..."
              value={paymentRecipient}
              onChange={(e) => setPaymentRecipient(e.target.value)}
              className="w-full bg-surface-container-low border border-outline text-on-surface rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-on-surface mb-1">Payment Method</label>
              <SearchableSelect
                value={paymentMethod}
                onChange={(val) => setPaymentMethod(val)}
                options={[
                  { value: 'Cash', label: 'Cash' },
                  { value: 'Bank Transfer', label: 'Bank Transfer' },
                  { value: 'Check', label: 'Check' },
                  { value: 'Digital Wallet', label: 'Digital Wallet' },
                  { value: 'Other', label: 'Other' },
                ]}
                placeholder="Select Payment Method"
              />
            </div>

            <div>
              <label className="block font-semibold text-on-surface mb-1">Amount Paid (KD)</label>
              <input
                type="number"
                step="0.001"
                value={paymentAmount || targetAmount.toFixed(3)}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full bg-surface-container-low border border-outline text-on-surface rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none font-bold text-teal-600 dark:text-teal-400"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-on-surface mb-1">Transaction Reference / Voucher No.</label>
            <input
              type="text"
              placeholder="e.g. TRX-987654 / Voucher #123 (Optional)"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              className="w-full bg-surface-container-low border border-outline text-on-surface rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-on-surface mb-1">Settlement Notes / Remarks</label>
            <textarea
              value={paymentRemarks}
              onChange={(e) => setPaymentRemarks(e.target.value)}
              placeholder="Disbursement details or handover remarks..."
              className="w-full bg-surface-container-low border border-outline text-on-surface rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none h-16 resize-none"
            />
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant">
          <button
            type="button"
            onClick={() => setShowPaymentModal(null)}
            disabled={submitting}
            className="px-4 py-2 rounded-lg border border-outline text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleProcessPayment}
            disabled={submitting || !paymentRecipient.trim()}
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing Settlement...</span>
              </>
            ) : (
              <>
                <Banknote className="w-3.5 h-3.5" />
                <span>Confirm Settlement</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
