import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, Plus, Clock, CheckCircle2, XCircle,
  AlertTriangle, Eye, Paperclip, Calendar, DollarSign,
  UserPlus, ChevronRight, X, Loader2, FileText, Send
} from 'lucide-react';
import type { RootState } from '../store';
import { usePermission } from '../hooks/usePermission';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

interface Ticket {
  ticket_id: number;
  work_order_no: string;
  store: { store_id: string; store_name: string };
  department: { department_id: number; department_name: string };
  nature: { nature_id: number; nature_name: string };
  priority: { priority_id: number; priority_name: string; level: number };
  status: { status_id: number; status_name: string };
  title: string;
  description: string;
  created_by: { user_id: number; full_name: string };
  created_date: string;
  approved_by?: { user_id: number; full_name: string } | null;
  approved_date?: string | null;
  rejected_by?: { user_id: number; full_name: string } | null;
  rejected_date?: string | null;
  reject_reason?: string | null;
  closed_by?: { user_id: number; full_name: string } | null;
  closed_date?: string | null;
}

interface Allocation {
  allocation_id: number;
  worker: { user_id: number; full_name: string; employee_no: string };
  assigned_by: { user_id: number; full_name: string };
  assigned_date: string;
  planned_hours: string;
  remarks: string;
}

interface WorkLog {
  worklog_id: number;
  worker: { user_id: number; full_name: string };
  work_date: string;
  hours: string;
  hourly_rate: string;
  labour_amount: string;
  work_done: string;
}

interface Expense {
  expense_id: number;
  worker: { user_id: number; full_name: string };
  expense_type: { expense_type_id: number; expense_name: string };
  amount: string;
  expense_date: string;
  remarks: string;
  approved: boolean;
}

interface Media {
  media_id: number;
  file_name: string;
  file_url: string;
  uploaded_by: { user_id: number; full_name: string };
  uploaded_date: string;
}

