import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sliders, X, Loader2, Plus, Trash2, Check, AlertCircle, Building2, Store, Lock, ShieldCheck } from 'lucide-react';
import { SearchableSelect } from '@/components/SearchableSelect';

interface ThrottleSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    token: string | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const ThrottleSettingsModal: React.FC<ThrottleSettingsModalProps> = ({
    isOpen,
    onClose,
    token
}) => {
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [departments, setDepartments] = useState<any[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [customThrottles, setCustomThrottles] = useState<any[]>([]);
    const [isFullAdmin, setIsFullAdmin] = useState(true);
    const [allowedDeptIds, setAllowedDeptIds] = useState<number[] | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Form for new custom store throttle
    const [selectedStoreId, setSelectedStoreId] = useState('');
    const [selectedDeptId, setSelectedDeptId] = useState('');
    const [customLimit, setCustomLimit] = useState('10');

    // Fetch settings
    const fetchSettings = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/stores/throttle-settings/`, {
                headers: { Authorization: `Token ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDepartments(data.departments || []);
                setStores(data.stores || []);
                setCustomThrottles(data.custom_throttles || []);
                setIsFullAdmin(data.is_full_admin ?? true);
                setAllowedDeptIds(data.allowed_department_ids ?? null);

                // If office admin with single department, auto-select it
                if (!data.is_full_admin && data.allowed_department_ids && data.allowed_department_ids.length === 1) {
                    setSelectedDeptId(String(data.allowed_department_ids[0]));
                }
            }
        } catch (err) {
            console.error('Failed to load throttle settings:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchSettings();
            setFeedback(null);
            setSelectedStoreId('');
            setSelectedDeptId('');
            setCustomLimit('10');
        }
    }, [isOpen]);

    // Update Department default limit
    const handleUpdateDeptThrottle = async (deptId: number, limitVal: string) => {
        if (!token) return;
        const limitNum = parseInt(limitVal, 10);
        if (isNaN(limitNum) || limitNum < 0) return;
        setActionLoading(true);
        setFeedback(null);
        try {
            const res = await fetch(`${API_URL}/stores/throttle-settings/`, {
                method: 'POST',
                headers: {
                    Authorization: `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'department',
                    department_id: deptId,
                    throttle_limit: limitNum
                })
            });
            if (res.ok) {
                setFeedback({ type: 'success', message: 'Department throttle updated successfully.' });
                await fetchSettings();
            } else {
                const err = await res.json().catch(() => null);
                setFeedback({ type: 'error', message: err?.detail || err?.error || 'Failed to update department throttle.' });
            }
        } catch (err: any) {
            setFeedback({ type: 'error', message: err?.message || 'Network error.' });
        } finally {
            setActionLoading(false);
        }
    };

    // Add Custom Store Throttle
    const handleAddCustomThrottle = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStoreId || !customLimit) return;
        const limitNum = parseInt(customLimit, 10);
        if (isNaN(limitNum) || limitNum < 0) return;

        // Office Admin must specify their department
        if (!isFullAdmin && !selectedDeptId) {
            setFeedback({ type: 'error', message: 'Please select your department for this store override.' });
            return;
        }

        setActionLoading(true);
        setFeedback(null);
        try {
            const bodyData = selectedDeptId
                ? {
                    type: 'store_department',
                    store_id: selectedStoreId,
                    department_id: selectedDeptId,
                    throttle_limit: limitNum
                }
                : {
                    type: 'store',
                    store_id: selectedStoreId,
                    throttle_limit: limitNum
                };

            const res = await fetch(`${API_URL}/stores/throttle-settings/`, {
                method: 'POST',
                headers: {
                    Authorization: `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bodyData)
            });

            if (res.ok) {
                setFeedback({ type: 'success', message: 'Custom store throttle saved successfully.' });
                setSelectedStoreId('');
                if (isFullAdmin) {
                    setSelectedDeptId('');
                }
                setCustomLimit('10');
                await fetchSettings();
            } else {
                const err = await res.json().catch(() => null);
                setFeedback({ type: 'error', message: err?.detail || err?.error || 'Failed to set custom throttle.' });
            }
        } catch (err: any) {
            setFeedback({ type: 'error', message: err?.message || 'Network error.' });
        } finally {
            setActionLoading(false);
        }
    };

    // Remove Custom Store Throttle
    const handleRemoveCustomThrottle = async (type: 'store' | 'store_department', idOrStoreId: any, deptId?: any) => {
        if (!token) return;
        if (!window.confirm('Remove this custom throttle override? The location will revert to department default.')) return;
        setActionLoading(true);
        setFeedback(null);
        try {
            const bodyData: any = { type };
            if (type === 'store') {
                bodyData.store_id = idOrStoreId;
            } else {
                bodyData.id = idOrStoreId;
            }

            const res = await fetch(`${API_URL}/stores/throttle-settings/`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bodyData)
            });

            if (res.ok) {
                setFeedback({ type: 'success', message: 'Custom override removed. Reverted to department default.' });
                await fetchSettings();
            } else {
                const err = await res.json().catch(() => null);
                setFeedback({ type: 'error', message: err?.detail || err?.error || 'Failed to remove custom throttle.' });
            }
        } catch (err: any) {
            setFeedback({ type: 'error', message: err?.message || 'Network error.' });
        } finally {
            setActionLoading(false);
        }
    };

    // Filter departments for creation dropdown if office admin
    const availableDepartmentsForCustom = isFullAdmin
        ? departments
        : departments.filter(d => allowedDeptIds?.includes(d.department_id));

    // Stores with store-level overrides
    const storeOverrides = stores.filter(s => s.location_approval_throttle !== null && s.location_approval_throttle !== undefined);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.6 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs touch-manipulation"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 16 }}
                        className="relative bg-surface-container border border-outline-variant w-full max-w-2xl max-h-[90vh] flex flex-col rounded shadow-2xl overflow-hidden z-10"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant bg-surface-container-low">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 text-primary rounded flex items-center justify-center">
                                    <Sliders className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-semibold text-on-surface">Location Approval Throttle Settings</h3>

                                    </div>

                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-6">
                            {/* Feedback Toast */}
                            {feedback && (
                                <div
                                    className={`p-3 rounded text-xs flex items-center gap-2 border ${feedback.type === 'success'
                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                                        : 'bg-error-container text-on-error-container border-error/20'
                                        }`}
                                >
                                    {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                    <span>{feedback.message}</span>
                                </div>
                            )}


                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                                    <p className="text-xs">Loading throttle rules...</p>
                                </div>
                            ) : (
                                <>
                                    {/* 1. Department Defaults Section */}
                                    <div className="space-y-3">

                                        <p className="text-xs text-on-surface-variant">
                                            Default pending Location Approval limit applied to all stores under each department.
                                        </p>

                                        <div className="border border-outline-variant rounded overflow-hidden divide-y divide-outline-variant bg-surface">
                                            {departments.map(dept => {
                                                const canEdit = isFullAdmin || dept.can_edit;
                                                return canEdit && (
                                                    <div
                                                        key={dept.department_id}
                                                        className={`px-4 py-3 flex items-center justify-between gap-4 ${!canEdit ? 'bg-surface-container-low/40 opacity-80' : ''
                                                            }`}
                                                    >
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-semibold text-on-surface">
                                                                    {dept.department_name}
                                                                </span>
                                                                {canEdit && !isFullAdmin && (
                                                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-[9px]">
                                                                        Your Department
                                                                    </span>
                                                                )}
                                                                {!canEdit && (
                                                                    <span className="flex items-center gap-1 text-[10px] text-on-surface-variant/80 font-medium">
                                                                        <Lock className="w-3 h-3" /> Locked
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-on-surface-variant">
                                                                Current default limit: <strong className="text-primary">{dept.location_approval_throttle ?? 5} tickets</strong>
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {canEdit ? (
                                                                <>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max="100"
                                                                        defaultValue={dept.location_approval_throttle ?? 5}
                                                                        id={`dept-throttle-${dept.department_id}`}
                                                                        className="w-20 bg-surface-container border border-outline-variant text-on-surface text-xs rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary focus:outline-none font-semibold text-center"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        disabled={actionLoading}
                                                                        onClick={() => {
                                                                            const el = document.getElementById(`dept-throttle-${dept.department_id}`) as HTMLInputElement;
                                                                            if (el) handleUpdateDeptThrottle(dept.department_id, el.value);
                                                                        }}
                                                                        className="px-3 py-1.5 rounded bg-primary hover:bg-primary-hover text-white text-xs font-medium transition-colors shadow-2xs disabled:opacity-50"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <span className="text-xs font-bold text-on-surface-variant px-3 py-1.5 rounded bg-surface-container-high border border-outline-variant">
                                                                    {dept.location_approval_throttle ?? 5} tickets
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 2. Custom Store Throttle Overrides */}
                                    <div className="space-y-4 pt-4 border-t border-outline-variant">

                                        <p className="text-xs text-on-surface-variant">
                                            OR allow specific custom throttle limits.
                                        </p>

                                        {/* Add Custom Override Form */}
                                        <form onSubmit={handleAddCustomThrottle} className="p-4 rounded border border-outline-variant bg-surface-container-low space-y-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-medium text-on-surface mb-1">
                                                        Select Store <span className="text-error">*</span>
                                                    </label>
                                                    <SearchableSelect
                                                        required
                                                        value={selectedStoreId}
                                                        onChange={val => setSelectedStoreId(val)}
                                                        placeholder="Select Store"
                                                        options={stores.map(s => ({
                                                            value: s.store_id,
                                                            label: `${s.store_id} - ${s.store_name}`
                                                        }))}
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-medium text-on-surface mb-1">
                                                        Department {!isFullAdmin && <span className="text-error">*</span>}
                                                    </label>
                                                    <SearchableSelect
                                                        value={selectedDeptId}
                                                        onChange={val => setSelectedDeptId(val)}
                                                        placeholder={isFullAdmin ? "All Departments (Store-wide)" : "Select Department"}
                                                        options={
                                                            isFullAdmin
                                                                ? [
                                                                    { value: '', label: 'All Departments (Store-wide)' },
                                                                    ...availableDepartmentsForCustom.map(d => ({
                                                                        value: String(d.department_id),
                                                                        label: d.department_name
                                                                    }))
                                                                ]
                                                                : availableDepartmentsForCustom.map(d => ({
                                                                    value: String(d.department_id),
                                                                    label: d.department_name
                                                                }))
                                                        }
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-medium text-on-surface mb-1">
                                                        Custom Limit <span className="text-error">*</span>
                                                    </label>
                                                    <input
                                                        required
                                                        type="number"
                                                        min="0"
                                                        max="500"
                                                        placeholder="e.g. 10"
                                                        value={customLimit}
                                                        onChange={e => setCustomLimit(e.target.value)}
                                                        className="w-full bg-surface-container border border-outline-variant text-on-surface text-xs rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex justify-end pt-1">
                                                <button
                                                    type="submit"
                                                    disabled={actionLoading || !selectedStoreId || !customLimit || (!isFullAdmin && !selectedDeptId)}
                                                    className="px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Set Custom Throttle
                                                </button>
                                            </div>
                                        </form>

                                        {/* Active Custom Overrides List */}
                                        <div className="space-y-2">
                                            <h5 className="text-xs font-semibold text-on-surface">Active Custom Overrides</h5>

                                            {storeOverrides.length === 0 && customThrottles.length === 0 ? (
                                                <div className="p-4 rounded border border-dashed border-outline-variant text-center text-xs text-on-surface-variant">
                                                    No custom store overrides configured. All stores currently follow Department default limits.
                                                </div>
                                            ) : (
                                                <div className="border border-outline-variant rounded overflow-hidden divide-y divide-outline-variant bg-surface">
                                                    {/* Store-wide overrides */}
                                                    {storeOverrides.map(s => (
                                                        <div key={s.store_id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                                                            <div>
                                                                <span className="font-semibold text-on-surface">{s.store_name}</span>
                                                                <span className="ml-2 px-2 py-0.5 rounded bg-primary/10 text-primary font-bold text-[10px]">
                                                                    Store-wide Limit: {s.location_approval_throttle}
                                                                </span>
                                                            </div>
                                                            {isFullAdmin ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveCustomThrottle('store', s.store_id)}
                                                                    className="text-error hover:bg-error/10 p-1.5 rounded transition-colors flex items-center gap-1 text-[11px] font-medium"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                    Remove
                                                                </button>
                                                            ) : (
                                                                <span className="text-[10px] text-on-surface-variant/70 font-medium">
                                                                    Global Override
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}

                                                    {/* Store-Department overrides */}
                                                    {customThrottles.map(ct => {
                                                        const canEdit = isFullAdmin || ct.can_edit;
                                                        return (
                                                            <div key={`ct-${ct.id}`} className="px-4 py-2.5 flex items-center justify-between text-xs">
                                                                <div>
                                                                    <span className="font-semibold text-on-surface">{ct.store_name}</span>
                                                                    <span className="text-on-surface-variant mx-1.5">/</span>
                                                                    <span className="font-medium text-on-surface">{ct.department_name}</span>
                                                                    <span className="ml-2 px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold text-[10px]">
                                                                        Limit: {ct.throttle_limit}
                                                                    </span>
                                                                </div>
                                                                {canEdit ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveCustomThrottle('store_department', ct.id)}
                                                                        className="text-error hover:bg-error/10 p-1.5 rounded transition-colors flex items-center gap-1 text-[11px] font-medium"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                        Remove
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-[10px] text-on-surface-variant/70 font-medium">
                                                                        Other Dept
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end px-5 py-3 border-t border-outline-variant bg-surface-container-low">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

