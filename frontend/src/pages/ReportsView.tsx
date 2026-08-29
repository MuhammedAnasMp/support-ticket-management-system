import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  FileText, Play, Download, Save, Plus, Trash2, ChevronRight,
  ChevronDown, Database, Filter, Layers, ArrowUpDown, Palette,
  Eye, Copy, FileSpreadsheet, FileCode, Check, RefreshCw, X,
  Grid, ListFilter, SlidersHorizontal, Share2, History, Clock
} from 'lucide-react';
import type { RootState } from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

interface DataSource {
  key: string;
  label: string;
  description: string;
}

interface FieldNode {
  name: string;
  path: string;
  label: string;
  type: string;
  relation_type?: string;
  related_model?: string;
  nullable?: boolean;
  choices?: { value: any; label: string }[];
  children?: FieldNode[];
  is_aggregatable?: boolean;
}

interface ColumnConfig {
  path: string;
  label: string;
  type?: string;
  width?: number;
  alignment?: 'left' | 'center' | 'right';
  format?: string;
}

interface FilterCondition {
  path: string;
  operator: string;
  value: any;
}

interface FilterGroup {
  logic: 'AND' | 'OR';
  conditions: FilterCondition[];
}

interface SortItem {
  path: string;
  direction: 'asc' | 'desc';
}

interface AggregationItem {
  path: string;
  function: 'count' | 'sum' | 'avg' | 'min' | 'max';
  label: string;
}

interface ReportDefinition {
  report_id?: number;
  name: string;
  description: string;
  data_source: string;
  definition: {
    columns: ColumnConfig[];
    filters: FilterGroup;
    sorting: SortItem[];
    grouping?: {
      fields: string[];
      aggregations: AggregationItem[];
    };
    aggregations?: AggregationItem[];
    watermark_text?: string;
    enable_qr?: boolean;
    enable_signatures?: boolean;
  };
  theme: string;
  page_orientation: 'portrait' | 'landscape';
  page_size: 'A4' | 'A3' | 'Letter';
}

const DEFAULT_THEMES = [
  { key: 'corporate_blue', label: 'Corporate Blue', color: 'bg-blue-900' },
  { key: 'maintenance', label: 'Maintenance Dark', color: 'bg-slate-900' },
  { key: 'finance', label: 'Finance Emerald', color: 'bg-emerald-900' },
  { key: 'minimal', label: 'Minimal Light', color: 'bg-gray-200' },
  { key: 'executive', label: 'Executive Purple', color: 'bg-purple-950' },
];

