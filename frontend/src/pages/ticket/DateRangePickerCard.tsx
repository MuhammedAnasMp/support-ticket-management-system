import React, { useState } from 'react';
import { DateRange, type RangeKeyDict } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { Calendar as CalendarIcon, Filter, RotateCcw, ChevronDown, X } from 'lucide-react';

interface DateRangePickerCardProps {
    fromDate: string; // YYYY-MM-DD
    toDate: string;   // YYYY-MM-DD
    onDateRangeChange: (from: string, to: string) => void;
    onReset: () => void;
}

export const DateRangePickerCard: React.FC<DateRangePickerCardProps> = ({
    fromDate,
    toDate,
    onDateRangeChange,
    onReset
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const rangeState = [{
        startDate: fromDate ? new Date(fromDate) : new Date(),
        endDate: toDate ? new Date(toDate) : new Date(),
        key: 'selection'
    }];

    const formatDateStr = (d: Date | null | undefined): string => {
        if (!d) return '';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleSelect = (ranges: RangeKeyDict) => {
        const selection = ranges.selection;
        if (selection.startDate && selection.endDate) {
            onDateRangeChange(formatDateStr(selection.startDate), formatDateStr(selection.endDate));
        }
    };

    const activeLabel = React.useMemo(() => {
        if (fromDate && toDate) {
            if (fromDate === toDate) return `Date: ${fromDate}`;
            return `${fromDate} to ${toDate}`;
        }
        if (fromDate) return `From: ${fromDate}`;
        if (toDate) return `To: ${toDate}`;
        return 'Date Range Filter';
    }, [fromDate, toDate]);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 text-xs font-semibold px-3.5 py-2.5 rounded-xl border transition-all ${
                    fromDate || toDate
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'bg-surface-container border-outline-variant text-on-surface-variant dark:border-dark-outline-variant dark:text-dark-on-surface-variant hover:border-primary/50'
                }`}
            >
                <CalendarIcon className="w-4 h-4 text-primary" />
                <span>{activeLabel}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 z-50 p-4 rounded-2xl bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant shadow-2xl backdrop-blur-xl">
                    <div className="flex items-center justify-between pb-3 border-b border-outline-variant dark:border-dark-outline-variant mb-3">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-primary" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface dark:text-dark-on-surface">Filter By Date</h4>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="p-1 rounded-lg text-outline hover:bg-surface-container-high transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* react-date-range Package Component */}
                    <div className="mb-4 flex justify-center react-date-range-custom-container">
                        <DateRange
                            editableDateInputs={true}
                            onChange={handleSelect}
                            moveRangeOnFirstSelection={false}
                            ranges={rangeState}
                            months={1}
                            direction="horizontal"
                        />
                    </div>

                    {/* Footer Controls */}
                    <div className="flex items-center justify-between pt-2 border-t border-outline-variant dark:border-dark-outline-variant">
                        <button
                            type="button"
                            onClick={() => {
                                onReset();
                            }}
                            className="flex items-center gap-1 text-xs text-red-500 font-semibold hover:underline"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
