/**
 * offlineStorage.ts
 * Browser IndexedDB storage for offline ticket caching and pending "After Repair" media uploads.
 */

const DB_NAME = 'MaintenanceTrackerOfflineDB';
const DB_VERSION = 1;

export interface QueuedMediaItem {
    id: string; // unique ID
    ticketId: number;
    categoryName: string; // 'After Repair', 'Before Repair', etc.
    categoryId?: number;
    fileBlob: Blob;
    fileName: string;
    fileType: string;
    capturedAt: string; // ISO string captured on camera trigger
    rotation: number;
    workerId?: number;
    expenseId?: number;
    ticketWorkOrderNo?: string;
    ticketStoreName?: string;
    status: 'pending' | 'uploading' | 'failed';
    retryCount: number;
    lastError?: string;
    createdAt: number;
}

let dbInstance: IDBDatabase | null = null;

export const initOfflineDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        if (typeof window === 'undefined' || !window.indexedDB) {
            reject(new Error('IndexedDB is not supported in this environment'));
            return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // 1. Store for cached tickets
            if (!db.objectStoreNames.contains('cached_tickets')) {
                db.createObjectStore('cached_tickets', { keyPath: 'ticket_id' });
            }

            // 2. Store for cached metadata (stores, categories, depts)
            if (!db.objectStoreNames.contains('cached_metadata')) {
                db.createObjectStore('cached_metadata', { keyPath: 'key' });
            }

            // 3. Store for offline queued media uploads
            if (!db.objectStoreNames.contains('offline_media_queue')) {
                const mediaStore = db.createObjectStore('offline_media_queue', { keyPath: 'id' });
                mediaStore.createIndex('ticketId', 'ticketId', { unique: false });
                mediaStore.createIndex('status', 'status', { unique: false });
                mediaStore.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onerror = () => {
            reject(request.error || new Error('Failed to open IndexedDB'));
        };
    });
};

// ─── TICKET CACHING ──────────────────────────────────────────────────────────

export const saveTicketsToOfflineCache = async (tickets: any[]): Promise<void> => {
    if (!Array.isArray(tickets) || tickets.length === 0) return;
    try {
        const db = await initOfflineDB();
        const tx = db.transaction('cached_tickets', 'readwrite');
        const store = tx.objectStore('cached_tickets');
        for (const ticket of tickets) {
            if (ticket && ticket.ticket_id) {
                store.put(ticket);
            }
        }
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.warn('saveTicketsToOfflineCache error:', err);
    }
};

export const getOfflineCachedTickets = async (): Promise<any[]> => {
    try {
        const db = await initOfflineDB();
        const tx = db.transaction('cached_tickets', 'readonly');
        const store = tx.objectStore('cached_tickets');
        const req = store.getAll();
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('getOfflineCachedTickets error:', err);
        return [];
    }
};

export const getOfflineCachedTicket = async (ticketId: number): Promise<any | null> => {
    try {
        const db = await initOfflineDB();
        const tx = db.transaction('cached_tickets', 'readonly');
        const store = tx.objectStore('cached_tickets');
        const req = store.get(ticketId);
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('getOfflineCachedTicket error:', err);
        return null;
    }
};

// ─── METADATA CACHING ────────────────────────────────────────────────────────

export const saveMetadataToOfflineCache = async (key: string, data: any): Promise<void> => {
    try {
        const db = await initOfflineDB();
        const tx = db.transaction('cached_metadata', 'readwrite');
        const store = tx.objectStore('cached_metadata');
        store.put({ key, data, updatedAt: Date.now() });
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.warn('saveMetadataToOfflineCache error:', err);
    }
};

export const getOfflineCachedMetadata = async <T = any>(key: string): Promise<T | null> => {
    try {
        const db = await initOfflineDB();
        const tx = db.transaction('cached_metadata', 'readonly');
        const store = tx.objectStore('cached_metadata');
        const req = store.get(key);
        return new Promise((resolve, reject) => {
            req.onsuccess = () => {
                const res = req.result;
                resolve(res ? res.data : null);
            };
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('getOfflineCachedMetadata error:', err);
        return null;
    }
};

// ─── OFFLINE MEDIA QUEUE ────────────────────────────────────────────────────

export const enqueueOfflineMedia = async (item: QueuedMediaItem): Promise<void> => {
    try {
        const db = await initOfflineDB();
        const tx = db.transaction('offline_media_queue', 'readwrite');
        const store = tx.objectStore('offline_media_queue');
        store.put(item);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => {
                // Dispatch event so UI components can update badge/previews
                window.dispatchEvent(new CustomEvent('offline-media-queue-changed', { detail: { item } }));
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error('enqueueOfflineMedia error:', err);
        throw err;
    }
};

export const getOfflineMediaQueue = async (ticketId?: number): Promise<QueuedMediaItem[]> => {
    try {
        const db = await initOfflineDB();
        const tx = db.transaction('offline_media_queue', 'readonly');
        const store = tx.objectStore('offline_media_queue');
        
        let req: IDBRequest<QueuedMediaItem[]>;
        if (ticketId !== undefined) {
            const index = store.index('ticketId');
            req = index.getAll(ticketId);
        } else {
            req = store.getAll();
        }

        return new Promise((resolve, reject) => {
            req.onsuccess = () => {
                const results = req.result || [];
                // Sort by creation time ascending
                results.sort((a, b) => a.createdAt - b.createdAt);
                resolve(results);
            };
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('getOfflineMediaQueue error:', err);
        return [];
    }
};

export const removeOfflineMediaQueueItem = async (id: string): Promise<void> => {
    try {
        const db = await initOfflineDB();
        const tx = db.transaction('offline_media_queue', 'readwrite');
        const store = tx.objectStore('offline_media_queue');
        store.delete(id);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => {
                window.dispatchEvent(new CustomEvent('offline-media-queue-changed', { detail: { removedId: id } }));
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error('removeOfflineMediaQueueItem error:', err);
    }
};

export const updateOfflineMediaQueueItem = async (id: string, updates: Partial<QueuedMediaItem>): Promise<void> => {
    try {
        const db = await initOfflineDB();
        const tx = db.transaction('offline_media_queue', 'readwrite');
        const store = tx.objectStore('offline_media_queue');
        const getReq = store.get(id);

        return new Promise((resolve, reject) => {
            getReq.onsuccess = () => {
                const existing = getReq.result;
                if (!existing) {
                    resolve();
                    return;
                }
                const updated = { ...existing, ...updates };
                store.put(updated);
            };
            tx.oncomplete = () => {
                window.dispatchEvent(new CustomEvent('offline-media-queue-changed', { detail: { updatedId: id } }));
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error('updateOfflineMediaQueueItem error:', err);
    }
};