export const ReportsView: React.FC = () => {
  const { subpage } = useParams<{ subpage: string }>();
  const navigate = useNavigate();
  const token = useSelector((state: RootState) => state.auth.token);

  // View state: 'list' | 'builder' | 'history'
  const [mode, setMode] = useState<'list' | 'builder' | 'history'>('list');

  // List data
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [prebuiltTemplates, setPrebuiltTemplates] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Audit Logs data
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Sharing Modal state
  const [showShareModal, setShowShareModal] = useState(false);

  // Builder data
  const [sources, setSources] = useState<DataSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [fieldTree, setFieldTree] = useState<FieldNode[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // Active Report Definition
  const [reportDef, setReportDef] = useState<ReportDefinition>({
    name: 'New Custom Report',
    description: '',
    data_source: '',
    definition: {
      columns: [],
      filters: { logic: 'AND', conditions: [] },
      sorting: [],
      aggregations: [],
    },
    theme: 'corporate_blue',
    page_orientation: 'portrait',
    page_size: 'A4',
  });

  // Active Tab in Builder
  const [activeTab, setActiveTab] = useState<'columns' | 'filters' | 'grouping' | 'layout'>('columns');

  // Preview State
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Export State
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  // Search filter for field tree
  const [fieldSearch, setFieldSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchSavedReports();
    fetchPrebuiltTemplates();
    fetchDataSources();
  }, [token]);

  const fetchPrebuiltTemplates = async () => {
    try {
      const res = await fetch(`${API_URL}/reports/templates/`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setPrebuiltTemplates(data);
      }
    } catch (err) {
      console.error('Failed to load prebuilt templates', err);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`${API_URL}/reports/logs/`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (selectedSource) {
      fetchFieldTree(selectedSource);
    }
  }, [selectedSource, token]);

  const authHeaders = {
    'Authorization': `Token ${token}`,
    'Content-Type': 'application/json',
  };

  const fetchSavedReports = async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${API_URL}/reports/definitions/`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setSavedReports(data);
      }
    } catch (err) {
      console.error('Failed to load saved reports', err);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchDataSources = async () => {
    try {
      const res = await fetch(`${API_URL}/reports/sources/`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      }
    } catch (err) {
      console.error('Failed to load data sources', err);
    }
  };

  const fetchFieldTree = async (sourceKey: string) => {
    setLoadingFields(true);
    try {
      const res = await fetch(`${API_URL}/reports/sources/${sourceKey}/fields/`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setFieldTree(data.fields || []);
      }
    } catch (err) {
      console.error('Failed to load field tree', err);
    } finally {
      setLoadingFields(false);
    }
  };

  const handleSelectSource = (sourceKey: string) => {
    setSelectedSource(sourceKey);
    setReportDef(prev => ({
      ...prev,
      data_source: sourceKey,
      definition: {
        columns: [],
        filters: { logic: 'AND', conditions: [] },
        sorting: [],
        aggregations: [],
      }
    }));
    setPreviewResult(null);
  };

  const toggleNodeExpand = (path: string) => {
    setExpandedNodes(prev => ({ ...prev, [path]: !prev[path] }));
  };

  // Field Selection Helpers
  const addColumn = (field: FieldNode) => {
    if (reportDef.definition.columns.some(c => c.path === field.path)) return;
    const newCol: ColumnConfig = {
      path: field.path,
      label: field.label,
      type: field.type,
      alignment: field.is_aggregatable ? 'right' : 'left',
    };
    setReportDef(prev => ({
      ...prev,
      definition: {
        ...prev.definition,
        columns: [...prev.definition.columns, newCol],
      }
    }));
  };

  const removeColumn = (path: string) => {
    setReportDef(prev => ({
      ...prev,
      definition: {
        ...prev.definition,
        columns: prev.definition.columns.filter(c => c.path !== path),
      }
    }));
  };

  // Filter Helpers
  const addFilter = () => {
    const defaultField = fieldTree[0]?.path || '';
    setReportDef(prev => ({
      ...prev,
      definition: {
        ...prev.definition,
        filters: {
          ...prev.definition.filters,
          conditions: [
            ...prev.definition.filters.conditions,
            { path: defaultField, operator: 'equals', value: '' },
          ]
        }
      }
    }));
  };

  const updateFilter = (index: number, key: keyof FilterCondition, val: any) => {
    setReportDef(prev => {
      const updated = [...prev.definition.filters.conditions];
      updated[index] = { ...updated[index], [key]: val };
      return {
        ...prev,
        definition: {
          ...prev.definition,
          filters: { ...prev.definition.filters, conditions: updated }
        }
      };
    });
  };

  const removeFilter = (index: number) => {
    setReportDef(prev => ({
      ...prev,
      definition: {
        ...prev.definition,
        filters: {
          ...prev.definition.filters,
          conditions: prev.definition.filters.conditions.filter((_, i) => i !== index),
        }
      }
    }));
  };

  // Sorting Helpers
  const addSort = () => {
    const defaultField = reportDef.definition.columns[0]?.path || fieldTree[0]?.path || '';
    setReportDef(prev => ({
      ...prev,
      definition: {
        ...prev.definition,
        sorting: [...prev.definition.sorting, { path: defaultField, direction: 'asc' }],
      }
    }));
  };

  const removeSort = (index: number) => {
    setReportDef(prev => ({
      ...prev,
      definition: {
        ...prev.definition,
        sorting: prev.definition.sorting.filter((_, i) => i !== index),
      }
    }));
  };

  // Execute Preview
  const runPreview = async () => {
    if (!selectedSource) return;
    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const res = await fetch(`${API_URL}/reports/preview/`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          data_source: selectedSource,
          definition: reportDef.definition,
          format: 'preview',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPreviewResult(data);
      } else {
        setPreviewError(data.detail || 'Failed to generate preview');
      }
    } catch (err) {
      setPreviewError('Network error while executing report preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Export Document
  const triggerExport = async (fmt: 'pdf' | 'excel' | 'csv') => {
    if (!selectedSource) return;
    setExportingFormat(fmt);

    try {
      const res = await fetch(`${API_URL}/reports/export/`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          data_source: selectedSource,
          definition: {
            ...reportDef.definition,
            name: reportDef.name,
            description: reportDef.description,
            theme: reportDef.theme,
            page_orientation: reportDef.page_orientation,
            page_size: reportDef.page_size,
          },
          format: fmt,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportDef.name.toLowerCase().replace(/\s+/g, '_')}.${fmt === 'excel' ? 'xlsx' : fmt}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Export failed: ${errData.detail || 'Server error (' + res.status + ')'}`);
      }
    } catch (err) {
      alert('Network error during export.');
    } finally {
      setExportingFormat(null);
    }
  };

  // Save Report Definition
  const saveReport = async () => {
    if (!reportDef.name.trim()) {
      alert('Please enter a report title.');
      return;
    }

    try {
      const url = reportDef.report_id
        ? `${API_URL}/reports/definitions/${reportDef.report_id}/`
        : `${API_URL}/reports/definitions/`;
      const method = reportDef.report_id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(reportDef),
      });

      if (res.ok) {
        const saved = await res.json();
        setReportDef(saved);
        alert('Report saved successfully!');
        fetchSavedReports();
      } else {
        alert('Failed to save report.');
      }
    } catch (err) {
      alert('Error saving report.');
    }
  };

  // Render Recursive Field Tree
  const renderFieldTreeNodes = (nodes: FieldNode[]) => {
    return nodes.map(node => {
      const isRelation = node.type === 'relation' || node.type === 'reverse_relation';
      const isExpanded = expandedNodes[node.path];
      const isSelected = reportDef.definition.columns.some(c => c.path === node.path);

      if (fieldSearch && !node.label.toLowerCase().includes(fieldSearch.toLowerCase()) && !node.path.toLowerCase().includes(fieldSearch.toLowerCase())) {
        if (!node.children || !node.children.some(c => c.label.toLowerCase().includes(fieldSearch.toLowerCase()))) {
          return null;
        }
      }

      return (
        <div key={node.path} className="text-xs">
          <div
            className={`flex items-center justify-between px-2 py-1 rounded hover:bg-surface-container-high cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 text-primary font-medium' : ''
              }`}
          >
            <div
              className="flex items-center gap-1.5 flex-1 min-w-0"
              onClick={() => isRelation ? toggleNodeExpand(node.path) : addColumn(node)}
            >
              {isRelation ? (
                <button type="button" className="p-0.5 text-on-surface-variant hover:text-on-surface">
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <span className="w-3.5 h-3.5 text-on-surface-variant font-mono text-[9px] flex items-center justify-center">
                  {node.type === 'integer' || node.type === 'decimal' ? '#' : node.type === 'date' || node.type === 'datetime' ? '📅' : 'T'}
                </span>
              )}

              <span className="truncate" title={node.path}>{node.label}</span>
              {isRelation && (
                <span className="text-[9px] px-1 bg-surface-container rounded text-on-surface-variant">
                  {node.relation_type === 'one_to_many' ? '1:N' : 'FK'}
                </span>
              )}
            </div>

            {!isRelation && (
              <button
                type="button"
                onClick={() => isSelected ? removeColumn(node.path) : addColumn(node)}
                className={`p-1 rounded text-[10px] transition-colors ${isSelected ? 'text-red-500 hover:bg-red-500/10' : 'text-primary hover:bg-primary/10'
                  }`}
              >
                {isSelected ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              </button>
            )}
          </div>

          {isRelation && isExpanded && node.children && (
            <div className="ml-3 pl-2 border-l border-outline-variant/50 space-y-0.5 my-0.5">
              {renderFieldTreeNodes(node.children)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-surface text-on-surface select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-outline-variant bg-surface-container-low shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-base tracking-tight leading-tight">
              Universal Report Builder
            </h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Metadata-driven dynamic PDF, Excel, and CSV reporting engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'builder' ? (
            <>
              <button
                onClick={() => setMode('list')}
                className="px-3 py-1.5 rounded border border-outline-variant text-xs font-medium hover:bg-surface-container-high transition-colors"
              >
                Saved Reports
              </button>
              <button
                onClick={runPreview}
                disabled={previewLoading || !selectedSource}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-on-primary text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {previewLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run Preview
              </button>
              <button
                onClick={saveReport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary text-primary text-xs font-medium hover:bg-primary/10 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save Report
              </button>
            </>
          ) : mode === 'history' ? (
            <button
              onClick={() => setMode('list')}
              className="px-3 py-1.5 rounded border border-outline-variant text-xs font-medium hover:bg-surface-container-high transition-colors"
            >
              Saved Reports
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  fetchLogs();
                  setMode('history');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-outline-variant text-xs font-medium hover:bg-surface-container-high transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                Audit Logs
              </button>
              <button
                onClick={() => {
                  setReportDef({
                    name: 'New Custom Report',
                    description: '',
                    data_source: '',
                    definition: { columns: [], filters: { logic: 'AND', conditions: [] }, sorting: [], aggregations: [] },
                    theme: 'corporate_blue',
                    page_orientation: 'portrait',
                    page_size: 'A4',
                  });
                  setSelectedSource('');
                  setPreviewResult(null);
                  setMode('builder');
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create New Report
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {mode === 'list' ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {/* Pre-built Templates Section */}
          {prebuiltTemplates.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                    Standard Pre-built Templates
                  </h2>
                  <p className="text-xs text-on-surface-variant/70">
                    Ready-to-use report blueprints for maintenance, financial, and workforce reporting.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {prebuiltTemplates.map(tpl => (
                  <div
                    key={tpl.id}
                    className="p-4 rounded border border-primary/20 bg-primary/5 hover:border-primary transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary text-on-primary">
                          {tpl.category}
                        </span>
                        <span className="text-[10px] text-on-surface-variant font-mono">{tpl.data_source}</span>
                      </div>
                      <h3 className="font-semibold text-sm text-on-surface mb-1">{tpl.name}</h3>
                      <p className="text-xs text-on-surface-variant line-clamp-2 mb-3">{tpl.description}</p>
                    </div>

                    <button
                      onClick={() => {
                        setReportDef({
                          name: tpl.name,
                          description: tpl.description,
                          data_source: tpl.data_source,
                          definition: tpl.definition,
                          theme: tpl.theme,
                          page_orientation: tpl.page_orientation,
                          page_size: tpl.page_size,
                        });
                        setSelectedSource(tpl.data_source);
                        setMode('builder');
                      }}
                      className="w-full py-1.5 bg-primary text-on-primary rounded text-xs font-semibold hover:bg-primary/90 transition-colors text-center"
                    >
                      Use Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Saved Reports Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                Saved Custom Reports ({savedReports.length})
              </h2>
            </div>

            {loadingList ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : savedReports.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-outline-variant rounded-xl">
                <FileText className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-2" />
                <p className="text-xs font-medium text-on-surface">No saved custom reports yet</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Use a pre-built template above or click "Create New Report" to design one.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedReports.map(report => (
                  <div
                    key={report.report_id}
                    className="p-4 rounded border border-outline-variant bg-surface-container-low hover:border-primary/50 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {report.data_source}
                        </span>
                        <span className="text-[10px] text-on-surface-variant">v{report.version}</span>
                      </div>
                      <h3 className="font-semibold text-sm text-on-surface mb-1">{report.name}</h3>
                      {report.description && (
                        <p className="text-xs text-on-surface-variant line-clamp-2 mb-3">{report.description}</p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-between text-xs text-on-surface-variant">
                      <span>By {report.created_by_name}</span>
                      <button
                        onClick={() => {
                          setReportDef(report);
                          setSelectedSource(report.data_source);
                          setMode('builder');
                        }}
                        className="px-3 py-1 bg-primary text-on-primary rounded font-medium hover:bg-primary/90 transition-colors text-[11px]"
                      >
                        Open Builder
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : mode === 'history' ? (
        /* Audit History Logs View */
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                Report Generation Audit Logs
              </h2>
              <p className="text-xs text-on-surface-variant/70">
                Complete execution history, execution durations, row counts, and exported formats.
              </p>
            </div>
            <button
              onClick={fetchLogs}
              className="p-1.5 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors"
              title="Refresh logs"
            >
              <RefreshCw className="w-4 h-4 text-on-surface-variant" />
            </button>
          </div>

          {loadingLogs ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-outline-variant rounded-xl">
              <History className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-2" />
              <p className="text-xs font-medium text-on-surface">No generation audit logs recorded yet</p>
            </div>
          ) : (
            <div className="bg-surface rounded-xl border border-outline-variant shadow-sm overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-high border-b border-outline-variant font-semibold text-on-surface text-[11px]">
                    <th className="p-3">Log ID</th>
                    <th className="p-3">Report Name</th>
                    <th className="p-3">Data Source</th>
                    <th className="p-3">Format</th>
                    <th className="p-3">Rows</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Generated By</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {logs.map(log => (
                    <tr key={log.log_id} className="hover:bg-surface-container-low transition-colors">
                      <td className="p-3 font-mono text-[10px] text-on-surface-variant">#{log.log_id}</td>
                      <td className="p-3 font-semibold text-on-surface">{log.report_name}</td>
                      <td className="p-3 font-mono text-[10px] text-primary">{log.data_source}</td>
                      <td className="p-3">
                        <span className={`uppercase font-bold text-[9px] px-2 py-0.5 rounded ${log.export_format === 'pdf' ? 'bg-red-500/10 text-red-600' :
                          log.export_format === 'excel' ? 'bg-emerald-500/10 text-emerald-600' :
                            log.export_format === 'csv' ? 'bg-blue-500/10 text-blue-600' : 'bg-gray-500/10 text-gray-600'
                          }`}>
                          {log.export_format}
                        </span>
                      </td>
                      <td className="p-3 font-mono">{log.row_count.toLocaleString()}</td>
                      <td className="p-3 font-mono text-[11px] text-on-surface-variant">{log.duration_ms} ms</td>
                      <td className="p-3">{log.generated_by_name}</td>
                      <td className="p-3 text-on-surface-variant text-[11px]">
                        {new Date(log.generated_date).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Builder View */
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Field Browser */}
          <div className="w-72 border-r border-outline-variant bg-surface-container-low flex flex-col shrink-0">
            <div className="p-3 border-b border-outline-variant space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant block">
                1. Select Data Source
              </label>
              <select
                value={selectedSource}
                onChange={e => handleSelectSource(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="">-- Choose Data Source --</option>
                {sources.map(src => (
                  <option key={src.key} value={src.key}>
                    {src.label} ({src.key})
                  </option>
                ))}
              </select>
            </div>

            {selectedSource && (
              <>
                <div className="p-3 border-b border-outline-variant space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant block">
                    2. Browse Available Fields
                  </label>
                  <input
                    type="text"
                    placeholder="Filter fields..."
                    value={fieldSearch}
                    onChange={e => setFieldSearch(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin">
                  {loadingFields ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : (
                    renderFieldTreeNodes(fieldTree)
                  )}
                </div>
              </>
            )}
          </div>

          {/* Middle Panel: Config Tabs & Controls */}
          <div className="w-96 border-r border-outline-variant bg-surface-container-low flex flex-col shrink-0">
            {/* Report Metadata inputs */}
            <div className="p-3 border-b border-outline-variant space-y-2">
              <input
                type="text"
                value={reportDef.name}
                onChange={e => setReportDef(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Report Name"
                className="w-full text-xs font-semibold px-2.5 py-1.5 rounded border border-outline-variant bg-surface text-on-surface focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                value={reportDef.description}
                onChange={e => setReportDef(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Report Subtitle / Description"
                className="w-full text-[11px] px-2.5 py-1 rounded border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
              />
            </div>

            {/* Config Tabs Header */}
            <div className="flex border-b border-outline-variant bg-surface-container text-xs font-medium">
              <button
                onClick={() => setActiveTab('columns')}
                className={`flex-1 py-2 text-center transition-colors border-b-2 ${activeTab === 'columns' ? 'border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
              >
                Columns ({reportDef.definition.columns.length})
              </button>
              <button
                onClick={() => setActiveTab('filters')}
                className={`flex-1 py-2 text-center transition-colors border-b-2 ${activeTab === 'filters' ? 'border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
              >
                Filters ({reportDef.definition.filters.conditions.length})
              </button>
              <button
                onClick={() => setActiveTab('grouping')}
                className={`flex-1 py-2 text-center transition-colors border-b-2 ${activeTab === 'grouping' ? 'border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
              >
                Sort & Group
              </button>
              <button
                onClick={() => setActiveTab('layout')}
                className={`flex-1 py-2 text-center transition-colors border-b-2 ${activeTab === 'layout' ? 'border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
              >
                Theme
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
              {/* COLUMNS TAB */}
              {activeTab === 'columns' && (
                <div className="space-y-2">
                  <div className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider">
                    Selected Report Columns
                  </div>
                  {reportDef.definition.columns.length === 0 ? (
                    <p className="text-xs text-on-surface-variant/70 italic py-4 text-center">
                      No columns selected yet. Click fields in the left panel to add them.
                    </p>
                  ) : (
                    reportDef.definition.columns.map((col, idx) => (
                      <div key={col.path} className="p-2 rounded border border-outline-variant bg-surface space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-primary truncate max-w-[200px]" title={col.path}>
                            {col.path}
                          </span>
                          <button
                            onClick={() => removeColumn(col.path)}
                            className="text-red-500 hover:text-red-700 p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-on-surface-variant block">Header Label</label>
                            <input
                              type="text"
                              value={col.label}
                              onChange={e => {
                                const val = e.target.value;
                                setReportDef(prev => {
                                  const cols = [...prev.definition.columns];
                                  cols[idx] = { ...cols[idx], label: val };
                                  return { ...prev, definition: { ...prev.definition, columns: cols } };
                                });
                              }}
                              className="w-full text-[11px] px-1.5 py-0.5 rounded border border-outline-variant bg-surface-container"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] text-on-surface-variant block">Align</label>
                            <select
                              value={col.alignment || 'left'}
                              onChange={e => {
                                const val = e.target.value as any;
                                setReportDef(prev => {
                                  const cols = [...prev.definition.columns];
                                  cols[idx] = { ...cols[idx], alignment: val };
                                  return { ...prev, definition: { ...prev.definition, columns: cols } };
                                });
                              }}
                              className="w-full text-[11px] px-1.5 py-0.5 rounded border border-outline-variant bg-surface-container"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* FILTERS TAB */}
              {activeTab === 'filters' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider">
                      Report Filter Conditions
                    </span>
                    <button
                      onClick={addFilter}
                      className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                    >
                      <Plus className="w-3 h-3" /> Add Condition
                    </button>
                  </div>

                  {reportDef.definition.filters.conditions.length === 0 ? (
                    <p className="text-xs text-on-surface-variant/70 italic py-4 text-center">
                      No filters applied. Report will return all permitted records.
                    </p>
                  ) : (
                    reportDef.definition.filters.conditions.map((cond, idx) => (
                      <div key={idx} className="p-2 rounded border border-outline-variant bg-surface space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-on-surface-variant">Condition #{idx + 1}</span>
                          <button onClick={() => removeFilter(idx)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <select
                          value={cond.path}
                          onChange={e => updateFilter(idx, 'path', e.target.value)}
                          className="w-full text-[11px] px-1.5 py-1 rounded border border-outline-variant bg-surface-container"
                        >
                          {reportDef.definition.columns.map(c => (
                            <option key={c.path} value={c.path}>{c.label} ({c.path})</option>
                          ))}
                        </select>

                        <div className="grid grid-cols-2 gap-1.5">
                          <select
                            value={cond.operator}
                            onChange={e => updateFilter(idx, 'operator', e.target.value)}
                            className="text-[11px] px-1.5 py-1 rounded border border-outline-variant bg-surface-container"
                          >
                            <option value="equals">Equals</option>
                            <option value="not_equals">Not Equals</option>
                            <option value="contains">Contains</option>
                            <option value="gte">Greater or Equal</option>
                            <option value="lte">Less or Equal</option>
                            <option value="is_null">Is Null</option>
                            <option value="is_not_null">Is Not Null</option>
                          </select>

                          <input
                            type="text"
                            placeholder="Value"
                            value={cond.value}
                            onChange={e => updateFilter(idx, 'value', e.target.value)}
                            className="text-[11px] px-1.5 py-1 rounded border border-outline-variant bg-surface-container"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* SORT & GROUP TAB */}
              {activeTab === 'grouping' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider">
                        Sort Order
                      </span>
                      <button onClick={addSort} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add Sort Field
                      </button>
                    </div>

                    {reportDef.definition.sorting.map((sort, idx) => (
                      <div key={idx} className="flex items-center gap-2 mb-1.5 text-xs">
                        <select
                          value={sort.path}
                          onChange={e => {
                            const val = e.target.value;
                            setReportDef(prev => {
                              const s = [...prev.definition.sorting];
                              s[idx] = { ...s[idx], path: val };
                              return { ...prev, definition: { ...prev.definition, sorting: s } };
                            });
                          }}
                          className="flex-1 text-[11px] px-1.5 py-1 rounded border border-outline-variant bg-surface-container"
                        >
                          {reportDef.definition.columns.map(c => (
                            <option key={c.path} value={c.path}>{c.label}</option>
                          ))}
                        </select>

                        <select
                          value={sort.direction}
                          onChange={e => {
                            const val = e.target.value as any;
                            setReportDef(prev => {
                              const s = [...prev.definition.sorting];
                              s[idx] = { ...s[idx], direction: val };
                              return { ...prev, definition: { ...prev.definition, sorting: s } };
                            });
                          }}
                          className="text-[11px] px-1.5 py-1 rounded border border-outline-variant bg-surface-container"
                        >
                          <option value="asc">ASC (A-Z)</option>
                          <option value="desc">DESC (Z-A)</option>
                        </select>

                        <button onClick={() => removeSort(idx)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LAYOUT / THEME TAB */}
              {activeTab === 'layout' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider block mb-1.5">
                      Visual Theme
                    </label>
                    <div className="space-y-1.5">
                      {DEFAULT_THEMES.map(theme => (
                        <div
                          key={theme.key}
                          onClick={() => setReportDef(prev => ({ ...prev, theme: theme.key }))}
                          className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors text-xs ${reportDef.theme === theme.key ? 'border-primary bg-primary/10 font-semibold' : 'border-outline-variant bg-surface hover:bg-surface-container'
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-3.5 h-3.5 rounded-full ${theme.color}`} />
                            <span>{theme.label}</span>
                          </div>
                          {reportDef.theme === theme.key && <Check className="w-4 h-4 text-primary" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider block mb-1">
                        Page Orientation
                      </label>
                      <select
                        value={reportDef.page_orientation}
                        onChange={e => setReportDef(prev => ({ ...prev, page_orientation: e.target.value as any }))}
                        className="w-full text-xs px-2 py-1.5 rounded border border-outline-variant bg-surface-container"
                      >
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider block mb-1">
                        Paper Size
                      </label>
                      <select
                        value={reportDef.page_size}
                        onChange={e => setReportDef(prev => ({ ...prev, page_size: e.target.value as any }))}
                        className="w-full text-xs px-2 py-1.5 rounded border border-outline-variant bg-surface-container"
                      >
                        <option value="A4">A4</option>
                        <option value="A3">A3</option>
                        <option value="Letter">Letter</option>
                      </select>
                    </div>
                  </div>

                  {/* Phase 4 Polish Controls */}
                  <div className="space-y-3 pt-3 border-t border-outline-variant">
                    <span className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider block">
                      Output Controls & Security
                    </span>

                    <div>
                      <label className="text-[10px] text-on-surface-variant block mb-1">Watermark Text</label>
                      <input
                        type="text"
                        placeholder="e.g. CONFIDENTIAL, DRAFT"
                        value={reportDef.definition.watermark_text || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setReportDef(prev => ({
                            ...prev,
                            definition: { ...prev.definition, watermark_text: val }
                          }));
                        }}
                        className="w-full text-xs px-2 py-1.5 rounded border border-outline-variant bg-surface-container"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs text-on-surface font-medium">Embed QR Verification Code</label>
                      <input
                        type="checkbox"
                        checked={reportDef.definition.enable_qr !== false}
                        onChange={e => {
                          const checked = e.target.checked;
                          setReportDef(prev => ({
                            ...prev,
                            definition: { ...prev.definition, enable_qr: checked }
                          }));
                        }}
                        className="rounded border-outline-variant text-primary focus:ring-primary"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs text-on-surface font-medium">Add Approval Signature Lines</label>
                      <input
                        type="checkbox"
                        checked={Boolean(reportDef.definition.enable_signatures)}
                        onChange={e => {
                          const checked = e.target.checked;
                          setReportDef(prev => ({
                            ...prev,
                            definition: { ...prev.definition, enable_signatures: checked }
                          }));
                        }}
                        className="rounded border-outline-variant text-primary focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Live Preview & Export Bar */}
          <div className="flex-1 flex flex-col overflow-hidden bg-surface-container">
            {/* Export Toolbar */}
            <div className="px-4 py-2 border-b border-outline-variant bg-surface-container-low flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-on-surface">
                <Eye className="w-4 h-4 text-primary" />
                <span>Live Data Preview</span>
                {previewResult && (
                  <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {previewResult.row_count} rows ({previewResult.duration_ms}ms)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerExport('pdf')}
                  disabled={!previewResult || exportingFormat === 'pdf'}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  <Download className="w-3 h-3" /> PDF
                </button>
                <button
                  onClick={() => triggerExport('excel')}
                  disabled={!previewResult || exportingFormat === 'excel'}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-3 h-3" /> Excel
                </button>
                <button
                  onClick={() => triggerExport('csv')}
                  disabled={!previewResult || exportingFormat === 'csv'}
                  className="flex items-center gap-1 px-2.5 py-1 rounded border border-outline-variant text-xs font-medium hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  <FileCode className="w-3 h-3" /> CSV
                </button>
              </div>
            </div>

            {/* Preview Output */}
            <div className="flex-1 overflow-auto p-4 scrollbar-thin">
              {previewLoading ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-on-surface-variant">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-xs font-medium">Executing query engine...</span>
                </div>
              ) : previewError ? (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-xs">
                  <strong>Query Error:</strong> {previewError}
                </div>
              ) : !previewResult ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-on-surface-variant/60">
                  <SlidersHorizontal className="w-12 h-12 stroke-[1.5]" />
                  <p className="text-xs font-medium">Configure columns and click "Run Preview" to test your report.</p>
                </div>
              ) : previewResult.rows.length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant text-xs">
                  Query returned 0 rows matching your conditions.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* KPI Cards Preview */}
                  {previewResult.kpi_cards && previewResult.kpi_cards.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {previewResult.kpi_cards.map((card: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-lg border border-outline-variant bg-surface shadow-sm">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                            {card.label}
                          </div>
                          <div className="text-xl font-bold text-primary mt-1">
                            {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Chart Images Preview */}
                  {previewResult.charts && previewResult.charts.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {previewResult.charts.map((chart: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-lg border border-outline-variant bg-surface shadow-sm text-center">
                          <h4 className="text-xs font-semibold text-on-surface mb-2">{chart.title}</h4>
                          <img src={chart.image} alt={chart.title} className="max-w-full h-auto mx-auto rounded" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Data Table */}
                  <div className="bg-surface rounded-lg border border-outline-variant shadow-sm overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse table-fixed">
                      <thead>
                        <tr className="bg-surface-container-high border-b border-outline-variant font-semibold text-on-surface text-[11px]">
                          {previewResult.columns.map((col: any) => (
                            <th key={col.path} className={`p-2.5 text-${col.alignment || 'left'} break-words`}>
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/40">
                        {previewResult.rows.map((row: any, rIdx: number) => (
                          <tr key={rIdx} className="hover:bg-surface-container-low transition-colors">
                            {previewResult.columns.map((col: any) => (
                              <td key={col.path} className={`p-2.5 text-${col.alignment || 'left'} break-words`}>
                                {row[col.path] !== null && row[col.path] !== undefined ? String(row[col.path]) : '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;
