import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowLeft, Clock, History as HistoryIcon, User, Building, AlertCircle, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import type { RootState } from '@/store';
import { API_URL, statusColor, AvatarCircle, type Ticket } from './TicketsTypesAndComponents';

interface HistoryRecord {
    history_id: number;
    changed_by: any;
    changed_date: string;
    remarks: string;
    status: { status_id: number; status_name: string };
    priority: { priority_id: number; priority_name: string; level: number };
    age_days: number | string;
    store: any;
    department: any;
    nature: any;
    created_by: any;
    created_date: string;
    approved_by?: any;
    approved_date?: string | null;
    rejected_by?: any;
    rejected_date?: string | null;
    reject_reason?: string | null;
    closed_by?: any;
    closed_date?: string | null;
    location_approval?: string | null;
    location_approved_by?: any;
    location_approved_date?: string | null;
    location_reject_reason?: string | null;
}

export const TicketHistoryView: React.FC = () => {
    const { ticketId } = useParams<{ ticketId: string }>();
    const navigate = useNavigate();
    const token = useSelector((state: RootState) => state.auth.token);

    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token || !ticketId) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const headers = { Authorization: `Token ${token}` };

                // 1. Fetch ticket details
                const resTicket = await fetch(`${API_URL}/maintenance/ticket/${ticketId}/`, { headers });
                if (!resTicket.ok) throw new Error('Failed to retrieve ticket details.');
                const ticketData = await resTicket.json();
                setTicket(ticketData);

                // 2. Fetch ticket history logs
                const resHistory = await fetch(`${API_URL}/maintenance/tickethistory/?ticket=${ticketId}`, { headers });
                if (!resHistory.ok) throw new Error('Failed to retrieve ticket history logs.');
                let historyData = await resHistory.json();
                
                // Sort history logs chronologically (newest first)
                if (Array.isArray(historyData)) {
                    historyData.sort((a, b) => new Date(b.changed_date).getTime() - new Date(a.changed_date).getTime());
                } else if (historyData && Array.isArray(historyData.results)) {
                    historyData = historyData.results;
                    historyData.sort((a, b) => new Date(b.changed_date).getTime() - new Date(a.changed_date).getTime());
                } else {
                    historyData = [];
                }

                setHistory(historyData);
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'An error occurred while loading ticket history.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token, ticketId]);

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/tickets/all');
        }
    };

    if (loading) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-outline">Loading ticket history logs...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
                <AlertCircle className="w-12 h-12 text-error mb-4 shrink-0" />
                <h3 className="text-lg font-bold text-on-surface mb-2">Error Loading History</h3>
                <p className="text-sm text-outline mb-6">{error}</p>
                <button
                    onClick={handleBack}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded bg-primary text-white hover:bg-primary/90 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
            {/* Header Navigation */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleBack}
                    className="p-2 rounded-lg text-outline hover:bg-surface-container-high transition-colors"
                    aria-label="Go Back"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-on-surface flex items-center gap-2">
                        <HistoryIcon className="w-6 h-6 text-primary" />
                        Ticket Change History Log
                    </h1>
                    <p className="text-xs sm:text-sm text-outline mt-0.5">
                        Track progress, status transitions, and timeline details for ticket {ticket?.work_order_no}
                    </p>
                </div>
            </div>

            {/* Ticket Summary Card */}
            {ticket && (
                <div className="p-4 bg-surface dark:bg-dark-surface rounded-xl border border-outline-variant dark:border-dark-outline-variant shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-primary">{ticket.work_order_no}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(ticket.status?.status_name)}`}>
                                {ticket.status?.status_name}
                            </span>
                        </div>
                        <h2 className="text-base font-bold text-on-surface truncate">{ticket.title}</h2>
                        <p className="text-xs text-outline line-clamp-1">{ticket.description}</p>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-outline shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-outline-variant/60">
                        <div className="flex items-center gap-1.5"><Building className="w-4 h-4" /><span>{ticket.store?.store_name}</span></div>
                        <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /><span>{new Date(ticket.created_date).toLocaleDateString()}</span></div>
                        {ticket.priority && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ticket.priority.level >= 2 ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                                {ticket.priority.priority_name}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Timeline Section */}
            {history.length === 0 ? (
                <div className="p-8 bg-surface dark:bg-dark-surface rounded-xl border border-outline-variant dark:border-dark-outline-variant text-center space-y-3">
                    <Clock className="w-12 h-12 text-outline/40 mx-auto" />
                    <h3 className="font-bold text-on-surface">No History Logs Found</h3>
                    <p className="text-xs text-outline max-w-sm mx-auto">This ticket has not undergone any status changes since creation.</p>
                </div>
            ) : (
                <div className="relative border-l-2 border-outline-variant/60 ml-4 pl-6 space-y-6">
                    {history.map((record, idx) => {
                        const isHighPriority = record.priority?.level >= 2;
                        return (
                            <motion.div
                                key={record.history_id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="relative group"
                            >
                                {/* Bullet indicator on the line */}
                                <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-surface bg-outline-variant group-hover:bg-primary transition-colors flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                </div>

                                {/* Content Card */}
                                <div className="p-4 bg-surface dark:bg-dark-surface rounded-xl border border-outline-variant dark:border-dark-outline-variant hover:border-outline transition-colors shadow-2xs">
                                    {/* Action Metadata Row */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 mb-2.5 border-b border-outline-variant/60">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {record.changed_by ? (
                                                <>
                                                    <AvatarCircle user={record.changed_by} size="sm" />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-on-surface truncate">
                                                            {record.changed_by.full_name}
                                                        </p>
                                                        {record.changed_by.role && (
                                                            <p className="text-[10px] text-primary font-semibold">
                                                                {record.changed_by.role.role_name}
                                                            </p>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-outline-variant/40 flex items-center justify-center text-outline">
                                                        <User className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-xs font-bold text-on-surface">System Agent</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right shrink-0">
                                            <p className="text-xs text-outline">{new Date(record.changed_date).toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {/* State details & snapshot */}
                                    <div className="flex flex-wrap gap-2.5 items-center mb-3">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(record.status?.status_name)}`}>
                                            {record.status?.status_name}
                                        </span>
                                        {record.priority && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isHighPriority ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                                                {record.priority.priority_name} Priority
                                            </span>
                                        )}
                                        {record.age_days !== undefined && record.age_days !== null && Number(record.age_days) > 0 && (
                                            <span className="text-[10px] bg-surface-container-high dark:bg-dark-surface-container-high px-2 py-0.5 rounded text-outline font-semibold">
                                                Duration: {Number(record.age_days).toFixed(1)} days
                                            </span>
                                        )}
                                    </div>

                                    {/* Remarks & details log */}
                                    {record.remarks && (
                                        <div className="p-2.5 bg-surface-container dark:bg-dark-surface-container rounded-lg border border-outline-variant/40">
                                            <p className="text-xs text-on-surface leading-relaxed">
                                                {record.remarks}
                                            </p>
                                        </div>
                                    )}

                                    {/* Snapshot Details Section */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-outline-variant/40 text-xs text-outline">
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <span className="font-semibold text-on-surface dark:text-dark-on-surface shrink-0">Created By:</span>
                                            <span>{record.created_by?.full_name || 'N/A'}</span>
                                            <span className="text-[10px] text-outline font-normal">({new Date(record.created_date).toLocaleDateString()})</span>
                                        </div>
                                        {record.approved_by && (
                                            <div className="flex items-center gap-1 flex-wrap">
                                                <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">Approved By:</span>
                                                <span>{record.approved_by.full_name}</span>
                                                {record.approved_date && <span className="text-[10px] text-outline font-normal">({new Date(record.approved_date).toLocaleDateString()})</span>}
                                            </div>
                                        )}
                                        {record.rejected_by && (
                                            <div className="sm:col-span-2">
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    <span className="font-semibold text-error shrink-0">Rejected By:</span>
                                                    <span>{record.rejected_by.full_name}</span>
                                                    {record.rejected_date && <span className="text-[10px] text-outline font-normal">({new Date(record.rejected_date).toLocaleDateString()})</span>}
                                                </div>
                                                {record.reject_reason && (
                                                    <p className="text-[11px] text-outline italic mt-0.5 ml-4">
                                                        Reason: "{record.reject_reason}"
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        {record.closed_by && (
                                            <div className="flex items-center gap-1 flex-wrap">
                                                <span className="font-semibold text-outline shrink-0">Closed By:</span>
                                                <span>{record.closed_by.full_name}</span>
                                                {record.closed_date && <span className="text-[10px] text-outline font-normal">({new Date(record.closed_date).toLocaleDateString()})</span>}
                                            </div>
                                        )}
                                        {record.location_approval && record.location_approval !== 'Pending' && (
                                            <div className="sm:col-span-2 space-y-0.5">
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    <span className="font-semibold text-primary shrink-0">Location Approval:</span>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${record.location_approval === 'Approved' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                                                        {record.location_approval}
                                                    </span>
                                                    {record.location_approved_by && (
                                                        <>
                                                            <span>by {record.location_approved_by.full_name}</span>
                                                            {record.location_approved_date && <span className="text-[10px] text-outline font-normal">({new Date(record.location_approved_date).toLocaleDateString()})</span>}
                                                        </>
                                                    )}
                                                </div>
                                                {record.location_reject_reason && (
                                                    <p className="text-[11px] text-outline italic ml-4">
                                                        Reject Reason: "{record.location_reject_reason}"
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
export default TicketHistoryView;
