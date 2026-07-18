import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, CheckCircle2, XCircle, Clock, Trash2, Edit2, Plus,
  FileText, DollarSign, X, Loader2, AlertCircle, Eye
} from 'lucide-react';
import type { RootState } from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const ExpensesView: React.FC = () => {
  const { subpage } = useParams<{ subpage: string }>();
  const { token, user } = useSelector((state: RootState) => state.auth);

  // States
  const [data, setData] = useState<any[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);

  // Approval remarks popup
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [remarksForm, setRemarksForm] = useState('');
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);

  // Form fields for expense types
  const [typeForm, setTypeForm] = useState({
    expense_name: '',
    parent: ''
  });

  useEffect(() => {
    fetchData();
  }, [subpage, token]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = { Authorization: `Token ${token}` };

      // Fetch expense types for select list
      const resTypes = await fetch(`${API_URL}/finance/expensetype/`, { headers });
      if (resTypes.ok) setExpenseTypes(await resTypes.json());

      if (subpage === 'types') {
        if (resTypes.ok) setData(await resTypes.json());
      } else {
        // Claims pages: pending, approved, rejected
        const res = await fetch(`${API_URL}/finance/expense/`, { headers });
        if (res.ok) {
          const claims = await res.json();
          // Filter based on status
          if (subpage === 'pending' || !subpage) {
            setData(claims.filter((c: any) => c.approved === null || c.approved === undefined));
          } else if (subpage === 'approved') {
            setData(claims.filter((c: any) => c.approved === true));
          } else if (subpage === 'rejected') {
            setData(claims.filter((c: any) => c.approved === false));
          }
        }
      }
    } catch (err) {
      setErrorMsg('Failed to load expense records.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateType = () => {
    setEditItem(null);
    setTypeForm({ expense_name: '', parent: '' });
    setShowModal(true);
  };

  const handleOpenEditType = (item: any) => {
    setEditItem(item);
    setTypeForm({
      expense_name: item.expense_name,
      parent: item.parent?.expense_type_id || item.parent || ''
    });
    setShowModal(true);
  };

  const handleSubmitType = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg('');

    const endpoint = editItem ? `${API_URL}/finance/expensetype/${editItem.expense_type_id}/` : `${API_URL}/finance/expensetype/`;
    const method = editItem ? 'PATCH' : 'POST';
    const bodyData = { ...typeForm };
    if (!bodyData.parent) delete bodyData.parent;

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyData)
      });
      if (response.ok) {
        setShowModal(false);
        fetchData();
      } else {
        const errorRes = await response.json();
        setErrorMsg(Object.values(errorRes).flat().join(', ') || 'Failed to save expense type.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteType = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this expense category?')) return;
    setErrorMsg('');
    const endpoint = `${API_URL}/finance/expensetype/${id}/`;

    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` }
      });
      if (response.ok) {
        fetchData();
      } else {
        setErrorMsg('Failed to delete expense type.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    }
  };

  const handleClaimApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim || !approvalAction) return;
    setActionLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch(`${API_URL}/finance/expense/${selectedClaim.expense_id}/`, {
        method: 'PATCH',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          approved: approvalAction === 'approve',
          approved_by: user?.user_id,
          remarks: remarksForm
        })
      });
      if (response.ok) {
        setSelectedClaim(null);
        setRemarksForm('');
        setApprovalAction(null);
        fetchData();
      } else {
        setErrorMsg('Failed to submit approval update.');
      }
    } catch (err) {
      setErrorMsg('Network connection issue.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredData = data.filter(item => {
    const text = (item.expense_name || item.remarks || item.worker?.full_name || item.ticket?.work_order_no || '').toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input
            type="text"
            placeholder="Search claims, expense categories..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
          />
        </div>

        {subpage === 'types' && (
          <button
            onClick={handleOpenCreateType}
            className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-primary/95 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Expense Type
          </button>
        )}
      </div>

      {/* Expense Listing Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 w-full bg-surface-container-high dark:bg-dark-surface-container-low animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high dark:bg-dark-surface-container-high border-b border-outline-variant dark:border-dark-outline-variant text-[10px] uppercase font-bold text-outline tracking-wider">
                  {subpage === 'types' ? (
                    <>
                      <th className="px-6 py-4">Category ID</th>
                      <th className="px-6 py-4">Expense Category Name</th>
                      <th className="px-6 py-4">Parent Category</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4">Ticket WO #</th>
                      <th className="px-6 py-4">Claimant (Worker)</th>
                      <th className="px-6 py-4">Expense Category</th>
                      <th className="px-6 py-4">KWD Amount</th>
                      <th className="px-6 py-4">Claim Date</th>
                      <th className="px-6 py-4">Receipt</th>
                      <th className="px-6 py-4">Remarks</th>
                      <th className="px-6 py-4 text-right">Review</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant dark:divide-dark-outline-variant text-sm">
                {filteredData.map(item => (
                  <tr key={item.expense_type_id || item.expense_id} className="hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low transition-all">
                    {subpage === 'types' ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.expense_type_id}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.expense_name}</td>
                        <td className="px-6 py-4">{item.parent?.expense_name || 'Top Level'}</td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => handleOpenEditType(item)}
                            className="p-1.5 inline-flex bg-surface-container-high dark:bg-dark-surface-container-high text-outline hover:text-primary rounded-lg border border-outline-variant dark:border-dark-outline-variant cursor-pointer transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteType(item.expense_type_id)}
                            className="p-1.5 inline-flex bg-surface-container-high dark:bg-dark-surface-container-high text-outline hover:text-red-500 rounded-lg border border-outline-variant dark:border-dark-outline-variant cursor-pointer transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.ticket?.work_order_no || 'N/A'}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.worker?.full_name}</td>
                        <td className="px-6 py-4">{item.expense_type?.expense_name}</td>
                        <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">{item.amount} KWD</td>
                        <td className="px-6 py-4 text-xs text-outline">{item.expense_date}</td>
                        <td className="px-6 py-4">
                          {item.receipt ? (
                            <a href={item.receipt.file_url || item.receipt} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1 font-semibold">
                              <Eye className="w-3.5 h-3.5" />
                              View Attachment
                            </a>
                          ) : <span className="text-xs text-outline">No Receipt</span>}
                        </td>
                        <td className="px-6 py-4 text-xs text-outline max-w-[150px] truncate">{item.remarks || 'No remarks'}</td>
                        <td className="px-6 py-4 text-right">
                          {subpage === 'pending' || !subpage ? (
                            <div className="inline-flex gap-1">
                              <button
                                onClick={() => { setSelectedClaim(item); setApprovalAction('approve'); }}
                                className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-lg transition-all cursor-pointer"
                                title="Approve Claim"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setSelectedClaim(item); setApprovalAction('reject'); }}
                                className="p-1.5 bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-600 rounded-lg transition-all cursor-pointer"
                                title="Reject Claim"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              item.approved ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                            }`}>
                              {item.approved ? 'Approved' : 'Rejected'}
                            </span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expense Type Form Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md overflow-y-auto rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant dark:border-dark-outline-variant">
                <h3 className="text-base font-bold text-on-surface dark:text-dark-on-surface">
                  {editItem ? 'Edit Expense Type' : 'Create Expense Type'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg text-outline hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitType} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1">Expense Type Name</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Spare Parts"
                    value={typeForm.expense_name}
                    onChange={e => setTypeForm({ ...typeForm, expense_name: e.target.value })}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-outline mb-1">Parent Category</label>
                  <select
                    value={typeForm.parent}
                    onChange={e => setTypeForm({ ...typeForm, parent: e.target.value })}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                  >
                    <option value="">No Parent (Top Level)</option>
                    {expenseTypes.map(et => <option key={et.expense_type_id} value={et.expense_type_id}>{et.expense_name}</option>)}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant dark:border-dark-outline-variant">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/95 flex items-center gap-1.5"
                  >
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Category
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Claim Review Modal */}
      <AnimatePresence>
        {selectedClaim && approvalAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedClaim(null); setApprovalAction(null); }}
              className="absolute inset-0 bg-black"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md overflow-y-auto rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant dark:border-dark-outline-variant">
                <h3 className="text-base font-bold text-on-surface dark:text-dark-on-surface capitalize">
                  {approvalAction} Expense Claim
                </h3>
                <button
                  onClick={() => { setSelectedClaim(null); setApprovalAction(null); }}
                  className="p-1 rounded-lg text-outline hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-surface dark:bg-dark-surface rounded-xl space-y-2 text-xs">
                <p><span className="text-outline">Claimant:</span> <span className="font-semibold text-on-surface dark:text-dark-on-surface">{selectedClaim.worker?.full_name}</span></p>
                <p><span className="text-outline">Amount:</span> <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedClaim.amount} KWD</span></p>
                <p><span className="text-outline">Category:</span> <span className="font-medium">{selectedClaim.expense_type?.expense_name}</span></p>
                {selectedClaim.remarks && <p><span className="text-outline">Remarks:</span> <span>{selectedClaim.remarks}</span></p>}
              </div>

              <form onSubmit={handleClaimApproval} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Review Remarks</label>
                  <textarea
                    required={approvalAction === 'reject'}
                    rows={3}
                    placeholder="Enter review remarks/feedback..."
                    value={remarksForm}
                    onChange={e => setRemarksForm(e.target.value)}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant dark:border-dark-outline-variant">
                  <button
                    type="button"
                    onClick={() => { setSelectedClaim(null); setApprovalAction(null); }}
                    className="px-4 py-2 border rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className={`px-4 py-2 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 ${
                      approvalAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Confirm {approvalAction === 'approve' ? 'Approval' : 'Rejection'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
