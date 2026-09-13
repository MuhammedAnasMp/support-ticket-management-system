import React from 'react';
import { RefreshCw } from 'lucide-react';
import { DateRangePickerCard } from '../../ticket/DateRangePickerCard';
import { SearchableSelect, type SelectOption } from '../../../components/SearchableSelect';

interface DateFilterToolbarProps {
    fromDate: string;
    toDate: string;
    onDateChange: (from: string, to: string) => void;
    stores?: any[];
    selectedStore?: string;
    onStoreChange?: (storeId: string) => void;
    departments?: any[];
    selectedDept?: string;
    onDeptChange?: (deptId: string) => void;
    loading?: boolean;
    onRefresh?: () => void;
}

export const DateFilterToolbar: React.FC<DateFilterToolbarProps> = ({
    fromDate,
    toDate,
    onDateChange,
    stores = [],
    selectedStore = '',
    onStoreChange,
    departments = [],
    selectedDept = '',
    onDeptChange,
    loading = false,
    onRefresh
}) => {
    const getPresetDates = (preset: 'today' | 'week' | 'month' | 'last30') => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        let from = '';
        let to = `${year}-${month}-${day}`;

        if (preset === 'today') {
            from = to;
        } else if (preset === 'week') {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            const sYear = startOfWeek.getFullYear();
            const sMonth = String(startOfWeek.getMonth() + 1).padStart(2, '0');
            const sDay = String(startOfWeek.getDate()).padStart(2, '0');
            from = `${sYear}-${sMonth}-${sDay}`;
        } else if (preset === 'month') {
            from = `${year}-${month}-01`;
            const lastDayObj = new Date(year, now.getMonth() + 1, 0);
            to = `${year}-${month}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
        } else if (preset === 'last30') {
            const past30 = new Date(now);
            past30.setDate(now.getDate() - 30);
            const pYear = past30.getFullYear();
            const pMonth = String(past30.getMonth() + 1).padStart(2, '0');
            const pDay = String(past30.getDate()).padStart(2, '0');
            from = `${pYear}-${pMonth}-${pDay}`;
        }
        return { from, to };
    };

    const activePreset = React.useMemo(() => {
        const presets: ('today' | 'week' | 'month' | 'last30')[] = ['today', 'week', 'month', 'last30'];
        for (const p of presets) {
            const { from, to } = getPresetDates(p);
            if (fromDate === from && toDate === to) {
                return p;
            }
        }
        return null;
    }, [fromDate, toDate]);

    // Quick date preset handlers
    const setPreset = (preset: 'today' | 'week' | 'month' | 'last30') => {
        const { from, to } = getPresetDates(preset);
        onDateChange(from, to);
    };

    const handleReset = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const firstDay = `${year}-${month}-01`;
        const lastDayObj = new Date(year, now.getMonth() + 1, 0);
        const lastDay = `${year}-${month}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
        onDateChange(firstDay, lastDay);
    };

    const storeOptions: SelectOption[] = React.useMemo(() => {
        return [
            { value: '', label: 'All Stores' },
            ...stores.map((s) => ({
                value: String(s.store_id),
                label: s.store_name || `Store #${s.store_id}`
            }))
        ];
    }, [stores]);

    const deptOptions: SelectOption[] = React.useMemo(() => {
        return [
            { value: '', label: 'All Departments' },
            ...departments.map((d) => ({
                value: String(d.department_id),
                label: d.department_name || `Dept #${d.department_id}`
            }))
        ];
    }, [departments]);

    return (
        <div className="bg-surface-container-low border border-outline-variant rounded-lg p-3 sm:px-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 shadow-xs">
            {/* Left Group: Date Picker Card & Presets */}
            <div className="flex flex-wrap items-center gap-2">


                {/* Preset Chips */}
                <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-full">
                    <button
                        type="button"
                        onClick={() => setPreset('today')}
                        className={`px-2.5 py-1 rounded border text-[11px] font-medium transition-colors shrink-0 ${
                            activePreset === 'today'
                                ? 'bg-primary/10 border-primary/40 text-primary font-semibold'
                                : 'border-outline-variant hover:bg-surface-container-high text-on-surface-variant'
                        }`}
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => setPreset('week')}
                        className={`px-2.5 py-1 rounded border text-[11px] font-medium transition-colors shrink-0 ${
                            activePreset === 'week'
                                ? 'bg-primary/10 border-primary/40 text-primary font-semibold'
                                : 'border-outline-variant hover:bg-surface-container-high text-on-surface-variant'
                        }`}
                    >
                        This Week
                    </button>
                    <button
                        type="button"
                        onClick={() => setPreset('month')}
                        className={`px-2.5 py-1 rounded border text-[11px] font-medium transition-colors shrink-0 ${
                            activePreset === 'month'
                                ? 'bg-primary/10 border-primary/40 text-primary font-semibold'
                                : 'border-outline-variant hover:bg-surface-container-high text-on-surface-variant'
                        }`}
                    >
                        This Month
                    </button>
                    <button
                        type="button"
                        onClick={() => setPreset('last30')}
                        className={`px-2.5 py-1 rounded border text-[11px] font-medium transition-colors shrink-0 ${
                            activePreset === 'last30'
                                ? 'bg-primary/10 border-primary/40 text-primary font-semibold'
                                : 'border-outline-variant hover:bg-surface-container-high text-on-surface-variant'
                        }`}
                    >
                        Last 30 Days
                    </button>
                </div>

                <DateRangePickerCard
                    fromDate={fromDate}
                    toDate={toDate}
                    onDateRangeChange={(from, to) => onDateChange(from, to)}
                    onReset={handleReset}
                />
            </div>

            {/* Right Group: Searchable Store/Dept Selectors & Refresh */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                {stores.length > 0 && onStoreChange && (
                    <div className="min-w-[160px] max-w-[220px] flex-1 sm:flex-initial">
                        <SearchableSelect
                            value={selectedStore}
                            onChange={onStoreChange}
                            options={storeOptions}
                            placeholder="All Stores"
                        />
                    </div>
                )}

                {departments.length > 0 && onDeptChange && (
                    <div className="min-w-[160px] max-w-[220px] flex-1 sm:flex-initial">
                        <SearchableSelect
                            value={selectedDept}
                            onChange={onDeptChange}
                            options={deptOptions}
                            placeholder="All Departments"
                        />
                    </div>
                )}

                {onRefresh && (
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={loading}
                        className="p-2 rounded border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface hover:text-primary disabled:opacity-50 transition-colors shrink-0 ml-auto sm:ml-0"
                        title="Refresh metrics"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                )}
            </div>
        </div>
    );
};
