import React, { useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import {
  X, Printer, User, Building2, FileText, CheckCircle2,
  DollarSign, Receipt, Loader2, ArrowLeft, ArrowRight,
  Boxes, ShieldCheck, Download, Search, UserCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { WorkerClaimItem, ExpenseItem } from './types';

interface BundleReportModalProps {
  bundle: WorkerClaimItem;
  onClose: () => void;
  setSelectedTicketForModal?: (ticket: any) => void;
  token?: string;
  currentUser?: any;
  API_URL?: string;
  autoPrint?: boolean;
}

interface BatchGroupItem {
  batchName: string;
  expenses: any[];
  totalAmount: number;
  ticketCount: number;
  locationCount: number;
}

interface WorkerSummaryItem {
  workerId: number | string;
  workerName: string;
  workerEmployeeNo?: string;
  ticketCount: number;
  locationCount: number;
  expensesCount: number;
  totalAmount: number;
  expenses: any[];
  batchGroups: BatchGroupItem[];
}

export const BundleReportModal: React.FC<BundleReportModalProps> = ({
  bundle,
  onClose,
  setSelectedTicketForModal,
  token,
  currentUser,
  API_URL,
  autoPrint = true,
}) => {
  const reduxUser = useSelector((state: RootState) => state.auth.user);
  const activeUser = currentUser || reduxUser;

  // Current creating user name for "Prepared By" verification block
  const creatingUserName = useMemo(() => {
    return (
      (bundle as any).created_by_detail?.full_name ||
      (bundle as any).created_by_detail?.username ||
      (bundle as any).created_by_name ||
      (bundle as any).submitted_by_detail?.full_name ||
      (bundle as any).submitted_by_detail?.username ||
      (bundle as any).submitted_by?.full_name ||
      (bundle as any).submitted_by?.username ||
      activeUser?.full_name ||
      activeUser?.username ||
      'Site Accountant'
    );
  }, [bundle, activeUser]);

  const [activeTab, setActiveTab] = useState<'detailed' | 'all'>('detailed');
  const [isVerticalOrientation, setIsVerticalOrientation] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [loadedExpenses, setLoadedExpenses] = useState<ExpenseItem[]>(bundle.expenses || []);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [fetchedBatches, setFetchedBatches] = useState<any[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);

  // If bundle.expenses is empty, fetch full details from API
  useEffect(() => {
    if ((!bundle.expenses || bundle.expenses.length === 0) && API_URL && token) {
      setIsLoadingExpenses(true);
      fetch(`${API_URL}/finance/claim/${bundle.claim_id}/`, {
        headers: { Authorization: `Token ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.expenses)) {
            setLoadedExpenses(data.expenses);
          }
        })
        .catch(err => console.error('Failed to load bundle expenses for report:', err))
        .finally(() => setIsLoadingExpenses(false));
    } else if (bundle.expenses) {
      setLoadedExpenses(bundle.expenses);
    }
  }, [bundle, API_URL, token]);

  // Fetch complete ledger batches from API to resolve sub-departments to batch names
  useEffect(() => {
    if (!API_URL) return;
    const headers: Record<string, string> = token ? { Authorization: `Token ${token}` } : {};
    setIsLoadingBatches(true);
    fetch(`${API_URL}/finance/ledger-batches/`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
        setFetchedBatches(list);
      })
      .catch(err => console.error('Failed to fetch ledger batches for report:', err))
      .finally(() => setIsLoadingBatches(false));
  }, [API_URL, token]);

  // Aggregate expenses by worker, split by ledger batch, and sort so same stores are kept in contiguous order
  const { workerList, grandTotals, allFlattenedExpenses } = useMemo(() => {
    const workerMap = new Map<string, {
      workerId: number | string;
      workerName: string;
      workerEmployeeNo?: string;
      tickets: Set<string>;
      locations: Set<string>;
      expenses: any[];
      totalAmount: number;
    }>();

    const flattened: any[] = [];
    let grandAmount = 0;
    const allLocations = new Set<string>();
    const allTickets = new Set<string>();

    // Helper to resolve official LedgerBatch name for an expense
    const resolveBatchName = (tDetails: any, exp: any): string => {
      const subDeptId = exp.sub_department_id || tDetails.sub_department_id || tDetails.sub_department;
      const subDeptName = exp.sub_department_name || tDetails.sub_department_name || tDetails.department_name;

      if (fetchedBatches && fetchedBatches.length > 0) {
        if (subDeptId != null) {
          const numId = Number(subDeptId);
          const matched = fetchedBatches.find(b =>
            (Array.isArray(b.sub_departments) && b.sub_departments.some((sid: any) => Number(sid) === numId)) ||
            (Array.isArray(b.sub_departments_detail) && b.sub_departments_detail.some((sd: any) => Number(sd.sub_department_id) === numId))
          );
          if (matched?.batch_name) return matched.batch_name;
        }
        if (subDeptName) {
          const lowerName = String(subDeptName).toLowerCase().trim();
          const matched = fetchedBatches.find(b =>
            (Array.isArray(b.sub_departments_detail) && b.sub_departments_detail.some((sd: any) => String(sd.sub_department_name || '').toLowerCase().trim() === lowerName)) ||
            String(b.batch_name || '').toLowerCase().trim() === lowerName
          );
          if (matched?.batch_name) return matched.batch_name;
        }
      }

      return subDeptName || 'General Maintenance';
    };

    loadedExpenses.forEach((exp: any, index: number) => {
      const workerObj = exp.worker_detail || (typeof exp.worker === 'object' ? exp.worker : null) || bundle.worker_detail || {};
      const wId = workerObj.id || workerObj.user_id || exp.worker || 0;
      const wName = workerObj.full_name || workerObj.username || 'Technician';
      const wEmpNo = workerObj.employee_no || '';

      const tDetails = exp.ticket_details || (typeof exp.ticket === 'object' ? exp.ticket : null) || {};
      const tNo = tDetails.work_order_no || (tDetails.ticket_id ? `${tDetails.ticket_id}` : (exp.ticket ? `${exp.ticket}` : 'N/A'));
      const tTitle = tDetails.title || '';
      const storeName = exp.responsible_store?.store_name || tDetails.store_name || 'N/A';
      const subDept = tDetails.sub_department_name || tDetails.department_name || 'Maintenance';
      const batchName = resolveBatchName(tDetails, exp);
      const expCategory = exp.expense_type_detail?.expense_name || exp.expense_type?.expense_name || 'General Expense';
      const amt = parseFloat(String(exp.amount || '0')) || 0;
      const dateStr = exp.expense_date ? String(exp.expense_date).split('T')[0] : '';
      const remarksStr = exp.remarks || '';

      grandAmount += amt;
      if (storeName && storeName !== 'N/A') allLocations.add(storeName);
      if (tNo && tNo !== 'N/A') allTickets.add(tNo);

      const expItem = {
        sl: index + 1,
        expenseId: exp.expense_id,
        workerId: wId,
        workerName: wName,
        workerEmployeeNo: wEmpNo,
        ticketNo: tNo,
        ticketTitle: tTitle,
        ticketObj: tDetails,
        location: storeName,
        subDepartment: subDept,
        batchName: batchName,
        category: expCategory,
        amount: amt,
        date: dateStr,
        remarks: remarksStr,
      };

      flattened.push(expItem);

      const workerKey = String(wId || wName);
      if (!workerMap.has(workerKey)) {
        workerMap.set(workerKey, {
          workerId: wId,
          workerName: wName,
          workerEmployeeNo: wEmpNo,
          tickets: new Set<string>(),
          locations: new Set<string>(),
          expenses: [],
          totalAmount: 0,
        });
      }

      const entry = workerMap.get(workerKey)!;
      entry.expenses.push(expItem);
      entry.totalAmount += amt;
      if (tNo && tNo !== 'N/A') entry.tickets.add(tNo);
      if (storeName && storeName !== 'N/A') entry.locations.add(storeName);
    });

    const workers: WorkerSummaryItem[] = Array.from(workerMap.values()).map(w => {
      // Group expenses by ledger batch
      const batchMap = new Map<string, {
        batchName: string;
        expenses: any[];
        totalAmount: number;
        tickets: Set<string>;
        locations: Set<string>;
      }>();

      w.expenses.forEach(exp => {
        const bName = exp.batchName || 'General Maintenance';
        if (!batchMap.has(bName)) {
          batchMap.set(bName, {
            batchName: bName,
            expenses: [],
            totalAmount: 0,
            tickets: new Set<string>(),
            locations: new Set<string>(),
          });
        }
        const bEntry = batchMap.get(bName)!;
        bEntry.expenses.push(exp);
        bEntry.totalAmount += exp.amount;
        if (exp.ticketNo && exp.ticketNo !== 'N/A') bEntry.tickets.add(exp.ticketNo);
        if (exp.location && exp.location !== 'N/A') bEntry.locations.add(exp.location);
      });

      // Within each batch, sort expenses so same stores are kept in contiguous order (numeric natural sort), then date, then ticketNo
      const batchGroups: BatchGroupItem[] = Array.from(batchMap.values()).map(b => {
        const sortedExpenses = [...b.expenses].sort((e1, e2) => {
          const loc1 = String(e1.location || '').trim();
          const loc2 = String(e2.location || '').trim();
          const locCompare = loc1.localeCompare(loc2, undefined, { numeric: true, sensitivity: 'base' });
          if (locCompare !== 0) return locCompare;
          const d1 = String(e1.date || '');
          const d2 = String(e2.date || '');
          if (d1 !== d2) return d1.localeCompare(d2);
          return String(e1.ticketNo || '').localeCompare(String(e2.ticketNo || ''));
        });

        return {
          batchName: b.batchName,
          expenses: sortedExpenses,
          totalAmount: b.totalAmount,
          ticketCount: b.tickets.size,
          locationCount: b.locations.size,
        };
      });

      // Sort batches consistently
      batchGroups.sort((b1, b2) => b1.batchName.localeCompare(b2.batchName));

      return {
        workerId: w.workerId,
        workerName: w.workerName,
        workerEmployeeNo: w.workerEmployeeNo,
        ticketCount: w.tickets.size,
        locationCount: w.locations.size,
        expensesCount: w.expenses.length,
        totalAmount: w.totalAmount,
        expenses: w.expenses,
        batchGroups,
      };
    });

    return {
      workerList: workers,
      grandTotals: {
        totalWorkers: workers.length,
        totalTickets: allTickets.size,
        totalLocations: allLocations.size,
        totalExpenses: flattened.length,
        grandAmount,
      },
      allFlattenedExpenses: flattened,
    };
  }, [loadedExpenses, bundle, fetchedBatches]);

  // Professional Print Document Generation & Execution
  const handlePrintProfessionalReport = () => {
    setIsCapturing(true);
    try {
      const getHeaderHtml = (subtitle: string) => `
        <div class="report-header">
          <div>
            <h1 class="report-title">Worker-wise Bundle Verification</h1>
            <p class="report-subtitle">${subtitle}</p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px;font-weight:700;color:#111827;">Bundle ${bundle.claim_id}</div>
            <div style="font-size:10px;color:#6b7280;">Status: ${bundle.status} | Date: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>
      `;

      // Build Worker Wise Detailed Pages HTML (Each Worker page is paginated so signatures are ALWAYS pinned to bottom of the final page)
      let workerDetailedPagesHtml = '';

      const tableTheadHtml = `
        <thead>
          <tr style="background:#f3f4f6;border-bottom:1px solid #d1d5db;">
            <th style="width:35px;text-align:center;border:1px solid #d1d5db;padding:5px 4px;font-size:9px;font-weight:700;color:#111827;">SL</th>
            <th style="width:130px;text-align:left;border:1px solid #d1d5db;padding:5px 6px;font-size:9px;font-weight:700;color:#111827;">TICKET NO / WO#</th>
            <th style="width:130px;text-align:left;border:1px solid #d1d5db;padding:5px 6px;font-size:9px;font-weight:700;color:#111827;">STORE / LOCATION</th>
            <th style="width:90px;text-align:left;border:1px solid #d1d5db;padding:5px 6px;font-size:9px;font-weight:700;color:#111827;">SUB DEPT</th>
            <th style="width:105px;text-align:left;border:1px solid #d1d5db;padding:5px 6px;font-size:9px;font-weight:700;color:#111827;">CATEGORY</th>
            <th style="width:70px;text-align:center;border:1px solid #d1d5db;padding:5px 4px;font-size:9px;font-weight:700;color:#111827;">DATE</th>
            <th style="text-align:left;border:1px solid #d1d5db;padding:5px 6px;font-size:9px;font-weight:700;color:#111827;">REMARKS</th>
            <th style="width:85px;text-align:right;border:1px solid #d1d5db;padding:5px 6px;font-size:9.5px;font-weight:700;color:#111827;">AMOUNT</th>
          </tr>
        </thead>
      `;

      const getSignaturesHtml = () => `
        <div class="signatures">
          <div class="sign-box">
            <strong>Prepared By</strong>
            <span>${creatingUserName}</span>
          </div>
          <div class="sign-box">
            <strong>Verify By MEngg</strong>
            <span>Maintenance Engineer</span>
          </div>
          <div class="sign-box">
            <strong>Accounts</strong>
            <span>Accounts Dept</span>
          </div>
          <div class="sign-box">
            <strong>Verify By Engg</strong>
            <span>Project / Site Engineer</span>
          </div>
        </div>
      `;

      const pageHeight = isVerticalOrientation ? '268mm' : '180mm';

      workerList.forEach((worker) => {
        let sl = 1;
        interface RowItem {
          html: string;
          weight: number;
          isBatchHeader?: boolean;
        }
        const rowItems: RowItem[] = [];

        worker.batchGroups.forEach((batch) => {
          // Batch Section Header Row (clean hairline, subtle background, no dark blue banner)
          rowItems.push({
            isBatchHeader: true,
            weight: 1.1,
            html: `
            <tr style="background:#f9fafb;border-top:1px solid #d1d5db;border-bottom:1px solid #d1d5db;page-break-inside:avoid;">
              <td colspan="8" style="padding:5px 8px;font-size:9.5px;font-weight:700;color:#1e3a8a;border:1px solid #d1d5db;text-transform:uppercase;letter-spacing:0.3px;">
                📂 ${batch.batchName}
                <span style="font-weight:normal;color:#6b7280;font-size:9px;margin-left:8px;text-transform:none;">
                  (${batch.expenses.length} item(s) • ${batch.locationCount} store(s) • Subtotal: KD ${batch.totalAmount.toFixed(2)})
                </span>
              </td>
            </tr>
          `,
          });

          // Expense Rows within this batch (clean light borders, no green background)
          for (const exp of batch.expenses) {
            const isLong = Boolean(exp.ticketTitle && exp.ticketTitle.length > 25);
            rowItems.push({
              weight: isLong ? 1.35 : 1.0,
              html: `
              <tr style="border:1px solid #e5e7eb;">
                <td style="text-align:center;padding:4px 5px;border:1px solid #e5e7eb;font-size:9px;color:#4b5563;">${sl++}</td>
                <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px;font-weight:600;color:#1e40af;line-height:1.3;white-space:nowrap;">
                  ${exp.ticketNo}
                  ${exp.ticketTitle ? `<br/><span style="font-weight:normal;color:#6b7280;font-size:8.5px;">${exp.ticketTitle}</span>` : ''}
                </td>
                <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px;font-weight:700;color:#111827;">${exp.location}</td>
                <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px;color:#4b5563;">${exp.subDepartment}</td>
                <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px;color:#111827;">${exp.category}</td>
                <td style="text-align:center;padding:4px 5px;border:1px solid #e5e7eb;font-size:9px;color:#4b5563;">${exp.date || '-'}</td>
                <td style="padding:4px 6px;border:1px solid #e5e7eb;font-size:9px;color:#374151;">${exp.remarks || '-'}</td>
                <td style="text-align:right;padding:4px 6px;border:1px solid #e5e7eb;font-size:9.5px;font-weight:700;color:#111827;">KD ${exp.amount.toFixed(2)}</td>
              </tr>
            `,
            });
          }

          rowItems.push({
            weight: 1.0,
            html: `
            <tr style="background:#f9fafb;font-weight:700;border:1px solid #d1d5db;page-break-inside:avoid;">
              <td colspan="7" style="text-align:right;padding:4px 8px;font-size:9px;color:#374151;border:1px solid #d1d5db;">
                Subtotal (${batch.batchName}):
              </td>
              <td style="text-align:right;padding:4px 6px;font-size:9.5px;font-weight:700;color:#111827;border:1px solid #d1d5db;">
                KD ${batch.totalAmount.toFixed(2)}
              </td>
            </tr>
          `,
          });
        });

        const grandTotalRowHtml = `
          <tr style="background:#f3f4f6;font-weight:800;border-top:1.5px solid #111827;page-break-inside:avoid;">
            <td colspan="7" style="text-align:right;padding:6px 8px;font-size:10px;color:#111827;border:1px solid #d1d5db;text-transform:uppercase;letter-spacing:0.3px;">
              Grand Total (${worker.workerName}):
            </td>
            <td style="text-align:right;padding:6px 8px;font-size:10.5px;font-weight:800;color:#111827;border:1px solid #d1d5db;">
              KD ${worker.totalAmount.toFixed(2)}
            </td>
          </tr>
        `;

        const totalWeight = rowItems.reduce((acc, r) => acc + r.weight, 0);
        const singlePageLimit = isVerticalOrientation ? 18 : 10;

        if (totalWeight <= singlePageLimit) {
          // Fits on 1 single page!
          workerDetailedPagesHtml += `
            <!-- WORKER DETAILED STATEMENT: ${worker.workerName} (Single Page) -->
            <div class="print-page worker-page" style="page-break-after: always; break-after: page; padding-top: 6px; box-sizing: border-box; height: ${pageHeight}; min-height: ${pageHeight}; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                ${getHeaderHtml(`${worker.workerName} ${worker.workerEmployeeNo ? `(${worker.workerEmployeeNo})` : ''}`)}
                <div class="meta-grid" style="grid-template-columns: repeat(4, 1fr);">
                  <div class="meta-item">
                    <span>TECHNICIAN / WORKER</span>
                    <strong>${worker.workerName} ${worker.workerEmployeeNo ? `(${worker.workerEmployeeNo})` : ''}</strong>
                  </div>
                  <div class="meta-item">
                    <span>TICKETS IN BUNDLE</span>
                    <strong>${worker.ticketCount} Tickets</strong>
                  </div>
                  <div class="meta-item">
                    <span>LOCATIONS VISITED</span>
                    <strong>${worker.locationCount} Stores</strong>
                  </div>
                  <div class="meta-item">
                    <span>WORKER CLAIM AMOUNT</span>
                    <strong>KD ${worker.totalAmount.toFixed(2)}</strong>
                  </div>
                </div>

                <table style="width:100%;border-collapse:collapse;margin-top:10px;background:#ffffff;border:1px solid #d1d5db;">
                  ${tableTheadHtml}
                  <tbody>
                    ${rowItems.map(r => r.html).join('')}
                    ${grandTotalRowHtml}
                  </tbody>
                </table>
              </div>

              ${getSignaturesHtml()}
            </div>
          `;
        } else {
          // Multiple Pages needed! Partition rows cleanly across pages
          const pagesRows: RowItem[][] = [];
          const p1Limit = isVerticalOrientation ? 22 : 12;
          const pNextLimit = isVerticalOrientation ? 18 : 10;

          let curPage: RowItem[] = [];
          let curWeight = 0;
          let isFirst = true;

          for (let i = 0; i < rowItems.length; i++) {
            const item = rowItems[i];
            const maxLimit = isFirst ? p1Limit : pNextLimit;
            const isOrphan = item.isBatchHeader && (maxLimit - curWeight < 2.5) && curPage.length > 0;

            if (curWeight + item.weight > maxLimit || isOrphan) {
              pagesRows.push(curPage);
              curPage = [item];
              curWeight = item.weight;
              isFirst = false;
            } else {
              curPage.push(item);
              curWeight += item.weight;
            }
          }
          if (curPage.length > 0) {
            pagesRows.push(curPage);
          }

          const totalPages = pagesRows.length;

          pagesRows.forEach((pageRows, pIdx) => {
            const isFirstPage = pIdx === 0;
            const isLastPage = pIdx === totalPages - 1;

            workerDetailedPagesHtml += `
              <!-- WORKER DETAILED STATEMENT: ${worker.workerName} (Page ${pIdx + 1} of ${totalPages}) -->
              <div class="print-page worker-page" style="page-break-after: always; break-after: page; padding-top: 6px; box-sizing: border-box; height: ${pageHeight}; min-height: ${pageHeight}; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  ${isFirstPage
                ? getHeaderHtml(`${worker.workerName} ${worker.workerEmployeeNo ? `(${worker.workerEmployeeNo})` : ''} - Page 1 of ${totalPages}`)
                : getHeaderHtml(`${worker.workerName} - Continued (Page ${pIdx + 1} of ${totalPages})`)
              }

                  ${isFirstPage ? `
                    <div class="meta-grid" style="grid-template-columns: repeat(4, 1fr);">
                      <div class="meta-item">
                        <span>TECHNICIAN / WORKER</span>
                        <strong>${worker.workerName} ${worker.workerEmployeeNo ? `(${worker.workerEmployeeNo})` : ''}</strong>
                      </div>
                      <div class="meta-item">
                        <span>TICKETS IN BUNDLE</span>
                        <strong>${worker.ticketCount} Tickets</strong>
                      </div>
                      <div class="meta-item">
                        <span>LOCATIONS VISITED</span>
                        <strong>${worker.locationCount} Stores</strong>
                      </div>
                      <div class="meta-item">
                        <span>WORKER CLAIM AMOUNT</span>
                        <strong>KD ${worker.totalAmount.toFixed(2)}</strong>
                      </div>
                    </div>
                  ` : ''}

                  <table style="width:100%;border-collapse:collapse;margin-top:10px;background:#ffffff;border:1px solid #d1d5db;">
                    ${tableTheadHtml}
                    <tbody>
                      ${pageRows.map(r => r.html).join('')}
                      ${isLastPage ? grandTotalRowHtml : ''}
                    </tbody>
                  </table>
                </div>

                ${isLastPage ? getSignaturesHtml() : '<div style="height:1px;"></div>'}
              </div>
            `;
          });
        }
      });

      // Construct Complete Print Document (Only Worker Wise Detailed Statement)
      const printDoc = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Worker Wise Detailed Statement - Bundle ${bundle.claim_id}</title>
            <meta charset="utf-8" />
            <style>
              @page {
                size: ${isVerticalOrientation ? 'portrait' : 'landscape'};
                margin: ${isVerticalOrientation ? '8mm 6mm 8mm 6mm' : '10mm 8mm 10mm 8mm'};
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
              table {
                font-size: 9px !important;
                border-collapse: collapse;
              }
              th, td {
                padding: 4px 5px !important;
              }
              .report-header {
                border-bottom: 1.5px solid #111827;
                padding-bottom: 8px;
                margin-bottom: 10px;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
              }
              .report-title {
                font-size: 16px;
                font-weight: 800;
                color: #111827;
                letter-spacing: -0.2px;
                text-transform: uppercase;
                margin: 0 0 2px 0;
              }
              .report-subtitle {
                font-size: 10.5px;
                color: #4b5563;
                margin: 0;
              }
              .meta-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 4px;
                padding: 6px 10px;
                margin-bottom: 10px;
              }
              .meta-item {
                font-size: 10px;
              }
              .meta-item span {
                color: #6b7280;
                display: block;
                font-weight: 500;
                font-size: 9px;
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
              .worker-page {
                box-sizing: border-box;
                height: ${isVerticalOrientation ? '268mm' : '180mm'};
                min-height: ${isVerticalOrientation ? '268mm' : '180mm'};
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                page-break-after: always;
                break-after: page;
              }
              .worker-page:last-child {
                page-break-after: auto;
                break-after: auto;
              }
              .worker-page .signatures {
                margin-top: auto;
                padding-top: 16px;
                page-break-inside: avoid;
              }
              .signatures {
                display: flex;
                justify-content: space-between;
                gap: 12px;
                page-break-inside: avoid;
                padding-top: 15px;
                width: 100%;
              }
              .sign-box {
                flex: 1;
                text-align: center;
                border-top: 1.5px solid #111827;
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
                .worker-page {
                  box-sizing: border-box !important;
                  height: ${isVerticalOrientation ? '268mm' : '180mm'} !important;
                  min-height: ${isVerticalOrientation ? '268mm' : '180mm'} !important;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                  page-break-after: always !important;
                  break-after: page !important;
                }
                .worker-page:last-child {
                  page-break-after: auto !important;
                  break-after: auto !important;
                }
                .worker-page .signatures {
                  margin-top: auto !important;
                  padding-top: 16px !important;
                  page-break-inside: avoid !important;
                }
              }
            </style>
          </head>
          <body>
            <!-- WORKER WISE DETAILED STATEMENT (EACH PAGE FOR EACH WORKER) -->
            ${workerDetailedPagesHtml}
          </body>
        </html>
      `;

      // Use off-screen iframe to render and trigger print
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-10000px';
      iframe.style.top = '0';
      iframe.style.width = isVerticalOrientation ? '794px' : '1024px';
      iframe.style.height = isVerticalOrientation ? '1123px' : '768px';
      iframe.style.border = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const win = iframe.contentWindow;
      if (win) {
        win.document.open();
        win.document.write(printDoc);
        win.document.close();

        let isPrinted = false;
        const triggerPrint = () => {
          if (isPrinted) return;
          isPrinted = true;
          try {
            win.focus();
            win.print();
          } catch (e) {
            console.error('Error invoking print dialog on iframe:', e);
            const popup = window.open('', '_blank');
            if (popup) {
              popup.document.open();
              popup.document.write(printDoc);
              popup.document.close();
              setTimeout(() => {
                popup.focus();
                popup.print();
              }, 400);
            }
          } finally {
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
              setIsCapturing(false);
            }, 1000);
          }
        };

        iframe.onload = () => {
          setTimeout(triggerPrint, 300);
        };
        setTimeout(triggerPrint, 600);
      }
    } catch (err) {
      console.error('Failed to generate print document:', err);
      setIsCapturing(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');

  // Export exact Excel file matching Ledger Group structure
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const rows: any[][] = [
        [`Worker Bundle ${bundle.claim_id} - Verification`],
        [`Status: ${bundle.status} | Date: ${new Date().toLocaleDateString()}`],
        [],
        ['SL', 'Technician', 'Ticket / WO#', 'Store / Location', 'Sub Department', 'Ledger Batch', 'Category', 'Date', 'Remarks', 'Amount (KD)']
      ];

      let sl = 1;
      workerList.forEach(w => {
        w.batchGroups.forEach(b => {
          b.expenses.forEach(exp => {
            rows.push([
              sl++,
              w.workerName,
              exp.ticketNo,
              exp.location,
              exp.subDepartment,
              b.batchName,
              exp.category,
              exp.date || '-',
              exp.remarks || '-',
              Number(exp.amount.toFixed(2))
            ]);
          });
          rows.push(['', '', '', '', '', `Batch Subtotal (${b.batchName})`, '', '', '', Number(b.totalAmount.toFixed(2))]);
        });
        rows.push(['', '', '', '', '', `Worker Total (${w.workerName})`, '', '', '', Number(w.totalAmount.toFixed(2))]);
        rows.push([]);
      });

      rows.push(['', '', '', '', '', 'BUNDLE GRAND TOTAL', '', '', '', Number(grandTotals.grandAmount.toFixed(2))]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 6 }, { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 20 }, { wch: 26 }, { wch: 18 }, { wch: 14 }, { wch: 30 }, { wch: 14 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Worker Statement');
      XLSX.writeFile(wb, `Bundle_${bundle.claim_id}_Worker_Statement_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Failed to export Excel report:', err);
      alert('Failed to generate Excel report');
    }
  };

  // Filtered workers by search term
  const filteredWorkerList = useMemo(() => {
    if (!searchTerm.trim()) return workerList;
    const q = searchTerm.toLowerCase();
    return workerList.map(w => {
      const filteredBatches = w.batchGroups.map(b => {
        const filteredExps = b.expenses.filter(e =>
          String(e.ticketNo || '').toLowerCase().includes(q) ||
          String(e.location || '').toLowerCase().includes(q) ||
          String(e.subDepartment || '').toLowerCase().includes(q) ||
          String(e.category || '').toLowerCase().includes(q) ||
          String(e.remarks || '').toLowerCase().includes(q) ||
          String(w.workerName || '').toLowerCase().includes(q) ||
          String(b.batchName || '').toLowerCase().includes(q)
        );
        return {
          ...b,
          expenses: filteredExps,
          totalAmount: filteredExps.reduce((acc, curr) => acc + curr.amount, 0),
          locationCount: new Set(filteredExps.map(e => e.location)).size
        };
      }).filter(b => b.expenses.length > 0);

      return {
        ...w,
        batchGroups: filteredBatches,
        expensesCount: filteredBatches.reduce((acc, b) => acc + b.expenses.length, 0),
        totalAmount: filteredBatches.reduce((acc, b) => acc + b.totalAmount, 0)
      };
    }).filter(w => w.batchGroups.length > 0);
  }, [workerList, searchTerm]);

  // Auto-trigger print popup on initial mount if requested
  useEffect(() => {
    if (autoPrint && !isLoadingExpenses && !isLoadingBatches && loadedExpenses.length > 0) {
      const timer = setTimeout(() => {
        handlePrintProfessionalReport();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, isLoadingExpenses, isLoadingBatches, loadedExpenses.length]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded max-w-6xl w-full h-[92vh] max-h-[920px] flex flex-col shadow-2xl overflow-hidden transition-all text-on-surface dark:text-dark-on-surface">
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-outline-variant dark:border-dark-outline-variant flex items-center justify-between bg-surface-container-low dark:bg-dark-surface-container-low shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-on-surface dark:text-dark-on-surface tracking-tight">
                  Worker Bundle Verification Report {bundle.claim_id}
                </h2>

              </div>

            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            {/* Global Orientation Toggle */}
            <button
              type="button"
              onClick={() => setIsVerticalOrientation(!isVerticalOrientation)}
              className="px-2.5 py-1.5 rounded bg-surface-container border border-outline text-xs font-semibold text-on-surface cursor-pointer hover:bg-surface-container-high transition-colors select-none shadow-2xs hidden sm:flex items-center gap-1.5"
              title="Toggle portrait/landscape print orientation"
            >
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span>{isVerticalOrientation ? 'Vertical (Portrait)' : 'Horizontal (Landscape)'}</span>
            </button>

            {/* Excel Download Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs hover:shadow cursor-pointer"
              title="Download exact multi-batch Excel file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel (.xlsx)</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrintProfessionalReport}
              disabled={isCapturing}
              className="px-3.5 py-1.5 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              title="Print professional formatted tabular report"
            >
              {isCapturing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              <span>Print</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer ml-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-surface scrollbar-thin">
          {/* Top Metric Cards (Matching Ledgers Standard) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded bg-surface-container border border-outline-variant shadow-2xs">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-[11px] font-medium">Grand Settlement Total</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                KD {grandTotals.grandAmount.toFixed(2)}
              </div>
              <span className="text-[10px] text-on-surface-variant mt-0.5 block font-medium">
                {grandTotals.totalExpenses} itemized ticket entries
              </span>
            </div>

            <div className="p-3.5 rounded bg-surface-container border border-outline-variant shadow-2xs">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-[11px] font-medium">Locations Covered</span>
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div className="text-xl font-bold text-primary mt-1">
                {grandTotals.totalLocations} Locations
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block font-medium">
                {grandTotals.totalTickets} total ticket(s)
              </span>
            </div>

            <div className="p-3.5 rounded bg-surface-container border border-outline-variant shadow-2xs">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-[11px] font-medium">Technicians Payout</span>
                <User className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-xl font-bold text-on-surface mt-1">
                {grandTotals.totalWorkers} Worker{grandTotals.totalWorkers !== 1 ? 's' : ''}
              </div>
              <span className="text-[10px] text-on-surface-variant mt-0.5 block">
                Claim Bundle {bundle.claim_id}
              </span>
            </div>

            <div className="p-3.5 rounded bg-surface-container border border-outline-variant shadow-2xs">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="text-[11px] font-medium">Ledger Batches</span>
                <Boxes className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-bold text-on-surface mt-1">
                {new Set(allFlattenedExpenses.map(e => e.batchName)).size} Batches
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {bundle.status}
              </span>
            </div>
          </div>

          {/* REPORT VIEW TABS & SEARCH */}
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-outline-variant pb-2">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('detailed')}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'detailed'
                  ? 'bg-primary text-on-primary shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Worker Wise Report ({workerList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'all'
                  ? 'bg-primary text-on-primary shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>All Tied Expenses ({grandTotals.totalExpenses})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search ticket, store, worker..."
                className="w-full pl-8 pr-3 py-1.5 rounded border border-outline bg-surface-container text-xs text-on-surface focus:outline-none focus:border-primary shadow-2xs"
              />
            </div>
          </div>

          {isLoadingExpenses || isLoadingBatches ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-on-surface-variant">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs">Loading bundle expenses and batches...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: WORKER WISE REPORT (SPLIT LEDGER BATCH WISE & CONTIGUOUS STORE ORDER) */}
              {activeTab === 'detailed' && (
                <div className="space-y-6">


                  {filteredWorkerList.length === 0 ? (
                    <div className="p-8 text-center text-on-surface-variant bg-surface-container rounded border border-outline-variant">
                      No worker statements match the search query "{searchTerm}".
                    </div>
                  ) : (
                    filteredWorkerList.map((worker, wIdx) => (
                      <div
                        key={worker.workerId || wIdx}
                        className="rounded border border-outline-variant bg-surface-container dark:bg-dark-surface-container overflow-hidden shadow-2xs space-y-3 p-4"
                      >
                        {/* Worker Identity Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-outline-variant">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-on-surface">
                                  {worker.workerName}
                                </h4>
                                {worker.workerEmployeeNo && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-container-high text-on-surface-variant font-mono">
                                    {worker.workerEmployeeNo}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-on-surface-variant mt-0.5">
                                {worker.expensesCount} Expense(s) across {worker.batchGroups.length} Batch(es) & {worker.locationCount} Store(s)
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] uppercase tracking-wider text-on-surface-variant block font-medium">Worker Total Payout</span>
                            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                              KD {worker.totalAmount.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Ledger Batch Wise Sections (Same Store Kept in Contiguous Order) */}
                        <div className="space-y-4">
                          {worker.batchGroups.map((batch, bIdx) => (
                            <div key={batch.batchName || bIdx} className="rounded border border-outline-variant dark:border-dark-outline-variant overflow-hidden shadow-2xs bg-surface-container-low">
                              {/* Batch Header Banner (Matching Ledgers Standard) */}
                              <div className="flex items-center justify-between px-4 py-2.5 bg-primary/10 border-b border-primary/25 font-bold text-xs text-primary">
                                <div className="flex items-center gap-2">
                                  <Boxes className="w-4 h-4 text-primary shrink-0" />
                                  <span className="uppercase tracking-wide font-extrabold">{batch.batchName}</span>
                                  <span className="text-[11px] text-on-surface-variant font-medium">
                                    ({batch.expenses.length} item{batch.expenses.length !== 1 ? 's' : ''} across {batch.locationCount} store{batch.locationCount !== 1 ? 's' : ''})
                                  </span>
                                </div>
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                  Batch Subtotal: KD {batch.totalAmount.toFixed(2)}
                                </span>
                              </div>

                              {/* Batch Expenses Table */}
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left text-on-surface border-collapse">
                                  <thead className="bg-surface-container-high text-on-surface-variant text-[11px] font-bold border-b border-outline-variant">
                                    <tr>
                                      <th className="px-3 py-2.5 border-r border-outline-variant/60 text-center w-12">SL</th>
                                      <th className="px-3.5 py-2.5 border-r border-outline-variant/60 text-left min-w-[140px]">TICKET NO / WO#</th>
                                      <th className="px-4 py-2.5 border-r border-outline-variant/60 text-left min-w-[150px]">STORE / LOCATION</th>
                                      <th className="px-3 py-2.5 border-r border-outline-variant/60 text-left">SUB DEPT</th>
                                      <th className="px-3 py-2.5 border-r border-outline-variant/60 text-left">CATEGORY</th>
                                      <th className="px-3 py-2.5 border-r border-outline-variant/60 text-center">DATE</th>
                                      <th className="px-3 py-2.5 border-r border-outline-variant/60 text-left">REMARKS</th>
                                      <th className="px-4 py-2.5 text-right bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold min-w-[90px]">
                                        AMOUNT
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-outline-variant/50 text-xs">
                                    {batch.expenses.map((exp: any, expIdx: number) => (
                                      <tr key={exp.expenseId || expIdx} className="hover:bg-surface-container-high/40 transition-colors">
                                        <td className="px-3 py-2 border-r border-outline-variant/60 text-center font-mono text-on-surface-variant text-[11px]">
                                          {expIdx + 1}
                                        </td>
                                        <td className="px-3.5 py-2 border-r border-outline-variant/60 font-mono text-[11px]">
                                          {setSelectedTicketForModal && exp.ticketObj?.ticket_id ? (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedTicketForModal(exp.ticketObj)}
                                              className="font-bold text-primary hover:underline cursor-pointer text-left block"
                                            >
                                              {exp.ticketNo}
                                            </button>
                                          ) : (
                                            <span className="font-bold text-primary block">{exp.ticketNo}</span>
                                          )}
                                          {exp.ticketTitle && (
                                            <span className="text-[10px] text-on-surface-variant truncate block max-w-xs">{exp.ticketTitle}</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-2 border-r border-outline-variant/60 font-bold text-on-surface">
                                          <div className="flex items-center gap-1.5">
                                            <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                            <span>{exp.location}</span>
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 border-r border-outline-variant/60 text-on-surface-variant">{exp.subDepartment}</td>
                                        <td className="px-3 py-2 border-r border-outline-variant/60 font-medium text-on-surface">{exp.category}</td>
                                        <td className="px-3 py-2 border-r border-outline-variant/60 text-center font-mono text-on-surface-variant">{exp.date || '-'}</td>
                                        <td className="px-3 py-2 border-r border-outline-variant/60 text-on-surface-variant max-w-xs truncate" title={exp.remarks}>
                                          {exp.remarks || '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                                          KD {exp.amount.toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-surface-container-high font-extrabold border-t-2 border-outline-variant text-xs">
                                    <tr>
                                      <td colSpan={7} className="px-4 py-2.5 text-right uppercase tracking-wider text-on-surface text-[11px]">
                                        Batch Subtotal ({batch.batchName}):
                                      </td>
                                      <td className="px-4 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 font-black text-xs">
                                        KD {batch.totalAmount.toFixed(2)}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Worker Total Bar */}
                        <div className="flex items-center justify-between p-3 rounded bg-surface-container-high border border-outline-variant">
                          <span className="text-xs font-bold  tracking-wider text-on-surface">
                            Grand Total Payout ({worker.workerName}):
                          </span>
                          <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded border border-emerald-500/20">
                            KD {worker.totalAmount.toFixed(2)}
                          </span>
                        </div>

                        {/* 4-Tier Verification & Authorization Workflow */}
                        {/* <div className="pt-3 border-t border-outline-variant space-y-2 mt-auto">
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Verification & Authorization Workflow
                            </span>
                            <span className="text-[10px] text-on-surface-variant/80 font-medium">
                              4-Tier Approval Chain
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="p-2 rounded border border-outline-variant bg-surface-container-low text-center flex flex-col justify-between">
                              <div>
                                <span className="font-bold text-on-surface block text-[10px]">1. Prepared By</span>
                                <p className="text-[9.5px] text-on-surface-variant font-medium mt-0.5 truncate">{creatingUserName}</p>
                              </div>
                              <div className="mt-1.5">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">Initiated</span>
                              </div>
                            </div>

                            <div className="p-2 rounded border border-outline-variant bg-surface-container-low text-center flex flex-col justify-between">
                              <div>
                                <span className="font-bold text-on-surface block text-[10px]">2. Verify By MEngg</span>
                                <p className="text-[9.5px] text-on-surface-variant font-medium mt-0.5">Maintenance Engineer</p>
                              </div>
                              <div className="mt-1.5">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] bg-primary/10 text-primary font-semibold">Pending Check</span>
                              </div>
                            </div>

                            <div className="p-2 rounded border border-outline-variant bg-surface-container-low text-center flex flex-col justify-between">
                              <div>
                                <span className="font-bold text-on-surface block text-[10px]">3. Accounts</span>
                                <p className="text-[9.5px] text-on-surface-variant font-medium mt-0.5">Accounts Dept</p>
                              </div>
                              <div className="mt-1.5">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold">Audit Check</span>
                              </div>
                            </div>

                            <div className="p-2 rounded border border-outline-variant bg-surface-container-low text-center flex flex-col justify-between">
                              <div>
                                <span className="font-bold text-on-surface block text-[10px]">4. Verify By Engg</span>
                                <p className="text-[9.5px] text-on-surface-variant font-medium mt-0.5">Project / Site Engineer</p>
                              </div>
                              <div className="mt-1.5">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] bg-primary/10 text-primary font-semibold">Final Check</span>
                              </div>
                            </div>
                          </div>
                        </div> */}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: ALL TIED EXPENSES */}
              {activeTab === 'all' && (
                <div className="border border-outline-variant rounded overflow-hidden bg-surface-container shadow-2xs">
                  <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-low dark:bg-dark-surface-container-low flex items-center justify-between">
                    <h3 className="text-xs font-bold  tracking-wider text-on-surface flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-primary" />
                      All Expenses Tied to Bundle
                    </h3>
                    <span className="text-[11px] text-on-surface-variant font-mono">
                      Total: {allFlattenedExpenses.length} items
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-on-surface border-collapse">
                      <thead className="bg-surface-container-high text-on-surface-variant uppercase text-[11px] font-bold tracking-wider border-b border-outline-variant">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-10">#</th>
                          <th className="py-2.5 px-3 text-left">Worker</th>
                          <th className="py-2.5 px-3 text-left">Ticket</th>
                          <th className="py-2.5 px-3 text-left">Location</th>
                          <th className="py-2.5 px-3 text-left">Sub Dept</th>
                          <th className="py-2.5 px-3 text-left">Ledger Batch</th>
                          <th className="py-2.5 px-3 text-left">Category</th>
                          <th className="py-2.5 px-3 text-center">Date</th>
                          <th className="py-2.5 px-3 text-left">Remarks</th>
                          <th className="py-2.5 px-4 text-right bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/60">
                        {allFlattenedExpenses.map((exp: any, idx: number) => (
                          <tr key={exp.expenseId || idx} className="hover:bg-surface-container-high/40 transition-colors">
                            <td className="py-2.5 px-3 text-center text-on-surface-variant font-mono">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-semibold text-on-surface">{exp.workerName}</td>
                            <td className="py-2.5 px-3 font-mono text-primary font-semibold">{exp.ticketNo}</td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 font-bold text-on-surface">
                                <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span>{exp.location}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-on-surface-variant">{exp.subDepartment}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                {exp.batchName}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-on-surface">{exp.category}</td>
                            <td className="py-2.5 px-3 text-center font-mono text-on-surface-variant">{exp.date || '-'}</td>
                            <td className="py-2.5 px-3 text-on-surface-variant max-w-xs truncate" title={exp.remarks}>{exp.remarks || '-'}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                              KD {exp.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-surface-container-high font-extrabold border-t-2 border-outline-variant text-xs">
                        <tr>
                          <td colSpan={9} className="py-3 px-4 text-right uppercase tracking-wider text-on-surface">
                            Grand Total:
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-sm font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/15">
                            KD {grandTotals.grandAmount.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
