import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Edit2, Trash2, Settings, Wrench,
  Shield, CheckSquare, Layers, X, Loader2, AlertCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import type { RootState } from '../store';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

// ─── AG Grid v36 Theming API ─────────────────────────────────────────────────
const appTheme = themeQuartz.withParams({
  fontFamily: 'Inter, sans-serif',
  fontSize: 13,
  rowHeight: 52,
  headerHeight: 44,
  cellHorizontalPaddingScale: 1.4,
  backgroundColor: '#ffffff',
  foregroundColor: '#191c1d',
  headerBackgroundColor: '#f3f4f5',
  headerTextColor: '#414754',
  rowHoverColor: '#e7e8e9',
  borderColor: '#E0E2E6',
  accentColor: '#1A73E8',
  spacing: 6,
  wrapperBorderRadius: 0,
});

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const MaintenanceView: React.FC = () => {
  const { subpage } = useParams<{ subpage: string }>();
  const { token, user } = useSelector((state: RootState) => state.auth);

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

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [gridApi, setGridApi] = useState<any>(null);

  const onGridReady = (params: any) => {
    setGridApi(params.api);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, subpage]);

  useEffect(() => {
    if (gridApi) {
      gridApi.paginationGoToPage(currentPage - 1);
    }
  }, [currentPage, gridApi]);

  useEffect(() => {
    if (gridApi) {
      gridApi.setGridOption('paginationPageSize', itemsPerPage);
    }
  }, [itemsPerPage, gridApi]);

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);

  const columnDefs = useMemo<ColDef[]>(() => {
    const editActionCellRenderer = (params: any) => {
      const item = params.data;
      if (!item) return null;
      return (
        <div className="flex items-center gap-1.5 h-full">
          {/* <button
            onClick={() => handleOpenEdit(item)}
            className="p-1 inline-flex bg-surface-container-high dark:bg-dark-surface-container-high text-outline hover:text-primary rounded-lg border border-outline-variant dark:border-dark-outline-variant cursor-pointer transition-all"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button> */}
          <button
            onClick={() => handleDelete(item.nature_id || item.nature_worker_id || item.priority_id || item.status_id || item.category_id)}
            className="p-1.5 border border-error/30 bg-error-container/40 text-on-error-container hover:bg-error-container rounded cursor-pointer transition-colors inline-flex"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    };

    if (subpage === 'natures') {
      return [
        { headerName: 'Nature ID', field: 'nature_id', width: 120, cellClass: 'font-mono text-xs font-semibold' },
        { headerName: 'Nature Name', field: 'nature_name', flex: 2, minWidth: 180, cellClass: 'font-medium text-on-surface' },
        { headerName: 'Sub Department', field: 'sub_department.sub_department_name', flex: 1, minWidth: 150, valueGetter: p => p.data?.sub_department?.sub_department_name || 'N/A' },
        { headerName: 'Default Priority', field: 'default_priority.priority_name', flex: 1, minWidth: 150, cellClass: 'font-semibold text-primary', valueGetter: p => p.data?.default_priority?.priority_name || 'N/A' },
        {
          headerName: 'Status',
          field: 'active',
          width: 110,
          cellRenderer: (params: any) => (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium tracking-wide h-4 ${params.value ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600'
              }`}>

              {params.value ? 'Active' : 'Inactive'}
            </span>
          )
        },
        { headerName: 'Actions', width: 110, cellRenderer: editActionCellRenderer, sortable: false, filter: false }
      ];
    } else if (subpage === 'worker-assignments') {
      return [
        { headerName: 'Assignment ID', field: 'nature_worker_id', width: 150, cellClass: 'font-mono text-xs font-semibold' },
        { headerName: 'Nature of Work', field: 'nature.nature_name', flex: 2, minWidth: 200, cellClass: 'font-medium text-on-surface', valueGetter: p => p.data?.nature?.nature_name || 'N/A' },
        { headerName: 'Assigned Technician', field: 'worker.full_name', flex: 1.5, minWidth: 180, valueGetter: p => p.data?.worker?.full_name || 'N/A' },
        { headerName: 'Actions', width: 110, cellRenderer: editActionCellRenderer, sortable: false, filter: false }
      ];
    } else if (subpage === 'priorities') {
      return [
        { headerName: 'Priority ID', field: 'priority_id', width: 120, cellClass: 'font-mono text-xs font-semibold' },
        { headerName: 'Priority Label', field: 'priority_name', flex: 2, minWidth: 160, cellClass: 'font-medium text-on-surface' },
        { headerName: 'Level', field: 'level', width: 100, cellClass: 'font-mono text-xs', valueGetter: p => `LVL ${p.data?.level}` },
        { headerName: 'Department', field: 'department.department_name', flex: 1.5, minWidth: 150, valueGetter: p => p.data?.department?.department_name || 'N/A' },
        { headerName: 'Actions', width: 110, cellRenderer: editActionCellRenderer, sortable: false, filter: false }
      ];
    } else if (subpage === 'statuses') {
      return [
        { headerName: 'Status ID', field: 'status_id', width: 120, cellClass: 'font-mono text-xs font-semibold' },
        { headerName: 'Status Name', field: 'status_name', flex: 2, minWidth: 180, cellClass: 'font-medium text-on-surface' },
        { headerName: 'Department', field: 'department.department_name', flex: 1.5, minWidth: 150, valueGetter: p => p.data?.department?.department_name || 'N/A' },
        { headerName: 'Actions', width: 110, cellRenderer: editActionCellRenderer, sortable: false, filter: false }
      ];
    } else {
      // media-categories
      return [
        { headerName: 'Category ID', field: 'category_id', width: 120, cellClass: 'font-mono text-xs font-semibold' },
        { headerName: 'Category Name', field: 'category_name', flex: 2, minWidth: 200, cellClass: 'font-medium text-on-surface' },
        { headerName: 'Department Scope', field: 'department.department_name', flex: 1.5, minWidth: 150, valueGetter: p => p.data?.department?.department_name || 'Global' },
        { headerName: 'Actions', width: 110, cellRenderer: editActionCellRenderer, sortable: false, filter: false }
      ];
    }
  }, [subpage]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

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
      const [resDepts, resSubs] = await Promise.all([
        fetch(`${API_URL}/stores/department/`, { headers }),
        fetch(`${API_URL}/stores/subdepartment/`, { headers })
      ]);
      if (resDepts.ok) setExtraDepts(await resDepts.json());
      if (resSubs.ok) setExtraSubs(await resSubs.json());

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

  const getLoggedInUserDepartmentIds = (): Set<number> | null => {
    const roleName = (user?.role as any)?.role_name?.toLowerCase() || (user?.role as string)?.toLowerCase();
    if (roleName === 'admin' || roleName === 'administrator') return null;
    if (!user?.sub_departments || user.sub_departments.length === 0) return null;
    const deptIds = new Set<number>();
    user.sub_departments.forEach((sd: any) => {
      let sdObj = sd;
      if (typeof sd === 'string' || typeof sd === 'number') {
        sdObj = extraSubs.find(item =>
          item.sub_department_id === Number(sd) ||
          item.sub_department_name.toLowerCase() === String(sd).toLowerCase()
        );
      }
      if (sdObj) {
        const parentDeptId = Number(sdObj.department?.department_id ?? sdObj.department);
        if (parentDeptId) {
          deptIds.add(parentDeptId);
        }
      }
    });
    return deptIds;
  };

  const userDeptIds = getLoggedInUserDepartmentIds();
  const allowedDepts = userDeptIds
    ? extraDepts.filter(d => userDeptIds.has(Number(d.department_id)))
    : extraDepts;

  const allowedSubs = userDeptIds
    ? extraSubs.filter(s => {
      const sDeptId = Number(s.department?.department_id ?? s.department);
      return userDeptIds.has(sDeptId);
    })
    : extraSubs;

  const filteredData = data.filter(item => {
    const text = (item.nature_name || item.priority_name || item.status_name || item.category_name || item.worker?.full_name || '').toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedData = filteredData.slice(startIndex, endIndex);

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
          className="hidden sm:flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-primary/95 transition-all cursor-pointer shadow-sm"
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
        <>
          {/* Mobile View: Stacked Card Rows */}
          <div className="sm:hidden divide-y divide-outline-variant/30 border-t border-b border-outline-variant/30 bg-surface">
            {paginatedData.map(item => {
              const itemId = item.nature_id || item.nature_worker_id || item.priority_id || item.status_id || item.category_id;
              return (
                <button
                  key={itemId}
                  type="button"
                  onClick={() => handleOpenEdit(item)}
                  className="w-full text-left px-4 py-3.5 flex items-start gap-3 bg-surface active:bg-surface-container-high transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {subpage === 'natures' ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-on-surface text-sm truncate">{item.nature_name}</h4>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${item.active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                            }`}>
                            {item.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-outline">
                          <span className="font-mono text-[10px] font-semibold">ID: {item.nature_id}</span>
                          <span>·</span>
                          <span>🏢 {item.sub_department?.sub_department_name || 'No Dept'}</span>
                          <span>·</span>
                          <span className="text-primary font-medium">⚠️ {item.default_priority?.priority_name || 'No Priority'}</span>
                        </div>
                      </>
                    ) : subpage === 'worker-assignments' ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-on-surface text-sm truncate">{item.nature?.nature_name}</h4>
                          <span className="font-mono text-[10px] text-outline">ID: {item.nature_worker_id}</span>
                        </div>
                        <p className="text-[11px] text-outline">👤 Technician: <span className="text-on-surface font-medium">{item.worker?.full_name}</span></p>
                      </>
                    ) : subpage === 'priorities' ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-on-surface text-sm truncate">{item.priority_name}</h4>
                          <span className="text-[9px] font-bold bg-primary/5 px-2 py-0.5 rounded border border-primary/10 text-primary">LVL {item.level}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-outline">
                          <span className="font-mono text-[10px] text-outline">ID: {item.priority_id}</span>
                          <span>·</span>
                          <span>🏢 Department: {item.department?.department_name || 'N/A'}</span>
                        </div>
                      </>
                    ) : subpage === 'statuses' ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-on-surface text-sm truncate">{item.status_name}</h4>
                          <span className="font-mono text-[10px] text-outline">ID: {item.status_id}</span>
                        </div>
                        <p className="text-[11px] text-outline">🏢 Department: {item.department?.department_name || 'N/A'}</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-on-surface text-sm truncate">{item.category_name}</h4>
                          <span className="font-mono text-[10px] text-outline">ID: {item.category_id}</span>
                        </div>
                        <p className="text-[11px] text-outline">🏢 Department Scope: {item.department?.department_name || 'Global'}</p>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden sm:block">
            <div className="ag-theme-app w-full" style={{ height: 44 + Math.max(1, Math.min(itemsPerPage, filteredData.length)) * 52 + 10 }}>
              <AgGridReact
                theme={appTheme}
                rowData={filteredData}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                pagination={true}
                paginationPageSize={itemsPerPage}
                suppressPaginationPanel={true}
                onGridReady={onGridReady}
                onGridSizeChanged={(params) => params.api.sizeColumnsToFit()}
                rowHeight={52}
                headerHeight={44}
                rowClass="cursor-pointer"
                onRowClicked={(event) => {
                  if (event.data) {
                    handleOpenEdit(event.data);
                  }
                }}
              />
            </div>
          </div>

          {/* Custom Pagination Footer */}
          {!loading && filteredData.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border border-t-0 border-outline-variant rounded-b-2xl bg-surface-container-low">
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-outline">
                  {startIndex + 1}–{endIndex} of {totalItems.toLocaleString()}
                </span>
                <div className="flex items-center gap-1.5 text-[11px] text-outline">
                  <span>Per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={e => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-surface border border-outline-variant rounded px-1.5 py-0.5 text-[11px] text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="w-7 h-7 flex items-center justify-center rounded border border-outline-variant text-on-surface disabled:opacity-35 hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] text-on-surface font-medium px-2">{currentPage} / {totalPages}</span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="w-7 h-7 flex items-center justify-center rounded border border-outline-variant text-on-surface disabled:opacity-35 hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
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
                        {allowedSubs.map(s => <option key={s.sub_department_id} value={s.sub_department_id}>{s.sub_department_name}</option>)}
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
                        {allowedDepts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
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
                        {allowedDepts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
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
                        {allowedDepts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
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
      {/* Floating Action Button (FAB) for Mobile Add Config */}
      <button
        onClick={handleOpenCreate}
        className="sm:hidden fixed bottom-6 right-6 z-40 bg-primary hover:bg-primary-hover active:scale-95 text-on-primary shadow-lg p-4 rounded-full flex items-center justify-center transition-all cursor-pointer"
        title="Add Configuration"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
};
