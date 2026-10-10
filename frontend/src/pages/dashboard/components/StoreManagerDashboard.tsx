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

            {data?.throttle_alerts
                ?.filter((a: any) => a.is_throttled)
                .map((alert: any) => (
                    <div
                        key={`${alert.store_id}-${alert.department_id}`}
                        className="red-glow p-2 rounded border border-red-500/40 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-xl"
                    >
                        <div className="flex items-start gap-3 relative z-10 anima">
                            <div className="p-2 rounded bg-red-600 text-white shrink-0">
                                <AlertTriangle className="w-5 h-5" />
                            </div>

                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-white">
                                    Ticket Creation Blocked in {alert.store_name} ({alert.department_name})
                                </h3>

                                <p className="text-xs text-white/90">
                                    {alert.count} tickets are pending location approval.
                                    Clear the pending tickets to create new tickets.
                                </p>
                            </div>
                        </div>

                        <a
                            href={`/tickets/all?store=${alert.store_id}&status=Location%20Approval`}
                            className="relative z-10 px-3 py-2 rounded bg-red-700 hover:bg-red-800 text-white text-xs font-bold shrink-0 transition-colors shadow-sm flex items-center gap-1.5"
                        >
                            <CheckCircle className="w-4 h-4" />
                            Review ({alert.count})
                        </a>
                    </div>
                ))}

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
