import React from 'react';
import { StatCard } from './StatCard';
import { Wrench, Clock, Receipt, CheckCircle2, Award, PlusCircle, AlertTriangle } from 'lucide-react';

interface TechnicianDashboardProps {
    data: any;
    loading: boolean;
}

export const TechnicianDashboard: React.FC<TechnicianDashboardProps> = ({ data, loading }) => {
    const summary = data?.summary || {};
    const financials = data?.financials || {};
    const worklogSummary = data?.worklog_summary || {};
    const myPerfList = data?.worker_performance || [];
    const myPerf = myPerfList.length > 0 ? myPerfList[0] : null;

    return (
        <div className="space-y-6">
            {/* Quick Action Mobile Header */}
            <div className="bg-surface-container border border-outline-variant rounded p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary-container/10 text-primary flex items-center justify-center font-bold text-xs">
                        <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-xs font-semibold text-on-surface">Technician Work Portal</h2>
                        <p className="text-[11px] text-on-surface-variant">Track your active assignments, log work hours & claims.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <a
                        href="/tickets/all"
                        className="px-3 py-1.5 rounded bg-primary text-on-primary hover:bg-primary-container text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                        <Wrench className="w-3.5 h-3.5" />
                        My Assigned Jobs
                    </a>
                </div>
            </div>

            {/* Personal KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="My Active Jobs"
                    value={summary.in_progress || 0}
                    subtext={`${summary.open || 0} Open Assigned`}
                    icon={<Wrench className="w-4 h-4" />}
                    badgeColor={summary.in_progress > 0 ? 'warning' : 'success'}
                    loading={loading}
                />
                <StatCard
                    title="Logged Work Hours"
                    value={`${worklogSummary.total_logged_hours || 0} hrs`}
                    subtext={`Planned: ${worklogSummary.total_planned_hours || 0} hrs`}
                    icon={<Clock className="w-4 h-4" />}
                    badgeColor="primary"
                    loading={loading}
                />
                <StatCard
                    title="Efficiency Rating"
                    value={`${myPerf?.efficiency_pct || 100}%`}
                    subtext={myPerf?.efficiency_pct >= 95 ? 'Ahead of Schedule' : 'On Track'}
                    icon={<Award className="w-4 h-4" />}
                    badgeColor={myPerf?.efficiency_pct >= 95 ? 'success' : 'primary'}
                    loading={loading}
                />
                <StatCard
                    title="Completed Tickets"
                    value={summary.completed || 0}
                    subtext={`${myPerf?.on_time_pct || 100}% On-Time`}
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    badgeColor="success"
                    loading={loading}
                />
            </div>

            {/* Performance Summary Banner */}
            {myPerf && (
                <div className="border border-outline-variant rounded bg-surface-container p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-emerald-500" /> My Performance Summary (This Period)
                        </span>
                        <span className="text-xs font-semibold text-emerald-600">
                            {myPerf.on_time_pct}% On-Time Delivery
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant">
                            <div className="text-[10px] text-on-surface-variant">Allocated Hours</div>
                            <div className="text-sm font-semibold text-on-surface mt-0.5">{myPerf.planned_hours} hrs</div>
                        </div>
                        <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant">
                            <div className="text-[10px] text-on-surface-variant">Actual Logged</div>
                            <div className="text-sm font-semibold text-on-surface mt-0.5">{myPerf.logged_hours} hrs</div>
                        </div>
                        <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant">
                            <div className="text-[10px] text-on-surface-variant">Jobs Resolved</div>
                            <div className="text-sm font-semibold text-emerald-600 mt-0.5">{myPerf.completed_jobs} Jobs</div>
                        </div>
                        <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant">
                            <div className="text-[10px] text-on-surface-variant">Efficiency Index</div>
                            <div className="text-sm font-semibold text-primary mt-0.5">{myPerf.efficiency_pct}%</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
