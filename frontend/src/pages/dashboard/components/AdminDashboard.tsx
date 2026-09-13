import React from 'react';
import { StatCard } from './StatCard';
import { WorkerPerformanceTable } from './WorkerPerformanceTable';
import { StoreBreakdownTable } from './StoreBreakdownTable';
import { TopInsightsRow } from './TopInsightsRow';
import {
    Ticket, CheckCircle2, Clock, AlertTriangle,
    DollarSign, Store, Activity, Layers
} from 'lucide-react';

interface AdminDashboardProps {
    data: any;
    loading: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ data, loading }) => {
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

            {/* System Key Performance Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                <StatCard
                    title="Total System Tickets"
                    value={summary.total_tickets || 0}
                    subtext={`${summary.active_tickets || 0} Active`}
                    icon={<Ticket className="w-4 h-4" />}
                    badgeColor="primary"
                    loading={loading}
                />
                <StatCard
                    title="On-Time Resolution Rate"
                    value={`${summary.sla_compliance_pct ?? 100}%`}
                    subtext={(summary.overdue_count || 0) > 0 ? `${summary.overdue_count} Overdue (>48h)` : '0 Overdue (On-Time)'}
                    icon={<Clock className="w-4 h-4" />}
                    badgeColor={(summary.overdue_count || 0) > 0 ? 'error' : ((summary.sla_compliance_pct ?? 100) >= 90 ? 'success' : 'warning')}
                    loading={loading}
                />
                <StatCard
                    title="Worker Efficiency Index"
                    value={`${summary.system_efficiency_pct ?? 100}%`}
                    subtext="Allocated vs Logged"
                    icon={<Activity className="w-4 h-4" />}
                    badgeColor={(summary.system_efficiency_pct ?? 100) >= 90 ? 'success' : 'primary'}
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
            </div>

            {/* Ticket Status Breakdown Quick-Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div className="p-3 rounded border border-outline-variant bg-surface-container text-center">
                    <div className="text-[11px] text-on-surface-variant font-medium">Open</div>
                    <div className="text-xl font-semibold text-primary mt-1">{summary.open || 0}</div>
                </div>
                <div className="p-3 rounded border border-outline-variant bg-surface-container text-center">
                    <div className="text-[11px] text-on-surface-variant font-medium">In-Progress</div>
                    <div className="text-xl font-semibold text-amber-600 mt-1">{summary.in_progress || 0}</div>
                </div>
                <div className="p-3 rounded border border-outline-variant bg-surface-container text-center">
                    <div className="text-[11px] text-on-surface-variant font-medium">Location Approval</div>
                    <div className="text-xl font-semibold text-purple-600 mt-1">{summary.location_approval || 0}</div>
                </div>
                <div className="p-3 rounded border border-outline-variant bg-surface-container text-center">
                    <div className="text-[11px] text-on-surface-variant font-medium">Completed</div>
                    <div className="text-xl font-semibold text-emerald-600 mt-1">{summary.completed || 0}</div>
                </div>
                <div className="p-3 rounded border border-outline-variant bg-surface-container text-center">
                    <div className="text-[11px] text-on-surface-variant font-medium">Blocked</div>
                    <div className="text-xl font-semibold text-error mt-1">{summary.blocked || 0}</div>
                </div>
                <div className="p-3 rounded border border-outline-variant bg-surface-container text-center">
                    <div className="text-[11px] text-on-surface-variant font-medium">Reconciled</div>
                    <div className="text-xl font-semibold text-cyan-600 mt-1">{summary.reconciled || 0}</div>
                </div>
            </div>

            {/* Worker Performance & Allocation Matrix */}
            <WorkerPerformanceTable workers={workerPerformance} loading={loading} />

            {/* Grid Layout for Store Breakdown & Department Load */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Store Performance Breakdown Table */}
                <div className="lg:col-span-2">
                    <StoreBreakdownTable stores={storeBreakdown} loading={loading} />
                </div>

                {/* Departmental Distribution */}
                <div className="border border-outline-variant rounded bg-surface-container overflow-hidden shadow-2xs">
                    <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        <h3 className="text-xs font-semibold text-on-surface">Department Load Distribution</h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {deptDistribution.map((d: any) => (
                            <div key={d.department_id} className="space-y-1">
                                <div className="flex justify-between text-xs font-medium">
                                    <span className="text-on-surface">{d.department_name}</span>
                                    <span className="text-on-surface-variant">{d.ticket_count} tickets ({d.total_cost})</span>
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
            </div>
        </div>
    );
};