export const TicketsView: React.FC = () => {
  const { subpage } = useParams<{ subpage: string }>();
  const navigate = useNavigate();
  const { token, user } = useSelector((state: RootState) => state.auth);
  const { hasPermission } = usePermission();

  // Lists
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [natures, setNatures] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<any[]>([]);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Selected Ticket Modal State
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mediaList, setMediaList] = useState<Media[]>([]);

  // Action forms state
  const [newAllocation, setNewAllocation] = useState({ worker_id: '', planned_hours: '4.0', remarks: '' });
  const [newWorkLog, setNewWorkLog] = useState({ hours: '', work_done: '' });
  const [newExpense, setNewExpense] = useState({ expense_type_id: '', amount: '', remarks: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Creation View Form State
  const [createForm, setCreateForm] = useState({
    store_id: '',
    department_id: '',
    nature_id: '',
    priority_id: '',
    title: '',
    description: ''
  });

  // Loader & message states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Initial Fetches
  useEffect(() => {
    fetchMetadata();
    fetchTickets();
  }, [token]);

  const fetchMetadata = async () => {
    try {
      const headers = { Authorization: `Token ${token}` };
      const [resStores, resDepts, resPri, resStat, resNat, resWork, resExp] = await Promise.all([
        fetch(`${API_URL}/stores/store/`, { headers }),
        fetch(`${API_URL}/stores/department/`, { headers }),
        fetch(`${API_URL}/maintenance/priority/`, { headers }),
        fetch(`${API_URL}/maintenance/status/`, { headers }),
        fetch(`${API_URL}/maintenance/worknature/`, { headers }),
        fetch(`${API_URL}/accounts/customuser/`, { headers }),
        fetch(`${API_URL}/finance/expensetype/`, { headers })
      ]);

      if (resStores.ok) setStores(await resStores.json());
      if (resDepts.ok) setDepartments(await resDepts.json());
      if (resPri.ok) setPriorities(await resPri.json());
      if (resStat.ok) setStatuses(await resStat.json());
      if (resNat.ok) setNatures(await resNat.json());
      if (resWork.ok) {
        const uList = await resWork.json();
        // filter technicians
        setWorkers(uList.filter((u: any) => u.role?.toLowerCase() === 'technician' || u.role?.toLowerCase() === 'worker'));
      }
      if (resExp.ok) setExpenseTypes(await resExp.json());
    } catch (err) {
      console.error('Failed to load metadata', err);
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/maintenance/ticket/`, {
        headers: { Authorization: `Token ${token}` }
      });
      if (response.ok) {
        setTickets(await response.json());
      }
    } catch (err) {
      console.error('Failed to load tickets', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setShowRejectForm(false);
    setRejectReason('');
    try {
      const headers = { Authorization: `Token ${token}` };
      const [resAlloc, resLog, resExp, resMed] = await Promise.all([
        fetch(`${API_URL}/maintenance/allocation/?ticket=${ticket.ticket_id}`, { headers }),
        fetch(`${API_URL}/maintenance/worklog/?ticket=${ticket.ticket_id}`, { headers }),
        fetch(`${API_URL}/finance/expense/?ticket=${ticket.ticket_id}`, { headers }),
        fetch(`${API_URL}/common/media/?ticket=${ticket.ticket_id}`, { headers })
      ]);

      if (resAlloc.ok) setAllocations(await resAlloc.json());
      if (resLog.ok) setWorkLogs(await resLog.json());
      if (resExp.ok) setExpenses(await resExp.json());
      if (resMed.ok) setMediaList(await resMed.json());
    } catch (err) {
      console.error('Failed to load ticket details', err);
    }
  };

  // Operations
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_URL}/maintenance/ticket/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createForm)
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ text: 'Ticket created successfully!', type: 'success' });
        setCreateForm({ store_id: '', department_id: '', nature_id: '', priority_id: '', title: '', description: '' });
        fetchTickets();
        navigate('/tickets/all');
      } else {
        setMessage({ text: data.error || 'Failed to create ticket', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Connection issue', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/maintenance/allocation/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticket: selectedTicket.ticket_id,
          worker: newAllocation.worker_id,
          planned_hours: newAllocation.planned_hours,
          remarks: newAllocation.remarks
        })
      });
      if (response.ok) {
        setNewAllocation({ worker_id: '', planned_hours: '4.0', remarks: '' });
        handleSelectTicket(selectedTicket);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddWorkLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/maintenance/worklog/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticket: selectedTicket.ticket_id,
          worker: user?.user_id,
          hours: newWorkLog.hours,
          work_done: newWorkLog.work_done,
          work_date: new Date().toISOString().split('T')[0]
        })
      });
      if (response.ok) {
        setNewWorkLog({ hours: '', work_done: '' });
        handleSelectTicket(selectedTicket);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/finance/expense/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticket: selectedTicket.ticket_id,
          worker: user?.user_id,
          expense_type: newExpense.expense_type_id,
          amount: newExpense.amount,
          remarks: newExpense.remarks,
          expense_date: new Date().toISOString().split('T')[0]
        })
      });
      if (response.ok) {
        setNewExpense({ expense_type_id: '', amount: '', remarks: '' });
        handleSelectTicket(selectedTicket);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTicket) return;
    setActionLoading(true);
    const formData = new FormData();
    formData.append('ticket', selectedTicket.ticket_id.toString());
    formData.append('file', file);
    formData.append('file_name', file.name);

    try {
      const response = await fetch(`${API_URL}/common/media/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}` },
        body: formData
      });
      if (response.ok) {
        handleSelectTicket(selectedTicket);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (statusId: number, extra = {}) => {
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/maintenance/ticket/${selectedTicket.ticket_id}/`, {
        method: 'PATCH',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: statusId, ...extra })
      });
      if (response.ok) {
        const updated = await response.json();
        setSelectedTicket(updated);
        fetchTickets();
        setShowRejectForm(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Filters calculation
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                          t.work_order_no.toLowerCase().includes(search.toLowerCase()) ||
                          t.description.toLowerCase().includes(search.toLowerCase());
    const matchesStore = filterStore ? t.store.store_id === filterStore : true;
    const matchesDept = filterDept ? t.department.department_id === Number(filterDept) : true;
    const matchesStatus = filterStatus ? t.status.status_name === filterStatus : true;
    return matchesSearch && matchesStore && matchesDept && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Messages */}
      {message && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
            : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
        }`}>
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm font-semibold">{message.text}</span>
        </div>
      )}

      {subpage === 'create' ? (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container dark:bg-dark-surface-container p-6 rounded-2xl border border-outline-variant dark:border-dark-outline-variant"
        >
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-primary" />
            <h3 className="text-lg font-bold text-on-surface dark:text-dark-on-surface">Raise Support Ticket</h3>
          </div>

          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant mb-1.5">
                  Store
                </label>
                <select
                  required
                  value={createForm.store_id}
                  onChange={e => setCreateForm({ ...createForm, store_id: e.target.value })}
                  className="w-full text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary transition-all text-on-surface dark:text-dark-on-surface"
                >
                  <option value="">Select Store</option>
                  {stores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant mb-1.5">
                  Department
                </label>
                <select
                  required
                  value={createForm.department_id}
                  onChange={e => setCreateForm({ ...createForm, department_id: e.target.value })}
                  className="w-full text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary transition-all text-on-surface dark:text-dark-on-surface"
                >
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant mb-1.5">
                  Nature of Maintenance Work
                </label>
                <select
                  required
                  value={createForm.nature_id}
                  onChange={e => setCreateForm({ ...createForm, nature_id: e.target.value })}
                  className="w-full text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary transition-all text-on-surface dark:text-dark-on-surface"
                >
                  <option value="">Select Nature</option>
                  {natures.map(n => <option key={n.nature_id} value={n.nature_id}>{n.nature_name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant mb-1.5">
                  Priority
                </label>
                <select
                  required
                  value={createForm.priority_id}
                  onChange={e => setCreateForm({ ...createForm, priority_id: e.target.value })}
                  className="w-full text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary transition-all text-on-surface dark:text-dark-on-surface"
                >
                  <option value="">Select Priority</option>
                  {priorities.map(p => <option key={p.priority_id} value={p.priority_id}>{p.priority_name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant mb-1.5">
                Issue Summary / Title
              </label>
              <input
                required
                type="text"
                placeholder="e.g. AC compressor failure in aisle 4"
                value={createForm.title}
                onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                className="w-full text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary transition-all text-on-surface dark:text-dark-on-surface"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant mb-1.5">
                Detailed Description
              </label>
              <textarea
                required
                rows={4}
                placeholder="Provide detailed description of the issue..."
                value={createForm.description}
                onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                className="w-full text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary transition-all text-on-surface dark:text-dark-on-surface"
              />
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/95 focus:outline-none flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Ticket
              </button>
            </div>
          </form>
        </motion.div>
      ) : (
        <>
          {/* Header Controls */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                type="text"
                placeholder="Search ticket order number, title..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full text-sm bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filterStore}
                onChange={e => setFilterStore(e.target.value)}
                className="text-xs bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl p-2.5 outline-none text-on-surface dark:text-dark-on-surface"
              >
                <option value="">All Stores</option>
                {stores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
              </select>

              <select
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
                className="text-xs bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl p-2.5 outline-none text-on-surface dark:text-dark-on-surface"
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
              </select>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="text-xs bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl p-2.5 outline-none text-on-surface dark:text-dark-on-surface"
              >
                <option value="">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Approved">Approved</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Reconciled">Reconciled</option>
              </select>

              <button
                onClick={() => navigate('/tickets/create')}
                className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-primary/95 transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Raise Ticket
              </button>
            </div>
          </div>

          {/* Tickets Data Listings */}
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
                      <th className="px-6 py-4">Work Order No</th>
                      <th className="px-6 py-4">Store</th>
                      <th className="px-6 py-4">Title</th>
                      <th className="px-6 py-4">Priority</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Created Date</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant dark:divide-dark-outline-variant text-sm">
                    {filteredTickets.map(t => (
                      <tr key={t.ticket_id} className="hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low transition-all">
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{t.work_order_no}</td>
                        <td className="px-6 py-4">{t.store.store_name}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{t.title}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            t.priority.level >= 2 
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400' 
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}>
                            {t.priority.priority_name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status.status_name === 'Completed' 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                              : 'bg-primary/10 text-primary'
                          }`}>
                            {t.status.status_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-outline">{new Date(t.created_date).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleSelectTicket(t)}
                            className="inline-flex items-center gap-1 bg-surface-container-high dark:bg-dark-surface-container-high text-xs font-semibold px-3 py-1.5 rounded-lg border border-outline-variant dark:border-dark-outline-variant text-on-surface-variant dark:text-dark-on-surface-variant hover:text-primary transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Ticket Management Detail Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTicket(null)}
              className="absolute inset-0 bg-black"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl p-6 space-y-6 scrollbar-thin"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono text-outline">{selectedTicket.work_order_no}</span>
                  <h3 className="text-lg font-bold text-on-surface dark:text-dark-on-surface mt-1">{selectedTicket.title}</h3>
                  <p className="text-xs text-outline mt-0.5">Raised by {selectedTicket.created_by.full_name} on {new Date(selectedTicket.created_date).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1 rounded-lg text-outline hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Controls */}
              <div className="p-4 bg-surface dark:bg-dark-surface-container-low rounded-xl border border-outline-variant dark:border-dark-outline-variant flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-outline">Current Status:</span>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full capitalize">{selectedTicket.status.status_name}</span>

                <div className="flex-1 flex justify-end gap-2">
                  {selectedTicket.status.status_name === 'Open' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(statuses.find(s => s.status_name === 'Approved')?.status_id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setShowRejectForm(true)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {selectedTicket.status.status_name === 'Approved' && (
                    <button
                      onClick={() => handleUpdateStatus(statuses.find(s => s.status_name === 'In Progress')?.status_id)}
                      className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Start Progress
                    </button>
                  )}
                  {selectedTicket.status.status_name === 'In Progress' && (
                    <button
                      onClick={() => handleUpdateStatus(statuses.find(s => s.status_name === 'Completed')?.status_id)}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Mark Completed
                    </button>
                  )}
                </div>
              </div>

              {showRejectForm && (
                <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-red-600 dark:text-red-400">Rejection Reasoning</h4>
                  <textarea
                    rows={2}
                    className="w-full text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant p-2 rounded outline-none"
                    placeholder="Enter reason..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowRejectForm(false)}
                      className="px-2.5 py-1 text-xs border rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(statuses.find(s => s.status_name === 'Rejected')?.status_id, { reject_reason: rejectReason })}
                      className="px-2.5 py-1 text-xs bg-red-600 text-white rounded"
                    >
                      Confirm Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-outline uppercase tracking-wider mb-1.5">Description</h4>
                <p className="text-sm text-on-surface dark:text-dark-on-surface leading-relaxed p-3 bg-surface dark:bg-dark-surface rounded-xl border border-outline-variant dark:border-dark-outline-variant">{selectedTicket.description}</p>
              </div>

              {/* Dynamic Operations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Allocations Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-outline uppercase tracking-wider">Worker Allocations</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {allocations.map(a => (
                      <div key={a.allocation_id} className="p-3 bg-surface dark:bg-dark-surface rounded-lg border border-outline-variant dark:border-dark-outline-variant flex justify-between text-xs">
                        <div>
                          <p className="font-semibold text-on-surface dark:text-dark-on-surface">{a.worker.full_name}</p>
                          <p className="text-[10px] text-outline mt-0.5">Assigned hours: {a.planned_hours}</p>
                        </div>
                        <span className="text-[10px] text-outline self-center">{new Date(a.assigned_date).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>

                  {hasPermission('add_allocation') ? (
                    <form onSubmit={handleAddAllocation} className="flex gap-2">
                      <select
                        required
                        value={newAllocation.worker_id}
                        onChange={e => setNewAllocation({ ...newAllocation, worker_id: e.target.value })}
                        className="text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded p-2 outline-none flex-1"
                      >
                        <option value="">Assign Worker</option>
                        {workers.map(w => <option key={w.user_id} value={w.user_id}>{w.full_name}</option>)}
                      </select>
                      <button type="submit" className="px-3 py-2 bg-primary text-white text-xs font-semibold rounded hover:bg-primary/95 cursor-pointer">
                        Assign
                      </button>
                    </form>
                  ) : null}
                </div>

                {/* Media/Document Uploads */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-outline uppercase tracking-wider">Media & Attachments</h4>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {mediaList.map(m => (
                      <a key={m.media_id} href={m.file_url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video bg-surface dark:bg-dark-surface rounded-lg overflow-hidden border border-outline-variant dark:border-dark-outline-variant group">
                        <span className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-5 h-5 text-white" />
                        </span>
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1 text-[8px] text-white truncate">{m.file_name}</div>
                      </a>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="ticket-media-upload"
                    />
                    <label
                      htmlFor="ticket-media-upload"
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-outline-variant dark:border-dark-outline-variant rounded-xl cursor-pointer hover:border-primary text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant hover:text-primary transition-all"
                    >
                      <Paperclip className="w-4 h-4" />
                      Upload Attachment File
                    </label>
                  </div>
                </div>
              </div>

              {/* Work Logs & Expense Logging Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-outline-variant dark:border-dark-outline-variant">
                {/* Work Log section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-outline uppercase tracking-wider">Logged Work Hours</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {workLogs.map(wl => (
                      <div key={wl.worklog_id} className="p-3 bg-surface dark:bg-dark-surface rounded-lg border border-outline-variant dark:border-dark-outline-variant space-y-1 text-xs">
                        <div className="flex justify-between font-semibold">
                          <span>{wl.worker.full_name}</span>
                          <span className="text-primary">{wl.hours} Hours</span>
                        </div>
                        <p className="text-[10px] text-outline leading-tight">{wl.work_done}</p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddWorkLog} className="space-y-2">
                    <input
                      required
                      type="number"
                      step="0.5"
                      placeholder="Hours (e.g. 3.5)"
                      value={newWorkLog.hours}
                      onChange={e => setNewWorkLog({ ...newWorkLog, hours: e.target.value })}
                      className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded p-2 outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        placeholder="Work done details..."
                        value={newWorkLog.work_done}
                        onChange={e => setNewWorkLog({ ...newWorkLog, work_done: e.target.value })}
                        className="flex-1 text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded p-2 outline-none"
                      />
                      <button type="submit" className="px-3 bg-primary text-white text-xs font-semibold rounded hover:bg-primary/95 cursor-pointer">
                        Log
                      </button>
                    </div>
                  </form>
                </div>

                {/* Expenses Log section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-outline uppercase tracking-wider">Associated Bills & Expenses</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {expenses.map(exp => (
                      <div key={exp.expense_id} className="p-3 bg-surface dark:bg-dark-surface rounded-lg border border-outline-variant dark:border-dark-outline-variant flex justify-between text-xs">
                        <div>
                          <p className="font-semibold text-on-surface dark:text-dark-on-surface">{exp.expense_type.expense_name}</p>
                          <p className="text-[10px] text-outline mt-0.5">{exp.remarks || 'No remarks'}</p>
                        </div>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 self-center">{exp.amount} KWD</span>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddExpense} className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        required
                        value={newExpense.expense_type_id}
                        onChange={e => setNewExpense({ ...newExpense, expense_type_id: e.target.value })}
                        className="text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded p-2 outline-none flex-1"
                      >
                        <option value="">Expense Type</option>
                        {expenseTypes.map(et => <option key={et.expense_type_id} value={et.expense_type_id}>{et.expense_name}</option>)}
                      </select>
                      <input
                        required
                        type="number"
                        step="0.01"
                        placeholder="KWD Amount"
                        value={newExpense.amount}
                        onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                        className="text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded p-2 outline-none w-28"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Expense remarks..."
                        value={newExpense.remarks}
                        onChange={e => setNewExpense({ ...newExpense, remarks: e.target.value })}
                        className="flex-1 text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded p-2 outline-none"
                      />
                      <button type="submit" className="px-3 bg-primary text-white text-xs font-semibold rounded hover:bg-primary/95 cursor-pointer">
                        Log
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
