import React, { useMemo } from 'react';
import { UserCheck, Clock, CheckCircle2 } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

const appTheme = themeQuartz.withParams({
    fontFamily: 'Inter, sans-serif',
    fontSize: 13,
    rowHeight: 52,
    headerHeight: 44,
    cellHorizontalPaddingScale: 1.4,
    backgroundColor: '#ffffff',
    foregroundColor: '#191c1d',
    headerBackgroundColor: '#f3f4f5',
    headerTextColor: '#414754',
    rowHoverColor: '#e7e8e9',
    borderColor: '#E0E2E6',
    accentColor: '#1A73E8',
    spacing: 6,
    wrapperBorderRadius: 0,
});

export interface WorkerPerformance {
    worker_id: number;
    worker_name: string;
    employee_no?: string;
    planned_hours: number;
    logged_hours: number;
    efficiency_pct: number;
    completed_jobs: number;
    total_assigned_jobs: number;
    on_time_pct: number;
}

interface WorkerPerformanceTableProps {
    workers: WorkerPerformance[];
    loading?: boolean;
}

export const WorkerPerformanceTable: React.FC<WorkerPerformanceTableProps> = ({
    workers = [],
    loading = false
}) => {
    const columnDefs = useMemo<ColDef<WorkerPerformance>[]>(() => [
        {
            headerName: 'Technician',
            field: 'worker_name',
            flex: 1.5,
            minWidth: 160,
            cellRenderer: (params: any) => (
                <div className="flex flex-col justify-center py-1">
                    <span className="font-medium text-on-surface text-xs leading-tight">{params.data?.worker_name}</span>
                    {params.data?.employee_no && (
                        <span className="text-[10px] text-on-surface-variant font-mono leading-tight">
                            EMP: {params.data.employee_no}
                        </span>
                    )}
                </div>
            )
        },
        {
            headerName: 'Allocated (Planned)',
            field: 'planned_hours',
            flex: 1,
            minWidth: 130,
            cellRenderer: (params: any) => (
                <span className="font-mono text-on-surface text-xs">{params.value || 0} hrs</span>
            )
        },
        {
            headerName: 'Actual Logged',
            field: 'logged_hours',
            flex: 1,
            minWidth: 110,
            cellRenderer: (params: any) => (
                <span className="font-mono text-on-surface text-xs">{params.value || 0} hrs</span>
            )
        },
        {
            headerName: 'Efficiency Index',
            field: 'efficiency_pct',
            flex: 1.2,
            minWidth: 130,
            cellRenderer: (params: any) => {
                const pct = params.value || 0;
                let effBadge = 'bg-surface-container-high text-on-surface-variant';
                if (pct >= 95) {
                    effBadge = 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20';
                } else if (pct >= 80) {
                    effBadge = 'bg-primary-container/10 text-primary border border-primary-container/20';
                } else {
                    effBadge = 'bg-error-container text-on-error-container border border-error-container/30';
                }
                return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${effBadge}`}>
                        <Clock className="w-3 h-3" />
                        {pct}%
                    </span>
                );
            }
        },
        {
            headerName: 'Jobs Completed',
            field: 'completed_jobs',
            flex: 1,
            minWidth: 110,
            cellRenderer: (params: any) => (
                <div className="flex items-center gap-1.5 font-medium text-on-surface text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{params.value || 0} / {params.data?.total_assigned_jobs || 0}</span>
                </div>
            )
        },
        {
            headerName: 'On-Time Rate',
            field: 'on_time_pct',
            flex: 1.2,
            minWidth: 110,
            cellRenderer: (params: any) => {
                const val = params.value || 0;
                return (
                    <span className={`font-mono font-semibold text-xs ${val >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {val}%
                    </span>
                );
            }
        }
    ], []);

    const defaultColDef = useMemo<ColDef>(() => ({
        resizable: true,
        sortable: true,
        filter: true,
    }), []);

    if (loading) {
        return (
            <div className="border border-outline-variant rounded p-4 bg-surface-container space-y-3">
                <div className="h-4 bg-outline-variant rounded w-1/4 animate-pulse" />
                <div className="h-40 bg-surface-container-high rounded animate-pulse" />
            </div>
        );
    }

    return (
        <div className="border border-outline-variant rounded bg-surface-container overflow-hidden shadow-2xs">
            <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-semibold text-on-surface">
                        Worker Performance & Allocation Matrix
                    </h3>
                </div>
                <span className="text-[11px] text-on-surface-variant">
                    {workers.length} Active Technicians
                </span>
            </div>

            <div className="ag-theme-app w-full min-h-[280px] h-[340px]">
                <AgGridReact<WorkerPerformance>
                    theme={appTheme}
                    rowData={workers}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    animateRows={true}
                    rowHeight={52}
                    headerHeight={44}
                    pagination={true}
                    paginationPageSize={10}
                    suppressCellFocus={false}
                    suppressRowClickSelection={true}
                    enableCellTextSelection={true}
                    onGridReady={(params) => params.api.sizeColumnsToFit()}
                    onGridSizeChanged={(params) => params.api.sizeColumnsToFit()}
                />
            </div>
        </div>
    );
};
