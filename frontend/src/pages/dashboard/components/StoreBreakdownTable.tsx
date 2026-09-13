import React, { useMemo } from 'react';
import { Store } from 'lucide-react';
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

export interface StoreBreakdownData {
    store_id: number;
    store_name: string;
    open: number;
    in_progress: number;
    location_approval?: number;
    completed: number;
    total_cost: number;
}

interface StoreBreakdownTableProps {
    stores: StoreBreakdownData[];
    title?: string;
    showLocationApproval?: boolean;
    loading?: boolean;
}

export const StoreBreakdownTable: React.FC<StoreBreakdownTableProps> = ({
    stores = [],
    title = 'Store Expenditure & Ticket Breakdown',
    showLocationApproval = false,
    loading = false,
}) => {
    const columnDefs = useMemo<ColDef<StoreBreakdownData>[]>(() => {
        const cols: ColDef<StoreBreakdownData>[] = [
            {
                headerName: 'Store Location',
                field: 'store_name',
                flex: 1.5,
                minWidth: 150,
                cellRenderer: (params: any) => (
                    <span className="font-medium text-on-surface text-xs">{params.value}</span>
                )
            },
            {
                headerName: 'Open',
                field: 'open',
                flex: 1,
                minWidth: 80,
                cellRenderer: (params: any) => (
                    <span className="font-semibold text-primary text-xs">{params.value || 0}</span>
                )
            },
            {
                headerName: 'In-Progress',
                field: 'in_progress',
                flex: 1,
                minWidth: 90,
                cellRenderer: (params: any) => (
                    <span className="font-medium text-amber-600 text-xs">{params.value || 0}</span>
                )
            },
        ];

        if (showLocationApproval) {
            cols.push({
                headerName: 'Location Approval',
                field: 'location_approval',
                flex: 1,
                minWidth: 110,
                cellRenderer: (params: any) => (
                    <span className="font-medium text-purple-600 text-xs">{params.value || 0}</span>
                )
            });
        }

        cols.push(
            {
                headerName: 'Completed',
                field: 'completed',
                flex: 1,
                minWidth: 90,
                cellRenderer: (params: any) => (
                    <span className="font-medium text-emerald-600 text-xs">{params.value || 0}</span>
                )
            },
            {
                headerName: 'Maintenance Cost',
                field: 'total_cost',
                flex: 1.2,
                minWidth: 120,
                cellRenderer: (params: any) => (
                    <span className="font-mono font-semibold text-on-surface text-xs">
                        ${Number(params.value || 0).toLocaleString()}
                    </span>
                )
            }
        );

        return cols;
    }, [showLocationApproval]);

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
                    <Store className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-semibold text-on-surface">{title}</h3>
                </div>
                <span className="text-[11px] text-on-surface-variant">{stores.length} Stores Listed</span>
            </div>

            <div className="ag-theme-app w-full min-h-[280px] h-[340px]">
                <AgGridReact<StoreBreakdownData>
                    theme={appTheme}
                    rowData={stores}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    animateRows={true}
                    rowHeight={48}
                    headerHeight={40}
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
