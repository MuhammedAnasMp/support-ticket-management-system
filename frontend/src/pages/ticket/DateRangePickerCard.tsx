import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DateRange, type RangeKeyDict } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { Calendar as CalendarIcon, Filter, RotateCcw, X } from 'lucide-react';

interface DateRangePickerCardProps {
    fromDate: string; // YYYY-MM-DD
    toDate: string; // YYYY-MM-DD
    onDateRangeChange: (from: string, to: string) => void;
    onReset: () => void;
}

const formatDateStr = (d: Date | null | undefined): string => {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const PANEL_WIDTH = 400;

export const DateRangePickerCard: React.FC<DateRangePickerCardProps> = ({
    fromDate,
    toDate,
    onDateRangeChange,
    onReset,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

    // Local draft — only committed to parent on "Apply"
    const [draft, setDraft] = useState([{
        startDate: fromDate ? new Date(fromDate) : new Date(),
        endDate: toDate ? new Date(toDate) : new Date(),
        key: 'selection',
    }]);

    // Re-sync draft when parent resets externally
    useEffect(() => {
        setDraft([{
            startDate: fromDate ? new Date(fromDate) : new Date(),
            endDate: toDate ? new Date(toDate) : new Date(),
            key: 'selection',
        }]);
    }, [fromDate, toDate]);

    const triggerRef = useRef<HTMLButtonElement>(null);

    const openPanel = () => {
        if (isMobile) {
            setPanelPos(null); // mobile uses full-screen fixed
        } else if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            // Try to align right edge of panel with right edge of button;
            // clamp to viewport left.
            const left = Math.max(4, rect.right - PANEL_WIDTH);
            const top = rect.bottom + 6;
            setPanelPos({ top, left });
        }
        setIsOpen(true);
    };

    // Recompute position on scroll/resize while open
    const recomputePos = useCallback(() => {
        if (!isOpen || isMobile || !triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const left = Math.max(4, rect.right - PANEL_WIDTH);
        const top = rect.bottom + 6;
        setPanelPos({ top, left });
    }, [isOpen, isMobile]);

    useEffect(() => {
        window.addEventListener('scroll', recomputePos, true);
        window.addEventListener('resize', recomputePos);
        return () => {
            window.removeEventListener('scroll', recomputePos, true);
            window.removeEventListener('resize', recomputePos);
        };
    }, [recomputePos]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            // ignore clicks inside the trigger or the portal panel
            if (triggerRef.current?.contains(target)) return;
            const panel = document.getElementById('date-range-panel');
            if (panel?.contains(target)) return;
            setIsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const handleSelect = (ranges: RangeKeyDict) => {
        const s = ranges.selection;
        if (s.startDate && s.endDate) {
            setDraft([{ startDate: s.startDate, endDate: s.endDate, key: 'selection' }]);
        }
    };

    const handleApply = () => {
        onDateRangeChange(formatDateStr(draft[0].startDate), formatDateStr(draft[0].endDate));
        setIsOpen(false);
    };

    const handleReset = () => {
        setDraft([{ startDate: new Date(), endDate: new Date(), key: 'selection' }]);
        onReset();
        setIsOpen(false);
    };

    const activeLabel = React.useMemo(() => {
        if (fromDate && toDate) {
            if (fromDate === toDate) return `Date: ${fromDate}`;
            return `${fromDate} → ${toDate}`;
        }
        if (fromDate) return `From: ${fromDate}`;
        if (toDate) return `To: ${toDate}`;
        return 'Date Range';
    }, [fromDate, toDate]);

    const hasActive = Boolean(fromDate || toDate);

    const panel = isOpen ? (
        <>
            {/* Backdrop — always rendered (dimmed on mobile, transparent on desktop) */}
            <div
                className={`fixed inset-0 z-[999] ${isMobile ? 'bg-black/40' : ''}`}
                onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <div
                id="date-range-panel"
                style={panelPos ? {
                    position: 'fixed',
                    top: panelPos.top,
                    left: panelPos.left,
                    width: PANEL_WIDTH,
                } : {
                    // Mobile: bottom sheet
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    borderRadius: '1rem 1rem 0 0',
                }}
                className="z-[1000] bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant shadow-2xl overflow-hidden max-h-[90dvh] overflow-y-auto rounded-2xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-outline-variant dark:border-dark-outline-variant">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-primary" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface dark:text-dark-on-surface">
                            Filter By Date
                        </h4>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 rounded-lg text-outline hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Calendar — only updates draft, not parent */}
                <div className="p-4 flex justify-center date-range-inner">
                    <DateRange
                        editableDateInputs={true}
                        onChange={handleSelect}
                        moveRangeOnFirstSelection={false}
                        ranges={draft}
                        months={1}
                        direction="horizontal"
                    />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 pb-4 pt-3 border-t border-outline-variant dark:border-dark-outline-variant gap-3">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="flex items-center gap-1.5 text-xs text-red-500 font-semibold hover:text-red-600 transition-colors"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset
                    </button>
                    <button
                        type="button"
                        onClick={handleApply}
                        className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors"
                    >
                        Apply Filter
                    </button>
                </div>
            </div>
        </>
    ) : null;

    return (
        <>
            {/* Trigger button */}
            <button
                ref={triggerRef}
                type="button"
                onClick={openPanel}
                className={`flex items-center justify-center gap-1.5 text-xs font-semibold p-2 sm:px-3 sm:py-2 rounded border transition-all min-h-[36px] w-full sm:w-auto ${hasActive
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-surface-container dark:bg-dark-surface-container border-outline-variant dark:border-dark-outline-variant text-on-surface-variant dark:text-dark-on-surface-variant hover:border-primary/50'
                    }`}
            >
                <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="inline sm:inline">{activeLabel}</span>
            </button>

            {/* Render panel in a portal so it escapes any overflow:hidden ancestors */}
            {typeof document !== 'undefined' && createPortal(panel, document.body)}
        </>
    );
};
