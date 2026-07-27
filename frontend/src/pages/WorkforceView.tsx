import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Edit2, Trash2, X, Loader2, AlertCircle,
  User, DollarSign, Award, Calendar, Building2, Wrench,
  UserCheck, UserX, CheckCircle2,
  UserLock, ChevronLeft, ChevronRight
} from 'lucide-react';
import type { RootState } from '../store';
import { usePermission } from '../hooks/usePermission';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const WorkforceView: React.FC = () => {
  const { subpage } = useParams<{ subpage: string }>();
  const { token, user } = useSelector((state: RootState) => state.auth);
  const { hasPermission } = usePermission();

  const canAddEmployee = hasPermission('accounts.add_customuser');
  const canEditEmployee = hasPermission('accounts.change_customuser');

  // Get parent department IDs for the logged-in user to restrict working departments & skills
  const getLoggedInUserDepartmentIds = () => {
    const roleName = (user?.role as any)?.role_name?.toLowerCase() || (user?.role as string)?.toLowerCase();
    if (roleName === 'admin' || roleName === 'administrator') {
      return null; // No restriction
    }
    if (!user?.sub_departments || user.sub_departments.length === 0) {
      return null;
    }
    const deptIds = new Set<number>();
    user.sub_departments.forEach((sdName: string) => {
      const found = subDepartments.find(
        (sd) => sd.sub_department_name.toLowerCase() === sdName.toLowerCase()
      );
      if (found) {
        const deptId = found.department?.department_id ?? found.department;
        if (deptId) {
          deptIds.add(Number(deptId));
        }
      }
    });
    return deptIds.size > 0 ? deptIds : null;
  };

  // States
  const [data, setData] = useState<any[]>([]);
  const [extraWorkers, setExtraWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [employeeTab, setEmployeeTab] = useState<'approved' | 'unapproved'>('approved');

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Metadata states for employee modal dropdowns
  const [roles, setRoles] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [subDepartments, setSubDepartments] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editEmployeeItem, setEditEmployeeItem] = useState<any | null>(null);

  // Forms segmented tab state
  const [activeFormTab, setActiveFormTab] = useState<'basic' | 'access' | 'payroll'>('basic');

  // Interactive inline search filters for nested modal selections
  const [workerSearch, setWorkerSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');

  // Forms state
  const [rateForm, setRateForm] = useState({
    worker: '',
    hourly_rate: '',
    effective_from: '',
    effective_to: ''
  });

  const [employeeForm, setEmployeeForm] = useState({
    employee_no: '',
    full_name: '',
    email: '',
    phone: '',
    whatsapp_number: '',
    password: '',
    role: '',
    store: '',
    accessible_stores: [] as string[],
    sub_departments: [] as number[],
    skills: [] as number[],
    hourly_rate: '',
    effective_from: '',
    effective_to: '',
    rates: [] as any[],
    active: true
  });
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [subpage, token]);

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, subpage, employeeTab]);

  // Handle local memory cleanup of the image preview object URL
  useEffect(() => {
    if (!profileImage) {
      setImagePreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(profileImage);
    setImagePreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [profileImage]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = { Authorization: `Token ${token}` };

      if (subpage === 'employees' || !subpage) {
        const [resUsers, resRoles, resStores, resDepts, resSkills, resAreas] = await Promise.all([
          fetch(`${API_URL}/accounts/customuser/`, { headers }),
          fetch(`${API_URL}/accounts/role/`, { headers }),
          fetch(`${API_URL}/stores/store/`, { headers }),
          fetch(`${API_URL}/stores/subdepartment/`, { headers }),
          fetch(`${API_URL}/maintenance/worknature/`, { headers }),
          fetch(`${API_URL}/stores/area/`, { headers })
        ]);
        if (resUsers.ok) setData(await resUsers.json());
        if (resRoles.ok) setRoles(await resRoles.json());
        if (resStores.ok) setStores(await resStores.json());
        if (resDepts.ok) setSubDepartments(await resDepts.json());
        if (resSkills.ok) setSkills(await resSkills.json());
        if (resAreas && resAreas.ok) setAreas(await resAreas.json());
      } else if (subpage === 'rates') {
        const [resRates, resWorkers] = await Promise.all([
          fetch(`${API_URL}/finance/employeerate/`, { headers }),
          fetch(`${API_URL}/accounts/customuser/`, { headers })
        ]);
        if (resRates.ok) setData(await resRates.json());
        if (resWorkers.ok) {
          const uList = await resWorkers.json();
          setExtraWorkers(uList.filter((u: any) => {
            const roleName = (u.role as any)?.role_name?.toLowerCase() || (u.role as string)?.toLowerCase();
            return roleName === 'technician' || roleName === 'worker';
          }));
        }
      } else if (subpage === 'skills') {
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
    setErrorMsg('');
    setEditItem(null);
    setWorkerSearch('');
    setRateForm({ worker: '', hourly_rate: '', effective_from: '', effective_to: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (item: any) => {
    setErrorMsg('');
    setEditItem(item);
    setWorkerSearch('');
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

  const handleOpenCreateEmployee = () => {
    setErrorMsg('');
    setEditEmployeeItem(null);
    setActiveFormTab('basic');
    setStoreFilter('');
    setAreaFilter('');
    setDeptFilter('');
    setSkillFilter('');
    setEmployeeForm({
      employee_no: '',
      full_name: '',
      email: '',
      phone: '',
      whatsapp_number: '',
      password: '',
      role: '',
      store: '',
      accessible_stores: [],
      sub_departments: [],
      skills: [],
      hourly_rate: '',
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: '',
      rates: [],
      active: true
    });
    setProfileImage(null);
    setShowEmployeeModal(true);
  };

  const handleOpenEditEmployee = (item: any) => {
    setErrorMsg('');
    setEditEmployeeItem(item);
    setActiveFormTab('basic');
    setStoreFilter('');
    setAreaFilter('');
    setDeptFilter('');
    setSkillFilter('');
    setEmployeeForm({
      employee_no: item.employee_no || '',
      full_name: item.full_name || '',
      email: item.email || '',
      phone: item.phone || '',
      whatsapp_number: item.whatsapp_number || '',
      password: '',
      role: item.role?.role_id || item.role || '',
      store: item.store?.store_id || item.store || '',
      accessible_stores: item.accessible_stores?.map((s: any) => s.store_id || s) || [],
      sub_departments: item.sub_departments?.map((d: any) => d.sub_department_id || d) || [],
      skills: item.skills?.map((sk: any) => sk.nature_id) || [],
      hourly_rate: item.hourly_rate || '',
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: '',
      rates: item.rates || [],
      active: item.active === false ? true : (item.active ?? true)
    });
    setProfileImage(null);
    setShowEmployeeModal(true);
  };

  const handleToggleDeactivateEmployee = async (item: any, newStatus: boolean) => {
    const actionText = newStatus ? 'approve/activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionText} ${item.full_name || item.username}?`)) return;
    setErrorMsg('');
    try {
      const response = await fetch(`${API_URL}/accounts/customuser/${item.user_id}/`, {
        method: 'PATCH',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ active: newStatus })
      });
      if (response.ok) {
        fetchData();
      } else {
        setErrorMsg(`Failed to ${actionText} employee account.`);
      }
    } catch (err) {
      setErrorMsg('Network error.');
    }
  };

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg('');

    if (!/^\d{8}$/.test(employeeForm.phone)) {
      setErrorMsg("Phone number must be exactly 8 digits.");
      setActionLoading(false);
      return;
    }
    if (!/^\d{8}$|^\d{10}$/.test(employeeForm.whatsapp_number)) {
      setErrorMsg("WhatsApp number must be either 8 or 10 digits.");
      setActionLoading(false);
      return;
    }

    const method = editEmployeeItem ? 'PATCH' : 'POST';
    const endpoint = editEmployeeItem
      ? `${API_URL}/accounts/customuser/${editEmployeeItem.user_id}/`
      : `${API_URL}/accounts/customuser/`;

    const formData = new FormData();
    formData.append('employee_no', employeeForm.employee_no);
    formData.append('username', employeeForm.employee_no);
    formData.append('full_name', employeeForm.full_name);
    formData.append('email', employeeForm.email);
    formData.append('phone', employeeForm.phone);
    formData.append('whatsapp_number', employeeForm.whatsapp_number);
    if (employeeForm.password) {
      formData.append('password', employeeForm.password);
    } else if (!editEmployeeItem) {
      setErrorMsg('Password is required for new employees.');
      setActionLoading(false);
      return;
    }

    if (employeeForm.role) formData.append('role', employeeForm.role.toString());
    if (employeeForm.store) formData.append('store', employeeForm.store.toString());
    formData.append('active', employeeForm.active ? 'true' : 'false');
    if (profileImage) formData.append('profile_image', profileImage);

    employeeForm.accessible_stores.forEach(storeId => {
      formData.append('accessible_stores', storeId);
    });
    employeeForm.sub_departments.forEach(deptId => {
      formData.append('sub_departments', deptId.toString());
    });
    employeeForm.skills.forEach(skillId => {
      formData.append('skills', skillId.toString());
    });
    formData.append('hourly_rate', employeeForm.hourly_rate);
    formData.append('effective_from', employeeForm.effective_from || '');
    formData.append('effective_to', employeeForm.effective_to || '');

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          Authorization: `Token ${token}`
        },
        body: formData
      });
      if (response.ok) {
        setShowEmployeeModal(false);
        fetchData();
      } else {
        const errorRes = await response.json();
        setErrorMsg(Object.values(errorRes).flat().join(', ') || 'Failed to save employee.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEmployee = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
    setErrorMsg('');
    const endpoint = `${API_URL}/accounts/customuser/${id}/`;

    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` }
      });
      if (response.ok) {
        fetchData();
      } else {
        setErrorMsg('Failed to delete employee.');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    }
  };

  const roleName = ((user?.role as any)?.role_name || (user?.role as string) || '').toLowerCase();
  const isOfficeStaffOrAdmin =
    roleName.includes('admin') ||
    roleName.includes('office') ||
    hasPermission('accounts.change_customuser');

  const unapprovedCount = data.filter(
    item => (subpage === 'employees' || !subpage) && item.active === false
  ).length;

  const approvedCount = data.filter(
    item => (subpage === 'employees' || !subpage) && item.active !== false
  ).length;

  const filteredData = data.filter(item => {
    const text = (item.full_name || item.username || item.employee_no || item.worker?.full_name || item.nature?.nature_name || '').toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase());

    if (subpage === 'employees' || !subpage) {
      if (isOfficeStaffOrAdmin && employeeTab === 'unapproved') {
        return matchesSearch && item.active === false;
      }
      return matchesSearch && item.active !== false;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Global Error Display (Only visible when no modals are open) */}
      {errorMsg && !showModal && !showEmployeeModal && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
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
            className="w-full text-sm bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded pl-10 pr-4 py-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
          />
        </div>

        {subpage === 'rates' && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2.5 rounded hover:bg-primary/95 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Hourly Rate
          </button>
        )}

        {(subpage === 'employees' || !subpage) && canAddEmployee && (
          <button
            onClick={handleOpenCreateEmployee}
            className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2.5 rounded hover:bg-primary/95 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        )}
      </div>

      {/* Employee Approval Sub-tabs (Only for Office Staff and Admin) */}
      {(subpage === 'employees' || !subpage) && isOfficeStaffOrAdmin && (
        <div className="flex items-center gap-2 border-b border-outline-variant dark:border-dark-outline-variant pb-2">
          <button
            type="button"
            onClick={() => setEmployeeTab('approved')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded transition-all cursor-pointer ${employeeTab === 'approved'
              ? 'bg-primary text-white shadow-sm'
              : 'text-outline hover:text-on-surface dark:hover:text-dark-on-surface hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high'
              }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Approved Employees</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${employeeTab === 'approved' ? 'bg-white/20 text-white' : 'bg-surface-container-highest dark:bg-dark-surface-container-high text-outline'
              }`}>
              {approvedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setEmployeeTab('unapproved')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded transition-all cursor-pointer ${employeeTab === 'unapproved'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-outline hover:text-on-surface dark:hover:text-dark-on-surface hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high'
              }`}
          >
            <UserLock className="w-4 h-4" />
            <span>Unapproved / Inactive</span>
            {unapprovedCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                {unapprovedCount}
              </span>
            ) : (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${employeeTab === 'unapproved' ? 'bg-white/20 text-white' : 'bg-surface-container-highest dark:bg-dark-surface-container-high text-outline'
                }`}>
                0
              </span>
            )}
          </button>
        </div>
      )}

      {/* Workforce Listing Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 w-full bg-surface-container-high dark:bg-dark-surface-container-low animate-pulse rounded" />
          ))}
        </div>
      ) : (
        <div className="bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high dark:bg-dark-surface-container-high border-b border-outline-variant dark:border-dark-outline-variant text-[10px] uppercase font-bold text-outline tracking-wider">
                  {subpage === 'employees' || !subpage ? (
                    <>
                      <th className="px-6 py-4">Employee ID</th>
                      <th className="px-6 py-4">Full Name</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Home Store</th>
                      <th className="px-6 py-4">Working Department</th>
                      <th className="px-6 py-4">Skills</th>
                      <th className="px-6 py-4">Hourly Rate</th>
                      <th className="px-6 py-4">Status</th>
                      {(canEditEmployee || hasPermission('accounts.delete_customuser')) && <th className="px-6 py-4 text-right">Actions</th>}
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
                {(() => {
                  const totalItems = filteredData.length;
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
                  const paginatedData = filteredData.slice(startIndex, endIndex);

                  return paginatedData.map(item => (
                    <tr key={item.user_id || item.rate_id || item.nature_worker_id} className="hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low transition-all">
                      {subpage === 'employees' || !subpage ? (
                        <>
                          <td className="px-6 py-4 font-mono text-xs font-semibold">{item.employee_no}</td>
                          <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">
                            <div className="flex items-center gap-3">
                              {item.profile_image ? (
                                <img src={item.profile_image} alt="" className="w-8 h-8 rounded-full object-cover border border-outline-variant" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                  {item.full_name ? item.full_name.charAt(0) : (item.username?.charAt(0) || item.email?.charAt(0) || '?')}
                                </div>
                              )}
                              <div>
                                <div className="font-semibold">{item.full_name}</div>
                                <div className="text-xs text-outline font-normal">{item.email}</div>
                                {item.phone && <div className="text-[10px] text-outline font-normal">P: {item.phone} | WA: {item.whatsapp_number || item.phone}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary capitalize">
                              {item.role?.role_name || item.role || 'No Role'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-on-surface/90 dark:text-dark-on-surface/90 font-medium">
                            {item.store?.store_name || 'All Accessible Stores'}
                          </td>
                          <td className="px-6 py-4 text-xs text-outline font-normal">
                            {item.sub_departments?.map((sd: any) => sd.sub_department_name).join(', ') || '-'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {item.skills && item.skills.length > 0 ? (
                                item.skills.map((sk: any) => (
                                  <span key={sk.nature_id} className="px-2 py-0.5 text-[10px] font-medium bg-secondary/15 text-secondary dark:bg-dark-secondary/15 rounded">
                                    {sk.nature_name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-outline text-xs">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            {item.hourly_rate ? `${item.hourly_rate} KWD/hr` : '-'}
                          </td>
                          <td className="px-6 py-4">
                            {item.active ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" /> Approved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <UserLock className="w-3 h-3" /> Pending Approval
                              </span>
                            )}
                          </td>
                          {(canEditEmployee || hasPermission('accounts.delete_customuser')) && (
                            <td className="px-6 py-4 text-right space-x-2">
                              {canEditEmployee && (
                                <>
                                  {!item.active ? (
                                    <button
                                      onClick={() => handleOpenEditEmployee(item)}
                                      className="px-2.5 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded cursor-pointer transition-all bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 border border-amber-500/30"
                                      title="Approve employee & fill details"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                      <span>Approve & Edit</span>
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleOpenEditEmployee(item)}
                                        className="p-1.5 inline-flex bg-surface-container-high dark:bg-dark-surface-container-high text-outline hover:text-primary rounded border border-outline-variant dark:border-dark-outline-variant cursor-pointer transition-all"
                                        title="Edit Employee Profile"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      {/* {isOfficeStaffOrAdmin && (
                                        <button
                                          onClick={() => handleToggleDeactivateEmployee(item, false)}
                                          className="p-1.5 inline-flex bg-surface-container-high dark:bg-dark-surface-container-high text-outline hover:text-amber-500 rounded border border-outline-variant dark:border-dark-outline-variant cursor-pointer transition-all"
                                          title="Deactivate Account"
                                        >
                                          <UserX className="w-3.5 h-3.5" />
                                        </button>
                                      )} */}
                                    </>
                                  )}
                                </>
                              )}
                              {/* {hasPermission('accounts.delete_customuser') && (
                                <button
                                  onClick={() => handleDeleteEmployee(item.user_id)}
                                  className="p-1.5 inline-flex bg-surface-container-high dark:bg-dark-surface-container-high text-outline hover:text-red-500 rounded border border-outline-variant dark:border-dark-outline-variant cursor-pointer transition-all"
                                  title="Delete Account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )} */}
                            </td>
                          )}
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
                            className="p-1.5 inline-flex bg-surface-container-high dark:bg-dark-surface-container-high text-outline hover:text-primary rounded border border-outline-variant dark:border-dark-outline-variant cursor-pointer transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.rate_id)}
                            className="p-1.5 inline-flex bg-surface-container-high dark:bg-dark-surface-container-high text-outline hover:text-red-500 rounded border border-outline-variant dark:border-dark-outline-variant cursor-pointer transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredData.length > 0 && (() => {
            const totalItems = filteredData.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

            return (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-outline-variant dark:border-dark-outline-variant bg-surface-container-low dark:bg-dark-surface-container-low text-xs">
                <div className="flex items-center gap-4 text-outline font-medium">
                  <span>
                    Showing <strong className="text-on-surface dark:text-dark-on-surface">{totalItems > 0 ? startIndex + 1 : 0}</strong> to{' '}
                    <strong className="text-on-surface dark:text-dark-on-surface">{endIndex}</strong> of{' '}
                    <strong className="text-on-surface dark:text-dark-on-surface">{totalItems}</strong> entries
                  </span>
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="items-per-page-select" className="text-outline">Per page:</label>
                    <select
                      id="items-per-page-select"
                      value={itemsPerPage}
                      onChange={e => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded px-2 py-1 outline-none text-on-surface dark:text-dark-on-surface font-semibold cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="px-2.5 py-1.5 rounded border border-outline-variant dark:border-dark-outline-variant font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high text-on-surface dark:text-dark-on-surface cursor-pointer flex items-center gap-1 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Prev</span>
                    </button>

                    <span className="px-3 py-1 font-semibold text-on-surface dark:text-dark-on-surface">
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="px-2.5 py-1.5 rounded border border-outline-variant dark:border-dark-outline-variant font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high text-on-surface dark:text-dark-on-surface cursor-pointer flex items-center gap-1 transition-all"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Hourly Rate Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-[500px] h-[530px] rounded shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-outline-variant dark:border-dark-outline-variant shrink-0">
                <h3 className="text-base font-bold text-on-surface dark:text-dark-on-surface flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  {editItem ? 'Edit Hourly Rate' : 'Assign Worker Hourly Rate'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded text-outline hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Error inside context popup */}
              {errorMsg && (
                <div className="px-6 pt-4 shrink-0">
                  <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded flex items-center gap-2 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="font-semibold">{errorMsg}</span>
                  </div>
                </div>
              )}

              {/* Scrollable Body */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Searchable select helper for large worker list */}
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Select Technician / Worker</label>
                  {!editItem && (
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                      <input
                        type="text"
                        placeholder="Search technician name or ID..."
                        value={workerSearch}
                        onChange={e => setWorkerSearch(e.target.value)}
                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant rounded pl-8 pr-3 py-1.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                      />
                    </div>
                  )}
                  <select
                    required
                    disabled={!!editItem}
                    value={rateForm.worker}
                    onChange={e => setRateForm({ ...rateForm, worker: e.target.value })}
                    className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                  >
                    <option value="">Select Technician</option>
                    {extraWorkers
                      .filter(w => {
                        const keyword = workerSearch.toLowerCase();
                        return w.full_name.toLowerCase().includes(keyword) || (w.employee_no || '').toLowerCase().includes(keyword);
                      })
                      .map(w => (
                        <option key={w.user_id} value={w.user_id}>
                          {w.full_name} ({w.employee_no})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Hourly rate (KWD)</label>
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
                    <label className="block text-xs font-semibold text-outline mb-1.5">Effective From</label>
                    <input
                      required
                      type="date"
                      value={rateForm.effective_from}
                      onChange={e => setRateForm({ ...rateForm, effective_from: e.target.value })}
                      className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-outline mb-1.5">Effective To</label>
                    <input
                      type="date"
                      value={rateForm.effective_to}
                      onChange={e => setRateForm({ ...rateForm, effective_to: e.target.value })}
                      className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                    />
                  </div>
                </div>

                <button type="submit" className="hidden" id="rate-submit-btn" />
              </form>

              {/* Footer */}
              <div className="flex justify-end gap-2 p-6 border-t border-outline-variant dark:border-dark-outline-variant bg-surface-container shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer border-outline-variant text-outline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => document.getElementById('rate-submit-btn')?.click()}
                  className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-75"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Employee Modal */}
      <AnimatePresence>
        {showEmployeeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}
              onClick={() => setShowEmployeeModal(false)}
              className="absolute inset-0 bg-black"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-[700px] h-[680px] rounded shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-outline-variant dark:border-dark-outline-variant shrink-0">
                <h3 className="text-base font-bold text-on-surface dark:text-dark-on-surface flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  {editEmployeeItem ? 'Edit Employee Profile' : 'Add New Employee'}
                </h3>
                <button
                  onClick={() => setShowEmployeeModal(false)}
                  className="p-1.5 rounded text-outline hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Tabbed Navigation inside Popup */}
              <div className="px-6 pt-3 border-b border-outline-variant dark:border-dark-outline-variant bg-surface-container-low dark:bg-dark-surface-container-low shrink-0 flex gap-1 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setActiveFormTab('basic')}
                  className={`px-3 py-2 text-xs font-bold whitespace-nowrap transition-all border-b-2 -mb-[1px] flex items-center gap-1.5 ${activeFormTab === 'basic' ? 'border-primary text-primary bg-primary/5 dark:bg-primary/5' : 'border-transparent text-outline hover:text-on-surface'
                    }`}
                >
                  <User className="w-4 h-4" />
                  Personal Profile
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFormTab('access')}
                  className={`px-3 py-2 text-xs font-bold whitespace-nowrap transition-all border-b-2 -mb-[1px] flex items-center gap-1.5 ${activeFormTab === 'access' ? 'border-primary text-primary bg-primary/5 dark:bg-primary/5' : 'border-transparent text-outline hover:text-on-surface'
                    }`}
                >
                  <Wrench className="w-4 h-4" />
                  Store Access & Skills
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFormTab('payroll')}
                  className={`px-3 py-2 text-xs font-bold whitespace-nowrap transition-all border-b-2 -mb-[1px] flex items-center gap-1.5 ${activeFormTab === 'payroll' ? 'border-primary text-primary bg-primary/5 dark:bg-primary/5' : 'border-transparent text-outline hover:text-on-surface'
                    }`}
                >
                  <DollarSign className="w-4 h-4" />
                  Salary & Rate
                </button>
              </div>

              {/* Notice Banner for Unapproved Accounts */}
              {editEmployeeItem && editEmployeeItem.active === false && (
                <div className="mx-6 mt-3 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded text-xs flex items-center gap-2.5 shrink-0">
                  <UserLock className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>
                    <strong>Unapproved Account:</strong> Assigning role, store, or department details and clicking <strong>Save Employee</strong> will approve and activate this employee account.
                  </span>
                </div>
              )}

              {/* Context Error Notice inside Popup */}
              {errorMsg && (
                <div className="px-6 pt-4 shrink-0">
                  <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded flex items-center gap-2 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="font-semibold">{errorMsg}</span>
                  </div>
                </div>
              )}

              {/* Scrollable Form Body */}
              <form onSubmit={handleEmployeeSubmit} id="employee-full-form" className="flex-1 overflow-y-auto p-6">

                {/* TAB 1: Basic Personal Info */}
                {activeFormTab === 'basic' && (
                  <div className="space-y-4">
                    {/* Account Status & Deactivation toggle card */}


                    <div className="flex items-center gap-4 p-4 bg-surface-container-high/50 dark:bg-dark-surface-container-high/50 rounded border border-outline-variant/60 dark:border-dark-outline-variant/60">
                      {/* Interactive Profile preview */}
                      <div className="relative w-16 h-16 rounded-full overflow-hidden border border-outline dark:border-dark-outline bg-surface-container dark:bg-dark-surface-container flex items-center justify-center shrink-0">
                        {imagePreview ? (
                          <img src={imagePreview} alt="Selected preview" className="w-full h-full object-cover" />
                        ) : editEmployeeItem?.profile_image ? (
                          <img src={editEmployeeItem.profile_image} alt="Current" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-outline" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-xs font-bold text-on-surface dark:text-dark-on-surface mb-1">Employee Profile Photo</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => setProfileImage(e.target.files ? e.target.files[0] : null)}
                          className="text-xs text-outline file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1.5">Employee ID (Username) *</label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. EMP-1002"
                          value={employeeForm.employee_no}
                          onChange={e => setEmployeeForm({ ...employeeForm, employee_no: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1.5">Full Name *</label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. John Doe"
                          value={employeeForm.full_name}
                          onChange={e => setEmployeeForm({ ...employeeForm, full_name: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1.5">Email Address *</label>
                        <input
                          required
                          type="email"
                          placeholder="e.g. john@example.com"
                          value={employeeForm.email}
                          onChange={e => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1.5">Password {editEmployeeItem ? '(Leave blank to keep current)' : '*'}</label>
                        <input
                          required={!editEmployeeItem}
                          type="password"
                          placeholder="Enter account password"
                          value={employeeForm.password}
                          onChange={e => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1.5">Phone Number (8 digits) *</label>
                        <input
                          required
                          type="text"
                          maxLength={8}
                          placeholder="e.g. 12345678"
                          value={employeeForm.phone}
                          onChange={e => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1.5">WhatsApp Number (8 or 10 digits) *</label>
                        <input
                          required
                          type="text"
                          maxLength={10}
                          placeholder="e.g. 98765432"
                          value={employeeForm.whatsapp_number}
                          onChange={e => setEmployeeForm({ ...employeeForm, whatsapp_number: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        />
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-outline-variant/60 dark:border-dark-outline-variant/60 bg-surface-container-high/40 dark:bg-dark-surface-container-high/40 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${employeeForm.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                          {employeeForm.active ? <CheckCircle2 className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-on-surface dark:text-dark-on-surface">
                            Account Status: {employeeForm.active ? 'Active & Approved' : 'Deactivated / Pending Approval'}
                          </div>
                          <div className="text-[11px] text-outline">
                            {employeeForm.active ? 'User can sign in and perform assigned duties' : 'User account sign-in access is suspended'}
                          </div>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                        <input
                          type="checkbox"
                          checked={employeeForm.active}
                          onChange={e => setEmployeeForm({ ...employeeForm, active: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-surface-container-highest dark:bg-dark-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        <span className="ml-2.5 text-xs font-bold text-on-surface dark:text-dark-on-surface">
                          {employeeForm.active ? 'Active' : 'Deactivated'}
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* TAB 2: Store Access Permits & Skills */}
                {activeFormTab === 'access' && (
                  <div className="space-y-6">
                    {/* Account Status & Deactivation toggle card */}
                    {/* <div className="p-3.5 rounded-xl border border-outline-variant/60 dark:border-dark-outline-variant/60 bg-surface-container-high/40 dark:bg-dark-surface-container-high/40 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${employeeForm.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                          {employeeForm.active ? <CheckCircle2 className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-on-surface dark:text-dark-on-surface">
                            Account Status: {employeeForm.active ? 'Active & Approved' : 'Deactivated / Pending Approval'}
                          </div>
                          <div className="text-[11px] text-outline">
                            {employeeForm.active ? 'User can sign in and perform assigned duties' : 'User account sign-in access is suspended'}
                          </div>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                        <input
                          type="checkbox"
                          checked={employeeForm.active}
                          onChange={e => setEmployeeForm({ ...employeeForm, active: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-surface-container-highest dark:bg-dark-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        <span className="ml-2.5 text-xs font-bold text-on-surface dark:text-dark-on-surface">
                          {employeeForm.active ? 'Active' : 'Deactivated'}
                        </span>
                      </label>
                    </div> */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1.5">Primary Role</label>
                        <select
                          value={employeeForm.role}
                          onChange={e => setEmployeeForm({ ...employeeForm, role: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        >
                          <option value="">Select Role</option>
                          {roles.map(r => (
                            <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-outline mb-1.5">Home Store</label>
                        <select
                          value={employeeForm.store}
                          onChange={e => setEmployeeForm({ ...employeeForm, store: e.target.value })}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        >
                          <option value="">Select Home Store</option>
                          {stores.map(s => (
                            <option key={s.store_id} value={s.store_id}>{s.store_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-outline-variant/30 dark:border-dark-outline-variant/30">

                      {/* Accessible Stores Checkbox list with instant search bar and Area selection */}
                      <div className="flex flex-col h-[280px]">
                        <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5 shrink-0">
                          <Building2 className="w-4 h-4" />
                          Accessible Stores ({employeeForm.accessible_stores.length})
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 shrink-0">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                            <input
                              type="text"
                              placeholder="Filter stores..."
                              value={storeFilter}
                              onChange={e => setStoreFilter(e.target.value)}
                              className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded pl-8 pr-2 py-1.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                            />
                          </div>
                          <select
                            value={areaFilter}
                            onChange={e => setAreaFilter(e.target.value)}
                            className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded px-2.5 py-1.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                          >
                            <option value="">All Areas</option>
                            <option value="NO_AREA">Unassigned Area</option>
                            {areas.map(a => (
                              <option key={a.area_id} value={a.area_id}>{a.area_name}</option>
                            ))}
                          </select>
                        </div>

                        {(() => {
                          const filteredStores = stores.filter(s => {
                            const matchesSearch = s.store_name.toLowerCase().includes(storeFilter.toLowerCase());
                            if (!matchesSearch) return false;
                            if (!areaFilter) return true;
                            if (areaFilter === 'NO_AREA') return !s.area;
                            const storeAreaId = s.area?.area_id ?? s.area;
                            return String(storeAreaId) === String(areaFilter);
                          });

                          return (
                            <>
                              <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5 shrink-0 text-[11px]">
                                <span className="text-outline text-[11px]">
                                  {filteredStores.length} store{filteredStores.length !== 1 ? 's' : ''}
                                </span>
                                <div className="flex items-center gap-2 text-[11px]">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const filteredIds = filteredStores.map(s => String(s.store_id));
                                      const union = Array.from(new Set([...employeeForm.accessible_stores.map(String), ...filteredIds]));
                                      setEmployeeForm({ ...employeeForm, accessible_stores: union });
                                    }}
                                    className="text-primary hover:underline font-semibold"
                                  >
                                    + Select All {areaFilter ? 'in Area' : ''}
                                  </button>
                                  <span className="text-outline-variant dark:text-dark-outline-variant">|</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const filteredIdsSet = new Set(filteredStores.map(s => String(s.store_id)));
                                      const remaining = employeeForm.accessible_stores.filter(id => !filteredIdsSet.has(String(id)));
                                      setEmployeeForm({ ...employeeForm, accessible_stores: remaining });
                                    }}
                                    className="text-error hover:underline font-semibold"
                                  >
                                    - Deselect All {areaFilter ? 'in Area' : ''}
                                  </button>
                                </div>
                              </div>

                              <div className="flex-1 overflow-y-auto border border-outline-variant dark:border-dark-outline-variant rounded p-3 space-y-2 bg-surface/50 dark:bg-dark-surface/50">
                                {filteredStores.map(s => {
                                  const checked = employeeForm.accessible_stores.some(id => String(id) === String(s.store_id));
                                  const areaName = s.area?.area_name;
                                  return (
                                    <label key={s.store_id} className="flex items-center justify-between gap-2 text-xs text-on-surface/90 dark:text-dark-on-surface/90 cursor-pointer hover:text-primary dark:hover:text-primary py-0.5 select-none">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={e => {
                                            const sid = String(s.store_id);
                                            const newList = e.target.checked
                                              ? [...employeeForm.accessible_stores.filter(id => String(id) !== sid), sid]
                                              : employeeForm.accessible_stores.filter(id => String(id) !== sid);
                                            setEmployeeForm({ ...employeeForm, accessible_stores: newList });
                                          }}
                                          className="w-4 h-4 text-primary border-outline-variant dark:border-dark-outline-variant rounded focus:ring-primary shrink-0"
                                        />
                                        <span className="truncate">{s.store_name}</span>
                                      </div>
                                      {areaName && (
                                        <span className="text-[10px] text-outline dark:text-dark-outline bg-surface-container dark:bg-dark-surface-container px-1.5 py-0.5 rounded font-normal shrink-0">
                                          {areaName}
                                        </span>
                                      )}
                                    </label>
                                  );
                                })}
                                {filteredStores.length === 0 && (
                                  <div className="text-center py-6 text-xs text-outline">No stores match filter criteria</div>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Working Departments Checkbox list with instant search bar */}
                      <div className="flex flex-col h-[280px]">
                        <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5 shrink-0">
                          <Wrench className="w-4 h-4" />
                          Working Departments ({employeeForm.sub_departments.length})
                        </h4>
                        <div className="relative mb-2 shrink-0">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                          <input
                            type="text"
                            placeholder="Filter departments..."
                            value={deptFilter}
                            onChange={e => setDeptFilter(e.target.value)}
                            className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded pl-8 pr-3 py-1.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                          />
                        </div>
                        <div className="flex-1 overflow-y-auto border border-outline-variant dark:border-dark-outline-variant rounded p-3 space-y-2 bg-surface/50 dark:bg-dark-surface/50">
                          {(() => {
                            const userDeptIds = getLoggedInUserDepartmentIds();
                            const filteredSubDepts = userDeptIds
                              ? subDepartments.filter(sd => {
                                const deptId = sd.department?.department_id ?? sd.department;
                                return userDeptIds.has(Number(deptId));
                              })
                              : subDepartments;

                            return filteredSubDepts
                              .filter(d => d.sub_department_name.toLowerCase().includes(deptFilter.toLowerCase()))
                              .map(d => {
                                const checked = employeeForm.sub_departments.includes(d.sub_department_id);
                                return (
                                  <label key={d.sub_department_id} className="flex items-center gap-2.5 text-xs text-on-surface/90 dark:text-dark-on-surface/90 cursor-pointer hover:text-primary dark:hover:text-primary py-0.5 select-none">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={e => {
                                        const newList = e.target.checked
                                          ? [...employeeForm.sub_departments, d.sub_department_id]
                                          : employeeForm.sub_departments.filter(id => id !== d.sub_department_id);
                                        setEmployeeForm({ ...employeeForm, sub_departments: newList });
                                      }}
                                      className="w-4 h-4 text-primary border-outline-variant dark:border-dark-outline-variant rounded focus:ring-primary"
                                    />
                                    {d.sub_department_name}
                                  </label>
                                );
                              });
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Worker Technical Skills Checkbox list with instant search bar */}
                    <div className="flex flex-col h-[220px] pt-4 border-t border-outline-variant/30 dark:border-dark-outline-variant/30">
                      <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5 shrink-0">
                        <Award className="w-4 h-4" />
                        Worker Skilled Expertise ({employeeForm.skills.length})
                      </h4>
                      <div className="relative mb-2 shrink-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                        <input
                          type="text"
                          placeholder="Filter skills..."
                          value={skillFilter}
                          onChange={e => setSkillFilter(e.target.value)}
                          className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded pl-8 pr-3 py-1.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto border border-outline-variant dark:border-dark-outline-variant rounded p-3 grid grid-cols-1 md:grid-cols-2 gap-2 bg-surface/50 dark:bg-dark-surface/50">
                        {(() => {
                          const userDeptIds = getLoggedInUserDepartmentIds();
                          const filteredSkills = userDeptIds
                            ? skills.filter(sk => {
                              const skDeptId = sk.sub_department?.department?.department_id ?? sk.sub_department?.department;
                              return userDeptIds.has(Number(skDeptId));
                            })
                            : skills;

                          return filteredSkills
                            .filter(sk => sk.nature_name.toLowerCase().includes(skillFilter.toLowerCase()))
                            .map(sk => {
                              const checked = employeeForm.skills.includes(sk.nature_id);
                              return (
                                <label key={sk.nature_id} className="flex items-center gap-2.5 text-xs text-on-surface/90 dark:text-dark-on-surface/90 cursor-pointer hover:text-primary dark:hover:text-primary select-none">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={e => {
                                      const newList = e.target.checked
                                        ? [...employeeForm.skills, sk.nature_id]
                                        : employeeForm.skills.filter(id => id !== sk.nature_id);
                                      setEmployeeForm({ ...employeeForm, skills: newList });
                                    }}
                                    className="w-4 h-4 text-primary border-outline-variant dark:border-dark-outline-variant rounded focus:ring-primary"
                                  />
                                  {sk.nature_name}
                                </label>
                              );
                            });
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: Salary & Rate Config + wage History */}
                {activeFormTab === 'payroll' && (
                  <div className="space-y-6">
                    <div className="bg-surface-container-high/40 dark:bg-dark-surface-container-high/40 p-4 rounded border border-outline-variant/60 dark:border-dark-outline-variant/60 space-y-4">
                      <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Salary Wage Configuration</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-outline mb-1.5">Hourly Wage Rate (KWD)</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="e.g. 5.00"
                            value={employeeForm.hourly_rate}
                            onChange={e => setEmployeeForm({ ...employeeForm, hourly_rate: e.target.value })}
                            className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                          />
                        </div>
                        {/* <div className="flex items-center pt-6">
                          <label className="flex items-center gap-2 text-xs font-semibold text-on-surface dark:text-dark-on-surface cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={employeeForm.active}
                              onChange={e => setEmployeeForm({ ...employeeForm, active: e.target.checked })}
                              className="w-4 h-4 text-primary border-outline-variant rounded focus:ring-primary"
                            />
                            Mark User Active & Allowed to Sign In
                          </label>
                        </div> */}

                        {employeeForm.hourly_rate && (
                          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-outline-variant/30 dark:border-dark-outline-variant/30">
                            <div>
                              <label className="block text-xs font-semibold text-outline mb-1.5">Rate Effective From</label>
                              <input
                                type="date"
                                value={employeeForm.effective_from}
                                onChange={e => setEmployeeForm({ ...employeeForm, effective_from: e.target.value })}
                                className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-outline mb-1.5">Rate Effective To</label>
                              <input
                                type="date"
                                value={employeeForm.effective_to}
                                onChange={e => setEmployeeForm({ ...employeeForm, effective_to: e.target.value })}
                                className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Salary history table visible on editing item */}
                    {editEmployeeItem && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          Employee Salary Wage History Records
                        </h4>
                        <div className="border border-outline-variant dark:border-dark-outline-variant rounded overflow-hidden bg-surface/50 dark:bg-dark-surface/50">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-surface-container-high dark:bg-dark-surface-container-high border-b border-outline-variant dark:border-dark-outline-variant text-[10px] uppercase font-bold text-outline">
                                <th className="px-4 py-2.5">Hourly Rate</th>
                                <th className="px-4 py-2.5">Effective From</th>
                                <th className="px-4 py-2.5">Effective To</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant dark:divide-dark-outline-variant text-on-surface dark:text-dark-on-surface">
                              {employeeForm.rates && employeeForm.rates.length > 0 ? (
                                employeeForm.rates.map((r: any) => (
                                  <tr key={r.rate_id} className="hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low transition-all">
                                    <td className="px-4 py-3.5 font-semibold text-emerald-600 dark:text-emerald-400">{r.hourly_rate} KWD/hr</td>
                                    <td className="px-4 py-3.5 font-mono text-outline">{r.effective_from}</td>
                                    <td className="px-4 py-3.5 font-mono text-outline">{r.effective_to || 'Present'}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={3} className="px-4 py-5 text-center text-outline italic">No payroll wage history recorded.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </form>

              {/* Sticky Footer */}
              <div className="flex justify-end gap-2 p-6 border-t border-outline-variant dark:border-dark-outline-variant bg-surface-container dark:bg-dark-surface-container shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="px-4 py-2 border rounded text-xs font-semibold cursor-pointer border-outline-variant dark:border-dark-outline-variant text-outline hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high transition-colors"
                >
                  Cancel
                </button>

                {/* Submit entire form triggering native form validation */}
                <button
                  type="submit"
                  form="employee-full-form"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-70 transition-all"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Employee
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};