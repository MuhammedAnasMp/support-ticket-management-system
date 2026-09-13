import React from 'react';
import { StatCard } from './StatCard';
import { StoreBreakdownTable } from './StoreBreakdownTable';
import { Store, Plus, CheckCircle, Clock, AlertTriangle, Layers } from 'lucide-react';

interface StoreManagerDashboardProps {
    data: any;
    loading: boolean;
}

export const StoreManagerDashboard: React.FC<StoreManagerDashboardProps> = ({ data, loading }) => {
    const summary = data?.summary || {};
    const storeBreakdown = data?.store_breakdown || [];
    const deptDistribution = data?.department_distribution || [];

    return (
        <div className="space-y-6">
            {/* Header / Banner for Store Managers */}
            <div className="p-4 rounded-lg bg-surface-container border border-outline-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Store className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-on-surface">Store Manager Dashboard</h2>
                        <p className="text-xs text-on-surface-variant">Store Operations & Maintenance Requests Overview</p>
                    </div>
                </div>
                <a
                    href="/tickets/all?action=new"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    Raise New Ticket
                </a>
            </div>

            {/* Core Store Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Active Store Tickets"
                    value={summary.active_tickets || 0}
                    subtext={`${summary.open || 0} Open`}
                    icon={<Store className="w-4 h-4" />}
                    badgeColor="primary"
                    loading={loading}
                />
                <StatCard
                    title="Location Approval Queue"
                    value={summary.location_approval || 0}
                    subtext="Requires Manager Sign-off"
                    icon={<CheckCircle className="w-4 h-4" />}
                    badgeColor={summary.location_approval > 0 ? 'warning' : 'neutral'}
                    loading={loading}
                />
                <StatCard
                    title="Overdue Escalations"
                    value={summary.overdue_count || 0}
                    subtext="Tickets Exceeding 48h"
                    icon={<Clock className="w-4 h-4" />}
                    badgeColor={summary.overdue_count > 0 ? 'error' : 'success'}
                    loading={loading}
                />
                <StatCard
                    title="Store Completed Tickets"
                    value={summary.completed || 0}
                    subtext="Fully Resolved"
                    icon={<CheckCircle className="w-4 h-4" />}
                    badgeColor="success"
                    loading={loading}
                />
            </div>

            {/* Store List Breakdown */}
            <StoreBreakdownTable
                stores={storeBreakdown}
                title="Assigned Store Locations Status"
                showLocationApproval={true}
                loading={loading}
            />
        </div>
    );
};
