
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Loader2, Camera, CheckCircle2, Clock,
    Building2, Wrench, AlertCircle, User, Edit2, Settings, Plus, DollarSign, Trash2, FileText,
    UserPlus, Image, XCircle, Menu, Download, History as HistoryIcon, MessageCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TicketChatPanel } from './TicketChatPanel';
import Can, { permissionDebugEnabled } from '@/hooks/Can';
import { usePermission } from '@/hooks/usePermission';
import {
    API_URL, type Ticket, type Allocation, type WorkLog, type Expense, type MediaCategory, type Media,
    AvatarCircle, MediaGrid, SectionTitle, Divider, statusColor, getMediaUrl, isImage, isVideo
} from './TicketsTypesAndComponents';
import { VoiceRecorder } from '@/components/VoiceRecorder';

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
    const [natureWorkers, setNatureWorkers] = useState<any[]>([]);

    // UI / Action states
    const [modalLoading, setModalLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeWorkerId, setActiveWorkerId] = useState<number | null>(null);
    const [selectedExpenseTypeId, setSelectedExpenseTypeId] = useState<string>('');
    const [previewItem, setPreviewItem] = useState<{ url: string; name: string } | null>(null);

    const [isEditingTicket, setIsEditingTicket] = useState(false);
    const [editedTitle, setEditedTitle] = useState(selectedTicket.title);
    const [editedDescription, setEditedDescription] = useState(selectedTicket.description);

    const [showLocationRejectForm, setShowLocationRejectForm] = useState(false);
    const [locationRejectReason, setLocationRejectReason] = useState('');

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
    const [hourlyRateToCreate, setHourlyRateToCreate] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [editWorkLogForm, setEditWorkLogForm] = useState({ hours: '', work_done: '' });
    const [editExpenseForm, setEditExpenseForm] = useState({ amount: '', remarks: '', expense_type_id: '' });
    const [editAllocationForm, setEditAllocationForm] = useState({ planned_hours: '', remarks: '' });
    const [expenseFiles, setExpenseFiles] = useState<Record<number, File[]>>({});
    const [replacingMediaId, setReplacingMediaId] = useState<number | null>(null);
    const [isFabOpen, setIsFabOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

    const { hasPermission } = usePermission();
    const navigate = useNavigate();

    const uploadAbortRef = useRef<AbortController | null>(null);
    // const [natureWorkers, setNatureWorkers] = useState<any[]>([]);
    // Load ticket sub-data on mount
    useEffect(() => {
        uploadAbortRef.current?.abort();
        uploadAbortRef.current = new AbortController();
        setTicketDetails(selectedTicket);
        fetchTicketDetails(selectedTicket);
        setEditedTitle(selectedTicket.title);
        setEditedDescription(selectedTicket.description);
        setIsEditingTicket(false);
        setShowLocationRejectForm(false);
        setLocationRejectReason('');
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

            if (resTicket.ok) {
                const fresh = await resTicket.json();
                setTicketDetails(fresh);
                setEditedTitle(fresh.title);
                setEditedDescription(fresh.description);
            }
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
            const rawHours = parseFloat(editWorkLogForm.hours);
            const formattedHours = isNaN(rawHours) ? editWorkLogForm.hours : rawHours.toFixed(2);
            const response = await fetch(`${API_URL}/maintenance/worklog/${editingWorkLog.worklog_id}/`, {
                method: 'PATCH',
                headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ hours: formattedHours, work_done: editWorkLogForm.work_done })
            });
            if (response.ok) {
                setEditingWorkLog(null);
                await refreshTicketData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
            setEditingWorkLog(null);
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

        const currentEditExpTypeObj = expenseTypes.find(et => String(et.expense_type_id) === String(editExpenseForm.expense_type_id)) || editingExpense.expense_type;
        const isReceiptRequiredInEdit = currentEditExpTypeObj ? currentEditExpTypeObj.required !== false : true;

        const receiptsList: any[] = [];
        if (editingExpense.receipt) receiptsList.push(editingExpense.receipt);
        if (editingExpense.receipts) {
            editingExpense.receipts.forEach(r => {
                if (!receiptsList.some(existing => existing.media_id === r.media_id)) {
                    receiptsList.push(r);
                }
            });
        }

        if (isReceiptRequiredInEdit && receiptsList.length === 0) {
            alert("Receipt attachment is required for this expense category.");
            return;
        }

        setActionLoading(true);
        try {
            const rawAmount = parseFloat(editExpenseForm.amount);
            const formattedAmount = isNaN(rawAmount) ? editExpenseForm.amount : rawAmount.toFixed(2);
            const response = await fetch(`${API_URL}/finance/expense/${editingExpense.expense_id}/`, {
                method: 'PATCH',
                headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: formattedAmount, remarks: editExpenseForm.remarks, expense_type: editExpenseForm.expense_type_id })
            });
            if (response.ok) {
                setEditingExpense(null);
                await refreshTicketData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(false);
            setEditingExpense(null);
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
            const selectedWorkerObj = workers.find(w => String(w.user_id) === String(newAllocation.worker_id));
            const hasRate = selectedWorkerObj && selectedWorkerObj.hourly_rate !== null && selectedWorkerObj.hourly_rate !== undefined && selectedWorkerObj.hourly_rate !== '';

            if (newAllocation.worker_id && !hasRate) {
                if (!hourlyRateToCreate) {
                    alert("Please specify the hourly rate.");
                    setActionLoading(false);
                    return;
                }
                const rateResponse = await fetch(`${API_URL}/finance/employeerate/`, {
                    method: 'POST',
                    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        worker: newAllocation.worker_id,
                        hourly_rate: hourlyRateToCreate,
                        effective_from: new Date().toISOString().split('T')[0]
                    })
                });
                if (!rateResponse.ok) {
                    const errData = await rateResponse.json();
                    alert(Object.values(errData).flat().join(', ') || 'Failed to save employee rate.');
                    setActionLoading(false);
                    return;
                }
                // Update local worker hourly rate so hasRate checks pass if reused
                if (selectedWorkerObj) {
                    selectedWorkerObj.hourly_rate = hourlyRateToCreate;
                }
            }

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
                setHourlyRateToCreate('');
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
            const rawHoursStr = formData.get('hours') as string;
            const rawHoursVal = parseFloat(rawHoursStr);
            const hoursToSend = isNaN(rawHoursVal) ? rawHoursStr : rawHoursVal.toFixed(2);
            const response = await fetch(`${API_URL}/maintenance/worklog/`, {
                method: 'POST',
                headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket: ticketDetails.ticket_id,
                    worker: workerId,
                    hours: hoursToSend,
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
        const formData = new FormData(e.currentTarget);
        const selectedExpTypeObj = expenseTypes.find(et => String(et.expense_type_id) === String(formData.get('expense_type_id')));
        const isReceiptRequiredForType = selectedExpTypeObj ? selectedExpTypeObj.required !== false : true;
        const validFiles = (expenseFiles[workerId] || []).filter(f => f.size > 0);

        if (isReceiptRequiredForType && validFiles.length === 0) {
            alert("Receipt attachment is required for this expense category.");
            return;
        }

        setActionLoading(true);
        try {
            const signal = uploadAbortRef.current?.signal;
            const rawAmountStr = formData.get('amount') as string;
            const rawAmountVal = parseFloat(rawAmountStr);
            const amountToSend = isNaN(rawAmountVal) ? rawAmountStr : rawAmountVal.toFixed(2);
            const response = await fetch(`${API_URL}/finance/expense/`, {
                method: 'POST',
                headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket: ticketDetails.ticket_id,
                    worker: workerId,
                    expense_type: formData.get('expense_type_id'),
                    amount: amountToSend,
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
        let targetStatusName: string | undefined;

        if (typeof targetStatus === 'number') {
            targetStatusId = targetStatus;
            const matched = statuses.find(s => s.status_id === targetStatus);
            targetStatusName = matched?.status_name;
        } else {
            const ticketDeptId = Number(ticketDetails.department?.department_id ?? ticketDetails.department);
            let match = statuses.find(s => {
                const sDeptId = Number(s.department?.department_id ?? s.department);
                return s.status_name?.toLowerCase() === targetStatus.toLowerCase() && (!sDeptId || sDeptId === ticketDeptId);
            }) || statuses.find(s => s.status_name?.toLowerCase() === targetStatus.toLowerCase());

            targetStatusId = match?.status_id;
            targetStatusName = match?.status_name;
        }

        if (!targetStatusId) {
            alert(`Error: Status '${targetStatus}' is not configured in the database.`);
            return;
        }

        // Guard: Require at least one allocated worker before moving to 'In Progress'
        if (targetStatusName?.toLowerCase() === 'in progress' && allocations.length === 0) {
            alert('Cannot start progress: At least one worker must be allocated to this ticket before it can be moved to In Progress.');
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
            .sort((a, b) => (a.order ?? 1) - (b.order ?? 1));

        const forwardStatuses = deptStatuses.filter(s => s.status_name?.toLowerCase() !== 'rejected');
        const currentIdx = forwardStatuses.findIndex(s => s.order === ticketDetails.status.order);

        let nextStatusObj: any = null;
        if (currentIdx !== -1 && currentIdx + 1 < forwardStatuses.length) {
            if (ticketDetails.status.status_name?.toLowerCase() === 'open' && currentIdx + 2 < forwardStatuses.length) {
                nextStatusObj = forwardStatuses[currentIdx + 2];
            } else {
                nextStatusObj = forwardStatuses[currentIdx + 1];
            }
        }

        if (!nextStatusObj) {
            alert('This ticket is already at the final status stage.');
            return;
        }

        if (nextStatusObj.status_name?.toLowerCase() === 'location approval') {
            if (!window.confirm('Confirmation 1 of 2:\nAre you sure you want to mark this ticket as COMPLETED?')) return;
            if (!window.confirm('Confirmation 2 of 2 (Final):\nAre you ABSOLUTELY SURE you want to change ticket status to COMPLETED?')) return;
        }

        const extra: Record<string, any> = {};
        if (nextStatusObj.status_name?.toLowerCase() === 'in progress') {
            extra.approved_by = user?.user_id;
            extra.approved_date = new Date().toISOString();
        }


        await handleUpdateStatus(nextStatusObj.status_id, extra);
    };

    const canViewStatus = (statusName: string) => {
        const permission = `can_view_${statusName.toLowerCase().replace(/\s+/g, '_')}_ticket`;
        return hasPermission(permission) || hasPermission(`maintenance.${permission}`);
    };

    const canMoveStatus = (fromStatusName?: string, toStatusName?: string): boolean => {
        if (!fromStatusName || !toStatusName) return false;
        if (fromStatusName.toLowerCase().trim() === toStatusName.toLowerCase().trim()) return false;

        const fromSlug = fromStatusName.toLowerCase().trim().replace(/\s+/g, '_');
        const toSlug = toStatusName.toLowerCase().trim().replace(/\s+/g, '_');
        const permName = `can_move_${fromSlug}_to_${toSlug}`;

        return hasPermission(permName) || hasPermission(`maintenance.${permName}`);
    };

    const allowedDropdownStatuses = useMemo(() => {
        const ticketDeptId = Number(ticketDetails.department?.department_id ?? ticketDetails.department);
        return statuses.filter(s => {
            const sDeptId = Number(s.department?.department_id ?? s.department);
            if (sDeptId && sDeptId !== ticketDeptId) return false;

            if (s.status_id === ticketDetails.status.status_id) return true;
            return canViewStatus(s.status_name) && canMoveStatus(ticketDetails.status.status_name, s.status_name);
        });
    }, [statuses, ticketDetails.status, ticketDetails.department]);

    const handleStatusSelect = async (targetStatusId: number) => {
        const target = statuses.find(s => s.status_id === targetStatusId);
        if (!target) return;

        const targetName = target.status_name?.toLowerCase();
        const extra: Record<string, any> = {};

        if (targetName === 'rejected') {
            const reason = window.prompt(`Please provide a reason for rejecting ticket ${ticketDetails.work_order_no}:`);
            if (reason === null) return;
            extra.reject_reason = reason;
        } else if (targetName === 'location approval') {
            if (!window.confirm('Confirmation 1 of 2:\nAre you sure you want to mark this ticket as COMPLETED?')) return;
            if (!window.confirm('Confirmation 2 of 2 (Final):\nAre you ABSOLUTELY SURE you want to change ticket status to COMPLETED?')) return;
        } else if (targetName === 'in progress') {
            extra.approved_by = user?.user_id;
            extra.approved_date = new Date().toISOString();
        }

        await handleUpdateStatus(targetStatusId, extra);
    };

    const handleSaveTicketEdits = async () => {
        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/maintenance/ticket/${ticketDetails.ticket_id}/`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: editedTitle,
                    description: editedDescription
                })
            });
            if (response.ok) {
                setIsEditingTicket(false);
                await refreshTicketData();
            } else {
                const err = await response.json();
                alert(`Failed to save changes: ${JSON.stringify(err)}`);
            }
        } catch (err) {
            console.error(err);
            alert('Network error saving changes');
        } finally {
            setActionLoading(false);
        }
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Hidden Media replacement input */}
            <input
                id="media-replacement-input"
                type="file"
                accept="image/*,video/*,.pdf"
                className="hidden"
                onChange={handleMediaReplacementSelected}
            />

            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={handleClose}
                className="absolute inset-0 bg-black touch-manipulation"
            />

            {/* Main Modal Panel / Mobile Bottom Sheet */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 20 }}
                className={`relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full ${isChatOpen ? 'max-w-7xl' : 'max-w-4xl'} max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-t-xl sm:rounded shadow-2xl overflow-hidden transition-all duration-300`}
            >
                {/* Header Toolbar Standard */}
                <div className="sticky top-0 z-10 bg-surface-container dark:bg-dark-surface-container border-b border-outline-variant dark:border-dark-outline-variant px-4 sm:px-5 py-2.5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <span className="font-mono text-xs font-semibold text-outline shrink-0">{ticketDetails.work_order_no}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColor(ticketDetails.status.status_name)}`}>
                            {ticketDetails.status.status_name}
                        </span>
                        {isEditingTicket ? (
                            <input
                                type="text"
                                value={editedTitle}
                                onChange={e => setEditedTitle(e.target.value)}
                                className="text-xs sm:text-sm font-bold bg-surface border border-outline rounded px-2.5 py-1 text-on-surface focus:outline-none focus:border-primary min-w-[200px]"
                            />
                        ) : (
                            <span className="text-xs sm:text-sm font-bold text-on-surface dark:text-dark-on-surface truncate">{ticketDetails.title}</span>
                        )}
                    </div>


                    <div className="flex items-center gap-2 shrink-0 ml-2">
                        <button
                            onClick={() => setIsChatOpen(prev => !prev)}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant hover:bg-surface-container-high text-xs font-semibold text-primary hover:text-primary-hover transition-all cursor-pointer active:scale-95 touch-manipulation"
                            title="Toggle Chatroom"
                            type="button"
                        >
                            <MessageCircle className="w-4 h-4" />
                            <span>Messages</span>
                        </button>

                        <button
                            onClick={handleClose}
                            className="p-2 rounded-lg text-outline hover:bg-surface-container-high active:scale-95 transition-transform min-h-[15px] min-w-[44px] flex items-center justify-center cursor-pointer touch-manipulation"
                            aria-label="Close Modal"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Parent split-screen container */}
                <div className="flex flex-1 overflow-hidden relative">
                    {/* Modal Body Container */}
                    <div className="p-4 sm:p-5 space-y-4 overflow-y-auto scrollbar-thin flex-1">
                        {modalLoading ? (
                            /* Structural Skeleton Loader for Data Fetching */
                            <div className="space-y-4 animate-pulse">
                                <div className="p-3 sm:p-4 bg-surface dark:bg-dark-surface rounded border border-outline-variant dark:border-dark-outline-variant flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-outline-variant/40 dark:bg-dark-outline-variant/40 shrink-0" />
                                    <div className="space-y-1.5 flex-1">
                                        <div className="h-3.5 bg-outline-variant/40 dark:bg-dark-outline-variant/40 rounded w-1/3" />
                                        <div className="h-2.5 bg-outline-variant/30 dark:bg-dark-outline-variant/30 rounded w-1/4" />
                                    </div>
                                </div>
                                <div className="h-24 bg-surface dark:bg-dark-surface rounded border border-outline-variant dark:border-dark-outline-variant p-3 sm:p-4 space-y-2">
                                    <div className="h-2.5 bg-outline-variant/40 dark:bg-dark-outline-variant/40 rounded w-1/6" />
                                    <div className="h-2.5 bg-outline-variant/30 dark:bg-dark-outline-variant/30 rounded w-full" />
                                    <div className="h-2.5 bg-outline-variant/30 dark:bg-dark-outline-variant/30 rounded w-2/3" />
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Creator Information Card */}
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 p-3 sm:p-4 bg-surface dark:bg-dark-surface rounded border border-outline-variant dark:border-dark-outline-variant">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <AvatarCircle user={ticketDetails.created_by} size="md" />
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm text-on-surface dark:text-dark-on-surface truncate">{ticketDetails.created_by.full_name}</p>
                                            {ticketDetails.created_by.role && <p className="text-xs text-primary font-semibold mt-0.5">{ticketDetails.created_by.role.role_name}</p>}
                                            {ticketDetails.created_by.employee_no && <p className="text-xs text-outline mt-0.5">ID: {ticketDetails.created_by.employee_no}</p>}
                                            <p className="text-[11px] text-outline mt-1">
                                                Raised on {new Date(ticketDetails.created_date).toLocaleString()}
                                                {ticketDetails.age_days !== undefined && (
                                                    <span className="font-semibold text-primary ml-1.5" title="Days spent in current status">
                                                        ({Number(ticketDetails.age_days).toFixed(1)} days active)
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap sm:flex-col gap-1.5 items-start sm:items-end shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-outline-variant dark:border-dark-outline-variant w-full sm:w-auto">

                                        <div className="flex items-center gap-2 text-xs text-outline"><Building2 className="w-4 h-4 shrink-0 text-outline" /><span>{ticketDetails.store.store_name}</span></div>
                                        <div className="flex items-center gap-2 text-xs text-outline"><Wrench className="w-4 h-4 shrink-0 text-outline" /><span>{ticketDetails.department.department_name}</span></div>
                                        <div className="flex items-center gap-2 text-xs text-outline"><AlertCircle className="w-4 h-4 shrink-0 text-outline" /><span>{ticketDetails.nature.nature_name}</span></div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ticketDetails.priority.level >= 2 ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                                            {ticketDetails.priority.priority_name} Priority
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-outline">
                                    <span className="font-semibold text-xs text-outline dark:text-dark-outline">Status:</span>
                                    {allowedDropdownStatuses.length > 1 ? (
                                        <select
                                            value={ticketDetails.status.status_id}
                                            disabled={actionLoading}
                                            onChange={e => handleStatusSelect(Number(e.target.value))}
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border border-outline-variant dark:border-dark-outline-variant outline-none cursor-pointer focus:ring-1 focus:ring-primary/20 ${statusColor(ticketDetails.status.status_name)}`}
                                        >
                                            {allowedDropdownStatuses.map(st => (
                                                <option key={st.status_id} value={st.status_id} className="text-xs bg-surface text-on-surface">
                                                    {st.status_name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColor(ticketDetails.status.status_name)}`}>
                                            {ticketDetails.status.status_name}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => navigate(`/ticket/${ticketDetails.ticket_id}/history`)}
                                        className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-md border border-outline-variant hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high text-primary hover:text-primary-hover transition-colors ml-2 cursor-pointer active:scale-95 shrink-0"
                                        title="View Ticket History Logs"
                                        type="button"
                                    >
                                        <HistoryIcon className="w-3.5 h-3.5" />
                                        History Log
                                    </button>
                                </div>
                                {/* Approved / Rejected Notifications */}
                                {(ticketDetails.approved_by || ticketDetails.rejected_by || ticketDetails.location_approval === 'Approved' || ticketDetails.location_approval === 'Rejected') && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {ticketDetails.rejected_by && (
                                            <div className="flex items-center gap-3 p-2 sm:p-2.5 bg-red-500/5 border border-red-500/20 rounded-lg">
                                                <AvatarCircle user={ticketDetails.rejected_by} size="sm" />
                                                <div>
                                                    <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">Rejected by</p>
                                                    <p className="text-xs font-semibold text-on-surface dark:text-dark-on-surface">
                                                        {ticketDetails.rejected_by.full_name}
                                                        {ticketDetails.rejected_date && <span className="text-[10px] text-outline font-normal ml-1.5">({new Date(ticketDetails.rejected_date).toLocaleString()})</span>}
                                                    </p>
                                                    {ticketDetails.reject_reason && <p className="text-[10px] text-outline mt-0.5 italic">"{ticketDetails.reject_reason}"</p>}
                                                </div>
                                            </div>
                                        )}
                                        {ticketDetails.approved_by && (
                                            <div className="flex items-center gap-3 p-2 sm:p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                                                <AvatarCircle user={ticketDetails.approved_by} size="sm" />
                                                <div>
                                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Approved by</p>
                                                    <p className="text-xs font-semibold text-on-surface dark:text-dark-on-surface">
                                                        {ticketDetails.approved_by.full_name}
                                                        {ticketDetails.approved_date && <span className="text-[10px] text-outline font-normal ml-1.5">({new Date(ticketDetails.approved_date).toLocaleString()})</span>}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        {ticketDetails.location_approval === 'Approved' && (
                                            <div className="flex items-center gap-3 p-2 sm:p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                                                {ticketDetails.location_approved_by ? (
                                                    <AvatarCircle user={ticketDetails.location_approved_by} size="sm" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 font-bold text-xs">L</div>
                                                )}
                                                <div>
                                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Location Approved</p>
                                                    <p className="text-xs font-semibold text-on-surface dark:text-dark-on-surface">
                                                        {ticketDetails.location_approved_by?.full_name || 'Store / Location Manager'}
                                                        {ticketDetails.location_approved_date && <span className="text-[10px] text-outline font-normal ml-1.5">({new Date(ticketDetails.location_approved_date).toLocaleString()})</span>}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        {ticketDetails.location_approval === 'Rejected' && (
                                            <div className="flex items-center gap-3 p-2 sm:p-2.5 bg-red-500/5 border border-red-500/20 rounded-lg">
                                                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 font-bold text-xs">L</div>
                                                <div>
                                                    <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">Location Rejected</p>
                                                    {ticketDetails.location_reject_reason && <p className="text-[10px] text-outline mt-0.5 italic">"{ticketDetails.location_reject_reason}"</p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Description Section */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-bold text-outline uppercase tracking-wider">Issue Description</h4>
                                        {ticketDetails.status.status_name?.toLowerCase() === 'rejected' &&
                                            <Can permission={user?.user_id === ticketDetails.created_by?.user_id ? true : hasPermission('can_update_ticket')} >


                                                <div className="flex gap-2">
                                                    {isEditingTicket ? (
                                                        <>
                                                            <button
                                                                onClick={handleSaveTicketEdits}
                                                                disabled={actionLoading}
                                                                className="px-2.5 py-1 text-[11px] font-bold bg-primary text-on-primary rounded hover:bg-primary-hover transition-colors"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setIsEditingTicket(false);
                                                                    setEditedTitle(ticketDetails.title);
                                                                    setEditedDescription(ticketDetails.description);
                                                                }}
                                                                disabled={actionLoading}
                                                                className="px-2.5 py-1 text-[11px] font-bold bg-surface-container border border-outline rounded hover:bg-surface-container-high transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => setIsEditingTicket(true)}
                                                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold border border-outline-variant rounded text-primary hover:bg-surface-container-high transition-colors"
                                                        >
                                                            <Edit2 className="w-3 h-3" /> Edit Ticket
                                                        </button>
                                                    )}
                                                </div>

                                            </Can>
                                        }

                                    </div>
                                    {isEditingTicket ? (
                                        <textarea
                                            rows={4}
                                            value={editedDescription}
                                            onChange={e => setEditedDescription(e.target.value)}
                                            className="w-full text-xs sm:text-sm text-on-surface dark:text-dark-on-surface p-3 sm:p-4 bg-surface dark:bg-dark-surface rounded-lg border border-outline focus:outline-none focus:border-primary resize-y"
                                        />
                                    ) : (
                                        <p className="text-xs sm:text-sm text-on-surface dark:text-dark-on-surface leading-relaxed p-3 sm:p-4 bg-surface dark:bg-dark-surface rounded-lg border border-outline-variant dark:border-dark-outline-variant whitespace-pre-wrap">
                                            {ticketDetails.description}
                                        </p>
                                    )}
                                </div>

                                {/* Before Repair Media Section */}
                                {(issueMedia.length > 0 || hasIssueCategoryForDept) && (
                                    <>
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <SectionTitle icon={<Camera className="w-[18px] h-[18px]" />} label="Before Repair" />
                                                {(ticketDetails.status.status_name !== 'Rejected' || user?.user_id === ticketDetails.created_by?.user_id) && (
                                                    (ticketDetails.status.status_name === 'Rejected' || hasPermission('maintenance.update_before_repair')) ? (
                                                        <button
                                                            onClick={() => setIsManageIssueMediaOpen(true)}
                                                            className="min-h-[15px] px-3 py-2 hidden sm:flex items-center justify-center gap-2 text-xs font-bold text-primary bg-primary/10 rounded-lg cursor-pointer hover:bg-primary/20 active:scale-95 transition-all"
                                                        >
                                                            <Settings className="w-4 h-4" /> Manage Media
                                                        </button>
                                                    ) : null
                                                )}
                                            </div>
                                            <MediaGrid items={issueMedia} emptyLabel="No Before Repair media uploaded yet" />
                                        </div>
                                        <Divider />
                                    </>
                                )}

                                {/* Allocated Personnel Section */}
                                {ticketDetails.status.status_name.toLowerCase() !== 'rejected' && (
                                    <div>
                                        <SectionTitle icon={<User className="w-[18px] h-[18px]" />} label="Allocated" />
                                        <div className="flex flex-col sm:flex-row sm:items-center  justify-start border-b border-outline-variant dark:border-dark-outline-variant pb-2.5 mb-3.5 gap-2.5">
                                            {allocations.length > 0 ? (
                                                <div className="flex gap-2 overflow-x-auto pb-1 max-w-full scrollbar-thin">
                                                    {[...allocations]
                                                        .sort((a, b) => {
                                                            const isA = (user as any)?.user_id === a.worker.user_id;
                                                            const isB = (user as any)?.user_id === b.worker.user_id;
                                                            return isA === isB ? 0 : isA ? -1 : 1;
                                                        })
                                                        .map(a => (
                                                            <button
                                                                key={a.allocation_id}
                                                                type="button"
                                                                onClick={() => setActiveWorkerId(a.worker.user_id)}
                                                                className={`min-h-[15px] flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap border cursor-pointer active:scale-95 transition-all touch-manipulation ${a.worker.user_id === activeWorkerId ? 'bg-primary/10 border-primary text-primary' : 'bg-surface dark:bg-dark-surface border-outline-variant dark:border-dark-outline-variant text-outline'}`}
                                                            >
                                                                <AvatarCircle user={a.worker} size="sm" />
                                                                <span>{(user as any)?.user_id === a.worker.user_id ? "You" : a.worker.full_name}</span>
                                                            </button>
                                                        ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-outline italic">No personnel allocated to this ticket yet.</p>
                                            )}

                                            <Can permission="maintenance.add_allocation">
                                                <button
                                                    onClick={() => setIsAssignModalOpen(true)}
                                                    className="min-h-[15px] hidden sm:flex items-center justify-center gap-2 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer shadow-xs shrink-0 hover:bg-primary-hover active:scale-95 transition-all touch-manipulation"
                                                >
                                                    <Plus className="w-4 h-4" /> Assign Worker
                                                </button>
                                            </Can>
                                        </div>

                                        {/* Selected Worker Panel */}
                                        {(() => {
                                            const a = allocations.find(alloc => alloc.worker.user_id === activeWorkerId);
                                            if (!a) return null;

                                            const workerLogs = workLogs.filter(wl => wl.worker?.user_id === a.worker.user_id);
                                            const workerExpenses = expenses.filter(exp => exp.worker?.user_id === a.worker.user_id);
                                            const isMyWorker = (user as any)?.user_id === a.worker.user_id;

                                            return (
                                                <div className="bg-surface dark:bg-dark-surface rounded-2xl border border-outline-variant dark:border-dark-outline-variant overflow-hidden">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 border-b border-outline-variant dark:border-dark-outline-variant">
                                                        <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                                                            <AvatarCircle user={a.worker} size="md" />
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-sm text-on-surface dark:text-dark-on-surface truncate">{a.worker.full_name}</p>
                                                                <div className="flex items-center gap-2 text-[10px] text-outline">
                                                                    {a.worker.role && <span>{a.worker.role.role_name}</span>}
                                                                    {a.worker.employee_no && <span>· ID: {a.worker.employee_no}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs bg-primary/10 text-primary font-bold px-2.5 py-1.5 rounded-lg">{a.planned_hours}h Planned</span>
                                                            <Can permission="maintenance.change_allocation">
                                                                <button
                                                                    onClick={() => { setEditingAllocation(a); setEditAllocationForm({ planned_hours: a.planned_hours, remarks: a.remarks || '' }); }}
                                                                    className="min-h-[15px] min-w-[44px] flex items-center justify-center rounded border border-outline-variant dark:border-dark-outline-variant hover:text-primary cursor-pointer text-on-surface dark:text-dark-on-surface active:scale-95 transition-transform"
                                                                    aria-label="Edit Allocation"
                                                                >
                                                                    <span className='text-md'>Edit</span>
                                                                </button>
                                                            </Can>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-outline-variant dark:divide-dark-outline-variant">
                                                        {/* Work Logs Sub-Panel */}
                                                        <div className="p-2 space-y-2 bg-surface-container dark:bg-dark-surface-container">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[11px] font-bold text-outline uppercase tracking-wider flex items-center gap-2"><Clock className="w-4 h-4" /> Work Logs</p>
                                                                <Can permission={isMyWorker ? 'maintenance.can_change_my_log_time' : 'maintenance.can_change_others_log_time'}>
                                                                    <button
                                                                        onClick={() => setIsLogHoursModalOpen(true)}
                                                                        className="min-h-[15px] hidden sm:flex items-center justify-center gap-1 px-2 py-2 border border-primary text-primary text-xs font-bold rounded cursor-pointer hover:bg-primary/10 active:scale-95 transition-all"
                                                                    >
                                                                        <Plus className="w-4 h-4" /> Log Hours
                                                                    </button>
                                                                </Can>
                                                            </div>
                                                            {workerLogs.length === 0 ? (
                                                                <div className="p-4 text-center border border-dashed border-outline-variant dark:border-dark-outline-variant rounded">
                                                                    <Clock className="w-6 h-6 mx-auto text-outline mb-1" />
                                                                    <p className="text-xs text-outline italic">No work hours logged yet.</p>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                                                                    {workerLogs.map(wl => (
                                                                        <div key={wl.worklog_id} className="flex items-start justify-between text-xs p-3 bg-surface dark:bg-dark-surface rounded border border-outline-variant/50">
                                                                            <div>
                                                                                <p className="font-medium text-on-surface dark:text-dark-on-surface">{wl.work_done}</p>
                                                                                <p className="text-[10px] text-outline mt-0.5">{new Date(wl.work_date).toLocaleDateString()}</p>
                                                                            </div>
                                                                            <div className="text-right flex flex-col items-end gap-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="font-bold text-primary">{wl.hours}h</span>
                                                                                    <Can permission={isMyWorker ? 'maintenance.can_change_my_log_time' : 'maintenance.can_change_others_log_time'}>
                                                                                        <button
                                                                                            onClick={() => { setEditingWorkLog(wl); setEditWorkLogForm({ hours: wl.hours, work_done: wl.work_done }); }}
                                                                                            className="p-1 rounded-lg text-outline hover:text-primary cursor-pointer active:scale-95"
                                                                                            aria-label="Edit Work Log"
                                                                                        >
                                                                                            <Edit2 className="w-4 h-4" />
                                                                                        </button>
                                                                                    </Can>
                                                                                </div>
                                                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{wl.labour_amount} KWD</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Expenses Sub-Panel */}
                                                        <div className="p-2 space-y-2 bg-surface-container-low dark:bg-dark-surface-container-low">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[11px] font-bold text-outline uppercase tracking-wider flex items-center gap-2"><DollarSign className="w-4 h-4" /> Logged Expenses</p>
                                                                <Can permission={isMyWorker ? 'maintenance.change_my_expence' : 'accounts.change_others_expence'}>
                                                                    <button
                                                                        onClick={() => setIsAddExpenseModalOpen(true)}
                                                                        className="min-h-[15px] hidden sm:flex items-center justify-center gap-1 px-2 py-2 border border-primary text-primary text-xs font-bold rounded cursor-pointer hover:bg-primary/10 active:scale-95 transition-all"
                                                                    >
                                                                        <Plus className="w-4 h-4" /> Add Expense
                                                                    </button>
                                                                </Can>
                                                            </div>
                                                            {workerExpenses.length === 0 ? (
                                                                <div className="p-4 text-center border border-dashed border-outline-variant dark:border-dark-outline-variant rounded">
                                                                    <DollarSign className="w-6 h-6 mx-auto text-outline mb-1" />
                                                                    <p className="text-xs text-outline italic">No expenses logged yet.</p>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                                                                    {workerExpenses.map(exp => {
                                                                        const receiptsList: Media[] = [];
                                                                        if (exp.receipt) receiptsList.push(exp.receipt);
                                                                        if (exp.receipts) {
                                                                            exp.receipts.forEach(r => {
                                                                                if (!receiptsList.some(existing => existing.media_id === r.media_id)) {
                                                                                    receiptsList.push(r);
                                                                                }
                                                                            });
                                                                        }

                                                                        return (
                                                                            <div key={exp.expense_id} className="text-xs p-2 bg-surface dark:bg-dark-surface rounded border border-outline-variant/50">
                                                                                <div className="flex items-start justify-between gap-2">
                                                                                    <div className="min-w-0 flex-1">
                                                                                        <p className="font-semibold text-on-surface dark:text-dark-on-surface">{exp.expense_type.expense_name}</p>
                                                                                        {exp.remarks && <p className="text-outline mt-0.5 italic break-words">{exp.remarks}</p>}
                                                                                        {receiptsList.length > 0 && (
                                                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                                                {receiptsList.map(r => {
                                                                                                    const url = getMediaUrl(r.file_url);
                                                                                                    const isImg = isImage(r.file_name);
                                                                                                    return (
                                                                                                        <a
                                                                                                            key={r.media_id}
                                                                                                            href={url}
                                                                                                            onClick={(e) => {
                                                                                                                e.preventDefault();
                                                                                                                setPreviewItem({ url, name: r.file_name });
                                                                                                            }}
                                                                                                            className="relative w-12 h-12 rounded border border-outline-variant bg-surface dark:bg-dark-surface overflow-hidden flex items-center justify-center cursor-pointer hover:border-primary transition-colors shrink-0 group shadow-xs"
                                                                                                            title={r.file_name}
                                                                                                        >
                                                                                                            {isImg ? (
                                                                                                                <img src={url} alt={r.file_name} className="w-full h-full object-cover" />
                                                                                                            ) : (
                                                                                                                <div className="flex flex-col items-center justify-center text-center p-0.5">
                                                                                                                    <FileText className="w-5 h-5 text-outline group-hover:text-primary transition-colors" />
                                                                                                                    <span className="text-[7px] text-outline truncate w-10 mt-0.5">{r.file_name.split('.').pop()?.toUpperCase()}</span>
                                                                                                                </div>
                                                                                                            )}
                                                                                                        </a>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{exp.amount} KWD</span>
                                                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${exp.approved ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                                                                                            {exp.approved ? 'Approved' : 'Pending Approval'}
                                                                                        </span>
                                                                                        <Can permission={isMyWorker ? 'maintenance.change_my_expence' : 'accounts.change_others_expence'}>
                                                                                            <button
                                                                                                onClick={() => { setEditingExpense(exp); setEditExpenseForm({ amount: exp.amount, remarks: exp.remarks || '', expense_type_id: exp.expense_type.expense_type_id.toString() }); }}
                                                                                                className="p-1 rounded-lg text-outline hover:text-primary cursor-pointer active:scale-95"
                                                                                                aria-label="Edit Expense"
                                                                                            >
                                                                                                <Edit2 className="w-4 h-4" />
                                                                                            </button>
                                                                                        </Can>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}





                                {/* After Repair Media Section */}
                                {Boolean(ticketDetails.approved_by || (ticketDetails.status.status_name.toLowerCase() !== 'open' && ticketDetails.status.status_name.toLowerCase() !== 'rejected')) && (completedMedia.length > 0 || hasCompletedCategoryForDept) && (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <SectionTitle icon={<CheckCircle2 className="w-[18px] h-[18px]" />} label="After Repair" />
                                            <Can permission="maintenance.update_after_repair">
                                                <button
                                                    onClick={() => setIsManageCompletedMediaOpen(true)}
                                                    className="min-h-[15px] px-3 py-2 hidden sm:flex items-center justify-center gap-2 text-xs font-bold text-primary bg-primary/10 rounded-lg cursor-pointer hover:bg-primary/20 active:scale-95 transition-all"
                                                >
                                                    <Settings className="w-4 h-4" /> Manage Media
                                                </button>
                                            </Can>
                                        </div>
                                        <MediaGrid items={completedMedia} emptyLabel="No completion media uploaded yet" />
                                    </div>
                                )}
                            </>
                        )}

                        {/* Desktop Action Buttons — hidden on mobile (FAB handles those) */}
                        {!showRejectForm && !showLocationRejectForm && <>  {!modalLoading && ticketDetails.status.status_name === 'Open' && (
                            <div className="hidden sm:flex items-center gap-2 shrink-0 ml-3 justify-end">
                                <Can permission="maintenance.can_move_open_to_in_progress">
                                    <button
                                        onClick={handleMoveToNextStatus}
                                        disabled={actionLoading}
                                        className=" min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50 active:scale-95"
                                        aria-label="Approve Ticket"
                                    >
                                        {actionLoading
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : <CheckCircle2 className="w-3.5 h-3.5" />
                                        }
                                        Approve
                                    </button>
                                </Can>
                                <Can permission="maintenance.can_move_open_to_rejected">
                                    <button
                                        onClick={() => setShowRejectForm(true)}
                                        disabled={actionLoading}
                                        className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-error hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-50 active:scale-95"
                                        aria-label="Reject Ticket"
                                    >
                                        <XCircle className="w-3.5 h-3.5" />
                                        Reject
                                    </button>
                                </Can>
                            </div>
                        )}

                            {!modalLoading && ticketDetails.status.status_name === 'Location Approval' && (
                                <div className="hidden sm:flex items-center gap-2 shrink-0 ml-3 justify-end">
                                    <Can permission={'maintenance.can_move_location_approval_to_in_progress'} >   {/* reject */}
                                        {/* also need the  maintenance.can_move_location_approval_to_complteted - approve  */}


                                        <div className='flex gap-2'>
                                            <button
                                                onClick={async () => {
                                                    const target = statuses.find(s => s.status_name?.toLowerCase() === 'completed') || statuses.find(s => s.status_name?.toLowerCase() === 'reconciled');
                                                    const targetStatusId = target?.status_id;
                                                    if (targetStatusId) {
                                                        await handleUpdateStatus(targetStatusId, {
                                                            location_approval: 'Approved',
                                                            location_approved_by: user?.user_id,
                                                            location_approved_date: new Date().toISOString()
                                                        });
                                                    } else {
                                                        await handleMoveToNextStatus();
                                                    }
                                                }}
                                                disabled={actionLoading}
                                                className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50 active:scale-95"
                                                aria-label="Location Approve"
                                            >
                                                {actionLoading
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : <CheckCircle2 className="w-3.5 h-3.5" />
                                                }
                                                Location Approve
                                            </button>
                                            <button
                                                onClick={() => setShowLocationRejectForm(true)}
                                                disabled={actionLoading}
                                                className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-error hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-50 active:scale-95"
                                                aria-label="Location Reject"
                                            >
                                                <XCircle className="w-3.5 h-3.5" />
                                                Location Reject
                                            </button>
                                        </div>
                                    </Can>
                                </div>
                            )}



                            {ticketDetails.status.status_name === 'In Progress' && (
                                <div className="hidden sm:flex items-center gap-2 shrink-0 ml-3 justify-end">
                                    <Can permission='maintenance.can_move_in_progress_to_location_approval'>
                                        <button onClick={() => handleMoveToNextStatus()}
                                            disabled={actionLoading}
                                            className="min-h-[36px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1 disabled:opacity-50">
                                            {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Request Location Approval
                                        </button>
                                    </Can>
                                </div>
                            )}
                            {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-outline ml-1" />}
                        </>
                        }

                    </div>

                    {/* Desktop Chatroom Split Panel */}
                    {isChatOpen && (
                        <div className="hidden sm:flex w-80 border-l border-outline-variant dark:border-dark-outline-variant bg-surface-container-low dark:bg-dark-surface-container-low flex-col shrink-0 overflow-hidden">
                            <TicketChatPanel
                                ticketId={ticketDetails.ticket_id}
                                onClose={() => setIsChatOpen(false)}
                                onPreviewMedia={(url, name) => setPreviewItem({ url, name })}
                            />
                        </div>
                    )}
                </div>

                {/* Reject reason inline form - shown above FAB when active */}
                {
                    showRejectForm && (
                        // <div className="sticky bottom-0 z-30 bg-surface-container border-t border-outline-variant px-4 sm:px-5 py-3 shrink-0">
                        <div className="p-2.5 border border-error/20 bg-error-container/10 rounded flex flex-col sm:flex-row items-stretch sm:items-center gap-2 m-4 mt-2">
                            <input
                                type="text"
                                className="flex-1 text-xs bg-surface border border-outline-variant p-2 rounded outline-none text-on-surface focus:border-error placeholder:text-on-surface-variant/60 min-h-[36px]"
                                placeholder="Provide specific reason for ticket rejection..."
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                autoFocus
                            />
                            <div className="flex items-center gap-2 shrink-0 justify-end">
                                <button
                                    onClick={() => setShowRejectForm(false)}
                                    className="min-h-[36px] px-3.5 py-2 text-xs border border-outline-variant rounded cursor-pointer text-on-surface hover:bg-surface-container-high transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => { handleUpdateStatus('Rejected', { reject_reason: rejectReason }); setShowRejectForm(false); }}
                                    disabled={actionLoading}
                                    className="min-h-[36px] px-4 py-2 text-xs bg-error hover:bg-error-container text-on-error hover:text-on-error-container rounded font-medium cursor-pointer flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Reject
                                </button>
                            </div>
                        </div>
                        // </div>
                    )
                }

                {
                    showLocationRejectForm && (
                        <div className="p-2.5 border border-error/20 bg-error-container/10 rounded flex flex-col sm:flex-row items-stretch sm:items-center gap-2 m-4 mt-2">
                            <input
                                type="text"
                                className="flex-1 text-xs bg-surface border border-outline-variant p-2 rounded outline-none text-on-surface focus:border-error placeholder:text-on-surface-variant/60 min-h-[36px]"
                                placeholder="Provide specific reason for location rejection..."
                                value={locationRejectReason}
                                onChange={e => setLocationRejectReason(e.target.value)}
                                autoFocus
                            />
                            <div className="flex items-center gap-2 shrink-0 justify-end">
                                <button
                                    onClick={() => setShowLocationRejectForm(false)}
                                    className="min-h-[36px] px-3.5 py-2 text-xs border border-outline-variant rounded cursor-pointer text-on-surface hover:bg-surface-container-high transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        const inProgressStatus = statuses.find(s => s.status_name?.toLowerCase() === 'in progress');
                                        const statusId = inProgressStatus?.status_id;
                                        if (statusId) {
                                            await handleUpdateStatus(statusId, {
                                                location_approval: 'Rejected',
                                                location_reject_reason: locationRejectReason
                                            });
                                        } else {
                                            alert("In Progress status not configured.");
                                        }
                                        setShowLocationRejectForm(false);
                                    }}
                                    disabled={actionLoading}
                                    className="min-h-[36px] px-4 py-2 text-xs bg-error hover:bg-error-container text-on-error hover:text-on-error-container rounded font-medium cursor-pointer flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Location Reject
                                </button>
                            </div>
                        </div>
                    )
                }

                {/* Floating Action Button Speed-Dial — mobile only */}
                {
                    !modalLoading && (() => {
                        const statusName = ticketDetails.status.status_name;
                        const isOpen = statusName === 'Open';
                        const isApproved = statusName === 'Approved';
                        const isInProgress = statusName === 'In Progress';
                        const isActive = isOpen || isApproved || isInProgress;
                        const hasAlloc = allocations.length > 0;
                        const isMyWorker = (user as any)?.user_id === activeWorkerId;

                        type FabAction = {
                            key: string;
                            label: string;
                            icon: React.ReactNode;
                            color: string;
                            onClick: () => void;
                            permission?: string;
                            show: boolean;
                        };

                        const actions: FabAction[] = [
                            // Before Repair Media
                            {
                                key: 'before-media',
                                label: 'Before Repair Media',
                                icon: <Camera className="w-4 h-4" />,
                                color: 'bg-indigo-500 hover:bg-indigo-600 text-white',
                                onClick: () => { setIsManageIssueMediaOpen(true); setIsFabOpen(false); },
                                permission: 'maintenance.update_before_repair',
                                show: isActive,
                            },
                            // Assign Worker
                            {
                                key: 'assign',
                                label: 'Assign Worker',
                                icon: <UserPlus className="w-4 h-4" />,
                                color: 'bg-primary hover:bg-primary/90 text-white',
                                onClick: () => { setIsAssignModalOpen(true); setIsFabOpen(false); },
                                permission: 'maintenance.add_allocation',
                                show: isActive,
                            },
                            // Approve
                            {
                                key: 'approve',
                                label: 'Approve',
                                icon: <CheckCircle2 className="w-4 h-4" />,
                                color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
                                onClick: () => { handleMoveToNextStatus(); setIsFabOpen(false); },
                                permission: 'maintenance.can_move_open_to_in_progress',
                                show: isOpen,
                            },
                            // Reject
                            {
                                key: 'reject',
                                label: 'Reject',
                                icon: <XCircle className="w-4 h-4" />,
                                color: 'bg-error hover:bg-red-700 text-white',
                                onClick: () => { setShowRejectForm(true); setIsFabOpen(false); },
                                permission: 'maintenance.can_move_open_to_rejected',
                                show: isOpen,
                            },
                            // Start Progress
                            {
                                key: 'start-progress',
                                label: 'Start Progress',
                                icon: <Clock className="w-4 h-4" />,
                                color: 'bg-blue-600 hover:bg-blue-700 text-white',
                                onClick: () => { handleMoveToNextStatus(); setIsFabOpen(false); },
                                show: isApproved,
                            },
                            // Log Hours
                            {
                                key: 'log-hours',
                                label: 'Log Hours',
                                icon: <Clock className="w-4 h-4" />,
                                color: 'bg-amber-500 hover:bg-amber-600 text-white',
                                onClick: () => { setIsLogHoursModalOpen(true); setIsFabOpen(false); },
                                permission: isMyWorker ? 'maintenance.can_change_my_log_time' : 'maintenance.can_change_others_log_time',
                                show: (isInProgress || statusName === 'Completed') && hasAlloc,
                            },
                            // Log Expense
                            {
                                key: 'log-expense',
                                label: 'Log Expense',
                                icon: <DollarSign className="w-4 h-4" />,
                                color: 'bg-teal-600 hover:bg-teal-700 text-white',
                                onClick: () => { setIsAddExpenseModalOpen(true); setIsFabOpen(false); },
                                permission: isMyWorker ? 'maintenance.change_my_expence' : 'accounts.change_others_expence',
                                show: (isInProgress || statusName === 'Completed') && hasAlloc,
                            },
                            // After Repair Media
                            {
                                key: 'after-media',
                                label: 'After Repair Media',
                                icon: <Image className="w-4 h-4" />,
                                color: 'bg-violet-600 hover:bg-violet-700 text-white',
                                onClick: () => { setIsManageCompletedMediaOpen(true); setIsFabOpen(false); },
                                permission: 'maintenance.update_after_repair',
                                show: isInProgress || statusName === 'Completed',
                            },

                            {
                                key: 'complete',
                                label: 'Request Location Approval',
                                icon: <CheckCircle2 className="w-4 h-4" />,
                                color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
                                onClick: () => { handleMoveToNextStatus(); setIsFabOpen(false); },
                                permission: 'maintenance.can_move_in_progress_to_location_approval',
                                show: isInProgress,
                            },
                            // Location Approve
                            {
                                key: 'location-approve',
                                label: 'Location Approve',
                                icon: <CheckCircle2 className="w-4 h-4" />,
                                permission: 'maintenance.can_move_location_approval_to_in_progress',
                                color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
                                onClick: async () => {
                                    setIsFabOpen(false);
                                    const target = statuses.find(s => s.status_name?.toLowerCase() === 'completed') || statuses.find(s => s.status_name?.toLowerCase() === 'reconciled');
                                    const targetStatusId = target?.status_id;
                                    if (targetStatusId) {
                                        await handleUpdateStatus(targetStatusId, {
                                            location_approval: 'Approved',
                                            location_approved_by: user?.user_id,
                                            location_approved_date: new Date().toISOString()
                                        });
                                    } else {
                                        await handleMoveToNextStatus();
                                    }
                                },
                                show: statusName === 'Location Approval',
                            },
                            // Location Reject
                            {
                                key: 'location-reject',
                                label: 'Location Reject',
                                icon: <XCircle className="w-4 h-4" />,
                                permission: 'maintenance.can_move_location_approval_to_in_progress',
                                color: 'bg-error hover:bg-red-700 text-white',
                                onClick: () => { setShowLocationRejectForm(true); setIsFabOpen(false); },
                                show: statusName === 'Location Approval',
                            },
                        ];

                        const visibleActions = actions.filter(a => {
                            if (permissionDebugEnabled) {
                                return a.show;
                            }
                            return a.show && (!a.permission || hasPermission(a.permission));
                        });

                        if (visibleActions.length === 0) {
                            return (
                                <div className="sm:hidden absolute bottom-5 right-4 z-30 flex flex-col items-end gap-2">
                                    <motion.button
                                        onClick={() => setIsMobileChatOpen(true)}
                                        whileTap={{ scale: 0.9 }}
                                        className="w-12 h-12 rounded-full bg-secondary text-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-secondary/90 active:scale-95 transition-colors mb-1 shrink-0"
                                        aria-label="Open Chatroom"
                                        type="button"
                                    >
                                        <MessageCircle className="w-5.5 h-5.5" />
                                    </motion.button>
                                </div>
                            );
                        }

                        return (
                            <div className="sm:hidden absolute bottom-5 right-4 z-30 flex flex-col items-end gap-2">
                                <motion.button
                                    onClick={() => setIsMobileChatOpen(true)}
                                    whileTap={{ scale: 0.9 }}
                                    className="w-12 h-12 rounded-full bg-secondary text-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-secondary/90 active:scale-95 transition-colors mb-1 shrink-0"
                                    aria-label="Open Chatroom"
                                    type="button"
                                >
                                    <MessageCircle className="w-5.5 h-5.5" />
                                </motion.button>

                                {/* Speed-dial actions */}
                                <AnimatePresence>
                                    {isFabOpen && visibleActions.map((action, idx) => (
                                        <Can key={action.key} permission={action.permission ? (action.permission as any) : true}>
                                            <motion.button
                                                initial={{ opacity: 0, y: 12, scale: 0.85 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 8, scale: 0.85 }}
                                                transition={{ delay: (visibleActions.length - 1 - idx) * 0.04, duration: 0.18 }}
                                                onClick={action.onClick}
                                                disabled={actionLoading}
                                                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-full text-xs font-semibold shadow-lg cursor-pointer active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap ${action.color}`}
                                            >
                                                {action.icon}
                                                <span>{action.label}</span>
                                            </motion.button>
                                        </Can>
                                    ))}
                                </AnimatePresence>

                                {/* Main FAB toggle button */}
                                <motion.button
                                    onClick={() => setIsFabOpen(prev => !prev)}
                                    whileTap={{ scale: 0.9 }}
                                    transition={{ duration: 0.2 }}
                                    disabled={actionLoading}
                                    className="w-12 h-12 rounded-full bg-primary text-white shadow-xl flex items-center justify-center cursor-pointer hover:bg-primary/90 active:scale-95 transition-colors disabled:opacity-50"
                                    aria-label={isFabOpen ? 'Close actions' : 'Open actions'}
                                >
                                    <AnimatePresence mode="wait" initial={false}>
                                        {actionLoading ? (
                                            <motion.span key="loading" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}>
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                            </motion.span>
                                        ) : isFabOpen ? (
                                            <motion.span key="close" initial={{ opacity: 0, rotate: -90, scale: 0.7 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 90, scale: 0.7 }} transition={{ duration: 0.15 }}>
                                                <X className="w-6 h-6" />
                                            </motion.span>
                                        ) : (
                                            <motion.span key="menu" initial={{ opacity: 0, rotate: 90, scale: 0.7 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: -90, scale: 0.7 }} transition={{ duration: 0.15 }}>
                                                <Menu className="w-6 h-6" />
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </motion.button>
                            </div>
                        );
                    })()
                }

                {/* FAB backdrop (close on outside click) */}
                {
                    isFabOpen && (
                        <div
                            className="absolute inset-0 z-20"
                            onClick={() => setIsFabOpen(false)}
                        />
                    )
                }
            </motion.div >


            {/* Popups & Sub-Modals */}
            <AnimatePresence>
                {/* 1. ASSIGN WORKER MODAL */}
                {
                    isAssignModalOpen && (
                        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setIsAssignModalOpen(false)} className="absolute inset-0 bg-black touch-manipulation" />
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-4 sm:p-5 rounded-t-xl sm:rounded shadow-2xl">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Assign Worker</h3>
                                    <button onClick={() => setIsAssignModalOpen(false)} className="p-2 rounded-lg text-outline hover:bg-surface-container-high min-h-[15px] min-w-[44px] flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
                                </div>
                                {/* <form onSubmit={handleAddAllocation} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Select Worker</label>
                                    <select required value={newAllocation.worker_id} onChange={e => setNewAllocation({ ...newAllocation, worker_id: e.target.value })} className="w-full text-xs sm:text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 min-h-[15px] text-on-surface dark:text-dark-on-surface focus:ring-2 focus:ring-primary/30">
                                        <option value="">Select Worker to Assign</option>
                                        {workers.map(w => <option key={w.user_id} value={w.user_id}>{w.full_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Planned Hours</label>
                                    <input type="number" step="0.5" min="0.5" inputMode="decimal" required value={newAllocation.planned_hours} onChange={e => setNewAllocation({ ...newAllocation, planned_hours: e.target.value })} className="w-full text-xs sm:text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 min-h-[15px] text-on-surface dark:text-dark-on-surface focus:ring-2 focus:ring-primary/30" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-outline mb-1.5">Assignment Remarks</label>
                                    <input type="text" value={newAllocation.remarks} onChange={e => setNewAllocation({ ...newAllocation, remarks: e.target.value })} className="w-full text-xs sm:text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 min-h-[15px] text-on-surface dark:text-dark-on-surface focus:ring-2 focus:ring-primary/30" placeholder="Remarks (optional)" />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={() => setIsAssignModalOpen(false)} className="min-h-[15px] px-4 py-2 border border-outline-variant dark:border-dark-outline-variant rounded-lg text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:bg-surface-container-high active:scale-95 transition-all">Cancel</button>
                                    <button type="submit" disabled={actionLoading} className="min-h-[15px] px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50">
                                        {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />} Assign Worker
                                    </button>
                                </div>
                            </form> */}



                                <form onSubmit={handleAddAllocation} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-outline mb-1.5">Select Worker</label>
                                        <select required value={newAllocation.worker_id}
                                            disabled={actionLoading}
                                            onChange={e => {
                                                setNewAllocation({ ...newAllocation, worker_id: e.target.value });
                                                setHourlyRateToCreate('');
                                            }}
                                            className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface">
                                            <option value="">Select Worker to Assign</option>
                                            {(() => {
                                                const ticketDeptId = Number(selectedTicket.department?.department_id ?? selectedTicket.department);
                                                const allocatedIds = new Set(allocations.map(a => a.worker.user_id));

                                                const skilledList = natureWorkers
                                                    .filter((nw: any) => nw.worker && !allocatedIds.has(nw.worker.user_id) && isWorkerInDepartment(nw.worker, ticketDeptId))
                                                    .map((nw: any) => nw.worker);
                                                const skilledMap = new Map(skilledList.map((w: any) => [w.user_id, w]));
                                                const uniqueSkilledList = Array.from(skilledMap.values());
                                                const skilledIds = new Set(uniqueSkilledList.map((w: any) => w.user_id));

                                                const otherList = workers.filter(w => {
                                                    if (skilledIds.has(w.user_id) || allocatedIds.has(w.user_id)) return false;
                                                    return isWorkerInDepartment(w, ticketDeptId);
                                                });

                                                return (
                                                    <>
                                                        {uniqueSkilledList.length > 0 && (
                                                            <optgroup label={`⭐ Skilled — ${selectedTicket.nature.nature_name}`}>
                                                                {uniqueSkilledList.map((w: any) => (
                                                                    <option key={w.user_id} value={w.user_id}>{w.full_name}</option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                        {otherList.length > 0 && (
                                                            <optgroup label="Other Workers in Department">
                                                                {otherList.map(w => (
                                                                    <option key={w.user_id} value={w.user_id}>{w.full_name}</option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </select>
                                    </div>

                                    {(() => {
                                        if (!newAllocation.worker_id) return null;
                                        const selectedWorkerObj = workers.find(w => String(w.user_id) === String(newAllocation.worker_id));
                                        const hasRate = selectedWorkerObj && selectedWorkerObj.hourly_rate !== null && selectedWorkerObj.hourly_rate !== undefined && selectedWorkerObj.hourly_rate !== '';
                                        if (hasRate) return null;
                                        return (
                                            <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-lg space-y-2 animate-fadeIn">
                                                <div className="flex items-start gap-1.5 text-xs font-bold">
                                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                                                    <span>Employee rate required to add "{selectedWorkerObj?.full_name}"</span>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-semibold uppercase text-outline mb-1">Hourly Rate (KWD)</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0.01"
                                                        required
                                                        value={hourlyRateToCreate}
                                                        onChange={e => setHourlyRateToCreate(e.target.value)}
                                                        className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                                                        placeholder="e.g. 5.00"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-outline mb-1.5">Planned Hours</label>
                                            <input type="number" step="0.5" min="0.5" required value={newAllocation.planned_hours}
                                                disabled={actionLoading}
                                                onChange={e => setNewAllocation({ ...newAllocation, planned_hours: e.target.value })}
                                                className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                                                placeholder="Planned hours" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-outline mb-1.5">Assignment Remarks</label>
                                            <input type="text" value={newAllocation.remarks}
                                                disabled={actionLoading}
                                                onChange={e => setNewAllocation({ ...newAllocation, remarks: e.target.value })}
                                                className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                                                placeholder="Assignment instructions (optional)" />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2">
                                        <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer">
                                            Cancel
                                        </button>
                                        <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                                            {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                            Assign Worker
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )
                }

                {/* 2. LOG WORK HOURS MODAL */}
                {
                    isLogHoursModalOpen && activeWorkerId && (
                        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setIsLogHoursModalOpen(false)} className="absolute inset-0 bg-black touch-manipulation" />
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-4 sm:p-5 rounded-t-xl sm:rounded shadow-2xl">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Log Work Hours</h3>
                                    <button onClick={() => setIsLogHoursModalOpen(false)} className="p-2 rounded-lg text-outline hover:bg-surface-container-high min-h-[15px] min-w-[44px] flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
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
                                        <input required name="hours" type="number" step="0.5" min="0.5" inputMode="decimal" placeholder="e.g. 3.5" disabled={actionLoading} className="w-full text-xs sm:text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 min-h-[15px] text-on-surface dark:text-dark-on-surface focus:ring-2 focus:ring-primary/30" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-outline mb-1.5">Work Description</label>
                                        <textarea required name="work_done" rows={3} placeholder="Describe tasks completed..." disabled={actionLoading} className="w-full text-xs sm:text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 text-on-surface dark:text-dark-on-surface focus:ring-2 focus:ring-primary/30" />
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button type="button" onClick={() => setIsLogHoursModalOpen(false)} className="min-h-[15px] px-4 py-2 border border-outline-variant dark:border-dark-outline-variant rounded-lg text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:bg-surface-container-high active:scale-95 transition-all">Cancel</button>
                                        <button type="submit" disabled={actionLoading} className="min-h-[15px] px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50">
                                            {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />} Submit Log
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )
                }

                {/* 3. ADD EXPENSE MODAL */}
                {
                    isAddExpenseModalOpen && activeWorkerId && (
                        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setIsAddExpenseModalOpen(false)} className="absolute inset-0 bg-black touch-manipulation" />
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-4 sm:p-5 rounded-t-xl sm:rounded shadow-2xl overflow-y-auto max-h-[90vh] scrollbar-thin">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Add Expense</h3>
                                    <button onClick={() => setIsAddExpenseModalOpen(false)} className="p-2 rounded-lg text-outline hover:bg-surface-container-high min-h-[15px] min-w-[44px] flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
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
                                        <select required name="expense_type_id" disabled={actionLoading} value={selectedExpenseTypeId} onChange={e => setSelectedExpenseTypeId(e.target.value)} className="w-full text-xs sm:text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 min-h-[15px] text-on-surface dark:text-dark-on-surface focus:ring-2 focus:ring-primary/30">
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
                                        <input required name="amount" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" disabled={actionLoading} className="w-full text-xs sm:text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 min-h-[15px] text-on-surface dark:text-dark-on-surface focus:ring-2 focus:ring-primary/30" />
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
                                                    className={`relative border-2 border-dashed border-outline-variant dark:border-dark-outline-variant rounded-lg p-4 text-center hover:border-primary transition-all cursor-pointer ${actionLoading ? 'pointer-events-none opacity-50' : ''}`}
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
                                                            <div key={idx} className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-medium">
                                                                <span className="truncate max-w-[120px]">{f.name}</span>
                                                                <button type="button" disabled={actionLoading} onClick={() => setExpenseFiles(prev => ({ ...prev, [activeWorkerId]: prev[activeWorkerId].filter((_, i) => i !== idx) }))} className="text-primary/60 hover:text-red-500 cursor-pointer p-1">✕</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    <div>
                                        <label className="block text-xs font-semibold text-outline mb-1.5">Remarks</label>
                                        <input name="remarks" type="text" placeholder="Remarks (optional)" disabled={actionLoading} className="w-full text-xs sm:text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 min-h-[15px] text-on-surface dark:text-dark-on-surface focus:ring-2 focus:ring-primary/30" />
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button type="button" onClick={() => setIsAddExpenseModalOpen(false)} className="min-h-[15px] px-4 py-2 border border-outline-variant dark:border-dark-outline-variant rounded-lg text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:bg-surface-container-high active:scale-95 transition-all">Cancel</button>
                                        <button type="submit" disabled={actionLoading} className="min-h-[15px] px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50">
                                            {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />} Add Expense
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )
                }

                {/* 4. EDIT ALLOCATION MODAL */}
                {
                    editingAllocation && (
                        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setEditingAllocation(null)} className="absolute inset-0 bg-black touch-manipulation" />
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-4 sm:p-5 rounded-t-xl sm:rounded shadow-2xl">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Edit Allocation</h3>
                                    <button onClick={() => setEditingAllocation(null)} className="p-2 rounded-lg text-outline hover:bg-surface-container-high min-h-[15px] min-w-[44px] flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
                                </div>
                                <form onSubmit={handleUpdateAllocation} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-outline mb-1.5">Planned Hours</label>
                                        <input type="number" step="0.5" min="0.5" inputMode="decimal" required className="w-full text-xs sm:text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 min-h-[15px] text-on-surface dark:text-dark-on-surface focus:ring-2 focus:ring-primary/30" value={editAllocationForm.planned_hours} onChange={e => setEditAllocationForm({ ...editAllocationForm, planned_hours: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-outline mb-1.5">Remarks</label>
                                        <input type="text" className="w-full text-xs sm:text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 min-h-[15px] text-on-surface dark:text-dark-on-surface focus:ring-2 focus:ring-primary/30" value={editAllocationForm.remarks} onChange={e => setEditAllocationForm({ ...editAllocationForm, remarks: e.target.value })} placeholder="Remarks (optional)" />
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button type="button" onClick={() => { if (window.confirm('Are you sure you want to remove this worker allocation?')) handleDeleteAllocation(editingAllocation.allocation_id); }} className="min-h-[15px] px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-500/10 rounded-lg mr-auto flex items-center gap-2">
                                            <Trash2 className="w-4 h-4" /> Remove
                                        </button>
                                        <button type="button" onClick={() => setEditingAllocation(null)} className="min-h-[15px] px-4 py-2 border border-outline-variant dark:border-dark-outline-variant rounded-lg text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:bg-surface-container-high active:scale-95 transition-all">Cancel</button>
                                        <button type="submit" disabled={actionLoading} className="min-h-[15px] px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                            {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />} Save
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )
                }

                {/* 5. EDIT WORK LOG MODAL */}
                {
                    editingWorkLog && (
                        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setEditingWorkLog(null)} className="absolute inset-0 bg-black touch-manipulation" />
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-4 sm:p-5 rounded-t-xl sm:rounded shadow-2xl">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Edit Work Log</h3>
                                    <button onClick={() => setEditingWorkLog(null)} className="p-2 rounded-lg text-outline hover:bg-surface-container-high min-h-[15px] min-w-[44px] flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
                                </div>
                                <form onSubmit={handleUpdateWorkLog} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-outline mb-1.5">Hours Worked</label>
                                        <input type="number" step="0.5" min="0.5" inputMode="decimal" required className="w-full text-xs sm:text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 min-h-[15px] text-on-surface dark:text-dark-on-surface focus:ring-2 focus:ring-primary/30" value={editWorkLogForm.hours} onChange={e => setEditWorkLogForm({ ...editWorkLogForm, hours: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-outline mb-1.5">Description</label>
                                        <textarea required rows={3} className="w-full text-xs sm:text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 text-on-surface dark:text-dark-on-surface focus:ring-2 focus:ring-primary/30" value={editWorkLogForm.work_done} onChange={e => setEditWorkLogForm({ ...editWorkLogForm, work_done: e.target.value })} />
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button type="button" onClick={() => { if (window.confirm('Are you sure you want to delete this work log?')) handleDeleteWorkLog(editingWorkLog.worklog_id); }} className="min-h-[15px] px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-500/10 rounded-lg mr-auto flex items-center gap-2">
                                            <Trash2 className="w-4 h-4" /> Delete Log
                                        </button>
                                        <button type="button" onClick={() => setEditingWorkLog(null)} className="min-h-[15px] px-4 py-2 border border-outline-variant dark:border-dark-outline-variant rounded-lg text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:bg-surface-container-high active:scale-95 transition-all">Cancel</button>
                                        <button type="submit" disabled={actionLoading} className="min-h-[15px] px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                            {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />} Save
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )
                }

                {/* 6. EDIT EXPENSE MODAL */}
                {
                    editingExpense && (
                        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setEditingExpense(null)} className="absolute inset-0 bg-black touch-manipulation" />
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-md p-4 sm:p-5 rounded-t-xl sm:rounded shadow-2xl overflow-y-auto max-h-[90vh] scrollbar-thin">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Edit Expense</h3>
                                    <button onClick={() => setEditingExpense(null)} className="p-2 rounded-lg text-outline hover:bg-surface-container-high min-h-[15px] min-w-[44px] flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
                                </div>
                                <form onSubmit={handleUpdateExpense} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-outline mb-1.5">Expense Category</label>
                                        <select required value={editExpenseForm.expense_type_id} onChange={e => setEditExpenseForm({ ...editExpenseForm, expense_type_id: e.target.value })} className="w-full text-xs sm:text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 min-h-[15px] text-on-surface dark:text-dark-on-surface focus:ring-2 focus:ring-primary/30">
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
                                        <input type="number" step="0.01" min="0" inputMode="decimal" required value={editExpenseForm.amount} onChange={e => setEditExpenseForm({ ...editExpenseForm, amount: e.target.value })} className="w-full text-xs sm:text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 min-h-[15px] text-on-surface dark:text-dark-on-surface focus:ring-2 focus:ring-primary/30" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-outline mb-1.5">Remarks</label>
                                        <input type="text" value={editExpenseForm.remarks} onChange={e => setEditExpenseForm({ ...editExpenseForm, remarks: e.target.value })} placeholder="Remarks (optional)" className="w-full text-xs sm:text-sm bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 min-h-[15px] text-on-surface dark:text-dark-on-surface focus:ring-2 focus:ring-primary/30" />
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
                                                    className={`relative border-2 border-dashed border-outline-variant dark:border-dark-outline-variant rounded-lg p-3 text-center hover:border-primary transition-all cursor-pointer ${actionLoading ? 'pointer-events-none opacity-50' : ''}`}
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
                                                    <p className="text-xs text-outline">📎 Tap to upload and attach a new receipt</p>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant dark:border-dark-outline-variant">
                                        <button type="button" onClick={() => { if (window.confirm('Are you sure you want to delete this expense?')) handleDeleteExpense(editingExpense.expense_id); }} className="min-h-[15px] px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-500/10 rounded-lg mr-auto flex items-center gap-2">
                                            <Trash2 className="w-4 h-4" /> Delete Expense
                                        </button>
                                        <button type="button" onClick={() => setEditingExpense(null)} className="min-h-[15px] px-4 py-2 border border-outline-variant dark:border-dark-outline-variant rounded-lg text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:bg-surface-container-high active:scale-95 transition-all">Cancel</button>
                                        <button type="submit" disabled={actionLoading} className="min-h-[15px] px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                            {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />} Save
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )
                }

                {/* 7. MANAGE BEFORE REPAIR MODAL */}
                {
                    isManageIssueMediaOpen && (
                        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setIsManageIssueMediaOpen(false)} className="absolute inset-0 bg-black touch-manipulation" />
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-2xl p-4 sm:p-5 rounded-t-xl sm:rounded shadow-2xl overflow-y-auto max-h-[90vh]">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Manage Before Repair</h3>
                                    <button onClick={() => setIsManageIssueMediaOpen(false)} className="p-2 rounded-lg text-outline hover:bg-surface-container-high min-h-[15px] min-w-[44px] flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
                                </div>
                                <div className="space-y-4">
                                    <MediaGrid items={issueMedia} emptyLabel="No Before Repair uploaded yet" onEdit={triggerReplaceMedia} onDelete={handleDeleteMedia} />
                                    <div className="pt-2 border-t border-outline-variant dark:border-dark-outline-variant space-y-3">
                                        <input type="file" accept="image/*,video/*" onChange={handleUploadIssueMedia} disabled={actionLoading} className="hidden" id="upload-issue-media-popup" />
                                        <label htmlFor="upload-issue-media-popup" className={`w-full min-h-[48px] flex items-center justify-center gap-2 py-3 border-2 border-dashed border-outline-variant dark:border-dark-outline-variant rounded-lg cursor-pointer hover:border-primary text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:text-primary active:scale-[0.99] transition-all ${actionLoading ? 'pointer-events-none opacity-50' : ''}`}>
                                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin text-current" /> : <Camera className="w-4 h-4" />} Upload New Issue Photo / Video
                                        </label>
                                        <VoiceRecorder
                                            onSave={(voiceFile) => uploadMedia(voiceFile, 'Before Repair')}
                                            placeholderText="Record a voice note to attach (Before Repair)"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )
                }

                {/* 8. MANAGE AFTER REPAIR MODAL */}
                {
                    isManageCompletedMediaOpen && (
                        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.65 }} exit={{ opacity: 0 }} onClick={() => setIsManageCompletedMediaOpen(false)} className="absolute inset-0 bg-black touch-manipulation" />
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-2xl p-4 sm:p-5 rounded-t-xl sm:rounded shadow-2xl overflow-y-auto max-h-[90vh]">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Manage After Repair</h3>
                                    <button onClick={() => setIsManageCompletedMediaOpen(false)} className="p-2 rounded-lg text-outline hover:bg-surface-container-high min-h-[15px] min-w-[44px] flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
                                </div>
                                <div className="space-y-4">
                                    <MediaGrid items={completedMedia} emptyLabel="No completion media uploaded yet" onEdit={triggerReplaceMedia} onDelete={handleDeleteMedia} />
                                    <div className="pt-2 border-t border-outline-variant dark:border-dark-outline-variant space-y-3">
                                        <input type="file" accept="image/*,video/*" onChange={handleUploadCompletedMedia} disabled={actionLoading} className="hidden" id="upload-completed-media-popup" />
                                        <label htmlFor="upload-completed-media-popup" className={`w-full min-h-[48px] flex items-center justify-center gap-2 py-3 border-2 border-dashed border-outline-variant dark:border-dark-outline-variant rounded-lg cursor-pointer hover:border-primary text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:text-primary active:scale-[0.99] transition-all ${actionLoading ? 'pointer-events-none opacity-50' : ''}`}>
                                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin text-current" /> : <Camera className="w-4 h-4" />} Upload After Repair / Completion Photo
                                        </label>
                                        <VoiceRecorder
                                            onSave={(voiceFile) => uploadMedia(voiceFile, 'After Repair')}
                                            placeholderText="Record a voice note to attach (After Repair)"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )
                }

                {/* 9. MEDIA PREVIEW MODAL OVERLAY (FOR EXPENSE RECEIPTS) */}
                {
                    previewItem && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.85 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setPreviewItem(null)}
                                className="fixed inset-0 bg-black/90 backdrop-blur-xs cursor-pointer"
                            />

                            {/* Modal Box */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="relative max-w-4xl max-h-[85vh] w-full flex flex-col items-center justify-center z-10"
                            >
                                {/* Close & Action Buttons */}
                                <div className="absolute -top-12 right-0 flex items-center gap-3">
                                    <a
                                        href={previewItem.url}
                                        download={previewItem.name}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
                                        title="Download File"
                                    >
                                        <Download className="w-5 h-5" />
                                    </a>
                                    <button
                                        onClick={() => setPreviewItem(null)}
                                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
                                        title="Close"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Media Display Container */}
                                <div className="w-full flex justify-center items-center overflow-hidden rounded-lg bg-black/35 shadow-2xl p-1">
                                    {isImage(previewItem.name) ? (
                                        <img
                                            src={previewItem.url}
                                            alt={previewItem.name}
                                            className="max-w-full max-h-[75vh] object-contain rounded-md select-none pointer-events-none"
                                        />
                                    ) : isVideo(previewItem.name) ? (
                                        <video
                                            src={previewItem.url}
                                            controls
                                            autoPlay
                                            className="max-w-full max-h-[75vh] object-contain rounded-md"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-8 bg-surface-container rounded-lg border border-outline-variant max-w-md w-full text-center">
                                            <FileText className="w-12 h-12 text-primary mb-3 animate-pulse" />
                                            <p className="text-xs font-bold text-on-surface uppercase tracking-wider mb-1 text-white">{previewItem.name}</p>
                                            <p className="text-[11px] text-outline mb-4">Preview not supported for this file format.</p>
                                            <a
                                                href={previewItem.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 bg-primary text-white font-semibold text-xs rounded hover:bg-primary-hover active:scale-95 transition-all"
                                            >
                                                Open in New Tab
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >

            {/* 11. MOBILE CHATROOM MODAL OVERLAY */}
            <AnimatePresence>
                {isMobileChatOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: '100%' }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                        className="fixed inset-0 z-50 bg-surface dark:bg-dark-surface flex flex-col sm:hidden"
                    >
                        <div className="flex-1 overflow-hidden">
                            <TicketChatPanel
                                ticketId={ticketDetails.ticket_id}
                                onClose={() => setIsMobileChatOpen(false)}
                                onPreviewMedia={(url, name) => setPreviewItem({ url, name })}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};
