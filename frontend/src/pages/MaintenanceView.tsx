import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Edit2, Trash2, Settings, Wrench,
  Shield, CheckSquare, Layers, X, Loader2, AlertCircle
} from 'lucide-react';
import type { RootState } from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const MaintenanceView: React.FC = () => {
  const { subpage } = useParams<{ subpage: string }>();
  const { token } = useSelector((state: RootState) => state.auth);

  // States
  const [data, setData] = useState<any[]>([]);
  const [extraDepts, setExtraDepts] = useState<any[]>([]);
  const [extraSubs, setExtraSubs] = useState<any[]>([]);
  const [extraPriorities, setExtraPriorities] = useState<any[]>([]);
  const [extraNatures, setExtraNatures] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);

  // Forms state
  const [natureForm, setNatureForm] = useState({
    nature_name: '',
    sub_department: '',
    default_priority: '',
    active: true
  });
  const [workerAssignmentForm, setWorkerAssignmentForm] = useState({
    nature: '',
    worker: ''
  });
  const [priorityForm, setPriorityForm] = useState({
    department: '',
    priority_name: '',
    level: 1
  });
  const [statusForm, setStatusForm] = useState({
    department: '',
    status_name: ''
  });
  const [mediaCatForm, setMediaCatForm] = useState({
    department: '',
    category_name: ''
  });

  useEffect(() => {
    fetchData();
  }, [subpage, token]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = { Authorization: `Token ${token}` };
      const resDepts = await fetch(`${API_URL}/stores/department/`, { headers });
      if (resDepts.ok) setExtraDepts(await resDepts.json());

      if (subpage === 'natures') {
        const [resNat, resSub, resPri] = await Promise.all([
          fetch(`${API_URL}/maintenance/worknature/`, { headers }),
          fetch(`${API_URL}/stores/subdepartment/`, { headers }),
          fetch(`${API_URL}/maintenance/priority/`, { headers })
        ]);
        if (resNat.ok) setData(await resNat.json());
        if (resSub.ok) setExtraSubs(await resSub.json());
        if (resPri.ok) setExtraPriorities(await resPri.json());
      } else if (subpage === 'worker-assignments') {
        const [resWorkAss, resNat, resUsers] = await Promise.all([
          fetch(`${API_URL}/maintenance/natureworker/`, { headers }),
          fetch(`${API_URL}/maintenance/worknature/`, { headers }),
          fetch(`${API_URL}/accounts/customuser/`, { headers })
        ]);
        if (resWorkAss.ok) setData(await resWorkAss.json());
        if (resNat.ok) setExtraNatures(await resNat.json());
        if (resUsers.ok) {
          const uList = await resUsers.json();
          // Filter technicians/workers
          setUsers(uList.filter((u: any) => {
            const roleName = (u.role as any)?.role_name?.toLowerCase() || (u.role as string)?.toLowerCase();
            return roleName === 'technician' || roleName === 'worker';
          }));
        }
      } else if (subpage === 'priorities') {
        const res = await fetch(`${API_URL}/maintenance/priority/`, { headers });
        if (res.ok) setData(await res.json());
      } else if (subpage === 'statuses') {
        const res = await fetch(`${API_URL}/maintenance/status/`, { headers });
        if (res.ok) setData(await res.json());
      } else if (subpage === 'media-categories') {
        const res = await fetch(`${API_URL}/common/mediacategory/`, { headers });
        if (res.ok) setData(await res.json());
      }
    } catch (err) {
      setErrorMsg('Failed to load maintenance configurations.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditItem(null);
    setNatureForm({ nature_name: '', sub_department: '', default_priority: '', active: true });
    setWorkerAssignmentForm({ nature: '', worker: '' });
    setPriorityForm({ department: '', priority_name: '', level: 1 });
    setStatusForm({ department: '', status_name: '' });
    setMediaCatForm({ department: '', category_name: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditItem(item);
    if (subpage === 'natures') {
      setNatureForm({
        nature_name: item.nature_name,
        sub_department: item.sub_department?.sub_department_id || item.sub_department || '',
        default_priority: item.default_priority?.priority_id || item.default_priority || '',
        active: item.active
      });
    } else if (subpage === 'worker-assignments') {
      setWorkerAssignmentForm({
        nature: item.nature?.nature_id || item.nature || '',
        worker: item.worker?.user_id || item.worker || ''
      });
    } else if (subpage === 'priorities') {
      setPriorityForm({
        department: item.department?.department_id || item.department || '',
        priority_name: item.priority_name,
        level: item.level
      });
    } else if (subpage === 'statuses') {
      setStatusForm({
        department: item.department?.department_id || item.department || '',
        status_name: item.status_name
      });
    } else if (subpage === 'media-categories') {
      setMediaCatForm({
        department: item.department?.department_id || item.department || '',
        category_name: item.category_name
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

    if (subpage === 'natures') {
      endpoint = editItem ? `${API_URL}/maintenance/worknature/${editItem.nature_id}/` : `${API_URL}/maintenance/worknature/`;
      bodyData = natureForm;
    } else if (subpage === 'worker-assignments') {
      endpoint = editItem ? `${API_URL}/maintenance/natureworker/${editItem.nature_worker_id}/` : `${API_URL}/maintenance/natureworker/`;
      bodyData = workerAssignmentForm;
    } else if (subpage === 'priorities') {
      endpoint = editItem ? `${API_URL}/maintenance/priority/${editItem.priority_id}/` : `${API_URL}/maintenance/priority/`;
      bodyData = priorityForm;
    } else if (subpage === 'statuses') {
      endpoint = editItem ? `${API_URL}/maintenance/status/${editItem.status_id}/` : `${API_URL}/maintenance/status/`;
      bodyData = statusForm;
    } else if (subpage === 'media-categories') {
      endpoint = editItem ? `${API_URL}/common/mediacategory/${editItem.category_id}/` : `${API_URL}/common/mediacategory/`;
      bodyData = mediaCatForm;
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
        setErrorMsg(Object.values(errorRes).flat().join(', ') || 'Failed to save changes.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this config?')) return;
    setErrorMsg('');
    let endpoint = '';
    if (subpage === 'natures') endpoint = `${API_URL}/maintenance/worknature/${id}/`;
    else if (subpage === 'worker-assignments') endpoint = `${API_URL}/maintenance/natureworker/${id}/`;
    else if (subpage === 'priorities') endpoint = `${API_URL}/maintenance/priority/${id}/`;
    else if (subpage === 'statuses') endpoint = `${API_URL}/maintenance/status/${id}/`;
    else if (subpage === 'media-categories') endpoint = `${API_URL}/common/mediacategory/${id}/`;

    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` }
      });
      if (response.ok) {
        fetchData();
      } else {
        setErrorMsg('Failed to delete item.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    }
  };

  const filteredData = data.filter(item => {
    const text = (item.nature_name || item.priority_name || item.status_name || item.category_name || item.worker?.full_name || '').toLowerCase();
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
            placeholder="Search here..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
          />
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-primary/95 transition-all cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Configuration
        </button>
      </div>

      {/* Content Table */}
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
                  {subpage === 'natures' ? (
                    <>
                      <th className="px-6 py-4">Nature ID</th>
                      <th className="px-6 py-4">Nature Name</th>
                      <th className="px-6 py-4">Sub Department</th>
                      <th className="px-6 py-4">Default Priority</th>
                      <th className="px-6 py-4">Status</th>
                    </>
                  ) : subpage === 'worker-assignments' ? (
                    <>
                      <th className="px-6 py-4">Assignment ID</th>
                      <th className="px-6 py-4">Nature of Work</th>
                      <th className="px-6 py-4">Assigned Technician</th>
                    </>
                  ) : subpage === 'priorities' ? (
                    <>
                      <th className="px-6 py-4">Priority ID</th>
                      <th className="px-6 py-4">Priority Label</th>
                      <th className="px-6 py-4">Level</th>
                      <th className="px-6 py-4">Department</th>
                    </>
                  ) : subpage === 'statuses' ? (
                    <>
                      <th className="px-6 py-4">Status ID</th>
                      <th className="px-6 py-4">Status Name</th>
                      <th className="px-6 py-4">Department</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4">Category ID</th>
                      <th className="px-6 py-4">Category Name</th>
                      <th className="px-6 py-4">Department Scope</th>
                    </>
                  )}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant dark:divide-dark-outline-variant text-sm">
                {filteredData.map(item => (
                  <tr key={item.nature_id || item.nature_worker_id || item.priority_id || item.status_id || item.category_id} className="hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low transition-all">
                    {subpage === 'natures' ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.nature_id}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.nature_name}</td>
                        <td className="px-6 py-4">{item.sub_department?.sub_department_name || 'N/A'}</td>
                        <td className="px-6 py-4 font-semibold text-primary">{item.default_priority?.priority_name || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600'
                          }`}>
                            {item.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </>
                    ) : subpage === 'worker-assignments' ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.nature_worker_id}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.nature?.nature_name}</td>
                        <td className="px-6 py-4">{item.worker?.full_name}</td>
                      </>
                    ) : subpage === 'priorities' ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.priority_id}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.priority_name}</td>
                        <td className="px-6 py-4 font-mono text-xs">LVL {item.level}</td>
                        <td className="px-6 py-4">{item.department?.department_name || 'N/A'}</td>
                      </>
                    ) : subpage === 'statuses' ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.status_id}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.status_name}</td>
                        <td className="px-6 py-4">{item.department?.department_name || 'N/A'}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.category_id}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.category_name}</td>
                        <td className="px-6 py-4">{item.department?.department_name || 'Global'}</td>
                      </>
                    )}
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 inline-flex bg-surface-container-high dark:bg-dark-surface-container-high text-outline hover:text-primary rounded-lg border border-outline-variant dark:border-dark-outline-variant cursor-pointer transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.nature_id || item.nature_worker_id || item.priority_id || item.status_id || item.category_id)}
                        className="p-1.5 inline-flex bg-surface-container-high dark:bg-dark-surface-container-high text-outline hover:text-red-500 rounded-lg border border-outline-variant dark:border-dark-outline-variant cursor-pointer transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
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
                  {editItem ? 'Edit Configuration' : 'Create Configuration'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg text-outline hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {subpage === 'natures' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1">Maintenance Nature Name</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Broken Glass Door"
                        value={natureForm.nature_name}
                        onChange={e => setNatureForm({ ...natureForm, nature_name: e.target.value })}
                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1">Assigned Sub Department</label>
                      <select
                        required
                        value={natureForm.sub_department}
                        onChange={e => setNatureForm({ ...natureForm, sub_department: e.target.value })}
                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      >
                        <option value="">Select Sub Department</option>
                        {extraSubs.map(s => <option key={s.sub_department_id} value={s.sub_department_id}>{s.sub_department_name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1">Default Priority Level</label>
                      <select
                        required
                        value={natureForm.default_priority}
                        onChange={e => setNatureForm({ ...natureForm, default_priority: e.target.value })}
                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      >
                        <option value="">Select Default Priority</option>
                        {extraPriorities.map(p => <option key={p.priority_id} value={p.priority_id}>{p.priority_name} (Lvl {p.level})</option>)}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={natureForm.active}
                        id="nature-active-checkbox"
                        onChange={e => setNatureForm({ ...natureForm, active: e.target.checked })}
                      />
                      <label htmlFor="nature-active-checkbox" className="text-xs font-semibold text-outline">
                        Mark work nature as active
                      </label>
                    </div>
                  </>
                ) : subpage === 'worker-assignments' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1">Select Nature of Work</label>
                      <select
                        required
                        value={workerAssignmentForm.nature}
                        onChange={e => setWorkerAssignmentForm({ ...workerAssignmentForm, nature: e.target.value })}
                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      >
                        <option value="">Select Nature</option>
                        {extraNatures.map(n => <option key={n.nature_id} value={n.nature_id}>{n.nature_name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1">Technician / Worker</label>
                      <select
                        required
                        value={workerAssignmentForm.worker}
                        onChange={e => setWorkerAssignmentForm({ ...workerAssignmentForm, worker: e.target.value })}
                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      >
                        <option value="">Select Technician</option>
                        {users.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.employee_no})</option>)}
                      </select>
                    </div>
                  </>
                ) : subpage === 'priorities' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1">Department Scope</label>
                      <select
                        required
                        value={priorityForm.department}
                        onChange={e => setPriorityForm({ ...priorityForm, department: e.target.value })}
                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      >
                        <option value="">Select Department</option>
                        {extraDepts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1">Priority Label</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Critical"
                        value={priorityForm.priority_name}
                        onChange={e => setPriorityForm({ ...priorityForm, priority_name: e.target.value })}
                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1">Priority Level (Severity Rank)</label>
                      <input
                        required
                        type="number"
                        min="1"
                        max="5"
                        value={priorityForm.level}
                        onChange={e => setPriorityForm({ ...priorityForm, level: Number(e.target.value) })}
                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      />
                    </div>
                  </>
                ) : subpage === 'statuses' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1">Department Scope</label>
                      <select
                        required
                        value={statusForm.department}
                        onChange={e => setStatusForm({ ...statusForm, department: e.target.value })}
                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      >
                        <option value="">Select Department</option>
                        {extraDepts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1">Status Name</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Waiting Allocation"
                        value={statusForm.status_name}
                        onChange={e => setStatusForm({ ...statusForm, status_name: e.target.value })}
                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1">Department Scope</label>
                      <select
                        required
                        value={mediaCatForm.department}
                        onChange={e => setMediaCatForm({ ...mediaCatForm, department: e.target.value })}
                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      >
                        <option value="">Select Department</option>
                        {extraDepts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1">Media Category Name</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Final Repair Photo"
                        value={mediaCatForm.category_name}
                        onChange={e => setMediaCatForm({ ...mediaCatForm, category_name: e.target.value })}
                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      />
                    </div>
                  </>
                )}

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
