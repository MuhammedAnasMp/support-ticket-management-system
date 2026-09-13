import React from 'react';
import { StatCard } from './StatCard';
import { TopInsightsRow } from './TopInsightsRow';
import { StoreBreakdownTable } from './StoreBreakdownTable';
import { Store, Clock, DollarSign, Award, MapPin } from 'lucide-react';

interface AreaManagerDashboardProps {
    data: any;
    loading: boolean;
}

export const AreaManagerDashboard: React.FC<AreaManagerDashboardProps> = ({ data, loading }) => {
    const summary = data?.summary || {};
    const financials = data?.financials || {};
    const storeBreakdown = data?.store_breakdown || [];
    const insights = data?.insights || {};

    return (
        <div className="space-y-6">
            {/* Top Highlights: Top Performing Worker & Most Ticket Raised Store */}
            <TopInsightsRow
                insights={insights}
                totalSystemTickets={summary.total_tickets || 1}
                loading={loading}
            />

            {/* Region Banner */}
            <div className="bg-surface-container border border-outline-variant rounded p-4 flex items-center justify-between gap-3 shadow-xs">

                <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    <div>
                        <h2 className="text-xs font-semibold text-on-surface">Area Manager Regional Dashboard</h2>
                        <p className="text-[11px] text-on-surface-variant">Regional store cluster performance benchmarks and issue metrics.</p>
                    </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-primary-container/10 text-primary border border-primary-container/20">
                    {storeBreakdown.length} Area Stores
                </span>
            </div>

            {/* Area Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Area Active Tickets"
                    value={summary.active_tickets || 0}
                    subtext={`${summary.open || 0} Open`}
                    icon={<Store className="w-4 h-4" />}
                    badgeColor="primary"
                    loading={loading}
                />
                <StatCard
                    title="Regional On-Time Rate"
                    value={`${summary.sla_compliance_pct ?? 100}%`}
                    subtext={(summary.overdue_count || 0) > 0 ? `${summary.overdue_count} Overdue (>48h)` : '0 Overdue (On-Time)'}
                    icon={<Clock className="w-4 h-4" />}
                    badgeColor={(summary.overdue_count || 0) > 0 ? 'error' : ((summary.sla_compliance_pct ?? 100) >= 90 ? 'success' : 'warning')}
                    loading={loading}
                />
                <StatCard
                    title="Area Worker Efficiency"
                    value={`${summary.system_efficiency_pct || 100}%`}
                    subtext="Allocated vs Logged"
                    icon={<Award className="w-4 h-4" />}
                    badgeColor="primary"
                    loading={loading}
                />
                <StatCard
                    title="Regional Maintenance Spend"
                    value={`$${(financials.grand_total_cost || 0).toLocaleString()}`}
                    subtext={`${summary.completed || 0} Resolved`}
                    icon={<DollarSign className="w-4 h-4" />}
                    badgeColor="neutral"
                    loading={loading}
                />
            </div>

            {/* Area Store SLA & Expenditure Benchmark Table */}
            <StoreBreakdownTable
                stores={storeBreakdown}
                title="Area Store Cluster Benchmark"
                showLocationApproval={true}
                loading={loading}
            />
        </div>
    );
};
