import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Edit2, Trash2, Users, DollarSign,
  Briefcase, Calendar, X, Loader2, AlertCircle, Award
} from 'lucide-react';
import type { RootState } from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const WorkforceView: React.FC = () => {
  const { subpage } = useParams<{ subpage: string }>();
  const { token } = useSelector((state: RootState) => state.auth);

  // States
  const [data, setData] = useState<any[]>([]);
  const [extraWorkers, setExtraWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);

  // Forms state
  const [rateForm, setRateForm] = useState({
    worker: '',
    hourly_rate: '',
    effective_from: '',
    effective_to: ''
  });

  useEffect(() => {
    fetchData();
  }, [subpage, token]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = { Authorization: `Token ${token}` };

      if (subpage === 'employees' || !subpage) {
        const res = await fetch(`${API_URL}/accounts/customuser/`, { headers });
        if (res.ok) setData(await res.json());
      } else if (subpage === 'rates') {
        const [resRates, resWorkers] = await Promise.all([
          fetch(`${API_URL}/finance/employeerate/`, { headers }),
          fetch(`${API_URL}/accounts/customuser/`, { headers })
        ]);
        if (resRates.ok) setData(await resRates.json());
        if (resWorkers.ok) {
          const uList = await resWorkers.json();
          setExtraWorkers(uList.filter((u: any) => u.role?.toLowerCase() === 'technician' || u.role?.toLowerCase() === 'worker'));
        }
      } else if (subpage === 'skills') {
        // Nature worker assignments listing
        const res = await fetch(`${API_URL}/maintenance/natureworker/`, { headers });
        if (res.ok) setData(await res.json());
      }
    } catch (err) {
      setErrorMsg('Failed to load workforce configurations.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditItem(null);
    setRateForm({ worker: '', hourly_rate: '', effective_from: '', effective_to: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditItem(item);
    if (subpage === 'rates') {
      setRateForm({
        worker: item.worker?.user_id || item.worker || '',
        hourly_rate: item.hourly_rate,
        effective_from: item.effective_from || '',
        effective_to: item.effective_to || ''
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg('');

    let endpoint = '';
    let method = editItem ? 'PATCH' : 'POST';
    let bodyData: any = {};

    if (subpage === 'rates') {
      endpoint = editItem ? `${API_URL}/finance/employeerate/${editItem.rate_id}/` : `${API_URL}/finance/employeerate/`;
      bodyData = { ...rateForm };
      if (!bodyData.effective_to) delete bodyData.effective_to;
    }

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
        setErrorMsg(Object.values(errorRes).flat().join(', ') || 'Failed to save rate.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this hourly rate?')) return;
    setErrorMsg('');
    const endpoint = `${API_URL}/finance/employeerate/${id}/`;

    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` }
      });
      if (response.ok) {
        fetchData();
      } else {
        setErrorMsg('Failed to delete hourly rate.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    }
  };

  const filteredData = data.filter(item => {
    const text = (item.full_name || item.username || item.employee_no || item.worker?.full_name || item.nature?.nature_name || '').toLowerCase();
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
            placeholder="Search employees, technicians, rates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
          />
        </div>

        {subpage === 'rates' && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-primary/95 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Hourly Rate
          </button>
        )}
      </div>

      {/* Workforce Listing Table */}
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
                  {subpage === 'employees' || !subpage ? (
                    <>
                      <th className="px-6 py-4">Employee ID</th>
                      <th className="px-6 py-4">Full Name</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Home Store</th>
                      <th className="px-6 py-4">Primary Role</th>
                      <th className="px-6 py-4">Status</th>
                    </>
                  ) : subpage === 'rates' ? (
                    <>
                      <th className="px-6 py-4">Worker</th>
                      <th className="px-6 py-4">Employee ID</th>
                      <th className="px-6 py-4">Hourly Rate</th>
                      <th className="px-6 py-4">Effective From</th>
                      <th className="px-6 py-4">Effective To</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4">Technician Name</th>
                      <th className="px-6 py-4">Employee ID</th>
                      <th className="px-6 py-4">Maintenance Nature Skill</th>
                      <th className="px-6 py-4">Assigned Department</th>
                    </>
                  )}
                  {subpage === 'rates' && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant dark:divide-dark-outline-variant text-sm">
                {filteredData.map(item => (
                  <tr key={item.user_id || item.rate_id || item.nature_worker_id} className="hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low transition-all">
                    {subpage === 'employees' || !subpage ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.employee_no}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.full_name}</td>
                        <td className="px-6 py-4 text-xs text-outline">{item.email}</td>
                        <td className="px-6 py-4">{item.store?.store_name || 'All Accessible Stores'}</td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary capitalize">
                            {item.role || 'No Role'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600'
                          }`}>
                            {item.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </>
                    ) : subpage === 'rates' ? (
                      <>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.worker?.full_name || item.worker}</td>
                        <td className="px-6 py-4 font-mono text-xs text-outline">{item.worker?.employee_no}</td>
                        <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">{item.hourly_rate} KWD/hr</td>
                        <td className="px-6 py-4 text-xs text-outline">{item.effective_from}</td>
                        <td className="px-6 py-4 text-xs text-outline">{item.effective_to || 'Ongoing'}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.worker?.full_name}</td>
                        <td className="px-6 py-4 font-mono text-xs text-outline">{item.worker?.employee_no}</td>
                        <td className="px-6 py-4 font-semibold text-primary">{item.nature?.nature_name}</td>
                        <td className="px-6 py-4 text-xs text-outline">{item.nature?.sub_department?.sub_department_name}</td>
                      </>
                    )}
                    {subpage === 'rates' && (
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 inline-flex bg-surface-container-high dark:bg-dark-surface-container-high text-outline hover:text-primary rounded-lg border border-outline-variant dark:border-dark-outline-variant cursor-pointer transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.rate_id)}
                          className="p-1.5 inline-flex bg-surface-container-high dark:bg-dark-surface-container-high text-outline hover:text-red-500 rounded-lg border border-outline-variant dark:border-dark-outline-variant cursor-pointer transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hourly Rate Modal */}
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
                  {editItem ? 'Edit Hourly Rate' : 'Assign Worker Hourly Rate'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg text-outline hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1">Select Technician / Worker</label>
                  <select
                    required
                    disabled={!!editItem}
                    value={rateForm.worker}
                    onChange={e => setRateForm({ ...rateForm, worker: e.target.value })}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                  >
                    <option value="">Select Technician</option>
                    {extraWorkers.map(w => <option key={w.user_id} value={w.user_id}>{w.full_name} ({w.employee_no})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-outline mb-1">Hourly rate (KWD)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="e.g. 15.00"
                    value={rateForm.hourly_rate}
                    onChange={e => setRateForm({ ...rateForm, hourly_rate: e.target.value })}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-outline mb-1">Effective From</label>
                    <input
                      required
                      type="date"
                      value={rateForm.effective_from}
                      onChange={e => setRateForm({ ...rateForm, effective_from: e.target.value })}
                      className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-outline mb-1">Effective To</label>
                    <input
                      type="date"
                      value={rateForm.effective_to}
                      onChange={e => setRateForm({ ...rateForm, effective_to: e.target.value })}
                      className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                    />
                  </div>
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
                    Save Changes
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
