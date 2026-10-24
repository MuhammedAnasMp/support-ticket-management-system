/**
 * OfflineSyncManager.ts
 * Manages background and on-demand synchronization of offline queued media files.
 */

import {
    getOfflineMediaQueue,
    removeOfflineMediaQueueItem,
    updateOfflineMediaQueueItem,
    type QueuedMediaItem
} from './offlineStorage';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface SyncStatus {
    isOnline: boolean;
    isSyncing: boolean;
    queuedCount: number;
    lastSyncedAt: number | null;
    currentSyncItem: string | null;
}

type SyncListener = (status: SyncStatus) => void;

class OfflineSyncManagerClass {
    private isSyncing = false;
    private queuedCount = 0;
    private lastSyncedAt: number | null = null;
    private currentSyncItem: string | null = null;
    private listeners: Set<SyncListener> = new Set();
    private initialized = false;

    constructor() {
        if (typeof window !== 'undefined') {
            this.updateQueuedCount();
            window.addEventListener('online', () => {
                this.notify();
                this.triggerSync();
            });
            window.addEventListener('offline', () => {
                this.notify();
            });
            window.addEventListener('offline-media-queue-changed', () => {
                this.updateQueuedCount();
            });
        }
    }

    public init() {
        if (this.initialized) return;
        this.initialized = true;
        this.updateQueuedCount().then(() => {
            if (navigator.onLine && this.queuedCount > 0) {
                this.triggerSync();
            }
        });
    }

    public subscribe(listener: SyncListener): () => void {
        this.listeners.add(listener);
        listener(this.getStatus());
        return () => this.listeners.delete(listener);
    }

    public getStatus(): SyncStatus {
        return {
            isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
            isSyncing: this.isSyncing,
            queuedCount: this.queuedCount,
            lastSyncedAt: this.lastSyncedAt,
            currentSyncItem: this.currentSyncItem,
        };
    }

    private notify() {
        const status = this.getStatus();
        this.listeners.forEach((listener) => {
            try {
                listener(status);
            } catch (err) {
                console.error('Error notifying sync listener:', err);
            }
        });
    }

    public async updateQueuedCount(): Promise<number> {
        try {
            const queue = await getOfflineMediaQueue();
            this.queuedCount = queue.length;
            this.notify();
            return this.queuedCount;
        } catch {
            return 0;
        }
    }

    public async triggerSync(): Promise<void> {
        if (this.isSyncing) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) return;

        const queue = await getOfflineMediaQueue();
        if (queue.length === 0) {
            this.queuedCount = 0;
            this.notify();
            return;
        }

        this.isSyncing = true;
        this.notify();

        try {
            for (const item of queue) {
                // If offline suddenly dropped, abort
                if (!navigator.onLine) {
                    break;
                }

                this.currentSyncItem = item.fileName;
                this.notify();

                await updateOfflineMediaQueueItem(item.id, { status: 'uploading' });

                const success = await this.uploadSingleItem(item, token);
                if (success) {
                    await removeOfflineMediaQueueItem(item.id);
                    this.lastSyncedAt = Date.now();
                    // Dispatch notification to any open ticket view
                    window.dispatchEvent(
                        new CustomEvent('ticket-media-synced', {
                            detail: { ticketId: item.ticketId, mediaId: item.id }
                        })
                    );
                } else {
                    await updateOfflineMediaQueueItem(item.id, {
                        status: 'failed',
                        retryCount: (item.retryCount || 0) + 1,
                        lastError: 'Upload failed or server unreachable',
                    });
                }
            }
        } catch (err) {
            console.error('OfflineSyncManager error during sync loop:', err);
        } finally {
            this.isSyncing = false;
            this.currentSyncItem = null;
            await this.updateQueuedCount();
        }
    }

    private async uploadSingleItem(item: QueuedMediaItem, token: string): Promise<boolean> {
        try {
            const formData = new FormData();
            formData.append('ticket', item.ticketId.toString());
            // Create a File from Blob with correct name and type
            const file = new File([item.fileBlob], item.fileName, { type: item.fileType });
            formData.append('file_url', file);
            formData.append('file_name', item.fileName);
            if (item.workerId) {
                formData.append('uploaded_by', item.workerId.toString());
            }
            if (item.categoryId) {
                formData.append('category', item.categoryId.toString());
            }
            if (item.rotation) {
                formData.append('rotation', item.rotation.toString());
            }
            if (item.capturedAt) {
                formData.append('captured_date', item.capturedAt);
            }

            const response = await fetch(`${API_URL}/common/media/`, {
                method: 'POST',
                headers: { Authorization: `Token ${token}` },
                body: formData,
            });

            return response.ok;
        } catch (err) {
            console.warn(`Failed to upload queued item ${item.id}:`, err);
            return false;
        }
    }
}

export const offlineSyncManager = new OfflineSyncManagerClass();

// React hook for observing sync state and triggering manual sync
import { useState, useEffect } from 'react';

export const useOfflineSync = () => {
    const [status, setStatus] = useState<SyncStatus>(offlineSyncManager.getStatus());

    useEffect(() => {
        offlineSyncManager.init();
        return offlineSyncManager.subscribe(setStatus);
    }, []);

    const syncNow = () => offlineSyncManager.triggerSync();

    return { ...status, syncNow };
};
