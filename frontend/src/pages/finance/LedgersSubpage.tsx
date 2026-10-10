import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Layers, PlusCircle, Trash2, X, AlertCircle, Loader2, Building2, ShieldCheck,
  CheckCircle2, AlertTriangle, Boxes, Tag, ChevronDown, ChevronRight, Rows3,
  ChevronsUp, Check, RotateCcw, User, Calendar, Users, Receipt,
  FileText, ExternalLink, Eye, EyeOff, Clock, FolderKanban, Lock, CheckCircle, Package,
  RefreshCw, Plus, GitCommit, Send
} from 'lucide-react';
import type { LedgerItem, WorkerClaimItem, LedgerGroupItem, ExpenseItem, LedgerBatchItem, ApprovalStepInfo, ApprovalInstanceItem } from './types';
import { Pagination } from './Pagination';
import { SearchableSelect, type SelectOption } from '../../components/SearchableSelect';
import { ApprovalsSubpage, type ApprovalsSubpageProps } from './ApprovalsSubpage';
import { LedgerGroupReportModal, type LedgerGroupCluster } from './LedgerGroupReportModal';
import { AvatarCircle } from '../ticket/TicketsTypesAndComponents';

interface LedgersSubpageProps {
  filteredLedgers?: LedgerItem[];
  ledgers: LedgerItem[];
  bundles: WorkerClaimItem[];
  ledgerGroups: LedgerGroupItem[];
  ledgerBatches?: LedgerBatchItem[];
  loading: boolean;
  submitting: boolean;
  renderStatusBadge: (status: string, isActionableForMe?: boolean, stepName?: string, hasCurrentUserApproved?: boolean) => React.ReactNode;
  expandedLedgerIds: Record<number, boolean>;
  toggleExpandLedger: (ledgerId: number) => void;
  handleSubmitLedger: (ledgerId: number) => void;
  setShowPaymentModal: (item: LedgerItem) => void;
  handleDeleteLedger: (ledgerId: number) => void;
  openEditBundleModal: (bundle: WorkerClaimItem) => void;
  openAddExpenseModal?: (ledger: LedgerItem) => void;
  handleRemoveExpenseFromLedger: (ledgerId: number, expenseId: number) => void;
  handleAddBundleToLedger?: (ledgerId: number, bundleId: number) => Promise<void>;
  handleAddBundleToGroup?: (groupId: number, bundleId: number | number[]) => Promise<void>;
  handleRemoveBundleFromLedger?: (ledgerId: number, bundleId: number) => Promise<void>;
  handleRemoveBundleFromGroup?: (groupId: number, bundleId: number) => Promise<void>;
  handleDeleteLedgerGroup?: (groupId: number) => Promise<void>;
  showCreateLedgerModal: boolean;
  setShowCreateLedgerModal: (show: boolean) => void;
  selectedBundleIds: number[];
  setSelectedBundleIds: (ids: number[]) => void;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  newGroupName: string;
  setNewGroupName: (name: string) => void;
  ledgerRemarks?: string;
  setLedgerRemarks?: (remarks: string) => void;
  handleCreateLedger: () => void;
  showAddExpenseModal?: LedgerItem | null;
  setShowAddExpenseModal?: (item: LedgerItem | null) => void;
  loadingAvailableExpenses?: boolean;
  availableApprovedExpenses?: ExpenseItem[];
  selectedAddExpenseId?: number | null;
  setSelectedAddExpenseId?: (id: number | null) => void;
  handleAddExpenseToLedger?: () => void;
  token?: string;
  API_URL?: string;
  approvalsProps?: ApprovalsSubpageProps;
  currentUser?: any;
  onRefresh?: () => Promise<void> | void;
  onLedgerUpdated?: (updatedLedger: LedgerItem) => void;
  onLedgersUpdated?: (updatedLedgers: LedgerItem[]) => void;
  currentPage?: number;
  totalItems?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
  onItemsPerPageChange?: (num: number) => void;
  setSelectedTicketForModal?: (ticket: any) => void;
}

