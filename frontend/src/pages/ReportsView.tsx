import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  BarChart3, Calendar, DollarSign, Wrench, Store, Users,
  TrendingUp, Download, Printer, Search, AlertCircle
} from 'lucide-react';
import type { RootState } from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const ReportsView: React.FC = () => {
  const { subpage } = useParams<{ subpage: string }>();
  const { token } = useSelector((state: RootState) => state.auth);

  // States
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchReportData();
  }, [subpage, token, startDate, endDate]);

  const fetchReportData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const headers = { Authorization: `Token ${token}` };
      let endpoint = `${API_URL}/maintenance/ticket/`; // Fallback default

      if (subpage === 'tickets' || !subpage) {
        endpoint = `${API_URL}/maintenance/ticket/`;
      } else if (subpage === 'store-performance') {
        endpoint = `${API_URL}/stores/store/`;
      } else if (subpage === 'labour-cost') {
        endpoint = `${API_URL}/maintenance/worklog/`;
      } else if (subpage === 'expenses') {
        endpoint = `${API_URL}/finance/expense/`;
      } else if (subpage === 'worker-performance') {
        endpoint = `${API_URL}/maintenance/worklog/`;
      } else if (subpage === 'monthly-summary') {
        endpoint = `${API_URL}/finance/reconciliation/`;
      } else if (subpage === 'reconciliation') {
        endpoint = `${API_URL}/finance/reconciliation/`;
      }

      // Add query params for date filtering if provided
      let queryUrl = endpoint;
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (params.toString()) {
        queryUrl += `?${params.toString()}`;
      }

      const response = await fetch(queryUrl, { headers });
      if (response.ok) {
        setData(await response.json());
      } else {
        setErrorMsg('Failed to aggregate report metrics.');
      }
    } catch (err) {
      setErrorMsg('Network issue retrieving report data.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Stats calculation fallback mock summaries depending on endpoints
  const totalCost = data.reduce((acc, curr) => acc + Number(curr.amount || curr.labour_amount || curr.grand_total || 0), 0);
  const totalHours = data.reduce((acc, curr) => acc + Number(curr.hours || curr.planned_hours || 0), 0);

  const filteredData = data.filter(item => {
    const text = (item.title || item.store_name || item.worker?.full_name || item.ticket?.title || item.remarks || '').toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Report Header Filters */}
      <div className="p-4 bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-2xl flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-outline font-semibold">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="text-xs bg-surface dark:bg-dark-surface-container-low border border-outline-variant rounded p-1.5 outline-none text-on-surface dark:text-dark-on-surface"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-outline font-semibold">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="text-xs bg-surface dark:bg-dark-surface-container-low border border-outline-variant rounded p-1.5 outline-none text-on-surface dark:text-dark-on-surface"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-surface-container-high dark:bg-dark-surface-container-high text-on-surface-variant dark:text-dark-on-surface-variant text-xs font-semibold px-4 py-2 border border-outline-variant rounded-xl hover:bg-surface-container-low cursor-pointer transition-all"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Aggregated KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-primary/10 rounded-2xl text-primary">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-outline block uppercase tracking-wider font-semibold">Total Records</span>
            <span className="text-xl font-bold text-on-surface dark:text-dark-on-surface block mt-0.5">{filteredData.length}</span>
          </div>
        </div>

        <div className="p-5 bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-outline block uppercase tracking-wider font-semibold">Total Cost Value</span>
            <span className="text-xl font-bold text-on-surface dark:text-dark-on-surface block mt-0.5">{totalCost.toFixed(2)} KWD</span>
          </div>
        </div>

        <div className="p-5 bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-amber-500/10 rounded-2xl text-amber-500">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-outline block uppercase tracking-wider font-semibold">Total Work Hours</span>
            <span className="text-xl font-bold text-on-surface dark:text-dark-on-surface block mt-0.5">{totalHours.toFixed(1)} Hrs</span>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative max-w-sm w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
        <input
          type="text"
          placeholder="Filter report records..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-sm bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
        />
      </div>

      {/* Main Aggregated Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 w-full bg-surface-container-high dark:bg-dark-surface-container-low animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high dark:bg-dark-surface-container-high border-b border-outline-variant dark:border-dark-outline-variant text-[10px] uppercase font-bold text-outline tracking-wider">
                  {subpage === 'tickets' || !subpage ? (
                    <>
                      <th className="px-6 py-4">Work Order</th>
                      <th className="px-6 py-4">Store</th>
                      <th className="px-6 py-4">Title</th>
                      <th className="px-6 py-4">Priority</th>
                      <th className="px-6 py-4">Current Status</th>
                      <th className="px-6 py-4">Date Raised</th>
                    </>
                  ) : subpage === 'store-performance' ? (
                    <>
                      <th className="px-6 py-4">Store Code/ID</th>
                      <th className="px-6 py-4">Store Name</th>
                      <th className="px-6 py-4">Area Location</th>
                      <th className="px-6 py-4">Address</th>
                      <th className="px-6 py-4">Manager Name</th>
                    </>
                  ) : subpage === 'labour-cost' ? (
                    <>
                      <th className="px-6 py-4">Log ID</th>
                      <th className="px-6 py-4">Technician</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Hours Logged</th>
                      <th className="px-6 py-4">Hourly Cost Rate</th>
                      <th className="px-6 py-4">Labour Amount</th>
                    </>
                  ) : subpage === 'expenses' ? (
                    <>
                      <th className="px-6 py-4">Claim ID</th>
                      <th className="px-6 py-4">Claimant</th>
                      <th className="px-6 py-4">Expense Type</th>
                      <th className="px-6 py-4">Expense Date</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Status</th>
                    </>
                  ) : subpage === 'worker-performance' ? (
                    <>
                      <th className="px-6 py-4">Technician Name</th>
                      <th className="px-6 py-4">Activity Date</th>
                      <th className="px-6 py-4">Hours Contributed</th>
                      <th className="px-6 py-4">Work Performed Description</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4">Reconciliation ID</th>
                      <th className="px-6 py-4">Ticket</th>
                      <th className="px-6 py-4">Labour Sum</th>
                      <th className="px-6 py-4">Expense Sum</th>
                      <th className="px-6 py-4">Grand Total Cost</th>
                      <th className="px-6 py-4">Verification Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant dark:divide-dark-outline-variant text-sm">
                {filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low transition-all">
                    {subpage === 'tickets' || !subpage ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.work_order_no}</td>
                        <td className="px-6 py-4">{item.store?.store_name}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.title}</td>
                        <td className="px-6 py-4">{item.priority?.priority_name}</td>
                        <td className="px-6 py-4 font-semibold text-primary">{item.status?.status_name}</td>
                        <td className="px-6 py-4 text-xs text-outline">{new Date(item.created_date).toLocaleString()}</td>
                      </>
                    ) : subpage === 'store-performance' ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.store_id}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.store_name}</td>
                        <td className="px-6 py-4">{item.area?.area_name || 'N/A'}</td>
                        <td className="px-6 py-4 text-xs text-outline">{item.address}</td>
                        <td className="px-6 py-4">{item.manager?.full_name || 'No Manager'}</td>
                      </>
                    ) : subpage === 'labour-cost' ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.worklog_id}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.worker?.full_name}</td>
                        <td className="px-6 py-4 text-xs">{item.work_date}</td>
                        <td className="px-6 py-4">{item.hours} Hrs</td>
                        <td className="px-6 py-4 font-mono text-xs">{item.hourly_rate} KWD/hr</td>
                        <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">{item.labour_amount} KWD</td>
                      </>
                    ) : subpage === 'expenses' ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.expense_id}</td>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.worker?.full_name}</td>
                        <td className="px-6 py-4">{item.expense_type?.expense_name}</td>
                        <td className="px-6 py-4 text-xs">{item.expense_date}</td>
                        <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">{item.amount} KWD</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.approved ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                          }`}>
                            {item.approved ? 'Approved' : 'Pending Review'}
                          </span>
                        </td>
                      </>
                    ) : subpage === 'worker-performance' ? (
                      <>
                        <td className="px-6 py-4 font-medium text-on-surface dark:text-dark-on-surface">{item.worker?.full_name}</td>
                        <td className="px-6 py-4 text-xs text-outline">{item.work_date}</td>
                        <td className="px-6 py-4">{item.hours} Hrs</td>
                        <td className="px-6 py-4 text-xs max-w-[200px] truncate">{item.work_done}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-semibold">{item.reconciliation_id}</td>
                        <td className="px-6 py-4">{item.ticket?.work_order_no} - {item.ticket?.title}</td>
                        <td className="px-6 py-4">{item.labour_total} KWD</td>
                        <td className="px-6 py-4">{item.expense_total} KWD</td>
                        <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">{item.grand_total} KWD</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.completed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                          }`}>
                            {item.completed ? 'Reconciled' : 'Draft'}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
