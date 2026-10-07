import React, { useState, useMemo } from 'react';
import {
  X, Printer, Download, Copy, Check, FileText,
  Boxes, Building2, User, Layers, CheckCircle2,
  Calendar, DollarSign, Receipt, ArrowUpDown, Search,
  ShieldCheck, HelpCircle
} from 'lucide-react';
import type { LedgerItem, ExpenseItem } from './types';

export interface LedgerGroupCluster {
  groupId: number | string;
  groupName: string;
  createdByName: string;
  createdAt: string;
  isCompleted?: boolean;
  completedAt?: string;
  completedByName?: string;
  ledgers: LedgerItem[];
  totalAmount: number;
  totalBundlesCount: number;
  totalExpensesCount: number;
  allApproved: boolean;
  approvedCount: number;
  totalCount: number;
}

interface LedgerGroupReportModalProps {
  group: LedgerGroupCluster;
  onClose: () => void;
  setSelectedTicketForModal?: (ticket: any) => void;
}

export const LedgerGroupReportModal: React.FC<LedgerGroupReportModalProps> = ({
  group,
  onClose,
  setSelectedTicketForModal,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'sub_departments' | 'technicians' | 'expenses'>('overview');
  const [copied, setCopied] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState('');

  // Flatten all expenses across all ledgers in this group
  const allExpenses = useMemo(() => {
    const list: (ExpenseItem & { ledger_id: number; batch_name: string })[] = [];
    const seenExpenseIds = new Set<number>();

    for (const l of group.ledgers) {
      const batchName = l.ledger_batch_detail?.batch_name || `Ledger #${l.ledger_id}`;
      const exps = Array.isArray(l.expenses) ? l.expenses : [];
      for (const exp of exps) {
        if (!seenExpenseIds.has(exp.expense_id)) {
          seenExpenseIds.add(exp.expense_id);
          list.push({ ...exp, ledger_id: l.ledger_id, batch_name: batchName });
        }
      }
    }
    return list;
  }, [group.ledgers]);

  // Sub-Department Aggregates
  const subDeptAggregates = useMemo(() => {
    const map = new Map<string, {
      name: string;
      id?: number;
      expensesCount: number;
      totalAmount: number;
      ticketsSet: Set<string>;
      workersSet: Set<string>;
    }>();

    for (const exp of allExpenses) {
      const sdId = exp.ticket_details?.sub_department_id ?? exp.sub_department_id;
      const sdName = exp.ticket_details?.sub_department_name ?? exp.sub_department_name ?? 'General Maintenance';
      const key = String(sdId || sdName);

      if (!map.has(key)) {
        map.set(key, {
          name: sdName,
          id: sdId ? Number(sdId) : undefined,
          expensesCount: 0,
          totalAmount: 0,
          ticketsSet: new Set(),
          workersSet: new Set(),
        });
      }

      const entry = map.get(key)!;
      entry.expensesCount++;
      entry.totalAmount += parseFloat(exp.amount || '0');
      const tLabel = exp.ticket_details?.work_order_no || (exp.ticket ? `WO-${exp.ticket}` : '');
      if (tLabel) entry.ticketsSet.add(tLabel);

      const wObj = typeof exp.worker === 'object' && exp.worker ? exp.worker : exp.worker_detail;
      const wName = wObj?.full_name || wObj?.username || String(exp.worker || '');
      if (wName) entry.workersSet.add(wName);
    }

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [allExpenses]);

  // Worker / Technician Aggregates
  const workerAggregates = useMemo(() => {
    const map = new Map<string, {
      id?: number;
      name: string;
      username: string;
      employeeNo?: string;
      expensesCount: number;
      totalAmount: number;
      subDeptsSet: Set<string>;
    }>();

    for (const exp of allExpenses) {
      const wObj = typeof exp.worker === 'object' && exp.worker ? exp.worker : exp.worker_detail;
      const wId = wObj?.id || (typeof exp.worker === 'number' ? exp.worker : 0);
      const wName = wObj?.full_name || wObj?.username || `Technician ${wId || ''}`;
      const wUsername = wObj?.username || '';
      const wEmpNo = wObj?.employee_no || '';
      const key = String(wId || wName);

      if (!map.has(key)) {
        map.set(key, {
          id: wId || undefined,
          name: wName,
          username: wUsername,
          employeeNo: wEmpNo,
          expensesCount: 0,
          totalAmount: 0,
          subDeptsSet: new Set(),
        });
      }

      const entry = map.get(key)!;
      entry.expensesCount++;
      entry.totalAmount += parseFloat(exp.amount || '0');
      const sdName = exp.ticket_details?.sub_department_name ?? exp.sub_department_name ?? 'General';
      entry.subDeptsSet.add(sdName);
    }

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [allExpenses]);

  // Filtered Expenses for Table
  const filteredExpensesList = useMemo(() => {
    if (!expenseSearch.trim()) return allExpenses;
    const query = expenseSearch.toLowerCase();
    return allExpenses.filter(exp => {
      const expId = String(exp.expense_id);
      const woNo = (exp.ticket_details?.work_order_no || '').toLowerCase();
      const title = (exp.ticket_details?.title || '').toLowerCase();
      const cat = (exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || '').toLowerCase();
      const remarks = (exp.remarks || '').toLowerCase();
      const wObj = typeof exp.worker === 'object' && exp.worker ? exp.worker : exp.worker_detail;
      const workerName = (wObj?.full_name || wObj?.username || '').toLowerCase();
      const batchName = exp.batch_name.toLowerCase();
      return expId.includes(query) || woNo.includes(query) || title.includes(query) || cat.includes(query) || remarks.includes(query) || workerName.includes(query) || batchName.includes(query);
    });
  }, [allExpenses, expenseSearch]);

  // Copy Summary to Clipboard
  const handleCopySummary = () => {
    const lines = [
      `======================================================`,
      `LEDGER GROUP SETTLEMENT REPORT: ${group.groupName}`,
      `Group ID: ${group.groupId}`,
      `Created By: ${group.createdByName} | Date: ${new Date(group.createdAt || Date.now()).toLocaleDateString()}`,
      `Total Settlement Amount: KD ${group.totalAmount.toFixed(2)}`,
      `Total Ledger Batches: ${group.ledgers.length} (All Approved)`,
      `Total Expenses: ${allExpenses.length} | Total Bundles: ${group.totalBundlesCount}`,
      `======================================================`,
      ``,
      `--- LEDGER BATCHES BREAKDOWN ---`,
      ...group.ledgers.map(l => `• LB #${l.ledger_id} [${l.ledger_batch_detail?.batch_name || 'General'}]: KD ${parseFloat(l.total_amount).toFixed(2)} (${l.expenses?.length || 0} exp, Status: ${l.status})`),
      ``,
      `--- SUB-DEPARTMENT BREAKDOWN ---`,
      ...subDeptAggregates.map(sd => `• ${sd.name}: KD ${sd.totalAmount.toFixed(2)} (${sd.expensesCount} exp, ${sd.ticketsSet.size} tickets)`),
      ``,
      `--- TECHNICIAN PAYOUTS ---`,
      ...workerAggregates.map(w => `• ${w.name}: KD ${w.totalAmount.toFixed(2)} (${w.expensesCount} exp)`),
      `======================================================`,
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Expense ID',
      'Ledger ID',
      'Ledger Batch',
      'Technician',
      'Work Order #',
      'Ticket Title',
      'Sub-Department',
      'Category',
      'Expense Date',
      'Amount (KD)',
      'Remarks'
    ];

    const rows = allExpenses.map(exp => {
      const wObj = typeof exp.worker === 'object' && exp.worker ? exp.worker : exp.worker_detail;
      const workerName = wObj?.full_name || wObj?.username || `Worker ${exp.worker}`;
      return [
        exp.expense_id,
        exp.ledger_id,
        `"${exp.batch_name.replace(/"/g, '""')}"`,
        `"${workerName.replace(/"/g, '""')}"`,
        exp.ticket_details?.work_order_no || exp.ticket || '',
        `"${(exp.ticket_details?.title || '').replace(/"/g, '""')}"`,
        `"${(exp.ticket_details?.sub_department_name || exp.sub_department_name || '').replace(/"/g, '""')}"`,
        `"${(exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || '').replace(/"/g, '""')}"`,
        exp.expense_date,
        parseFloat(exp.amount).toFixed(2),
        `"${(exp.remarks || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ledger_Group_${group.groupId}_${group.groupName.replace(/\s+/g, '_')}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-surface-container rounded-2xl border border-outline-variant max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-0 print:p-0">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex items-center justify-between flex-wrap gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  All Batches Approved
                </span>
                <span className="text-xs font-mono text-on-surface-variant font-medium">
                  Group #{group.groupId}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-on-surface mt-0.5">
                {group.groupName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleCopySummary}
              className="px-3 py-1.5 rounded-lg border border-outline text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Copy formatted summary to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-on-surface-variant" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg border border-outline text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Export all itemized expenses to CSV"
            >
              <Download className="w-3.5 h-3.5 text-on-surface-variant" />
              <span>CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Print this report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-surface scrollbar-thin">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl bg-surface-container border border-outline-variant shadow-2xs">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-[11px] font-medium">Grand Settlement Total</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                KD {group.totalAmount.toFixed(2)}
              </div>
              <span className="text-[10px] text-on-surface-variant mt-0.5 block font-medium">
                Combined amount of {group.ledgers.length} batches
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-container border border-outline-variant shadow-2xs">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-[11px] font-medium">Ledger Batches</span>
                <Boxes className="w-4 h-4 text-primary" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-primary mt-1">
                {group.ledgers.length} Batches
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                100% Approved
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-container border border-outline-variant shadow-2xs">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-[11px] font-medium">Technicians Involved</span>
                <User className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-on-surface mt-1">
                {workerAggregates.length} Workers
              </div>
              <span className="text-[10px] text-on-surface-variant mt-0.5 block">
                {group.totalBundlesCount} worker claim bundles
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-container border border-outline-variant shadow-2xs">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-[11px] font-medium">Total Itemized Expenses</span>
                <Receipt className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-on-surface mt-1">
                {allExpenses.length} Items
              </div>
              <span className="text-[10px] text-on-surface-variant mt-0.5 block">
                Across {subDeptAggregates.length} Sub-Departments
              </span>
            </div>
          </div>

          {/* NAVIGATION TABS */}
          <div className="flex items-center gap-2 border-b border-outline-variant pb-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'overview'
                  ? 'bg-primary text-on-primary shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Ledger Batches ({group.ledgers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('sub_departments')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'sub_departments'
                  ? 'bg-primary text-on-primary shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Sub-Departments ({subDeptAggregates.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('technicians')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'technicians'
                  ? 'bg-primary text-on-primary shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Technician Payouts ({workerAggregates.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'expenses'
                  ? 'bg-primary text-on-primary shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>All Itemized Expenses ({allExpenses.length})</span>
            </button>
          </div>

          {/* TAB 1: OVERVIEW & LEDGER BATCHES */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container">
                <div className="px-4 py-3 bg-surface-container-high border-b border-outline-variant flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-primary" />
                    Ledger Batches in this Group
                  </span>
                  <span className="text-xs text-on-surface-variant font-medium">
                    {group.ledgers.length} Batches Assembled
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-on-surface">
                    <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-wider border-b border-outline-variant">
                      <tr>
                        <th className="px-4 py-2.5">Ledger ID</th>
                        <th className="px-4 py-2.5">Batch Name</th>
                        <th className="px-4 py-2.5">Target Sub-Departments</th>
                        <th className="px-4 py-2.5 text-center">Bundles</th>
                        <th className="px-4 py-2.5 text-center">Expenses</th>
                        <th className="px-4 py-2.5 text-right">Batch Total</th>
                        <th className="px-4 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/60">
                      {group.ledgers.map(l => {
                        const batchName = l.ledger_batch_detail?.batch_name || `Ledger Batch #${l.ledger_id}`;
                        const subDepts = l.ledger_batch_detail?.sub_departments_detail || [];
                        const expsCount = l.expenses?.length || 0;
                        const bundlesCount = l.bundles?.length || 0;
                        const amount = parseFloat(l.total_amount || '0');

                        return (
                          <tr key={l.ledger_id} className="hover:bg-surface-container-high/40 transition-colors">
                            <td className="px-4 py-3 font-semibold text-primary">
                              #{l.ledger_id}
                            </td>
                            <td className="px-4 py-3 font-medium text-on-surface">
                              <div className="flex items-center gap-1.5">
                                <Boxes className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span>{batchName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {subDepts.length === 0 ? (
                                <span className="text-on-surface-variant/60 italic text-[11px]">All Sub-Departments</span>
                              ) : (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {subDepts.map(sd => (
                                    <span key={sd.sub_department_id} className="text-[10px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface border border-outline-variant/60">
                                      {sd.sub_department_name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-on-surface">
                              {bundlesCount}
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-on-surface">
                              {expsCount}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              KD {amount.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                {l.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-surface-container-high font-bold border-t-2 border-outline-variant text-xs">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-on-surface">
                          Group Total
                        </td>
                        <td className="px-4 py-3 text-center text-on-surface">
                          {group.totalBundlesCount}
                        </td>
                        <td className="px-4 py-3 text-center text-on-surface">
                          {allExpenses.length}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 text-sm">
                          KD {group.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                            SETTLED
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SUB-DEPARTMENTS */}
          {activeTab === 'sub_departments' && (
            <div className="space-y-4">
              <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container">
                <div className="px-4 py-3 bg-surface-container-high border-b border-outline-variant flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-purple-600" />
                    Sub-Department Financial Breakdown
                  </span>
                  <span className="text-xs text-on-surface-variant font-medium">
                    {subDeptAggregates.length} Sub-Departments
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-on-surface">
                    <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-wider border-b border-outline-variant">
                      <tr>
                        <th className="px-4 py-2.5">Sub-Department</th>
                        <th className="px-4 py-2.5 text-center">Work Orders / Tickets</th>
                        <th className="px-4 py-2.5 text-center">Technicians</th>
                        <th className="px-4 py-2.5 text-center">Expenses Count</th>
                        <th className="px-4 py-2.5 text-right">Subtotal</th>
                        <th className="px-4 py-2.5 text-right">% of Group</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/60">
                      {subDeptAggregates.map(sd => {
                        const pct = group.totalAmount > 0 ? (sd.totalAmount / group.totalAmount) * 100 : 0;
                        return (
                          <tr key={sd.name} className="hover:bg-surface-container-high/40 transition-colors">
                            <td className="px-4 py-3 font-semibold text-on-surface">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                <span>{sd.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-on-surface">
                              {sd.ticketsSet.size} tickets
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-on-surface">
                              {sd.workersSet.size} workers
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-on-surface">
                              {sd.expensesCount}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              KD {sd.totalAmount.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-on-surface-variant">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-purple-600 h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                                <span className="font-mono text-[11px]">{pct.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-surface-container-high font-bold border-t-2 border-outline-variant text-xs">
                      <tr>
                        <td className="px-4 py-3 text-on-surface">
                          Total
                        </td>
                        <td className="px-4 py-3 text-center text-on-surface">
                          -
                        </td>
                        <td className="px-4 py-3 text-center text-on-surface">
                          {workerAggregates.length}
                        </td>
                        <td className="px-4 py-3 text-center text-on-surface">
                          {allExpenses.length}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 text-sm">
                          KD {group.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-on-surface">
                          100.0%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TECHNICIANS */}
          {activeTab === 'technicians' && (
            <div className="space-y-4">
              <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container">
                <div className="px-4 py-3 bg-surface-container-high border-b border-outline-variant flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600" />
                    Technician Claim Payout Summary
                  </span>
                  <span className="text-xs text-on-surface-variant font-medium">
                    {workerAggregates.length} Technicians
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-on-surface">
                    <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-wider border-b border-outline-variant">
                      <tr>
                        <th className="px-4 py-2.5">Technician</th>
                        <th className="px-4 py-2.5">Employee No.</th>
                        <th className="px-4 py-2.5">Sub-Departments Covered</th>
                        <th className="px-4 py-2.5 text-center">Expenses Count</th>
                        <th className="px-4 py-2.5 text-right">Payable Total</th>
                        <th className="px-4 py-2.5 text-right">% Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/60">
                      {workerAggregates.map(w => {
                        const pct = group.totalAmount > 0 ? (w.totalAmount / group.totalAmount) * 100 : 0;
                        return (
                          <tr key={w.name} className="hover:bg-surface-container-high/40 transition-colors">
                            <td className="px-4 py-3 font-semibold text-on-surface">
                              <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span>{w.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-on-surface-variant">
                              {w.employeeNo || '-'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 flex-wrap">
                                {Array.from(w.subDeptsSet).map(sd => (
                                  <span key={sd} className="text-[10px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface border border-outline-variant/60">
                                    {sd}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-on-surface">
                              {w.expensesCount}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              KD {w.totalAmount.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-on-surface-variant">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                                <span className="font-mono text-[11px]">{pct.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-surface-container-high font-bold border-t-2 border-outline-variant text-xs">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-on-surface">
                          Total Payout
                        </td>
                        <td className="px-4 py-3 text-center text-on-surface">
                          {allExpenses.length}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 text-sm">
                          KD {group.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-on-surface">
                          100.0%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ALL ITEMIZED EXPENSES */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container">
                <div className="p-3 bg-surface-container-high border-b border-outline-variant flex items-center justify-between flex-wrap gap-2.5">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-on-surface">All Itemized Expenses</span>
                    <span className="text-xs text-on-surface-variant font-medium">
                      Showing {filteredExpensesList.length} of {allExpenses.length}
                    </span>
                  </div>

                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      type="text"
                      value={expenseSearch}
                      onChange={(e) => setExpenseSearch(e.target.value)}
                      placeholder="Search expense, ticket, worker..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-outline bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96 scrollbar-thin">
                  <table className="w-full text-xs text-left text-on-surface">
                    <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-wider border-b border-outline-variant sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="px-3 py-2.5">Exp ID</th>
                        <th className="px-3 py-2.5">Batch</th>
                        <th className="px-3 py-2.5">Technician</th>
                        <th className="px-3 py-2.5">Work Order / Ticket</th>
                        <th className="px-3 py-2.5">Category</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/60">
                      {filteredExpensesList.map(exp => {
                        const rawTicket = (exp.ticket_details || (exp as any).ticket) as any;
                        const ticketLabel = exp.ticket_details?.work_order_no
                          ? String(exp.ticket_details.work_order_no)
                          : (typeof rawTicket === 'object' && rawTicket !== null
                            ? (rawTicket.work_order_no || `#${rawTicket.ticket_id || rawTicket.id}`)
                            : (exp.ticket ? String(exp.ticket) : '-'));
                        const wObj = typeof exp.worker === 'object' && exp.worker ? exp.worker : exp.worker_detail;
                        const workerName = wObj?.full_name || wObj?.username || `Worker ${exp.worker}`;

                        return (
                          <tr key={exp.expense_id} className="hover:bg-surface-container-high/40 transition-colors">
                            <td className="px-3 py-2.5 font-semibold text-primary">
                              #{exp.expense_id}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                {exp.batch_name}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-on-surface">
                              {workerName}
                            </td>
                            <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                              {exp.ticket_details || exp.ticket ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedTicketForModal && setSelectedTicketForModal(exp.ticket_details || (typeof exp.ticket === 'object' ? exp.ticket : { ticket_id: exp.ticket }))}
                                  className="font-mono font-medium text-primary hover:underline text-[11px] cursor-pointer text-left block"
                                >
                                  <span>{ticketLabel}</span>
                                  {exp.ticket_details?.title && (
                                    <span className="block text-[10px] text-on-surface-variant truncate max-w-xs font-normal">
                                      {exp.ticket_details.title}
                                    </span>
                                  )}
                                </button>
                              ) : (
                                <span className="text-on-surface-variant/60 italic text-[11px]">No Ticket</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-on-surface-variant">
                              {exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || 'General'}
                            </td>
                            <td className="px-3 py-2.5 text-on-surface-variant">
                              {exp.expense_date}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              KD {parseFloat(exp.amount).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SIGNATURE / VERIFICATION BLOCK */}
          <div className="pt-4 border-t border-outline-variant grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-on-surface-variant">
            <div className="p-3.5 rounded-xl border border-outline-variant bg-surface-container-low space-y-1">
              <span className="font-bold text-on-surface block text-[11px]">Report Generated By</span>
              <p className="text-[11px]">{group.createdByName}</p>
              <p className="text-[10px] text-on-surface-variant/70">Generated: {new Date().toLocaleDateString()}</p>
            </div>
            <div className="p-3.5 rounded-xl border border-outline-variant bg-surface-container-low space-y-1">
              <span className="font-bold text-on-surface block text-[11px]">Finance Approval</span>
              <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Workflow Verified
              </p>
              <p className="text-[10px] text-on-surface-variant/70">Multi-tier approval complete</p>
            </div>
            <div className="p-3.5 rounded-xl border border-outline-variant bg-surface-container-low space-y-1">
              <span className="font-bold text-on-surface block text-[11px]">Settlement Status</span>
              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                100% Approved for Disbursement
              </p>
              <p className="text-[10px] text-on-surface-variant/70">Ledger Group #{group.groupId}</p>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3 border-t border-outline-variant bg-surface-container-low flex items-center justify-between shrink-0">
          <span className="text-[11px] text-on-surface-variant">
            Official Financial Document • {group.groupName}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold transition-colors cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
