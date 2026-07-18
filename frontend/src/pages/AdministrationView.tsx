import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Shield, Users, Settings, Edit2, Check,
  X, Loader2, AlertCircle, Trash2, Plus
} from 'lucide-react';
import type { RootState } from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const AdministrationView: React.FC = () => {
  const { subpage } = useParams<{ subpage: string }>();
  const { token } = useSelector((state: RootState) => state.auth);

  // States
  const [data, setData] = useState<any[]>([]);
  const [extraRoles, setExtraRoles] = useState<any[]>([]);
  const [extraStores, setExtraStores] = useState<any[]>([]);
  const [extraDepts, setExtraDepts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);

  // User edit form state
  const [userForm, setUserForm] = useState({
    full_name: '',
    role: '',
    active: true,
    store: '',
    accessible_stores: [] as number[],
    sub_departments: [] as number[]
  });

  // Role edit/create form state
  const [roleForm, setRoleForm] = useState({
    role_name: ''
  });

  useEffect(() => {
    fetchData();
  }, [subpage, token]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = { Authorization: `Token ${token}` };

      // Load roles, stores, departments for user assignment
      const [resRoles, resStores, resDepts] = await Promise.all([
        fetch(`${API_URL}/accounts/role/`, { headers }),
        fetch(`${API_URL}/stores/store/`, { headers }),
        fetch(`${API_URL}/stores/subdepartment/`, { headers })
      ]);
      let rolesData = [];
      if (resRoles.ok) {
        rolesData = await resRoles.json();
        setExtraRoles(rolesData);
      }
      if (resStores.ok) setExtraStores(await resStores.json());
      if (resDepts.ok) setExtraDepts(await resDepts.json());

      if (subpage === 'users' || !subpage) {
        const res = await fetch(`${API_URL}/accounts/customuser/`, { headers });
        if (res.ok) setData(await res.json());
      } else if (subpage === 'roles') {
        setData(rolesData);
      } else if (subpage === 'permissions') {
        // Render system permissions log list
        const res = await fetch(`${API_URL}/accounts/customuser/`, { headers });
        if (res.ok) {
          const uList = await res.json();
          // Map permissions of all users
          const permList = uList.map((u: any) => ({
            username: u.username,
            full_name: u.full_name,
            role: u.role,
            employee_no: u.employee_no
          }));
          setData(permList);
        }
      }
    } catch (err) {
      setErrorMsg('Failed to load administration dataset.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditUser = (item: any) => {
    setEditItem(item);
    setUserForm({
      full_name: item.full_name,
      role: item.role?.role_id || item.role || '',
      active: item.active,
      store: item.store?.store_id || item.store || '',
      accessible_stores: item.accessible_stores?.map((s: any) => s.store_id || s) || [],
      sub_departments: item.sub_departments?.map((d: any) => d.sub_department_id || d) || []
    });
    setShowModal(true);
  };

  const handleOpenCreateRole = () => {
    setEditItem(null);
    setRoleForm({ role_name: '' });
    setShowModal(true);
  };

  const handleOpenEditRole = (item: any) => {
    setEditItem(item);
    setRoleForm({ role_name: item.role_name });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg('');

    let endpoint = '';
    let method = editItem ? 'PATCH' : 'POST';
    let bodyData: any = {};

    if (subpage === 'users' || !subpage) {
      endpoint = `${API_URL}/accounts/customuser/${editItem.user_id}/`;
      bodyData = { ...userForm };
      if (!bodyData.role) delete bodyData.role;
      if (!bodyData.store) delete bodyData.store;
    } else if (subpage === 'roles') {
      endpoint = editItem ? `${API_URL}/accounts/role/${editItem.role_id}/` : `${API_URL}/accounts/role/`;
      bodyData = roleForm;
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
        setErrorMsg(Object.values(errorRes).flat().join(', ') || 'Failed to submit modifications.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRole = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    setErrorMsg('');
    const endpoint = `${API_URL}/accounts/role/${id}/`;

    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` }
      });
      if (response.ok) {
        fetchData();
      } else {
        setErrorMsg('Failed to delete role.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    }
  };

  const handleApproveUser = async (userId: number) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_URL}/accounts/customuser/${userId}/`, {
        method: 'PATCH',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ active: true })
      });
      if (response.ok) {
        fetchData();
      } else {
        setErrorMsg('Failed to approve user registration.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredData = data.filter(item => {
    const text = (item.full_name || item.username || item.employee_no || item.role_name || '').toLowerCase();
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
            placeholder="Search administration data..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
          />
        </div>

        {subpage === 'roles' && (
          <button
            onClick={handleOpenCreateRole}
            className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-primary/95 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Custom Role
          </button>
        )}
      </div>

      {/* Content Table Grid */}
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
                  {subpage === 'users' || !subpage ? (
                    <>
                      <th className="px-6 py-4">Employee ID</th>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Username</th>
                      <th className="px-6 py-4">Current Role</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </>
                  ) : subpage === 'roles' ? (
                    <>
                      <th className="px-6 py-4">Role ID</th>
                      <th className="px-6 py-4">Role Designation Name</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Employee ID</th>
                      <th className="px-6 py-4">Role Context</th>
                      <th className="px-6 py-4">Security Access Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant dark:divide-dark-outline-variant text-sm">
                {filteredData.map((item, idx) => (
                  <tr key={item.user_id || item.role_id || idx} className="hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low transition-all">
                    {subpage === 'users' || !subpage ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.employee_no}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.full_name}</td>
                        <td className="px-6 py-4 text-xs text-outline">{item.username}</td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary capitalize">
                            {item.role?.role_name || item.role || 'No Role'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600'
                          }`}>
                            {item.active ? 'Approved' : 'Pending Approval'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {!item.active && (
                            <button
                              onClick={() => handleApproveUser(item.user_id)}
                              className="p-1.5 inline-flex bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-lg cursor-pointer transition-all"
                              title="Approve Account"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditUser(item)}
                            className="p-1.5 inline-flex bg-surface-container-high dark:bg-dark-surface-container-high text-outline hover:text-primary rounded-lg border border-outline-variant dark:border-dark-outline-variant cursor-pointer transition-all"
                            title="Edit Permissions/Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </>
                    ) : subpage === 'roles' ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.role_id}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.role_name}</td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => handleOpenEditRole(item)}
                            className="p-1.5 inline-flex bg-surface-container-high dark:bg-dark-surface-container-high text-outline hover:text-primary rounded-lg border border-outline-variant dark:border-dark-outline-variant cursor-pointer transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRole(item.role_id)}
                            className="p-1.5 inline-flex bg-surface-container-high dark:bg-dark-surface-container-high text-outline hover:text-red-500 rounded-lg border border-outline-variant dark:border-dark-outline-variant cursor-pointer transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.full_name}</td>
                        <td className="px-6 py-4 font-mono text-xs text-outline">{item.employee_no}</td>
                        <td className="px-6 py-4 capitalize">{item.role?.role_name || 'User'}</td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                            Granted Base System Scope
                          </span>
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

      {/* User edit modal */}
      {showModal && (subpage === 'users' || !subpage) && (
        <AnimatePresence>
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
                  Configure User: {editItem?.full_name}
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
                  <label className="block text-xs font-semibold text-outline mb-1">Full Name</label>
                  <input
                    required
                    type="text"
                    value={userForm.full_name}
                    onChange={e => setUserForm({ ...userForm, full_name: e.target.value })}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none text-on-surface dark:text-dark-on-surface"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-outline mb-1">Assign System Role</label>
                  <select
                    value={userForm.role}
                    onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none text-on-surface dark:text-dark-on-surface"
                  >
                    <option value="">No Role (Unassigned)</option>
                    {extraRoles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-outline mb-1">Default/Home Store</label>
                  <select
                    value={userForm.store}
                    onChange={e => setUserForm({ ...userForm, store: e.target.value })}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none text-on-surface dark:text-dark-on-surface"
                  >
                    <option value="">No Home Store (Headquarters)</option>
                    {extraStores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={userForm.active}
                    id="user-active-toggle"
                    onChange={e => setUserForm({ ...userForm, active: e.target.checked })}
                  />
                  <label htmlFor="user-active-toggle" className="text-xs font-semibold text-outline">
                    Approve and mark user as active/verified
                  </label>
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
                    Save User Config
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </AnimatePresence>
      )}

      {/* Role Create/Edit Modal */}
      {showModal && subpage === 'roles' && (
        <AnimatePresence>
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
                  {editItem ? 'Edit Custom Role Name' : 'Create Custom Role'}
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
                  <label className="block text-xs font-semibold text-outline mb-1.5">Role Designation Name</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Area Manager"
                    value={roleForm.role_name}
                    onChange={e => setRoleForm({ role_name: e.target.value })}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                  />
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
                    Save Role
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};
