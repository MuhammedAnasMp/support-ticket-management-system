import React from 'react';
import { StatCard } from './StatCard';
import { WorkerPerformanceTable } from './WorkerPerformanceTable';
import { TopInsightsRow } from './TopInsightsRow';
import {
    UserPlus, Clock, AlertTriangle, Receipt,
    CheckCircle2, Wrench, ShieldAlert, Layers
} from 'lucide-react';

interface OfficeAdminDashboardProps {
    data: any;
    loading: boolean;
}

export const OfficeAdminDashboard: React.FC<OfficeAdminDashboardProps> = ({ data, loading }) => {
    const summary = data?.summary || {};
    const financials = data?.financials || {};
    const workerPerformance = data?.worker_performance || [];
    const worklogSummary = data?.worklog_summary || {};
    const insights = data?.insights || {};

    return (
        <div className="space-y-6">
            {/* Top Highlights: Top Performing Worker & Most Ticket Raised Store */}
            <TopInsightsRow
                insights={insights}
                totalSystemTickets={summary.total_tickets || 1}
                loading={loading}
            />

            {/* Operational Priority Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                <StatCard
                    title="Unassigned Tickets Queue"
                    value={summary.unassigned_count || 0}
                    subtext={summary.unassigned_count > 0 ? "Requires Worker Allocation" : "All Assigned"}
                    icon={<UserPlus className="w-4 h-4" />}
                    badgeColor={summary.unassigned_count > 0 ? 'warning' : 'success'}
                    loading={loading}
                />
                <StatCard
                    title="Pending Expense Approvals"
                    value={`${(financials.unapproved_expense_amount || 0).toLocaleString()}`}
                    subtext={`${financials.unapproved_expense_count || 0} Unapproved Claims`}
                    icon={<Receipt className="w-4 h-4" />}
                    badgeColor={financials.unapproved_expense_count > 0 ? 'warning' : 'neutral'}
                    loading={loading}
                />
                <StatCard
                    title="Overdue SLA Escalations"
                    value={summary.overdue_count || 0}
                    subtext="Tickets Exceeding 48 Hours"
                    icon={<AlertTriangle className="w-4 h-4" />}
                    badgeColor={summary.overdue_count > 0 ? 'error' : 'success'}
                    loading={loading}
                />
                <StatCard
                    title="Total Logged Work Hours"
                    value={`${worklogSummary.total_logged_hours || 0} hrs`}
                    subtext={`Planned: ${worklogSummary.total_planned_hours || 0} hrs`}
                    icon={<Clock className="w-4 h-4" />}
                    badgeColor="primary"
                    loading={loading}
                />
            </div>

            {/* Operational Dispatch & Audit Banner */}
            <div className="bg-surface-container border border-outline-variant rounded p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-0.5">
                    <h3 className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                        <Wrench className="w-4 h-4 text-primary" />
                        Office Administration Dispatch Control
                    </h3>
                    <p className="text-[11px] text-on-surface-variant">
                        Manage technician job allocations, verify logged work hours, and clear expense claims.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href="/tickets/all"
                        className="px-3 py-1.5 rounded bg-primary text-on-primary hover:bg-primary-container text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        Dispatch Worker Queue
                    </a>
                </div>
            </div>

            {/* Worker Performance & Completion Audit Matrix */}
            <WorkerPerformanceTable workers={workerPerformance} loading={loading} />

            {/* Quick Status Control Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="border border-outline-variant rounded bg-surface-container p-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-on-surface mb-2">
                        <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-amber-500" /> In-Progress Jobs
                        </span>
                        <span className="text-amber-600 ">{summary.in_progress || 0} Active</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">
                        Technicians are currently on-site working on these open tickets.
                    </p>
                </div>

                <div className="border border-outline-variant rounded bg-surface-container p-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-on-surface mb-2">
                        <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-purple-500" /> Location Approval Queue
                        </span>
                        <span className="text-purple-600 ">{summary.location_approval || 0} Pending</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">
                        Jobs completed by technicians waiting for store manager sign-off.
                    </p>
                </div>

                <div className="border border-outline-variant rounded bg-surface-container p-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-on-surface mb-2">
                        <span className="flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-error" /> Blocked Issues
                        </span>
                        <span className="text-error ">{summary.blocked || 0} Hold</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">
                        Tickets blocked due to missing spare parts or external vendor delays.
                    </p>
                </div>
            </div>
        </div>
    );
};