export const LedgersSubpage: React.FC<LedgersSubpageProps> = ({
  ledgers,
  filteredLedgers = ledgers,
  bundles,
  ledgerGroups,
  ledgerBatches = [],
  loading,
  submitting,
  renderStatusBadge,
  expandedLedgerIds,
  toggleExpandLedger,
  handleSubmitLedger,
  setShowPaymentModal,
  handleDeleteLedger,
  openEditBundleModal,
  openAddExpenseModal,
  handleRemoveExpenseFromLedger,
  handleAddBundleToLedger,
  handleAddBundleToGroup,
  handleRemoveBundleFromLedger,
  handleRemoveBundleFromGroup,
  handleDeleteLedgerGroup,
  showCreateLedgerModal,
  setShowCreateLedgerModal,
  selectedBundleIds,
  setSelectedBundleIds,
  selectedGroupId,
  setSelectedGroupId,
  newGroupName,
  setNewGroupName,
  ledgerRemarks = '',
  setLedgerRemarks,
  handleCreateLedger,
  showAddExpenseModal,
  setShowAddExpenseModal,
  loadingAvailableExpenses,
  availableApprovedExpenses,
  selectedAddExpenseId,
  setSelectedAddExpenseId,
  handleAddExpenseToLedger,
  token,
  API_URL,
  approvalsProps,
  currentUser,
  onRefresh,
  onLedgerUpdated,
  onLedgersUpdated,
  currentPage: propCurrentPage,
  totalItems: propTotalItems,
  itemsPerPage: propItemsPerPage,
  onPageChange: propOnPageChange,
  onItemsPerPageChange: propOnItemsPerPageChange,
  setSelectedTicketForModal
}) => {
  // Stepper Visibility State
  const [showStepper, setShowStepper] = useState<boolean>(true);

  // Refreshing State
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleRefreshClick = async () => {
    if (isRefreshing || loading || !onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Ledger Group Accordion State (groupId -> boolean expanded)
  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string | number, boolean>>({});

  const toggleGroupAccordion = (groupId: string | number) => {
    setExpandedGroupIds(prev => {
      const isCurrentlyExpanded = !!prev[groupId];
      const next = { ...prev };
      if (isCurrentlyExpanded) {
        delete next[groupId];
        // When closing a group, collapse its child batches
        const cluster = groupedLedgerClusters.find(c => String(c.groupId) === String(groupId));
        if (cluster) {
          cluster.ledgers.forEach(l => {
            if (expandedLedgerIds[l.ledger_id]) {
              toggleExpandLedger(l.ledger_id);
            }
          });
        }
      } else {
        next[groupId] = true;
      }
      return next;
    });
  };

  // Report Modal State for Ledger Group
  const [selectedGroupForReport, setSelectedGroupForReport] = useState<LedgerGroupCluster | null>(null);

  // Mark as Completed & Lock Group States
  const [groupToConfirmComplete, setGroupToConfirmComplete] = useState<LedgerGroupCluster | null>(null);
  const [completingGroupId, setCompletingGroupId] = useState<string | number | null>(null);
  const [completingGroupError, setCompletingGroupError] = useState<string | null>(null);

  // Complete Ledger Group API Handler
  const handleCompleteLedgerGroup = async (cluster: LedgerGroupCluster) => {
    if (!cluster || !cluster.groupId || !API_URL) return;
    setCompletingGroupId(cluster.groupId);
    setCompletingGroupError(null);

    try {
      const res = await fetch(`${API_URL}/finance/ledger-groups/${cluster.groupId}/complete/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Failed to mark ledger group as completed.');
      }

      const completedGroup: LedgerGroupItem = data;

      // Synchronize dynamicGroups state in place
      setDynamicGroups(prev =>
        prev.map(g => (String(g.ledger_group_id) === String(completedGroup.ledger_group_id) ? { ...g, ...completedGroup } : g))
      );

      // Instantly update ledgers in memory
      cluster.ledgers.forEach(l => {
        const updatedBatch: LedgerItem = {
          ...l,
          ledger_group_detail: {
            ...(l.ledger_group_detail || {}),
            ...completedGroup,
            is_completed: true,
            completed_at: completedGroup.completed_at,
            completed_by_detail: completedGroup.completed_by_detail,
          } as LedgerGroupItem
        };
        if (onLedgerUpdated) {
          onLedgerUpdated(updatedBatch);
        }
      });

      setGroupToConfirmComplete(null);
    } catch (err: any) {
      setCompletingGroupError(err.message || 'Failed to complete ledger group.');
    } finally {
      setCompletingGroupId(null);
    }
  };

  // Group-level Submission & Approval States
  const [submittingGroupId, setSubmittingGroupId] = useState<string | number | null>(null);
  const [actioningGroupId, setActioningGroupId] = useState<string | number | null>(null);
  const [actioningGroupAction, setActioningGroupAction] = useState<'APPROVED' | 'REWORK' | null>(null);
  const [groupReworkComments, setGroupReworkComments] = useState<Record<string | number, string>>({});
  const [groupReworkErrors, setGroupReworkErrors] = useState<Record<string | number, string>>({});

  // Group-level Submit Handler
  const handleGroupSubmit = async (cluster: LedgerGroupCluster) => {
    if (!cluster || !cluster.groupId || !API_URL) return;
    const totalBundlesInGroup = (cluster.ledgers || []).reduce((sum, l) => sum + (l.bundles?.length || 0) + (l.expenses?.length || 0), 0);
    if (totalBundlesInGroup === 0) {
      setBulkActionMsg({
        type: 'error',
        text: `Cannot submit Ledger Group '${cluster.groupName}': Must have at least one claim bundle attached.`
      });
      return;
    }
    setSubmittingGroupId(cluster.groupId);
    setBulkActionMsg(null);
    try {
      const res = await fetch(`${API_URL}/finance/ledger-groups/${cluster.groupId}/submit/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Failed to submit ledger group');
      }
      if (Array.isArray(data)) {
        if (onLedgersUpdated) {
          onLedgersUpdated(data);
        } else if (onLedgerUpdated) {
          data.forEach(l => {
            onLedgerUpdated(l);
          });
        }
      }
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      setBulkActionMsg({
        type: 'error',
        text: err.message || 'Failed to submit ledger group'
      });
    } finally {
      setSubmittingGroupId(null);
    }
  };

  // Group-level Approval Action Handler
  const handleGroupAction = async (cluster: LedgerGroupCluster, action: 'APPROVED' | 'REWORK') => {
    if (!cluster || !cluster.groupId || !API_URL) return;
    const comment = groupReworkComments[cluster.groupId] || '';
    if (action === 'REWORK' && !comment.trim()) {
      setGroupReworkErrors(prev => ({ ...prev, [cluster.groupId]: 'Comment is required when requesting rework.' }));
      return;
    }
    setActioningGroupId(cluster.groupId);
    setActioningGroupAction(action);
    setBulkActionMsg(null);
    try {
      const res = await fetch(`${API_URL}/finance/ledger-groups/${cluster.groupId}/action/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, comments: comment })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Failed to action ledger group');
      }
      if (Array.isArray(data)) {
        if (onLedgersUpdated) {
          onLedgersUpdated(data);
        } else if (onLedgerUpdated) {
          data.forEach(l => {
            onLedgerUpdated(l);
          });
        }
      }
      if (onRefresh) {
        await onRefresh();
      }
      setGroupReworkComments(prev => ({ ...prev, [cluster.groupId]: '' }));
      setGroupReworkErrors(prev => {
        const next = { ...prev };
        delete next[cluster.groupId];
        return next;
      });
    } catch (err: any) {
      setBulkActionMsg({
        type: 'error',
        text: err.message || 'Failed to action ledger group'
      });
    } finally {
      setActioningGroupId(null);
      setActioningGroupAction(null);
    }
  };

  // Delete Ledger Group State & Handler
  const [deletingGroupId, setDeletingGroupId] = useState<string | number | null>(null);
  const [removingBundleKey, setRemovingBundleKey] = useState<string | null>(null);

  const onDeleteLedgerGroup = async (cluster: LedgerGroupCluster) => {
    if (!cluster || !cluster.groupId) return;
    if (!window.confirm(`Are you sure you want to delete Ledger Group "${cluster.groupName}" (${cluster.groupId})?\n\nAll batches in this group will be deleted and attached claim bundles will return to available status.`)) {
      return;
    }
    setDeletingGroupId(cluster.groupId);
    setBulkActionMsg(null);
    try {
      if (handleDeleteLedgerGroup) {
        await handleDeleteLedgerGroup(Number(cluster.groupId));
      } else if (API_URL) {
        const res = await fetch(`${API_URL}/finance/ledger-groups/${cluster.groupId}/`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || data.error || 'Failed to delete Ledger Group');
        }
        if (onRefresh) {
          await onRefresh();
        }
      }
      setDynamicGroups(prev => prev.filter(g => String(g.ledger_group_id) !== String(cluster.groupId)));
    } catch (err: any) {
      setBulkActionMsg({
        type: 'error',
        text: err.message || 'Failed to delete Ledger Group'
      });
    } finally {
      setDeletingGroupId(null);
    }
  };

  // Dynamic Ledger Groups Search State (API-based, latest 10 in new-to-old order)
  const [dynamicGroups, setDynamicGroups] = useState<LedgerGroupItem[]>(ledgerGroups || []);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fallback Ledger Batches State
  const [internalBatches, setInternalBatches] = useState<LedgerBatchItem[]>(ledgerBatches || []);
  const batchesFetchedRef = useRef<boolean>(false);

  useEffect(() => {
    if (ledgerBatches && ledgerBatches.length > 0) {
      setInternalBatches(ledgerBatches);
    }
  }, [ledgerBatches]);

  const fetchLedgerBatches = async () => {
    if (!API_URL || batchesFetchedRef.current) return;
    batchesFetchedRef.current = true;
    try {
      const res = await fetch(`${API_URL}/finance/ledger-batches/?page_size=100`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const results: LedgerBatchItem[] = Array.isArray(data)
          ? data
          : (Array.isArray(data.results) ? data.results : []);
        setInternalBatches(results);
      }
    } catch (err) {
      console.error('Failed to fetch ledger batches:', err);
    }
  };

  useEffect(() => {
    if (showCreateLedgerModal && (!ledgerBatches || ledgerBatches.length === 0) && !batchesFetchedRef.current) {
      fetchLedgerBatches();
    }
  }, [showCreateLedgerModal, ledgerBatches]);

  useEffect(() => {
    if (ledgerGroups && ledgerGroups.length > 0) {
      setDynamicGroups(ledgerGroups);
    }
  }, [ledgerGroups]);

  const fetchLedgerGroups = async (searchTerm: string = '') => {
    if (!API_URL) return;
    setLoadingGroups(true);
    try {
      const url = searchTerm.trim()
        ? `${API_URL}/finance/ledger-groups/?search=${encodeURIComponent(searchTerm.trim())}&page_size=10`
        : `${API_URL}/finance/ledger-groups/?page_size=10`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const results: LedgerGroupItem[] = Array.isArray(data)
          ? data
          : (Array.isArray(data.results) ? data.results : []);
        setDynamicGroups(results);
      }
    } catch (err) {
      console.error('Failed to fetch ledger:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleGroupSearch = (term: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchLedgerGroups(term);
    }, 300);
  };

  useEffect(() => {
    if (showCreateLedgerModal) {
      fetchLedgerGroups('');
    }
  }, [showCreateLedgerModal]);

  const isGroupUnused = (g: LedgerGroupItem) => {
    if (typeof g.ledgers_count === 'number') {
      return g.ledgers_count === 0;
    }
    const hasChildLedgers = (ledgers || []).some(
      l => l.ledger_group === g.ledger_group_id || l.ledger_group_detail?.ledger_group_id === g.ledger_group_id
    );
    if (hasChildLedgers) return false;
    return parseFloat(g.total_amount || '0') === 0;
  };

  const handleDeleteUnusedGroup = async (groupId: string | number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const group = dynamicGroups.find(g => String(g.ledger_group_id) === String(groupId)) ||
      ledgerGroups?.find(g => String(g.ledger_group_id) === String(groupId));
    const groupName = group ? group.group_name : `${groupId}`;
    if (!window.confirm(`Are you sure you want to delete the unused Ledger Group "${groupName}"?`)) {
      return;
    }
    try {
      if (handleDeleteLedgerGroup) {
        await handleDeleteLedgerGroup(Number(groupId));
      } else if (API_URL) {
        const res = await fetch(`${API_URL}/finance/ledger-groups/${groupId}/`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || data.error || 'Failed to delete Ledger Group');
        }
        if (onRefresh) {
          await onRefresh();
        }
      }
      setDynamicGroups(prev => prev.filter(g => String(g.ledger_group_id) !== String(groupId)));
      if (String(selectedGroupId) === String(groupId)) {
        setSelectedGroupId('');
      }
    } catch (err: any) {
      setBulkActionMsg({
        type: 'error',
        text: err.message || 'Failed to delete Ledger Group'
      });
    }
  };

  const ledgerGroupSelectOptions: SelectOption[] = useMemo(() => {
    const list = dynamicGroups.filter(g => !g.is_completed);
    if (selectedGroupId && !list.some(g => String(g.ledger_group_id) === String(selectedGroupId))) {
      const foundInProp = ledgerGroups?.find(g => String(g.ledger_group_id) === String(selectedGroupId));
      if (foundInProp) {
        list.unshift(foundInProp);
      }
    }
    return [
      { value: '', label: '-- Create New Ledger Group --' },
      ...list.map(g => {
        const unused = isGroupUnused(g);
        return {
          value: String(g.ledger_group_id),
          label: `${g.group_name} (${parseFloat(g.total_amount).toFixed(2)} KD)${unused ? ' • [Unused]' : ''}`,
          canDelete: unused,
          deleteTooltip: `Delete unused group "${g.group_name}"`
        };
      })
    ];
  }, [dynamicGroups, ledgerGroups, selectedGroupId, ledgers]);

  const existingGroupWithSameName = useMemo(() => {
    const name = newGroupName.trim().toLowerCase();
    if (!name) return null;
    return (
      dynamicGroups.find(g => g.group_name?.trim().toLowerCase() === name) ||
      ledgerGroups?.find(g => g.group_name?.trim().toLowerCase() === name) ||
      null
    );
  }, [newGroupName, dynamicGroups, ledgerGroups]);

  // Multi-line View State
  const [isMultiLineView, setIsMultiLineView] = useState<boolean>(false);

  // Inline Rework Comments & Errors per Ledger
  const [reworkComments, setReworkComments] = useState<Record<number, string>>({});
  const [reworkErrors, setReworkErrors] = useState<Record<number, string>>({});
  const [actioningLedgerId, setActioningLedgerId] = useState<number | null>(null);
  const [actioningActionType, setActioningActionType] = useState<'APPROVED' | 'REWORK' | null>(null);

  // Bulk Approval State
  const [bulkApproving, setBulkApproving] = useState<boolean>(false);
  const [bulkActionMsg, setBulkActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Drill-down View Mode per Expanded Ledger: 'by_sub_department' | 'by_worker' | 'flat_table'
  // Drill-down View Mode (Global default & per Expanded Ledger): 'by_sub_department' | 'by_worker' | 'flat_table'
  // Hierarchy Display Mode: 'batch_wise' (Default) vs 'bundle_wise'
  const formatTicketDisplay = (exp: any): string => {
    if (!exp) return '-';
    if (exp.ticket_details?.work_order_no) return String(exp.ticket_details.work_order_no);
    if (exp.ticket_details?.ticket_code) return String(exp.ticket_details.ticket_code);
    if (exp.ticket_details?.ticket_id) return `${exp.ticket_details.ticket_id}`;
    if (typeof exp.ticket === 'object' && exp.ticket !== null) {
      return exp.ticket.work_order_no ? String(exp.ticket.work_order_no) : (exp.ticket.ticket_code ? String(exp.ticket.ticket_code) : (exp.ticket.ticket_id ? `${exp.ticket.ticket_id}` : '-'));
    }
    if (typeof exp.ticket === 'number' || typeof exp.ticket === 'string') {
      return String(exp.ticket);
    }
    return '-';
  };

  const getTicketForModal = (exp: any) => {
    if (!exp) return null;
    if (exp.ticket_details) return exp.ticket_details;
    if (typeof exp.ticket === 'object' && exp.ticket !== null) return exp.ticket;
    if (exp.ticket) return { ticket_id: exp.ticket };
    return null;
  };

  const [hierarchyGrouping, setHierarchyGrouping] = useState<'batch_wise' | 'bundle_wise'>('bundle_wise');
  const [expandedGroupBundleKeys, setExpandedGroupBundleKeys] = useState<Record<string, boolean>>({});

  const toggleExpandGroupBundle = (groupId: number | string, bundleId: number) => {
    const key = `${groupId}_${bundleId}`;
    setExpandedGroupBundleKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const [globalViewMode, setGlobalViewMode] = useState<'by_sub_department' | 'by_worker' | 'flat_table'>('by_sub_department');
  const [ledgerViewModes, setLedgerViewModes] = useState<Record<number, 'by_sub_department' | 'by_worker' | 'flat_table'>>({});

  // Sub-Department & Worker Accordion State inside Expanded Ledger (Default: Collapsed)
  const [expandedSubDepts, setExpandedSubDepts] = useState<Record<string, boolean>>({});
  const [expandedWorkers, setExpandedWorkers] = useState<Record<string, boolean>>({});
  const [expandedNestedWorkers, setExpandedNestedWorkers] = useState<Record<string, boolean>>({});
  const [expandedNestedSubDepts, setExpandedNestedSubDepts] = useState<Record<string, boolean>>({});

  const toggleSubDeptAccordion = (ledgerId: number, subDeptKey: string) => {
    const key = `${ledgerId}_${subDeptKey}`;
    setExpandedSubDepts(prev => {
      const willBeExpanded = !prev[key];
      // When collapsing parent sub-department, collapse all its child worker accordions
      if (!willBeExpanded) {
        setExpandedNestedWorkers(nestedPrev => {
          const updated = { ...nestedPrev };
          const prefix = `${ledgerId}_${subDeptKey}_`;
          Object.keys(updated).forEach(k => {
            if (k.startsWith(prefix)) {
              delete updated[k];
            }
          });
          return updated;
        });
      }
      return { ...prev, [key]: willBeExpanded };
    });
  };

  const toggleWorkerAccordion = (ledgerId: number, workerKey: string) => {
    const key = `${ledgerId}_${workerKey}`;
    setExpandedWorkers(prev => {
      const willBeExpanded = !prev[key];
      // When collapsing parent worker, collapse all its child sub-department accordions
      if (!willBeExpanded) {
        setExpandedNestedSubDepts(nestedPrev => {
          const updated = { ...nestedPrev };
          const prefix = `${ledgerId}_${workerKey}_`;
          Object.keys(updated).forEach(k => {
            if (k.startsWith(prefix)) {
              delete updated[k];
            }
          });
          return updated;
        });
      }
      return { ...prev, [key]: willBeExpanded };
    });
  };

  const toggleNestedWorkerAccordion = (ledgerId: number, subDeptKey: string, workerKey: string) => {
    const key = `${ledgerId}_${subDeptKey}_${workerKey}`;
    setExpandedNestedWorkers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleNestedSubDeptAccordion = (ledgerId: number, workerKey: string, subDeptKey: string) => {
    const key = `${ledgerId}_${workerKey}_${subDeptKey}`;
    setExpandedNestedSubDepts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Pagination State
  const [localPage, setLocalPage] = useState(1);
  const [localItemsPerPage, setLocalItemsPerPage] = useState(10);

  const currentPage = propCurrentPage !== undefined ? propCurrentPage : localPage;
  const itemsPerPage = propItemsPerPage !== undefined ? propItemsPerPage : localItemsPerPage;
  const handlePageChange = propOnPageChange || setLocalPage;
  const handleItemsPerPageChange = propOnItemsPerPageChange || ((num: number) => {
    setLocalItemsPerPage(num);
    setLocalPage(1);
  });

  const isServerPaginated = propOnPageChange !== undefined;

  // Helper to find pending approval instance for a Ledger
  const getLedgerApproval = (ledgerId: number): ApprovalInstanceItem | undefined => {
    const list = approvalsProps?.displayedApprovals || approvalsProps?.approvals || [];
    return list.find(a =>
      (a.ledger === ledgerId ||
        a.ledger_id === ledgerId ||
        (a.target_summary?.type === 'Ledger' && a.target_summary?.id === ledgerId) ||
        (a.workflow_entity_type?.toUpperCase() === 'LEDGER' && (a.ledger === ledgerId || a.ledger_id === ledgerId))) &&
      a.status === 'Pending'
    );
  };

  // Helper to check if current user can approve a Ledger
  const canUserApproveLedger = (ledgerId: number, ledgerApp?: ApprovalInstanceItem): boolean => {
    const app = ledgerApp || getLedgerApproval(ledgerId);
    if (!app) return false;

    if (app.can_action) return true;
    if (currentUser?.is_superuser) return true;

    const userRoleStr = (
      (currentUser?.role as any)?.role_name ||
      (typeof currentUser?.role === 'string' ? currentUser.role : '') ||
      ''
    ).toLowerCase().trim();

    const assignedRoleStr = (app.assigned_role_name || '').toLowerCase().trim();
    if (userRoleStr && assignedRoleStr && userRoleStr === assignedRoleStr) return true;

    const currentUsername = currentUser?.username;
    if (currentUsername && app.workflow_steps?.some(s => s.assigned_users_names?.includes(currentUsername))) {
      return true;
    }

    return false;
  };

  // Inline Ledger Approval Action (Approve / Rework)
  const handleInlineLedgerAction = async (ledger: LedgerItem, action: 'APPROVED' | 'REWORK') => {
    const app = getLedgerApproval(ledger.ledger_id);
    const comment = reworkComments[ledger.ledger_id] || '';

    if (action === 'REWORK' && !comment.trim()) {
      setReworkErrors(prev => ({ ...prev, [ledger.ledger_id]: 'Comment is required for rework.' }));
      return;
    }
    setReworkErrors(prev => ({ ...prev, [ledger.ledger_id]: '' }));

    if (app && approvalsProps?.handleActionApproval) {
      setActioningLedgerId(ledger.ledger_id);
      setActioningActionType(action);
      try {
        await approvalsProps.handleActionApproval(action, comment, app);
        setReworkComments(prev => ({ ...prev, [ledger.ledger_id]: '' }));
      } finally {
        setActioningLedgerId(null);
        setActioningActionType(null);
      }
    } else if (approvalsProps?.setShowApprovalModal && app) {
      approvalsProps.setApprovalAction(action as any);
      approvalsProps.setApprovalComments(comment);
      approvalsProps.setShowApprovalModal(app);
    }
  };

  interface GroupBundleBreakdownItem {
    bundleId: number;
    workerName: string;
    workerUsername?: string;
    workerDetail?: any;
    profileImage?: string | null;
    periodFrom?: string;
    periodTo?: string;
    status?: string;
    totalAmount: number;
    expenses: ExpenseItem[];
    ledgerBatches: { batchId?: number; batchName: string; count: number; amount: number }[];
  }

  const getGroupBundleBreakdown = (cluster: LedgerGroupCluster): GroupBundleBreakdownItem[] => {
    const bundleMap = new Map<number, GroupBundleBreakdownItem>();

    cluster.ledgers.forEach(l => {
      const batchName = l.ledger_batch_detail?.batch_name || `Batch ${l.ledger_id}`;
      const batchId = (l.ledger_batch_detail as any)?.batch_id || (l.ledger_batch_detail as any)?.id || l.ledger_batch;
      const lExpenses = Array.isArray(l.expenses) ? l.expenses : [];

      (l.bundles || []).forEach((b: any) => {
        const bId = b.claim_id || b.id;
        if (bId && !bundleMap.has(bId)) {
          const wObj = b.worker_detail || (typeof b.worker === 'object' ? b.worker : null);
          bundleMap.set(bId, {
            bundleId: bId,
            workerName: wObj?.full_name || wObj?.username || `Worker ${b.worker}`,
            workerUsername: wObj?.username,
            workerDetail: wObj,
            profileImage: wObj?.profile_image || null,
            periodFrom: b.period_from,
            periodTo: b.period_to,
            status: b.status || 'Approved',
            totalAmount: 0,
            expenses: [],
            ledgerBatches: []
          });
        }
      });

      lExpenses.forEach(exp => {
        const rawClaim = exp.claim || (exp as any).claim_id || (exp as any).bundle_id;
        const bId = typeof rawClaim === 'number'
          ? rawClaim
          : (rawClaim?.claim_id || (l.bundles && (l.bundles[0] as any)?.claim_id) || (l.bundles && (l.bundles[0] as any)?.id) || 0);

        if (bId) {
          if (!bundleMap.has(bId)) {
            const matchingBundle = (bundles || []).find(b => b.claim_id === bId);
            const wObj = matchingBundle?.worker_detail || (exp as any).worker_detail || (typeof exp.worker === 'object' ? exp.worker : null);
            bundleMap.set(bId, {
              bundleId: bId,
              workerName: wObj?.full_name || wObj?.username || (exp as any).worker_name || 'Worker',
              workerUsername: wObj?.username,
              workerDetail: wObj,
              profileImage: wObj?.profile_image || null,
              periodFrom: matchingBundle?.period_from,
              periodTo: matchingBundle?.period_to,
              status: matchingBundle?.status || 'Approved',
              totalAmount: 0,
              expenses: [],
              ledgerBatches: []
            });
          }

          const bundleObj = bundleMap.get(bId)!;
          if (!bundleObj.expenses.some(e => e.expense_id === exp.expense_id)) {
            bundleObj.expenses.push(exp);
            bundleObj.totalAmount += parseFloat(exp.amount as any) || 0;

            let bBatch = bundleObj.ledgerBatches.find(bb => bb.batchName === batchName);
            if (!bBatch) {
              bBatch = { batchId, batchName, count: 0, amount: 0 };
              bundleObj.ledgerBatches.push(bBatch);
            }
            bBatch.count += 1;
            bBatch.amount += parseFloat(exp.amount as any) || 0;
          }
        }
      });
    });

    return Array.from(bundleMap.values()).sort((a, b) => b.bundleId - a.bundleId);
  };

  // Approval Stepper Pipeline Renderer for Ledger  (Sleek, Flat)
  const renderGroupApprovalStepper = (cluster: LedgerGroupCluster) => {
    const ledgerIds = new Set(cluster.ledgers.map(l => l.ledger_id));
    const instancesFromProps = (approvalsProps?.approvals || []).filter(a => {
      const aLedger = a.ledger ?? a.ledger_id;
      if (aLedger !== undefined && ledgerIds.has(aLedger)) return true;
      if (a.target_summary?.type === 'Ledger' && a.target_summary?.id !== undefined && ledgerIds.has(a.target_summary.id)) return true;
      if (a.workflow_entity_type?.toUpperCase() === 'LEDGER' && aLedger !== undefined && ledgerIds.has(aLedger)) return true;
      return false;
    });

    const instancesFromHistory = cluster.ledgers.flatMap(l => ((l as any).approval_history || (l as any).approval_instances || []));

    // Combine unique instances
    const allInstancesMap = new Map<string | number, ApprovalInstanceItem>();
    [...instancesFromProps, ...instancesFromHistory].forEach((inst: any) => {
      if (inst && (inst.approval_id || inst.id || inst.step_name)) {
        const key = inst.approval_id || inst.id || `${inst.step_name}_${inst.step_order}`;
        allInstancesMap.set(key, inst);
      }
    });
    const allInstances = Array.from(allInstancesMap.values());

    let steps: ApprovalStepInfo[] = [];
    for (const item of allInstances) {
      if (item.workflow_steps && item.workflow_steps.length > 0) {
        steps = item.workflow_steps;
        break;
      }
    }

    if (steps.length === 0 && approvalsProps?.approvals) {
      const matchAny = approvalsProps.approvals.find(a =>
        a.workflow_steps && a.workflow_steps.length > 0 &&
        (a.target_summary?.type === 'Ledger' || a.ledger || a.workflow_entity_type?.toUpperCase() === 'LEDGER')
      );
      if (matchAny?.workflow_steps) {
        steps = matchAny.workflow_steps;
      }
    }

    if (steps.length === 0 && allInstances.length > 0) {
      const stepNamesSeen = new Set<string>();
      allInstances.forEach(i => {
        if (i.step_name && !stepNamesSeen.has(i.step_name)) {
          stepNamesSeen.add(i.step_name);
          steps.push({
            step_id: steps.length + 1,
            step_order: (typeof i.step_order === 'number' ? i.step_order : steps.length + 1),
            step_name: i.step_name,
            assigned_role_name: i.assigned_role_name || ''
          });
        }
      });
    }

    // Reliable fallback steps if workflow steps not yet loaded
    if (steps.length === 0) {
      steps = [
        {
          step_id: 1,
          step_order: 1,
          step_name: 'Department Manager Approval',
          assigned_role_name: 'Manager'
        },
        {
          step_id: 2,
          step_order: 2,
          step_name: 'Finance Review & Disbursement',
          assigned_role_name: 'Finance'
        }
      ];
    }

    const isDraft = cluster.ledgers.every(l => l.status === 'Draft') || (cluster.ledgers.length === 0);
    const isFinished = cluster.allApproved || cluster.isCompleted || (cluster.ledgers.length > 0 && cluster.ledgers.every(l => l.status === 'Approved' || l.status === 'Paid'));
    const activePendingItem = allInstances.find(i => i.status === 'Pending');
    const activePendingOrder: number = (activePendingItem && typeof activePendingItem.step_order === 'number')
      ? activePendingItem.step_order
      : (isFinished ? steps.length + 1 : (isDraft ? 0 : 1));

    return (
      <div className="py-2 px-1 overflow-x-auto">
        <div className="flex items-start justify-between min-w-[520px]">
          {/* START NODE */}
          <div className="flex flex-col items-center shrink-0 w-16">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border shrink-0 ${isDraft
              ? 'bg-surface-container text-on-surface-variant border-outline-variant/80'
              : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
              }`}>
              {isDraft ? '1' : <Check className="w-3 h-3" />}
            </div>
            <span className="text-[9px] text-on-surface-variant mt-1 font-medium text-center">
              {isDraft ? 'Draft' : 'Submitted'}
            </span>
          </div>

          {/* STEP NODES */}
          {steps.map((step, idx) => {
            const stepOrderNum = typeof step.step_order === 'number' ? step.step_order : (idx + 1);
            const stepInst = allInstances.find(i => i.step_name === step.step_name || i.step_order === step.step_order);
            const isApproved = isFinished || (stepInst && stepInst.status === 'Approved') || (!isDraft && stepOrderNum < activePendingOrder && !stepInst);
            const isPending = !isFinished && !isDraft && ((stepInst && stepInst.status === 'Pending') || (!stepInst && stepOrderNum === activePendingOrder));
            const isRejected = !isDraft && (stepInst && stepInst.status === 'Rejected');
            const isRework = !isDraft && (stepInst && stepInst.status === 'Rework');
            const isUpcoming = !isApproved && !isPending && !isRejected && !isRework;

            let circleClass = "bg-surface-container-high text-on-surface-variant border-outline";
            let labelBadge = step.assigned_role_name;
            let iconNode: React.ReactNode = stepOrderNum;

            const actionUserDisplay = stepInst?.action_by_full_name || stepInst?.action_by_username || '';

            if (isApproved) {
              circleClass = "bg-emerald-500 text-white border-emerald-600 font-bold shadow-xs";
              iconNode = <Check className="w-3 h-3" />;
              labelBadge = actionUserDisplay ? `Approved: ${actionUserDisplay}` : `Approved (${labelBadge || 'Step ' + stepOrderNum})`;
            } else if (isPending) {
              circleClass = "bg-amber-500 text-white border-amber-600 font-bold animate-pulse shadow-xs ring-2 ring-amber-500/30";
              iconNode = stepOrderNum;
              labelBadge = `Pending: ${labelBadge || 'Step ' + stepOrderNum}`;
            } else if (isRejected) {
              circleClass = "bg-rose-600 text-white border-rose-700 font-bold shadow-xs";
              iconNode = <X className="w-3 h-3" />;
              labelBadge = `Rejected: ${actionUserDisplay || 'User'}`;
            } else if (isRework) {
              circleClass = "bg-purple-600 text-white border-purple-700 font-bold shadow-xs";
              iconNode = <RotateCcw className="w-3 h-3" />;
              labelBadge = `Rework: ${actionUserDisplay || 'User'}`;
            } else if (isUpcoming) {
              circleClass = "bg-surface-container text-on-surface-variant/70 border-outline-variant/60";
              iconNode = stepOrderNum;
              labelBadge = `Upcoming (${labelBadge || 'Step ' + stepOrderNum})`;
            }

            const isPrevCompleted = idx === 0 ? (!isDraft) : (isFinished || (!isDraft && stepOrderNum <= activePendingOrder));

            return (
              <React.Fragment key={step.step_id || idx}>
                <div className={`flex-1 h-0.5 mx-1 mt-2.5 transition-colors ${isPrevCompleted && (isApproved || isPending) ? 'bg-emerald-500' : 'bg-outline-variant'}`} />
                <div className="flex flex-col items-center shrink-0 w-24 text-center">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] border transition-all ${circleClass}`}>
                    {iconNode}
                  </div>
                  <span className="text-[9px] font-bold text-on-surface mt-1 truncate max-w-full" title={step.step_name}>
                    {step.step_name}
                  </span>
                  <span className="text-[8px] text-on-surface-variant truncate max-w-full font-medium" title={labelBadge}>
                    {labelBadge}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  // Grouping Helpers for Flat Hierarchical View
  const getSubDepartmentBreakdown = (expenses: ExpenseItem[]) => {
    const subDeptMap = new Map<string, {
      subDeptId: number | string;
      subDeptName: string;
      expenses: ExpenseItem[];
      totalAmount: number;
      workersCount: number;
      workers: Array<{
        workerId: number | string;
        workerName: string;
        employeeNo?: string;
        workerObj?: any;
        profileImage?: string | null;
        expenses: ExpenseItem[];
        totalAmount: number;
      }>;
    }>();

    for (const exp of expenses) {
      const sdId = exp.ticket_details?.sub_department_id ?? exp.sub_department_id ?? 'unassigned';
      const sdName = exp.ticket_details?.sub_department_name ?? exp.sub_department_name ?? 'General Sub-Department';
      const key = String(sdId);

      if (!subDeptMap.has(key)) {
        subDeptMap.set(key, {
          subDeptId: sdId,
          subDeptName: sdName,
          expenses: [],
          totalAmount: 0,
          workersCount: 0,
          workers: [],
        });
      }
      const entry = subDeptMap.get(key)!;
      entry.expenses.push(exp);
      entry.totalAmount += parseFloat(exp.amount || '0');
    }

    // Calculate nested workers per sub-department
    subDeptMap.forEach(sd => {
      const workerMap = new Map<string, {
        workerId: number | string;
        workerName: string;
        employeeNo?: string;
        workerObj?: any;
        profileImage?: string | null;
        expenses: ExpenseItem[];
        totalAmount: number;
      }>();

      sd.expenses.forEach(e => {
        const workerObj = (typeof e.worker === 'object' && e.worker !== null ? e.worker : null) || e.worker_detail;
        const workerId = workerObj?.user_id || workerObj?.id || (typeof e.worker === 'number' ? e.worker : (typeof e.worker === 'string' ? e.worker : 'unassigned'));
        const workerName = workerObj?.full_name || workerObj?.username || (typeof e.worker === 'object' && e.worker !== null ? (e.worker.full_name || e.worker.username) : '') || (e.worker ? `Worker ${e.worker}` : 'Technician');
        const empNo = workerObj?.employee_no || (typeof e.worker === 'object' ? e.worker?.employee_no : undefined);
        const profImg = workerObj?.profile_image || (typeof e.worker === 'object' ? e.worker?.profile_image : null) || null;
        const wKey = String(workerId);

        if (!workerMap.has(wKey)) {
          workerMap.set(wKey, {
            workerId,
            workerName,
            employeeNo: empNo,
            workerObj,
            profileImage: profImg,
            expenses: [],
            totalAmount: 0,
          });
        }
        const wEntry = workerMap.get(wKey)!;
        wEntry.expenses.push(e);
        wEntry.totalAmount += parseFloat(e.amount || '0');
      });

      sd.workers = Array.from(workerMap.values());
      sd.workersCount = Math.max(sd.workers.length, 1);
    });

    return Array.from(subDeptMap.values());
  };

  const getWorkerBreakdown = (expenses: ExpenseItem[]) => {
    const workerMap = new Map<string, {
      workerId: number | string;
      workerName: string;
      employeeNo?: string;
      workerObj?: any;
      profileImage?: string | null;
      expenses: ExpenseItem[];
      totalAmount: number;
      subDeptsCount: number;
      subDepartments: Array<{
        subDeptId: number | string;
        subDeptName: string;
        expenses: ExpenseItem[];
        totalAmount: number;
      }>;
    }>();

    for (const exp of expenses) {
      const workerObj = (typeof exp.worker === 'object' && exp.worker !== null ? exp.worker : null) || exp.worker_detail;
      const workerId = workerObj?.user_id || workerObj?.id || (typeof exp.worker === 'number' ? exp.worker : (typeof exp.worker === 'string' ? exp.worker : 'unassigned'));
      const workerName = workerObj?.full_name || workerObj?.username || (typeof exp.worker === 'object' && exp.worker !== null ? (exp.worker.full_name || exp.worker.username) : '') || (exp.worker ? `Worker ${exp.worker}` : 'Technician');
      const empNo = workerObj?.employee_no || (typeof exp.worker === 'object' ? exp.worker?.employee_no : undefined);
      const profImg = workerObj?.profile_image || (typeof exp.worker === 'object' ? exp.worker?.profile_image : null) || null;
      const key = String(workerId);

      if (!workerMap.has(key)) {
        workerMap.set(key, {
          workerId,
          workerName,
          employeeNo: empNo,
          workerObj,
          profileImage: profImg,
          expenses: [],
          totalAmount: 0,
          subDeptsCount: 0,
          subDepartments: [],
        });
      }
      const entry = workerMap.get(key)!;
      entry.expenses.push(exp);
      entry.totalAmount += parseFloat(exp.amount || '0');
    }

    // Calculate nested sub-departments per worker
    workerMap.forEach(w => {
      const sdMap = new Map<string, {
        subDeptId: number | string;
        subDeptName: string;
        expenses: ExpenseItem[];
        totalAmount: number;
      }>();

      w.expenses.forEach(e => {
        const sdId = e.ticket_details?.sub_department_id ?? e.sub_department_id ?? 'unassigned';
        const sdName = e.ticket_details?.sub_department_name ?? e.sub_department_name ?? 'General Sub-Department';
        const sdKey = String(sdId);

        if (!sdMap.has(sdKey)) {
          sdMap.set(sdKey, {
            subDeptId: sdId,
            subDeptName: sdName,
            expenses: [],
            totalAmount: 0,
          });
        }
        const sdEntry = sdMap.get(sdKey)!;
        sdEntry.expenses.push(e);
        sdEntry.totalAmount += parseFloat(e.amount || '0');
      });

      w.subDepartments = Array.from(sdMap.values());
      w.subDeptsCount = Math.max(w.subDepartments.length, 1);
    });

    return Array.from(workerMap.values());
  };

  const allGroupedLedgerClusters = useMemo<LedgerGroupCluster[]>(() => {
    const map = new Map<string | number, LedgerGroupCluster>();

    for (const l of filteredLedgers) {
      const gId = l.ledger_group_detail?.ledger_group_id || l.ledger_group || `ungrouped_${l.ledger_id}`;
      const matchedDynGroup = dynamicGroups?.find(g => String(g.ledger_group_id) === String(gId))
        || ledgerGroups?.find(g => String(g.ledger_group_id) === String(gId));
      const gDetail = l.ledger_group_detail || matchedDynGroup;
      const gName = gDetail?.group_name || `Ledger ${gId}`;
      const cName = l.created_by_detail?.full_name || l.created_by_detail?.username || 'User';
      const cAt = l.created_at || '';
      const isComp = Boolean(gDetail?.is_completed || matchedDynGroup?.is_completed);
      const compAt = gDetail?.completed_at || matchedDynGroup?.completed_at;
      const compByName = gDetail?.completed_by_detail?.full_name || gDetail?.completed_by_detail?.username
        || matchedDynGroup?.completed_by_detail?.full_name || matchedDynGroup?.completed_by_detail?.username;

      if (!map.has(gId)) {
        map.set(gId, {
          groupId: gId,
          groupName: gName,
          createdByName: cName,
          createdAt: cAt,
          isCompleted: isComp,
          completedAt: compAt,
          completedByName: compByName,
          ledgers: [],
          totalAmount: 0,
          totalBundlesCount: 0,
          totalExpensesCount: 0,
          allApproved: false,
          approvedCount: 0,
          totalCount: 0,
        });
      }

      const cluster = map.get(gId)!;
      cluster.ledgers.push(l);
      if (isComp) {
        cluster.isCompleted = true;
        if (compAt) cluster.completedAt = compAt;
        if (compByName) cluster.completedByName = compByName;
      }
      cluster.totalAmount += parseFloat(l.total_amount || '0');
      cluster.totalBundlesCount += (l.bundles?.length || 0);
      cluster.totalExpensesCount += (l.expenses?.length || 0);
    }

    // Compute approval stats
    for (const cluster of map.values()) {
      cluster.totalCount = cluster.ledgers.length;
      cluster.approvedCount = cluster.ledgers.filter(l => l.status === 'Approved' || l.status === 'Paid').length;
      cluster.allApproved = cluster.totalCount > 0 && cluster.approvedCount === cluster.totalCount;
    }

    return Array.from(map.values());
  }, [filteredLedgers, dynamicGroups, ledgerGroups]);

  const totalItemsCount = propTotalItems !== undefined ? propTotalItems : allGroupedLedgerClusters.length;

  useEffect(() => {
    setLocalPage(1);
  }, [allGroupedLedgerClusters.length]);

  const groupedLedgerClusters = useMemo<LedgerGroupCluster[]>(() => {
    if (isServerPaginated) return allGroupedLedgerClusters;
    const start = (currentPage - 1) * itemsPerPage;
    return allGroupedLedgerClusters.slice(start, start + itemsPerPage);
  }, [isServerPaginated, allGroupedLedgerClusters, currentPage, itemsPerPage]);

  // Pending Actionable Ledger Groups for Bulk Approve
  const pendingActionableGroups = useMemo(() => {
    return groupedLedgerClusters.filter(cluster => {
      if (cluster.isCompleted) return false;
      const isGroupInReview = cluster.ledgers.some(l => l.status === 'Submitted' || l.status === 'In Review');
      if (!isGroupInReview) return false;
      return cluster.ledgers.some(l => {
        const app = getLedgerApproval(l.ledger_id);
        return canUserApproveLedger(l.ledger_id, app);
      });
    });
  }, [groupedLedgerClusters, approvalsProps?.approvals, approvalsProps?.displayedApprovals, currentUser]);

  // Bulk Approve Handler for Ledger Groups
  const handleBulkApproveLedgers = async () => {
    if (pendingActionableGroups.length === 0) return;
    setBulkApproving(true);
    setBulkActionMsg(null);
    try {
      let count = 0;
      for (const cluster of pendingActionableGroups) {
        await handleGroupAction(cluster, 'APPROVED');
        count++;
      }
      setBulkActionMsg({
        type: 'success',
        text: `Successfully approved ${count} pending Ledger`
      });
      setTimeout(() => setBulkActionMsg(null), 4000);
    } catch (err: any) {
      setBulkActionMsg({
        type: 'error',
        text: err.message || 'Error occurred during bulk approval.'
      });
    } finally {
      setBulkApproving(false);
    }
  };



  const areAllGroupsCollapsed = useMemo(() => {
    return groupedLedgerClusters.length > 0 && groupedLedgerClusters.every(c => !expandedGroupIds[c.groupId]);
  }, [groupedLedgerClusters, expandedGroupIds]);

  const toggleAllGroupsAccordion = () => {
    if (areAllGroupsCollapsed) {
      const allOpen: Record<string | number, boolean> = {};
      groupedLedgerClusters.forEach(c => {
        allOpen[c.groupId] = true;
      });
      setExpandedGroupIds(allOpen);
    } else {
      setExpandedGroupIds({});
      Object.keys(expandedLedgerIds).forEach(id => {
        if (expandedLedgerIds[Number(id)]) toggleExpandLedger(Number(id));
      });
      setExpandedSubDepts({});
      setExpandedWorkers({});
      setExpandedNestedWorkers({});
      setExpandedNestedSubDepts({});
    }
  };

  // Classification logic for Assemble Modal
  const classificationResult = useMemo(() => {
    const effectiveBatches = (ledgerBatches && ledgerBatches.length > 0 ? ledgerBatches : internalBatches) || [];
    if (selectedBundleIds.length === 0) {
      return {
        totalExpenses: 0,
        unmappedExpenses: [] as ExpenseItem[],
        unmappedSubDepts: [] as Array<{
          subDeptId?: number;
          subDeptName: string;
          expensesCount: number;
          totalAmount: number;
          tickets: string[];
        }>,
        classifiedBatches: [] as Array<{
          batch: LedgerBatchItem;
          expenses: ExpenseItem[];
          bundles: WorkerClaimItem[];
          total: number;
        }>,
        totalAmount: 0,
        hasUnmapped: false,
      };
    }

    const subDeptToBatch = new Map<number | string, LedgerBatchItem>();
    for (const batch of effectiveBatches.filter(b => b.active)) {
      if (Array.isArray(batch.sub_departments)) {
        for (const sd of batch.sub_departments) {
          const sdId = typeof sd === 'object' && sd !== null ? (sd as any).sub_department_id : sd;
          if (sdId) subDeptToBatch.set(Number(sdId), batch);
          if (typeof sd === 'object' && (sd as any).sub_department_name) {
            subDeptToBatch.set(String((sd as any).sub_department_name).toLowerCase().trim(), batch);
          }
        }
      }
      if (Array.isArray(batch.sub_departments_detail)) {
        for (const sd of batch.sub_departments_detail) {
          if (sd && sd.sub_department_id) {
            subDeptToBatch.set(Number(sd.sub_department_id), batch);
          }
          if (sd && sd.sub_department_name) {
            subDeptToBatch.set(String(sd.sub_department_name).toLowerCase().trim(), batch);
          }
        }
      }
    }

    const validUnassignedIds = new Set(
      bundles
        .filter(b => b.status === 'Approved' && !b.ledger_id && (!b.ledger_details || b.ledger_details.status === 'Rejected') && (!Array.isArray((b as any).ledgers) || (b as any).ledgers.length === 0))
        .map(b => b.claim_id)
    );

    const selectedBundlesList = bundles.filter(b => selectedBundleIds.includes(b.claim_id) && validUnassignedIds.has(b.claim_id));
    const allExpenses: ExpenseItem[] = [];
    const expenseToBundleMap = new Map<number, WorkerClaimItem>();

    for (const b of selectedBundlesList) {
      if (Array.isArray(b.expenses)) {
        for (const exp of b.expenses) {
          allExpenses.push(exp);
          expenseToBundleMap.set(exp.expense_id, b);
        }
      }
    }

    const batchMap = new Map<number | string, {
      batch: LedgerBatchItem;
      expenses: ExpenseItem[];
      bundlesSet: Set<number>;
      total: number;
    }>();
    const unmapped: ExpenseItem[] = [];
    let sumTotal = 0;

    for (const exp of allExpenses) {
      const amt = parseFloat(exp.amount || '0');
      sumTotal += amt;
      const sdId = exp.ticket_details?.sub_department_id ?? exp.sub_department_id;
      const sdName = (exp.ticket_details?.sub_department_name ?? exp.sub_department_name ?? '').toLowerCase().trim();
      const bItem = expenseToBundleMap.get(exp.expense_id);

      const matchedBatch = (sdId ? subDeptToBatch.get(Number(sdId)) : undefined) || (sdName ? subDeptToBatch.get(sdName) : undefined);

      if (!matchedBatch) {
        unmapped.push(exp);
      } else {
        const batchKey = (matchedBatch as any).batch_id ?? matchedBatch.ledger_batch_id ?? matchedBatch.batch_name;
        if (!batchMap.has(batchKey)) {
          batchMap.set(batchKey, {
            batch: matchedBatch,
            expenses: [],
            bundlesSet: new Set<number>(),
            total: 0,
          });
        }
        const bGroup = batchMap.get(batchKey)!;
        bGroup.expenses.push(exp);
        if (bItem) bGroup.bundlesSet.add(bItem.claim_id);
        bGroup.total += amt;
      }
    }

    const classifiedBatches = Array.from(batchMap.values()).map(bg => ({
      batch: bg.batch,
      expenses: bg.expenses,
      bundles: selectedBundlesList.filter(b => bg.bundlesSet.has(b.claim_id)),
      total: bg.total,
    }));

    // Group unmapped expenses by sub-department
    const unmappedSubDeptsMap = new Map<string, {
      subDeptId?: number;
      subDeptName: string;
      expensesCount: number;
      totalAmount: number;
      ticketsSet: Set<string>;
    }>();

    for (const exp of unmapped) {
      const sdId = exp.ticket_details?.sub_department_id ?? exp.sub_department_id;
      const sdName = exp.ticket_details?.sub_department_name ?? exp.sub_department_name ?? 'Unassigned Sub-Department';
      const key = String(sdId || sdName);

      if (!unmappedSubDeptsMap.has(key)) {
        unmappedSubDeptsMap.set(key, {
          subDeptId: sdId ? Number(sdId) : undefined,
          subDeptName: sdName,
          expensesCount: 0,
          totalAmount: 0,
          ticketsSet: new Set<string>(),
        });
      }
      const entry = unmappedSubDeptsMap.get(key)!;
      entry.expensesCount++;
      entry.totalAmount += parseFloat(exp.amount || '0');
      const tLabel = formatTicketDisplay(exp);
      if (tLabel && tLabel !== '-') entry.ticketsSet.add(tLabel);
    }

    const unmappedSubDepts = Array.from(unmappedSubDeptsMap.values()).map(entry => ({
      subDeptId: entry.subDeptId,
      subDeptName: entry.subDeptName,
      expensesCount: entry.expensesCount,
      totalAmount: entry.totalAmount,
      tickets: Array.from(entry.ticketsSet),
    }));

    return {
      totalExpenses: allExpenses.length,
      unmappedExpenses: unmapped,
      unmappedSubDepts,
      classifiedBatches,
      totalAmount: sumTotal,
      hasUnmapped: unmapped.length > 0,
    };
  }, [selectedBundleIds, bundles, ledgerBatches, internalBatches]);

  // Clean stale/attached bundle selections automatically
  useEffect(() => {
    if (showCreateLedgerModal) {
      const validUnassignedIds = new Set(
        bundles
          .filter(b => b.status === 'Approved' && !b.ledger_id && (!b.ledger_details || b.ledger_details.status === 'Rejected') && (!Array.isArray((b as any).ledgers) || (b as any).ledgers.length === 0))
          .map(b => b.claim_id)
      );
      const filtered = selectedBundleIds.filter(id => validUnassignedIds.has(id));
      if (filtered.length !== selectedBundleIds.length) {
        setSelectedBundleIds(filtered);
      }
    }
  }, [showCreateLedgerModal, bundles, selectedBundleIds]);

  // Attach Bundle to Group Modal State
  const [selectedGroupForAddBundle, setSelectedGroupForAddBundle] = useState<LedgerGroupCluster | null>(null);
  const [selectedBundleIdsToAttach, setSelectedBundleIdsToAttach] = useState<number[]>([]);
  const [attachingBundle, setAttachingBundle] = useState<boolean>(false);
  const [attachBundleError, setAttachBundleError] = useState<string | null>(null);
  const [loadingAvailableBundles, setLoadingAvailableBundles] = useState<boolean>(false);
  const [fetchedApprovedBundles, setFetchedApprovedBundles] = useState<WorkerClaimItem[] | null>(null);

  const openAddBundleModal = async (cluster: LedgerGroupCluster) => {
    setSelectedGroupForAddBundle(cluster);
    setSelectedBundleIdsToAttach([]);
    setAttachBundleError(null);
    setLoadingAvailableBundles(true);
    setFetchedApprovedBundles(null);
    try {
      const res = await fetch(`${API_URL}/finance/claim/?status=Approved&ledger_filter=NOT_IN_LEDGER&page_size=100`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.results || []);
        setFetchedApprovedBundles(list);
      } else {
        setFetchedApprovedBundles(bundles);
      }
    } catch (err) {
      console.error("Failed to fetch approved bundles", err);
      setFetchedApprovedBundles(bundles);
    } finally {
      setLoadingAvailableBundles(false);
    }
  };

  const handleAttachBundleToGroup = async () => {
    if (!selectedGroupForAddBundle || selectedBundleIdsToAttach.length === 0) return;
    setAttachingBundle(true);
    setAttachBundleError(null);
    try {
      if (handleAddBundleToGroup) {
        await handleAddBundleToGroup(Number(selectedGroupForAddBundle.groupId), selectedBundleIdsToAttach);
      } else if (handleAddBundleToLedger) {
        for (const bundleId of selectedBundleIdsToAttach) {
          await handleAddBundleToLedger(Number(selectedGroupForAddBundle.groupId), bundleId);
        }
      }
      if (onRefresh) {
        await onRefresh();
      }
      setSelectedGroupForAddBundle(null);
      setSelectedBundleIdsToAttach([]);
      setAttachBundleError(null);
    } catch (err: any) {
      setAttachBundleError(err.message || 'Failed to add bundle(s) to ledger ');
    } finally {
      setAttachingBundle(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded border border-outline-variant bg-surface-container shadow-2xs">
          <span className="text-xs font-medium text-on-surface-variant block">Total Ledger Batches</span>
          <span className="text-2xl font-semibold text-on-surface mt-1 block">{ledgers.length}</span>
        </div>
        <div className="p-4 rounded border border-outline-variant bg-surface-container shadow-2xs">
          <span className="text-xs font-medium text-on-surface-variant block">Pending Approvals Queue</span>
          <span className="text-2xl font-semibold text-amber-500 mt-1 block">
            {ledgers.filter(l => l.status === 'Submitted' || l.status === 'In Review').length}
          </span>
        </div>
        <div className="p-4 rounded border border-outline-variant bg-surface-container shadow-2xs">
          <span className="text-xs font-medium text-on-surface-variant block">Assigned to My Role</span>
          <span className="text-2xl font-semibold text-primary mt-1 block">
            {pendingActionableGroups.length}
          </span>
        </div>
        <div className="p-4 rounded border border-outline-variant bg-surface-container shadow-2xs">
          <span className="text-xs font-medium text-on-surface-variant block">Approved & Settled</span>
          <span className="text-2xl font-semibold text-emerald-500 mt-1 block">
            {ledgers.filter(l => l.status === 'Approved' || l.status === 'Paid').length}
          </span>
        </div>
      </div>

      {/* Main Unified Table Container */}
      <div className="border border-outline-variant rounded overflow-hidden bg-surface-container flex flex-col shadow-xs">
        {/* Table Header Controls */}
        <div className="p-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-on-surface">Ledger</span>
            </div>
            <span className="text-xs text-on-surface-variant font-medium">
              Showing {allGroupedLedgerClusters.length} Ledger{allGroupedLedgerClusters.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* BATCH-WISE vs BUNDLE-WISE SWITCH */}
            <div className="flex items-center p-0.5 rounded bg-surface-container-high border border-outline-variant/70 text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => setHierarchyGrouping('bundle_wise')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${hierarchyGrouping === 'bundle_wise'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
                title="View hierarchy grouped by Worker Claim Bundles"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Bundle-wise</span>
              </button>
              <button
                type="button"
                onClick={() => setHierarchyGrouping('batch_wise')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${hierarchyGrouping === 'batch_wise'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
                title="View hierarchy grouped by Ledger Batches (Sub-Departments)"
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Batch-wise</span>
              </button>
            </div>

            {/* VIEW MODE SWITCH BUTTONS (By Sub-Department, By Worker, Flat Table) - Always shown, disabled when not in Batch-wise view */}
            <div
              className={`flex items-center p-0.5 rounded bg-surface-container-high border border-outline-variant/70 text-xs transition-opacity ${hierarchyGrouping !== 'batch_wise' ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              title={hierarchyGrouping !== 'batch_wise' ? 'Select Batch-wise to change breakdown mode' : undefined}
            >
              <button
                type="button"
                disabled={hierarchyGrouping !== 'batch_wise'}
                onClick={() => {
                  setGlobalViewMode('by_sub_department');
                  setLedgerViewModes({});
                }}
                className={`px-2.5 py-1.5 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors ${hierarchyGrouping === 'batch_wise' && globalViewMode === 'by_sub_department'
                  ? 'bg-primary text-on-primary font-semibold shadow-2xs cursor-pointer'
                  : hierarchyGrouping === 'batch_wise'
                    ? 'text-on-surface-variant hover:text-on-surface cursor-pointer'
                    : 'text-on-surface-variant cursor-not-allowed'
                  }`}
                title="View breakdown by Sub-Department"
              >
                <Building2 className="w-3.5 h-3.5" />
                {/* <span>By Sub-Department</span> */}
              </button>
              <button
                type="button"
                disabled={hierarchyGrouping !== 'batch_wise'}
                onClick={() => {
                  setGlobalViewMode('by_worker');
                  setLedgerViewModes({});
                }}
                className={`px-2.5 py-1.5 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors ${hierarchyGrouping === 'batch_wise' && globalViewMode === 'by_worker'
                  ? 'bg-primary text-on-primary font-semibold shadow-2xs cursor-pointer'
                  : hierarchyGrouping === 'batch_wise'
                    ? 'text-on-surface-variant hover:text-on-surface cursor-pointer'
                    : 'text-on-surface-variant cursor-not-allowed'
                  }`}
                title="View breakdown by Worker"
              >
                <User className="w-3.5 h-3.5" />
                {/* <span>By Worker</span> */}
              </button>
              <button
                type="button"
                disabled={hierarchyGrouping !== 'batch_wise'}
                onClick={() => {
                  setGlobalViewMode('flat_table');
                  setLedgerViewModes({});
                }}
                className={`px-2.5 py-1.5 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors ${hierarchyGrouping === 'batch_wise' && globalViewMode === 'flat_table'
                  ? 'bg-primary text-on-primary font-semibold shadow-2xs cursor-pointer'
                  : hierarchyGrouping === 'batch_wise'
                    ? 'text-on-surface-variant hover:text-on-surface cursor-pointer'
                    : 'text-on-surface-variant cursor-not-allowed'
                  }`}
                title="View flat table of expenses"
              >
                <Receipt className="w-3.5 h-3.5" />
                {/* <span>Flat Table</span> */}
              </button>
            </div>

            {/* Toggle Stepper Visibility Button */}
            <button
              type="button"
              onClick={() => setShowStepper(prev => !prev)}
              className={`px-2.5 py-1.5 rounded border text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${showStepper
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 font-semibold'
                : 'border-outline-variant text-on-surface hover:bg-surface-container'
                }`}
              title={showStepper ? "Approval Stepper is ON - click to hide" : "Approval Stepper is OFF - click to show"}
            >
              <GitCommit className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Stepper {showStepper ? 'On' : 'Off'}</span>
            </button>

            {/* Close All Button */}
            <button
              type="button"
              onClick={() => {
                setExpandedGroupIds({});
                setExpandedGroupBundleKeys({});
                Object.keys(expandedLedgerIds).forEach(id => {
                  if (expandedLedgerIds[Number(id)]) {
                    toggleExpandLedger(Number(id));
                  }
                });
                setIsMultiLineView(false);
                setExpandedSubDepts({});
                setExpandedWorkers({});
                setExpandedNestedWorkers({});
                setExpandedNestedSubDepts({});
              }}
              className="px-2.5 py-1.5 rounded border border-outline-variant text-[11px] font-medium text-on-surface hover:bg-surface-container flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Collapse all opened groups, bundles, batches, and accordions"
            >
              <ChevronsUp className="w-3.5 h-3.5 text-on-surface-variant" />
              <span>Close All</span>
            </button>

            {/* Approve All Pending Groups Button */}
            {pendingActionableGroups.length > 0 && (
              <button
                type="button"
                disabled={bulkApproving}
                onClick={handleBulkApproveLedgers}
                className="px-3 py-1.5 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title="Approve all actionable pending Ledger in one click"
              >
                {bulkApproving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve All Pending Groups ({pendingActionableGroups.length})</span>
                  </>
                )}
              </button>
            )}

            {onRefresh && (
              <button
                type="button"
                onClick={handleRefreshClick}
                disabled={isRefreshing || loading}
                className="px-2.5 py-1.5 rounded border border-outline-variant text-[11px] font-medium text-on-surface hover:bg-surface-container flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={isRefreshing ? "Refreshing Ledgers..." : "Refresh Ledgers"}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || loading ? 'animate-spin text-primary' : ''}`} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSelectedBundleIds([]);
                setSelectedGroupId('');
                setNewGroupName('');
                if (setLedgerRemarks) setLedgerRemarks('');
                setShowCreateLedgerModal(true);
              }}
              className="bg-primary hover:bg-primary/90 text-on-primary text-[11px] font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Assemble Ledger</span>
            </button>
          </div>
        </div>

        {/* Bulk Action Result Notification Banner */}
        {bulkActionMsg && (
          <div className={`px-4 py-2 text-xs flex items-center justify-between border-b ${bulkActionMsg.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900'
            : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900'
            }`}>
            <div className="flex items-center gap-2">
              {bulkActionMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{bulkActionMsg.text}</span>
            </div>
            <button onClick={() => setBulkActionMsg(null)} className="text-on-surface-variant hover:text-on-surface cursor-pointer ml-2">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loading && ledgers.length === 0 ? (
          <div className="p-12 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading ledgers...
          </div>
        ) : allGroupedLedgerClusters.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant space-y-2">
            <Layers className="w-8 h-8 mx-auto text-outline" />
            <p className="text-xs font-medium text-on-surface">No Ledger match your filters</p>
            <p className="text-xs">Assemble multiple approved worker claims into a unified Ledger.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs text-left text-on-surface">
                <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-wider border-b border-outline-variant">
                  <tr>
                    <th className="w-9 px-2 py-3 text-center"></th>
                    <th className="px-4 py-3">Ledger </th>
                    <th className="px-4 py-3">{hierarchyGrouping === 'bundle_wise' ? 'Bundles' : 'Batches'}</th>
                    <th className="px-4 py-3">Expenses</th>
                    <th className="px-4 py-3">Created By</th>
                    <th className="px-4 py-3 text-right">Group Total</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {groupedLedgerClusters.map((cluster) => {
                    const isGroupCollapsed = !expandedGroupIds[cluster.groupId];

                    // Compute unified group status and permissions
                    const groupStatus = cluster.isCompleted
                      ? 'Completed'
                      : cluster.ledgers.every(l => l.status === 'Approved' || l.status === 'Paid')
                        ? 'Approved'
                        : cluster.ledgers.some(l => l.status === 'Rework')
                          ? 'Rework'
                          : cluster.ledgers.some(l => l.status === 'In Review' || l.status === 'Submitted')
                            ? 'In Review'
                            : cluster.ledgers.some(l => l.status === 'Rejected')
                              ? 'Rejected'
                              : 'Draft';

                    const canUserApproveGroup = cluster.ledgers.some(l => {
                      if (l.status !== 'Submitted' && l.status !== 'In Review') return false;
                      const app = getLedgerApproval(l.ledger_id);
                      return canUserApproveLedger(l.ledger_id, app);
                    });

                    const hasDraftBatches = cluster.ledgers.some(l => l.status === 'Draft' || l.status === 'Rework' || l.status === 'Rejected');
                    const isGroupInReview = cluster.ledgers.some(l => l.status === 'Submitted' || l.status === 'In Review');

                    const groupPendingStep = cluster.ledgers
                      .map(l => (l as any).approval_history?.find((i: any) => i.status === 'Pending')?.step_name || getLedgerApproval(l.ledger_id)?.step_name)
                      .filter(Boolean)[0] || 'Approval';

                    const currentUserId = currentUser?.id ?? currentUser?.user_id;
                    const currentUsername = currentUser?.username;
                    const hasCurrentUserApprovedGroup = isGroupInReview && cluster.ledgers.some(l =>
                      Boolean(
                        (l as any).approval_history?.some(
                          (inst: any) => inst.status === 'Approved' && (
                            (inst.action_by_username && currentUsername && inst.action_by_username.toLowerCase() === currentUsername.toLowerCase()) ||
                            (inst.action_by && currentUserId && (String(inst.action_by) === String(currentUserId) || String(inst.action_by?.id) === String(currentUserId)))
                          )
                        )
                      )
                    );

                    return (
                      <React.Fragment key={`cluster_${cluster.groupId}`}>
                        {/* 1. UNIFIED  GROUP ROW */}
                        <tr
                          onClick={() => toggleGroupAccordion(cluster.groupId)}
                          className={`border-t-2 border-b border-outline-variant/80 select-none cursor-pointer transition-all ${!isGroupCollapsed
                            ? 'bg-indigo-50/90 dark:bg-indigo-950/40 hover:bg-indigo-100/90 dark:hover:bg-indigo-950/60 shadow-2xs'
                            : 'bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-200/90 dark:hover:bg-slate-700/80'
                            }`}
                        >
                          {/* 1. Chevron */}
                          <td className="w-9 px-2 py-3 text-center" onClick={(e) => { e.stopPropagation(); toggleGroupAccordion(cluster.groupId); }}>
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-surface-container-high transition-colors text-on-surface-variant cursor-pointer flex items-center justify-center mx-auto"
                              title={isGroupCollapsed ? "Expand Ledger" : "Collapse Ledger"}
                            >
                              {isGroupCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              )}
                            </button>
                          </td>

                          {/* 2. Group Name & ID */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded transition-colors shrink-0 ${!isGroupCollapsed
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25'
                                }`}>
                                <Layers className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex flex-col">
                                <span className={`text-xs ${!isGroupCollapsed ? 'font-bold text-indigo-950 dark:text-indigo-100' : 'font-bold text-on-surface'}`}>
                                  {cluster.groupName}
                                </span>
                                <span className="text-[10px] font-mono text-on-surface-variant">
                                  Group-{cluster.groupId}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 3. Batches / Bundles Count */}
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-medium border border-outline-variant/60 text-[11px] whitespace-nowrap">
                              {hierarchyGrouping === 'bundle_wise'
                                ? `${getGroupBundleBreakdown(cluster).length} Bundle${getGroupBundleBreakdown(cluster).length !== 1 ? 's' : ''}`
                                : `${cluster.ledgers.length} Batch${cluster.ledgers.length !== 1 ? 'es' : ''}`}
                            </span>
                          </td>

                          {/* 4. Expenses Count */}
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium text-[11px] whitespace-nowrap">
                              {cluster.ledgers.reduce((sum, l) => sum + (Array.isArray(l.expenses) ? l.expenses.length : 0), 0)} exp
                            </span>
                          </td>

                          {/* 5. Created By */}
                          <td className="px-4 py-3 text-on-surface-variant font-medium text-[11px] whitespace-nowrap">
                            {cluster.createdByName || 'User'}
                          </td>

                          {/* 6. Group Total */}
                          <td className="px-4 py-3 text-right font-bold text-on-surface text-xs whitespace-nowrap">
                            KD {cluster.totalAmount.toFixed(2)}
                          </td>

                          {/* 7. Status */}
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {renderStatusBadge(
                              groupStatus,
                              isGroupInReview && canUserApproveGroup,
                              groupPendingStep,
                              hasCurrentUserApprovedGroup
                            )}
                          </td>

                          {/* 8. Actions */}
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Add Bundle to Group Button (If not completed and not paid) */}
                              {!cluster.isCompleted && !cluster.ledgers.some(l => l.status === 'Paid') && (
                                <button
                                  type="button"
                                  onClick={() => openAddBundleModal(cluster)}
                                  className="px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer text-[11px] font-semibold inline-flex items-center gap-1 shadow-xs shrink-0"
                                  title={`Add an approved bundle into ${cluster.groupName}`}
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  <span>Add Bundle</span>
                                </button>
                              )}

                              {/* Group Submission Action (If draft/rework batches exist) */}
                              {!cluster.isCompleted && hasDraftBatches && (
                                <button
                                  type="button"
                                  disabled={submittingGroupId === cluster.groupId}
                                  onClick={() => handleGroupSubmit(cluster)}
                                  className="px-2.5 py-1 rounded bg-primary text-on-primary text-[11px] font-semibold hover:bg-primary-container transition-colors cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center gap-1 shrink-0"
                                  title="Submit the entire Ledger for approval"
                                >
                                  {submittingGroupId === cluster.groupId ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Submitting...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Send className="w-3.5 h-3.5" />
                                      <span>{cluster.ledgers.some(l => l.status === 'Rework' || l.status === 'Rejected') ? 'Resubmit' : 'Submit'}</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Mark as Completed Button (When all batches are approved) */}
                              {!cluster.isCompleted && cluster.allApproved && (
                                <button
                                  type="button"
                                  onClick={() => setGroupToConfirmComplete(cluster)}
                                  disabled={completingGroupId === cluster.groupId}
                                  className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 transition-all shadow-xs hover:shadow cursor-pointer disabled:opacity-50 shrink-0"
                                  title="Mark this Ledger as completed to lock it and enable Group Report"
                                >
                                  {completingGroupId === cluster.groupId ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Completing...</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      <span>Complete</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Group Report Button (When group is completed) */}
                              {cluster.isCompleted && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedGroupForReport(cluster)}
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 transition-all shadow-xs hover:shadow cursor-pointer shrink-0"
                                  title="Open comprehensive group financial settlement report"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Report</span>
                                </button>
                              )}

                              {/* Delete Group Action (If draft or rework/rejected and not completed/in review/paid) */}
                              {!cluster.isCompleted && !isGroupInReview && !cluster.ledgers.some(l => l.status === 'Paid') && (hasDraftBatches || cluster.ledgers.length === 0) && (
                                <button
                                  type="button"
                                  disabled={deletingGroupId === cluster.groupId}
                                  onClick={() => onDeleteLedgerGroup(cluster)}
                                  className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 transition-colors cursor-pointer text-[11px] font-semibold inline-flex items-center gap-1 shadow-xs disabled:opacity-50 shrink-0"
                                  title={`Delete Ledger "${cluster.groupName}" and return attached bundles to available status`}
                                >
                                  {deletingGroupId === cluster.groupId ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Deleting...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Delete</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* 1.5 GROUP APPROVAL STEPPER (Controlled by Stepper On / Off toggle) */}
                        {!isGroupCollapsed && showStepper && (
                          <tr className="bg-surface-container-lowest/80 border-b border-outline-variant/60">
                            <td colSpan={8} className="px-6 py-2.5 bg-indigo-50/40 dark:bg-indigo-950/20">
                              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-outline-variant/40">
                                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <GitCommit className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                  <span>Approval Pipeline • {cluster.groupName}</span>
                                </span>
                                <span className="text-[10px] text-on-surface-variant font-medium">
                                  Status: <span className="font-semibold text-on-surface">{groupStatus}</span>
                                </span>
                              </div>
                              {renderGroupApprovalStepper(cluster)}
                            </td>
                          </tr>
                        )}

                        {/* 2. BUNDLE-WISE VIEW ROWS IN THIS GROUP */}
                        {!isGroupCollapsed && hierarchyGrouping === 'bundle_wise' && (
                          <>
                            {/* CHILD BUNDLE SUB-HEADER */}
                            <tr className="bg-surface-container-high/90 text-on-surface-variant uppercase text-[9px] tracking-wider border-y border-outline-variant select-none">
                              <th className="w-9 px-2 py-2 text-center"></th>
                              <th className="px-4 py-2">Bundle ID</th>
                              <th className="px-4 py-2">Claim Bundle</th>
                              <th className="px-4 py-2">Batches</th>
                              <th className="px-4 py-2">Expenses</th>
                              <th className="px-4 py-2">Worker</th>
                              <th className="px-4 py-2 text-right">Bundle Total</th>
                              <th className="px-4 py-2 text-right">Actions</th>
                            </tr>
                            {getGroupBundleBreakdown(cluster).map((bundleItem, bIdx) => {
                              const bundleKey = `${cluster.groupId}_${bundleItem.bundleId}`;
                              const isBundleExpanded = !!expandedGroupBundleKeys[bundleKey];
                              const isOdd = bIdx % 2 === 1;

                              return (
                                <React.Fragment key={`group_bundle_${bundleKey}`}>
                                  <tr
                                    onClick={() => toggleExpandGroupBundle(cluster.groupId, bundleItem.bundleId)}
                                    className={`cursor-pointer transition-colors ${isBundleExpanded
                                      ? 'bg-purple-500/10 dark:bg-purple-500/20'
                                      : isOdd
                                        ? 'bg-slate-100/90 dark:bg-slate-800/45 hover:bg-slate-200/90 dark:hover:bg-slate-700/60'
                                        : 'bg-white dark:bg-surface-container-lowest hover:bg-slate-50 dark:hover:bg-slate-800/30'
                                      }`}
                                  >
                                    <td className="w-9 px-2 py-2.5 text-center relative" onClick={(e) => { e.stopPropagation(); toggleExpandGroupBundle(cluster.groupId, bundleItem.bundleId); }}>
                                      <div className="flex items-center justify-center relative">
                                        <button type="button" className="p-1 rounded transition-colors cursor-pointer relative z-10">
                                          {isBundleExpanded ? <ChevronDown className="w-3.5 h-3.5 text-purple-600" /> : <ChevronRight className="w-3.5 h-3.5 text-purple-600" />}
                                        </button>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5 font-semibold text-purple-700 dark:text-purple-300">
                                      {bundleItem.bundleId}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                                        <Package className="w-3 h-3 shrink-0" />
                                        <span>Bundle {bundleItem.bundleId}</span>
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface font-medium border border-outline-variant/60" title={bundleItem.ledgerBatches.map(b => b.batchName).join(', ')}>
                                        {bundleItem.ledgerBatches.length} Batch{bundleItem.ledgerBatches.length > 1 ? 'es' : ''}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
                                        {bundleItem.expenses.length} exp
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-on-surface-variant font-medium">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <AvatarCircle
                                          user={bundleItem.workerDetail}
                                          name={bundleItem.workerName}
                                          image={bundleItem.profileImage || bundleItem.workerDetail?.profile_image}
                                          size="xs"
                                        />
                                        <span className="truncate">{bundleItem.workerName}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-bold text-on-surface">
                                      {bundleItem.totalAmount.toFixed(2)}
                                    </td>

                                    <td className="px-4 py-2.5 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                                      {!cluster.isCompleted && (() => {
                                        const isRemovingBundle = removingBundleKey === `${cluster.groupId}_${bundleItem.bundleId}`;
                                        return (
                                          <button
                                            type="button"
                                            disabled={isRemovingBundle}
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              setRemovingBundleKey(`${cluster.groupId}_${bundleItem.bundleId}`);
                                              try {
                                                if (handleRemoveBundleFromGroup) {
                                                  await handleRemoveBundleFromGroup(Number(cluster.groupId), bundleItem.bundleId);
                                                } else if (handleRemoveBundleFromLedger) {
                                                  const targetLedger = cluster.ledgers.find(l => (l.bundles || []).some((b: any) => (b.claim_id || b.id) === bundleItem.bundleId));
                                                  if (targetLedger) {
                                                    await handleRemoveBundleFromLedger(targetLedger.ledger_id, bundleItem.bundleId);
                                                  }
                                                }
                                              } finally {
                                                setRemovingBundleKey(null);
                                              }
                                            }}
                                            className="px-2.5 py-1 rounded border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] font-medium disabled:opacity-50"
                                            title="Remove Bundle from this Ledger"
                                          >
                                            {isRemovingBundle ? (
                                              <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                <span>Removing Bundle...</span>
                                              </>
                                            ) : (
                                              <>
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span>Remove Bundle</span>
                                              </>
                                            )}
                                          </button>
                                        );
                                      })()}
                                    </td>
                                  </tr>

                                  {/* EXPANDED BUNDLE DETAILS TABLE */}
                                  {isBundleExpanded && (
                                    <tr className="bg-surface-container-lowest/90 dark:bg-surface-container-low/50">
                                      <td colSpan={8} className="p-4 border-b border-outline-variant space-y-3">
                                        <div className="overflow-x-auto rounded border border-outline-variant bg-surface-container shadow-2xs">
                                          <table className="w-full text-xs text-left text-on-surface">
                                            <thead className="bg-surface-container-high/80 text-on-surface-variant uppercase text-[9px] tracking-wider border-b border-outline-variant">
                                              <tr>
                                                <th className="px-3 py-2.5">Exp</th>
                                                <th className="px-3 py-2.5">Description</th>
                                                <th className="px-3 py-2.5">Target Ledger Batch</th>
                                                <th className="px-3 py-2.5">Sub-Department</th>
                                                <th className="px-3 py-2.5">Ticket / WO</th>
                                                <th className="px-3 py-2.5">Category</th>
                                                <th className="px-3 py-2.5">Date</th>
                                                <th className="px-3 py-2.5 text-right">Amount</th>
                                                <th className="px-3 py-2.5 text-right">Action</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-outline-variant/40">
                                              {bundleItem.expenses.map((exp, eIdx) => {
                                                const expSubDept = exp.ticket_details?.sub_department_name || (exp as any).sub_department_name || '-';
                                                const matchingBatch = bundleItem.ledgerBatches.find(bb => {
                                                  const batchObj = (ledgerBatches || internalBatches || []).find(b => b.batch_name === bb.batchName);
                                                  const sds = (batchObj?.sub_departments || []).map(sd => typeof sd === 'number' ? sd : (sd as any).sub_department_id);
                                                  const expSdId = exp.ticket_details?.sub_department_id ?? exp.sub_department_id;
                                                  return expSdId && sds.includes(Number(expSdId));
                                                })?.batchName || 'General Batch';

                                                const parentLedger = cluster.ledgers.find(l => (l.expenses || []).some(e => e.expense_id === exp.expense_id));
                                                const isExpEditable = parentLedger ? (!cluster.isCompleted && parentLedger.status !== 'Paid') : (!cluster.isCompleted);

                                                return (
                                                  <tr key={exp.expense_id} className={eIdx % 2 === 1 ? 'bg-surface-container-low/50' : 'bg-surface-container'}>
                                                    <td className="py-2 pr-3 pl-8 font-mono text-primary font-medium relative">
                                                      {/* Rose connector */}
                                                      <div className="absolute left-[16px] top-0 bottom-0 w-[2px] bg-rose-500/60 dark:bg-rose-400/60" />
                                                      <div className="absolute left-[16px] top-1/2 -translate-y-1/2 w-2.5 h-[2px] bg-rose-500/60 dark:bg-rose-400/60" />
                                                      <span>{exp.expense_id}</span>
                                                    </td>
                                                    <td className="px-3 py-2 font-medium text-on-surface">{exp.remarks || exp.ticket_details?.title || (exp as any).description || 'Expense'}</td>
                                                    <td className="px-3 py-2">
                                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                                        <Boxes className="w-2.5 h-2.5 shrink-0" />
                                                        <span>{matchingBatch}</span>
                                                      </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-on-surface-variant font-medium">{expSubDept}</td>
                                                    <td className="px-3 py-2 font-mono text-[11px] text-on-surface-variant">{formatTicketDisplay(exp)}</td>
                                                    <td className="px-3 py-2">
                                                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-container-highest text-on-surface font-medium">
                                                        {exp.expense_type_detail?.expense_name || (typeof exp.expense_type === 'object' && exp.expense_type ? exp.expense_type.expense_name : ((exp as any).expense_type_name || (exp as any).category_name || 'Expense'))}
                                                      </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-on-surface-variant text-[11px]">{exp.expense_date || '-'}</td>
                                                    <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                      {parseFloat(exp.amount as any || '0').toFixed(2)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                                      {parentLedger && isExpEditable && (
                                                        <button
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveExpenseFromLedger(parentLedger.ledger_id, exp.expense_id);
                                                          }}
                                                          className="px-2 py-0.5 rounded border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                                                          title="Remove Expense from this Ledger Batch"
                                                        >
                                                          <Trash2 className="w-3 h-3" />
                                                          <span>Remove</span>
                                                        </button>
                                                      )}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </>
                        )}

                        {/* 2. BATCH-WISE VIEW ROWS IN THIS GROUP */}
                        {!isGroupCollapsed && hierarchyGrouping === 'batch_wise' && (
                          <>
                            {/* CHILD BATCH SUB-HEADER */}
                            <tr className="bg-surface-container-high/90 text-on-surface-variant uppercase text-[9px] tracking-wider border-y border-outline-variant select-none">
                              <th className="w-9 px-2 py-2 text-center"></th>
                              <th className="px-4 py-2">Batch ID</th>
                              <th className="px-4 py-2">Batch Name</th>
                              <th className="px-4 py-2">Bundles</th>
                              <th className="px-4 py-2">Expenses</th>
                              <th className="px-4 py-2">Created By</th>
                              <th className="px-4 py-2 text-right">Batch Total</th>
                              <th className="px-4 py-2 text-center">Details</th>
                            </tr>
                            {cluster.ledgers.map((l, lIdx) => {
                              const isExpanded = !!expandedLedgerIds[l.ledger_id];
                              const isOdd = lIdx % 2 === 1;
                              const ledgerExpenses = Array.isArray(l.expenses) ? l.expenses : [];
                              const activeViewMode = ledgerViewModes[l.ledger_id] || globalViewMode;
                              const isLedgerEditable = !cluster.isCompleted && l.status !== 'Approved' && l.status !== 'Paid';

                              return (
                                <React.Fragment key={l.ledger_id}>
                                  {/* MAIN ROW */}
                                  <tr
                                    onClick={() => toggleExpandLedger(l.ledger_id)}
                                    className={`cursor-pointer transition-colors ${isExpanded
                                      ? 'bg-primary/10 dark:bg-primary/20'
                                      : isMultiLineView
                                        ? isOdd
                                          ? 'bg-slate-100/90 dark:bg-slate-800/45 hover:bg-slate-200/90 dark:hover:bg-slate-700/60'
                                          : 'bg-white dark:bg-surface-container-lowest hover:bg-slate-50 dark:hover:bg-slate-800/30'
                                        : 'hover:bg-surface-container-high'
                                      }`}
                                  >
                                    <td className="w-9 px-2 py-2.5 text-center relative" onClick={(e) => { e.stopPropagation(); toggleExpandLedger(l.ledger_id); }}>
                                      <div className="flex items-center justify-center relative">
                                        <button
                                          type="button"
                                          className="p-1 rounded transition-colors cursor-pointer relative z-10"
                                        >
                                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                        </button>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5 font-semibold text-primary">
                                      {l.ledger_id}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      {l.ledger_batch_detail ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                          <Boxes className="w-3 h-3 shrink-0" />
                                          <span>{l.ledger_batch_detail.batch_name}</span>
                                        </span>
                                      ) : (
                                        <span className="text-on-surface-variant italic text-[11px]">General Batch</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface font-medium border border-outline-variant/60">
                                        {l.bundles?.length || 0} Bundles
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
                                        {ledgerExpenses.length} exp
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-on-surface-variant font-medium">
                                      {l.created_by_detail?.full_name || l.created_by_detail?.username || 'User'}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-bold text-on-surface">
                                      {parseFloat(l.total_amount).toFixed(2)}
                                    </td>

                                    <td className="px-4 py-2.5 text-center text-on-surface-variant text-[11px]" onClick={(e) => e.stopPropagation()}>
                                      <span className="text-[10px] text-on-surface-variant font-medium">
                                        {isExpanded ? 'Expanded' : 'Click to view'}
                                      </span>
                                    </td>
                                  </tr>

                                  {/* MULTI-LINE VIEW SECOND ROW (Batch summary) */}
                                  {isMultiLineView && !isExpanded && (
                                    <tr className={`border-b border-outline-variant transition-colors ${isOdd ? 'bg-slate-100/90 dark:bg-slate-800/45' : 'bg-white dark:bg-surface-container-lowest'
                                      }`}>
                                      <td colSpan={8} className="px-4 py-2">
                                        <div className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded border text-xs ${isOdd
                                          ? 'bg-white dark:bg-surface-container/70 border-outline-variant/80 shadow-xs'
                                          : 'bg-surface-container-low dark:bg-surface-container-low/70 border-outline-variant/60 shadow-2xs'
                                          }`}>
                                          <div className="flex items-center gap-3 text-on-surface-variant text-[11px]">
                                            <span className="font-semibold text-on-surface">Batch {l.ledger_id} Details:</span>
                                            <span>{l.ledger_batch_detail?.batch_name || 'General Batch'}</span>
                                            <span>•</span>
                                            <span>{l.bundles?.length || 0} Bundle(s)</span>
                                            <span>•</span>
                                            <span>{ledgerExpenses.length} Expense(s)</span>
                                            {l.remarks && (
                                              <>
                                                <span>•</span>
                                                <span className="italic">"{l.remarks}"</span>
                                              </>
                                            )}
                                          </div>
                                          <div className="font-bold text-on-surface">
                                            KD {parseFloat(l.total_amount).toFixed(2)}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}

                                  {/* CLEAN, FLAT EXPANDED ROW (NO NESTED BOXES) */}
                                  {isExpanded && (
                                    <tr className="bg-surface-container-lowest/90 dark:bg-surface-container-low/50">
                                      <td colSpan={8} className="p-4 border-b border-outline-variant space-y-3">



                                        {/* 4. FLAT STRUCTURED EXPENSES TABLE */}
                                        {ledgerExpenses.length === 0 ? (
                                          <p className="text-xs text-on-surface-variant italic py-2">
                                            No classified expenses attached to this Ledger Batch.
                                          </p>
                                        ) : (
                                          <div className="overflow-x-auto rounded border border-outline-variant bg-surface-container shadow-2xs">
                                            <table className="w-full text-xs text-left text-on-surface">
                                              <thead className="bg-surface-container-high/80 text-on-surface-variant uppercase text-[9px] tracking-wider border-b border-outline-variant">
                                                <tr>
                                                  <th className="px-3 py-2.5">Exp</th>
                                                  {activeViewMode === 'flat_table' ? (
                                                    <th className="px-3 py-2.5">Worker & Sub-Dept</th>
                                                  ) : (
                                                    <th className="px-3 py-2.5">Description</th>
                                                  )}
                                                  <th className="px-3 py-2.5">Ticket / WO</th>
                                                  <th className="px-3 py-2.5">Category</th>
                                                  <th className="px-3 py-2.5">Date</th>
                                                  <th className="px-3 py-2.5">Source Bundle</th>
                                                  <th className="px-3 py-2.5 text-right">Amount</th>
                                                  <th className="px-3 py-2.5 text-right">Actions</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-outline-variant/40">
                                                {/* VIEW MODE 1: BY SUB-DEPARTMENT */}
                                                {activeViewMode === 'by_sub_department' && (
                                                  getSubDepartmentBreakdown(ledgerExpenses).map(sd => {
                                                    const sdKey = String(sd.subDeptId || sd.subDeptName);
                                                    const isExpanded = !!expandedSubDepts[`${l.ledger_id}_${sdKey}`];

                                                    return (
                                                      <React.Fragment key={sdKey}>
                                                        {/* LEVEL 3: Sub-Department Header */}
                                                        <tr
                                                          onClick={() => toggleSubDeptAccordion(l.ledger_id, sdKey)}
                                                          className={`cursor-pointer transition-all select-none border-t border-outline-variant/60 ${isExpanded
                                                            ? 'bg-purple-50/90 dark:bg-purple-950/40 hover:bg-purple-100/80 dark:hover:bg-purple-950/60 shadow-2xs'
                                                            : 'bg-surface-container/80 hover:bg-surface-container-high text-on-surface'
                                                            }`}
                                                        >
                                                          <td colSpan={6} className="py-2.5 pr-3 pl-3.5 relative">
                                                            <div className="flex items-center gap-2 pl-1">
                                                              <button
                                                                type="button"
                                                                className="p-0.5 rounded hover:bg-surface-container-highest/60 text-on-surface-variant cursor-pointer transition-transform"
                                                                onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  toggleSubDeptAccordion(l.ledger_id, sdKey);
                                                                }}
                                                                title={isExpanded ? 'Collapse sub-department' : 'Expand sub-department'}
                                                              >
                                                                {isExpanded ? (
                                                                  <ChevronDown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                                ) : (
                                                                  <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                                                                )}
                                                              </button>
                                                              <Building2 className={`w-4 h-4 ${isExpanded ? 'text-purple-600 dark:text-purple-400' : 'text-on-surface-variant'}`} />
                                                              <span className={`text-xs ${isExpanded ? 'font-bold text-purple-950 dark:text-purple-100' : 'font-semibold text-on-surface'}`}>
                                                                {sd.subDeptName}
                                                              </span>
                                                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isExpanded
                                                                ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
                                                                : 'bg-surface-container-highest text-on-surface-variant'
                                                                }`}>
                                                                {sd.expenses.length} exp • {sd.workersCount} worker{sd.workersCount > 1 ? 's' : ''}
                                                              </span>
                                                            </div>
                                                          </td>
                                                          <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                                                            {sd.totalAmount.toFixed(2)}
                                                          </td>
                                                          <td className="px-3 py-2.5 text-right">
                                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${isExpanded
                                                              ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                                                              : 'text-on-surface-variant'
                                                              }`}>
                                                              {isExpanded ? 'Expanded' : 'Collapsed'}
                                                            </span>
                                                          </td>
                                                        </tr>

                                                        {/* LEVEL 4: Nested Worker Accordions */}
                                                        {isExpanded && sd.workers.map(w => {
                                                          const wKey = String(w.workerId || w.workerName);
                                                          const isChildExpanded = !!expandedNestedWorkers[`${l.ledger_id}_${sdKey}_${wKey}`];

                                                          return (
                                                            <React.Fragment key={wKey}>
                                                              <tr
                                                                onClick={() => toggleNestedWorkerAccordion(l.ledger_id, sdKey, wKey)}
                                                                className={`cursor-pointer transition-all select-none border-t border-outline-variant/40 ${isChildExpanded
                                                                  ? 'bg-rose-50/90 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-950/60 shadow-2xs'
                                                                  : 'bg-surface-container-low/70 hover:bg-surface-container text-on-surface'
                                                                  }`}
                                                              >
                                                                <td colSpan={6} className="py-2 pr-3 pl-8 relative">
                                                                  {/* Rose Child continuous vertical line running through children */}
                                                                  <div className="absolute left-[16px] top-0 bottom-0 w-[2px] bg-rose-500/60 dark:bg-rose-400/60" />
                                                                  {/* Branch connector from Rose line to Child */}
                                                                  <div className="absolute left-[16px] top-1/2 -translate-y-1/2 w-3 h-[2px] bg-rose-500/60 dark:bg-rose-400/60" />
                                                                  <div className="flex items-center gap-2 pl-1">
                                                                    <button
                                                                      type="button"
                                                                      className="p-0.5 rounded hover:bg-surface-container-highest/60 text-on-surface-variant cursor-pointer"
                                                                      onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleNestedWorkerAccordion(l.ledger_id, sdKey, wKey);
                                                                      }}
                                                                      title={isChildExpanded ? 'Collapse worker expenses' : 'Expand worker expenses'}
                                                                    >
                                                                      {isChildExpanded ? (
                                                                        <ChevronDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                                                      ) : (
                                                                        <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant" />
                                                                      )}
                                                                    </button>
                                                                    <AvatarCircle
                                                                      user={w.workerObj}
                                                                      name={w.workerName}
                                                                      image={w.profileImage || w.workerObj?.profile_image}
                                                                      size="xs"
                                                                    />
                                                                    <span className={`text-xs truncate ${isChildExpanded ? 'font-bold text-rose-950 dark:text-rose-100' : 'font-semibold text-on-surface'}`}>
                                                                      {w.workerName}
                                                                    </span>
                                                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${isChildExpanded
                                                                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                                                                      : 'bg-surface-container-highest text-on-surface-variant'
                                                                      }`}>
                                                                      {w.expenses.length} exp
                                                                    </span>
                                                                  </div>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                                                                  {w.totalAmount.toFixed(2)}
                                                                </td>
                                                                <td className="px-3 py-2 text-right">
                                                                  <span className={`text-[10px] px-1.5 py-0.2 rounded ${isChildExpanded
                                                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 font-medium'
                                                                    : 'text-on-surface-variant/70'
                                                                    }`}>
                                                                    {isChildExpanded ? 'Expanded' : 'Collapsed'}
                                                                  </span>
                                                                </td>
                                                              </tr>

                                                              {/* EXPENSES (CHILDREN OF WORKER) */}
                                                              {isChildExpanded && w.expenses.map(exp => {
                                                                const ticketLabel = formatTicketDisplay(exp);
                                                                const claimId = typeof exp.claim === 'object' && exp.claim !== null ? exp.claim.claim_id : exp.claim;
                                                                const expDescription = exp.ticket_details?.title || exp.remarks || exp.expense_type_detail?.expense_name || 'General';

                                                                return (
                                                                  <tr key={exp.expense_id} className="bg-surface hover:bg-surface-container/70 transition-colors border-b border-outline-variant/30">
                                                                    <td className="py-2 pr-3 pl-12 font-medium text-primary relative">
                                                                      {/* Rose Child line */}
                                                                      <div className="absolute left-[16px] top-0 bottom-0 w-[2px] bg-rose-500/60 dark:bg-rose-400/60" />
                                                                      {/* Horizontal connector to expense from Rose line */}
                                                                      <div className="absolute left-[16px] top-1/2 -translate-y-1/2 w-3 h-[2px] bg-rose-500/60 dark:bg-rose-400/60" />
                                                                      <div className="flex items-center gap-1.5 pl-0.5">
                                                                        <span>{exp.expense_id}</span>
                                                                      </div>
                                                                    </td>
                                                                    <td className="px-3 py-2 font-medium text-on-surface">
                                                                      <span className="truncate max-w-xs block" title={expDescription}>
                                                                        {expDescription}
                                                                      </span>
                                                                    </td>
                                                                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                                                      {exp.ticket_details || exp.ticket ? (
                                                                        <button
                                                                          type="button"
                                                                          onClick={() => setSelectedTicketForModal && setSelectedTicketForModal(getTicketForModal(exp))}
                                                                          className="font-mono font-medium text-primary hover:underline text-[11px] cursor-pointer"
                                                                        >
                                                                          {ticketLabel}
                                                                        </button>
                                                                      ) : (
                                                                        <span className="text-on-surface-variant/60 italic text-[11px]">No Ticket</span>
                                                                      )}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-on-surface-variant">
                                                                      {exp.expense_type_detail?.expense_name || 'General'}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-on-surface-variant">{exp.expense_date}</td>
                                                                    <td className="px-3 py-2">
                                                                      {claimId ? (
                                                                        <span className="text-[11px] font-semibold text-primary">
                                                                          Bundle {claimId}
                                                                        </span>
                                                                      ) : (
                                                                        <span className="text-[10px] text-on-surface-variant italic">Direct</span>
                                                                      )}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                                      {parseFloat(exp.amount).toFixed(2)}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                                                      {isLedgerEditable && (
                                                                        <button
                                                                          onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRemoveExpenseFromLedger(l.ledger_id, exp.expense_id);
                                                                          }}
                                                                          className="px-2 py-0.5 rounded border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                                                                          title="Remove Expense from this Ledger Batch"
                                                                        >
                                                                          <Trash2 className="w-3 h-3" />
                                                                          <span>Remove</span>
                                                                        </button>
                                                                      )}
                                                                    </td>
                                                                  </tr>
                                                                );
                                                              })}
                                                            </React.Fragment>
                                                          );
                                                        })}
                                                      </React.Fragment>
                                                    );
                                                  })
                                                )}
                                                {/* VIEW MODE 2: BY WORKER */}
                                                {activeViewMode === 'by_worker' && (
                                                  getWorkerBreakdown(ledgerExpenses).map(w => {
                                                    const wKey = String(w.workerId || w.workerName);
                                                    const isExpanded = !!expandedWorkers[`${l.ledger_id}_${wKey}`];

                                                    return (
                                                      <React.Fragment key={wKey}>
                                                        {/* LEVEL 3: Worker Header */}
                                                        <tr
                                                          onClick={() => toggleWorkerAccordion(l.ledger_id, wKey)}
                                                          className={`cursor-pointer transition-all select-none border-t border-outline-variant/60 ${isExpanded
                                                            ? 'bg-purple-50/90 dark:bg-purple-950/40 hover:bg-purple-100/80 dark:hover:bg-purple-950/60 shadow-2xs'
                                                            : 'bg-surface-container/80 hover:bg-surface-container-high text-on-surface'
                                                            }`}
                                                        >
                                                          <td colSpan={6} className="py-2.5 pr-3 pl-3.5 relative">
                                                            <div className="flex items-center gap-2 pl-1">
                                                              <button
                                                                type="button"
                                                                className="p-0.5 rounded hover:bg-surface-container-highest/60 text-on-surface-variant cursor-pointer transition-transform"
                                                                onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  toggleWorkerAccordion(l.ledger_id, wKey);
                                                                }}
                                                                title={isExpanded ? 'Collapse worker' : 'Expand worker'}
                                                              >
                                                                {isExpanded ? (
                                                                  <ChevronDown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                                ) : (
                                                                  <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                                                                )}
                                                              </button>
                                                              <AvatarCircle
                                                                user={w.workerObj}
                                                                name={w.workerName}
                                                                image={w.profileImage || w.workerObj?.profile_image}
                                                                size="xs"
                                                              />
                                                              <span className={`text-xs truncate ${isExpanded ? 'font-bold text-purple-950 dark:text-purple-100' : 'font-semibold text-on-surface'}`}>
                                                                {w.workerName}
                                                              </span>

                                                              <span
                                                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isExpanded
                                                                  ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
                                                                  : 'bg-surface-container-highest text-on-surface-variant'
                                                                  }`}
                                                              >
                                                                {w.expenses.length} exp
                                                              </span>
                                                            </div>
                                                          </td>
                                                          <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                                                            {w.totalAmount.toFixed(2)}
                                                          </td>
                                                          <td className="px-3 py-2.5 text-right">
                                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${isExpanded
                                                              ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                                                              : 'text-on-surface-variant'
                                                              }`}>
                                                              {isExpanded ? 'Expanded' : 'Collapsed'}
                                                            </span>
                                                          </td>
                                                        </tr>

                                                        {/* LEVEL 4: Nested Sub-Department Accordions */}
                                                        {isExpanded && w.subDepartments.map(sd => {
                                                          const sdKey = String(sd.subDeptId || sd.subDeptName);
                                                          const isChildExpanded = !!expandedNestedSubDepts[`${l.ledger_id}_${wKey}_${sdKey}`];

                                                          return (
                                                            <React.Fragment key={sdKey}>
                                                              <tr
                                                                onClick={() => toggleNestedSubDeptAccordion(l.ledger_id, wKey, sdKey)}
                                                                className={`cursor-pointer transition-all select-none border-t border-outline-variant/40 ${isChildExpanded
                                                                  ? 'bg-rose-50/90 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-950/60 shadow-2xs'
                                                                  : 'bg-surface-container-low/70 hover:bg-surface-container text-on-surface'
                                                                  }`}
                                                              >
                                                                <td colSpan={6} className="py-2 pr-3 pl-8 relative">
                                                                  {/* Rose Child continuous vertical line running through children */}
                                                                  <div className="absolute left-[16px] top-0 bottom-0 w-[2px] bg-rose-500/60 dark:bg-rose-400/60" />
                                                                  {/* Branch connector from Rose line to Child */}
                                                                  <div className="absolute left-[16px] top-1/2 -translate-y-1/2 w-3 h-[2px] bg-rose-500/60 dark:bg-rose-400/60" />
                                                                  <div className="flex items-center gap-2 pl-1">
                                                                    <button
                                                                      type="button"
                                                                      className="p-0.5 rounded hover:bg-surface-container-highest/60 text-on-surface-variant cursor-pointer"
                                                                      onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleNestedSubDeptAccordion(l.ledger_id, wKey, sdKey);
                                                                      }}
                                                                      title={isChildExpanded ? 'Collapse sub-department expenses' : 'Expand sub-department expenses'}
                                                                    >
                                                                      {isChildExpanded ? (
                                                                        <ChevronDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                                                      ) : (
                                                                        <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant" />
                                                                      )}
                                                                    </button>
                                                                    <Building2 className={`w-3.5 h-3.5 ${isChildExpanded ? 'text-rose-600 dark:text-rose-400' : 'text-on-surface-variant'}`} />
                                                                    <span className={`text-xs ${isChildExpanded ? 'font-bold text-rose-950 dark:text-rose-100' : 'font-semibold text-on-surface'}`}>
                                                                      {sd.subDeptName}
                                                                    </span>
                                                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${isChildExpanded
                                                                      ? 'bg-rose-50/20 text-rose-700 dark:text-rose-300'
                                                                      : 'bg-surface-container-highest text-on-surface-variant'
                                                                      }`}>
                                                                      {sd.expenses.length} exp
                                                                    </span>
                                                                  </div>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                                                                  {sd.totalAmount.toFixed(2)}
                                                                </td>
                                                                <td className="px-3 py-2 text-right">
                                                                  <span className={`text-[10px] px-1.5 py-0.2 rounded ${isChildExpanded
                                                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 font-medium'
                                                                    : 'text-on-surface-variant/70'
                                                                    }`}>
                                                                    {isChildExpanded ? 'Expanded' : 'Collapsed'}
                                                                  </span>
                                                                </td>
                                                              </tr>

                                                              {/* EXPENSES */}
                                                              {isChildExpanded && sd.expenses.map(exp => {
                                                                const ticketLabel = formatTicketDisplay(exp);
                                                                const claimId = typeof exp.claim === 'object' && exp.claim !== null ? exp.claim.claim_id : exp.claim;
                                                                const expDescription = exp.ticket_details?.title || exp.remarks || exp.expense_type_detail?.expense_name || 'General';

                                                                return (
                                                                  <tr key={exp.expense_id} className="bg-surface hover:bg-surface-container/70 transition-colors border-b border-outline-variant/30">
                                                                    <td className="py-2 pr-3 pl-12 font-medium text-primary relative">
                                                                      {/* Rose Child */}
                                                                      <div className="absolute left-[16px] top-0 bottom-0 w-[2px] bg-rose-500/60 dark:bg-rose-400/60" />
                                                                      {/* Horizontal connector to expense from Rose line */}
                                                                      <div className="absolute left-[16px] top-1/2 -translate-y-1/2 w-3 h-[2px] bg-rose-500/60 dark:bg-rose-400/60" />
                                                                      <div className="flex items-center gap-1.5 pl-0.5">
                                                                        <span>{exp.expense_id}</span>
                                                                      </div>
                                                                    </td>
                                                                    <td className="px-3 py-2 font-medium text-on-surface">
                                                                      <span className="truncate max-w-xs block" title={expDescription}>
                                                                        {expDescription}
                                                                      </span>
                                                                    </td>
                                                                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                                                      {exp.ticket_details || exp.ticket ? (
                                                                        <button
                                                                          type="button"
                                                                          onClick={() => setSelectedTicketForModal && setSelectedTicketForModal(getTicketForModal(exp))}
                                                                          className="font-mono font-medium text-primary hover:underline text-[11px] cursor-pointer"
                                                                        >
                                                                          {ticketLabel}
                                                                        </button>
                                                                      ) : (
                                                                        <span className="text-on-surface-variant/60 italic text-[11px]">No Ticket</span>
                                                                      )}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-on-surface-variant">
                                                                      {exp.expense_type_detail?.expense_name || 'General'}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-on-surface-variant">{exp.expense_date}</td>
                                                                    <td className="px-3 py-2">
                                                                      {claimId ? (
                                                                        <span className="text-[11px] font-semibold text-primary">
                                                                          Bundle {claimId}
                                                                        </span>
                                                                      ) : (
                                                                        <span className="text-[10px] text-on-surface-variant italic">Direct</span>
                                                                      )}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                                      {parseFloat(exp.amount).toFixed(2)}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                                                      {isLedgerEditable && (
                                                                        <button
                                                                          onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRemoveExpenseFromLedger(l.ledger_id, exp.expense_id);
                                                                          }}
                                                                          className="px-2 py-0.5 rounded border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                                                                          title="Remove Expense from this Ledger Batch"
                                                                        >
                                                                          <Trash2 className="w-3 h-3" />
                                                                          <span>Remove</span>
                                                                        </button>
                                                                      )}
                                                                    </td>
                                                                  </tr>
                                                                );
                                                              })}
                                                            </React.Fragment>
                                                          );
                                                        })}
                                                      </React.Fragment>
                                                    );
                                                  })
                                                )}
                                                {/* VIEW MODE 3: FLAT TABLE */}
                                                {activeViewMode === 'flat_table' && (
                                                  ledgerExpenses.map((exp: any) => {
                                                    const subDeptName = exp.ticket_details?.sub_department_name || exp.sub_department_name || '-';
                                                    const ticketLabel = formatTicketDisplay(exp);
                                                    const claimId = typeof exp.claim === 'object' && exp.claim !== null ? exp.claim.claim_id : exp.claim;
                                                    const workerObj = exp.worker_detail || (typeof exp.worker === 'object' && exp.worker !== null ? exp.worker : null);
                                                    const workerName = workerObj?.full_name || workerObj?.username || (typeof exp.worker === 'object' && exp.worker !== null ? (exp.worker.full_name || exp.worker.username || `Worker ${exp.worker.id}`) : `Worker ${exp.worker}`);

                                                    return (
                                                      <tr key={exp.expense_id} className="hover:bg-surface-container-high/40 transition-colors">
                                                        <td className="px-3 py-2 font-medium text-primary">{exp.expense_id}</td>
                                                        <td className="px-3 py-2">
                                                          <div className="flex items-center gap-1.5 min-w-0">
                                                            <AvatarCircle
                                                              user={workerObj}
                                                              name={workerName}
                                                              size="xs"
                                                            />
                                                            <span className="font-medium text-on-surface truncate">{workerName}</span>
                                                            <span className="text-[10px] px-1 py-0.2 rounded bg-surface-container-highest text-on-surface-variant border border-outline-variant shrink-0">
                                                              {subDeptName}
                                                            </span>
                                                          </div>
                                                        </td>
                                                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                                          {exp.ticket_details || exp.ticket ? (
                                                            <button
                                                              type="button"
                                                              onClick={() => setSelectedTicketForModal && setSelectedTicketForModal(getTicketForModal(exp))}
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
                                                        <td className="px-3 py-2 text-on-surface-variant">
                                                          {exp.expense_type_detail?.expense_name || 'General'}
                                                        </td>
                                                        <td className="px-3 py-2 text-on-surface-variant">{exp.expense_date}</td>
                                                        <td className="px-3 py-2">
                                                          {claimId ? (
                                                            <span className="text-[11px] font-semibold text-primary">
                                                              Bundle {claimId}
                                                            </span>
                                                          ) : (
                                                            <span className="text-[10px] text-on-surface-variant italic">Direct</span>
                                                          )}
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                          {parseFloat(exp.amount).toFixed(2)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                                          {isLedgerEditable && (
                                                            <button
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemoveExpenseFromLedger(l.ledger_id, exp.expense_id);
                                                              }}
                                                              className="px-2 py-0.5 rounded border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                                                              title="Remove Expense from this Ledger Batch"
                                                            >
                                                              <Trash2 className="w-3 h-3" />
                                                              <span>Remove</span>
                                                            </button>
                                                          )}
                                                        </td>
                                                      </tr>
                                                    );
                                                  })
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Component */}
            <Pagination
              currentPage={currentPage}
              totalItems={totalItemsCount}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </>
        )}
      </div>

      {/* MODAL: ASSEMBLE LEDGER */}
      {showCreateLedgerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container rounded border border-outline-variant max-w-2xl w-full p-4 space-y-4 shadow-2xl min-h-[580px] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded bg-primary/10 text-primary">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-on-surface">Assemble Ledger Batches</h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Group approved worker claim bundles into Ledger Batches
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCreateLedgerModal(false);
                  setSelectedBundleIds([]);
                  setSelectedGroupId('');
                  setNewGroupName('');
                }}
                className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1 pb-20">
              <div>


                {/* Bundle Selection List */}
                <div className="max-h-56 overflow-y-auto border border-outline-variant rounded divide-y divide-outline-variant bg-surface-container-low scrollbar-thin">
                  {(() => {
                    const availableBundles = bundles.filter(b => {
                      if (b.status !== 'Approved') return false;
                      if (b.ledger_id) return false;
                      if (b.ledger_details && b.ledger_details.status !== 'Rejected') return false;
                      if (Array.isArray((b as any).ledgers) && (b as any).ledgers.length > 0) return false;
                      return true;
                    });

                    if (availableBundles.length === 0) {
                      return (
                        <div className="p-4 text-center text-xs text-on-surface-variant italic">
                          No unassigned approved bundles available.
                        </div>
                      );
                    }

                    return availableBundles.map((b) => {
                      const isSelected = selectedBundleIds.includes(b.claim_id);
                      return (
                        <div
                          key={b.claim_id}
                          onClick={() => {
                            setSelectedBundleIds(
                              isSelected
                                ? selectedBundleIds.filter(id => id !== b.claim_id)
                                : [...selectedBundleIds, b.claim_id]
                            );
                          }}
                          className={`flex items-center justify-between p-2.5 hover:bg-surface-container transition-colors cursor-pointer text-xs ${isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => { }}
                              className="accent-primary cursor-pointer rounded"
                            />
                            <div>
                              <span className="font-semibold text-primary">Bundle {b.claim_id}</span>
                              <span className="text-[11px] text-on-surface-variant ml-2">
                                {b.worker_detail?.full_name || b.worker_detail?.username || `Worker ${b.worker}`}
                              </span>
                              <span className="text-[10px] text-on-surface-variant block mt-0.5">
                                {b.expenses?.length || 0} expenses • {b.ticket_details ? `${b.ticket_details.work_order_no} - ${b.ticket_details.title}` : 'Multiple Tickets'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                              KD {parseFloat(b.total_claimed_amount).toFixed(2)}
                            </span>
                            <span className="text-[10px] text-on-surface-variant">
                              {b.period_from && b.period_to ? `${b.period_from} → ${b.period_to}` : 'Approved'}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* CLASSIFICATION SUMMARY / WARNING */}
              {selectedBundleIds.length > 0 && (
                <div className="space-y-2">
                  {classificationResult.hasUnmapped && (
                    <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>The following Sub-Department(s) are missing from your active Ledger Batch configurations:</span>
                      </div>

                      {/* Clean Sub-Department Chips */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {classificationResult.unmappedSubDepts.map(sd => (
                          <span
                            key={sd.subDeptName}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-container border border-amber-500/40 text-on-surface font-semibold text-xs shadow-2xs"
                          >
                            <Building2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>{sd.subDeptName}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {classificationResult.classifiedBatches.length > 0 && (
                    <div className="p-3 rounded bg-surface-container-high border border-outline-variant space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
                        <span className="flex items-center gap-1.5">
                          <Boxes className="w-3.5 h-3.5 text-primary" />
                          Ledger Batch Distribution ({classificationResult.classifiedBatches.length})
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          Total: {classificationResult.totalAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {classificationResult.classifiedBatches.map(group => (
                          <div
                            key={group.batch.ledger_batch_id}
                            className="p-2 rounded bg-surface-container border border-outline-variant/60 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-on-surface block">{group.batch.batch_name}</span>
                              <span className="text-[10px] text-on-surface-variant">
                                {group.bundles.length} bundle(s) • {group.expenses.length} expense(s)
                              </span>
                            </div>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {group.total.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Group selection / creation */}
              <div className="space-y-3 pt-1 relative z-20">
                <div className="relative z-30">
                  <label className="text-xs font-medium text-on-surface block mb-1">
                    Select Existing Ledger
                  </label>
                  <SearchableSelect
                    options={ledgerGroupSelectOptions}
                    value={selectedGroupId}
                    onChange={(val) => {
                      setSelectedGroupId(val);
                      if (val) setNewGroupName('');
                    }}
                    onSearchChange={handleGroupSearch}
                    loading={loadingGroups}
                    disableLocalFilter={true}
                    onDeleteOption={handleDeleteUnusedGroup}
                    placeholder="Search or select a ledger ..."
                  />
                </div>

                {selectedGroupId && (() => {
                  const currentGrp = dynamicGroups.find(g => String(g.ledger_group_id) === String(selectedGroupId)) ||
                    ledgerGroups?.find(g => String(g.ledger_group_id) === String(selectedGroupId));
                  if (currentGrp && isGroupUnused(currentGrp)) {
                    return (
                      <div className="flex items-center justify-between p-2.5 rounded bg-surface-container-high border border-outline-variant text-xs">
                        <div className="flex items-center gap-2 text-on-surface-variant">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <span>This group has no attached batches and is currently unused.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteUnusedGroup(selectedGroupId)}
                          className="px-2.5 py-1 rounded bg-error/10 text-error hover:bg-error/20 font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Group</span>
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}

                {!selectedGroupId && (
                  <div>
                    <label className="text-xs font-medium text-on-surface block mb-1">
                      New Ledger Name
                    </label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g. October 2026 Technicians Settlement"
                      className={`w-full px-3 py-2 rounded border bg-surface-container text-xs text-on-surface focus:outline-none transition-colors ${existingGroupWithSameName ? 'border-amber-500 focus:border-amber-600' : 'border-outline focus:border-primary'
                        }`}
                    />
                    {existingGroupWithSameName && (
                      <div className="mt-1.5 flex items-center justify-between p-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span>A group named "<strong>{existingGroupWithSameName.group_name}</strong>" already exists.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGroupId(String(existingGroupWithSameName.ledger_group_id));
                            setNewGroupName('');
                          }}
                          className="px-2.5 py-1 rounded bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors text-xs shrink-0 cursor-pointer"
                        >
                          Select Existing
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {setLedgerRemarks && (
                  <div>
                    <label className="text-xs font-medium text-on-surface block mb-1">
                      Remarks / Notes (Optional)
                    </label>
                    <textarea
                      value={ledgerRemarks}
                      onChange={(e) => setLedgerRemarks(e.target.value)}
                      placeholder="Add any specific notes or context for this ledger batch..."
                      rows={2}
                      className="w-full px-3 py-2 rounded border border-outline bg-surface-container text-xs text-on-surface focus:outline-none focus:border-primary resize-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant shrink-0">
              <button
                type="button"
                onClick={() => setShowCreateLedgerModal(false)}
                className="px-4 py-2 rounded border border-outline text-xs font-medium hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateLedger}
                disabled={submitting || selectedBundleIds.length === 0 || (!selectedGroupId && !newGroupName.trim()) || (!selectedGroupId && !!existingGroupWithSameName)}
                className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Assembling...</span>
                  </>
                ) : (
                  <>
                    <Boxes className="w-3.5 h-3.5" />
                    <span>
                      {classificationResult.classifiedBatches.length > 1
                        ? `${classificationResult.classifiedBatches.length} Ledgers will be created`
                        : 'Assemble Ledger Batch'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ATTACH BUNDLE TO LEDGER  */}
      {selectedGroupForAddBundle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container rounded-xl border border-outline-variant max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-on-surface">
                    Add Bundle to Ledger: {selectedGroupForAddBundle.groupName}
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Group {selectedGroupForAddBundle.groupId} • {selectedGroupForAddBundle.ledgers.length} Ledger Batches
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedGroupForAddBundle(null);
                  setSelectedBundleIdsToAttach([]);
                  setAttachBundleError(null);
                }}
                className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {attachBundleError && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{attachBundleError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachBundleError(null)}
                  className="p-0.5 hover:bg-red-500/20 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              <p className="text-xs text-on-surface">
                Select one or more approved worker claim bundles to add into this Ledger. The system will automatically place them into their corresponding ledger batches.
              </p>

              {loadingAvailableBundles ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs font-medium">Fetching approved bundles...</span>
                </div>
              ) : (() => {
                const availableSourceBundles = fetchedApprovedBundles !== null ? fetchedApprovedBundles : bundles;
                const groupBatches = selectedGroupForAddBundle.ledgers;
                const groupExpenseIds = new Set<number>();
                groupBatches.forEach(l => {
                  if (Array.isArray(l.expenses)) {
                    l.expenses.forEach(e => groupExpenseIds.add(e.expense_id));
                  }
                });

                // Find eligible approved bundles
                const eligibleBundlesWithTarget = availableSourceBundles.filter(b => {
                  if (b.status !== 'Approved') return false;
                  if (b.ledger_id && groupBatches.some(l => l.ledger_id === b.ledger_id)) return false;

                  const bundleExpenses = b.expenses || [];
                  if (bundleExpenses.length === 0) return false;

                  // Check if this bundle is already attached
                  const unattachedExpenses = bundleExpenses.filter(e => !groupExpenseIds.has(e.expense_id));
                  if (unattachedExpenses.length === 0) return false;

                  return true;
                }).map(b => {
                  const bundleExpenses = b.expenses || [];
                  // Find matching editable ledger in this group
                  const matchingLedger = groupBatches.find(l => {
                    const isEditable = !selectedGroupForAddBundle.isCompleted && l.status !== 'Paid';
                    if (!isEditable) return false;

                    const ledgerBatch = (ledgerBatches || internalBatches || []).find(
                      (bItem: any) => (bItem.batch_id || bItem.id) === l.ledger_batch || bItem.batch_name === l.ledger_batch_detail?.batch_name
                    ) || l.ledger_batch_detail;

                    const allowedSubDeptIds = new Set<number>();
                    if (ledgerBatch?.sub_departments && Array.isArray(ledgerBatch.sub_departments)) {
                      ledgerBatch.sub_departments.forEach((id: any) => allowedSubDeptIds.add(Number(id)));
                    }
                    if (ledgerBatch?.sub_departments_detail && Array.isArray(ledgerBatch.sub_departments_detail)) {
                      ledgerBatch.sub_departments_detail.forEach((sd: any) => allowedSubDeptIds.add(Number(sd.sub_department_id)));
                    }

                    if (allowedSubDeptIds.size === 0) return true; // General batch
                    return bundleExpenses.every(e => {
                      const sdId = e.ticket_details?.sub_department_id ?? e.sub_department_id;
                      return sdId && allowedSubDeptIds.has(Number(sdId));
                    });
                  }) || groupBatches[0];

                  return { bundle: b, targetLedger: matchingLedger };
                });

                if (eligibleBundlesWithTarget.length === 0) {
                  return (
                    <div className="p-4 rounded border border-outline-variant bg-surface-container-low text-xs text-on-surface-variant italic text-center">
                      No eligible approved bundles available to add to {selectedGroupForAddBundle.groupName}.
                    </div>
                  );
                }

                const totalEligibleCount = eligibleBundlesWithTarget.length;
                const selectedCount = selectedBundleIdsToAttach.length;
                const isAllSelected = totalEligibleCount > 0 && selectedCount === totalEligibleCount;
                const selectedTotalAmount = eligibleBundlesWithTarget
                  .filter(item => selectedBundleIdsToAttach.includes(item.bundle.claim_id))
                  .reduce((sum, item) => sum + (parseFloat(item.bundle.total_claimed_amount) || 0), 0);

                return (
                  <div className="space-y-2.5">
                    {/* Multi-select Header Toolbar */}
                    <div className="flex items-center justify-between px-3 py-2 bg-surface-container rounded border border-outline-variant text-xs">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBundleIdsToAttach(eligibleBundlesWithTarget.map(item => item.bundle.claim_id));
                            } else {
                              setSelectedBundleIdsToAttach([]);
                            }
                          }}
                          className="accent-primary cursor-pointer rounded"
                        />
                        <span className="font-semibold text-on-surface">
                          Select All ({totalEligibleCount})
                        </span>
                      </label>
                      <div className="text-[11px] font-medium text-on-surface-variant">
                        {selectedCount > 0 ? (
                          <span>
                            <strong className="text-primary font-semibold">{selectedCount}</strong> selected • <strong className="text-emerald-600 dark:text-emerald-400 font-bold">KD {selectedTotalAmount.toFixed(2)}</strong>
                          </span>
                        ) : (
                          <span>0 selected</span>
                        )}
                      </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto border border-outline-variant rounded divide-y divide-outline-variant bg-surface-container-low scrollbar-thin">
                      {eligibleBundlesWithTarget.map(({ bundle: b, targetLedger }) => {
                        const bundleExpenses = b.expenses || [];
                        const isSelected = selectedBundleIdsToAttach.includes(b.claim_id);

                        const toggleSelection = () => {
                          setSelectedBundleIdsToAttach(prev =>
                            prev.includes(b.claim_id)
                              ? prev.filter(id => id !== b.claim_id)
                              : [...prev, b.claim_id]
                          );
                        };

                        return (
                          <div
                            key={b.claim_id}
                            onClick={toggleSelection}
                            className={`p-3 flex items-start justify-between text-xs transition-colors cursor-pointer ${isSelected
                              ? 'bg-primary/10 border-l-4 border-l-primary'
                              : 'hover:bg-surface-container'
                              }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={toggleSelection}
                                onClick={(e) => e.stopPropagation()}
                                className="accent-primary mt-0.5 cursor-pointer rounded"
                              />
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-primary">Bundle {b.claim_id}</span>
                                  <span className="text-[11px] text-on-surface font-medium">
                                    {b.worker_detail?.full_name || b.worker_detail?.username || `Worker ${b.worker}`}
                                  </span>
                                </div>
                                <div className="text-[10px] text-on-surface-variant">
                                  Period: {b.period_from && b.period_to ? `${b.period_from} → ${b.period_to}` : 'All Expenses'} • {bundleExpenses.length} expense{bundleExpenses.length > 1 ? 's' : ''}
                                </div>

                                {targetLedger && (
                                  <div className="pt-0.5 flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">
                                      ✓ Targets: {targetLedger.ledger_batch_detail?.batch_name || `Batch ${targetLedger.ledger_id}`}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                                KD {parseFloat(b.total_claimed_amount).toFixed(2)}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                                Approved
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupForAddBundle(null);
                  setSelectedBundleIdsToAttach([]);
                }}
                className="px-4 py-2 rounded border border-outline text-xs font-medium hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAttachBundleToGroup}
                disabled={attachingBundle || selectedBundleIdsToAttach.length === 0}
                className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {attachingBundle ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      Adding {selectedBundleIdsToAttach.length > 1 ? `${selectedBundleIdsToAttach.length} Bundles` : 'Bundle'} to Group...
                    </span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>
                      Add {selectedBundleIdsToAttach.length > 0 ? `${selectedBundleIdsToAttach.length} ` : ''}Bundle{selectedBundleIdsToAttach.length === 1 ? '' : 's'} to Group
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: LEDGER  SETTLEMENT REPORT */}
      {selectedGroupForReport && (
        <LedgerGroupReportModal
          group={selectedGroupForReport}
          onClose={() => setSelectedGroupForReport(null)}
          setSelectedTicketForModal={setSelectedTicketForModal}
        />
      )}

      {/* Confirmation Modal for Marking Ledger  as Completed */}
      {groupToConfirmComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl max-w-md w-full p-6 text-on-surface space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-on-surface">Confirm Ledger  Completion</h3>
                <p className="text-xs text-on-surface-variant mt-1">
                  Are you sure you want to mark <strong className="text-on-surface font-semibold">{groupToConfirmComplete.groupName}</strong> as Completed?
                </p>
              </div>
            </div>

            <div className="bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 rounded-xl p-3.5 text-xs space-y-2 text-amber-900 dark:text-amber-200">
              <div className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                <Lock className="w-3.5 h-3.5" />
                <span>Important Locking Rules:</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-on-surface-variant">
                <li>This Ledger will be <strong>permanently locked</strong>.</li>
                <li><strong>No batches, bundles, or expenses</strong> can be added, removed, or reassigned.</li>
                <li>The Ledger will be finalized exclusively for <strong>reporting & audit settlement</strong>.</li>
              </ul>
            </div>

            {completingGroupError && (
              <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{completingGroupError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setGroupToConfirmComplete(null);
                  setCompletingGroupError(null);
                }}
                disabled={completingGroupId !== null}
                className="px-4 py-2 rounded-xl border border-outline-variant hover:bg-surface-container-high text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCompleteLedgerGroup(groupToConfirmComplete)}
                disabled={completingGroupId !== null}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50"
              >
                {completingGroupId !== null ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Completing & Locking...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Yes, Mark as Completed</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
