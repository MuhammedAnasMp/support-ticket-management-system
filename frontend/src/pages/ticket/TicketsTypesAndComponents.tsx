import React, { useState } from 'react';
import { Eye, FileText, Trash2, Headphones, X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
export const MEDIA_BASE = import.meta.env.VITE_MEDIA_URL || 'http://localhost:8000';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface UserStub {
    user_id: number;
    full_name: string;
    employee_no?: string | null;
    profile_image?: string | null;
    role?: { role_id: number; role_name: string } | null;
}

export interface Ticket {
    ticket_id: number;
    work_order_no: string;
    store: { store_id: string; store_name: string };
    department: { department_id: number; department_name: string };
    nature: { nature_id: number; nature_name: string };
    priority: { priority_id: number; priority_name: string; level: number };
    status: { status_id: number; status_name: string };
    title: string;
    description: string;
    created_by: UserStub;
    created_date: string;
    approved_by?: UserStub | null;
    approved_date?: string | null;
    rejected_by?: UserStub | null;
    rejected_date?: string | null;
    reject_reason?: string | null;
    closed_by?: UserStub | null;
    closed_date?: string | null;
    allocations?: Allocation[];
}

export interface Allocation {
    allocation_id: number;
    worker: UserStub;
    assigned_by: UserStub;
    assigned_date: string;
    planned_hours: string;
    remarks: string;
}

export interface WorkLog {
    worklog_id: number;
    worker: UserStub;
    work_date: string;
    hours: string;
    hourly_rate: string;
    labour_amount: string;
    work_done: string;
}

export interface Expense {
    expense_id: number;
    worker: UserStub;
    expense_type: { expense_type_id: number; expense_name: string; parent?: { expense_name: string } | null; required?: boolean };
    amount: string;
    expense_date: string;
    remarks: string;
    approved: boolean;
    receipt?: Media | null;
    receipts?: Media[] | null;
}

export interface MediaCategory {
    category_id: number;
    category_name: string;
    department?: { department_id: number; department_name: string } | null;
}

export interface Media {
    media_id: number;
    file_name: string;
    file_url: string;
    uploaded_by: UserStub;
    uploaded_date: string;
    category: MediaCategory | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const getMediaUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${MEDIA_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name);
export const isAudio = (name: string) => name.toLowerCase().includes('voice_note') || name.toLowerCase().includes('recording') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(name);
export const isVideo = (name: string) => !isAudio(name) && /\.(mp4|mov|avi|mkv|webm)$/i.test(name);

// ─── Reusable Components ──────────────────────────────────────────────────────

export const AvatarCircle: React.FC<{ user: UserStub; size?: 'sm' | 'md' | 'lg' }> = ({ user, size = 'md' }) => {
    const sizeClass = { sm: 'w-7 h-7 text-[10px]', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' }[size];
    const imgUrl = user.profile_image ? getMediaUrl(user.profile_image) : null;
    const initials = user.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
    return (
        <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold bg-primary/20 text-primary border-2 border-primary/30`}>
            {imgUrl
                ? <img src={imgUrl} alt={user.full_name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                : <span>{initials}</span>
            }
        </div>
    );
};

interface MediaGridProps {
    items: Media[];
    emptyLabel: string;
    onEdit?: (mediaId: number) => void;
    onDelete?: (mediaId: number) => void;
}

export const MediaGrid: React.FC<MediaGridProps> = ({ items, emptyLabel, onEdit, onDelete }) => {
    const [previewItem, setPreviewItem] = useState<{ url: string; name: string } | null>(null);

    if (items.length === 0) {
        return (
            <div className="py-6 text-center text-xs text-outline border-2 border-dashed border-outline-variant dark:border-dark-outline-variant rounded-xl">
                {emptyLabel}
            </div>
        );
    }
    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {items.map(m => {
                const url = getMediaUrl(m.file_url);
                return (
                    <div key={m.media_id} className="relative aspect-video bg-surface dark:bg-dark-surface rounded-lg overflow-hidden border border-outline-variant dark:border-dark-outline-variant group">
                        {/* Uploader Profile Image Overlay (Top Left) */}
                        {m.uploaded_by && (
                            <div className="absolute top-1 left-1 z-20 pointer-events-none" title={`Uploaded by ${m.uploaded_by.full_name}`}>
                                <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center font-bold text-[8px] bg-black/70 text-white border border-white/40 shadow-xs">
                                    {m.uploaded_by.profile_image ? (
                                        <img src={getMediaUrl(m.uploaded_by.profile_image)} alt={m.uploaded_by.full_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{m.uploaded_by.full_name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?'}</span>
                                    )}
                                </div>
                            </div>
                        )}

                        <div 
                            onClick={() => {
                                if (!isAudio(m.file_name)) {
                                    setPreviewItem({ url, name: m.file_name });
                                }
                            }}
                            className="block w-full h-full cursor-pointer relative"
                        >
                            {isImage(m.file_name) ? (
                                <img src={url} alt={m.file_name} className="w-full h-full object-cover" />
                            ) : isAudio(m.file_name) ? (
                                <div className="flex flex-col items-center justify-center w-full h-full p-1 bg-surface-container-low" onClick={e => e.stopPropagation()}>
                                    <Headphones className="w-5 h-5 text-primary mb-1 animate-pulse" />
                                    <audio src={url} controls className="w-full h-4 scale-[0.8] origin-center opacity-90" />
                                </div>
                            ) : isVideo(m.file_name) ? (
                                <video src={url} className="w-full h-full object-cover" muted />
                            ) : (
                                <div className="flex items-center justify-center w-full h-full">
                                    <FileText className="w-6 h-6 text-outline" />
                                </div>
                            )}
                            {!onEdit && !onDelete && !isAudio(m.file_name) && (
                                <div className="absolute inset-0 bg-black/10 hover:bg-black/30 transition-all flex items-center justify-center">
                                    <Eye className="w-6 h-6 text-white opacity-60 hover:opacity-100 transition-opacity" />
                                </div>
                            )}
                        </div>

                        {(onEdit || onDelete) && (
                            <div className="absolute top-1 right-1 flex gap-1 z-10">
                                {onDelete && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onDelete(m.media_id);
                                        }}
                                        className="p-1 bg-red-600/80 hover:bg-red-600 text-white rounded cursor-pointer transition-colors"
                                        title="Delete file"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5 text-[8px] text-white truncate pointer-events-none">{m.file_name}</div>
                    </div>
                );
            })}

            {/* Media Preview Modal Overlay */}
            <AnimatePresence>
                {previewItem && (
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
                                        <p className="text-xs font-bold text-on-surface uppercase tracking-wider mb-1">{previewItem.name}</p>
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

                            {/* Caption/Filename */}
                            <div className="absolute -bottom-10 inset-x-0 text-center text-xs font-medium text-white/80 select-none truncate px-4">
                                {previewItem.name}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const SectionTitle: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-primary/10 rounded-lg text-primary">{icon}</div>
        <h4 className="text-xs font-bold text-on-surface dark:text-dark-on-surface uppercase tracking-wider">{label}</h4>
    </div>
);

export const Divider = () => <div className="border-t border-outline-variant dark:border-dark-outline-variant" />;

export const statusColor = (s: string) => {
    switch (s) {
        case 'Open': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
        case 'Approved': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
        case 'In Progress': return 'bg-primary/10 text-primary';
        case 'Completed': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
        case 'Rejected': return 'bg-red-500/10 text-red-600 dark:text-red-400';
        default: return 'bg-outline/10 text-outline';
    }
};