import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Edit2, Trash2, MapPin, Store,
  Building, ChevronRight, X, Loader2, AlertCircle
} from 'lucide-react';
import type { RootState } from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const StoresView: React.FC = () => {
  const { subpage } = useParams<{ subpage: string }>();
  const { token, user } = useSelector((state: RootState) => state.auth);

  // States
  const [data, setData] = useState<any[]>([]);
  const [extraData, setExtraData] = useState<any[]>([]); // Areas/Depts choices
  const [users, setUsers] = useState<any[]>([]); // Managers choices
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);

  // Form fields
  const [storeForm, setStoreForm] = useState({
    store_id: '',
    store_name: '',
    area: '',
    address: '',
    phone: '',
    whatsapp_number: '',
    longitude: '',
    latitude: '',
    manager: '',
    active: true
  });
  const [areaForm, setAreaForm] = useState({ area_name: '' });
  const [deptForm, setDeptForm] = useState({ department_name: '' });
  const [subDeptForm, setSubDeptForm] = useState({ department: '', sub_department_name: '' });

  useEffect(() => {
    fetchData();
  }, [subpage, token]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = { Authorization: `Token ${token}` };
      if (subpage === 'all' || !subpage) {
        // Fetch Stores
        const [resStore, resArea, resUsers] = await Promise.all([
          fetch(`${API_URL}/stores/store/`, { headers }),
          fetch(`${API_URL}/stores/area/`, { headers }),
          fetch(`${API_URL}/accounts/customuser/`, { headers })
        ]);
        if (resStore.ok) setData(await resStore.json());
        if (resArea.ok) setExtraData(await resArea.json());
        if (resUsers.ok) setUsers(await resUsers.json());
      } else if (subpage === 'areas') {
        const res = await fetch(`${API_URL}/stores/area/`, { headers });
        if (res.ok) setData(await res.json());
      } else if (subpage === 'departments') {
        const res = await fetch(`${API_URL}/stores/department/`, { headers });
        if (res.ok) setData(await res.json());
      } else if (subpage === 'sub-departments') {
        const [resSub, resDept] = await Promise.all([
          fetch(`${API_URL}/stores/subdepartment/`, { headers }),
          fetch(`${API_URL}/stores/department/`, { headers })
        ]);
        if (resSub.ok) setData(await resSub.json());
        if (resDept.ok) setExtraData(await resDept.json());
      }
    } catch (err) {
      setErrorMsg('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditItem(null);
    setStoreForm({
      store_id: '',
      store_name: '',
      area: '',
      address: '',
      phone: '',
      whatsapp_number: '',
      longitude: '',
      latitude: '',
      manager: '',
      active: true
    });
    setAreaForm({ area_name: '' });
    setDeptForm({ department_name: '' });
    setSubDeptForm({ department: '', sub_department_name: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditItem(item);
    if (subpage === 'all' || !subpage) {
      setStoreForm({
        store_id: item.store_id,
        store_name: item.store_name,
        area: item.area?.area_id || '',
        address: item.address || '',
        phone: item.phone || '',
        whatsapp_number: item.whatsapp_number || '',
        longitude: item.longitude || '',
        latitude: item.latitude || '',
        manager: item.manager?.user_id || item.manager || '',
        active: item.active
      });
    } else if (subpage === 'areas') {
      setAreaForm({ area_name: item.area_name });
    } else if (subpage === 'departments') {
      setDeptForm({ department_name: item.department_name });
    } else if (subpage === 'sub-departments') {
      setSubDeptForm({
        department: item.department?.department_id || item.department || '',
        sub_department_name: item.sub_department_name
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

    if (subpage === 'all' || !subpage) {
      endpoint = editItem ? `${API_URL}/stores/store/${editItem.store_id}/` : `${API_URL}/stores/store/`;
      bodyData = { ...storeForm };
      if (!bodyData.manager) delete bodyData.manager;
      if (!bodyData.area) delete bodyData.area;
    } else if (subpage === 'areas') {
      endpoint = editItem ? `${API_URL}/stores/area/${editItem.area_id}/` : `${API_URL}/stores/area/`;
      bodyData = areaForm;
    } else if (subpage === 'departments') {
      endpoint = editItem ? `${API_URL}/stores/department/${editItem.department_id}/` : `${API_URL}/stores/department/`;
      bodyData = deptForm;
    } else if (subpage === 'sub-departments') {
      endpoint = editItem ? `${API_URL}/stores/subdepartment/${editItem.sub_department_id}/` : `${API_URL}/stores/subdepartment/`;
      bodyData = subDeptForm;
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

  const handleDelete = async (id: number | string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    setErrorMsg('');
    let endpoint = '';
    if (subpage === 'all' || !subpage) endpoint = `${API_URL}/stores/store/${id}/`;
    else if (subpage === 'areas') endpoint = `${API_URL}/stores/area/${id}/`;
    else if (subpage === 'departments') endpoint = `${API_URL}/stores/department/${id}/`;
    else if (subpage === 'sub-departments') endpoint = `${API_URL}/stores/subdepartment/${id}/`;

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
    const text = (item.store_name || item.area_name || item.department_name || item.sub_department_name || '').toLowerCase();
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
          Add New {subpage === 'areas' ? 'Area' : subpage === 'departments' ? 'Department' : subpage === 'sub-departments' ? 'Sub Department' : 'Store'}
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
                  {subpage === 'all' || !subpage ? (
                    <>
                      <th className="px-6 py-4">Store Code/ID</th>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Area</th>
                      <th className="px-6 py-4">Manager</th>
                      <th className="px-6 py-4">GPS Coord</th>
                      <th className="px-6 py-4">Status</th>
                    </>
                  ) : subpage === 'areas' ? (
                    <>
                      <th className="px-6 py-4">Area ID</th>
                      <th className="px-6 py-4">Area Name</th>
                    </>
                  ) : subpage === 'departments' ? (
                    <>
                      <th className="px-6 py-4">Department ID</th>
                      <th className="px-6 py-4">Department Name</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4">Sub Dept ID</th>
                      <th className="px-6 py-4">Sub Department Name</th>
                      <th className="px-6 py-4">Parent Department</th>
                    </>
                  )}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant dark:divide-dark-outline-variant text-sm">
                {filteredData.map(item => (
                  <tr key={item.store_id || item.area_id || item.department_id || item.sub_department_id} className="hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low transition-all">
                    {subpage === 'all' || !subpage ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.store_id}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.store_name}</td>
                        <td className="px-6 py-4">{item.area?.area_name || 'N/A'}</td>
                        <td className="px-6 py-4">{item.manager?.full_name || 'N/A'}</td>
                        <td className="px-6 py-4 text-xs font-mono text-outline">
                          {item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : 'No Coordinates'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600'
                          }`}>
                            {item.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </>
                    ) : subpage === 'areas' ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.area_id}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.area_name}</td>
                      </>
                    ) : subpage === 'departments' ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.department_id}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.department_name}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.sub_department_id}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.sub_department_name}</td>
                        <td className="px-6 py-4">{item.department?.department_name || 'N/A'}</td>
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
                        onClick={() => handleDelete(item.store_id || item.area_id || item.department_id || item.sub_department_id)}
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

      {/* Creation/Edit Form Modal */}
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
              className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-lg overflow-y-auto rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant dark:border-dark-outline-variant">
                <h3 className="text-base font-bold text-on-surface dark:text-dark-on-surface">
                  {editItem ? 'Edit Details' : 'Create New Entry'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg text-outline hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {subpage === 'all' || !subpage ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1">Store ID Code</label>
                        <input
                          required
                          disabled={!!editItem}
                          type="text"
                          placeholder="e.g. S-001"
                          value={storeForm.store_id}
                          onChange={e => setStoreForm({ ...storeForm, store_id: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1">Store Name</label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. Salmiya Market"
                          value={storeForm.store_name}
                          onChange={e => setStoreForm({ ...storeForm, store_name: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1">Area Location</label>
                        <select
                          value={storeForm.area}
                          onChange={e => setStoreForm({ ...storeForm, area: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        >
                          <option value="">No Area</option>
                          {extraData.map(a => <option key={a.area_id} value={a.area_id}>{a.area_name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1">Store Manager</label>
                        <select
                          value={storeForm.manager}
                          onChange={e => setStoreForm({ ...storeForm, manager: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        >
                          <option value="">No Manager Assigned</option>
                          {users.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1">Longitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          placeholder="e.g. 47.9784"
                          value={storeForm.longitude}
                          onChange={e => setStoreForm({ ...storeForm, longitude: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1">Latitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          placeholder="e.g. 29.3759"
                          value={storeForm.latitude}
                          onChange={e => setStoreForm({ ...storeForm, latitude: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1">Phone Number</label>
                        <input
                          type="text"
                          placeholder="8 digits"
                          value={storeForm.phone}
                          onChange={e => setStoreForm({ ...storeForm, phone: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1">WhatsApp No</label>
                        <input
                          type="text"
                          placeholder="8 or 10 digits"
                          value={storeForm.whatsapp_number}
                          onChange={e => setStoreForm({ ...storeForm, whatsapp_number: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1">Street Address</label>
                      <textarea
                        rows={2}
                        placeholder="Detailed address location..."
                        value={storeForm.address}
                        onChange={e => setStoreForm({ ...storeForm, address: e.target.value })}
                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={storeForm.active}
                        id="store-active-checkbox"
                        onChange={e => setStoreForm({ ...storeForm, active: e.target.checked })}
                      />
                      <label htmlFor="store-active-checkbox" className="text-xs font-semibold text-outline">
                        Mark store as active
                      </label>
                    </div>
                  </>
                ) : subpage === 'areas' ? (
                  <div>
                    <label className="block text-xs font-semibold text-outline mb-1.5">Area Location Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Farwaniya Area"
                      value={areaForm.area_name}
                      onChange={e => setAreaForm({ area_name: e.target.value })}
                      className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                    />
                  </div>
                ) : subpage === 'departments' ? (
                  <div>
                    <label className="block text-xs font-semibold text-outline mb-1.5">Department Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. HVAC Maintenance"
                      value={deptForm.department_name}
                      onChange={e => setDeptForm({ department_name: e.target.value })}
                      className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1">Parent Department</label>
                      <select
                        required
                        value={subDeptForm.department}
                        onChange={e => setSubDeptForm({ ...subDeptForm, department: e.target.value })}
                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      >
                        <option value="">Select Parent Department</option>
                        {extraData.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-outline mb-1.5">Sub Department Name</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Electrical Panels"
                        value={subDeptForm.sub_department_name}
                        onChange={e => setSubDeptForm({ ...subDeptForm, sub_department_name: e.target.value })}
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
