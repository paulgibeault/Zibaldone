import { create } from 'zustand';
import { uploadFile } from '../api';

export interface UploadItem {
    id: string;
    file: File;
    metadata: any;
    status: 'pending' | 'uploading' | 'completed' | 'error' | 'conflict';
    progress: number;
    error?: string;
    path: string; // Relative path including filename
    conflictData?: {
        resolution?: 'new_version' | 'new_file';
    };
}

interface UploadQueueState {
    queue: UploadItem[];
    concurrency: number;
    isProcessing: boolean;
    uploadMode: 'sequential' | 'parallel'; // Just in case we want to toggle

    addFiles: (files: File[], metadataGenerator: (file: File) => Promise<any>) => void;
    processQueue: () => Promise<void>;
    retry: (id: string) => void;
    resolveConflict: (id: string, resolution: 'new_version' | 'new_file') => Promise<void>;
    clearCompleted: () => void;
    remove: (id: string) => void;
    setConcurrency: (level: number) => void;
}

export const useUploadQueue = create<UploadQueueState>((set, get) => ({
    queue: [],
    concurrency: 3,
    isProcessing: false,
    uploadMode: 'parallel',

    addFiles: async (files: File[], metadataGenerator: (file: File) => Promise<any>) => {
        const newItems: UploadItem[] = await Promise.all(files.map(async (file: File) => {
             // Handle webkitRelativePath for folders, standard drag-drop might need heuristics or pre-processing
            const path = file.webkitRelativePath || (file as any).path || file.name;
            const metadata = await metadataGenerator(file);
            
            return {
                id: Math.random().toString(36).substring(7),
                file,
                metadata: {
                    ...metadata,
                    client_context: {
                        ...metadata.client_context,
                        filePath: path 
                    }
                },
                status: 'pending',
                progress: 0,
                path
            };
        }));

        set((state) => ({ queue: [...state.queue, ...newItems] }));
        get().processQueue();
    },

    processQueue: async () => {
        const state = get();
        if (state.isProcessing) return;

        set({ isProcessing: true });

        try {
            while (true) {
                const currentQueue = get().queue;
                const uploadingCount = currentQueue.filter((i: UploadItem) => i.status === 'uploading').length;
                const pendingItems = currentQueue.filter((i: UploadItem) => i.status === 'pending');

                if (pendingItems.length === 0 && uploadingCount === 0) {
                    break;
                }

                if (pendingItems.length === 0 || uploadingCount >= state.concurrency) {
                     if (uploadingCount >= state.concurrency) {
                         await new Promise(resolve => setTimeout(resolve, 100));
                         continue;
                     }
                }
                
                // Get next batch of items up to concurrency limit
                const slotsAvailable = state.concurrency - uploadingCount;
                const toUpload = pendingItems.slice(0, slotsAvailable);

                if (toUpload.length === 0 && uploadingCount > 0) {
                     await new Promise(resolve => setTimeout(resolve, 100));
                     continue;
                }

                // Start uploads
                toUpload.forEach((item: UploadItem) => {
                    set((state: UploadQueueState) => ({
                        queue: state.queue.map((i: UploadItem) => i.id === item.id ? { ...i, status: 'uploading' } : i)
                    }));
                    
                    // Trigger upload (async, don't await here inside the scheduling loop)
                    (async () => {
                        try {
                            await uploadFile(item.file, item.metadata);
                            set((state: UploadQueueState) => ({
                                queue: state.queue.map((i: UploadItem) => i.id === item.id ? { ...i, status: 'completed', progress: 100 } : i)
                            }));
                        } catch (error: any) {
                            console.error(`Error uploading ${item.path}:`, error);
                            // Detect 409 Conflict
                             if (error.response && error.response.status === 409) {
                                 set((state: UploadQueueState) => ({
                                    queue: state.queue.map((i: UploadItem) => i.id === item.id ? { ...i, status: 'conflict' } : i)
                                }));
                            } else {
                                set((state: UploadQueueState) => ({
                                    queue: state.queue.map((i: UploadItem) => i.id === item.id ? { ...i, status: 'error', error: error.message || 'Upload failed' } : i)
                                }));
                            }
                        }
                    })();
                });
                
                // Small yield to allow React state updates to propagate
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        } finally {
            set({ isProcessing: false });
        }
    },

    retry: (id: string) => {
        set((state: UploadQueueState) => ({
            queue: state.queue.map((i: UploadItem) => i.id === id ? { ...i, status: 'pending', error: undefined } : i)
        }));
        get().processQueue();
    },

    resolveConflict: async (id: string, resolution: 'new_version' | 'new_file') => {
        const item = get().queue.find((i: UploadItem) => i.id === id);
        if (!item) return;

        set((state: UploadQueueState) => ({
            queue: state.queue.map((i: UploadItem) => i.id === id ? { ...i, status: 'uploading' } : i)
        }));

        try {
            await uploadFile(item.file, item.metadata, resolution);
             set((state: UploadQueueState) => ({
                queue: state.queue.map((i: UploadItem) => i.id === id ? { ...i, status: 'completed', progress: 100 } : i)
            }));
            // Trigger processQueue to ensure others keep going if this was blocking (though it's async)
            get().processQueue();
        } catch (error: any) {
            console.error(`Error resolving conflict for ${item.path}:`, error);
             set((state: UploadQueueState) => ({
                queue: state.queue.map((i: UploadItem) => i.id === id ? { ...i, status: 'error', error: "Failed to resolve conflict" } : i)
            }));
        }
    },

    remove: (id: string) => {
        set((state: UploadQueueState) => ({
            queue: state.queue.filter((i: UploadItem) => i.id !== id)
        }));
    },

    clearCompleted: () => {
        set((state: UploadQueueState) => ({
            queue: state.queue.filter((i: UploadItem) => i.status !== 'completed')
        }));
    },

    setConcurrency: (level: number) => set({ concurrency: level })
}));
