import React from 'react';
import { Trophy, Store, CheckCircle2, Clock, AlertCircle, TrendingUp } from 'lucide-react';

interface TopInsightsRowProps {
    insights?: {
        top_performing_worker?: {
            worker_id: number;
            worker_name: string;
            employee_no?: string;
            planned_hours: number;
            logged_hours: number;
            efficiency_pct: number;
            completed_jobs: number;
            total_assigned_jobs: number;
            on_time_pct: number;
        } | null;
        most_ticket_raised_store?: {
            store_id: number;
            store_name: string;
            total_tickets: number;
            open: number;
            in_progress: number;
            location_approval: number;
            completed: number;
            total_cost: number;
        } | null;
    };
    totalSystemTickets?: number;
    loading?: boolean;
}

export const TopInsightsRow: React.FC<TopInsightsRowProps> = ({
    insights,
    totalSystemTickets = 1,
    loading = false
}) => {
    const topWorker = insights?.top_performing_worker;
    const topStore = insights?.most_ticket_raised_store;

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-28 bg-surface-container rounded border border-outline-variant animate-pulse" />
                <div className="h-28 bg-surface-container rounded border border-outline-variant animate-pulse" />
            </div>
        );
    }

    if (!topWorker && !topStore) return null;

    const storeVolumePct = topStore && totalSystemTickets > 0
        ? Math.round((topStore.total_tickets / totalSystemTickets) * 100)
        : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Performance Worker Card */}
            {topWorker ? (
                <div className="p-4 rounded border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-surface-container to-surface-container flex flex-col justify-between shadow-2xs relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10 text-amber-500 pointer-events-none">
                        <Trophy className="w-16 h-16" />
                    </div>

                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                                <Trophy className="w-4 h-4" />
                            </div>
                            <div>
                                <span className="text-[11px] font-medium text-on-surface-variant tracking-wider">
                                    Top Performing Worker
                                </span>
                                <h4 className="text-sm font-semibold text-on-surface">
                                    {topWorker.worker_name}
                                </h4>
                            </div>
                        </div>
                        {/* <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            ★ Top Performer
                        </span> */}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-outline-variant/60 text-center">
                        <div className="p-1.5 rounded bg-surface-container-low/60">
                            <div className="text-[10px] text-on-surface-variant">Efficiency</div>
                            <div className="text-xs font-semibold text-emerald-600 mt-0.5">
                                {topWorker.efficiency_pct}%
                            </div>
                        </div>
                        <div className="p-1.5 rounded bg-surface-container-low/60">
                            <div className="text-[10px] text-on-surface-variant">Completed</div>
                            <div className="text-xs font-semibold text-primary mt-0.5">
                                {topWorker.completed_jobs} Jobs
                            </div>
                        </div>
                        <div className="p-1.5 rounded bg-surface-container-low/60">
                            <div className="text-[10px] text-on-surface-variant">On-Time Rate</div>
                            <div className="text-xs font-semibold text-on-surface mt-0.5">
                                {topWorker.on_time_pct}%
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-4 rounded border border-outline-variant bg-surface-container text-xs text-on-surface-variant flex items-center justify-center">
                    No worker performance data available for this date window.
                </div>
            )}

            {/* Most Ticket Raised Store Card */}
            {topStore ? (
                <div className="p-4 rounded border border-primary/30 bg-gradient-to-br from-primary/5 via-surface-container to-surface-container flex flex-col justify-between shadow-2xs relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10 text-primary pointer-events-none">
                        <Store className="w-16 h-16" />
                    </div>

                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                                <Store className="w-4 h-4" />
                            </div>
                            <div>
                                <span className="text-[11px] font-medium text-on-surface-variant tracking-wider">
                                    Highest Ticket Volume Store
                                </span>
                                <h4 className="text-sm font-semibold text-on-surface">
                                    {topStore.store_name}
                                </h4>
                            </div>
                        </div>
                        {/* <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            Highest Demand
                        </span> */}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-outline-variant/60 text-center">
                        <div className="p-1.5 rounded bg-surface-container-low/60">
                            <div className="text-[10px] text-on-surface-variant">Total Tickets</div>
                            <div className="text-xs font-semibold text-primary mt-0.5">
                                {topStore.total_tickets}
                            </div>
                        </div>
                        <div className="p-1.5 rounded bg-surface-container-low/60">
                            <div className="text-[10px] text-on-surface-variant">Active Issues</div>
                            <div className="text-xs font-semibold text-amber-600 mt-0.5">
                                {topStore.open + topStore.in_progress} Open
                            </div>
                        </div>
                        <div className="p-1.5 rounded bg-surface-container-low/60">
                            <div className="text-[10px] text-on-surface-variant">Total Spend</div>
                            <div className="text-xs font-semibold text-on-surface mt-0.5">
                                ${topStore.total_cost.toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-4 rounded border border-outline-variant bg-surface-container text-xs text-on-surface-variant flex items-center justify-center">
                    No store ticket volume recorded for this date window.
                </div>
            )}
        </div>
    );
};
