import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Loader2, Camera, CheckCircle2, Clock,
    Building2, Wrench, AlertCircle, User, Edit2, Settings, Plus, DollarSign
} from 'lucide-react';
import Can from '@/hooks/Can';
import {
    API_URL, type Ticket, type Allocation, type WorkLog, type Expense, type MediaCategory, type Media,
    AvatarCircle, MediaGrid, SectionTitle, Divider, statusColor
} from './TicketsTypesAndComponents';

interface TicketDetailModalProps {
    selectedTicket: Ticket | null;
    token: string | null;
    user: any;
    statuses: any[];
    workers: any[];
    subDepartments: any[];
    expenseTypes: any[];
    onClose: () => void;
    onRefreshList: () => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
    selectedTicket,
    token,
    user,
    statuses,
    workers,
    subDepartments,
    expenseTypes,
    onClose,
    onRefreshList,
}) => {
    if (!selectedTicket) return null;

    // Local Details State
    const [ticketDetails, setTicketDetails] = useState<Ticket>(selectedTicket);
    const [allocations, setAllocations] = useState<Allocation[]>([]);
    const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [mediaList, setMediaList] = useState<Media[]>([]);
    const [mediaCategories, setMediaCategories] = useState<MediaCategory[]>([]);
    const [, setNatureWorkers] = useState<any[]>([]);

    // UI / Action states
    const [modalLoading, setModalLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeWorkerId, setActiveWorkerId] = useState<number | null>(null);
    const [selectedExpenseTypeId, setSelectedExpenseTypeId] = useState<string>('');

    // Sub-Modals Open/Close States
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isLogHoursModalOpen, setIsLogHoursModalOpen] = useState(false);
    const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
    const [isManageIssueMediaOpen, setIsManageIssueMediaOpen] = useState(false);
    const [isManageCompletedMediaOpen, setIsManageCompletedMediaOpen] = useState(false);

    // Sub-Modals Edit Target Entities
    const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
    const [editingWorkLog, setEditingWorkLog] = useState<WorkLog | null>(null);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    // Form states
    const [newAllocation, setNewAllocation] = useState({ worker_id: '', planned_hours: '4.0', remarks: '' });
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [editWorkLogForm, setEditWorkLogForm] = useState({ hours: '', work_done: '' });
    const [editExpenseForm, setEditExpenseForm] = useState({ amount: '', remarks: '', expense_type_id: '' });
    const [editAllocationForm, setEditAllocationForm] = useState({ planned_hours: '', remarks: '' });
    const [expenseFiles, setExpenseFiles] = useState<Record<number, File[]>>({});
    const [replacingMediaId, setReplacingMediaId] = useState<number | null>(null);

    const uploadAbortRef = useRef<AbortController | null>(null);

    // Load ticket sub-data on mount
    useEffect(() => {
        uploadAbortRef.current?.abort();
        uploadAbortRef.current = new AbortController();
        setTicketDetails(selectedTicket);
        fetchTicketDetails(selectedTicket);
    }, [selectedTicket?.ticket_id]);

    // Keep activeWorkerId synced
    useEffect(() => {
        if (allocations.length > 0) {
            const exists = allocations.some(a => a.worker.user_id === activeWorkerId);
            if (!exists) setActiveWorkerId(allocations[0].worker.user_id);
        } else {
            setActiveWorkerId(null);
        }
    }, [allocations]);

    const getLoggedInUserDepartmentIds = (): Set<number> | null => {
        const roleName = ((user?.role as any)?.role_name || (user?.role as string) || '').toLowerCase();
        if ((user as any)?.is_superuser || roleName.includes('admin') || roleName.includes('administrator')) {
            return null;
        }
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
    };

    const isWorkerInDepartment = (w: any, targetDeptId: number) => {
        if (!w || !w.sub_departments || !Array.isArray(w.sub_departments) || w.sub_departments.length === 0) return false;
        const userDeptIds = getLoggedInUserDepartmentIds();

        return w.sub_departments.some((sd: any) => {
            let deptId: number | null = null;
            if (typeof sd === 'object' && sd !== null) {
                if (sd.department?.department_id) deptId = Number(sd.department.department_id);
                else if (typeof sd.department === 'number') deptId = Number(sd.department);
                else if (sd.sub_department_id) {
                    const found = subDepartments.find(item => item.sub_department_id === Number(sd.sub_department_id));
                    if (found) deptId = Number(found.department?.department_id ?? found.department);
                }
            } else if (typeof sd === 'number' || typeof sd === 'string') {
                const found = subDepartments.find(item => item.sub_department_id === Number(sd) || item.sub_department_name.toLowerCase() === String(sd).toLowerCase());
                if (found) deptId = Number(found.department?.department_id ?? found.department);
            }
            if (!deptId) return false;
            return (deptId === targetDeptId) && (userDeptIds === null || userDeptIds.has(deptId));
        });
    };

    const fetchTicketDetails = async (t: Ticket) => {
        setModalLoading(true);
        try {
            const headers = { Authorization: `Token ${token}` };
            const [resAlloc, resLog, resExp, resMed, resMediaCat, resNatureWorker] = await Promise.all([
                fetch(`${API_URL}/maintenance/allocation/?ticket=${t.ticket_id}`, { headers }),
                fetch(`${API_URL}/maintenance/worklog/?ticket=${t.ticket_id}`, { headers }),
                fetch(`${API_URL}/finance/expense/?ticket=${t.ticket_id}`, { headers }),
                fetch(`${API_URL}/common/media/?ticket=${t.ticket_id}`, { headers }),
                fetch(`${API_URL}/common/mediacategory/`, { headers }),
                fetch(`${API_URL}/maintenance/natureworker/?nature=${t.nature.nature_id}`, { headers }),
            ]);

            if (resAlloc.ok) setAllocations(await resAlloc.json());
            if (resLog.ok) setWorkLogs(await resLog.json());
            if (resExp.ok) setExpenses(await resExp.json());
            if (resMed.ok) setMediaList(await resMed.json());
            if (resMediaCat.ok) setMediaCategories(await resMediaCat.json());
            if (resNatureWorker.ok) {
                const rawNW = await resNatureWorker.json();
                const ticketDeptId = Number(t.department?.department_id ?? t.department);
                setNatureWorkers(rawNW.filter((nw: any) => nw.worker && isWorkerInDepartment(nw.worker, ticketDeptId)));
            }
        } catch (err) {
            console.error('Failed to load ticket details', err);
        } finally {
            setModalLoading(false);
        }
    };

    const refreshTicketData = async () => {
        if (!ticketDetails) return;
        const signal = uploadAbortRef.current?.signal;
        onRefreshList();
        try {
            const headers = { Authorization: `Token ${token}` };
            const [resTicket, resAlloc, resLog, resExp, resMed, resMediaCat, resNatureWorker] = await Promise.all([
                fetch(`${API_URL}/maintenance/ticket/${ticketDetails.ticket_id}/`, { headers, signal }),
                fetch(`${API_URL}/maintenance/allocation/?ticket=${ticketDetails.ticket_id}`, { headers, signal }),
                fetch(`${API_URL}/maintenance/worklog/?ticket=${ticketDetails.ticket_id}`, { headers, signal }),
                fetch(`${API_URL}/finance/expense/?ticket=${ticketDetails.ticket_id}`, { headers, signal }),
                fetch(`${API_URL}/common/media/?ticket=${ticketDetails.ticket_id}`, { headers, signal }),
                fetch(`${API_URL}/common/mediacategory/`, { headers, signal }),
                fetch(`${API_URL}/maintenance/natureworker/?nature=${ticketDetails.nature.nature_id}`, { headers, signal }),
            ]);

            let freshAllocations = [];
            let freshWorkLogs = [];
            let freshExpenses = [];

            if (resTicket.ok) setTicketDetails(await resTicket.json());
            if (resAlloc.ok) { freshAllocations = await resAlloc.json(); setAllocations(freshAllocations); }
            if (resLog.ok) { freshWorkLogs = await resLog.json(); setWorkLogs(freshWorkLogs); }
            if (resExp.ok) { freshExpenses = await resExp.json(); setExpenses(freshExpenses); }
            if (resMed.ok) setMediaList(await resMed.json());
            if (resMediaCat.ok) setMediaCategories(await resMediaCat.json());
            if (resNatureWorker.ok) {
                const rawNW = await resNatureWorker.json();
                const ticketDeptId = Number(ticketDetails.department?.department_id ?? ticketDetails.department);
                setNatureWorkers(rawNW.filter((nw: any) => nw.worker && isWorkerInDepartment(nw.worker, ticketDeptId)));
            }

            if (editingAllocation) {
                const match = freshAllocations.find((al: Allocation) => al.allocation_id === editingAllocation.allocation_id);
                if (match) setEditingAllocation(match);
            }
            if (editingWorkLog) {
                const match = freshWorkLogs.find((wl: WorkLog) => wl.worklog_id === editingWorkLog.worklog_id);
                if (match) setEditingWorkLog(match);
            }
            if (editingExpense) {
                const match = freshExpenses.find((ex: Expense) => ex.expense_id === editingExpense.expense_id);
                if (match) setEditingExpense(match);
            }
        } catch (err: any) {
            if (err?.name !== 'AbortError') console.error('Failed to refresh ticket data', err);
        }
    };

    const handleClose = () => {
        uploadAbortRef.current?.abort();
        uploadAbortRef.current = null;
        onClose();
    };

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleUpdateWorkLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingWorkLog) return;
        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/maintenance/worklog/${editingWorkLog.worklog_id}/`, {
                method: 'PATCH',
                headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ hours: editWorkLogForm.hours, work_done: editWorkLogForm.work_done })
            });
            if (response.ok) {
                setEditingWorkLog(null);
                await refreshTicketData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteWorkLog = async (worklogId: number) => {
        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/maintenance/worklog/${worklogId}/`, {
                method: 'DELETE',
                headers: { Authorization: `Token ${token}` }
            });
            if (response.ok) {
                setEditingWorkLog(null);
                await refreshTicketData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpdateExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingExpense) return;
        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/finance/expense/${editingExpense.expense_id}/`, {
                method: 'PATCH',
                headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: editExpenseForm.amount, remarks: editExpenseForm.remarks, expense_type: editExpenseForm.expense_type_id })
            });
            if (response.ok) {
                setEditingExpense(null);
                await refreshTicketData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteExpense = async (expenseId: number) => {
        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/finance/expense/${expenseId}/`, {
                method: 'DELETE',
                headers: { Authorization: `Token ${token}` }
            });
            if (response.ok) {
                setEditingExpense(null);
                await refreshTicketData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpdateAllocation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAllocation) return;
        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/maintenance/allocation/${editingAllocation.allocation_id}/`, {
                method: 'PATCH',
                headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ planned_hours: editAllocationForm.planned_hours, remarks: editAllocationForm.remarks })
            });
            if (response.ok) {
                setEditingAllocation(null);
                await refreshTicketData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteAllocation = async (allocationId: number) => {
        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/maintenance/allocation/${allocationId}/`, {
                method: 'DELETE',
                headers: { Authorization: `Token ${token}` }
            });
            if (response.ok) {
                setEditingAllocation(null);
                await refreshTicketData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const triggerReplaceMedia = (mediaId: number) => {
        setReplacingMediaId(mediaId);
        setTimeout(() => {
            document.getElementById('media-replacement-input')?.click();
        }, 50);
    };

    const handleMediaReplacementSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !replacingMediaId) return;
        setActionLoading(true);
        try {
            const formData = new FormData();
            formData.append('file_url', file);
            formData.append('file_name', file.name);

            const response = await fetch(`${API_URL}/common/media/${replacingMediaId}/`, {
                method: 'PATCH',
                headers: { Authorization: `Token ${token}` },
                body: formData
            });

            if (response.ok) {
                await refreshTicketData();
            } else {
                const err = await response.json();
                alert('Failed to replace media: ' + JSON.stringify(err));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
            setReplacingMediaId(null);
            e.target.value = '';
        }
    };

    const handleDeleteMedia = async (mediaId: number) => {
        if (!window.confirm('Are you sure you want to delete this media file?')) return;
        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/common/media/${mediaId}/`, {
                method: 'DELETE',
                headers: { Authorization: `Token ${token}` }
            });
            if (response.ok) {
                await refreshTicketData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddAllocation = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/maintenance/allocation/`, {
                method: 'POST',
                headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket: ticketDetails.ticket_id,
                    worker: newAllocation.worker_id,
                    planned_hours: newAllocation.planned_hours,
                    remarks: newAllocation.remarks
                })
            });
            if (response.ok) {
                const freshAlloc = await response.json();
                setNewAllocation({ worker_id: '', planned_hours: '4.0', remarks: '' });
                setIsAssignModalOpen(false);
                setActiveWorkerId(freshAlloc.worker?.user_id || Number(newAllocation.worker_id));
                await refreshTicketData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddWorkLog = async (e: React.FormEvent<HTMLFormElement>, workerId: number) => {
        e.preventDefault();
        const form = e.currentTarget;
        setActionLoading(true);
        const formData = new FormData(form);
        try {
            const response = await fetch(`${API_URL}/maintenance/worklog/`, {
                method: 'POST',
                headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket: ticketDetails.ticket_id,
                    worker: workerId,
                    hours: formData.get('hours'),
                    work_done: formData.get('work_done'),
                    work_date: new Date().toISOString().split('T')[0]
                })
            });
            if (response.ok) {
                form.reset();
                setIsLogHoursModalOpen(false);
                await refreshTicketData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const uploadMedia = async (file: File, categoryName: string, workerId?: number, expenseId?: number, skipRefresh = false): Promise<Media | null> => {
        if (!user) return null;
        if (!skipRefresh) setActionLoading(true);
        const signal = uploadAbortRef.current?.signal;
        try {
            const ticketDeptId = Number(ticketDetails.department?.department_id ?? ticketDetails.department);
            const cat = mediaCategories.find(c => {
                const isMatchName = c.category_name.toLowerCase() === categoryName.toLowerCase() ||
                    (categoryName.toLowerCase() === 'bills' && (c.category_name.toLowerCase() === 'bills' || c.category_name.toLowerCase() === 'bill' || c.category_name.toLowerCase() === 'receipt'));
                if (!isMatchName) return false;
                const cDeptId = Number(c.department?.department_id ?? c.department);
                return !cDeptId || cDeptId === ticketDeptId;
            }) || mediaCategories.find(c => c.category_name.toLowerCase() === categoryName.toLowerCase());

            const formData = new FormData();
            formData.append('ticket', ticketDetails.ticket_id.toString());
            formData.append('file_url', file);
            formData.append('file_name', file.name);
            formData.append('uploaded_by', (workerId || user.user_id).toString());
            if (cat) formData.append('category', cat.category_id.toString());
            if (expenseId) formData.append('expense', expenseId.toString());

            const response = await fetch(`${API_URL}/common/media/`, {
                method: 'POST',
                headers: { Authorization: `Token ${token}` },
                body: formData,
                signal
            });
            if (response.ok) {
                const createdMedia = await response.json();
                if (!skipRefresh) await refreshTicketData();
                return createdMedia;
            }
        } catch (err: any) {
            if (err?.name !== 'AbortError') console.error(err);
        } finally {
            if (!skipRefresh) setActionLoading(false);
        }
        return null;
    };

    const handleUploadIssueMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) uploadMedia(file, 'Before Repair');
        e.target.value = '';
    };

    const handleUploadCompletedMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) uploadMedia(file, 'After Repair');
        e.target.value = '';
    };

    const handleAddExpenseReceiptInEdit = async (file: File) => {
        if (!editingExpense) return;
        await uploadMedia(file, 'Bills', editingExpense.worker.user_id, editingExpense.expense_id);
    };

    const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>, workerId: number) => {
        e.preventDefault();
        setActionLoading(true);
        const formData = new FormData(e.currentTarget);
        const validFiles = (expenseFiles[workerId] || []).filter(f => f.size > 0);

        try {
            const signal = uploadAbortRef.current?.signal;
            const response = await fetch(`${API_URL}/finance/expense/`, {
                method: 'POST',
                headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket: ticketDetails.ticket_id,
                    worker: workerId,
                    expense_type: formData.get('expense_type_id'),
                    amount: formData.get('amount'),
                    remarks: formData.get('remarks'),
                    expense_date: new Date().toISOString().split('T')[0]
                }),
                signal
            });

            if (response.ok) {
                const createdExpense = await response.json();
                if (validFiles.length > 0) {
                    await Promise.all(
                        validFiles.map(file => uploadMedia(file, 'Bills', workerId, createdExpense.expense_id, true))
                    );
                }
                setExpenseFiles(prev => { const next = { ...prev }; delete next[workerId]; return next; });
                await refreshTicketData();
                setIsAddExpenseModalOpen(false);
            }
        } catch (err: any) {
            if (err?.name !== 'AbortError') console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpdateStatus = async (targetStatus: string | number | undefined, extra: Record<string, any> = {}) => {
        if (!targetStatus) return;
        let targetStatusId: number | undefined;

        if (typeof targetStatus === 'number') {
            targetStatusId = targetStatus;
        } else {
            const ticketDeptId = Number(ticketDetails.department?.department_id ?? ticketDetails.department);
            let match = statuses.find(s => {
                const sDeptId = Number(s.department?.department_id ?? s.department);
                return s.status_name?.toLowerCase() === targetStatus.toLowerCase() && (!sDeptId || sDeptId === ticketDeptId);
            }) || statuses.find(s => s.status_name?.toLowerCase() === targetStatus.toLowerCase());

            targetStatusId = match?.status_id;
        }

        if (!targetStatusId) {
            alert(`Error: Status '${targetStatus}' is not configured in the database.`);
            return;
        }

        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/maintenance/ticket/${ticketDetails.ticket_id}/`, {
                method: 'PATCH',
                headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: targetStatusId, ...extra })
            });
            if (response.ok) {
                setShowRejectForm(false);
                await refreshTicketData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleMoveToNextStatus = async () => {
        const ticketDeptId = Number(ticketDetails.department?.department_id ?? ticketDetails.department);
        const deptStatuses = statuses
            .filter(s => {
                const sDeptId = Number(s.department?.department_id ?? s.department);
                return !sDeptId || sDeptId === ticketDeptId;
            })
            .sort((a, b) => a.status_id - b.status_id);

        const forwardStatuses = deptStatuses.filter(s => s.status_name?.toLowerCase() !== 'rejected');
        const currentIdx = forwardStatuses.findIndex(s => s.status_id === ticketDetails.status.status_id);

        let nextStatusObj: any = null;
        if (currentIdx !== -1 && currentIdx + 1 < forwardStatuses.length) {
            nextStatusObj = forwardStatuses[currentIdx + 1];
        }

        if (!nextStatusObj) {
            alert('This ticket is already at the final status stage.');
            return;
        }

        if (nextStatusObj.status_name?.toLowerCase() === 'completed') {
            if (!window.confirm('Confirmation 1 of 2:\nAre you sure you want to mark this ticket as COMPLETED?')) return;
            if (!window.confirm('Confirmation 2 of 2 (Final):\nAre you ABSOLUTELY SURE you want to change ticket status to COMPLETED?')) return;
        }

        await handleUpdateStatus(nextStatusObj.status_id);
    };

    // Derived variables
    const ticketDeptId = Number(ticketDetails.department?.department_id ?? ticketDetails.department);

    const hasIssueCategoryForDept = mediaCategories.some(cat => {
        const isIssue = cat.category_name === 'Before Repair' || cat.category_name?.toLowerCase().includes('issue');
        if (!isIssue) return false;
        const catDeptId = Number(cat.department?.department_id ?? cat.department);
        return !catDeptId || catDeptId === ticketDeptId;
    });

    const issueMedia = mediaList.filter(m => {
        if (!m.category) return false;
        const isIssueCategory = m.category.category_name === 'Before Repair' || m.category.category_name?.toLowerCase().includes('issue');
        if (!isIssueCategory) return false;
        const catDeptId = Number(m.category.department?.department_id ?? m.category.department);
        return !catDeptId || catDeptId === ticketDeptId;
    });

    const completionCategoryNames = ['After Repair'];

    const hasCompletedCategoryForDept = mediaCategories.some(cat => {
        const isCompletionCat = completionCategoryNames.some(cName => cat.category_name?.toLowerCase() === cName.toLowerCase());
        if (!isCompletionCat) return false;
        const catDeptId = Number(cat.department?.department_id ?? cat.department);
        return !catDeptId || catDeptId === ticketDeptId;
    });

    const completedMedia = mediaList.filter(m => {
        if (!m.category) return false;
        const isCompletionCat = completionCategoryNames.some(cName => m.category?.category_name?.toLowerCase() === cName.toLowerCase());
        if (!isCompletionCat) return false;
        const catDeptId = Number(m.category.department?.department_id ?? m.category.department);
        return !catDeptId || catDeptId === ticketDeptId;
    });

    const hasBillsCategoryForDept = mediaCategories.some(cat => {
        const isBills = cat.category_name?.toLowerCase() === 'bills' || cat.category_name?.toLowerCase() === 'bill';
        if (!isBills) return false;
        const catDeptId = Number(cat.department?.department_id ?? cat.department);
        return !catDeptId || catDeptId === ticketDeptId;
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Hidden Media replacement input */}
            <input
                id="media-replacement-input"
                type="file"
                accept="image/*,video/*,.pdf"
                className="hidden"
                onChange={handleMediaReplacementSelected}
            />

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={handleClose} className="absolute inset-0 bg-black" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl scrollbar-thin"
            >
                <div className="sticky top-0 z-10 bg-surface-container dark:bg-dark-surface-container border-b border-outline-variant dark:border-dark-outline-variant px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs text-outline shrink-0">{ticketDetails.work_order_no}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColor(ticketDetails.status.status_name)}`}>
                            {ticketDetails.status.status_name}
                        </span>
                        <span className="text-sm font-bold text-on-surface dark:text-dark-on-surface truncate">{ticketDetails.title}</span>
                    </div>
                    <button onClick={handleClose} className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high cursor-pointer shrink-0 ml-2">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {modalLoading && (
                    <div className="absolute inset-0 z-20 bg-surface-container/80 dark:bg-dark-surface-container/80 flex items-center justify-center rounded-2xl">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                )}

                <div className="p-6 space-y-6">
                    {/* Creator card */}
                    <div className="flex items-start gap-4 p-4 bg-surface dark:bg-dark-surface rounded-2xl border border-outline-variant dark:border-dark-outline-variant">
                        <AvatarCircle user={ticketDetails.created_by} size="lg" />
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-base text-on-surface dark:text-dark-on-surface">{ticketDetails.created_by.full_name}</p>
                            {ticketDetails.created_by.role && <p className="text-xs text-primary font-semibold mt-0.5">{ticketDetails.created_by.role.role_name}</p>}
                            {ticketDetails.created_by.employee_no && <p className="text-xs text-outline mt-0.5">ID: {ticketDetails.created_by.employee_no}</p>}
                            <p className="text-xs text-outline mt-1">Raised on {new Date(ticketDetails.created_date).toLocaleString()}</p>
                        </div>
                        <div className="flex flex-col gap-1.5 items-end shrink-0">
                            <div className="flex items-center gap-1.5 text-[10px] text-outline"><Building2 className="w-3 h-3" /><span>{ticketDetails.store.store_name}</span></div>
                            <div className="flex items-center gap-1.5 text-[10px] text-outline"><Wrench className="w-3 h-3" /><span>{ticketDetails.department.department_name}</span></div>
                            <div className="flex items-center gap-1.5 text-[10px] text-outline"><AlertCircle className="w-3 h-3" /><span>{ticketDetails.nature.nature_name}</span></div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ticketDetails.priority.level >= 2 ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                                {ticketDetails.priority.priority_name} Priority
                            </span>
                        </div>
                    </div>

                    {/* Approved/Rejected info */}
                    {(ticketDetails.approved_by || ticketDetails.rejected_by) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {ticketDetails.approved_by && (
                                <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                                    <AvatarCircle user={ticketDetails.approved_by} size="sm" />
                                    <div>
                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Approved by</p>
                                        <p className="text-xs font-semibold text-on-surface dark:text-dark-on-surface">{ticketDetails.approved_by.full_name}</p>
                                        {ticketDetails.approved_date && <p className="text-[10px] text-outline">{new Date(ticketDetails.approved_date).toLocaleString()}</p>}
                                    </div>
                                </div>
                            )}
                            {ticketDetails.rejected_by && (
                                <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                                    <AvatarCircle user={ticketDetails.rejected_by} size="sm" />
                                    <div>
                                        <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">Rejected by</p>
                                        <p className="text-xs font-semibold text-on-surface dark:text-dark-on-surface">{ticketDetails.rejected_by.full_name}</p>
                                        {ticketDetails.reject_reason && <p className="text-[10px] text-outline mt-0.5 italic">"{ticketDetails.reject_reason}"</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status action bar */}
                    <div className="p-3 bg-surface dark:bg-dark-surface-container-low rounded-xl border border-outline-variant dark:border-dark-outline-variant flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-outline mr-1">Status:</span>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${statusColor(ticketDetails.status.status_name)}`}>
                            {ticketDetails.status.status_name}
                        </span>
                        <div className="flex-1" />

                        {ticketDetails.status.status_name === 'Open' && (
                            <Can permission={['maintenance.approve_ticket', 'maintenance.reject_ticket']}>
                                <button onClick={handleMoveToNextStatus} disabled={actionLoading} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50">
                                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve
                                </button>
                                <button onClick={() => setShowRejectForm(true)} disabled={actionLoading} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50">
                                    Reject
                                </button>
                            </Can>
                        )}

                        {ticketDetails.status.status_name === 'Approved' && (
                            <button onClick={handleMoveToNextStatus} disabled={actionLoading} className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50">
                                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />} Start Progress
                            </button>
                        )}

                        {ticketDetails.status.status_name === 'In Progress' && (
                            <Can permission="maintenance.complete_ticket">
                                <button onClick={handleMoveToNextStatus} disabled={actionLoading} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50">
                                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Mark Completed
                                </button>
                            </Can>
                        )}
                    </div>

                    {/* Rejection Form */}
                    {showRejectForm && (
                        <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-xl space-y-3">
                            <h4 className="text-xs font-bold text-red-600 dark:text-red-400">Rejection Reason</h4>
                            <textarea rows={2} className="w-full text-sm bg-surface dark:bg-dark-surface border border-outline-variant p-2 rounded outline-none text-on-surface dark:text-dark-on-surface" placeholder="Enter reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setShowRejectForm(false)} className="px-3 py-1 text-xs border border-outline-variant rounded cursor-pointer text-on-surface dark:text-dark-on-surface">Cancel</button>
                                <button onClick={() => handleUpdateStatus('Rejected', { reject_reason: rejectReason })} disabled={actionLoading} className="px-3 py-1 text-xs bg-red-600 text-white rounded cursor-pointer flex items-center gap-1">
                                    {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />} Confirm Reject
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <h4 className="text-xs font-bold text-outline uppercase tracking-wider mb-1.5">Issue Description</h4>
                        <p className="text-sm text-on-surface dark:text-dark-on-surface leading-relaxed p-4 bg-surface dark:bg-dark-surface rounded-xl border border-outline-variant whitespace-pre-wrap">
                            {ticketDetails.description}
                        </p>
                    </div>

                    {/* Before Repair */}
                    {(issueMedia.length > 0 || hasIssueCategoryForDept) && (
                        <>
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <SectionTitle icon={<Camera className="w-4 h-4" />} label="Before Repair" />
                                    {ticketDetails.status.status_name !== 'Rejected' && (
                                        <Can permission="maintenance.update_before_repair">
                                            <button onClick={() => setIsManageIssueMediaOpen(true)} className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-primary/20 transition-colors">
                                                <Settings className="w-3.5 h-3.5" /> Manage Media
                                            </button>
                                        </Can>
                                    )}
                                </div>
                                <MediaGrid items={issueMedia} emptyLabel="No Before Repair uploaded yet" />
                            </div>
                            <Divider />
                        </>
                    )}

                    {/* Allocated Persons */}
                    {Boolean(ticketDetails.approved_by || (ticketDetails.status.status_name.toLowerCase() !== 'open' && ticketDetails.status.status_name.toLowerCase() !== 'rejected')) && (
                        <div>
                            <SectionTitle icon={<User className="w-4 h-4" />} label="Allocated Persons" />
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-outline-variant pb-2 mb-4 gap-3">
                                {allocations.length > 0 ? (
                                    <div className="flex gap-2 overflow-x-auto pb-1 max-w-full scrollbar-thin">
                                        {allocations.map(a => (
                                            <button
                                                key={a.allocation_id}
                                                type="button"
                                                onClick={() => setActiveWorkerId(a.worker.user_id)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border cursor-pointer transition-all ${a.worker.user_id === activeWorkerId ? 'bg-primary/10 border-primary text-primary' : 'bg-surface border-outline-variant text-outline'}`}
                                            >
                                                <AvatarCircle user={a.worker} size="sm" />
                                                <span>{a.worker.full_name}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-outline italic">No workers allocated yet.</p>
                                )}

                                <Can permission="maintenance.add_allocation">
                                    <button onClick={() => setIsAssignModalOpen(true)} className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer shadow-sm shrink-0 hover:bg-primary-hover transition-colors">
                                        <Plus className="w-4 h-4" /> Assign Worker
                                    </button>
                                </Can>
                            </div>

                            {/* Selected Worker Content */}
                            {(() => {
                                const a = allocations.find(alloc => alloc.worker.user_id === activeWorkerId);
                                if (!a) return null;

                                const workerLogs = workLogs.filter(wl => wl.worker?.user_id === a.worker.user_id);
                                const workerExpenses = expenses.filter(exp => exp.worker?.user_id === a.worker.user_id);
                                const isMyWorker = (user as any)?.user_id === a.worker.user_id;

                                return (
                                    <div className="bg-surface dark:bg-dark-surface rounded-2xl border border-outline-variant overflow-hidden">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-outline-variant">
                                            <div className="flex items-center gap-3">
                                                <AvatarCircle user={a.worker} size="md" />
                                                <div>
                                                    <p className="font-bold text-sm text-on-surface dark:text-dark-on-surface">{a.worker.full_name}</p>
                                                    <div className="flex items-center gap-2 text-[10px] text-outline">
                                                        {a.worker.role && <span>{a.worker.role.role_name}</span>}
                                                        {a.worker.employee_no && <span>· ID: {a.worker.employee_no}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-1 rounded-lg">{a.planned_hours}h Planned</span>
                                                <Can permission="maintenance.change_allocation">
                                                    <button onClick={() => { setEditingAllocation(a); setEditAllocationForm({ planned_hours: a.planned_hours, remarks: a.remarks || '' }); }} className="p-1.5 rounded-lg border border-outline-variant hover:text-primary cursor-pointer text-on-surface dark:text-dark-on-surface">
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </Can>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-outline-variant">
                                            {/* Work Logs Panel */}
                                            <div className="p-4 space-y-4 bg-surface-container dark:bg-dark-surface-container">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[11px] font-bold text-outline uppercase tracking-wider flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Work Logs</p>
                                                    <Can permission={isMyWorker ? 'maintenance.can_change_my_log_time' : 'maintenance.can_change_others_log_time'}>
                                                        <button onClick={() => setIsLogHoursModalOpen(true)} className="flex items-center gap-1 px-2.5 py-1.5 border border-primary text-primary text-[10px] font-bold rounded-lg cursor-pointer hover:bg-primary/10 transition-colors">
                                                            <Plus className="w-3.5 h-3.5" /> Log Hours
                                                        </button>
                                                    </Can>
                                                </div>
                                                {workerLogs.length === 0 ? <p className="text-xs text-outline italic py-2">No hours logged yet.</p> : (
                                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                                                        {workerLogs.map(wl => (
                                                            <div key={wl.worklog_id} className="flex items-start justify-between text-xs p-3 bg-surface dark:bg-dark-surface rounded-xl border border-outline-variant/50">
                                                                <div>
                                                                    <p className="font-medium text-on-surface dark:text-dark-on-surface">{wl.work_done}</p>
                                                                    <p className="text-[10px] text-outline mt-0.5">{new Date(wl.work_date).toLocaleDateString()}</p>
                                                                </div>
                                                                <div className="text-right flex flex-col items-end gap-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="font-bold text-primary">{wl.hours}h</span>
                                                                        <Can permission={isMyWorker ? 'maintenance.can_change_my_log_time' : 'maintenance.can_change_others_log_time'}>
                                                                            <button onClick={() => { setEditingWorkLog(wl); setEditWorkLogForm({ hours: wl.hours, work_done: wl.work_done }); }} className="p-1 text-outline hover:text-primary cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                                                                        </Can>
                                                                    </div>
                                                                    <span className="text-[10px] text-emerald-600 font-bold">{wl.labour_amount} KWD</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Expenses Panel */}
                                            <div className="p-4 space-y-4 bg-surface-container-low dark:bg-dark-surface-container-low">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[11px] font-bold text-outline uppercase tracking-wider flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Logged Expenses</p>
                                                    <Can permission={isMyWorker ? 'maintenance.change_my_expence' : 'accounts.change_others_expence'}>
                                                        <button onClick={() => setIsAddExpenseModalOpen(true)} className="flex items-center gap-1 px-2.5 py-1.5 border border-primary text-primary text-[10px] font-bold rounded-lg cursor-pointer hover:bg-primary/10 transition-colors">
                                                            <Plus className="w-3.5 h-3.5" /> Add Expense
                                                        </button>
                                                    </Can>
                                                </div>
                                                {workerExpenses.length === 0 ? <p className="text-xs text-outline italic py-2">No expenses logged yet.</p> : (
                                                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                                                        {workerExpenses.map(exp => (
                                                            <div key={exp.expense_id} className="text-xs p-3 bg-surface dark:bg-dark-surface rounded-xl border border-outline-variant/50">
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div>
                                                                        <p className="font-semibold text-on-surface dark:text-dark-on-surface">{exp.expense_type.expense_name}</p>
                                                                        {exp.remarks && <p className="text-outline mt-0.5 italic">{exp.remarks}</p>}
                                                                    </div>
                                                                    <div className="flex flex-col items-end gap-1">
                                                                        <span className="font-bold text-emerald-600">{exp.amount} KWD</span>
                                                                        <Can permission={isMyWorker ? 'maintenance.change_my_expence' : 'accounts.change_others_expence'}>
                                                                            <button onClick={() => { setEditingExpense(exp); setEditExpenseForm({ amount: exp.amount, remarks: exp.remarks || '', expense_type_id: exp.expense_type.expense_type_id.toString() }); }} className="p-1 text-outline hover:text-primary cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                                                                        </Can>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* After Repair */}
                    {Boolean(ticketDetails.approved_by || (ticketDetails.status.status_name.toLowerCase() !== 'open' && ticketDetails.status.status_name.toLowerCase() !== 'rejected')) && (completedMedia.length > 0 || hasCompletedCategoryForDept) && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <SectionTitle icon={<CheckCircle2 className="w-4 h-4" />} label="After Repair" />
                                <Can permission="maintenance.update_after_repair">
                                    <button onClick={() => setIsManageCompletedMediaOpen(true)} className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-primary/20 transition-colors">
                                        <Settings className="w-3.5 h-3.5" /> Manage Media
                                    </button>
                                </Can>
                            </div>
                            <MediaGrid items={completedMedia} emptyLabel="No completion media uploaded yet" />
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Popups & Sub-Modals */}
            <AnimatePresence>
                {/* 1. ASSIGN WORKER MODAL */}
                {isAssignModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setIsAssignModalOpen(false)} className="absolute inset-0 bg-black" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-6 rounded-2xl shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Assign Worker</h3>
                                <button onClick={() => setIsAssignModalOpen(false)} className="p-1 rounded text-outline hover:bg-surface-container-high"><X className="w-4 h-4" /></button>
                            </div>
                            <form onSubmit={handleAddAllocation} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Select Worker</label>
                                    <select required value={newAllocation.worker_id} onChange={e => setNewAllocation({ ...newAllocation, worker_id: e.target.value })} className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface">
                                        <option value="">Select Worker to Assign</option>
                                        {workers.map(w => <option key={w.user_id} value={w.user_id}>{w.full_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Planned Hours</label>
                                    <input type="number" step="0.5" min="0.5" required value={newAllocation.planned_hours} onChange={e => setNewAllocation({ ...newAllocation, planned_hours: e.target.value })} className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Assignment Remarks</label>
                                    <input type="text" value={newAllocation.remarks} onChange={e => setNewAllocation({ ...newAllocation, remarks: e.target.value })} className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface" placeholder="Remarks (optional)" />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:bg-surface-container-high">Cancel</button>
                                    <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-primary-hover">
                                        {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Assign Worker
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* 2. LOG WORK HOURS MODAL */}
                {isLogHoursModalOpen && activeWorkerId && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setIsLogHoursModalOpen(false)} className="absolute inset-0 bg-black" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-6 rounded-2xl shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Log Work Hours</h3>
                                <button onClick={() => setIsLogHoursModalOpen(false)} className="p-1 rounded text-outline hover:bg-surface-container-high"><X className="w-4 h-4" /></button>
                            </div>
                            <p className="text-xs text-outline mb-4">
                                Logging hours for:{' '}
                                <span className="font-bold text-on-surface dark:text-dark-on-surface">
                                    {allocations.find(a => a.worker.user_id === activeWorkerId)?.worker.full_name}
                                </span>
                            </p>
                            <form onSubmit={e => handleAddWorkLog(e, activeWorkerId)} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Hours Worked</label>
                                    <input required name="hours" type="number" step="0.5" min="0.5" placeholder="e.g. 3.5" disabled={actionLoading} className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Work Description</label>
                                    <textarea required name="work_done" rows={3} placeholder="Describe tasks completed..." disabled={actionLoading} className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface" />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={() => setIsLogHoursModalOpen(false)} className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:bg-surface-container-high">Cancel</button>
                                    <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-primary-hover">
                                        {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Submit Log
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* 3. ADD EXPENSE MODAL */}
                {isAddExpenseModalOpen && activeWorkerId && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setIsAddExpenseModalOpen(false)} className="absolute inset-0 bg-black" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-6 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] scrollbar-thin">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Add Expense</h3>
                                <button onClick={() => setIsAddExpenseModalOpen(false)} className="p-1 rounded text-outline hover:bg-surface-container-high"><X className="w-4 h-4" /></button>
                            </div>
                            <p className="text-xs text-outline mb-4">
                                Adding expense for:{' '}
                                <span className="font-bold text-on-surface dark:text-dark-on-surface">
                                    {allocations.find(a => a.worker.user_id === activeWorkerId)?.worker.full_name}
                                </span>
                            </p>
                            <form onSubmit={e => handleAddExpense(e, activeWorkerId)} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Expense Category</label>
                                    <select required name="expense_type_id" disabled={actionLoading} value={selectedExpenseTypeId} onChange={e => setSelectedExpenseTypeId(e.target.value)} className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface">
                                        <option value="">Select Expense Type</option>
                                        {expenseTypes
                                            .filter(et => (et.department?.department_id ?? et.department) === ticketDetails.department.department_id)
                                            .map(et => (
                                                <option key={et.expense_type_id} value={et.expense_type_id}>
                                                    {et.expense_name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Amount (KWD)</label>
                                    <input required name="amount" type="number" step="0.01" min="0" placeholder="0.00" disabled={actionLoading} className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface" />
                                </div>
                                {(() => {
                                    const selectedExpTypeObj = expenseTypes.find(et => String(et.expense_type_id) === String(selectedExpenseTypeId));
                                    const isReceiptRequiredForType = selectedExpTypeObj ? selectedExpTypeObj.required !== false : true;
                                    const showReceiptUploadInAdd = hasBillsCategoryForDept && isReceiptRequiredForType;
                                    if (!showReceiptUploadInAdd) return null;

                                    return (
                                        <div>
                                            <label className="block text-xs font-semibold text-outline mb-1.5">Receipt Files</label>
                                            <div
                                                className={`relative border-2 border-dashed border-outline-variant dark:border-dark-outline-variant rounded-xl p-4 text-center hover:border-primary transition-all cursor-pointer ${actionLoading ? 'pointer-events-none opacity-50' : ''}`}
                                                onClick={() => !actionLoading && document.getElementById(`receipt-input-modal-${activeWorkerId}`)?.click()}
                                            >
                                                <input
                                                    id={`receipt-input-modal-${activeWorkerId}`}
                                                    type="file"
                                                    accept="image/*,application/pdf"
                                                    multiple
                                                    disabled={actionLoading}
                                                    className="sr-only"
                                                    onChange={e => {
                                                        const picked = Array.from(e.target.files || []);
                                                        if (picked.length) setExpenseFiles(prev => ({
                                                            ...prev,
                                                            [activeWorkerId]: [...(prev[activeWorkerId] || []), ...picked]
                                                        }));
                                                        e.target.value = '';
                                                    }}
                                                />
                                                <p className="text-xs text-outline">📎 Click or drag receipts (images / PDFs)</p>
                                            </div>
                                            {(expenseFiles[activeWorkerId] || []).length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {(expenseFiles[activeWorkerId] || []).map((f, idx) => (
                                                        <div key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-medium">
                                                            <span className="truncate max-w-[120px]">{f.name}</span>
                                                            <button type="button" disabled={actionLoading} onClick={() => setExpenseFiles(prev => ({ ...prev, [activeWorkerId]: prev[activeWorkerId].filter((_, i) => i !== idx) }))} className="text-primary/60 hover:text-red-500 cursor-pointer">✕</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Remarks</label>
                                    <input name="remarks" type="text" placeholder="Remarks (optional)" disabled={actionLoading} className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface" />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={() => setIsAddExpenseModalOpen(false)} className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:bg-surface-container-high">Cancel</button>
                                    <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-primary-hover">
                                        {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Add Expense
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* 4. EDIT ALLOCATION MODAL */}
                {editingAllocation && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setEditingAllocation(null)} className="absolute inset-0 bg-black" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-6 rounded-2xl shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Edit Allocation</h3>
                                <button onClick={() => setEditingAllocation(null)} className="p-1 rounded text-outline hover:bg-surface-container-high"><X className="w-4 h-4" /></button>
                            </div>
                            <form onSubmit={handleUpdateAllocation} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Planned Hours</label>
                                    <input type="number" step="0.5" min="0.5" required className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface" value={editAllocationForm.planned_hours} onChange={e => setEditAllocationForm({ ...editAllocationForm, planned_hours: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Remarks</label>
                                    <input type="text" className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface" value={editAllocationForm.remarks} onChange={e => setEditAllocationForm({ ...editAllocationForm, remarks: e.target.value })} placeholder="Remarks (optional)" />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={() => { if (window.confirm('Are you sure you want to remove this worker allocation?')) handleDeleteAllocation(editingAllocation.allocation_id); }} className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-500/10 rounded-lg mr-auto">Remove</button>
                                    <button type="button" onClick={() => setEditingAllocation(null)} className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:bg-surface-container-high">Cancel</button>
                                    <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover">Save</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* 5. EDIT WORK LOG MODAL */}
                {editingWorkLog && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setEditingWorkLog(null)} className="absolute inset-0 bg-black" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-6 rounded-2xl shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Edit Work Log</h3>
                                <button onClick={() => setEditingWorkLog(null)} className="p-1 rounded text-outline hover:bg-surface-container-high"><X className="w-4 h-4" /></button>
                            </div>
                            <form onSubmit={handleUpdateWorkLog} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Hours Worked</label>
                                    <input type="number" step="0.5" min="0.5" required className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface" value={editWorkLogForm.hours} onChange={e => setEditWorkLogForm({ ...editWorkLogForm, hours: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Description</label>
                                    <textarea required rows={3} className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface" value={editWorkLogForm.work_done} onChange={e => setEditWorkLogForm({ ...editWorkLogForm, work_done: e.target.value })} />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={() => { if (window.confirm('Are you sure you want to delete this work log?')) handleDeleteWorkLog(editingWorkLog.worklog_id); }} className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-500/10 rounded-lg mr-auto">Delete Log</button>
                                    <button type="button" onClick={() => setEditingWorkLog(null)} className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:bg-surface-container-high">Cancel</button>
                                    <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover">Save</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* 6. EDIT EXPENSE MODAL */}
                {editingExpense && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setEditingExpense(null)} className="absolute inset-0 bg-black" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-6 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] scrollbar-thin">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Edit Expense</h3>
                                <button onClick={() => setEditingExpense(null)} className="p-1 rounded text-outline hover:bg-surface-container-high"><X className="w-4 h-4" /></button>
                            </div>
                            <form onSubmit={handleUpdateExpense} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Expense Category</label>
                                    <select required value={editExpenseForm.expense_type_id} onChange={e => setEditExpenseForm({ ...editExpenseForm, expense_type_id: e.target.value })} className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface">
                                        <option value="">Expense Type</option>
                                        {expenseTypes
                                            .filter(et => (et.department?.department_id ?? et.department) === ticketDetails.department.department_id)
                                            .map(et => (
                                                <option key={et.expense_type_id} value={et.expense_type_id}>
                                                    {et.expense_name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Amount (KWD)</label>
                                    <input type="number" step="0.01" min="0" required value={editExpenseForm.amount} onChange={e => setEditExpenseForm({ ...editExpenseForm, amount: e.target.value })} className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Remarks</label>
                                    <input type="text" value={editExpenseForm.remarks} onChange={e => setEditExpenseForm({ ...editExpenseForm, remarks: e.target.value })} placeholder="Remarks (optional)" className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 text-on-surface dark:text-dark-on-surface" />
                                </div>
                                <div className="pt-2 border-t border-outline-variant dark:border-dark-outline-variant space-y-3">
                                    <h4 className="text-xs font-bold text-outline uppercase tracking-wider">Manage Receipt Attachments</h4>
                                    {(() => {
                                        const receiptsList: Media[] = [];
                                        if (editingExpense.receipt) receiptsList.push(editingExpense.receipt);
                                        if (editingExpense.receipts) {
                                            editingExpense.receipts.forEach(r => {
                                                if (!receiptsList.some(existing => existing.media_id === r.media_id)) {
                                                    receiptsList.push(r);
                                                }
                                            });
                                        }
                                        return (
                                            <MediaGrid
                                                items={receiptsList}
                                                emptyLabel="No receipts attached to this expense"
                                                onEdit={triggerReplaceMedia}
                                                onDelete={handleDeleteMedia}
                                            />
                                        );
                                    })()}
                                    {(() => {
                                        const currentEditExpTypeObj = expenseTypes.find(et => String(et.expense_type_id) === String(editExpenseForm.expense_type_id)) || editingExpense.expense_type;
                                        const isReceiptRequiredInEdit = currentEditExpTypeObj ? (currentEditExpTypeObj as any).required !== false : true;
                                        const showReceiptUploadInEdit = hasBillsCategoryForDept && isReceiptRequiredInEdit;
                                        if (!showReceiptUploadInEdit) return null;

                                        return (
                                            <div
                                                className={`relative border-2 border-dashed border-outline-variant dark:border-dark-outline-variant rounded-xl p-3 text-center hover:border-primary transition-all cursor-pointer ${actionLoading ? 'pointer-events-none opacity-50' : ''}`}
                                                onClick={() => !actionLoading && document.getElementById(`receipt-edit-upload-${editingExpense.expense_id}`)?.click()}
                                            >
                                                <input
                                                    id={`receipt-edit-upload-${editingExpense.expense_id}`}
                                                    type="file"
                                                    accept="image/*,application/pdf"
                                                    disabled={actionLoading}
                                                    className="sr-only"
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleAddExpenseReceiptInEdit(file);
                                                        e.target.value = '';
                                                    }}
                                                />
                                                <p className="text-[11px] text-outline">📎 Tap to upload and attach a new receipt</p>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant dark:border-dark-outline-variant">
                                    <button type="button" onClick={() => { if (window.confirm('Are you sure you want to delete this expense?')) handleDeleteExpense(editingExpense.expense_id); }} className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-500/10 rounded-lg mr-auto">Delete Expense</button>
                                    <button type="button" onClick={() => setEditingExpense(null)} className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:bg-surface-container-high">Cancel</button>
                                    <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover">Save</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* 7. MANAGE BEFORE REPAIR MODAL */}
                {isManageIssueMediaOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setIsManageIssueMediaOpen(false)} className="absolute inset-0 bg-black" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-2xl p-6 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Manage Before Repair</h3>
                                <button onClick={() => setIsManageIssueMediaOpen(false)} className="p-1 rounded text-outline hover:bg-surface-container-high"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="space-y-4">
                                <MediaGrid items={issueMedia} emptyLabel="No Before Repair uploaded yet" onEdit={triggerReplaceMedia} onDelete={handleDeleteMedia} />
                                <div className="pt-2 border-t border-outline-variant dark:border-dark-outline-variant">
                                    <input type="file" accept="image/*,video/*" onChange={handleUploadIssueMedia} disabled={actionLoading} className="hidden" id="upload-issue-media-popup" />
                                    <label htmlFor="upload-issue-media-popup" className={`w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-outline-variant dark:border-dark-outline-variant rounded-xl cursor-pointer hover:border-primary text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:text-primary transition-all ${actionLoading ? 'pointer-events-none opacity-50' : ''}`}>
                                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Upload New Issue Photo / Video
                                    </label>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* 8. MANAGE AFTER REPAIR MODAL */}
                {isManageCompletedMediaOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setIsManageCompletedMediaOpen(false)} className="absolute inset-0 bg-black" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-2xl p-6 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Manage After Repair</h3>
                                <button onClick={() => setIsManageCompletedMediaOpen(false)} className="p-1 rounded text-outline hover:bg-surface-container-high"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="space-y-4">
                                <MediaGrid items={completedMedia} emptyLabel="No completion media uploaded yet" onEdit={triggerReplaceMedia} onDelete={handleDeleteMedia} />
                                <div className="pt-2 border-t border-outline-variant dark:border-dark-outline-variant">
                                    <input type="file" accept="image/*,video/*" onChange={handleUploadCompletedMedia} disabled={actionLoading} className="hidden" id="upload-completed-media-popup" />
                                    <label htmlFor="upload-completed-media-popup" className={`w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-outline-variant dark:border-dark-outline-variant rounded-xl cursor-pointer hover:border-primary text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:text-primary transition-all ${actionLoading ? 'pointer-events-none opacity-50' : ''}`}>
                                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Upload After Repair / Completion Photo
                                    </label>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};