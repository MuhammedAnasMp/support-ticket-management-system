import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Check,
  Plus,
  Minus,
  GripHorizontal,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import type { ExpenseItem } from './types';
import { AvatarCircle } from '../ticket/TicketsTypesAndComponents';

interface CreateWorkerBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  worker: any;
  workerExpenses: ExpenseItem[];
  isLoadingExpenses?: boolean;
  selectedExpenseIds: number[];
  setSelectedExpenseIds: (ids: number[]) => void;
  bundleRemarks: string;
  setBundleRemarks: (r: string) => void;
  handleCreateBundle: () => void;
  submitting: boolean;
  isSyncingNewBundle?: boolean;
  errorMessage?: string | null;
  setErrorMessage?: (msg: string | null) => void;
}

export const CreateWorkerBundleModal: React.FC<CreateWorkerBundleModalProps> = ({
  isOpen,
  onClose,
  worker,
  workerExpenses,
  isLoadingExpenses = false,
  selectedExpenseIds,
  setSelectedExpenseIds,
  bundleRemarks,
  setBundleRemarks,
  handleCreateBundle,
  submitting,
  isSyncingNewBundle = false,
  errorMessage,
  setErrorMessage
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'added' | 'unadded'>('all');

  // Draggable slider state between added and unadded panels
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const newPercent = (relativeY / rect.height) * 100;
      const clamped = Math.min(80, Math.max(20, newPercent));
      setSplitPercent(clamped);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  const isExpenseEligible = (exp: ExpenseItem | any): boolean => {
    if (!exp) return false;
    if (exp.expense_type && (exp.expense_type as any).approve_required === false) return true;
    if (exp.expense_type_detail && (exp.expense_type_detail as any).approve_required === false) return true;
    if (exp.approved === true || (exp.approved as any) === 'true' || (exp.approved as any) === 1) return true;
    if (exp.status_display === 'Approved' || exp.status_display === 'APPROVED') return true;
    return false;
  };

  const getCleanRemarks = (raw?: string) => {
    if (!raw) return '';
    const lines = raw.split('\n');
    const cleanLines = lines.filter(line => !line.trim().match(/^\[.+?\]:/));
    return cleanLines.join('\n').trim();
  };

  // Separate expenses into added vs unadded
  const addedExpenses = useMemo(() => {
    return workerExpenses.filter(e => selectedExpenseIds.includes(e.expense_id));
  }, [workerExpenses, selectedExpenseIds]);

  const unaddedExpenses = useMemo(() => {
    return workerExpenses.filter(e => !selectedExpenseIds.includes(e.expense_id));
  }, [workerExpenses, selectedExpenseIds]);

  // Search filter predicate
  const matchesSearch = (exp: ExpenseItem) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const expIdStr = String(exp.expense_id || '');
    const categoryName = (exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || '').toLowerCase();
    const remarks = (exp.remarks || '').toLowerCase();
    const ticketObj = (exp as any).ticket_details || (exp as any).ticket;
    const workOrderNo = (typeof ticketObj === 'object' && ticketObj ? (ticketObj.work_order_no || '') : String(ticketObj || '')).toLowerCase();
    const amountStr = String(exp.amount || '');
    const dateStr = (exp.expense_date || '').toLowerCase();
    return (
      expIdStr.includes(q) ||
      `#${expIdStr}`.includes(q) ||
      `exp-${expIdStr}`.includes(q) ||
      categoryName.includes(q) ||
      remarks.includes(q) ||
      workOrderNo.includes(q) ||
      amountStr.includes(q) ||
      dateStr.includes(q)
    );
  };

  const filteredAdded = useMemo(() => {
    return addedExpenses.filter(matchesSearch);
  }, [addedExpenses, searchQuery]);

  const filteredUnadded = useMemo(() => {
    return unaddedExpenses.filter(matchesSearch);
  }, [unaddedExpenses, searchQuery]);

  // Totals calculation
  const addedTotal = addedExpenses.reduce((acc, curr) => acc + parseFloat(curr.amount || '0'), 0);
  const unaddedTotal = unaddedExpenses.reduce((acc, curr) => acc + parseFloat(curr.amount || '0'), 0);

  // Actions
  const handleToggleExpense = (exp: ExpenseItem) => {
    const isSelected = selectedExpenseIds.includes(exp.expense_id);
    const isApproved = isExpenseEligible(exp);

    if (!isSelected && !isApproved) return;

    if (isSelected) {
      setSelectedExpenseIds(selectedExpenseIds.filter(id => id !== exp.expense_id));
    } else {
      setSelectedExpenseIds([...selectedExpenseIds, exp.expense_id]);
    }
  };

  const handleAddAllEligible = () => {
    const eligibleToAdd = filteredUnadded
      .filter(exp => isExpenseEligible(exp))
      .map(e => e.expense_id);

    if (eligibleToAdd.length === 0) return;

    setSelectedExpenseIds(Array.from(new Set([...selectedExpenseIds, ...eligibleToAdd])));
  };

  const handleRemoveAllAdded = () => {
    const idsToRemove = filteredAdded.map(exp => exp.expense_id);
    if (idsToRemove.length === 0) return;

    setSelectedExpenseIds(selectedExpenseIds.filter(id => !idsToRemove.includes(id)));
  };

  // Render individual expense card
  const renderExpenseCard = (exp: ExpenseItem, isAdded: boolean) => {
    const isSelected = selectedExpenseIds.includes(exp.expense_id);
    const isExpApproved = isExpenseEligible(exp);
    const isSelectable = isExpApproved;
    const cleanRemarks = getCleanRemarks(exp.remarks);

    return (
      <div
        key={exp.expense_id}
        onClick={() => isSelectable && handleToggleExpense(exp)}
        className={`p-2.5 rounded border text-xs flex items-center justify-between gap-2.5 transition-all select-none ${!isSelectable
          ? 'bg-surface-container-low/50 border-outline-variant/40 opacity-70 cursor-not-allowed'
          : isSelected
            ? 'bg-primary/5 hover:bg-primary/10 border-primary/40 cursor-pointer shadow-2xs'
            : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/70 cursor-pointer shadow-2xs'
          }`}
      >
        <div className="flex items-center min-w-0 flex-1 pr-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-on-surface truncate">
                {exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || `Expense #${exp.expense_id}`}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant font-bold">
                #{exp.expense_id}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-auto sm:ml-0">
                {parseFloat(exp.amount).toFixed(3)} KD
              </span>

              {/* Status Badges */}
              {!isExpApproved ? (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20 inline-flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" /> Needs Approval
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 inline-flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-on-surface-variant truncate mt-0.5">
              <span>{exp.expense_date}</span>
              {exp.ticket_details?.work_order_no && (
                <span>• WO: <strong className="text-on-surface">{exp.ticket_details.work_order_no}</strong></span>
              )}
              {cleanRemarks && (
                <span className="truncate" title={cleanRemarks}>• {cleanRemarks}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Action Button */}
        <div className="shrink-0 ml-2">
          {!isSelectable ? (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium italic">
              Unapproved
            </span>
          ) : isAdded ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleExpense(exp);
              }}
              className="px-2.5 py-1 rounded border border-rose-500/40 text-rose-600 dark:text-rose-400 text-[10px] font-semibold hover:bg-rose-500/10 cursor-pointer transition-colors inline-flex items-center gap-1 shadow-2xs"
              title="Remove expense from this bundle"
            >
              <Minus className="w-3 h-3" />
              <span>Remove</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleExpense(exp);
              }}
              className="px-2.5 py-1 rounded bg-primary text-on-primary text-[10px] font-semibold hover:bg-primary/90 cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1 active:scale-95"
              title="Add expense to this bundle"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const workerName = worker?.name || worker?.full_name || worker?.username || 'Technician';

  return (
    <div className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-surface-container rounded border border-outline-variant/80 max-w-3xl w-full h-[88vh] max-h-[92vh] flex flex-col shadow-2xl text-on-surface relative overflow-hidden transition-all">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/80 px-4 py-3 shrink-0 bg-surface-container-high/40">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer mr-0.5"
              title="Back to technician list"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <AvatarCircle
              user={worker}
              name={workerName}
              image={worker?.profile_image}
              size="sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-on-surface tracking-tight truncate">
                  Create Claim Bundle
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold border border-primary/20 shrink-0">
                  New Bundle
                </span>
              </div>
              <div className="text-xs text-on-surface-variant font-normal truncate">
                Technician: <strong className="text-on-surface font-semibold">{workerName}</strong>
                {worker?.employee_no && (
                  <span className="ml-1.5 text-on-surface-variant/80">• EMP: {worker.employee_no}</span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin flex flex-col min-h-0">

          {/* Modal Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between shadow-2xs animate-in fade-in shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
              {setErrorMessage && (
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="p-1 hover:bg-red-500/10 rounded transition-colors text-red-500 shrink-0 cursor-pointer"
                  title="Dismiss error"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Remarks input */}
          <div className="shrink-0">
            <label className="block font-semibold text-on-surface mb-1 text-xs">
              Bundle Remarks <span className="text-red-500 font-bold">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={bundleRemarks}
              onChange={(e) => setBundleRemarks(e.target.value)}
              placeholder="Notes or description for this worker claim bundle (Required)..."
              className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-xs rounded p-2.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs hover:border-outline resize-none"
            />
          </div>

          {/* Search bar & View Filter Tabs */}
          <div className="pt-2 border-t border-outline-variant/70 space-y-2 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">

              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/70" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by ID, Category, WO#, Remarks, Amount..."
                  className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-xs rounded pl-8 pr-8 py-2 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs hover:border-outline placeholder:text-on-surface-variant/50"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-0.5 rounded cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* View filter toggles */}
              <div className="flex items-center gap-1 bg-surface-container-low border border-outline-variant p-0.5 rounded shrink-0 text-xs font-semibold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('all')}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer ${activeFilterTab === 'all'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                  All ({workerExpenses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('added')}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 ${activeFilterTab === 'added'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                  <span>Added</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${activeFilterTab === 'added' ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}>
                    {addedExpenses.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('unadded')}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 ${activeFilterTab === 'unadded'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                  <span>Unadded</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${activeFilterTab === 'unadded' ? 'bg-white/20 text-white' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}>
                    {unaddedExpenses.length}
                  </span>
                </button>
              </div>

            </div>
          </div>

          {/* Draggable Panels Container */}
          <div
            ref={splitContainerRef}
            className="flex-1 min-h-[300px] flex flex-col relative rounded border border-outline-variant/80 bg-surface-container-lowest overflow-hidden select-none"
          >
            {isLoadingExpenses ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-on-surface-variant text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span>Loading technician expenses...</span>
              </div>
            ) : workerExpenses.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-on-surface-variant">
                No unclaimed expenses found for this technician.
              </div>
            ) : activeFilterTab === 'all' ? (
              <>
                {/* 1. TOP PANEL: ADDED EXPENSES */}
                <div
                  style={{ height: `${splitPercent}%` }}
                  className="flex flex-col min-h-0 overflow-hidden bg-surface-container/30"
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-surface-container-high/60 border-b border-outline-variant/60 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-on-surface">Added Expenses</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {addedExpenses.length} ({addedTotal.toFixed(3)} KD)
                      </span>
                    </div>

                    {filteredAdded.length > 0 && (
                      <button
                        type="button"
                        onClick={handleRemoveAllAdded}
                        className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                      >
                        Remove All
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 scrollbar-thin">
                    {filteredAdded.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-4 text-center text-xs text-on-surface-variant/70 italic">
                        {searchQuery
                          ? 'No added expenses match your search.'
                          : 'No expenses added yet. Click (+) on items below to add.'}
                      </div>
                    ) : (
                      filteredAdded.map(exp => renderExpenseCard(exp, true))
                    )}
                  </div>
                </div>

                {/* DRAGGABLE RESIZER HANDLE */}
                <div
                  onPointerDown={handlePointerDown}
                  className={`h-2.5 bg-outline-variant/50 hover:bg-primary/40 cursor-row-resize flex items-center justify-center shrink-0 transition-colors group relative ${isDragging ? 'bg-primary/50' : ''
                    }`}
                  title="Drag up or down to resize panels"
                >
                  <GripHorizontal className="w-4 h-4 text-on-surface-variant/60 group-hover:text-primary transition-colors" />
                </div>

                {/* 2. BOTTOM PANEL: UNADDED EXPENSES */}
                <div
                  style={{ height: `${100 - splitPercent}%` }}
                  className="flex flex-col min-h-0 overflow-hidden bg-surface-container-low/40"
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-surface-container-high/60 border-b border-outline-variant/60 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-on-surface">Available / Unadded Expenses</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-container-highest text-on-surface-variant border border-outline-variant/60">
                        {unaddedExpenses.length} ({unaddedTotal.toFixed(3)} KD)
                      </span>
                    </div>

                    {filteredUnadded.some(isExpenseEligible) && (
                      <button
                        type="button"
                        onClick={handleAddAllEligible}
                        className="text-[11px] text-primary hover:underline font-bold cursor-pointer"
                      >
                        Add All Eligible
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 scrollbar-thin">
                    {filteredUnadded.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-4 text-center text-xs text-on-surface-variant/70 italic">
                        {searchQuery
                          ? 'No available expenses match your search.'
                          : 'All available expenses have been added to the bundle.'}
                      </div>
                    ) : (
                      filteredUnadded.map(exp => renderExpenseCard(exp, false))
                    )}
                  </div>
                </div>
              </>
            ) : activeFilterTab === 'added' ? (
              /* ONLY ADDED TAB VIEW */
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-surface-container-high/60 border-b border-outline-variant/60 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-on-surface">Added Expenses</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {addedExpenses.length} ({addedTotal.toFixed(3)} KD)
                    </span>
                  </div>
                  {filteredAdded.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRemoveAllAdded}
                      className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                    >
                      Remove All
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 scrollbar-thin">
                  {filteredAdded.length === 0 ? (
                    <div className="h-full flex items-center justify-center p-4 text-center text-xs text-on-surface-variant/70 italic">
                      {searchQuery
                        ? 'No added expenses match your search.'
                        : 'No expenses added yet.'}
                    </div>
                  ) : (
                    filteredAdded.map(exp => renderExpenseCard(exp, true))
                  )}
                </div>
              </div>
            ) : (
              /* ONLY UNADDED TAB VIEW */
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-surface-container-high/60 border-b border-outline-variant/60 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-on-surface">Available / Unadded Expenses</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-container-highest text-on-surface-variant border border-outline-variant/60">
                      {unaddedExpenses.length} ({unaddedTotal.toFixed(3)} KD)
                    </span>
                  </div>
                  {filteredUnadded.some(isExpenseEligible) && (
                    <button
                      type="button"
                      onClick={handleAddAllEligible}
                      className="text-[11px] text-primary hover:underline font-bold cursor-pointer"
                    >
                      Add All Eligible
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 scrollbar-thin">
                  {filteredUnadded.length === 0 ? (
                    <div className="h-full flex items-center justify-center p-4 text-center text-xs text-on-surface-variant/70 italic">
                      {searchQuery
                        ? 'No available expenses match your search.'
                        : 'No unclaimed expenses available for this technician.'}
                    </div>
                  ) : (
                    filteredUnadded.map(exp => renderExpenseCard(exp, false))
                  )}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Fixed Modal Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-outline-variant/80 bg-surface-container-high/30 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-variant">
              Bundle Total:
            </span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {addedTotal.toFixed(3)} KD
            </span>
            <span className="text-xs text-on-surface-variant hidden sm:inline">
              ({addedExpenses.length} {addedExpenses.length === 1 ? 'expense' : 'expenses'})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              Back to Technicians
            </button>
            <button
              type="button"
              onClick={handleCreateBundle}
              disabled={submitting || isSyncingNewBundle || addedExpenses.length === 0 || !bundleRemarks.trim()}
              className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-all cursor-pointer shadow-md hover:shadow-primary/25 active:scale-[0.98] flex items-center gap-2"
            >
              {isSyncingNewBundle ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Finalizing Bundle...</span>
                </span>
              ) : submitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Bundle...</span>
                </span>
              ) : (
                'Create Claim Bundle'
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
