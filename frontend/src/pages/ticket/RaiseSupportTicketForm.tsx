import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Loader2, X, Upload, Trash2, Image as ImageIcon, AlertCircle, Headphones, Camera, Video } from 'lucide-react';
import { API_URL } from './TicketsTypesAndComponents';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { LiveCameraModal } from '@/components/LiveCameraModal';
import { SearchableSelect } from '@/components/SearchableSelect';

const inputCls = "w-full bg-surface-container border border-outline-variant text-on-surface text-xs rounded px-3 py-2 focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors placeholder:text-on-surface-variant/60";

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
    const [createTicketFiles, setCreateTicketFiles] = useState<File[]>([]);
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
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    // Re-sync/reset form when modal opens, availableDepartments changes, or stores changes
    React.useEffect(() => {
        if (isOpen) {
            setCreateForm({
                store_id: stores.length === 1 ? String(stores[0].store_id) : '',
                department_id: availableDepartments.length === 1 ? String(availableDepartments[0].department_id) : '',
                nature_id: '',
                title: '',
                description: ''
            });
            setCreateTicketFiles([]);
            setErrorMessage(null);
        }
    }, [isOpen, availableDepartments, stores]);

    const [localNatures, setLocalNatures] = useState<any[]>([]);
    const [loadingNatures, setLoadingNatures] = useState(false);

    // Fetch natures dynamically from API when department changes
    React.useEffect(() => {
        if (!createForm.department_id || !token) {
            setLocalNatures([]);
            return;
        }
        setLoadingNatures(true);
        fetch(`${API_URL}/maintenance/worknature/?department=${createForm.department_id}`, {
            headers: { Authorization: `Token ${token}` }
        })
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Failed to load natures');
            })
            .then(data => {
                setLocalNatures(data);
            })
            .catch(err => {
                console.error(err);
                setLocalNatures([]);
            })
            .finally(() => {
                setLoadingNatures(false);
            });
    }, [createForm.department_id, token]);

    const filteredNatures = localNatures;

    const selectedNature = useMemo(() => {
        return filteredNatures.find(n => Number(n.nature_id) === Number(createForm.nature_id)) ||
            natures.find(n => Number(n.nature_id) === Number(createForm.nature_id));
    }, [filteredNatures, natures, createForm.nature_id]);

    const isMediaRequired = selectedNature ? (selectedNature.media_required !== false) : false;

    const filePreviews = useMemo(() => {
        return createTicketFiles.map(file => {
            const isImg = file.type.startsWith('image/');
            const isVid = file.type.startsWith('video/') && !file.name.endsWith('.webm');
            const isAudio = file.type.startsWith('audio/') || file.name.endsWith('.webm') || file.name.endsWith('.ogg') || file.name.endsWith('.wav');
            const url = (isImg || isVid || isAudio) ? URL.createObjectURL(file) : null;
            return { file, isImg, isVid, isAudio, url };
        });
    }, [createTicketFiles]);

    const handleFileSelect = (files: FileList | File[]) => {
        const newFiles = Array.from(files);
        setCreateTicketFiles(prev => [...prev, ...newFiles]);
        setErrorMessage(null);
    };

    const handleRemoveFile = (index: number) => {
        setCreateTicketFiles(prev => prev.filter((_, i) => i !== index));
    };

    const resetForm = () => {
        setCreateForm({
            store_id: stores.length === 1 ? String(stores[0].store_id) : '',
            department_id: availableDepartments.length === 1 ? String(availableDepartments[0].department_id) : '',
            nature_id: '',
            title: '',
            description: ''
        });
        setCreateTicketFiles([]);
        setErrorMessage(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isMediaRequired && createTicketFiles.length < 1) {
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
            if (createTicketFiles.length > 0 && createdTicket?.ticket_id) {
                // Fetch categories to identify "Before Repair" category id
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

                        if (catObj) {
                            categoryId = String(catObj.category_id);
                        }
                    }
                } catch (catErr) {
                    console.error('Failed to load media categories:', catErr);
                }

                for (const file of createTicketFiles) {
                    const formData = new FormData();
                    formData.append('ticket', String(createdTicket.ticket_id));
                    formData.append('file_url', file);
                    formData.append('file_name', file.name);
                    if (categoryId) {
                        formData.append('category', categoryId);
                    }
                    if (user?.user_id) {
                        formData.append('uploaded_by', String(user.user_id));
                    }
                    try {
                        await fetch(`${API_URL}/common/media/`, {
                            method: 'POST',
                            headers: { Authorization: `Token ${token}` },
                            body: formData
                        });
                    } catch (mediaErr) {
                        console.error('Failed to upload file:', file.name, mediaErr);
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
                                            {createTicketFiles.length} file(s) attached
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
                                                setCreateTicketFiles(prev => [...prev, voiceFile]);
                                            }}
                                            onRecordingStateChange={setIsRecordingPending}
                                            placeholderText="Record a voice note explanation"
                                        />
                                    </div>

                                    {/* Attached Files List */}
                                    {filePreviews.length > 0 && (
                                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {filePreviews.map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    className="relative group border border-outline-variant rounded p-1.5 bg-surface-container-low flex flex-col items-center justify-center text-center overflow-hidden min-h-[100px]"
                                                >
                                                    {item.url && item.isImg ? (
                                                        <img src={item.url} alt="preview" className="w-full h-16 object-cover rounded mb-1" />
                                                    ) : item.url && item.isAudio ? (
                                                        <div className="w-full bg-surface-container flex flex-col items-center justify-center rounded mb-1 p-2 min-h-[64px]">
                                                            <div className="flex items-center gap-1 mb-1 text-primary">
                                                                <Headphones className="w-4 h-4 animate-pulse shrink-0" />
                                                                <span className="text-[10px] font-bold">Voice Note</span>
                                                            </div>
                                                            <audio src={item.url} controls className="w-full h-8 rounded" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-16 bg-surface-container flex items-center justify-center rounded mb-1">
                                                            {item.url && item.isVid ? (
                                                                <video src={item.url} className="w-full h-full object-cover rounded" />
                                                            ) : (
                                                                <ImageIcon className="w-6 h-6 text-on-surface-variant" />
                                                            )}
                                                        </div>
                                                    )}
                                                    <span className="text-[10px] text-on-surface truncate w-full px-1" title={item.file.name}>
                                                        {item.file.name}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={e => { e.stopPropagation(); handleRemoveFile(idx); }}
                                                        className="absolute top-1 right-1 p-1 bg-error text-on-error rounded-full opacity-80 hover:opacity-100 transition-opacity"
                                                        title="Remove file"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
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

            <LiveCameraModal
                isOpen={isCameraModalOpen}
                initialMode={cameraModalMode}
                onClose={() => setIsCameraModalOpen(false)}
                onCapture={(capturedFile) => {
                    setCreateTicketFiles(prev => [...prev, capturedFile]);
                }}
            />
        </>
    );
};

export default CreateTicketModal;