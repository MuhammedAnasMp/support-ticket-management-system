import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Loader2, X, Upload, Trash2, Image as ImageIcon, AlertCircle, Headphones, Camera, Video, RotateCcw, RotateCw } from 'lucide-react';
import { API_URL, RotatableVideoPlayer, rotateImageFile } from './TicketsTypesAndComponents';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { LiveCameraModal } from '@/components/LiveCameraModal';
import { SearchableSelect } from '@/components/SearchableSelect';

const inputCls = "w-full bg-surface-container border border-outline-variant text-on-surface text-xs rounded px-3 py-2 focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors placeholder:text-on-surface-variant/60";

interface CreateTicketAttachment {
    id: string;
    file: File;
    rotation: number;
    previewUrl: string;
    isImg: boolean;
    isVid: boolean;
    isAudio: boolean;
}

interface CreateTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    token: string | null;
    user: any;
    stores: any[];
    departments: any[];
    availableDepartments: any[];
    natures: any[];
    canCreateAllDepts: boolean;
}

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    token,
    user,
    stores,
    availableDepartments,
    natures,
    canCreateAllDepts
}) => {
    const [createForm, setCreateForm] = useState({
        store_id: '',
        department_id: '',
        nature_id: '',
        title: '',
        description: ''
    });
    const [attachmentItems, setAttachmentItems] = useState<CreateTicketAttachment[]>([]);
    const [pendingOrientationQueue, setPendingOrientationQueue] = useState<CreateTicketAttachment[] | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isRecordingPending, setIsRecordingPending] = useState(false);

    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const [cameraModalMode, setCameraModalMode] = useState<'photo' | 'video'>('photo');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraPhotoInputRef = useRef<HTMLInputElement>(null);
    const cameraVideoInputRef = useRef<HTMLInputElement>(null);

    // Prevent background page scrolling while modal is open
    React.useEffect(() => {
        if (!isOpen) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = (originalOverflow && originalOverflow !== 'hidden') ? originalOverflow : '';
        };
    }, [isOpen]);

    // Re-sync/reset form when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setCreateForm({
                store_id: stores.length === 1 ? String(stores[0].store_id) : '',
                department_id: availableDepartments.length === 1 ? String(availableDepartments[0].department_id) : '',
                nature_id: '',
                title: '',
                description: ''
            });
            attachmentItems.forEach(i => { try { URL.revokeObjectURL(i.previewUrl); } catch (_) {} });
            setAttachmentItems([]);
            setErrorMessage(null);
        }
    }, [isOpen, stores, availableDepartments]);

    const [localNatures, setLocalNatures] = useState<any[]>([]);
    const [loadingNatures, setLoadingNatures] = useState(false);

    // Fetch natures dynamically from API when department changes
    React.useEffect(() => {
        if (!createForm.department_id) {
            setLocalNatures([]);
            return;
        }
        setLoadingNatures(true);
        fetch(`${API_URL}/maintenance/worknature/?department=${createForm.department_id}`, {
            headers: token ? { Authorization: `Token ${token}` } : {}
        })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setLocalNatures(data);
                else if (data.results && Array.isArray(data.results)) setLocalNatures(data.results);
                else setLocalNatures([]);
            })
            .catch(err => {
                console.error(err);
                setLocalNatures([]);
            })
            .finally(() => setLoadingNatures(false));
    }, [createForm.department_id, token]);

    const filteredNatures = localNatures;

    const selectedNature = useMemo(() => {
        return filteredNatures.find(n => Number(n.nature_id) === Number(createForm.nature_id)) ||
            natures.find(n => Number(n.nature_id) === Number(createForm.nature_id));
    }, [filteredNatures, natures, createForm.nature_id]);

    const isMediaRequired = selectedNature ? (selectedNature.media_required !== false) : false;

    const handleFileSelect = (files: FileList | File[]) => {
        const newFiles = Array.from(files);
        const queueItems: CreateTicketAttachment[] = newFiles.map((file, idx) => {
            const isImg = file.type.startsWith('image/');
            const isVid = file.type.startsWith('video/') && !file.name.endsWith('.webm');
            const isAudio = file.type.startsWith('audio/') || file.name.endsWith('.webm') || file.name.endsWith('.ogg') || file.name.endsWith('.wav');
            return {
                id: `${file.name}-${Date.now()}-${idx}`,
                file,
                rotation: 0,
                previewUrl: URL.createObjectURL(file),
                isImg,
                isVid,
                isAudio
            };
        });

        const hasVisualMedia = queueItems.some(i => i.isImg || i.isVid);
        if (hasVisualMedia) {
            setPendingOrientationQueue(queueItems);
        } else {
            setAttachmentItems(prev => [...prev, ...queueItems]);
        }
        setErrorMessage(null);
    };

    const handleConfirmOrientationQueue = () => {
        if (!pendingOrientationQueue) return;
        setAttachmentItems(prev => [...prev, ...pendingOrientationQueue]);
        setPendingOrientationQueue(null);
    };

    const handleCancelOrientationQueue = () => {
        if (pendingOrientationQueue) {
            pendingOrientationQueue.forEach(i => {
                try { URL.revokeObjectURL(i.previewUrl); } catch (_) {}
            });
        }
        setPendingOrientationQueue(null);
    };

    const handleRemoveFile = (index: number) => {
        setAttachmentItems(prev => {
            const itemToRemove = prev[index];
            if (itemToRemove?.previewUrl) {
                try { URL.revokeObjectURL(itemToRemove.previewUrl); } catch (_) {}
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    const resetForm = () => {
        setCreateForm({
            store_id: stores.length === 1 ? String(stores[0].store_id) : '',
            department_id: availableDepartments.length === 1 ? String(availableDepartments[0].department_id) : '',
            nature_id: '',
            title: '',
            description: ''
        });
        if (pendingOrientationQueue) {
            pendingOrientationQueue.forEach(i => { try { URL.revokeObjectURL(i.previewUrl); } catch (_) {} });
            setPendingOrientationQueue(null);
        }
        attachmentItems.forEach(i => {
            try { URL.revokeObjectURL(i.previewUrl); } catch (_) {}
        });
        setAttachmentItems([]);
        setErrorMessage(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isMediaRequired && attachmentItems.length < 1) {
            setErrorMessage('Please attach a minimum of 1 media files for the selected Work Nature.');
            return;
        }

        setActionLoading(true);
        setErrorMessage(null);

        const detectDeviceInfo = () => {
            const ua = navigator.userAgent || '';
            let os = 'Unknown OS';
            if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
            else if (/Android/i.test(ua)) os = 'Android';
            else if (/Win/i.test(ua)) os = 'Windows';
            else if (/Mac/i.test(ua)) os = 'macOS';
            else if (/Linux/i.test(ua)) os = 'Linux';

            let browser = '';
            if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
            else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
            else if (/Edg/i.test(ua)) browser = 'Edge';
            else if (/Firefox/i.test(ua)) browser = 'Firefox';

            return browser ? `${os} (${browser})` : os;
        };

        try {
            const response = await fetch(`${API_URL}/maintenance/ticket/`, {
                method: 'POST',
                headers: {
                    Authorization: `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    store: createForm.store_id,
                    department: createForm.department_id,
                    nature: createForm.nature_id,
                    title: createForm.title,
                    description: createForm.description,
                    device_info: detectDeviceInfo()
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.detail || errData?.message || 'Failed to create ticket.');
            }

            const createdTicket = await response.json();

            // Upload attached media files if present
            if (attachmentItems.length > 0 && createdTicket?.ticket_id) {
                let categoryId: string | undefined = undefined;
                try {
                    const catRes = await fetch(`${API_URL}/common/mediacategory/`, {
                        headers: { Authorization: `Token ${token}` }
                    });
                    if (catRes.ok) {
                        const categories = await catRes.json();
                        const ticketDeptId = Number(createForm.department_id);
                        const catObj = categories.find((c: any) => {
                            const isBeforeRepair = c.category_name.toLowerCase() === 'before repair';
                            if (!isBeforeRepair) return false;
                            const cDeptId = Number(c.department?.department_id ?? c.department);
                            return !cDeptId || cDeptId === ticketDeptId;
                        }) || categories.find((c: any) => c.category_name.toLowerCase() === 'before repair');

                        if (catObj) categoryId = String(catObj.category_id);
                    }
                } catch (catErr) {
                    console.error('Failed to load media categories:', catErr);
                }

                for (const item of attachmentItems) {
                    let fileToUpload = item.file;
                    let rotToSave = item.rotation;

                    if (item.rotation % 360 !== 0 && item.isImg) {
                        fileToUpload = await rotateImageFile(item.file, item.rotation);
                        rotToSave = 0;
                    }

                    const formData = new FormData();
                    formData.append('ticket', String(createdTicket.ticket_id));
                    formData.append('file_url', fileToUpload);
                    formData.append('file_name', fileToUpload.name);
                    if (categoryId) formData.append('category', categoryId);
                    if (user?.user_id) formData.append('uploaded_by', String(user.user_id));
                    if (rotToSave % 360 !== 0) formData.append('rotation', rotToSave.toString());

                    try {
                        await fetch(`${API_URL}/common/media/`, {
                            method: 'POST',
                            headers: { Authorization: `Token ${token}` },
                            body: formData
                        });
                    } catch (mediaErr) {
                        console.error('Failed to upload file:', item.file.name, mediaErr);
                    }
                }
            }

            resetForm();
            onSuccess();
            onClose();
        } catch (err: any) {
            setErrorMessage(err.message || 'Connection issue. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.6 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-xs touch-manipulation"
                        />

                        {/* Modal Content */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 16 }}
                            className="relative bg-surface-container border border-outline-variant w-full max-w-xl max-h-[90vh] flex flex-col rounded shadow-2xl overflow-hidden z-10"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant bg-surface-container-low">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary-container text-on-primary-container rounded flex items-center justify-center">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-on-surface">Raise Support Ticket</h3>
                                        <p className="text-xs text-on-surface-variant">Submit a new maintenance request</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                                    aria-label="Close"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Modal Body / Form */}
                            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                                {/* Error Banner */}
                                {errorMessage && (
                                    <div className="flex items-center gap-2.5 p-3 rounded bg-error-container text-on-error-container text-xs border border-error/20">
                                        <AlertCircle className="w-4 h-4 shrink-0 text-error" />
                                        <span className="flex-1">{errorMessage}</span>
                                        <button type="button" onClick={() => setErrorMessage(null)}>
                                            <X className="w-3.5 h-3.5 opacity-70 hover:opacity-100" />
                                        </button>
                                    </div>
                                )}

                                {/* Store & Department Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-on-surface mb-1.5">
                                            Store <span className="text-error">*</span>
                                        </label>
                                        <SearchableSelect
                                            required
                                            value={createForm.store_id}
                                            onChange={val => setCreateForm({ ...createForm, store_id: val })}
                                            placeholder="Select Store"
                                            options={stores.map(s => ({
                                                value: s.store_id,
                                                label: `${s.store_id} - ${s.store_name}`
                                            }))}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-on-surface mb-1.5">
                                            Department <span className="text-error">*</span>
                                        </label>
                                        <SearchableSelect
                                            required
                                            disabled={!canCreateAllDepts && availableDepartments.length <= 1}
                                            value={createForm.department_id}
                                            onChange={val => setCreateForm({ ...createForm, department_id: val, nature_id: '' })}
                                            placeholder="Select Department"
                                            options={availableDepartments.map(d => ({
                                                value: d.department_id,
                                                label: d.department_name
                                            }))}
                                        />
                                    </div>
                                </div>

                                {/* Work Nature */}
                                <div>
                                    <label className="block text-xs font-medium text-on-surface mb-1.5">
                                        Nature of Work <span className="text-error">*</span>
                                    </label>
                                    <SearchableSelect
                                        required
                                        disabled={!createForm.department_id || loadingNatures}
                                        value={createForm.nature_id}
                                        onChange={val => setCreateForm({ ...createForm, nature_id: val })}
                                        placeholder={
                                            loadingNatures
                                                ? 'Loading Natures of Work...'
                                                : createForm.department_id
                                                    ? 'Select Nature of Work'
                                                    : 'Select Department first'
                                        }
                                        options={filteredNatures.map(n => ({
                                            value: n.nature_id,
                                            label: n.nature_name
                                        }))}
                                    />
                                </div>

                                {/* Issue Title */}
                                <div>
                                    <label className="block text-xs font-medium text-on-surface mb-1.5">
                                        Issue Title <span className="text-error">*</span>
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Briefly describe the issue..."
                                        value={createForm.title}
                                        onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                                        className={inputCls}
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-xs font-medium text-on-surface mb-1.5">
                                        Description <span className="text-error">*</span>
                                    </label>
                                    <textarea
                                        required
                                        rows={3}
                                        placeholder="Provide detailed description of the issue..."
                                        value={createForm.description}
                                        onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                                        className={`${inputCls} resize-none`}
                                    />
                                </div>

                                {/* Media Attachment Dropzone & Live Camera Capture */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-xs font-medium text-on-surface">
                                            Attach Media  {isMediaRequired && <span className="text-error">* (Min 1 required)</span>}
                                        </label>
                                        <span className="text-[11px] text-on-surface-variant">
                                            {attachmentItems.length} file(s) attached
                                        </span>
                                    </div>

                                    {/* Quick Live Capture Action Toolbar */}
                                    <div className="grid grid-cols-3 gap-2 mb-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
                                                if (isMobile && cameraPhotoInputRef.current) {
                                                    cameraPhotoInputRef.current.click();
                                                } else {
                                                    setCameraModalMode('photo');
                                                    setIsCameraModalOpen(true);
                                                }
                                            }}
                                            className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                            <Camera className="w-4 h-4" />
                                            <span>Photo</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
                                                if (isMobile && cameraVideoInputRef.current) {
                                                    cameraVideoInputRef.current.click();
                                                } else {
                                                    setCameraModalMode('video');
                                                    setIsCameraModalOpen(true);
                                                }
                                            }}
                                            className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                            <Video className="w-4 h-4" />
                                            <span>Video</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-3 py-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-on-surface text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                            <Upload className="w-4 h-4 text-primary" />
                                            <span>Browse</span>
                                        </button>
                                    </div>

                                    {/* Hidden Inputs for Native Mobile Camera & Standard Upload */}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/*,video/*"
                                        className="hidden"
                                        onChange={e => {
                                            if (e.target.files) handleFileSelect(e.target.files);
                                            e.target.value = '';
                                        }}
                                    />
                                    <input
                                        ref={cameraPhotoInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        onChange={e => {
                                            if (e.target.files) handleFileSelect(e.target.files);
                                            e.target.value = '';
                                        }}
                                    />
                                    <input
                                        ref={cameraVideoInputRef}
                                        type="file"
                                        accept="video/*"
                                        capture="environment"
                                        className="hidden"
                                        onChange={e => {
                                            if (e.target.files) handleFileSelect(e.target.files);
                                            e.target.value = '';
                                        }}
                                    />

                                    {/* Drag & Dropzone */}
                                    <div
                                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={e => {
                                            e.preventDefault();
                                            setIsDragging(false);
                                            if (e.dataTransfer.files) handleFileSelect(e.dataTransfer.files);
                                        }}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`border border-dashed rounded p-3 text-center cursor-pointer transition-colors ${isDragging
                                            ? 'border-primary bg-primary/5'
                                            : 'border-outline-variant bg-surface-container-low hover:bg-surface-container-high'
                                            }`}
                                    >
                                        <Upload className="w-4 h-4 mx-auto mb-1 text-on-surface-variant" />
                                        <p className="text-xs text-on-surface font-medium">Click to browse or drag & drop</p>
                                        <p className="text-[10px] text-on-surface-variant">Supports photos, video recordings & documents</p>
                                    </div>

                                    {/* Voice Note Recorder Option */}
                                    <div className="mt-3">
                                        <VoiceRecorder
                                            onSave={(voiceFile) => {
                                                handleFileSelect([voiceFile]);
                                            }}
                                            onRecordingStateChange={setIsRecordingPending}
                                            placeholderText="Record a voice note explanation"
                                        />
                                    </div>

                                    {/* Attached Files List with Rotation Review */}
                                    {attachmentItems.length > 0 && (
                                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {attachmentItems.map((item, idx) => (
                                                <div
                                                    key={item.id}
                                                    className="relative group border border-outline-variant rounded-lg p-2 bg-surface-container-low flex flex-col items-center justify-between text-center overflow-hidden min-h-[140px]"
                                                >
                                                    <div className="w-full h-28 bg-black/80 rounded flex items-center justify-center relative overflow-hidden p-1">
                                                        {item.isImg ? (
                                                            <img
                                                                src={item.previewUrl}
                                                                alt={item.file.name}
                                                                style={{
                                                                    transform: `rotate(${item.rotation}deg)`,
                                                                    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                                                }}
                                                                className="max-w-full max-h-full object-contain"
                                                            />
                                                        ) : item.isVid ? (
                                                            <RotatableVideoPlayer
                                                                src={item.previewUrl}
                                                                rotation={item.rotation}
                                                                className="w-full h-full"
                                                            />
                                                        ) : item.isAudio ? (
                                                            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-primary">
                                                                <Headphones className="w-5 h-5 animate-pulse mb-1" />
                                                                <audio src={item.previewUrl} controls className="w-full h-8" />
                                                            </div>
                                                        ) : (
                                                            <div className="text-white text-xs font-semibold px-2 truncate">{item.file.name}</div>
                                                        )}
                                                    </div>

                                                    <div className="w-full flex items-center justify-between pt-1 text-[10px]">
                                                        <span className="font-medium text-on-surface truncate max-w-[120px]" title={item.file.name}>
                                                            {item.file.name}
                                                        </span>

                                                        {(item.isImg || item.isVid) && (
                                                            <div className="flex items-center gap-1 bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant/60">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAttachmentItems(prev => prev.map((it, i) => i === idx ? { ...it, rotation: (it.rotation - 90 + 360) % 360 } : it));
                                                                    }}
                                                                    className="p-1 text-on-surface hover:text-primary rounded cursor-pointer"
                                                                    title="Rotate 90° Left"
                                                                >
                                                                    <RotateCcw className="w-3 h-3" />
                                                                </button>
                                                                <span className="font-mono font-bold text-primary px-0.5">{item.rotation}°</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAttachmentItems(prev => prev.map((it, i) => i === idx ? { ...it, rotation: (it.rotation + 90) % 360 } : it));
                                                                    }}
                                                                    className="p-1 text-on-surface hover:text-primary rounded cursor-pointer"
                                                                    title="Rotate 90° Right"
                                                                >
                                                                    <RotateCw className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={e => { e.stopPropagation(); handleRemoveFile(idx); }}
                                                            className="p-1 text-error hover:bg-error/10 rounded transition-colors"
                                                            title="Remove file"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Modal Footer Actions */}
                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant bg-surface-container-low -mx-5 -mb-5 p-5">
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium px-3.5 py-2 rounded flex items-center gap-2 transition-colors"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={actionLoading || isRecordingPending}
                                        className="bg-primary hover:bg-primary-container text-on-primary text-xs font-medium px-3.5 py-2 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {actionLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Submitting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-4 h-4" />
                                                <span>Submit Ticket</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Review & Adjust Orientation Modal Popup */}
            <AnimatePresence>
                {pendingOrientationQueue && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.7 }}
                            exit={{ opacity: 0 }}
                            onClick={handleCancelOrientationQueue}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 12 }}
                            className="relative bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden z-10 p-4 sm:p-5"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
                                <div>
                                    <h3 className="text-sm font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">Review & Adjust Orientation</h3>
                                    <p className="text-[11px] text-outline">Rotate image(s) or video(s) upright before attaching ({pendingOrientationQueue.length} selected)</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCancelOrientationQueue}
                                    className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="py-4 overflow-y-auto max-h-[58vh] space-y-4 my-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {pendingOrientationQueue.map((item, idx) => (
                                        <div key={item.id} className="bg-surface dark:bg-dark-surface p-3 rounded-xl border border-outline-variant dark:border-dark-outline-variant flex flex-col gap-2 relative">
                                            <div className="w-full h-44 bg-black/80 rounded-lg overflow-hidden flex items-center justify-center relative p-1">
                                                {item.isImg ? (
                                                    <img
                                                        src={item.previewUrl}
                                                        alt={item.file.name}
                                                        style={{
                                                            transform: `rotate(${item.rotation}deg)`,
                                                            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                                        }}
                                                        className="max-w-full max-h-full object-contain"
                                                    />
                                                ) : item.isVid ? (
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

                                                {(item.isImg || item.isVid) && (
                                                    <div className="flex items-center gap-1 bg-surface-container-high px-2 py-1 rounded-lg border border-outline-variant/60">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setPendingOrientationQueue(prev => prev ? prev.map((it, i) => i === idx ? { ...it, rotation: (it.rotation - 90 + 360) % 360 } : it) : null);
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
                                                                setPendingOrientationQueue(prev => prev ? prev.map((it, i) => i === idx ? { ...it, rotation: (it.rotation + 90) % 360 } : it) : null);
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
                                    onClick={handleCancelOrientationQueue}
                                    className="px-4 py-2 rounded-xl border border-outline-variant text-xs font-medium text-on-surface hover:bg-surface-container-high cursor-pointer transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmOrientationQueue}
                                    className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-medium hover:bg-primary-container cursor-pointer transition-colors"
                                >
                                    Attach Media
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <LiveCameraModal
                isOpen={isCameraModalOpen}
                initialMode={cameraModalMode}
                onClose={() => setIsCameraModalOpen(false)}
                onCapture={(capturedFile) => {
                    handleFileSelect([capturedFile]);
                }}
            />
        </>
    );
};

export default CreateTicketModal;