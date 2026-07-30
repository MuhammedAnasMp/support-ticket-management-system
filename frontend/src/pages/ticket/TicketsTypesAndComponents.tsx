import React from 'react';
import { Eye, FileText, Trash2 } from 'lucide-react';

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
export const isVideo = (name: string) => /\.(mp4|mov|avi|mkv|webm)$/i.test(name);

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
                        <a href={url} target="_blank" rel="noopener noreferrer" className="block w-full h-full cursor-pointer">
                            {isImage(m.file_name) ? (
                                <img src={url} alt={m.file_name} className="w-full h-full object-cover" />
                            ) : isVideo(m.file_name) ? (
                                <video src={url} className="w-full h-full object-cover" muted />
                            ) : (
                                <div className="flex items-center justify-center w-full h-full">
                                    <FileText className="w-6 h-6 text-outline" />
                                </div>
                            )}
                            {!onEdit && !onDelete && (
                                <div className="absolute inset-0 bg-black/10 hover:bg-black/30 transition-all flex items-center justify-center">
                                    <Eye className="w-4 h-4 text-white opacity-60 hover:opacity-100 transition-opacity" />
                                </div>
                            )}
                        </a>

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