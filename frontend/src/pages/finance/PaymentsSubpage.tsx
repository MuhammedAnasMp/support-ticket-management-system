import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import type { PaymentItem, AuditEventItem, WorkerClaimItem, LedgerItem } from './types';
import { Pagination } from './Pagination';
import { SearchableSelect, type SelectOption } from '../../components/SearchableSelect';

interface PaymentsSubpageProps {
  filteredPayments: PaymentItem[];
  payments: PaymentItem[];
  auditEvents: AuditEventItem[];
  showPaymentModal: PaymentItem | WorkerClaimItem | LedgerItem | null;
  setShowPaymentModal: (item: PaymentItem | WorkerClaimItem | LedgerItem | null) => void;
  paymentMethod: string;
  setPaymentMethod: (val: string) => void;
  paymentAmount: string;
  setPaymentAmount: (val: string) => void;
  paymentRef: string;
  setPaymentRef: (val: string) => void;
  paymentRemarks: string;
  setPaymentRemarks: (val: string) => void;
  handleProcessPayment: () => void;
  submitting: boolean;
}

export const PaymentsSubpage: React.FC<PaymentsSubpageProps> = ({
  filteredPayments,
  payments,
  auditEvents,
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
  handleProcessPayment,
  submitting,
}) => {
  // Pagination State for Payments Table
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPerPage, setPaymentsPerPage] = useState(10);

  // Pagination State for Audit Events Table
  const [auditsPage, setAuditsPage] = useState(1);
  const [auditsPerPage, setAuditsPerPage] = useState(10);

  useEffect(() => {
    setPaymentsPage(1);
  }, [filteredPayments.length]);

  useEffect(() => {
    setAuditsPage(1);
  }, [auditEvents.length]);

  const paginatedPayments = useMemo(() => {
    const start = (paymentsPage - 1) * paymentsPerPage;
    return filteredPayments.slice(start, start + paymentsPerPage);
  }, [filteredPayments, paymentsPage, paymentsPerPage]);

  const paginatedAudits = useMemo(() => {
    const start = (auditsPage - 1) * auditsPerPage;
    return auditEvents.slice(start, start + auditsPerPage);
  }, [auditEvents, auditsPage, auditsPerPage]);

  return (
    <div className="space-y-6">
      {/* Recorded Payments */}
      <div className="border border-outline-variant rounded overflow-hidden bg-surface-container flex flex-col">
        <div className="p-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
          <span className="text-xs font-semibold text-on-surface">Payment & Settlement Register</span>
          <span className="text-xs text-on-surface-variant font-medium">Showing {filteredPayments.length} of {payments.length}</span>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="p-8 text-center text-xs text-on-surface-variant">No disbursement payments match filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs text-left text-on-surface">
                <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-wider border-b border-outline-variant">
                  <tr>
                    <th className="px-4 py-3">Payment ID</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3 text-right">Amount (KD)</th>
                    <th className="px-4 py-3">Disbursed By</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {paginatedPayments.map((p) => (
                    <tr key={p.payment_id} className="hover:bg-surface-container-high transition-colors">
                      <td className="px-4 py-3  font-medium">{p.payment_id}</td>
                      <td className="px-4 py-3 font-medium">{p.payment_method}</td>
                      <td className="px-4 py-3  text-[11px] text-on-surface-variant">{p.transaction_reference || '-'}</td>
                      <td className="px-4 py-3  text-primary font-medium">
                        {p.claim ? `Bundle ${p.claim}` : p.ledger ? `Ledger ${p.ledger}` : 'Expense'}
                      </td>
                      <td className="px-4 py-3 text-right  font-semibold text-emerald-600 dark:text-emerald-400">
                        {parseFloat(p.amount_paid).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">{p.paid_by_username || 'System'}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{new Date(p.paid_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={paymentsPage}
              totalItems={filteredPayments.length}
              itemsPerPage={paymentsPerPage}
              onPageChange={setPaymentsPage}
              onItemsPerPageChange={(num) => {
                setPaymentsPerPage(num);
                setPaymentsPage(1);
              }}
            />
          </>
        )}
      </div>

      {/* Immutable Audit Log */}
      <div className="border border-outline-variant rounded overflow-hidden bg-surface-container flex flex-col">
        <div className="p-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-on-surface">Immutable System Audit Trail</span>
          </div>
          <span className="text-[10px] text-on-surface-variant ">Read-Only Logs ({auditEvents.length})</span>
        </div>

        {auditEvents.length === 0 ? (
          <div className="p-8 text-center text-xs text-on-surface-variant">No audit events logged yet.</div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs text-left text-on-surface">
                <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-wider border-b border-outline-variant">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Entity ID</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant  text-[11px]">
                  {paginatedAudits.map((evt) => (
                    <tr key={evt.event_id} className="hover:bg-surface-container-high transition-colors">
                      <td className="px-4 py-3 text-on-surface-variant">{new Date(evt.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-on-surface">{evt.entity_name}</td>
                      <td className="px-4 py-3">{evt.entity_id}</td>
                      <td className="px-4 py-3 text-primary font-semibold">{evt.action}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{evt.actor_username || 'System'}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{evt.ip_address || '127.0.0.1'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={auditsPage}
              totalItems={auditEvents.length}
              itemsPerPage={auditsPerPage}
              onPageChange={setAuditsPage}
              onItemsPerPageChange={(num) => {
                setAuditsPerPage(num);
                setAuditsPage(1);
              }}
            />
          </>
        )}
      </div>

      {/* MODAL: RECORD PAYMENT & SETTLEMENT */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface-container rounded border border-outline-variant max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="text-sm font-semibold text-on-surface">
                Record Payment & Settlement ({'claim_id' in showPaymentModal ? `Bundle ${showPaymentModal.claim_id}` : 'ledger_id' in showPaymentModal ? `Ledger ${showPaymentModal.ledger_id}` : `Payment ${showPaymentModal.payment_id}`})
              </h3>
              <button onClick={() => setShowPaymentModal(null)}><X className="w-4 h-4 text-on-surface-variant" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-on-surface-variant mb-1">Payment Method</label>
                <SearchableSelect
                  value={paymentMethod}
                  onChange={(val) => setPaymentMethod(val)}
                  options={[
                    { value: 'Bank Transfer', label: 'Bank Transfer' },
                    { value: 'Cash', label: 'Cash' },
                    { value: 'Check', label: 'Check' },
                    { value: 'Mobile Money', label: 'Mobile Money' },
                  ]}
                  placeholder="Select Payment Method"
                />
              </div>

              <div>
                <label className="block font-medium text-on-surface-variant mb-1">Amount Paid (KD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount || ('total_claimed_amount' in showPaymentModal ? showPaymentModal.total_claimed_amount : 'total_amount' in showPaymentModal ? showPaymentModal.total_amount : showPaymentModal.amount_paid)}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-surface-container border border-outline text-on-surface rounded p-2 "
                />
              </div>

              <div>
                <label className="block font-medium text-on-surface-variant mb-1">Transaction Reference / Ref No.</label>
                <input
                  type="text"
                  placeholder="e.g. TRX-987654"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full bg-surface-container border border-outline text-on-surface rounded p-2"
                />
              </div>

              <div>
                <label className="block font-medium text-on-surface-variant mb-1">Payment Notes / Remarks</label>
                <textarea
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  placeholder="Disbursement notes..."
                  className="w-full bg-surface-container border border-outline text-on-surface rounded p-2 h-16"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
              <button onClick={() => setShowPaymentModal(null)} className="px-3 py-1.5 rounded border border-outline text-xs text-on-surface">Cancel</button>
              <button
                onClick={handleProcessPayment}
                disabled={submitting}
                className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Confirm Settlement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
