
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Loader2, Camera, CheckCircle2, Clock,
    Building2, Wrench, AlertCircle, User, Edit2, Settings, Plus, DollarSign, Trash2, FileText,
    UserPlus, Image, XCircle, Menu, Download, History as HistoryIcon, MessageCircle, Video, Upload, Phone, PhoneCall, UserCheck, ChevronDown, Headphones, Smartphone, Monitor, RotateCcw, RotateCw, RefreshCw, Save
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TicketChatPanel } from './TicketChatPanel';
import Can, { permissionDebugEnabled } from '@/hooks/Can';
import { usePermission } from '@/hooks/usePermission';
import {
    API_URL, type Ticket, type Allocation, type WorkLog, type Expense, type MediaCategory, type Media,
    AvatarCircle, MediaGrid, SectionTitle, Divider, statusColor, getMediaUrl, isImage, isVideo, rotateImageFile, RotatableVideoPlayer
} from './TicketsTypesAndComponents';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { LiveCameraModal } from '@/components/LiveCameraModal';

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
    const [priorities, setPriorities] = useState<any[]>([]);

    useEffect(() => {
        if (!token) return;
        fetch(`${API_URL}/maintenance/priority/`, {
            headers: { 'Authorization': `Token ${token}` }
        })
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                if (Array.isArray(data)) setPriorities(data);
            })
            .catch(() => { });
    }, [token]);

    const departmentPriorities = useMemo(() => {
        if (priorities && priorities.length > 0) {
            const ticketDeptId = ticketDetails.department?.department_id ?? ticketDetails.department;
            if (ticketDeptId) {
                const filtered = priorities.filter(p => p.department === ticketDeptId || p.department?.department_id === ticketDeptId);
                if (filtered.length > 0) return filtered;
            }
            return priorities;
        }
        if (ticketDetails.priority) {
            const defaults = [
                ticketDetails.priority,
                { priority_id: 1, priority_name: 'Low', level: 1 },
                { priority_id: 2, priority_name: 'Medium', level: 2 },
                { priority_id: 3, priority_name: 'High', level: 3 },
                { priority_id: 4, priority_name: 'Urgent', level: 4 }
            ];
            return defaults.filter((v, i, a) => a.findIndex(t => t.priority_name === v.priority_name) === i);
        }
        return [
            { priority_id: 1, priority_name: 'Low', level: 1 },
            { priority_id: 2, priority_name: 'Medium', level: 2 },
            { priority_id: 3, priority_name: 'High', level: 3 },
            { priority_id: 4, priority_name: 'Urgent', level: 4 }
        ];
    }, [priorities, ticketDetails.department, ticketDetails.priority]);

    const handlePrioritySelect = async (newPriorityId: number) => {
        if (!token || !ticketDetails || actionLoading) return;
        const selectedP = departmentPriorities.find(p => p.priority_id === newPriorityId) || priorities.find(p => p.priority_id === newPriorityId);

        setActionLoading(true);
        try {
            const res = await fetch(`${API_URL}/maintenance/ticket/${ticketDetails.ticket_id}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify({ priority: newPriorityId })
            });
            if (res.ok) {
                const updated = await res.json();
                setTicketDetails(prev => ({
                    ...prev,
                    priority: updated.priority && typeof updated.priority === 'object' ? updated.priority : (selectedP || prev.priority)
                }));
                onRefreshList();
            } else {
                console.error('Failed to update priority', await res.text());
            }
        } catch (err) {
            console.error('Error changing ticket priority:', err);
        } finally {
            setActionLoading(false);
        }
    };

    // UI / Action states
    const [modalLoading, setModalLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeWorkerId, setActiveWorkerId] = useState<number | null>(null);
    const [selectedExpenseTypeId, setSelectedExpenseTypeId] = useState<string>('');
    const [previewItem, setPreviewItem] = useState<{ url: string; name: string; media_id?: number; rotation?: number } | null>(null);
    const [previewRotation, setPreviewRotation] = useState<number>(0);
    const [isSavingPreviewRotation, setIsSavingPreviewRotation] = useState(false);

    const handlePreviewRotateLeft = () => setPreviewRotation(prev => (prev - 90 + 360) % 360);
    const handlePreviewRotateRight = () => setPreviewRotation(prev => (prev + 90) % 360);
    const handlePreviewResetRotation = () => setPreviewRotation(previewItem?.rotation || 0);

    const handleSavePreviewRotation = async () => {
        if (!previewItem || !previewItem.media_id) return;
        const currentSavedRot = previewItem.rotation || 0;
        const angleDelta = (previewRotation - currentSavedRot + 360) % 360;
        if (angleDelta === 0) return;

        setIsSavingPreviewRotation(true);
        try {
            const res = await fetch(`${API_URL}/common/media/${previewItem.media_id}/rotate/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Token ${token}` } : {})
                },
                body: JSON.stringify({ angle: angleDelta })
            });

            if (!res.ok) throw new Error('Failed to save media rotation on server.');

            const updatedMedia = await res.json();
            const freshUrl = `${getMediaUrl(updatedMedia.file_url)}?t=${Date.now()}`;
            const newRot = updatedMedia.rotation !== undefined ? updatedMedia.rotation : previewRotation;
            setPreviewItem({ ...previewItem, url: freshUrl, rotation: newRot });
            setPreviewRotation(newRot);
            await refreshTicketData();
        } catch (err: any) {
            alert(err.message || 'Error saving media rotation.');
        } finally {
            setTimeout(() => {
                setIsSavingPreviewRotation(false);
            }, 100);
        }
    };

    // Pre-Upload Image Review & Rotation Queue State
    const [pendingUploadQueue, setPendingUploadQueue] = useState<{
        id: string;
        file: File;
        rotation: number;
        previewUrl: string;
        categoryName: string;
        workerId?: number;
        expenseId?: number;
    }[] | null>(null);

    const queueFilesForReview = (files: File[], categoryName: string, workerId?: number, expenseId?: number) => {
        if (!files || files.length === 0) return;

        const queueItems = files.map((file, idx) => ({
            id: `${file.name}-${Date.now()}-${idx}`,
            file,
            rotation: 0,
            previewUrl: URL.createObjectURL(file),
            categoryName,
            workerId,
            expenseId
        }));
        setPendingUploadQueue(queueItems);
    };

    const handleConfirmPendingUpload = async () => {
        if (!pendingUploadQueue || pendingUploadQueue.length === 0) return;
        const queueToUpload = [...pendingUploadQueue];
        setActionLoading(true);
        try {
            for (const item of queueToUpload) {
                let fileToUpload = item.file;
                let rotToSave = item.rotation;
                if (item.rotation % 360 !== 0 && item.file.type.startsWith('image/')) {
                    fileToUpload = await rotateImageFile(item.file, item.rotation);
                    rotToSave = 0;
                }
                await uploadMedia(fileToUpload, item.categoryName, item.workerId, item.expenseId, true, rotToSave);
            }
            setPendingUploadQueue(null);
            setTimeout(() => {
                queueToUpload.forEach(i => {
                    try { URL.revokeObjectURL(i.previewUrl); } catch (_) {}
                });
            }, 500);
            await refreshTicketData();
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancelPendingUpload = () => {
        if (pendingUploadQueue) {
            pendingUploadQueue.forEach(i => URL.revokeObjectURL(i.previewUrl));
        }
        setPendingUploadQueue(null);
    };

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
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
    const [assignmentVoiceFile, setAssignmentVoiceFile] = useState<File | null>(null);
    const [isAssignRecordingPending, setIsAssignRecordingPending] = useState(false);
    const [hourlyRateToCreate, setHourlyRateToCreate] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [editWorkLogForm, setEditWorkLogForm] = useState({ hours: '', work_done: '' });
    const [editExpenseForm, setEditExpenseForm] = useState({ amount: '', remarks: '', expense_type_id: '' });
    const [editAllocationForm, setEditAllocationForm] = useState({ planned_hours: '', remarks: '' });
    const [editAllocationVoiceFile, setEditAllocationVoiceFile] = useState<File | null>(null);
    const [deleteExistingVoiceNote, setDeleteExistingVoiceNote] = useState(false);
    const [isEditAssignRecordingPending, setIsEditAssignRecordingPending] = useState(false);
    const [expenseFiles, setExpenseFiles] = useState<Record<number, File[]>>({});
    const [replacingMediaId, setReplacingMediaId] = useState<number | null>(null);
    const [isFabOpen, setIsFabOpen] = useState(false);

    // Live Camera & Native Camera states
    const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
    const [liveCameraMode, setLiveCameraMode] = useState<'photo' | 'video'>('photo');
    const [liveCameraCategory, setLiveCameraCategory] = useState<'Before Repair' | 'After Repair'>('Before Repair');

    const issueCameraPhotoRef = useRef<HTMLInputElement>(null);
    const issueCameraVideoRef = useRef<HTMLInputElement>(null);
    const completedCameraPhotoRef = useRef<HTMLInputElement>(null);
    const completedCameraVideoRef = useRef<HTMLInputElement>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
    const [isCallSelectModalOpen, setIsCallSelectModalOpen] = useState(false);
    const [isCallWorkerModalOpen, setIsCallWorkerModalOpen] = useState(false);
    const [isCallLocationModalOpen, setIsCallLocationModalOpen] = useState(false);

    const { hasPermission } = usePermission();
    const canChangePriority = useMemo(() => {
        if (user?.is_superuser) return true;
        return (
            hasPermission('maintenance.change_priority') ||
            hasPermission('maintenance.change_priority_name') ||
            hasPermission('maintenance.can_update_ticket') ||
            hasPermission('maintenance.change_ticket')
        );
    }, [user, hasPermission]);
    const navigate = useNavigate();
    const uploadAbortRef = useRef<AbortController | null>(null);

    // Prevent background page scrolling on mobile/desktop while ticket modal is open
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = (originalOverflow && originalOverflow !== 'hidden') ? originalOverflow : '';
        };
    }, []);

    // Load ticket sub-data on mount
    useEffect(() => {
        uploadAbortRef.current?.abort();
        uploadAbortRef.current = new AbortController();
        setTicketDetails(selectedTicket);
        fetchTicketDetails(selectedTicket);
        setEditedTitle(selectedTicket.title);
        setEditedDescription(selectedTicket.description);
        setIsEditingTicket(false);
        setShowRejectForm(false);
        setRejectReason('');
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

    // Auto-execute approval or rejection actions from URL query parameters
    useEffect(() => {
        if (!ticketDetails?.ticket_id) return;
        if (statuses.length === 0) return;

        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        if (!action) return;

        // Clear the action parameter to prevent duplicate triggers
        urlParams.delete('action');
        const nextQuery = urlParams.toString();
        const newUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
        window.history.replaceState(null, '', newUrl);

        const runAction = async () => {
            const statusName = ticketDetails.status.status_name?.toLowerCase();
            if (action === 'approve') {
                if (statusName === 'open') {
                    await handleMoveToNextStatus();
                } else if (statusName === 'location approval') {
                    // Inline location approve
                    const ticketDeptId = Number(ticketDetails.department?.department_id ?? ticketDetails.department);
                    const nextStatus = statuses.find(s => {
                        const sDeptId = Number(s.department?.department_id ?? s.department);
                        return s.status_name?.toLowerCase() === 'completed' && (!sDeptId || sDeptId === ticketDeptId);
                    });
                    if (nextStatus) {
                        setActionLoading(true);
                        try {
                            const response = await fetch(`${API_URL}/maintenance/ticket/${ticketDetails.ticket_id}/`, {
                                method: 'PATCH',
                                headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    status: nextStatus.status_id,
                                    location_approval: 'Approved',
                                    location_approved_by: user?.user_id,
                                    location_approved_date: new Date().toISOString()
                                })
                            });
                            if (response.ok) {
                                await refreshTicketData();
                            }
                        } catch (err) {
                            console.error(err);
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            } else if (action === 'reject') {
                if (statusName === 'open') {
                    setShowRejectForm(true);
                } else if (statusName === 'location approval') {
                    setShowLocationRejectForm(true);
                }
            }
        };

        // Small delay to allow sub-data / allocations to load
        const timer = setTimeout(runAction, 200);
        return () => clearTimeout(timer);
    }, [ticketDetails?.ticket_id, statuses, token, user]);

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
        if (!w) return false;

        const roleName = ((user?.role as any)?.role_name || (user?.role as string) || '').toLowerCase();
        const isAdminOrOfficeAdmin = (user as any)?.is_superuser || roleName.includes('admin') || roleName.includes('administrator');

        // Administrators and Office Administrators have full department visibility to assign workers
        if (isAdminOrOfficeAdmin) return true;

        if (!targetDeptId || isNaN(targetDeptId)) return true;

        const targetWorker = (w.sub_departments && Array.isArray(w.sub_departments) && w.sub_departments.length > 0)
            ? w
            : (workers.find(item => Number(item.user_id) === Number(w.user_id)) || w);

        const userDeptIds = getLoggedInUserDepartmentIds();

        if (!targetWorker.sub_departments || !Array.isArray(targetWorker.sub_departments) || targetWorker.sub_departments.length === 0) {
            return true;
        }

        return targetWorker.sub_departments.some((sd: any) => {
            let deptId: number | null = null;
            if (typeof sd === 'object' && sd !== null) {
                if (sd.department?.department_id) deptId = Number(sd.department.department_id);
                else if (typeof sd.department === 'number' || typeof sd.department === 'string') deptId = Number(sd.department);
                else if (sd.department_id) deptId = Number(sd.department_id);
                else if (sd.sub_department_id) {
                    const found = subDepartments.find(item => Number(item.sub_department_id) === Number(sd.sub_department_id));
                    if (found) deptId = Number(found.department?.department_id ?? found.department);
                }
            } else if (typeof sd === 'number' || typeof sd === 'string') {
                const found = subDepartments.find(item => Number(item.sub_department_id) === Number(sd) || item.sub_department_name?.toLowerCase() === String(sd).toLowerCase());
                if (found) deptId = Number(found.department?.department_id ?? found.department);
            }
            if (!deptId) return true;
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
                setNatureWorkers(rawNW.filter((nw: any) => nw.worker));
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
                setNatureWorkers(rawNW.filter((nw: any) => nw.worker));
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
        document.body.style.overflow = '';
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
            const formData = new FormData();
            formData.append('planned_hours', editAllocationForm.planned_hours);
            formData.append('remarks', editAllocationForm.remarks);

            if (editAllocationVoiceFile) {
                formData.append('voice_note', editAllocationVoiceFile);
            } else if (deleteExistingVoiceNote) {
                formData.append('voice_note', '');
            }

            const response = await fetch(`${API_URL}/maintenance/allocation/${editingAllocation.allocation_id}/`, {
                method: 'PATCH',
                headers: { Authorization: `Token ${token}` },
                body: formData
            });

            if (response.ok) {
                setEditingAllocation(null);
                setEditAllocationVoiceFile(null);
                setDeleteExistingVoiceNote(false);
                await refreshTicketData();
            } else {
                const errData = await response.json().catch(() => ({}));
                alert(Object.values(errData).flat().join(', ') || 'Failed to update allocation.');
                setEditingAllocation(null);
                setEditAllocationVoiceFile(null);
                setDeleteExistingVoiceNote(false);
            }
        } catch (err) {
            console.error(err);
            setEditingAllocation(null);
            setEditAllocationVoiceFile(null);
            setDeleteExistingVoiceNote(false);
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
        const targetWorkerIds = selectedWorkerIds.length > 0
            ? selectedWorkerIds
            : (newAllocation.worker_id ? [newAllocation.worker_id] : []);

        if (targetWorkerIds.length === 0) {
            alert("Please select at least one worker to assign.");
            return;
        }

        setActionLoading(true);
        try {
            // Process rates for any selected worker missing hourly rate
            for (const workerId of targetWorkerIds) {
                const selectedWorkerObj = workers.find(w => String(w.user_id) === String(workerId));
                const hasRate = selectedWorkerObj && selectedWorkerObj.hourly_rate !== null && selectedWorkerObj.hourly_rate !== undefined && selectedWorkerObj.hourly_rate !== '';
                const hasOfficeSubDept = selectedWorkerObj && Array.isArray(selectedWorkerObj.sub_departments) && selectedWorkerObj.sub_departments.some((sd: any) => {
                    const name = (sd?.sub_department_name ?? '').trim().toLowerCase();
                    return name === 'office';
                });

                if (!hasRate && !hasOfficeSubDept) {
                    if (!hourlyRateToCreate) {
                        alert(`Please specify the hourly rate for ${selectedWorkerObj?.full_name || 'selected worker'}.`);
                        setActionLoading(false);
                        return;
                    }
                    const rateResponse = await fetch(`${API_URL}/finance/employeerate/`, {
                        method: 'POST',
                        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            worker: workerId,
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
                    if (selectedWorkerObj) {
                        selectedWorkerObj.hourly_rate = hourlyRateToCreate;
                    }
                }
            }

            // Create allocation for each selected worker
            let lastCreatedAlloc: any = null;
            for (const workerId of targetWorkerIds) {
                const allocFormData = new FormData();
                allocFormData.append('ticket', String(ticketDetails.ticket_id));
                allocFormData.append('worker', String(workerId));
                allocFormData.append('planned_hours', newAllocation.planned_hours);
                if (newAllocation.remarks) allocFormData.append('remarks', newAllocation.remarks);
                if (assignmentVoiceFile) allocFormData.append('voice_note', assignmentVoiceFile);

                const response = await fetch(`${API_URL}/maintenance/allocation/`, {
                    method: 'POST',
                    headers: { Authorization: `Token ${token}` },
                    body: allocFormData
                });
                if (response.ok) {
                    lastCreatedAlloc = await response.json();
                }
            }

            // Upload voice instruction file if recorded
            if (assignmentVoiceFile) {
                const assignedNames = targetWorkerIds
                    .map(id => workers.find(w => String(w.user_id) === String(id))?.full_name)
                    .filter(Boolean)
                    .join(', ');

                // Upload to ticket media
                const mediaFormData = new FormData();
                mediaFormData.append('ticket', String(ticketDetails.ticket_id));
                mediaFormData.append('file_url', assignmentVoiceFile);
                mediaFormData.append('file_name', assignmentVoiceFile.name || `assignment_instruction_${Date.now()}.webm`);
                mediaFormData.append('category', 'Before Repair');

                fetch(`${API_URL}/common/media/`, {
                    method: 'POST',
                    headers: { Authorization: `Token ${token}` },
                    body: mediaFormData
                }).catch(console.error);

                // Upload to ticket chat as Voice Note
                const chatFormData = new FormData();
                chatFormData.append('ticket', String(ticketDetails.ticket_id));
                chatFormData.append('message_text', `🎙️ Voice Instructions for assignment (${assignedNames || 'Workers'})`);
                chatFormData.append('voice_note', assignmentVoiceFile);

                fetch(`${API_URL}/maintenance/ticketchat/`, {
                    method: 'POST',
                    headers: { Authorization: `Token ${token}` },
                    body: chatFormData
                }).catch(console.error);
            }

            // Reset form states
            setSelectedWorkerIds([]);
            setAssignmentVoiceFile(null);
            setNewAllocation({ worker_id: '', planned_hours: '4.0', remarks: '' });
            setHourlyRateToCreate('');
            setIsAssignModalOpen(false);
            if (lastCreatedAlloc?.worker?.user_id) {
                setActiveWorkerId(lastCreatedAlloc.worker.user_id);
            }
            await refreshTicketData();
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

    const uploadMedia = async (file: File, categoryName: string, workerId?: number, expenseId?: number, skipRefresh = false, rotation = 0): Promise<Media | null> => {
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
            if (rotation) formData.append('rotation', rotation.toString());

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
            } else {
                let errText = `Upload failed (${response.status})`;
                if (response.status === 413) {
                    errText = `File is too large for the server (HTTP 413 Content Too Large). Please upload a smaller video or image, or increase Nginx client_max_body_size.`;
                } else {
                    const errData = await response.json().catch(() => ({}));
                    if (errData?.detail) errText += `: ${errData.detail}`;
                    else if (Object.keys(errData).length > 0) errText += `: ${JSON.stringify(errData)}`;
                }
                console.error("Upload Media failed:", response.status, errText);
                alert(errText);
            }
        } catch (err: any) {
            if (err?.name !== 'AbortError') console.error(err);
        } finally {
            if (!skipRefresh) setActionLoading(false);
        }
        return null;
    };

    const handleUploadIssueMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            queueFilesForReview(files, 'Before Repair');
        }
        e.target.value = '';
    };

    const handleUploadCompletedMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            queueFilesForReview(files, 'After Repair');
        }
        e.target.value = '';
    };

    const handleAddExpenseReceiptInEdit = (files: File[]) => {
        if (!editingExpense || files.length === 0) return;
        queueFilesForReview(files, 'Bills', editingExpense.worker.user_id, editingExpense.expense_id);
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
                    queueFilesForReview(validFiles, 'Bills', workerId, createdExpense.expense_id);
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
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
                <div className="sticky top-0 z-10 bg-surface-container dark:bg-dark-surface-container border-b border-outline-variant dark:border-dark-outline-variant px-2 sm:px-5 py-2 flex items-center justify-between shrink-0">
                    <div className="flex flex-col items-start gap-1 sm:gap-1 min-w-0">
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
                        <span className="font-mono text-xs font-semibold text-outline shrink-0">{ticketDetails.work_order_no}</span>
                    </div>


                    <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Can permission="maintenance.can_see_device_info">
                            {ticketDetails.device_info && (
                                <div className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant text-on-surface-variant font-medium shrink-0" title="Created using device">
                                    {/iOS|Android/i.test(ticketDetails.device_info) ? (
                                        <Smartphone className="w-3.5 h-3.5 shrink-0 text-primary" />
                                    ) : (
                                        <Monitor className="w-3.5 h-3.5 shrink-0 text-primary" />
                                    )}
                                    <span>{ticketDetails.device_info}</span>
                                </div>
                            )}
                        </Can>
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
                            className="p-1 rounded-lg text-outline hover:bg-surface-container-high active:scale-95 transition-transform min-h-[15px] cursor-pointer touch-manipulation"
                            aria-label="Close Modal"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Parent split-screen container */}
                <div className="flex flex-1 overflow-hidden relative">
                    {/* Modal Body Container */}
                    <div className="p-2 sm:p-4 space-y-4 overflow-y-auto scrollbar-thin flex-1">
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
                                {/* Creator & Store Information Card */}
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 p-3 sm:p-4 bg-surface dark:bg-dark-surface rounded border border-outline-variant dark:border-dark-outline-variant">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <AvatarCircle user={ticketDetails.created_by} size="md" />
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm text-on-surface dark:text-dark-on-surface truncate">{ticketDetails.created_by.full_name}</p>
                                            {ticketDetails.created_by.role && <p className="text-xs text-primary font-semibold mt-0.5">{ticketDetails.created_by.role.role_name}</p>}
                                            {/* <p className="text-[11px] text-outline mt-1">
                                                {new Date(ticketDetails.created_date).toLocaleString()}
                                                {ticketDetails.age_days !== undefined && (
                                                    <span className="font-semibold text-primary ml-1.5" title="Days spent in current status">
                                                        ({Number(ticketDetails.age_days).toFixed(1)} days active)
                                                    </span>
                                                )}
                                            </p> */}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2.5 items-start sm:items-end shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-outline-variant dark:border-dark-outline-variant w-full sm:w-auto">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="flex items-center gap-1.5 text-xs text-outline">
                                                <Building2 className="w-4 h-4 shrink-0 text-outline" />
                                                <span className="font-bold text-on-surface dark:text-dark-on-surface">{ticketDetails.store.store_name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-outline"><AlertCircle className="w-4 h-4 shrink-0 text-outline" /><span>{ticketDetails.nature.nature_name}</span></div>

                                            {(() => {
                                                const lvl = ticketDetails.priority?.level ?? 1;
                                                const badgeColorClass = lvl >= 3
                                                    ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/25'
                                                    : lvl === 2
                                                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
                                                        : 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/25';

                                                return (
                                                    <>
                                                        <Can permission={['maintenance.change_priority', 'maintenance.change_priority_name']}>
                                                            {departmentPriorities.length > 0 ? (
                                                                <div className="relative inline-flex items-center">
                                                                    <select
                                                                        value={ticketDetails.priority?.priority_id}
                                                                        disabled={actionLoading}
                                                                        onChange={e => handlePrioritySelect(Number(e.target.value))}
                                                                        className={`appearance-none font-bold text-[11px] pl-2.5 pr-6 py-0.5 rounded border shadow-2xs outline-none cursor-pointer transition-colors ${badgeColorClass}`}
                                                                        title="Click to change ticket priority"
                                                                    >
                                                                        {departmentPriorities.map(p => (
                                                                            <option key={p.priority_id} value={p.priority_id} className="bg-surface dark:bg-dark-surface text-on-surface dark:text-dark-on-surface font-sans text-xs font-semibold py-1">
                                                                                {p.priority_name} Priority
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                    <ChevronDown className="w-3 h-3 absolute right-2 pointer-events-none opacity-75 shrink-0" />
                                                                </div>
                                                            ) : (
                                                                <span className={`inline-flex items-center font-bold text-[11px] px-2.5 py-0.5 rounded border shadow-2xs ${badgeColorClass}`}>
                                                                    {ticketDetails.priority?.priority_name} Priority
                                                                </span>
                                                            )}
                                                        </Can>
                                                        {!canChangePriority && (
                                                            <span className={`inline-flex items-center font-bold text-[11px] px-2.5 py-0.5 rounded border shadow-2xs ${badgeColorClass}`}>
                                                                {ticketDetails.priority?.priority_name} Priority
                                                            </span>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>

                                        {/* Right-Aligned Call Section: Desktop = Number Only, Mobile = Button */}
                                        <Can permission="maintenance.can_call_store">
                                            <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                                                {(() => {
                                                    const currentStoreManager = ticketDetails.store?.manager;
                                                    const ticketCreator = ticketDetails.created_by;
                                                    const managerPhone = currentStoreManager?.phone || currentStoreManager?.whatsapp_number;
                                                    const cleanManagerPhone = managerPhone ? String(managerPhone).replace(/\D/g, '') : '';
                                                    if (!cleanManagerPhone) return null;

                                                    const isSamePerson = currentStoreManager && ticketCreator && Number(currentStoreManager.user_id) === Number(ticketCreator.user_id);
                                                    const firstName = currentStoreManager?.full_name ? currentStoreManager.full_name.split(' ')[0] : 'Manager';
                                                    const label = isSamePerson ? `Call ${firstName}` : 'Call Manager';

                                                    return (
                                                        <div key="mgr-call" className="flex items-center gap-1.5 shrink-0">
                                                            {/* Desktop: Number Only */}
                                                            <a
                                                                href={`tel:${cleanManagerPhone}`}
                                                                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer"
                                                                title={`Call Store Manager (${currentStoreManager?.full_name}): ${managerPhone}`}
                                                            >
                                                                <PhoneCall className="w-3.5 h-3.5" />
                                                                <span>{managerPhone}</span>
                                                            </a>
                                                        </div>
                                                    );
                                                })()}

                                                {(() => {
                                                    const storeLocationPhone = ticketDetails.store?.phone || ticketDetails.store?.whatsapp_number;
                                                    const cleanLocationPhone = storeLocationPhone ? String(storeLocationPhone).replace(/\D/g, '') : '';
                                                    if (!cleanLocationPhone) return null;

                                                    return (
                                                        <div key="loc-call" className="flex items-center gap-1.5 shrink-0">
                                                            {/* Desktop: Number Only */}
                                                            <a
                                                                href={`tel:${cleanLocationPhone}`}
                                                                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer"
                                                                title={`Call Store Location (${ticketDetails.store?.store_name}): ${storeLocationPhone}`}
                                                            >
                                                                <Phone className="w-3.5 h-3.5" />
                                                                <span>{storeLocationPhone}</span>
                                                            </a>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </Can>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-outline">
                                    <span className="font-semibold text-xs text-outline dark:text-dark-outline">Status:</span>
                                    {allowedDropdownStatuses.length > 1 ? (
                                        <select
                                            value={ticketDetails.status.status_id}
                                            disabled={actionLoading}
                                            onChange={e => handleStatusSelect(Number(e.target.value))}
                                            className={`text-[10px] font-bold p-1 rounded shrink-0 border border-outline-variant dark:border-dark-outline-variant outline-none cursor-pointer focus:ring-1 focus:ring-primary/20 ${statusColor(ticketDetails.status.status_name)}`}
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
                                        className="flex items-center gap-1 text-[10px] font-semibold p-1 rounded-md border border-outline-variant hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high text-primary hover:text-primary-hover transition-colors  cursor-pointer active:scale-95 shrink-0"
                                        title="View Ticket History Logs"
                                        type="button"
                                    >
                                        <HistoryIcon className="w-3.5 h-3.5" />

                                    </button>
                                </div>



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
                                                        .map(a => {
                                                            const rawWPhone = a.worker.phone || a.worker.whatsapp_number;
                                                            const cleanWPhone = rawWPhone ? String(rawWPhone).replace(/\D/g, '') : '';
                                                            const is8Digit = cleanWPhone.length >= 8;

                                                            return (
                                                                <div key={a.allocation_id} className="flex items-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setActiveWorkerId(a.worker.user_id)}
                                                                        className={`min-h-[15px] flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap border cursor-pointer active:scale-95 transition-all touch-manipulation ${a.worker.user_id === activeWorkerId ? 'bg-primary/10 border-primary text-primary' : 'bg-surface dark:bg-dark-surface border-outline-variant dark:border-dark-outline-variant text-outline'}`}
                                                                    >
                                                                        <AvatarCircle user={a.worker} size="sm" />
                                                                        <span>{(user as any)?.user_id === a.worker.user_id ? "You" : a.worker.full_name}</span>
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
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

                                            const rawWorkerPhone = a.worker.phone || a.worker.whatsapp_number;
                                            const cleanWorkerPhone = rawWorkerPhone ? String(rawWorkerPhone).replace(/\D/g, '') : '';
                                            const is8DigitPhone = cleanWorkerPhone.length >= 8;

                                            return (
                                                <div className="bg-surface dark:bg-dark-surface rounded-2xl border border-outline-variant dark:border-dark-outline-variant overflow-hidden">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 border-b border-outline-variant dark:border-dark-outline-variant">
                                                        <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                                                            <AvatarCircle user={a.worker} size="md" />
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-sm text-on-surface dark:text-dark-on-surface truncate">{a.worker.full_name}</p>
                                                                {/* <div className="flex items-center gap-2 text-[10px] text-outline">
                                                                    {a.worker.role && <span>{a.worker.role.role_name}</span>}
                                                                    {a.worker.employee_no && <span>· ID: {a.worker.employee_no}</span>}
                                                                </div> */}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {is8DigitPhone && (
                                                                <Can permission="maintenance.can_call_worker">
                                                                    {/* Desktop: Number Only */}
                                                                    <a
                                                                        href={`tel:${cleanWorkerPhone}`}
                                                                        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer"
                                                                        title={`Call ${a.worker.full_name}: ${rawWorkerPhone}`}
                                                                    >
                                                                        <PhoneCall className="w-3.5 h-3.5" />
                                                                        <span>{rawWorkerPhone}</span>
                                                                    </a>
                                                                </Can>
                                                            )}
                                                            <span className="text-xs bg-primary/10 text-primary font-bold px-2.5 py-1.5 rounded-lg">{a.planned_hours}h Planned</span>
                                                            <Can permission="maintenance.change_allocation">
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingAllocation(a);
                                                                        setEditAllocationForm({ planned_hours: a.planned_hours, remarks: a.remarks || '' });
                                                                        setEditAllocationVoiceFile(null);
                                                                        setDeleteExistingVoiceNote(false);
                                                                    }}
                                                                    className="min-h-[15px] min-w-[44px] flex items-center justify-center rounded border border-outline-variant dark:border-dark-outline-variant hover:text-primary cursor-pointer text-on-surface dark:text-dark-on-surface active:scale-95 transition-transform"
                                                                    aria-label="Edit Allocation"
                                                                >
                                                                    <span className='text-[13px] p-1'>Edit</span>
                                                                </button>
                                                            </Can>
                                                        </div>
                                                    </div>

                                                    {/* View All Instructions */}
                                                    <Can permission="maintenance.can_view_all_instruction" className="w-full">
                                                        {(!a.remarks && !a.voice_note) ? null : (
                                                            <div className="w-full p-2 bg-primary/5 dark:bg-primary/10 border-y border-outline-variant/40 space-y-1 text-xs box-border">
                                                                {a.remarks && (
                                                                    <p className="text-on-surface dark:text-dark-on-surface font-medium text-[11px] sm:text-xs leading-snug">{a.remarks}</p>
                                                                )}
                                                                {a.voice_note && (
                                                                    <div className="w-full flex flex-col gap-0.5 box-border">
                                                                        <span className="text-[9px] sm:text-[10px] font-bold text-primary flex items-center gap-1">
                                                                            <Headphones className="w-3 h-3 shrink-0 text-primary" />
                                                                            <span>Instruction for {a.worker.full_name}:</span>
                                                                        </span>
                                                                        <audio
                                                                            src={getMediaUrl(a.voice_note)}
                                                                            controls
                                                                            preload="metadata"
                                                                            className="w-full min-w-full block h-8 rounded outline-none dark:invert dark:hue-rotate-180"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </Can>

                                                    {/* View My Instruction (if not superuser, doesn't have view_all_instruction, but is my worker card) */}
                                                    {!hasPermission('maintenance.can_view_all_instruction') && !user?.is_superuser && (user as any)?.user_id === a.worker.user_id && (
                                                        <Can permission="maintenance.can_view_my_instruction" className="w-full">
                                                            {(!a.remarks && !a.voice_note) ? null : (
                                                                <div className="w-full p-2 bg-primary/5 dark:bg-primary/10 border-y border-outline-variant/40 space-y-1 text-xs box-border">
                                                                    {a.remarks && (
                                                                        <p className="text-on-surface dark:text-dark-on-surface font-medium text-[11px] sm:text-xs leading-snug">{a.remarks}</p>
                                                                    )}
                                                                    {a.voice_note && (
                                                                        <div className="w-full flex flex-col gap-0.5 box-border">
                                                                            <span className="text-[9px] sm:text-[10px] font-bold text-primary flex items-center gap-1">
                                                                                <Headphones className="w-3 h-3 shrink-0 text-primary" />
                                                                                <span>Instruction for {a.worker.full_name}:</span>
                                                                            </span>
                                                                            <audio
                                                                                src={getMediaUrl(a.voice_note)}
                                                                                controls
                                                                                preload="metadata"
                                                                                className="w-full min-w-full block h-8 rounded outline-none dark:invert dark:hue-rotate-180"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </Can>
                                                    )}

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
                                                                                                                setPreviewItem({ url, name: r.file_name, media_id: r.media_id });
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
                                label: 'Before Repair',
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
                                label: 'Request Approval',
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
                                <div className="sm:hidden absolute bottom-5 right-4 z-30 flex flex-col items-end gap-2.5">
                                    {/* 1. Call Technicians FAB */}
                                    {(() => {
                                        const validWorkers = (allocations || []).filter(a => {
                                            const p = a.worker?.phone || a.worker?.whatsapp_number;
                                            return p && String(p).replace(/\D/g, '').length >= 8;
                                        });
                                        if (validWorkers.length === 0) return null;

                                        return (
                                            <Can permission="maintenance.can_call_worker">
                                                <motion.button
                                                    onClick={() => {
                                                        if (validWorkers.length > 1) {
                                                            setIsCallWorkerModalOpen(true);
                                                        } else if (validWorkers.length === 1) {
                                                            const wP = validWorkers[0].worker?.phone || validWorkers[0].worker?.whatsapp_number;
                                                            window.location.href = `tel:${String(wP).replace(/\D/g, '')}`;
                                                        }
                                                    }}
                                                    whileTap={{ scale: 0.9 }}
                                                    className="w-12 h-12 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-emerald-700 active:scale-95 transition-colors shrink-0"
                                                    aria-label="Call Technicians"
                                                    title="Call Technicians"
                                                    type="button"
                                                >
                                                    <PhoneCall className="w-5.5 h-5.5" />
                                                </motion.button>
                                            </Can>
                                        );
                                    })()}

                                    {/* 2. Call Store / Manager FAB */}
                                    {(() => {
                                        const currentMgr = ticketDetails?.store?.manager;
                                        const mgrPhone = currentMgr?.phone || currentMgr?.whatsapp_number;
                                        const cleanMgr = mgrPhone ? String(mgrPhone).replace(/\D/g, '') : '';
                                        const locPhone = ticketDetails?.store?.phone || ticketDetails?.store?.whatsapp_number;
                                        const cleanLoc = locPhone ? String(locPhone).replace(/\D/g, '') : '';
                                        if (!cleanMgr && !cleanLoc) return null;

                                        return (
                                            <Can permission="maintenance.can_call_store">
                                                <motion.button
                                                    onClick={() => {
                                                        const totalLocCount = (cleanMgr ? 1 : 0) + (cleanLoc ? 1 : 0);
                                                        if (totalLocCount > 1) {
                                                            setIsCallLocationModalOpen(true);
                                                        } else if (cleanMgr) {
                                                            window.location.href = `tel:${cleanMgr}`;
                                                        } else if (cleanLoc) {
                                                            window.location.href = `tel:${cleanLoc}`;
                                                        }
                                                    }}
                                                    whileTap={{ scale: 0.9 }}
                                                    className="w-12 h-12 rounded-full bg-teal-600 text-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-teal-700 active:scale-95 transition-colors shrink-0"
                                                    aria-label="Call Store"
                                                    title="Call Store / Manager"
                                                    type="button"
                                                >
                                                    <PhoneCall className="w-5.5 h-5.5" />
                                                </motion.button>
                                            </Can>
                                        );
                                    })()}

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
                            <div className="sm:hidden absolute bottom-5 right-4 z-30 flex flex-col items-end gap-2.5">
                                {/* 1. Call Technicians FAB */}
                                {(() => {
                                    const validWorkers = (allocations || []).filter(a => {
                                        const p = a.worker?.phone || a.worker?.whatsapp_number;
                                        return p && String(p).replace(/\D/g, '').length >= 8;
                                    });
                                    if (validWorkers.length === 0) return null;

                                    return (
                                        <Can permission="maintenance.can_call_worker">
                                            <motion.button
                                                onClick={() => {
                                                    if (validWorkers.length > 1) {
                                                        setIsCallWorkerModalOpen(true);
                                                    } else if (validWorkers.length === 1) {
                                                        const wP = validWorkers[0].worker?.phone || validWorkers[0].worker?.whatsapp_number;
                                                        window.location.href = `tel:${String(wP).replace(/\D/g, '')}`;
                                                    }
                                                }}
                                                whileTap={{ scale: 0.9 }}
                                                className="w-12 h-12 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-emerald-700 active:scale-95 transition-colors shrink-0"
                                                aria-label="Call Technicians"
                                                title="Call Technicians"
                                                type="button"
                                            >
                                                <PhoneCall className="w-5.5 h-5.5" />
                                            </motion.button>
                                        </Can>
                                    );
                                })()}

                                {/* 2. Call Store / Manager FAB */}
                                {(() => {
                                    const currentMgr = ticketDetails?.store?.manager;
                                    const mgrPhone = currentMgr?.phone || currentMgr?.whatsapp_number;
                                    const cleanMgr = mgrPhone ? String(mgrPhone).replace(/\D/g, '') : '';
                                    const locPhone = ticketDetails?.store?.phone || ticketDetails?.store?.whatsapp_number;
                                    const cleanLoc = locPhone ? String(locPhone).replace(/\D/g, '') : '';
                                    if (!cleanMgr && !cleanLoc) return null;

                                    return (
                                        <Can permission="maintenance.can_call_store">
                                            <motion.button
                                                onClick={() => {
                                                    const totalLocCount = (cleanMgr ? 1 : 0) + (cleanLoc ? 1 : 0);
                                                    if (totalLocCount > 1) {
                                                        setIsCallLocationModalOpen(true);
                                                    } else if (cleanMgr) {
                                                        window.location.href = `tel:${cleanMgr}`;
                                                    } else if (cleanLoc) {
                                                        window.location.href = `tel:${cleanLoc}`;
                                                    }
                                                }}
                                                whileTap={{ scale: 0.9 }}
                                                className="w-12 h-12 rounded-full bg-teal-600 text-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-teal-700 active:scale-95 transition-colors shrink-0"
                                                aria-label="Call Store"
                                                title="Call Store / Manager"
                                                type="button"
                                            >
                                                <PhoneCall className="w-5.5 h-5.5" />
                                            </motion.button>
                                        </Can>
                                    );
                                })()}

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
                                    {isFabOpen && (() => {
                                        const activeWorkerObj = allocations.find(a => a.worker.user_id === activeWorkerId)?.worker || (user as any);

                                        return visibleActions.map((action, idx) => {
                                            const isWorkerAction = action.key === 'log-hours' || action.key === 'log-expense';
                                            const actionIcon = (isWorkerAction && activeWorkerObj)
                                                ? <AvatarCircle user={activeWorkerObj} size="sm" />
                                                : action.icon;

                                            return (
                                                <Can
                                                    key={action.key}
                                                    permission={action.permission ? (action.permission as any) : true}
                                                >
                                                    <motion.button
                                                        initial={{ opacity: 0, y: 12, scale: 0.85 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, y: 8, scale: 0.85 }}
                                                        transition={{
                                                            delay: (visibleActions.length - 1 - idx) * 0.04,
                                                            duration: 0.18
                                                        }}
                                                        onClick={action.onClick}
                                                        disabled={actionLoading}
                                                        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-full w-40 text-xs font-semibold shadow-lg cursor-pointer active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap ${action.color}`}
                                                    >
                                                        {actionIcon}
                                                        <span>{action.label}</span>
                                                    </motion.button>
                                                </Can>
                                            );
                                        });
                                    })()}
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
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-xs font-semibold text-outline">
                                                Select Workers {selectedWorkerIds.length > 0 && <span className="text-primary font-bold">({selectedWorkerIds.length} selected)</span>}
                                            </label>
                                            {selectedWorkerIds.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedWorkerIds([])}
                                                    className="text-[10px] text-error hover:underline cursor-pointer font-semibold"
                                                >
                                                    Clear selection
                                                </button>
                                            )}
                                        </div>

                                        {(() => {
                                            const ticketDeptId = Number(selectedTicket.department?.department_id ?? selectedTicket.department);
                                            const allocatedIds = new Set(allocations.map(a => a.worker.user_id));

                                            const skilledList = natureWorkers
                                                .filter((nw: any) => nw.worker && !allocatedIds.has(nw.worker.user_id))
                                                .map((nw: any) => {
                                                    const fullW = workers.find(w => Number(w.user_id) === Number(nw.worker.user_id));
                                                    return fullW ? { ...nw.worker, ...fullW } : nw.worker;
                                                });
                                            const skilledMap = new Map(skilledList.map((w: any) => [w.user_id, w]));
                                            const uniqueSkilledList = Array.from(skilledMap.values());
                                            const skilledIds = new Set(uniqueSkilledList.map((w: any) => w.user_id));

                                            const otherInDeptList = workers.filter(w => {
                                                if (skilledIds.has(w.user_id) || allocatedIds.has(w.user_id)) return false;
                                                return isWorkerInDepartment(w, ticketDeptId);
                                            });

                                            const renderWorkerRow = (w: any, isSkilled: boolean) => {
                                                const idStr = String(w.user_id);
                                                const isSelected = selectedWorkerIds.includes(idStr);
                                                return (
                                                    <div
                                                        key={w.user_id}
                                                        onClick={() => {
                                                            setSelectedWorkerIds(prev =>
                                                                prev.includes(idStr) ? prev.filter(id => id !== idStr) : [...prev, idStr]
                                                            );
                                                            setHourlyRateToCreate('');
                                                        }}
                                                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${isSelected
                                                            ? 'border-primary bg-primary/10 text-on-surface dark:text-dark-on-surface font-semibold shadow-2xs'
                                                            : 'border-outline-variant/60 hover:bg-surface-container-high text-on-surface dark:text-dark-on-surface'
                                                            }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            readOnly
                                                            className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                                                        />
                                                        <AvatarCircle user={w} size="sm" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="truncate font-medium">{w.full_name}</span>
                                                                {isSkilled && <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded-full shrink-0">⭐ Skilled</span>}
                                                            </div>
                                                            {w.employee_no && <p className="text-[10px] text-outline truncate">ID: {w.employee_no}</p>}
                                                        </div>
                                                    </div>
                                                );
                                            };

                                            if (uniqueSkilledList.length === 0 && otherInDeptList.length === 0) {
                                                return (
                                                    <p className="text-xs text-outline italic p-3 border border-dashed rounded-lg text-center">
                                                        No available unallocated workers found for this department.
                                                    </p>
                                                );
                                            }

                                            return (
                                                <div className="max-h-52 overflow-y-auto space-y-3 pr-1 border border-outline-variant/60 rounded-lg p-2 bg-surface-container-low dark:bg-dark-surface-container-low">
                                                    {uniqueSkilledList.length > 0 && (
                                                        <div>
                                                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1.5 px-1">
                                                                ⭐ Skilled — {selectedTicket.nature?.nature_name || 'Nature'}
                                                            </p>
                                                            <div className="space-y-1.5">
                                                                {uniqueSkilledList.map((w: any) => renderWorkerRow(w, true))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {otherInDeptList.length > 0 && (
                                                        <div>
                                                            <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5 px-1">
                                                                Other Workers in Department
                                                            </p>
                                                            <div className="space-y-1.5">
                                                                {otherInDeptList.map((w: any) => renderWorkerRow(w, false))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Employee Hourly Rate Check for Selected Workers */}
                                    {(() => {
                                        if (selectedWorkerIds.length === 0) return null;
                                        const missingRateWorkers = selectedWorkerIds.map(id => workers.find(w => String(w.user_id) === String(id))).filter(w => {
                                            if (!w) return false;
                                            const hasRate = w.hourly_rate !== null && w.hourly_rate !== undefined && w.hourly_rate !== '';
                                            const hasOfficeSubDept = Array.isArray(w.sub_departments) && w.sub_departments.some((sd: any) => {
                                                const name = (sd?.sub_department_name ?? '').trim().toLowerCase();
                                                return name === 'office';
                                            });
                                            return !hasRate && !hasOfficeSubDept;
                                        });

                                        if (missingRateWorkers.length === 0) return null;
                                        const names = missingRateWorkers.map(w => w?.full_name).join(', ');

                                        return (
                                            <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-lg space-y-2 animate-fadeIn">
                                                <div className="flex items-start gap-1.5 text-xs font-bold">
                                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                                                    <span>Hourly rate required for: {names}</span>
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

                                    <div className="grid grid-cols-1 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-outline mb-1.5">Planned Hours (Per Worker)</label>
                                            <input
                                                type="number"
                                                step="0.5"
                                                min="0.5"
                                                required
                                                value={newAllocation.planned_hours}
                                                disabled={actionLoading}
                                                onChange={e => setNewAllocation({ ...newAllocation, planned_hours: e.target.value })}
                                                className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                                                placeholder="Planned hours"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-outline mb-1.5">Assignment Remarks</label>
                                            <input
                                                type="text"
                                                value={newAllocation.remarks}
                                                disabled={actionLoading}
                                                onChange={e => setNewAllocation({ ...newAllocation, remarks: e.target.value })}
                                                className="w-full text-xs bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded-lg p-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                                                placeholder="Assignment instructions (optional)"
                                            />
                                        </div>

                                        {/* Audio Recording Section */}
                                        <div>
                                            <label className="block text-xs font-semibold text-outline mb-1.5">
                                                Voice Instructions (Optional)
                                            </label>
                                            <VoiceRecorder
                                                onSave={(file) => setAssignmentVoiceFile(file)}
                                                onCancel={() => setAssignmentVoiceFile(null)}
                                                onRecordingStateChange={setIsAssignRecordingPending}
                                                placeholderText="Record audio instruction for assigned workers"
                                            />
                                            {assignmentVoiceFile && (
                                                <div className="mt-2 flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                                                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold truncate">
                                                        <Headphones className="w-4 h-4 animate-pulse shrink-0" />
                                                        <span className="truncate">{assignmentVoiceFile.name}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAssignmentVoiceFile(null)}
                                                        className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                                                        title="Remove recorded audio"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsAssignModalOpen(false);
                                                setSelectedWorkerIds([]);
                                                setAssignmentVoiceFile(null);
                                            }}
                                            className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={actionLoading || isAssignRecordingPending || selectedWorkerIds.length === 0}
                                            className="px-4 py-2 bg-primary text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                            {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                            Assign {selectedWorkerIds.length > 1 ? `${selectedWorkerIds.length} Workers` : 'Worker'}
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

                                    {/* Voice Instruction Section */}
                                    <div>
                                        <label className="block text-xs font-semibold text-outline mb-1.5">
                                            Voice Instruction
                                        </label>
                                        {editingAllocation.voice_note && !deleteExistingVoiceNote && !editAllocationVoiceFile ? (
                                            <div className="p-2.5 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant/60 rounded-lg space-y-2">
                                                <div className="flex items-center justify-between text-xs font-semibold text-primary">
                                                    <span className="flex items-center gap-1.5">
                                                        <Headphones className="w-4 h-4 text-primary" /> Current Voice Instruction
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteExistingVoiceNote(true)}
                                                        className="text-xs text-red-600 hover:bg-red-500/10 px-2 py-1 rounded flex items-center gap-1 cursor-pointer font-bold transition-colors"
                                                        title="Delete current voice instruction"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <audio src={getMediaUrl(editingAllocation.voice_note)} controls className="w-full h-8 rounded dark:invert dark:hue-rotate-180" />
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {deleteExistingVoiceNote && (
                                                    <div className="flex items-center justify-between p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 font-medium">
                                                        <span>Voice note marked for deletion. Record new audio below or save.</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeleteExistingVoiceNote(false)}
                                                            className="text-[10px] underline hover:font-bold cursor-pointer"
                                                        >
                                                            Undo
                                                        </button>
                                                    </div>
                                                )}
                                                <VoiceRecorder
                                                    onSave={(file) => {
                                                        setEditAllocationVoiceFile(file);
                                                        setDeleteExistingVoiceNote(false);
                                                    }}
                                                    onCancel={() => setEditAllocationVoiceFile(null)}
                                                    onRecordingStateChange={setIsEditAssignRecordingPending}
                                                    placeholderText="Record new voice instruction"
                                                />
                                                {editAllocationVoiceFile && (
                                                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                                                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold truncate">
                                                            <Headphones className="w-4 h-4 shrink-0 animate-pulse" />
                                                            <span className="truncate">{editAllocationVoiceFile.name}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditAllocationVoiceFile(null)}
                                                            className="p-1 text-red-500 hover:bg-red-500/10 rounded cursor-pointer"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2">
                                        <button type="button" onClick={() => { if (window.confirm('Are you sure you want to remove this worker allocation?')) handleDeleteAllocation(editingAllocation.allocation_id); }} className="min-h-[15px] px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-500/10 rounded-lg mr-auto flex items-center gap-2">
                                            <Trash2 className="w-4 h-4" /> Remove Allocation
                                        </button>
                                        <button type="button" onClick={() => setEditingAllocation(null)} className="min-h-[15px] px-4 py-2 border border-outline-variant dark:border-dark-outline-variant rounded-lg text-xs font-semibold text-on-surface dark:text-dark-on-surface hover:bg-surface-container-high active:scale-95 transition-all">Cancel</button>
                                        <button type="submit" disabled={actionLoading || isEditAssignRecordingPending} className="min-h-[15px] px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
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
                                                        multiple
                                                        disabled={actionLoading}
                                                        className="sr-only"
                                                        onChange={e => {
                                                            const files = Array.from(e.target.files || []);
                                                            if (files.length > 0) handleAddExpenseReceiptInEdit(files);
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
                                        {/* Action Toolbar for Live Capture */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <button
                                                type="button"
                                                disabled={actionLoading}
                                                onClick={() => {
                                                    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
                                                    if (isMobile && issueCameraPhotoRef.current) {
                                                        issueCameraPhotoRef.current.click();
                                                    } else {
                                                        setLiveCameraCategory('Before Repair');
                                                        setLiveCameraMode('photo');
                                                        setIsLiveCameraOpen(true);
                                                    }
                                                }}
                                                className="px-3 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                <Camera className="w-4 h-4" /> Take
                                            </button>
                                            <button
                                                type="button"
                                                disabled={actionLoading}
                                                onClick={() => {
                                                    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
                                                    if (isMobile && issueCameraVideoRef.current) {
                                                        issueCameraVideoRef.current.click();
                                                    } else {
                                                        setLiveCameraCategory('Before Repair');
                                                        setLiveCameraMode('video');
                                                        setIsLiveCameraOpen(true);
                                                    }
                                                }}
                                                className="px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                <Video className="w-4 h-4" /> Record
                                            </button>
                                            <label htmlFor="upload-issue-media-popup" className={`px-3 py-2.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-lg cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold text-on-surface dark:text-dark-on-surface transition-colors ${actionLoading ? 'pointer-events-none opacity-50' : ''}`}>
                                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin text-current" /> : <Upload className="w-4 h-4 text-primary" />} Browse
                                            </label>
                                        </div>

                                        <input type="file" accept="image/*,video/*" multiple onChange={handleUploadIssueMedia} disabled={actionLoading} className="hidden" id="upload-issue-media-popup" />
                                        <input ref={issueCameraPhotoRef} type="file" accept="image/*" capture="environment" onChange={handleUploadIssueMedia} disabled={actionLoading} className="hidden" />
                                        <input ref={issueCameraVideoRef} type="file" accept="video/*" capture="environment" onChange={handleUploadIssueMedia} disabled={actionLoading} className="hidden" />

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
                                        {/* Action Toolbar for Live Capture */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <button
                                                type="button"
                                                disabled={actionLoading}
                                                onClick={() => {
                                                    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
                                                    if (isMobile && completedCameraPhotoRef.current) {
                                                        completedCameraPhotoRef.current.click();
                                                    } else {
                                                        setLiveCameraCategory('After Repair');
                                                        setLiveCameraMode('photo');
                                                        setIsLiveCameraOpen(true);
                                                    }
                                                }}
                                                className="px-3 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                <Camera className="w-4 h-4" /> Photo
                                            </button>
                                            <button
                                                type="button"
                                                disabled={actionLoading}
                                                onClick={() => {
                                                    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
                                                    if (isMobile && completedCameraVideoRef.current) {
                                                        completedCameraVideoRef.current.click();
                                                    } else {
                                                        setLiveCameraCategory('After Repair');
                                                        setLiveCameraMode('video');
                                                        setIsLiveCameraOpen(true);
                                                    }
                                                }}
                                                className="px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                <Video className="w-4 h-4" /> Video
                                            </button>
                                            <label htmlFor="upload-completed-media-popup" className={`px-3 py-2.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-lg cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold text-on-surface dark:text-dark-on-surface transition-colors ${actionLoading ? 'pointer-events-none opacity-50' : ''}`}>
                                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin text-current" /> : <Upload className="w-4 h-4 text-primary" />} Browse
                                            </label>
                                        </div>

                                        <input type="file" accept="image/*,video/*" multiple onChange={handleUploadCompletedMedia} disabled={actionLoading} className="hidden" id="upload-completed-media-popup" />
                                        <input ref={completedCameraPhotoRef} type="file" accept="image/*" capture="environment" onChange={handleUploadCompletedMedia} disabled={actionLoading} className="hidden" />
                                        <input ref={completedCameraVideoRef} type="file" accept="video/*" capture="environment" onChange={handleUploadCompletedMedia} disabled={actionLoading} className="hidden" />

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

                {/* 9. MEDIA PREVIEW MODAL OVERLAY (FOR EXPENSE RECEIPTS & CHAT) */}
                {
                    previewItem && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.85 }}
                                exit={{ opacity: 0 }}
                                onClick={() => { setPreviewItem(null); setPreviewRotation(0); }}
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
                                <div className="absolute -top-12 right-0 flex items-center gap-2">
                                    {/* Rotation Controls */}
                                    {(isImage(previewItem.name) || isVideo(previewItem.name)) && (
                                        <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/20 mr-2">
                                            <button
                                                type="button"
                                                onClick={handlePreviewRotateLeft}
                                                className="p-1.5 rounded-full hover:bg-white/20 text-white cursor-pointer transition-colors"
                                                title="Rotate 90° Left (Counter-clockwise)"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                            </button>
                                            <span className="text-[10px] font-mono font-medium text-white/90 px-1">{previewRotation}°</span>
                                            <button
                                                type="button"
                                                onClick={handlePreviewRotateRight}
                                                className="p-1.5 rounded-full hover:bg-white/20 text-white cursor-pointer transition-colors"
                                                title="Rotate 90° Right (Clockwise)"
                                            >
                                                <RotateCw className="w-4 h-4" />
                                            </button>
                                            {previewRotation !== (previewItem.rotation || 0) && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={handlePreviewResetRotation}
                                                        className="p-1.5 rounded-full hover:bg-white/20 text-white cursor-pointer transition-colors ml-1"
                                                        title="Reset Rotation"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                    </button>
                                                    {previewItem.media_id && (
                                                        <button
                                                            type="button"
                                                            onClick={handleSavePreviewRotation}
                                                            disabled={isSavingPreviewRotation}
                                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-md ml-1.5 disabled:opacity-50"
                                                            title="Save rotated orientation permanently to server"
                                                        >
                                                            {isSavingPreviewRotation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                            <span className="text-[10px] font-bold">Save Rotation</span>
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

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
                                        onClick={() => { setPreviewItem(null); setPreviewRotation(0); }}
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
                                            style={{
                                                transform: `rotate(${previewRotation}deg)`,
                                                transition: isSavingPreviewRotation ? 'none' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }}
                                            className="max-w-full max-h-[75vh] object-contain rounded-md select-none pointer-events-none"
                                        />
                                    ) : isVideo(previewItem.name) ? (
                                        <RotatableVideoPlayer
                                            src={previewItem.url}
                                            rotation={previewRotation}
                                            autoPlay
                                            controls
                                            className="w-full max-h-[75vh]"
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

            {/* 12. PRE-UPLOAD MEDIA ROTATION & REVIEW MODAL */}
            <AnimatePresence>
                {pendingUploadQueue && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.85 }}
                            exit={{ opacity: 0 }}
                            onClick={handleCancelPendingUpload}
                            className="fixed inset-0 bg-black/90 backdrop-blur-xs cursor-pointer"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant w-full max-w-2xl p-4 sm:p-5 rounded-2xl shadow-2xl z-10 max-h-[90vh] flex flex-col"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
                                <div>
                                    <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Review & Adjust Orientation</h3>
                                    <p className="text-[11px] text-outline">Rotate image(s) upright before uploading ({pendingUploadQueue.length} selected)</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCancelPendingUpload}
                                    disabled={actionLoading}
                                    className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="py-4 overflow-y-auto max-h-[60vh] space-y-4 my-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {pendingUploadQueue.map((item, idx) => (
                                        <div key={item.id} className="bg-surface dark:bg-dark-surface p-3 rounded-xl border border-outline-variant dark:border-dark-outline-variant flex flex-col gap-2 relative">
                                            <div className="w-full h-44 bg-black/80 rounded-lg overflow-hidden flex items-center justify-center relative p-1">
                                                {item.file.type.startsWith('image/') ? (
                                                    <img
                                                        src={item.previewUrl}
                                                        alt={item.file.name}
                                                        style={{
                                                            transform: `rotate(${item.rotation}deg)`,
                                                            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                                        }}
                                                        className="max-w-full max-h-full object-contain"
                                                    />
                                                ) : item.file.type.startsWith('video/') ? (
                                                    <RotatableVideoPlayer
                                                        src={item.previewUrl}
                                                        rotation={item.rotation}
                                                        className="w-full h-full"
                                                    />
                                                ) : (
                                                    <div className="text-white text-xs font-semibold">{item.file.name}</div>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between pt-1">
                                                <span className="text-[10px] font-medium text-on-surface truncate max-w-[140px]" title={item.file.name}>
                                                    {item.file.name}
                                                </span>

                                                {(item.file.type.startsWith('image/') || item.file.type.startsWith('video/')) && (
                                                    <div className="flex items-center gap-1 bg-surface-container-high px-2 py-1 rounded-lg border border-outline-variant/60">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setPendingUploadQueue(prev => prev ? prev.map((it, i) => i === idx ? { ...it, rotation: (it.rotation - 90 + 360) % 360 } : it) : null);
                                                            }}
                                                            className="p-1 text-on-surface hover:text-primary rounded cursor-pointer"
                                                            title="Rotate 90° Left"
                                                        >
                                                            <RotateCcw className="w-3.5 h-3.5" />
                                                        </button>
                                                        <span className="text-[10px] font-mono font-bold text-primary px-1">{item.rotation}°</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setPendingUploadQueue(prev => prev ? prev.map((it, i) => i === idx ? { ...it, rotation: (it.rotation + 90) % 360 } : it) : null);
                                                            }}
                                                            className="p-1 text-on-surface hover:text-primary rounded cursor-pointer"
                                                            title="Rotate 90° Right"
                                                        >
                                                            <RotateCw className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/60">
                                <button
                                    type="button"
                                    onClick={handleCancelPendingUpload}
                                    disabled={actionLoading}
                                    className="px-4 py-2 border border-outline-variant rounded text-xs font-semibold text-on-surface hover:bg-surface-container-high cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmPendingUpload}
                                    disabled={actionLoading}
                                    className="px-5 py-2.5 bg-primary text-white text-xs font-semibold rounded hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />} Upload Media ({pendingUploadQueue.length})
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* UNIFIED CONTACT SELECTION MODAL */}
            <AnimatePresence>
                {isCallSelectModalOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.6 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsCallSelectModalOpen(false)}
                            className="fixed inset-0 bg-black cursor-pointer"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded p-5 max-w-md w-full z-10 shadow-2xl space-y-4"
                        >
                            <div className="flex items-center justify-between border-b border-outline-variant dark:border-dark-outline-variant pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                        <PhoneCall className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-on-surface dark:text-dark-on-surface">Who do you want to call?</h3>
                                        <p className="text-[11px] text-outline">Select a contact to initiate call</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsCallSelectModalOpen(false)}
                                    className="p-1 text-outline hover:text-on-surface rounded-lg transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                                {(() => {
                                    const currentMgr = ticketDetails?.store?.manager;
                                    const mgrPhone = currentMgr?.phone || currentMgr?.whatsapp_number;
                                    const cleanMgr = mgrPhone ? String(mgrPhone).replace(/\D/g, '') : '';
                                    const locPhone = ticketDetails?.store?.phone || ticketDetails?.store?.whatsapp_number;
                                    const cleanLoc = locPhone ? String(locPhone).replace(/\D/g, '') : '';

                                    const isSamePerson = currentMgr && ticketDetails?.created_by && Number(currentMgr.user_id) === Number(ticketDetails.created_by.user_id);
                                    const mgrFirstName = currentMgr?.full_name ? currentMgr.full_name.split(' ')[0] : 'Manager';
                                    const mgrLabel = isSamePerson ? `Call ${mgrFirstName}` : 'Call Manager';

                                    const validWorkers = (allocations || []).filter(a => {
                                        const p = a.worker?.phone || a.worker?.whatsapp_number;
                                        return p && String(p).replace(/\D/g, '').length >= 8;
                                    });

                                    return (
                                        <>
                                            {(cleanMgr || cleanLoc) && (
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Store & Location Contacts</p>
                                                    {cleanMgr && (
                                                        <div className="flex items-center justify-between p-3 bg-surface-container dark:bg-dark-surface-container rounded border border-outline-variant/60 dark:border-dark-outline-variant/60 gap-3">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <AvatarCircle user={currentMgr} size="md" />
                                                                <div className="min-w-0">
                                                                    <p className="font-bold text-xs text-on-surface dark:text-dark-on-surface truncate">{currentMgr?.full_name || 'Store Manager'}</p>
                                                                    <p className="text-[10px] text-outline">Store Manager · {ticketDetails?.store?.store_name}</p>
                                                                    <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{mgrPhone}</p>
                                                                </div>
                                                            </div>
                                                            <a
                                                                href={`tel:${cleanMgr}`}
                                                                onClick={() => setIsCallSelectModalOpen(false)}
                                                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                                                            >
                                                                <PhoneCall className="w-3.5 h-3.5" />
                                                                <span>{mgrLabel}</span>
                                                            </a>
                                                        </div>
                                                    )}

                                                    {cleanLoc && (
                                                        <div className="flex items-center justify-between p-3 bg-surface-container dark:bg-dark-surface-container rounded border border-outline-variant/60 dark:border-dark-outline-variant/60 gap-3">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                                                    <Building2 className="w-5 h-5" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-bold text-xs text-on-surface dark:text-dark-on-surface truncate">{ticketDetails?.store?.store_name}</p>
                                                                    <p className="text-[10px] text-outline">Store Location Phone</p>
                                                                    <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{locPhone}</p>
                                                                </div>
                                                            </div>
                                                            <a
                                                                href={`tel:${cleanLoc}`}
                                                                onClick={() => setIsCallSelectModalOpen(false)}
                                                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                                                            >
                                                                <Phone className="w-3.5 h-3.5" />
                                                                <span>Call Location</span>
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {validWorkers.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Allocated Workers ({validWorkers.length})</p>
                                                    {validWorkers.map(a => {
                                                        const rawP = a.worker?.phone || a.worker?.whatsapp_number;
                                                        const cleanP = rawP ? String(rawP).replace(/\D/g, '') : '';
                                                        const firstName = a.worker?.full_name ? a.worker.full_name.split(' ')[0] : 'Worker';

                                                        return (
                                                            <div key={a.allocation_id} className="flex items-center justify-between p-3 bg-surface-container dark:bg-dark-surface-container rounded border border-outline-variant/60 dark:border-dark-outline-variant/60 gap-3">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <AvatarCircle user={a.worker} size="md" />
                                                                    <div className="min-w-0">
                                                                        <p className="font-bold text-xs text-on-surface dark:text-dark-on-surface truncate">{a.worker.full_name}</p>
                                                                        <p className="text-[10px] text-outline">{a.worker.role?.role_name || 'Worker'} {a.worker.employee_no ? `· ID: ${a.worker.employee_no}` : ''}</p>
                                                                        <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{rawP}</p>
                                                                    </div>
                                                                </div>
                                                                <a
                                                                    href={`tel:${cleanP}`}
                                                                    onClick={() => setIsCallSelectModalOpen(false)}
                                                                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                                                                >
                                                                    <PhoneCall className="w-3.5 h-3.5" />
                                                                    <span>Call {firstName}</span>
                                                                </a>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* WORKER SPECIFIC CALL SELECTION MODAL */}
            <AnimatePresence>
                {isCallWorkerModalOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.6 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsCallWorkerModalOpen(false)}
                            className="fixed inset-0 bg-black cursor-pointer"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded p-5 max-w-md w-full z-10 shadow-2xl space-y-4"
                        >
                            <div className="flex items-center justify-between border-b border-outline-variant dark:border-dark-outline-variant pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                        <PhoneCall className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-on-surface dark:text-dark-on-surface">Which worker do you want to call?</h3>
                                        <p className="text-[11px] text-outline">Select allocated worker to initiate call</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsCallWorkerModalOpen(false)}
                                    className="p-1 text-outline hover:text-on-surface rounded-lg transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                                {(() => {
                                    const validWorkers = (allocations || []).filter(a => {
                                        const p = a.worker?.phone || a.worker?.whatsapp_number;
                                        return p && String(p).replace(/\D/g, '').length >= 8;
                                    });

                                    return validWorkers.map(a => {
                                        const rawP = a.worker?.phone || a.worker?.whatsapp_number;
                                        const cleanP = rawP ? String(rawP).replace(/\D/g, '') : '';
                                        const firstName = a.worker?.full_name ? a.worker.full_name.split(' ')[0] : 'Worker';

                                        return (
                                            <div key={a.allocation_id} className="flex items-center justify-between p-3 bg-surface-container dark:bg-dark-surface-container rounded border border-outline-variant/60 dark:border-dark-outline-variant/60 gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <AvatarCircle user={a.worker} size="md" />
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-xs text-on-surface dark:text-dark-on-surface truncate">{a.worker.full_name}</p>
                                                        <p className="text-[10px] text-outline">{a.worker.role?.role_name || 'Worker'} {a.worker.employee_no ? `· ID: ${a.worker.employee_no}` : ''}</p>
                                                        <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{rawP}</p>
                                                    </div>
                                                </div>
                                                <a
                                                    href={`tel:${cleanP}`}
                                                    onClick={() => setIsCallWorkerModalOpen(false)}
                                                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                                                >
                                                    <PhoneCall className="w-3.5 h-3.5" />
                                                    <span>Call {firstName}</span>
                                                </a>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* LOCATION CALL SELECTION MODAL */}
            <AnimatePresence>
                {isCallLocationModalOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.6 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsCallLocationModalOpen(false)}
                            className="fixed inset-0 bg-black cursor-pointer"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded p-5 max-w-md w-full z-10 shadow-2xl space-y-4"
                        >
                            <div className="flex items-center justify-between border-b border-outline-variant dark:border-dark-outline-variant pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-lg">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-on-surface dark:text-dark-on-surface">Which location contact do you want to call?</h3>
                                        <p className="text-[11px] text-outline">Select store manager or location phone</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsCallLocationModalOpen(false)}
                                    className="p-1 text-outline hover:text-on-surface rounded-lg transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                                {(() => {
                                    const currentMgr = ticketDetails?.store?.manager;
                                    const mgrPhone = currentMgr?.phone || currentMgr?.whatsapp_number;
                                    const cleanMgr = mgrPhone ? String(mgrPhone).replace(/\D/g, '') : '';
                                    const locPhone = ticketDetails?.store?.phone || ticketDetails?.store?.whatsapp_number;
                                    const cleanLoc = locPhone ? String(locPhone).replace(/\D/g, '') : '';

                                    const isSamePerson = currentMgr && ticketDetails?.created_by && Number(currentMgr.user_id) === Number(ticketDetails.created_by.user_id);
                                    const mgrFirstName = currentMgr?.full_name ? currentMgr.full_name.split(' ')[0] : 'Manager';
                                    const mgrLabel = isSamePerson ? `Call ${mgrFirstName}` : 'Call Manager';

                                    return (
                                        <>
                                            {cleanMgr && (
                                                <div className="flex items-center justify-between p-3 bg-surface-container dark:bg-dark-surface-container rounded border border-outline-variant/60 dark:border-dark-outline-variant/60 gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <AvatarCircle user={currentMgr} size="md" />
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-xs text-on-surface dark:text-dark-on-surface truncate">{currentMgr?.full_name || 'Store Manager'}</p>
                                                            <p className="text-[10px] text-outline">Store Manager · {ticketDetails?.store?.store_name}</p>
                                                            <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{mgrPhone}</p>
                                                        </div>
                                                    </div>
                                                    <a
                                                        href={`tel:${cleanMgr}`}
                                                        onClick={() => setIsCallLocationModalOpen(false)}
                                                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                                                    >
                                                        <PhoneCall className="w-3.5 h-3.5" />
                                                        <span>{mgrLabel}</span>
                                                    </a>
                                                </div>
                                            )}

                                            {cleanLoc && (
                                                <div className="flex items-center justify-between p-3 bg-surface-container dark:bg-dark-surface-container rounded border border-outline-variant/60 dark:border-dark-outline-variant/60 gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-10 h-10 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                                                            <Building2 className="w-5 h-5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-xs text-on-surface dark:text-dark-on-surface truncate">{ticketDetails?.store?.store_name}</p>
                                                            <p className="text-[10px] text-outline">Store Location Phone</p>
                                                            <p className="text-[10px] font-mono text-teal-600 dark:text-teal-400 font-semibold">{locPhone}</p>
                                                        </div>
                                                    </div>
                                                    <a
                                                        href={`tel:${cleanLoc}`}
                                                        onClick={() => setIsCallLocationModalOpen(false)}
                                                        className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                                                    >
                                                        <Phone className="w-3.5 h-3.5" />
                                                        <span>Call Location</span>
                                                    </a>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <LiveCameraModal
                isOpen={isLiveCameraOpen}
                initialMode={liveCameraMode}
                onClose={() => setIsLiveCameraOpen(false)}
                onCapture={(capturedFile) => {
                    queueFilesForReview([capturedFile], liveCameraCategory);
                }}
            />
        </div>
    );
};
