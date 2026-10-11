import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X, Printer, Download, Copy, Check, FileText,
  Boxes, Building2, User, Layers, CheckCircle2,
  DollarSign, Receipt, Search, ShieldCheck, Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { LedgerItem, ExpenseItem, LedgerBatchItem } from './types';

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
  token?: string;
  API_URL?: string;
}

interface ExpenseColumnCategory {
  parentName: string;
  children: string[];
}

interface TicketExpenseRow {
  uniqueKey: string;
  workerId: number | string;
  workerName: string;
  workerEmployeeNo?: string;
  bundleId: number | string;
  expNo: string | number;
  location: string;
  subDepartment: string;
  issueTitle: string;
  ledgerBatch: string;
  ledgerGroup: string;
  ledgerId: number;
  amountsByType: Record<string, number>;
  total: number;
  ticketObj?: any;
  labourAmount: number;
}

export const LedgerGroupReportModal: React.FC<LedgerGroupReportModalProps> = ({
  group,
  onClose,
  setSelectedTicketForModal,
  token,
  API_URL,
}) => {
  const [activeTab, setActiveTab] = useState<'userwise' | 'storewise' | 'consolidated'>('userwise');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fetchedExpenseTypes, setFetchedExpenseTypes] = useState<any[]>([]);
  const [fetchedBatches, setFetchedBatches] = useState<LedgerBatchItem[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Fetch complete expense type hierarchy and ledger batches from API
  useEffect(() => {
    if (!API_URL) return;
    const headers: Record<string, string> = token ? { Authorization: `Token ${token}` } : {};

    // 1. Fetch Expense Types
    fetch(`${API_URL}/finance/expensetype/`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
        setFetchedExpenseTypes(list);
      })
      .catch(err => console.error('Failed to fetch expense types:', err));

    // 2. Fetch Ledger Batches
    fetch(`${API_URL}/finance/ledger-batches/`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
        setFetchedBatches(list);
      })
      .catch(err => console.error('Failed to fetch ledger batches:', err));
  }, [API_URL, token]);

  // Flatten all itemized expenses across all ledgers & bundles in this group
  const allExpenses = useMemo(() => {
    const list: (ExpenseItem & {
      ledger_id: number;
      batch_name: string;
      bundle_id?: number | string;
    })[] = [];
    const seenExpenseIds = new Set<number>();

    for (const l of group.ledgers) {
      const batchName = l.ledger_batch_detail?.batch_name ||
        (typeof l.ledger_batch === 'object' ? (l.ledger_batch as any)?.batch_name : null) ||
        `Ledger Batch #${l.ledger_id}`;

      // Check expenses inside bundles
      if (Array.isArray(l.bundles)) {
        for (const bundle of l.bundles) {
          const bundleId = bundle.claim_id;
          const bundleExps = Array.isArray(bundle.expenses) ? bundle.expenses : [];
          for (const exp of bundleExps) {
            if (!seenExpenseIds.has(exp.expense_id)) {
              seenExpenseIds.add(exp.expense_id);
              list.push({ ...exp, ledger_id: l.ledger_id, batch_name: batchName, bundle_id: bundleId });
            }
          }
        }
      }

      // Check direct expenses on ledger
      const directExps = Array.isArray(l.expenses) ? l.expenses : [];
      for (const exp of directExps) {
        if (!seenExpenseIds.has(exp.expense_id)) {
          seenExpenseIds.add(exp.expense_id);
          const bundleId = (exp as any).claim_id || (exp as any).claim || (typeof exp.claim === 'object' ? exp.claim?.claim_id : undefined);
          list.push({ ...exp, ledger_id: l.ledger_id, batch_name: batchName, bundle_id: bundleId });
        }
      }
    }
    return list;
  }, [group.ledgers]);

  // Build parent map from API and expenses
  const expenseTypeParentMap = useMemo(() => {
    const childToParent = new Map<string, string>();

    // From API
    for (const et of fetchedExpenseTypes) {
      const childName = (et.expense_name || '').trim();
      const parentName = (et.parent?.expense_name || et.parent_name || '').trim();
      if (childName && parentName) {
        childToParent.set(childName.toLowerCase(), parentName);
      }
    }

    // From actual expenses
    for (const exp of allExpenses) {
      const expTypeObj = exp.expense_type_detail || exp.expense_type;
      const childName = ((expTypeObj as any)?.expense_name || '').trim();
      const parentName = ((expTypeObj as any)?.parent_name || (expTypeObj as any)?.parent?.expense_name || '').trim();
      if (childName && parentName) {
        childToParent.set(childName.toLowerCase(), parentName);
      }
    }

    return childToParent;
  }, [fetchedExpenseTypes, allExpenses]);

  // Dynamic Multi-Level Expense Columns structure (Parent -> Children)
  const expenseColumnsHierarchy = useMemo<ExpenseColumnCategory[]>(() => {
    const parentToChildrenMap = new Map<string, Set<string>>();
    const knownParentsOrder = ['Travel Fair', 'Transportation', 'Material', 'Other', 'Miscellaneous'];

    // Discover all expense type names used in this group
    const usedTypeNames = new Set<string>();
    for (const exp of allExpenses) {
      const typeName = (exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || '').trim();
      if (typeName) {
        usedTypeNames.add(typeName);
      }
    }

    // Default template if no expenses yet
    if (usedTypeNames.size === 0) {
      return [
        { parentName: 'Travel Fair', children: ['BusFair', 'taxi fair'] },
        { parentName: 'Material', children: ['Cost', 'Transportation'] }
      ];
    }

    for (const typeName of usedTypeNames) {
      const lower = typeName.toLowerCase();
      let parent = expenseTypeParentMap.get(lower);

      if (!parent) {
        if (lower.includes('bus') || lower.includes('taxi') || lower.includes('fare') || lower.includes('fair') || lower.includes('travel') || lower.includes('transport')) {
          parent = 'Travel Fair';
        } else if (lower.includes('cost') || lower.includes('material') || lower.includes('item') || lower.includes('spare') || lower.includes('part') || lower.includes('hardware')) {
          parent = 'Material';
        } else {
          parent = 'Other';
        }
      }

      if (!parentToChildrenMap.has(parent)) {
        parentToChildrenMap.set(parent, new Set());
      }
      parentToChildrenMap.get(parent)!.add(typeName);
    }

    // Sort parents with known parents first
    const sortedParents = Array.from(parentToChildrenMap.keys()).sort((a, b) => {
      const idxA = knownParentsOrder.indexOf(a);
      const idxB = knownParentsOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return sortedParents.map(parentName => ({
      parentName,
      children: Array.from(parentToChildrenMap.get(parentName)!)
    }));
  }, [allExpenses, expenseTypeParentMap]);

  // Flattened list of all distinct child columns
  const allChildExpenseColumns = useMemo<string[]>(() => {
    const list: string[] = [];
    for (const cat of expenseColumnsHierarchy) {
      for (const child of cat.children) {
        if (!list.includes(child)) {
          list.push(child);
        }
      }
    }
    return list;
  }, [expenseColumnsHierarchy]);

  // Helper to resolve the correct LedgerBatch name for a ledger or ticket
  const resolveLedgerBatchName = useMemo(() => {
    return (ledger: LedgerItem, subDeptId?: number, subDeptName?: string): string => {
      // 1. Direct from ledger batch detail
      if (ledger.ledger_batch_detail?.batch_name) {
        return ledger.ledger_batch_detail.batch_name;
      }
      if (typeof ledger.ledger_batch === 'object' && (ledger.ledger_batch as any)?.batch_name) {
        return (ledger.ledger_batch as any).batch_name;
      }

      // 2. Lookup by sub-department if batch detail missing
      if (subDeptId && fetchedBatches.length > 0) {
        const matched = fetchedBatches.find(b =>
          Array.isArray(b.sub_departments) && b.sub_departments.includes(subDeptId)
        );
        if (matched) return matched.batch_name;
      }
      if (subDeptName && fetchedBatches.length > 0) {
        const lowerName = subDeptName.toLowerCase().trim();
        const matched = fetchedBatches.find(b =>
          b.sub_departments_detail?.some(sd => sd.sub_department_name.toLowerCase().trim() === lowerName)
        );
        if (matched) return matched.batch_name;
      }

      return group.groupName || `Ledger #${ledger.ledger_id}`;
    };
  }, [fetchedBatches, group.groupName]);

  // Build Structured Ticket/Expense Rows
  const structuredRows = useMemo<TicketExpenseRow[]>(() => {
    const rowMap = new Map<string, TicketExpenseRow>();

    // 1. Build rows from all expenses
    for (const exp of allExpenses) {
      const wObj = typeof exp.worker === 'object' && exp.worker ? exp.worker : exp.worker_detail;
      const workerId = wObj?.id || (typeof exp.worker === 'number' ? exp.worker : 'unknown');
      const workerName = wObj?.full_name || wObj?.username || `Technician ${workerId}`;
      const workerEmpNo = wObj?.employee_no || '';

      const rawTicket = (exp.ticket_details || (exp as any).ticket) as any;
      const ticketId = exp.ticket_details?.ticket_id ||
        (typeof rawTicket === 'object' ? rawTicket?.ticket_id || rawTicket?.id : (typeof exp.ticket === 'number' ? exp.ticket : null));
      const expNo = exp.ticket_details?.work_order_no || (ticketId ? `WO-${ticketId}` : `EXP-${exp.expense_id}`);
      const bundleId = exp.bundle_id || (exp as any).claim_id || (exp as any).claim || '-';

      const location = exp.responsible_store?.store_name || exp.ticket_details?.store_name || (exp as any).store_name || 'General';
      const subDept = exp.ticket_details?.sub_department_name || exp.sub_department_name || 'General';
      const issueTitle = exp.ticket_details?.title || (exp as any).title || exp.remarks || 'Maintenance Request';

      const ledgerObj = group.ledgers.find(l => l.ledger_id === exp.ledger_id) || ({} as LedgerItem);
      const ledgerBatch = resolveLedgerBatchName(ledgerObj, exp.ticket_details?.sub_department_id || exp.sub_department_id, subDept);
      const ledgerGroup = group.groupName || ledgerBatch;

      const key = `${workerId}_${bundleId}_${ticketId || exp.expense_id}_${location}_${subDept}`;

      if (!rowMap.has(key)) {
        rowMap.set(key, {
          uniqueKey: key,
          workerId,
          workerName,
          workerEmployeeNo: workerEmpNo,
          bundleId,
          expNo,
          location,
          subDepartment: subDept,
          issueTitle,
          ledgerBatch,
          ledgerGroup,
          ledgerId: exp.ledger_id,
          amountsByType: {},
          total: 0,
          ticketObj: exp.ticket_details || (typeof rawTicket === 'object' ? rawTicket : null),
          labourAmount: 0
        });
      }

      const row = rowMap.get(key)!;
      const typeName = (exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || 'Other').trim();
      const amt = parseFloat(exp.amount || '0');
      row.amountsByType[typeName] = (row.amountsByType[typeName] || 0) + amt;
      row.total += amt;
    }

    // 2. Also include worker claims from bundles
    for (const l of group.ledgers) {
      if (Array.isArray(l.bundles)) {
        for (const bundle of l.bundles) {
          const wObj = bundle.worker_detail;
          const workerId = wObj?.id || bundle.worker || 'unknown';
          const workerName = wObj?.full_name || wObj?.username || `Technician ${workerId}`;
          const workerEmpNo = wObj?.employee_no || '';
          const bundleId = bundle.claim_id;
          const location = bundle.ticket_details?.store_name || l.store_detail?.store_name || 'General';
          const subDept = bundle.ticket_details?.sub_department_name || 'General';
          const issueTitle = bundle.ticket_details?.title || bundle.remarks || 'Worker Settlement';
          const ledgerBatch = resolveLedgerBatchName(l, bundle.ticket_details?.sub_department_id, subDept);
          const ledgerGroup = group.groupName || ledgerBatch;
          const expNo = bundle.ticket_details?.work_order_no || `CLAIM-${bundle.claim_id}`;

          const key = `${workerId}_${bundleId}_${bundle.ticket_details?.ticket_id || bundleId}_${location}_${subDept}`;
          if (!rowMap.has(key)) {
            const claimedAmt = parseFloat(bundle.total_claimed_amount || '0');
            rowMap.set(key, {
              uniqueKey: key,
              workerId,
              workerName,
              workerEmployeeNo: workerEmpNo,
              bundleId,
              expNo,
              location,
              subDepartment: subDept,
              issueTitle,
              ledgerBatch,
              ledgerGroup,
              ledgerId: l.ledger_id,
              amountsByType: {},
              total: claimedAmt,
              ticketObj: bundle.ticket_details,
              labourAmount: claimedAmt
            });
          }
        }
      }
    }

    return Array.from(rowMap.values());
  }, [allExpenses, group.ledgers, group.groupName, resolveLedgerBatchName]);

  // Group structured rows by Worker for Tab 1 (User-wise Report)
  const workerGroupedRows = useMemo(() => {
    const map = new Map<string, {
      workerId: string | number;
      workerName: string;
      workerEmployeeNo?: string;
      rows: TicketExpenseRow[];
      subtotalByType: Record<string, number>;
      totalAmount: number;
      uniqueLocationsCount: number;
    }>();

    for (const row of structuredRows) {
      const key = String(row.workerId);
      if (!map.has(key)) {
        map.set(key, {
          workerId: row.workerId,
          workerName: row.workerName,
          workerEmployeeNo: row.workerEmployeeNo,
          rows: [],
          subtotalByType: {},
          totalAmount: 0,
          uniqueLocationsCount: 0
        });
      }

      const groupEntry = map.get(key)!;
      groupEntry.rows.push(row);
      groupEntry.totalAmount += row.total;

      for (const col of allChildExpenseColumns) {
        const amt = row.amountsByType[col] || 0;
        groupEntry.subtotalByType[col] = (groupEntry.subtotalByType[col] || 0) + amt;
      }
    }

    for (const entry of map.values()) {
      const locationsSet = new Set(entry.rows.map(r => r.location.trim().toLowerCase()));
      entry.uniqueLocationsCount = locationsSet.size;
    }

    return Array.from(map.values()).sort((a, b) => a.workerName.localeCompare(b.workerName));
  }, [structuredRows, allChildExpenseColumns]);

  // Overall Grand Totals for User-wise Report
  const userwiseGrandTotals = useMemo(() => {
    const colTotals: Record<string, number> = {};
    let grandTotal = 0;
    const allLocations = new Set<string>();

    for (const row of structuredRows) {
      grandTotal += row.total;
      allLocations.add(row.location.trim().toLowerCase());
      for (const col of allChildExpenseColumns) {
        colTotals[col] = (colTotals[col] || 0) + (row.amountsByType[col] || 0);
      }
    }

    return {
      colTotals,
      grandTotal,
      uniqueLocationsCount: allLocations.size
    };
  }, [structuredRows, allChildExpenseColumns]);

  // All Dynamic Ledger Batches present in group or system
  const dynamicLedgerBatches = useMemo(() => {
    const set = new Set<string>();

    // 1. From active group ledgers
    for (const l of group.ledgers) {
      if (l.ledger_batch_detail?.batch_name) {
        set.add(l.ledger_batch_detail.batch_name.trim());
      }
    }

    // 2. From structured rows
    for (const r of structuredRows) {
      if (r.ledgerBatch) {
        set.add(r.ledgerBatch.trim());
      }
    }

    // 3. Fallback to fetched batches if needed
    if (set.size === 0 && fetchedBatches.length > 0) {
      fetchedBatches.forEach(b => {
        if (b.batch_name) set.add(b.batch_name.trim());
      });
    }

    return Array.from(set).sort();
  }, [group.ledgers, structuredRows, fetchedBatches]);

  // Filtered rows for Tab 2 Store-wise Report
  const storewiseFilteredRows = useMemo(() => {
    let rows = structuredRows;
    if (selectedBatchFilter !== 'all') {
      rows = rows.filter(r => r.ledgerBatch === selectedBatchFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(r =>
        r.workerName.toLowerCase().includes(q) ||
        String(r.expNo).toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        r.subDepartment.toLowerCase().includes(q) ||
        r.issueTitle.toLowerCase().includes(q) ||
        r.ledgerBatch.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [structuredRows, selectedBatchFilter, searchTerm]);

  // Store-wise Section Totals
  const storewiseTotals = useMemo(() => {
    const colTotals: Record<string, number> = {};
    let total = 0;
    for (const row of storewiseFilteredRows) {
      total += row.total;
      for (const col of allChildExpenseColumns) {
        colTotals[col] = (colTotals[col] || 0) + (row.amountsByType[col] || 0);
      }
    }
    return { colTotals, total };
  }, [storewiseFilteredRows, allChildExpenseColumns]);

  // Group rows by dynamic Ledger Batch for Store-wise Reporting
  const storewiseByBatch = useMemo(() => {
    return dynamicLedgerBatches.map(batchName => {
      const batchRows = structuredRows.filter(r => r.ledgerBatch === batchName);
      const batchTotals: Record<string, number> = {};
      let batchTotal = 0;
      for (const row of batchRows) {
        batchTotal += row.total;
        for (const col of allChildExpenseColumns) {
          batchTotals[col] = (batchTotals[col] || 0) + (row.amountsByType[col] || 0);
        }
      }
      return {
        batchName,
        rows: batchRows,
        subtotalByType: batchTotals,
        batchTotal
      };
    }).filter(b => b.rows.length > 0);
  }, [dynamicLedgerBatches, structuredRows, allChildExpenseColumns]);

  // Consolidated Dynamic Ledger Batch Data for Tab 3 (Sheet 5 in Excel)
  const consolidatedBatchData = useMemo(() => {
    const batchMap = new Map<string, {
      section: string;
      labourCharge: number;
      expense: number;
      total: number;
    }>();

    // Initialize all dynamic batches
    for (const bName of dynamicLedgerBatches) {
      batchMap.set(bName, {
        section: bName,
        labourCharge: 0,
        expense: 0,
        total: 0
      });
    }

    for (const row of structuredRows) {
      const bName = row.ledgerBatch || 'General Maintenance';
      if (!batchMap.has(bName)) {
        batchMap.set(bName, {
          section: bName,
          labourCharge: 0,
          expense: 0,
          total: 0
        });
      }
      const entry = batchMap.get(bName)!;
      entry.expense += (row.total - row.labourAmount);
      entry.labourCharge += row.labourAmount;
      entry.total += row.total;
    }

    const list = Array.from(batchMap.values()).sort((a, b) => a.section.localeCompare(b.section));
    const grandLabour = list.reduce((s, x) => s + x.labourCharge, 0);
    const grandExpense = list.reduce((s, x) => s + x.expense, 0);
    const grandTotal = list.reduce((s, x) => s + x.total, 0);

    return { list, grandLabour, grandExpense, grandTotal };
  }, [structuredRows, dynamicLedgerBatches]);

  // Professional Print Output Engine (Vector HTML Table Document)
  const handlePrintProfessionalReport = (targetTab?: 'userwise' | 'storewise' | 'consolidated') => {
    setIsCapturing(true);
    try {
      const isAllOrActiveTab = targetTab || activeTab;

      // 1. Build table headers HTML based on parent/child hierarchy
      let parentHeadersHtml = '';
      let subHeadersHtml = '';

      for (const cat of expenseColumnsHierarchy) {
        parentHeadersHtml += `<th colspan="${cat.children.length}" style="text-align:center;background:#e5e7eb;font-weight:700;border:1px solid #9ca3af;padding:5px 4px;text-transform:uppercase;font-size:10px;color:#111827;">${cat.parentName}</th>`;
        for (const child of cat.children) {
          subHeadersHtml += `<th style="text-align:right;background:#f3f4f6;font-weight:600;border:1px solid #9ca3af;padding:4px 5px;font-size:9.5px;color:#374151;">${child}</th>`;
        }
      }

      // 2. Build rows HTML based on active tab or userwise
      let tableRowsHtml = '';

      if (isAllOrActiveTab === 'userwise') {
        let globalSl = 1;
        for (const group of workerGroupedRows) {
          // Worker group header
          tableRowsHtml += `
            <tr style="background:#eef2ff;font-weight:700;border:1px solid #9ca3af;">
              <td colspan="${7 + allChildExpenseColumns.length + 1}" style="padding:6px 8px;font-size:11px;color:#1e3a8a;border:1px solid #9ca3af;">
                👷 ${group.workerName} ${group.workerEmployeeNo ? `(${group.workerEmployeeNo})` : ''} 
                <span style="font-weight:normal;color:#4b5563;font-size:10px;margin-left:8px;">
                  — ${group.rows.length} Tickets | ${group.uniqueLocationsCount} Locations | Subtotal: KD ${group.totalAmount.toFixed(2)}
                </span>
              </td>
            </tr>
          `;

          for (const row of group.rows) {
            let expCols = '';
            for (const c of allChildExpenseColumns) {
              const val = row.amountsByType[c] || 0;
              expCols += `<td style="text-align:right;padding:4px 5px;border:1px solid #d1d5db;font-size:9.5px;color:${val > 0 ? '#111827' : '#9ca3af'};">${val > 0 ? val.toFixed(2) : '-'}</td>`;
            }

            tableRowsHtml += `
              <tr style="border:1px solid #d1d5db;">
                <td style="text-align:center;padding:4px;border:1px solid #d1d5db;font-size:9.5px;color:#4b5563;">${globalSl++}</td>
                <td style="text-align:center;padding:4px;border:1px solid #d1d5db;font-size:9.5px;font-weight:600;color:#1e40af;">#${row.bundleId}</td>
                <td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9.5px;font-weight:500;">${row.expNo}</td>
                <td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9.5px;font-weight:600;color:#111827;">${row.location}</td>
                <td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9.5px;color:#4b5563;">${row.subDepartment}</td>
                <td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9.5px;color:#111827;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${row.issueTitle}</td>
                <td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9.5px;color:#4b5563;">${row.ledgerBatch}</td>
                ${expCols}
                <td style="text-align:right;padding:4px 6px;border:1px solid #d1d5db;font-size:10px;font-weight:700;color:#065f46;background:#ecfdf5;">KD ${row.total.toFixed(2)}</td>
              </tr>
            `;
          }

          // Worker Subtotal Row
          let subtotalCols = '';
          for (const c of allChildExpenseColumns) {
            const sum = group.subtotalByType[c] || 0;
            subtotalCols += `<td style="text-align:right;padding:4px 5px;border:1px solid #9ca3af;font-size:9.5px;font-weight:700;color:#1f2937;">${sum > 0 ? sum.toFixed(2) : '-'}</td>`;
          }

          tableRowsHtml += `
            <tr style="background:#f3f4f6;font-weight:700;border:1px solid #9ca3af;">
              <td colspan="7" style="text-align:right;padding:5px 8px;font-size:10px;color:#1f2937;border:1px solid #9ca3af;">
                Subtotal (${group.workerName}):
              </td>
              ${subtotalCols}
              <td style="text-align:right;padding:5px 6px;border:1px solid #9ca3af;font-size:10.5px;font-weight:800;color:#065f46;background:#d1fae5;">KD ${group.totalAmount.toFixed(2)}</td>
            </tr>
          `;
        }

        // Grand Total Row
        let grandCols = '';
        for (const c of allChildExpenseColumns) {
          const sum = userwiseGrandTotals.colTotals[c] || 0;
          grandCols += `<td style="text-align:right;padding:6px 5px;border:1.5px solid #374151;font-size:10px;font-weight:800;color:#111827;">${sum.toFixed(2)}</td>`;
        }

        tableRowsHtml += `
          <tr style="background:#e5e7eb;font-weight:800;border:2px solid #111827;">
            <td colspan="7" style="text-align:right;padding:7px 8px;font-size:11px;color:#111827;border:1.5px solid #374151;text-transform:uppercase;letter-spacing:0.5px;">
              GRAND TOTAL (${structuredRows.length} Tickets / ${userwiseGrandTotals.uniqueLocationsCount} Locations):
            </td>
            ${grandCols}
            <td style="text-align:right;padding:7px 6px;border:1.5px solid #374151;font-size:11.5px;font-weight:900;color:#064e3b;background:#a7f3d0;">KD ${userwiseGrandTotals.grandTotal.toFixed(2)}</td>
          </tr>
        `;
      } else if (isAllOrActiveTab === 'storewise') {
        for (const batch of storewiseByBatch) {
          tableRowsHtml += `
            <tr style="background:#e0e7ff;font-weight:700;border:1px solid #9ca3af;">
              <td colspan="${7 + allChildExpenseColumns.length + 1}" style="padding:6px 8px;font-size:11px;color:#1e3a8a;border:1px solid #9ca3af;">
                📦 LEDGER BATCH: ${batch.batchName} 
                <span style="font-weight:normal;color:#4b5563;font-size:10px;margin-left:8px;">
                  — ${batch.rows.length} Tickets | Subtotal: KD ${batch.batchTotal.toFixed(2)}
                </span>
              </td>
            </tr>
          `;

          let sl = 1;
          for (const row of batch.rows) {
            let expCols = '';
            for (const c of allChildExpenseColumns) {
              const val = row.amountsByType[c] || 0;
              expCols += `<td style="text-align:right;padding:4px 5px;border:1px solid #d1d5db;font-size:9.5px;color:${val > 0 ? '#111827' : '#9ca3af'};">${val > 0 ? val.toFixed(2) : '-'}</td>`;
            }

            tableRowsHtml += `
              <tr style="border:1px solid #d1d5db;">
                <td style="text-align:center;padding:4px;border:1px solid #d1d5db;font-size:9.5px;color:#4b5563;">${sl++}</td>
                <td style="text-align:center;padding:4px;border:1px solid #d1d5db;font-size:9.5px;font-weight:600;color:#1e40af;">#${row.bundleId}</td>
                <td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9.5px;font-weight:500;">${row.expNo}</td>
                <td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9.5px;font-weight:600;color:#111827;">${row.location}</td>
                <td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9.5px;color:#4b5563;">${row.subDepartment}</td>
                <td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9.5px;color:#111827;">${row.issueTitle}</td>
                <td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9.5px;color:#4b5563;">${row.ledgerGroup}</td>
                ${expCols}
                <td style="text-align:right;padding:4px 6px;border:1px solid #d1d5db;font-size:10px;font-weight:700;color:#065f46;background:#ecfdf5;">KD ${row.total.toFixed(2)}</td>
              </tr>
            `;
          }

          // Batch Subtotal Row
          let subtotalCols = '';
          for (const c of allChildExpenseColumns) {
            const sum = batch.subtotalByType[c] || 0;
            subtotalCols += `<td style="text-align:right;padding:4px 5px;border:1px solid #9ca3af;font-size:9.5px;font-weight:700;color:#1f2937;">${sum > 0 ? sum.toFixed(2) : '-'}</td>`;
          }

          tableRowsHtml += `
            <tr style="background:#f3f4f6;font-weight:700;border:1px solid #9ca3af;">
              <td colspan="7" style="text-align:right;padding:5px 8px;font-size:10px;color:#1f2937;border:1px solid #9ca3af;">
                Batch Subtotal (${batch.batchName}):
              </td>
              ${subtotalCols}
              <td style="text-align:right;padding:5px 6px;border:1px solid #9ca3af;font-size:10.5px;font-weight:800;color:#065f46;background:#d1fae5;">KD ${batch.batchTotal.toFixed(2)}</td>
            </tr>
          `;
        }

        // Storewise Grand Total
        let grandCols = '';
        for (const c of allChildExpenseColumns) {
          const sum = userwiseGrandTotals.colTotals[c] || 0;
          grandCols += `<td style="text-align:right;padding:6px 5px;border:1.5px solid #374151;font-size:10px;font-weight:800;color:#111827;">${sum.toFixed(2)}</td>`;
        }

        tableRowsHtml += `
          <tr style="background:#e5e7eb;font-weight:800;border:2px solid #111827;">
            <td colspan="7" style="text-align:right;padding:7px 8px;font-size:11px;color:#111827;border:1.5px solid #374151;text-transform:uppercase;">
              GRAND TOTAL (ALL LEDGER BATCHES):
            </td>
            ${grandCols}
            <td style="text-align:right;padding:7px 6px;border:1.5px solid #374151;font-size:11.5px;font-weight:900;color:#064e3b;background:#a7f3d0;">KD ${userwiseGrandTotals.grandTotal.toFixed(2)}</td>
          </tr>
        `;
      } else {
        // Consolidated
        let cSl = 1;
        for (const item of consolidatedBatchData.list) {
          tableRowsHtml += `
            <tr style="border:1px solid #d1d5db;">
              <td style="text-align:center;padding:7px 8px;border:1px solid #d1d5db;font-size:10.5px;color:#4b5563;">${cSl++}</td>
              <td style="padding:7px 12px;border:1px solid #d1d5db;font-size:11px;font-weight:700;color:#111827;">${item.section}</td>
              <td style="text-align:right;padding:7px 12px;border:1px solid #d1d5db;font-size:11px;color:#1f2937;">${item.labourCharge > 0 ? `KD ${item.labourCharge.toFixed(2)}` : '-'}</td>
              <td style="text-align:right;padding:7px 12px;border:1px solid #d1d5db;font-size:11px;color:#1f2937;">KD ${item.expense.toFixed(2)}</td>
              <td style="text-align:right;padding:7px 12px;border:1px solid #d1d5db;font-size:11.5px;font-weight:700;color:#065f46;background:#ecfdf5;">KD ${item.total.toFixed(2)}</td>
            </tr>
          `;
        }
        tableRowsHtml += `
          <tr style="background:#e5e7eb;font-weight:800;border:2px solid #111827;">
            <td colspan="2" style="text-align:right;padding:9px 12px;font-size:12px;color:#111827;border:1.5px solid #374151;text-transform:uppercase;">GRAND TOTAL:</td>
            <td style="text-align:right;padding:9px 12px;border:1.5px solid #374151;font-size:12px;font-weight:800;color:#111827;">${consolidatedBatchData.grandLabour > 0 ? `KD ${consolidatedBatchData.grandLabour.toFixed(2)}` : '-'}</td>
            <td style="text-align:right;padding:9px 12px;border:1.5px solid #374151;font-size:12px;font-weight:800;color:#111827;">KD ${consolidatedBatchData.grandExpense.toFixed(2)}</td>
            <td style="text-align:right;padding:9px 12px;border:1.5px solid #374151;font-size:13px;font-weight:900;color:#064e3b;background:#a7f3d0;">KD ${consolidatedBatchData.grandTotal.toFixed(2)}</td>
          </tr>
        `;
      }

      // 3. Consolidated or main table structure
      const isConsolidated = isAllOrActiveTab === 'consolidated';
      const tableContentHtml = isConsolidated ? `
        <div style="margin-top:16px;">
          <h2 style="font-size:14px;font-weight:700;color:#111827;text-align:center;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">
            Consolidated Financial Settlement Summary
          </h2>
          <table style="width:100%;border-collapse:collapse;background:#fff;border:1.5px solid #374151;">
            <thead>
              <tr style="background:#e5e7eb;border:1.5px solid #374151;">
                <th style="width:50px;text-align:center;padding:8px 8px;border:1px solid #9ca3af;font-size:11px;font-weight:700;color:#111827;">SL</th>
                <th style="text-align:left;padding:8px 12px;border:1px solid #9ca3af;font-size:11px;font-weight:700;color:#111827;">SECTION (LEDGER BATCH)</th>
                <th style="text-align:right;padding:8px 12px;border:1px solid #9ca3af;font-size:11px;font-weight:700;color:#111827;">LABOUR CHARGE</th>
                <th style="text-align:right;padding:8px 12px;border:1px solid #9ca3af;font-size:11px;font-weight:700;color:#111827;">EXPENSE</th>
                <th style="text-align:right;padding:8px 12px;border:1px solid #9ca3af;font-size:11px;font-weight:800;color:#065f46;background:#d1fae5;">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        </div>
      ` : `
        <table style="width:100%;border-collapse:collapse;margin-top:12px;background:#fff;border:1px solid #9ca3af;">
          <thead>
            <tr style="background:#e5e7eb;border:1px solid #9ca3af;">
              <th rowspan="2" style="width:35px;text-align:center;border:1px solid #9ca3af;padding:6px 4px;font-size:10px;font-weight:700;color:#111827;">SL</th>
              <th rowspan="2" style="width:55px;text-align:center;border:1px solid #9ca3af;padding:6px 4px;font-size:10px;font-weight:700;color:#111827;">BUNDLE</th>
              <th rowspan="2" style="width:70px;text-align:left;border:1px solid #9ca3af;padding:6px 5px;font-size:10px;font-weight:700;color:#111827;">EXP NO</th>
              <th rowspan="2" style="width:100px;text-align:left;border:1px solid #9ca3af;padding:6px 5px;font-size:10px;font-weight:700;color:#111827;">LOCATION</th>
              <th rowspan="2" style="width:90px;text-align:left;border:1px solid #9ca3af;padding:6px 5px;font-size:10px;font-weight:700;color:#111827;">SUB DEPT</th>
              <th rowspan="2" style="text-align:left;border:1px solid #9ca3af;padding:6px 6px;font-size:10px;font-weight:700;color:#111827;">ISSUE TITLE</th>
              <th rowspan="2" style="width:85px;text-align:left;border:1px solid #9ca3af;padding:6px 5px;font-size:10px;font-weight:700;color:#111827;">LEDGER BATCH</th>
              ${parentHeadersHtml}
              <th rowspan="2" style="width:75px;text-align:right;border:1px solid #9ca3af;padding:6px 6px;font-size:10.5px;font-weight:800;color:#065f46;background:#d1fae5;">TOTAL</th>
            </tr>
            <tr>
              ${subHeadersHtml}
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      `;

      // 4. Construct Full Printable Document
      const printDoc = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Weekly Expense Settlement Report - ${group.groupName}</title>
            <meta charset="utf-8" />
            <style>
              @page {
                size: landscape;
                margin: 10mm 8mm 10mm 8mm;
              }
              *, *:before, *:after {
                box-sizing: border-box;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                margin: 0;
                padding: 0;
                color: #111827;
                background: #ffffff;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .report-header {
                border-bottom: 2px solid #111827;
                padding-bottom: 10px;
                margin-bottom: 12px;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
              }
              .report-title {
                font-size: 18px;
                font-weight: 800;
                color: #111827;
                letter-spacing: -0.3px;
                text-transform: uppercase;
                margin: 0 0 4px 0;
              }
              .report-subtitle {
                font-size: 11px;
                color: #4b5563;
                margin: 0;
              }
              .meta-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                padding: 8px 12px;
                margin-bottom: 14px;
              }
              .meta-item {
                font-size: 10px;
              }
              .meta-item span {
                color: #6b7280;
                display: block;
                font-weight: 500;
              }
              .meta-item strong {
                color: #111827;
                font-size: 11px;
                font-weight: 700;
              }
              thead {
                display: table-header-group;
              }
              tr {
                page-break-inside: avoid;
              }
              .signatures {
                margin-top: 35px;
                display: flex;
                justify-content: space-between;
                gap: 8px;
                page-break-inside: avoid;
                padding-top: 10px;
              }
              .sign-box {
                flex: 1;
                text-align: center;
                border-top: 1.5px solid #374151;
                padding-top: 6px;
                font-size: 8.5px;
                color: #374151;
              }
              .sign-box strong {
                display: block;
                font-size: 9.5px;
                color: #111827;
                font-weight: 700;
                margin-bottom: 2px;
                text-transform: uppercase;
              }
              .sign-box span {
                display: block;
                font-size: 8px;
                color: #6b7280;
              }
              @media print {
                body {
                  margin: 0;
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <div class="report-header">
              <div>
                <h1 class="report-title">Weekly Expense Settlement Report</h1>
                <p class="report-subtitle">
                  ${isAllOrActiveTab === 'userwise' ? 'Technician / User-Wise Detailed Expense Payout Statement' : (isAllOrActiveTab === 'storewise' ? 'Store & Department Expense Statement by Ledger Batches' : 'Consolidated Ledger Batch Executive Summary')}
                </p>
              </div>
              <div style="text-align:right;">
                <div style="font-size:12px;font-weight:700;color:#111827;">${group.groupName}</div>
                <div style="font-size:10px;color:#6b7280;">Group ID: #${group.groupId} | Date: ${new Date().toLocaleDateString()}</div>
              </div>
            </div>

            <div class="meta-grid">
              <div class="meta-item">
                <span>TOTAL SETTLEMENT</span>
                <strong style="color:#065f46;font-size:12px;">KD ${userwiseGrandTotals.grandTotal.toFixed(2)}</strong>
              </div>
              <div class="meta-item">
                <span>TOTAL TECHNICIANS</span>
                <strong>${workerGroupedRows.length} Workers</strong>
              </div>
              <div class="meta-item">
                <span>LOCATIONS COVERED</span>
                <strong>${userwiseGrandTotals.uniqueLocationsCount} Locations</strong>
              </div>
              <div class="meta-item">
                <span>LEDGER BATCHES</span>
                <strong>${dynamicLedgerBatches.length} Batches (${group.approvedCount}/${group.totalCount} Approved)</strong>
              </div>
            </div>

            ${tableContentHtml}

            <div class="signatures">
              <div class="sign-box">
                <strong>Prepared By</strong>
                <span>${group.createdByName || 'Site Accountant'}</span>
              </div>
              <div class="sign-box">
                <strong>Verify By Engg</strong>
                <span>Project / Site Engineer</span>
              </div>
              <div class="sign-box">
                <strong>Verify By MEngg</strong>
                <span>Maintenance Engineer</span>
              </div>
              <div class="sign-box">
                <strong>Accountant</strong>
                <span>Accounts Dept</span>
              </div>
              <div class="sign-box">
                <strong>Audit</strong>
                <span>Internal Audit</span>
              </div>
              <div class="sign-box">
                <strong>Finance</strong>
                <span>Finance Manager</span>
              </div>
              <div class="sign-box">
                <strong>CEO / GM / Director</strong>
                <span>${group.completedByName || 'Executive Approval'}</span>
              </div>
            </div>
          </body>
        </html>
      `;

      // Use properly sized off-screen iframe so modern browsers render the document layout before printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-10000px';
      iframe.style.top = '0';
      iframe.style.width = '1024px';
      iframe.style.height = '768px';
      iframe.style.border = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const win = iframe.contentWindow;
      if (win) {
        win.document.open();
        win.document.write(printDoc);
        win.document.close();

        const triggerPrint = () => {
          try {
            win.focus();
            win.print();
          } catch (e) {
            console.error('Error invoking print dialog on iframe:', e);
            // Fallback to popup window if iframe print was blocked
            const popup = window.open('', '_blank');
            if (popup) {
              popup.document.open();
              popup.document.write(printDoc);
              popup.document.close();
              setTimeout(() => {
                popup.focus();
                popup.print();
              }, 250);
            }
          } finally {
            win.onafterprint = () => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            };
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 60000);
          }
        };

        if (win.document.readyState === 'complete') {
          setTimeout(triggerPrint, 250);
        } else {
          win.onload = () => setTimeout(triggerPrint, 250);
        }
      }
    } catch (err) {
      console.error('Failed to print professional report:', err);
      window.print();
    } finally {
      setIsCapturing(false);
    }
  };

  // High-Resolution Professional Vector PDF Export via jsPDF & autoTable
  const handleDownloadPdf = async (targetTab?: 'userwise' | 'storewise' | 'consolidated') => {
    setIsCapturing(true);
    try {
      const isTargetTab = targetTab || activeTab;
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageWidth = 297;
      const pageHeight = 210;

      // Header Section
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text('WEEKLY EXPENSE PAYOUT & SETTLEMENT REPORT', 14, 14);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
      doc.text(`Group: ${group.groupName} (ID #${group.groupId})   |   Generated: ${new Date().toLocaleDateString()}   |   Status: ${group.isCompleted ? 'Completed' : 'Pending Approval'}`, 14, 20);

      // Summary Metric Box
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(14, 23, pageWidth - 28, 12, 1.5, 1.5, 'F');
      doc.setFontSize(8.5);
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.text(`Grand Total: KD ${userwiseGrandTotals.grandTotal.toFixed(2)}`, 18, 30.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Technicians: ${workerGroupedRows.length}   |   Locations: ${userwiseGrandTotals.uniqueLocationsCount}   |   Batches: ${dynamicLedgerBatches.length}   |   Tickets: ${structuredRows.length}`, 95, 30.5);

      if (isTargetTab === 'consolidated') {
        const head = [['SL', 'Section (Ledger Batch)', 'Labour Charge', 'Expense', 'Total']];
        const body: any[] = [];
        let cSl = 1;
        for (const item of consolidatedBatchData.list) {
          body.push([
            cSl++,
            item.section,
            item.labourCharge > 0 ? `KD ${item.labourCharge.toFixed(2)}` : '-',
            `KD ${item.expense.toFixed(2)}`,
            `KD ${item.total.toFixed(2)}`
          ]);
        }
        body.push([
          { content: 'GRAND TOTAL', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [229, 231, 235] } },
          { content: consolidatedBatchData.grandLabour > 0 ? `KD ${consolidatedBatchData.grandLabour.toFixed(2)}` : '-', styles: { fontStyle: 'bold', fillColor: [229, 231, 235] } },
          { content: `KD ${consolidatedBatchData.grandExpense.toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [229, 231, 235] } },
          { content: `KD ${consolidatedBatchData.grandTotal.toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [167, 243, 208], textColor: [6, 78, 59] } }
        ]);

        autoTable(doc, {
          startY: 38,
          head,
          body,
          theme: 'grid',
          headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
          bodyStyles: { fontSize: 8.5 },
          columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 100, fontStyle: 'bold' },
            2: { cellWidth: 50, halign: 'right' },
            3: { cellWidth: 50, halign: 'right' },
            4: { cellWidth: 50, halign: 'right', fontStyle: 'bold' }
          }
        });
      } else {
        // Multi-level Header for Userwise or Storewise
        const headerRow1: any[] = [
          { content: 'SL', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'BUNDLE', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          { content: 'EXP NO', rowSpan: 2, styles: { valign: 'middle' } },
          { content: 'LOCATION', rowSpan: 2, styles: { valign: 'middle' } },
          { content: 'SUB DEPT', rowSpan: 2, styles: { valign: 'middle' } },
          { content: 'ISSUE TITLE', rowSpan: 2, styles: { valign: 'middle' } },
          { content: 'BATCH', rowSpan: 2, styles: { valign: 'middle' } }
        ];

        for (const cat of expenseColumnsHierarchy) {
          headerRow1.push({
            content: cat.parentName,
            colSpan: cat.children.length,
            styles: { halign: 'center', fillColor: [229, 231, 235], textColor: [17, 24, 39], fontStyle: 'bold' }
          });
        }

        headerRow1.push({ content: 'TOTAL', rowSpan: 2, styles: { halign: 'right', valign: 'middle', fillColor: [209, 250, 229], textColor: [6, 95, 70] } });

        const headerRow2: any[] = [];
        for (const cat of expenseColumnsHierarchy) {
          for (const child of cat.children) {
            headerRow2.push({ content: child, styles: { halign: 'right', fontSize: 7.5 } });
          }
        }

        const head = [headerRow1, headerRow2];
        const body: any[] = [];

        if (isTargetTab === 'userwise') {
          let globalSl = 1;
          for (const workerGroup of workerGroupedRows) {
            body.push([
              {
                content: `Worker: ${workerGroup.workerName} (${workerGroup.rows.length} Tickets, ${workerGroup.uniqueLocationsCount} Locations) - Subtotal: KD ${workerGroup.totalAmount.toFixed(2)}`,
                colSpan: 7 + allChildExpenseColumns.length + 1,
                styles: { fillColor: [238, 242, 255], fontStyle: 'bold', textColor: [30, 58, 138] }
              }
            ]);

            for (const row of workerGroup.rows) {
              const rowData: any[] = [
                globalSl++,
                `#${row.bundleId}`,
                row.expNo,
                row.location,
                row.subDepartment,
                row.issueTitle,
                row.ledgerBatch
              ];
              for (const c of allChildExpenseColumns) {
                const val = row.amountsByType[c] || 0;
                rowData.push(val > 0 ? val.toFixed(2) : '-');
              }
              rowData.push(`KD ${row.total.toFixed(2)}`);
              body.push(rowData);
            }

            // Subtotal row
            const subtotalRow: any[] = [
              { content: `Subtotal (${workerGroup.workerName}):`, colSpan: 7, styles: { halign: 'right', fontStyle: 'bold', fillColor: [243, 244, 246] } }
            ];
            for (const c of allChildExpenseColumns) {
              const sum = workerGroup.subtotalByType[c] || 0;
              subtotalRow.push({ content: sum > 0 ? sum.toFixed(2) : '-', styles: { halign: 'right', fontStyle: 'bold', fillColor: [243, 244, 246] } });
            }
            subtotalRow.push({ content: `KD ${workerGroup.totalAmount.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [209, 250, 229], textColor: [6, 95, 70] } });
            body.push(subtotalRow);
          }
        } else {
          // Storewise
          for (const batch of storewiseByBatch) {
            body.push([
              {
                content: `Ledger Batch: ${batch.batchName} (${batch.rows.length} Tickets) - Subtotal: KD ${batch.batchTotal.toFixed(2)}`,
                colSpan: 7 + allChildExpenseColumns.length + 1,
                styles: { fillColor: [224, 231, 255], fontStyle: 'bold', textColor: [30, 58, 138] }
              }
            ]);

            let sl = 1;
            for (const row of batch.rows) {
              const rowData: any[] = [
                sl++,
                `#${row.bundleId}`,
                row.expNo,
                row.location,
                row.subDepartment,
                row.issueTitle,
                row.ledgerGroup
              ];
              for (const c of allChildExpenseColumns) {
                const val = row.amountsByType[c] || 0;
                rowData.push(val > 0 ? val.toFixed(2) : '-');
              }
              rowData.push(`KD ${row.total.toFixed(2)}`);
              body.push(rowData);
            }

            const subtotalRow: any[] = [
              { content: `Batch Subtotal (${batch.batchName}):`, colSpan: 7, styles: { halign: 'right', fontStyle: 'bold', fillColor: [243, 244, 246] } }
            ];
            for (const c of allChildExpenseColumns) {
              const sum = batch.subtotalByType[c] || 0;
              subtotalRow.push({ content: sum > 0 ? sum.toFixed(2) : '-', styles: { halign: 'right', fontStyle: 'bold', fillColor: [243, 244, 246] } });
            }
            subtotalRow.push({ content: `KD ${batch.batchTotal.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [209, 250, 229], textColor: [6, 95, 70] } });
            body.push(subtotalRow);
          }
        }

        // Grand Total Row
        const grandTotalRow: any[] = [
          { content: 'GRAND TOTAL:', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold', fillColor: [229, 231, 235] } }
        ];
        for (const c of allChildExpenseColumns) {
          const sum = userwiseGrandTotals.colTotals[c] || 0;
          grandTotalRow.push({ content: sum.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [229, 231, 235] } });
        }
        grandTotalRow.push({ content: `KD ${userwiseGrandTotals.grandTotal.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [167, 243, 208], textColor: [6, 78, 59] } });
        body.push(grandTotalRow);

        autoTable(doc, {
          startY: 38,
          head,
          body,
          theme: 'grid',
          headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
          bodyStyles: { fontSize: 7, cellPadding: 1.5 },
          margin: { left: 10, right: 10 }
        });
      }

      // Add 7-Tier Signature Section to PDF
      const signHead = [['Prepared By', 'Verify By Engg', 'Verify By MEngg', 'Accountant', 'Audit', 'Finance', 'CEO / GM / Director']];
      const signBody = [
        [
          `\n\n\n___________________\n${group.createdByName || 'Site Accountant'}`,
          '\n\n\n___________________\nProject Engineer',
          '\n\n\n___________________\nMaintenance Engineer',
          '\n\n\n___________________\nAccounts Dept',
          '\n\n\n___________________\nInternal Audit',
          '\n\n\n___________________\nFinance Manager',
          `\n\n\n___________________\n${group.completedByName || 'Executive Approval'}`
        ]
      ];

      autoTable(doc, {
        startY: (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 12 : undefined,
        head: signHead,
        body: signBody,
        theme: 'plain',
        headStyles: { fontStyle: 'bold', fontSize: 7.5, halign: 'center', textColor: [17, 24, 39], fillColor: [243, 244, 246] },
        bodyStyles: { fontSize: 6.5, halign: 'center', textColor: [75, 85, 99] },
        margin: { left: 10, right: 10 },
        pageBreak: 'avoid'
      });

      // Add page numbering footer
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(`Page ${i} of ${totalPages}   |   ${group.groupName} Settlement Report`, 14, pageHeight - 6);
      }

      const fileName = `Weekly_Expense_Report_${group.groupName.replace(/\s+/g, '_')}_${isTargetTab}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('Failed to export vector PDF:', err);
      alert('Failed to generate PDF. Please check console.');
    } finally {
      setIsCapturing(false);
    }
  };

  // Export Multi-Sheet Excel matching weekly.xlsx dynamically
  const handleExportMultiSheetExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // ==========================================
      // SHEET 1: Weekly Expance Payout Report userwise
      // ==========================================
      const s1HeaderRow1: any[] = ['Worker', 'SLNo', 'BUNDLE ID', 'EXP NO', 'LOCATION', 'SUB DEPARTMENT', 'ISSUE TITLE', 'Ledger Group'];
      const s1HeaderRow2: any[] = ['', '', '', '', '', '', '', ''];
      const s1Merges: XLSX.Range[] = [
        { s: { r: 0, c: 6 }, e: { r: 0, c: 6 + allChildExpenseColumns.length } },
        { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } },
        { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } },
        { s: { r: 2, c: 2 }, e: { r: 3, c: 2 } },
        { s: { r: 2, c: 3 }, e: { r: 3, c: 3 } },
        { s: { r: 2, c: 4 }, e: { r: 3, c: 4 } },
        { s: { r: 2, c: 5 }, e: { r: 3, c: 5 } },
        { s: { r: 2, c: 6 }, e: { r: 3, c: 6 } },
        { s: { r: 2, c: 7 }, e: { r: 3, c: 7 } },
      ];

      let colIdx = 8;
      for (const cat of expenseColumnsHierarchy) {
        const startC = colIdx;
        const endC = colIdx + cat.children.length - 1;
        s1HeaderRow1.push(cat.parentName);
        for (let i = 1; i < cat.children.length; i++) {
          s1HeaderRow1.push('');
        }
        for (const child of cat.children) {
          s1HeaderRow2.push(child);
        }
        if (endC > startC) {
          s1Merges.push({ s: { r: 2, c: startC }, e: { r: 2, c: endC } });
        }
        colIdx += cat.children.length;
      }
      s1HeaderRow1.push('TOTAL');
      s1HeaderRow2.push('');
      s1Merges.push({ s: { r: 2, c: colIdx }, e: { r: 3, c: colIdx } });

      const s1Data: any[][] = [
        ['report for maintenances', '', '', '', '', '', 'Weekly Expance Payout Report userwise'],
        [],
        s1HeaderRow1,
        s1HeaderRow2
      ];

      let currentSheet1Row = 4;
      let globalSlNo = 1;

      for (const wGroup of workerGroupedRows) {
        const startWorkerRow = currentSheet1Row;
        wGroup.rows.forEach((row, rIdx) => {
          const rowData: any[] = [
            rIdx === 0 ? wGroup.workerName : '',
            globalSlNo++,
            row.bundleId,
            row.expNo,
            row.location,
            row.subDepartment,
            row.issueTitle,
            row.ledgerBatch
          ];

          for (const colName of allChildExpenseColumns) {
            const amt = row.amountsByType[colName];
            rowData.push(amt !== undefined && amt > 0 ? Number(amt.toFixed(2)) : '-');
          }
          rowData.push(Number(row.total.toFixed(2)));
          s1Data.push(rowData);
          currentSheet1Row++;
        });

        if (wGroup.rows.length > 1) {
          s1Merges.push({ s: { r: startWorkerRow, c: 0 }, e: { r: currentSheet1Row - 1, c: 0 } });
        }

        // Worker Subtotal Row
        const subtotalRow: any[] = [
          '',
          '',
          '',
          '',
          `${wGroup.uniqueLocationsCount} Locations`,
          '',
          '',
          ''
        ];
        for (const colName of allChildExpenseColumns) {
          const sAmt = wGroup.subtotalByType[colName] || 0;
          subtotalRow.push(sAmt > 0 ? Number(sAmt.toFixed(2)) : '-');
        }
        subtotalRow.push(Number(wGroup.totalAmount.toFixed(2)));
        s1Data.push(subtotalRow);
        currentSheet1Row++;
      }

      // Grand Total Row
      const grandTotalRow: any[] = [
        'GRAND TOTAL',
        '',
        '',
        '',
        `${userwiseGrandTotals.uniqueLocationsCount} Locations`,
        '',
        '',
        ''
      ];
      for (const colName of allChildExpenseColumns) {
        const gAmt = userwiseGrandTotals.colTotals[colName] || 0;
        grandTotalRow.push(gAmt > 0 ? Number(gAmt.toFixed(2)) : '-');
      }
      grandTotalRow.push(Number(userwiseGrandTotals.grandTotal.toFixed(2)));
      s1Data.push(grandTotalRow);

      // Signatures row for Sheet 1
      s1Data.push([]);
      s1Data.push(['SIGNATURES & APPROVALS:']);
      s1Data.push(['Prepared By', 'Verify By Engg', 'Verify By MEngg', 'Accountant', 'Audit', 'Finance', 'CEO / GM / Director']);
      s1Data.push([group.createdByName || 'Site Accountant', 'Project Engineer', 'Maintenance Engineer', 'Accounts Dept', 'Internal Audit', 'Finance Manager', group.completedByName || 'Executive Management']);

      const ws1 = XLSX.utils.aoa_to_sheet(s1Data);
      ws1['!merges'] = s1Merges;
      ws1['!cols'] = [
        { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 12 },
        { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 22 },
        ...allChildExpenseColumns.map(() => ({ wch: 14 })),
        { wch: 14 }
      ];
      XLSX.utils.book_append_sheet(wb, ws1, 'Userwise Payout');

      // =========================================================
      // SHEETS 2, 3, 4...: DYNAMIC LEDGER BATCHES (Store-wise)
      // e.g. Civil, Carpentry & Painting, Electrical & Plumbing, etc.
      // =========================================================
      const batchesToExport = dynamicLedgerBatches.length > 0 ? dynamicLedgerBatches : ['General Maintenance'];

      batchesToExport.forEach((batchName) => {
        const batchRows = structuredRows.filter(r => r.ledgerBatch === batchName);
        const cleanSheetTitle = batchName.slice(0, 31).replace(/[:\\\/\?\*\[\]]/g, '_');
        const sHeaderRow1: any[] = ['SLNO', 'BUNDLE ID', 'EXP NO', 'LOCATION', 'SUB DEPARTMENT', 'Issue Title(Consolidation)', 'Ledger Group'];
        const sHeaderRow2: any[] = ['', '', '', '', '', '', ''];
        const sMerges: XLSX.Range[] = [
          { s: { r: 1, c: 3 }, e: { r: 1, c: 6 } },
          { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
          { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
          { s: { r: 3, c: 2 }, e: { r: 4, c: 2 } },
          { s: { r: 3, c: 3 }, e: { r: 4, c: 3 } },
          { s: { r: 3, c: 4 }, e: { r: 4, c: 4 } },
          { s: { r: 3, c: 5 }, e: { r: 4, c: 5 } },
          { s: { r: 3, c: 6 }, e: { r: 4, c: 6 } },
        ];

        let sColIdx = 7;
        for (const cat of expenseColumnsHierarchy) {
          const startC = sColIdx;
          const endC = sColIdx + cat.children.length - 1;
          sHeaderRow1.push(cat.parentName);
          for (let i = 1; i < cat.children.length; i++) {
            sHeaderRow1.push('');
          }
          for (const child of cat.children) {
            sHeaderRow2.push(child);
          }
          if (endC > startC) {
            sMerges.push({ s: { r: 3, c: startC }, e: { r: 3, c: endC } });
          }
          sColIdx += cat.children.length;
        }
        sHeaderRow1.push('TOTAL');
        sHeaderRow2.push('');
        sMerges.push({ s: { r: 3, c: sColIdx }, e: { r: 4, c: sColIdx } });

        const sData: any[][] = [
          [],
          ['', '', '', batchName],
          [],
          sHeaderRow1,
          sHeaderRow2
        ];

        const batchColTotals: Record<string, number> = {};
        let batchTotalAmt = 0;

        batchRows.forEach((row, idx) => {
          batchTotalAmt += row.total;
          const rowData: any[] = [
            idx + 1,
            row.bundleId,
            row.expNo,
            row.location,
            row.subDepartment,
            row.issueTitle,
            row.ledgerBatch
          ];
          for (const colName of allChildExpenseColumns) {
            const amt = row.amountsByType[colName] || 0;
            batchColTotals[colName] = (batchColTotals[colName] || 0) + amt;
            rowData.push(amt > 0 ? Number(amt.toFixed(2)) : '-');
          }
          rowData.push(Number(row.total.toFixed(2)));
          sData.push(rowData);
        });

        const totalRow: any[] = ['', '', '', 'Total', '', '', ''];
        for (const colName of allChildExpenseColumns) {
          const cAmt = batchColTotals[colName] || 0;
          totalRow.push(cAmt > 0 ? Number(cAmt.toFixed(2)) : '-');
        }
        totalRow.push(Number(batchTotalAmt.toFixed(2)));
        sData.push(totalRow);

        // Signatures row for Batch Sheet
        sData.push([]);
        sData.push(['SIGNATURES & APPROVALS:']);
        sData.push(['Prepared By', 'Verify By Engg', 'Verify By MEngg', 'Accountant', 'Audit', 'Finance', 'CEO / GM / Director']);
        sData.push([group.createdByName || 'Site Accountant', 'Project Engineer', 'Maintenance Engineer', 'Accounts Dept', 'Internal Audit', 'Finance Manager', group.completedByName || 'Executive Management']);

        const wsBatch = XLSX.utils.aoa_to_sheet(sData);
        wsBatch['!merges'] = sMerges;
        wsBatch['!cols'] = [
          { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 18 },
          { wch: 18 }, { wch: 24 }, { wch: 22 },
          ...allChildExpenseColumns.map(() => ({ wch: 14 })),
          { wch: 14 }
        ];
        XLSX.utils.book_append_sheet(wb, wsBatch, cleanSheetTitle);
      });

      // ==========================================
      // LAST SHEET: Consolidated Report (Sheet 5)
      // ==========================================
      const s5Data: any[][] = [
        ['', 'Consolidated Report'],
        ['Section', 'Labour Charge', 'Expense', 'Total']
      ];

      for (const item of consolidatedBatchData.list) {
        s5Data.push([
          item.section,
          Number(item.labourCharge.toFixed(2)),
          Number(item.expense.toFixed(2)),
          Number(item.total.toFixed(2))
        ]);
      }

      s5Data.push([
        'GRAND TOTAL',
        Number(consolidatedBatchData.grandLabour.toFixed(2)),
        Number(consolidatedBatchData.grandExpense.toFixed(2)),
        Number(consolidatedBatchData.grandTotal.toFixed(2))
      ]);

      // Signatures row for Consolidated Sheet
      s5Data.push([]);
      s5Data.push(['SIGNATURES & APPROVALS:']);
      s5Data.push(['Prepared By', 'Verify By Engg', 'Verify By MEngg', 'Accountant', 'Audit', 'Finance', 'CEO / GM / Director']);
      s5Data.push([group.createdByName || 'Site Accountant', 'Project Engineer', 'Maintenance Engineer', 'Accounts Dept', 'Internal Audit', 'Finance Manager', group.completedByName || 'Executive Management']);

      const ws5 = XLSX.utils.aoa_to_sheet(s5Data);
      ws5['!merges'] = [{ s: { r: 0, c: 1 }, e: { r: 0, c: 3 } }];
      ws5['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws5, 'Consolidated Report');

      const fileName = `Weekly_Expense_Payout_Report_${group.groupName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Failed to export Excel report:', err);
      alert('Failed to generate Excel report. Please check console.');
    }
  };

  // Copy Summary to Clipboard
  const handleCopySummary = () => {
    const lines = [
      `======================================================`,
      `WEEKLY EXPENSE PAYOUT REPORT: ${group.groupName}`,
      `Group ID: ${group.groupId}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      `Total Settlement Amount: KD ${group.totalAmount.toFixed(2)}`,
      `Total Ledger Batches: ${dynamicLedgerBatches.length}`,
      `Total Technicians: ${workerGroupedRows.length} | Total Locations: ${userwiseGrandTotals.uniqueLocationsCount}`,
      `======================================================`,
      ``,
      `--- USER-WISE PAYOUT BREAKDOWN ---`,
      ...workerGroupedRows.map(w => `• ${w.workerName} (${w.rows.length} tickets, ${w.uniqueLocationsCount} locations): KD ${w.totalAmount.toFixed(2)}`),
      ``,
      `--- DYNAMIC LEDGER BATCHES SUMMARY ---`,
      ...consolidatedBatchData.list.map(s => `• ${s.section}: Labour KD ${s.labourCharge.toFixed(2)} + Exp KD ${s.expense.toFixed(2)} = Total KD ${s.total.toFixed(2)}`),
      ``,
      `GRAND TOTAL: KD ${consolidatedBatchData.grandTotal.toFixed(2)}`,
      `======================================================`
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-surface-container border border-outline-variant rounded max-w-6xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:border-0 print:p-0">

        {/* MODAL HEADER */}
        <div className="px-5 py-3.5 border-b border-outline-variant bg-surface-container-low flex items-center justify-between flex-wrap gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Weekly Settlement Report
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
              className="px-3 py-1.5 rounded border border-outline text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Copy summary to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-on-surface-variant" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              onClick={handleExportMultiSheetExcel}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs hover:shadow cursor-pointer"
              title="Download exact multi-sheet weekly.xlsx Excel file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel (.xlsx)</span>
            </button>

            <button
              disabled={isCapturing}
              onClick={() => handleDownloadPdf()}
              className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs hover:shadow cursor-pointer disabled:opacity-50"
              title="Download professional vector PDF report"
            >
              {isCapturing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              <span>PDF</span>
            </button>

            <button
              disabled={isCapturing}
              onClick={() => handlePrintProfessionalReport()}
              className="px-3.5 py-1.5 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              title="Print professional formatted tabular report"
            >
              {isCapturing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-surface scrollbar-thin">

          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded bg-surface-container border border-outline-variant shadow-2xs">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-[11px] font-medium">Grand Settlement Total</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                KD {userwiseGrandTotals.grandTotal.toFixed(2)}
              </div>
              <span className="text-[10px] text-on-surface-variant mt-0.5 block font-medium">
                {structuredRows.length} itemized ticket entries
              </span>
            </div>

            <div className="p-3.5 rounded bg-surface-container border border-outline-variant shadow-2xs">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-[11px] font-medium">Locations Covered</span>
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div className="text-xl font-bold text-primary mt-1">
                {userwiseGrandTotals.uniqueLocationsCount} Locations
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block font-medium">
                Across {dynamicLedgerBatches.length} ledger batches
              </span>
            </div>

            <div className="p-3.5 rounded bg-surface-container border border-outline-variant shadow-2xs">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-[11px] font-medium">Technicians Payout</span>
                <User className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-xl font-bold text-on-surface mt-1">
                {workerGroupedRows.length} Technicians
              </div>
              <span className="text-[10px] text-on-surface-variant mt-0.5 block">
                {group.totalBundlesCount} worker claims
              </span>
            </div>

            <div className="p-3.5 rounded bg-surface-container border border-outline-variant shadow-2xs">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-[11px] font-medium">Ledger Batches</span>
                <Boxes className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-bold text-on-surface mt-1">
                {dynamicLedgerBatches.length} Batches
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                All Batches Approved
              </span>
            </div>
          </div>

          {/* REPORT VIEW TABS */}
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-outline-variant pb-2">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('userwise')}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'userwise'
                  ? 'bg-primary text-on-primary shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Weekly Expance Payout Report userwise (Sheet 1)</span>
              </button>

              <button
                onClick={() => setActiveTab('storewise')}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'storewise'
                  ? 'bg-primary text-on-primary shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Ledger Batch Reports (Sheets 2, 3, 4)</span>
              </button>

              <button
                onClick={() => setActiveTab('consolidated')}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'consolidated'
                  ? 'bg-primary text-on-primary shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Consolidated Summary (Sheet 5)</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-64 print:hidden">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search ticket, store, worker..."
                className="w-full pl-8 pr-3 py-1.5 rounded border border-outline bg-surface-container text-xs text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* HTML2CANVAS CAPTURE CONTAINER */}
          <div ref={printAreaRef} className="space-y-4 bg-surface p-1">

            {/* ========================================== */}
            {/* TAB 1: WEEKLY EXPENSE PAYOUT REPORT USERWISE */}
            {/* ========================================== */}
            {activeTab === 'userwise' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-primary/10 border border-primary/25 rounded px-4 py-2.5 text-xs text-primary font-bold">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Weekly Expance Payout Report userwise
                  </span>
                  <span className="text-[11px] font-normal text-on-surface-variant">
                    Multi-level category hierarchy: Parent & Sub-expense types
                  </span>
                </div>

                <div className="border border-outline-variant rounded overflow-x-auto bg-surface-container shadow-2xs">
                  <table className="w-full text-xs text-left text-on-surface border-collapse">
                    <thead className="bg-surface-container-high text-on-surface-variant text-[11px] font-bold border-b-2 border-outline-variant sticky top-0 z-10">
                      <tr>
                        <th rowSpan={2} className="px-3 py-2.5 border-r border-outline-variant text-center bg-surface-container-low font-bold">Worker</th>
                        <th rowSpan={2} className="px-2.5 py-2.5 border-r border-outline-variant text-center">SLNo</th>
                        <th rowSpan={2} className="px-3 py-2.5 border-r border-outline-variant text-center">BUNDLE ID</th>
                        <th rowSpan={2} className="px-3 py-2.5 border-r border-outline-variant">EXP NO</th>
                        <th rowSpan={2} className="px-3 py-2.5 border-r border-outline-variant">LOCATION</th>
                        <th rowSpan={2} className="px-3 py-2.5 border-r border-outline-variant">SUB DEPARTMENT</th>
                        <th rowSpan={2} className="px-4 py-2.5 border-r border-outline-variant">ISSUE TITLE</th>
                        <th rowSpan={2} className="px-3 py-2.5 border-r border-outline-variant">Ledger Group</th>

                        {/* Parent Expense Categories */}
                        {expenseColumnsHierarchy.map(cat => (
                          <th
                            key={cat.parentName}
                            colSpan={cat.children.length}
                            className="px-3 py-1.5 text-center border-r border-outline-variant bg-surface-container-lowest font-bold text-primary dark:text-primary-container uppercase tracking-wider text-[10px]"
                          >
                            {cat.parentName}
                          </th>
                        ))}

                        <th rowSpan={2} className="px-3.5 py-2.5 text-right font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                          TOTAL
                        </th>
                      </tr>

                      {/* Sub Expense Types */}
                      <tr>
                        {expenseColumnsHierarchy.map(cat => (
                          cat.children.map(child => (
                            <th
                              key={`${cat.parentName}_${child}`}
                              className="px-2.5 py-1.5 text-right border-r border-outline-variant bg-surface-container-low font-medium text-[10px] text-on-surface-variant whitespace-nowrap"
                            >
                              {child}
                            </th>
                          ))
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-outline-variant/60 text-xs">
                      {workerGroupedRows.length === 0 ? (
                        <tr>
                          <td colSpan={9 + allChildExpenseColumns.length} className="p-8 text-center text-on-surface-variant">
                            No expenses found matching the current criteria.
                          </td>
                        </tr>
                      ) : (
                        workerGroupedRows.map((wGroup, wIdx) => (
                          <React.Fragment key={wGroup.workerId || wIdx}>
                            {wGroup.rows.map((row, rIdx) => (
                              <tr key={row.uniqueKey || rIdx} className="hover:bg-surface-container-high/40 transition-colors">
                                {rIdx === 0 && (
                                  <td
                                    rowSpan={wGroup.rows.length}
                                    className="px-3 py-2.5 font-bold text-on-surface border-r border-outline-variant bg-surface-container-lowest align-top"
                                  >
                                    <div className="sticky top-12 space-y-0.5">
                                      <span className="font-semibold text-primary">{wGroup.workerName}</span>
                                      {wGroup.workerEmployeeNo && (
                                        <span className="block text-[10px] font-mono text-on-surface-variant">{wGroup.workerEmployeeNo}</span>
                                      )}
                                    </div>
                                  </td>
                                )}
                                <td className="px-2.5 py-2 border-r border-outline-variant text-center font-mono text-on-surface-variant text-[11px]">
                                  {rIdx + 1}
                                </td>
                                <td className="px-3 py-2 border-r border-outline-variant text-center font-mono text-primary font-semibold text-[11px]">
                                  #{row.bundleId}
                                </td>
                                <td className="px-3 py-2 border-r border-outline-variant font-mono font-medium text-[11px]">
                                  {row.ticketObj && setSelectedTicketForModal ? (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedTicketForModal(row.ticketObj)}
                                      className="text-primary hover:underline cursor-pointer font-bold"
                                    >
                                      {row.expNo}
                                    </button>
                                  ) : (
                                    <span>{row.expNo}</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 border-r border-outline-variant font-medium text-on-surface">
                                  {row.location}
                                </td>
                                <td className="px-3 py-2 border-r border-outline-variant text-on-surface-variant text-[11px]">
                                  {row.subDepartment}
                                </td>
                                <td className="px-4 py-2 border-r border-outline-variant font-normal text-on-surface truncate max-w-xs" title={row.issueTitle}>
                                  {row.issueTitle}
                                </td>
                                <td className="px-3 py-2 border-r border-outline-variant text-on-surface-variant text-[11px]">
                                  <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-[10px] border border-outline-variant/60 font-medium">
                                    {row.ledgerBatch}
                                  </span>
                                </td>

                                {allChildExpenseColumns.map(colName => {
                                  const amt = row.amountsByType[colName];
                                  return (
                                    <td
                                      key={colName}
                                      className="px-2.5 py-2 text-right border-r border-outline-variant font-mono text-[11px] text-on-surface"
                                    >
                                      {amt !== undefined && amt > 0 ? (
                                        <span className="font-semibold">{amt.toFixed(2)}</span>
                                      ) : (
                                        <span className="text-on-surface-variant/40">-</span>
                                      )}
                                    </td>
                                  );
                                })}

                                <td className="px-3.5 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[11px] bg-emerald-500/5">
                                  {row.total.toFixed(2)}
                                </td>
                              </tr>
                            ))}

                            {/* Worker Subtotal Row */}
                            <tr className="bg-surface-container-high/70 font-semibold border-b-2 border-outline-variant text-[11px]">
                              <td colSpan={4} className="px-3 py-2 border-r border-outline-variant text-right text-on-surface-variant font-bold">
                                Subtotal
                              </td>
                              <td className="px-3 py-2 border-r border-outline-variant font-bold text-primary">
                                {wGroup.uniqueLocationsCount} Locations
                              </td>
                              <td colSpan={3} className="px-3 py-2 border-r border-outline-variant"></td>

                              {allChildExpenseColumns.map(colName => {
                                const sAmt = wGroup.subtotalByType[colName] || 0;
                                return (
                                  <td
                                    key={`subtotal_${colName}`}
                                    className="px-2.5 py-2 text-right border-r border-outline-variant font-bold font-mono text-on-surface"
                                  >
                                    {sAmt > 0 ? sAmt.toFixed(2) : '-'}
                                  </td>
                                );
                              })}

                              <td className="px-3.5 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-500/10">
                                {wGroup.totalAmount.toFixed(2)}
                              </td>
                            </tr>
                          </React.Fragment>
                        ))
                      )}
                    </tbody>

                    {/* TFOOT: GRAND TOTAL ROW */}
                    <tfoot className="bg-surface-container-high font-bold border-t-2 border-outline-variant text-xs sticky bottom-0 z-10 shadow-lg">
                      <tr className="border-t border-outline-variant">
                        <td colSpan={4} className="px-4 py-3 text-on-surface font-extrabold uppercase tracking-wider">
                          GRAND TOTAL
                        </td>
                        <td className="px-3 py-3 border-r border-outline-variant font-extrabold text-primary">
                          {userwiseGrandTotals.uniqueLocationsCount} Locations
                        </td>
                        <td colSpan={3} className="px-3 py-3 border-r border-outline-variant"></td>

                        {allChildExpenseColumns.map(colName => {
                          const gAmt = userwiseGrandTotals.colTotals[colName] || 0;
                          return (
                            <td
                              key={`grand_${colName}`}
                              className="px-2.5 py-3 text-right border-r border-outline-variant font-extrabold font-mono text-on-surface"
                            >
                              {gAmt > 0 ? gAmt.toFixed(2) : '-'}
                            </td>
                          );
                        })}

                        <td className="px-3.5 py-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-sm bg-emerald-500/15">
                          KD {userwiseGrandTotals.grandTotal.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: STORE-WISE / DYNAMIC LEDGER BATCH REPORTS (Sheets 2,3,4) */}
            {/* ============================================================== */}
            {activeTab === 'storewise' && (
              <div className="space-y-4">
                {/* Dynamic Ledger Batch Selector Pills */}
                <div className="flex items-center justify-between flex-wrap gap-2.5 bg-surface-container p-2.5 rounded border border-outline-variant print:hidden">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-on-surface-variant mr-1 flex items-center gap-1">
                      <Boxes className="w-3.5 h-3.5 text-primary" />
                      Ledger Batch:
                    </span>
                    <button
                      onClick={() => setSelectedBatchFilter('all')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${selectedBatchFilter === 'all'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                        }`}
                    >
                      All Batches ({structuredRows.length})
                    </button>
                    {dynamicLedgerBatches.map(bName => {
                      const count = structuredRows.filter(r => r.ledgerBatch === bName).length;
                      return (
                        <button
                          key={bName}
                          onClick={() => setSelectedBatchFilter(bName)}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${selectedBatchFilter === bName
                            ? 'bg-primary text-on-primary shadow-xs'
                            : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                          {bName} ({count})
                        </button>
                      );
                    })}
                  </div>

                  <span className="text-xs text-on-surface-variant font-medium">
                    Showing {storewiseFilteredRows.length} entries
                  </span>
                </div>

                {/* Title Banner */}
                <div className="bg-surface-container-low border border-outline-variant rounded p-3 text-center">
                  <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">
                    {selectedBatchFilter === 'all' ? 'All Ledger Batches' : selectedBatchFilter}
                  </h3>
                </div>

                {/* Table with Multi-Level Headers */}
                <div className="border border-outline-variant rounded overflow-x-auto bg-surface-container shadow-2xs">
                  <table className="w-full text-xs text-left text-on-surface border-collapse">
                    <thead className="bg-surface-container-high text-on-surface-variant text-[11px] font-bold border-b-2 border-outline-variant sticky top-0 z-10">
                      <tr>
                        <th rowSpan={2} className="px-2.5 py-2.5 border-r border-outline-variant text-center">SLNO</th>
                        <th rowSpan={2} className="px-3 py-2.5 border-r border-outline-variant text-center">BUNDLE ID</th>
                        <th rowSpan={2} className="px-3 py-2.5 border-r border-outline-variant">EXP NO</th>
                        <th rowSpan={2} className="px-3 py-2.5 border-r border-outline-variant">LOCATION</th>
                        <th rowSpan={2} className="px-3 py-2.5 border-r border-outline-variant">SUB DEPARTMENT</th>
                        <th rowSpan={2} className="px-4 py-2.5 border-r border-outline-variant">Issue Title (Consolidation)</th>
                        <th rowSpan={2} className="px-3 py-2.5 border-r border-outline-variant">Ledger Group</th>

                        {/* Parent Expense Categories */}
                        {expenseColumnsHierarchy.map(cat => (
                          <th
                            key={cat.parentName}
                            colSpan={cat.children.length}
                            className="px-3 py-1.5 text-center border-r border-outline-variant bg-surface-container-lowest font-bold text-primary uppercase tracking-wider text-[10px]"
                          >
                            {cat.parentName}
                          </th>
                        ))}

                        <th rowSpan={2} className="px-3.5 py-2.5 text-right font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                          TOTAL
                        </th>
                      </tr>

                      <tr>
                        {expenseColumnsHierarchy.map(cat => (
                          cat.children.map(child => (
                            <th
                              key={`${cat.parentName}_${child}`}
                              className="px-2.5 py-1.5 text-right border-r border-outline-variant bg-surface-container-low font-medium text-[10px] text-on-surface-variant whitespace-nowrap"
                            >
                              {child}
                            </th>
                          ))
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-outline-variant/60 text-xs">
                      {storewiseFilteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={8 + allChildExpenseColumns.length} className="p-8 text-center text-on-surface-variant">
                            No records found for the selected ledger batch.
                          </td>
                        </tr>
                      ) : (
                        storewiseFilteredRows.map((row, idx) => (
                          <tr key={row.uniqueKey || idx} className="hover:bg-surface-container-high/40 transition-colors">
                            <td className="px-2.5 py-2 border-r border-outline-variant text-center font-mono text-on-surface-variant text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2 border-r border-outline-variant text-center font-mono text-primary font-semibold text-[11px]">
                              #{row.bundleId}
                            </td>
                            <td className="px-3 py-2 border-r border-outline-variant font-mono font-medium text-[11px]">
                              {row.ticketObj && setSelectedTicketForModal ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedTicketForModal(row.ticketObj)}
                                  className="text-primary hover:underline cursor-pointer font-bold"
                                >
                                  {row.expNo}
                                </button>
                              ) : (
                                <span>{row.expNo}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 border-r border-outline-variant font-medium text-on-surface">
                              {row.location}
                            </td>
                            <td className="px-3 py-2 border-r border-outline-variant text-on-surface-variant text-[11px]">
                              {row.subDepartment}
                            </td>
                            <td className="px-4 py-2 border-r border-outline-variant font-normal text-on-surface truncate max-w-xs" title={row.issueTitle}>
                              {row.issueTitle}
                            </td>
                            <td className="px-3 py-2 border-r border-outline-variant text-on-surface-variant text-[11px]">
                              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-[10px] border border-outline-variant/60 font-medium">
                                {row.ledgerBatch}
                              </span>
                            </td>

                            {allChildExpenseColumns.map(colName => {
                              const amt = row.amountsByType[colName];
                              return (
                                <td
                                  key={colName}
                                  className="px-2.5 py-2 text-right border-r border-outline-variant font-mono text-[11px] text-on-surface"
                                >
                                  {amt !== undefined && amt > 0 ? (
                                    <span className="font-semibold">{amt.toFixed(2)}</span>
                                  ) : (
                                    <span className="text-on-surface-variant/40">-</span>
                                  )}
                                </td>
                              );
                            })}

                            <td className="px-3.5 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[11px] bg-emerald-500/5">
                              {row.total.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>

                    <tfoot className="bg-surface-container-high font-bold border-t-2 border-outline-variant text-xs sticky bottom-0 z-10 shadow-lg">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-on-surface font-extrabold uppercase">
                          Total
                        </td>
                        <td colSpan={4} className="px-3 py-3 border-r border-outline-variant"></td>

                        {allChildExpenseColumns.map(colName => {
                          const amt = storewiseTotals.colTotals[colName] || 0;
                          return (
                            <td
                              key={`store_total_${colName}`}
                              className="px-2.5 py-3 text-right border-r border-outline-variant font-extrabold font-mono text-on-surface"
                            >
                              {amt > 0 ? amt.toFixed(2) : '-'}
                            </td>
                          );
                        })}

                        <td className="px-3.5 py-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-sm bg-emerald-500/15">
                          KD {storewiseTotals.total.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ========================================== */}
            {/* TAB 3: CONSOLIDATED REPORT (SHEET 5) */}
            {/* ========================================== */}
            {activeTab === 'consolidated' && (
              <div className="space-y-4 max-w-3xl mx-auto">
                <div className="bg-surface-container-low border border-outline-variant rounded p-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-base font-bold text-on-surface uppercase tracking-wider">
                      Consolidated Financial Settlement Report
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Summary by Dynamic Ledger Batch Section including Labour Charges & Expenses
                    </p>
                  </div>
                  <div className="flex items-center gap-2 print:hidden">
                    <button
                      disabled={isCapturing}
                      onClick={() => handleDownloadPdf('consolidated')}
                      className="px-2.5 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                      title="Download Consolidated PDF"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                    <button
                      disabled={isCapturing}
                      onClick={() => handlePrintProfessionalReport('consolidated')}
                      className="px-3 py-1.5 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                      title="Print Consolidated Report"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Summary</span>
                    </button>
                  </div>
                </div>

                <div className="border border-outline-variant rounded overflow-hidden bg-surface-container shadow-2xs">
                  <table className="w-full text-xs text-left text-on-surface">
                    <thead className="bg-surface-container-high text-on-surface-variant uppercase text-[11px] font-bold tracking-wider border-b border-outline-variant">
                      <tr>
                        <th className="px-5 py-3">Section (Ledger Batch)</th>
                        <th className="px-5 py-3 text-right">Labour Charge</th>
                        <th className="px-5 py-3 text-right">Expense</th>
                        <th className="px-5 py-3 text-right bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/60">
                      {consolidatedBatchData.list.map((item) => (
                        <tr key={item.section} className="hover:bg-surface-container-high/40 transition-colors">
                          <td className="px-5 py-3 font-semibold text-on-surface">
                            <div className="flex items-center gap-2">
                              <Boxes className="w-4 h-4 text-primary shrink-0" />
                              <span>{item.section}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-medium text-on-surface">
                            {item.labourCharge > 0 ? item.labourCharge.toFixed(2) : '-'}
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-medium text-on-surface">
                            {item.expense.toFixed(2)}
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                            KD {item.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-surface-container-high font-extrabold border-t-2 border-outline-variant text-xs">
                      <tr>
                        <td className="px-5 py-3.5 text-on-surface uppercase tracking-wider">
                          GRAND TOTAL
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-on-surface">
                          {consolidatedBatchData.grandLabour > 0 ? consolidatedBatchData.grandLabour.toFixed(2) : '-'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-on-surface">
                          {consolidatedBatchData.grandExpense.toFixed(2)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm bg-emerald-500/15">
                          KD {consolidatedBatchData.grandTotal.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* 7-TIER SIGNATURE / AUDIT VERIFICATION WORKFLOW BLOCK */}
            <div className="pt-4 border-t border-outline-variant space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Verification & Authorization Workflow
                </span>
                <span className="text-[10px] text-on-surface-variant/80 font-medium">
                  7-Tier Official Approval Chain
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low text-center flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-on-surface block text-[10.5px]">1. Prepared By</span>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-0.5 truncate">{group.createdByName || 'Site Accountant'}</p>
                  </div>
                  <div className="mt-2">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">Initiated</span>
                  </div>
                </div>

                <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low text-center flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-on-surface block text-[10.5px]">2. Verify By Engg</span>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Project / Site Engineer</p>
                  </div>
                  <div className="mt-2">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] bg-primary/10 text-primary font-semibold">Technical Check</span>
                  </div>
                </div>

                <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low text-center flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-on-surface block text-[10.5px]">3. Verify By MEngg</span>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Maintenance Engineer</p>
                  </div>
                  <div className="mt-2">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] bg-primary/10 text-primary font-semibold">Maintenance Check</span>
                  </div>
                </div>

                <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low text-center flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-on-surface block text-[10.5px]">4. Accountant</span>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Accounts Dept</p>
                  </div>
                  <div className="mt-2">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold">Ledger Verified</span>
                  </div>
                </div>

                <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low text-center flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-on-surface block text-[10.5px]">5. Audit</span>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Internal Audit</p>
                  </div>
                  <div className="mt-2">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">Audit Review</span>
                  </div>
                </div>

                <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low text-center flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-on-surface block text-[10.5px]">6. Finance</span>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Finance Manager</p>
                  </div>
                  <div className="mt-2">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">Fund Allocation</span>
                  </div>
                </div>

                <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low text-center flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-on-surface block text-[10.5px]">7. CEO/GM/Director</span>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-0.5 truncate">{group.completedByName || 'Executive Approval'}</p>
                  </div>
                  <div className="mt-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-semibold ${group.isCompleted ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700'}`}>
                      {group.isCompleted ? 'Final Approved' : 'Pending Exec'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3 border-t border-outline-variant bg-surface-container-low flex items-center justify-between shrink-0">
          <span className="text-[11px] text-on-surface-variant">
            Official Financial Settlement Document • {group.groupName}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold transition-colors cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
