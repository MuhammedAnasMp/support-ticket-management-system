import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { Search, Plus, AlertTriangle, Eye, Loader2, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, type ColDef } from 'ag-grid-community';

import Can from '@/hooks/Can';

import {
    API_URL, type Ticket, statusColor
} from './TicketsTypesAndComponents';
import { TicketDetailModal } from './TicketDetailModal';
import { DateRangePickerCard } from './DateRangePickerCard';
import { usePermission } from '@/hooks/usePermission';
import type { RootState } from '@/store';

ModuleRegistry.registerModules([AllCommunityModule]);

export const TicketsView: React.FC = () => {
    const { subpage } = useParams<{ subpage: string }>();
    const navigate = useNavigate();
    const { token, user } = useSelector((state: RootState) => state.auth);
    const { hasPermission } = usePermission();

    // Primary Lists
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [statuses, setStatuses] = useState<any[]>([]);
    const [natures, setNatures] = useState<any[]>([]);
    const [workers, setWorkers] = useState<any[]>([]);
    const [subDepartments, setSubDepartments] = useState<any[]>([]);
    const [expenseTypes, setExpenseTypes] = useState<any[]>([]);

    // Filters & Pagination
    const [search, setSearch] = useState('');
    const [filterStore, setFilterStore] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // Ticket Selection State
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

    // Creation Form State
    const [createForm, setCreateForm] = useState({ store_id: '', department_id: '', nature_id: '', priority_id: '', title: '', description: '', work_order_no: 0 });
    const [createTicketFiles, setCreateTicketFiles] = useState<File[]>([]);

    // App UI states
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const canCreateAllDepts = hasPermission('create_ticket_all_departments');

    const userDepartmentIds = useMemo(() => {
        if (canCreateAllDepts) return null;
        if (!user?.sub_departments || user.sub_departments.length === 0) return null;
        const deptIds = new Set<number>();
        user.sub_departments.forEach((sd: any) => {
            let sdObj = sd;
            if (typeof sd === 'string' || typeof sd === 'number') {
                sdObj = subDepartments.find(item => item.sub_department_id === Number(sd) || item.sub_department_name.toLowerCase() === String(sd).toLowerCase());
            }
            if (sdObj) {
                const parentDeptId = Number(sdObj.department?.department_id ?? sdObj.department);
                if (parentDeptId) deptIds.add(parentDeptId);
            }
        });
        return deptIds.size > 0 ? deptIds : null;
    }, [user, canCreateAllDepts, subDepartments]);

    const availableDepartments = useMemo(() => {
        if (canCreateAllDepts) return departments;
        if (!userDepartmentIds) return [];
        return departments.filter(d => userDepartmentIds.has(Number(d.department_id)));
    }, [departments, userDepartmentIds, canCreateAllDepts]);

    const fetchMetadata = async () => {
        try {
            const headers = { Authorization: `Token ${token}` };
            const [resStores, resDepts, resSubDepts, resStat, resNat, resWork, resExp] = await Promise.all([
                fetch(`${API_URL}/stores/store/`, { headers }),
                fetch(`${API_URL}/stores/department/`, { headers }),
                fetch(`${API_URL}/stores/subdepartment/`, { headers }),
                fetch(`${API_URL}/maintenance/status/`, { headers }),
                fetch(`${API_URL}/maintenance/worknature/`, { headers }),
                fetch(`${API_URL}/accounts/customuser/`, { headers }),
                fetch(`${API_URL}/finance/expensetype/`, { headers }),
            ]);

            if (resStores.ok) setStores(await resStores.json());
            if (resDepts.ok) setDepartments(await resDepts.json());
            if (resSubDepts.ok) setSubDepartments(await resSubDepts.json());
            if (resStat.ok) setStatuses(await resStat.json());
            if (resNat.ok) setNatures(await resNat.json());
            if (resWork.ok) {
                const uList = await resWork.json();
                setWorkers(uList.filter((u: any) => {
                    const roleName = u.role?.role_name?.toLowerCase() ?? '';
                    return roleName === 'technician' || roleName === 'worker';
                }));
            }
            if (resExp.ok) setExpenseTypes(await resExp.json());
        } catch (err) {
            console.error('Failed to load metadata', err);
        }
    };

    const fetchTickets = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const query = new URLSearchParams();
            query.set('page', String(page));
            query.set('page_size', String(pageSize));
            if (search) query.set('search', search);
            if (filterStore) query.set('store', filterStore);
            if (filterDept) query.set('department', filterDept);
            if (filterStatus) query.set('status', filterStatus);
            if (fromDate) query.set('from_date', fromDate);
            if (toDate) query.set('to_date', toDate);

            const response = await fetch(`${API_URL}/maintenance/ticket/?${query.toString()}`, {
                headers: { Authorization: `Token ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    setTickets(data);
                    setTotalCount(data.length);
                } else if (data && Array.isArray(data.results)) {
                    setTickets(data.results);
                    setTotalCount(data.count ?? data.results.length);
                }
            }
        } catch (err) {
            console.error('Failed to load tickets', err);
        } finally {
            setLoading(false);
        }
    }, [token, page, pageSize, search, filterStore, filterDept, filterStatus, fromDate, toDate]);

    useEffect(() => {
        fetchMetadata();
    }, [token]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        const selectedNature = natures.find(n => Number(n.nature_id) === Number(createForm.nature_id));
        const isMediaRequired = selectedNature ? (selectedNature.media_required !== false) : true;

        if (isMediaRequired && createTicketFiles.length < 2) {
            setMessage({ text: 'Please attach a minimum of 2 media files for the selected Work Nature.', type: 'error' });
            return;
        }

        setActionLoading(true);
        setMessage(null);
        try {
            const response = await fetch(`${API_URL}/maintenance/ticket/`, {
                method: 'POST',
                headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    store: createForm.store_id,
                    department: createForm.department_id,
                    nature: createForm.nature_id,
                    title: createForm.title,
                    description: createForm.description
                })
            });

            if (response.ok) {
                setMessage({ text: 'Support Ticket created successfully!', type: 'success' });
                setCreateForm({ store_id: '', department_id: '', nature_id: '', priority_id: '', title: '', description: '', work_order_no: 0 });
                setCreateTicketFiles([]);
                await fetchTickets();
                navigate('/tickets/all');
            }
        } catch (err) {
            setMessage({ text: 'Connection issue', type: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    // AG Grid Column Definitions
    const columnDefs = useMemo<ColDef<Ticket>[]>(() => [
        {
            headerName: 'Work Order No',
            field: 'work_order_no',
            width: 160,
            cellRenderer: (params: any) => (
                <span className="font-mono text-xs font-bold text-primary">{params.value}</span>
            )
        },
        {
            headerName: 'Store',
            valueGetter: params => params.data?.store?.store_name || '',
            flex: 1,
            minWidth: 140
        },
        {
            headerName: 'Title',
            field: 'title',
            flex: 2,
            minWidth: 200,
            cellRenderer: (params: any) => (
                <span className="font-medium text-on-surface dark:text-dark-on-surface">{params.value}</span>
            )
        },
        {
            headerName: 'Priority',
            field: 'priority',
            width: 130,
            cellRenderer: (params: any) => {
                const p = params.data?.priority;
                if (!p) return null;
                const isHigh = p.level >= 2;
                return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isHigh ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                        {p.priority_name}
                    </span>
                );
            }
        },
        {
            headerName: 'Status',
            field: 'status',
            width: 140,
            cellRenderer: (params: any) => {
                const statusName = params.data?.status?.status_name;
                if (!statusName) return null;
                return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusColor(statusName)}`}>
                        {statusName}
                    </span>
                );
            }
        },
        {
            headerName: 'Created Date',
            valueGetter: params => {
                if (!params.data?.created_date) return '';
                return new Date(params.data.created_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            },
            width: 140
        },
        {
            headerName: 'Actions',
            width: 110,
            sortable: false,
            filter: false,
            cellRenderer: (params: any) => (
                <button
                    type="button"
                    onClick={() => setSelectedTicket(params.data)}
                    className="inline-flex items-center gap-1 bg-surface-container-high dark:bg-dark-surface-container-high text-xs font-semibold px-3 py-1 rounded-lg border border-outline-variant dark:border-dark-outline-variant hover:bg-primary hover:text-white transition-colors"
                >
                    <Eye className="w-3.5 h-3.5" /> Manage
                </button>
            )
        }
    ], []);

    const defaultColDef = useMemo<ColDef>(() => ({
        resizable: true,
        sortable: true
    }), []);

    const handleDateRangeReset = () => {
        setFromDate('');
        setToDate('');
        setPage(1);
    };

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return (
        <div className="space-y-6">
            {message && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : 'bg-red-500/10 border-red-500/30 text-red-600'}`}>
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-sm font-semibold">{message.text}</span>
                </div>
            )}

            {subpage === 'create' ? (
                /* ── Create Ticket Form ─────────────────────────────────────────── */
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-container dark:bg-dark-surface-container p-6 rounded-2xl border border-outline-variant dark:border-dark-outline-variant">
                    <div className="flex items-center gap-3 mb-6">
                        <FileText className="w-6 h-6 text-primary" />
                        <h3 className="text-lg font-bold text-on-surface dark:text-dark-on-surface">Raise Support Ticket</h3>
                    </div>

                    <form onSubmit={handleCreateTicket} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold mb-1.5 text-on-surface dark:text-dark-on-surface">Store</label>
                                <select required value={createForm.store_id} onChange={e => setCreateForm({ ...createForm, store_id: e.target.value })} className="w-full text-sm bg-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface">
                                    <option value="">Select Store</option>
                                    {stores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1.5 text-on-surface dark:text-dark-on-surface">Department</label>
                                <select required disabled={!canCreateAllDepts} value={createForm.department_id} onChange={e => setCreateForm({ ...createForm, department_id: e.target.value, nature_id: '' })} className="w-full text-sm bg-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface">
                                    <Can permission="maintenance.create_ticket_all_departments"><option value="">Select Department</option></Can>
                                    {availableDepartments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                                </select>
                            </div>
                        </div>

                        {Boolean(createForm.department_id) && (
                            <div>
                                <label className="block text-xs font-semibold mb-1.5 text-on-surface dark:text-dark-on-surface">Nature of Work</label>
                                <select required value={createForm.nature_id} onChange={e => setCreateForm({ ...createForm, nature_id: e.target.value })} className="w-full text-sm bg-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface">
                                    <option value="">Select Nature of Work</option>
                                    {natures.filter(n => !n.department || Number(n.department) === Number(createForm.department_id)).map(n => (
                                        <option key={n.nature_id} value={n.nature_id}>{n.nature_name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold mb-1.5 text-on-surface dark:text-dark-on-surface">Issue Title</label>
                            <input required type="text" placeholder="Title" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} className="w-full text-sm bg-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface" />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold mb-1.5 text-on-surface dark:text-dark-on-surface">Description</label>
                            <textarea required rows={4} placeholder="Description" value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} className="w-full text-sm bg-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface" />
                        </div>

                        <div className="flex justify-end pt-3">
                            <button type="submit" disabled={actionLoading} className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold flex items-center gap-2 hover:bg-primary-hover transition-colors">
                                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />} Submit Ticket
                            </button>
                        </div>
                    </form>
                </motion.div>
            ) : (
                /* ── Ticket List with AG Grid & Filters ─────────────────────────── */
                <>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                            {/* Search bar */}
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                                <input
                                    type="text"
                                    placeholder="Search work order no, title..."
                                    value={search}
                                    onChange={e => {
                                        setSearch(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-full text-xs bg-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl pl-10 pr-4 py-2.5 text-on-surface dark:text-dark-on-surface"
                                />
                            </div>

                            {/* Filters & Actions */}
                            <div className="flex flex-wrap items-center gap-2.5">
                                <select
                                    value={filterStore}
                                    onChange={e => {
                                        setFilterStore(e.target.value);
                                        setPage(1);
                                    }}
                                    className="text-xs bg-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl p-2.5 text-on-surface dark:text-dark-on-surface"
                                >
                                    <option value="">All Stores</option>
                                    {stores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
                                </select>

                                <select
                                    value={filterDept}
                                    onChange={e => {
                                        setFilterDept(e.target.value);
                                        setPage(1);
                                    }}
                                    className="text-xs bg-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl p-2.5 text-on-surface dark:text-dark-on-surface"
                                >
                                    <option value="">All Departments</option>
                                    {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                                </select>

                                <select
                                    value={filterStatus}
                                    onChange={e => {
                                        setFilterStatus(e.target.value);
                                        setPage(1);
                                    }}
                                    className="text-xs bg-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl p-2.5 text-on-surface dark:text-dark-on-surface"
                                >
                                    <option value="">All Statuses</option>
                                    {statuses.map(s => <option key={s.status_id} value={s.status_name}>{s.status_name}</option>)}
                                </select>

                                {/* Date Range Picker Card */}
                                <DateRangePickerCard
                                    fromDate={fromDate}
                                    toDate={toDate}
                                    onDateRangeChange={(from, to) => {
                                        setFromDate(from);
                                        setToDate(to);
                                        setPage(1);
                                    }}
                                    onReset={handleDateRangeReset}
                                />

                                <Can permission={['maintenance.create_ticket', 'maintenance.add_ticket']}>
                                    <button
                                        onClick={() => navigate('/tickets/create')}
                                        className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-primary-hover transition-colors"
                                    >
                                        <Plus className="w-4 h-4" /> Raise Ticket
                                    </button>
                                </Can>
                            </div>
                        </div>
                    </div>

                    {/* AG Grid Container */}
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="h-14 bg-surface-container dark:bg-dark-surface-container animate-pulse rounded-xl" />
                            ))}
                        </div>
                    ) : (
                        <div >
                            <div className="ag-theme-alpine w-full h-[520px]">
                                <AgGridReact
                                    rowData={tickets}
                                    columnDefs={columnDefs}
                                    defaultColDef={defaultColDef}
                                    animateRows={true}
                                    rowHeight={52}
                                    headerHeight={44}
                                />
                            </div>

                            {/* Backend Pagination Bar */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-outline-variant dark:border-dark-outline-variant bg-surface-container-low dark:bg-dark-surface-container-low">
                                <div className="text-xs text-outline dark:text-dark-outline-variant font-medium">
                                    Showing {totalCount === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} tickets
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5 text-xs text-outline dark:text-dark-outline-variant">
                                        <span>Per page:</span>
                                        <select
                                            value={pageSize}
                                            onChange={e => {
                                                setPageSize(Number(e.target.value));
                                                setPage(1);
                                            }}
                                            className="bg-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg px-2 py-1 text-xs text-on-surface dark:text-dark-on-surface"
                                        >
                                            <option value={10}>10</option>
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            disabled={page <= 1 || loading}
                                            onClick={() => setPage(p => Math.max(p - 1, 1))}
                                            className="p-1.5 rounded-lg border border-outline-variant dark:border-dark-outline-variant text-xs disabled:opacity-40 hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high transition-colors text-on-surface dark:text-dark-on-surface"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span className="text-xs font-semibold px-2 text-on-surface dark:text-dark-on-surface">
                                            Page {page} of {totalPages}
                                        </span>
                                        <button
                                            disabled={page >= totalPages || loading}
                                            onClick={() => setPage(p => p + 1)}
                                            className="p-1.5 rounded-lg border border-outline-variant dark:border-dark-outline-variant text-xs disabled:opacity-40 hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high transition-colors text-on-surface dark:text-dark-on-surface"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Detail Modal Component */}
            <TicketDetailModal
                selectedTicket={selectedTicket}
                token={token}
                user={user}
                statuses={statuses}
                workers={workers}
                subDepartments={subDepartments}
                expenseTypes={expenseTypes}
                onClose={() => setSelectedTicket(null)}
                onRefreshList={fetchTickets}
            />
        </div>
    );
};