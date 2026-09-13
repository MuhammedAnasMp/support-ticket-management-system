import React from 'react';
import { StatCard } from './StatCard';
import { WorkerPerformanceTable } from './WorkerPerformanceTable';
import { TopInsightsRow } from './TopInsightsRow';
import { BarChart3, Clock, DollarSign, Award, Layers, Store } from 'lucide-react';

interface ManagementDashboardProps {
    data: any;
    loading: boolean;
}

export const ManagementDashboard: React.FC<ManagementDashboardProps> = ({ data, loading }) => {
    const summary = data?.summary || {};
    const financials = data?.financials || {};
    const workerPerformance = data?.worker_performance || [];
    const storeBreakdown = data?.store_breakdown || [];
    const deptDistribution = data?.department_distribution || [];
    const insights = data?.insights || {};

    return (
        <div className="space-y-6">
            {/* Top Highlights: Top Performing Worker & Most Ticket Raised Store */}
            <TopInsightsRow
                insights={insights}
                totalSystemTickets={summary.total_tickets || 1}
                loading={loading}
            />

            {/* Executive KPI Header */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                <StatCard
                    title="Executive On-Time Rate"
                    value={`${summary.sla_compliance_pct ?? 100}%`}
                    subtext={(summary.overdue_count || 0) > 0 ? `${summary.overdue_count} Overdue (>48h)` : '0 Overdue (On-Time)'}
                    icon={<Clock className="w-4 h-4" />}
                    badgeColor={(summary.overdue_count || 0) > 0 ? 'error' : ((summary.sla_compliance_pct ?? 100) >= 90 ? 'success' : 'warning')}
                    loading={loading}
                />
                <StatCard
                    title="Total Maintenance Spend"
                    value={`${(financials.grand_total_cost || 0).toLocaleString()}`}
                    subtext={`Expenses: ${(financials.total_expenses || 0).toLocaleString()}`}
                    icon={<DollarSign className="w-4 h-4" />}
                    badgeColor="neutral"
                    loading={loading}
                />
                <StatCard
                    title="System Worker Efficiency Index"
                    value={`${summary.system_efficiency_pct || 100}%`}
                    subtext="Planned vs Logged Ratio"
                    icon={<Award className="w-4 h-4" />}
                    badgeColor="primary"
                    loading={loading}
                />
                <StatCard
                    title="Avg Mean Repair Time (MTTR)"
                    value={`${summary.avg_mttr_hours || 0} hrs`}
                    subtext="Overall Turnaround"
                    icon={<BarChart3 className="w-4 h-4" />}
                    badgeColor="neutral"
                    loading={loading}
                />
            </div>

            {/* Department Cost & Volume Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-outline-variant rounded bg-surface-container overflow-hidden shadow-2xs">
                    <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        <h3 className="text-xs font-semibold text-on-surface">Department Load & Expenditure</h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {deptDistribution.map((d: any) => (
                            <div key={d.department_id} className="space-y-1">
                                <div className="flex justify-between text-xs font-medium">
                                    <span className="text-on-surface">{d.department_name}</span>
                                    <span className="text-on-surface-variant font-mono">{d.ticket_count} tickets (${d.total_cost})</span>
                                </div>
                                <div className="w-full bg-surface-container-high h-2 rounded overflow-hidden">
                                    <div
                                        className="bg-primary h-full rounded transition-all duration-300"
                                        style={{
                                            width: `${Math.min(100, (d.ticket_count / Math.max(1, summary.total_tickets)) * 100)}%`
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="border border-outline-variant rounded bg-surface-container overflow-hidden shadow-2xs">
                    <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant flex items-center gap-2">
                        <Store className="w-4 h-4 text-primary" />
                        <h3 className="text-xs font-semibold text-on-surface">Top Store Expenditure Leaderboard</h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {storeBreakdown.slice(0, 5).map((s: any, idx: number) => (
                            <div key={s.store_id} className="flex items-center justify-between p-2 rounded bg-surface-container-low border border-outline-variant">
                                <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-primary-container/10 text-primary flex items-center justify-center text-[10px] font-bold">
                                        {idx + 1}
                                    </span>
                                    <span className="text-xs font-medium text-on-surface">{s.store_name}</span>
                                </div>
                                <div className="text-right font-mono text-xs">
                                    <div className="font-semibold text-on-surface">{s.total_cost.toLocaleString()}</div>
                                    <div className="text-[10px] text-on-surface-variant">{s.completed} Tickets Resolved</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Worker Performance Audit Table */}
            <WorkerPerformanceTable workers={workerPerformance} loading={loading} />
        </div>
    );
};
