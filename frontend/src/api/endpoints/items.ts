import axios from 'axios';
import { apiClient } from '../client';
import type { ContentItem, SearchResponse } from '../types';

export const addTagToItem = async (itemId: string, tagId: string): Promise<ContentItem> => {
    const response = await apiClient.post(`/items/${itemId}/tags/${tagId}`);
    return response.data;
};

export const removeTagFromItem = async (itemId: string, tagId: string): Promise<ContentItem> => {
    const response = await apiClient.delete(`/items/${itemId}/tags/${tagId}`);
    return response.data;
};

export const uploadFile = async (file: File, metadata: Record<string, any> = {}, resolution?: string): Promise<ContentItem> => {
    // 1. Get upload parameters from backend
    const paramsResponse = await apiClient.get('/upload/params', {
        params: { filename: file.name }
    });
    const params = paramsResponse.data;

    let storagePath = '';

    if (params.mode === 's3') {
        // 2. Upload directly to S3/MinIO
        await axios.put(params.upload_url, file, {
            headers: {
                'Content-Type': file.type,
            },
        });
        storagePath = params.storage_path;
    } else {
        // 2. Fall back to legacy local upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('metadata', JSON.stringify(metadata));
        if (resolution) {
            formData.append('resolution', resolution);
        }

        const response = await apiClient.post('/upload', formData);
        return response.data;
    }

    // 3. Finalize upload in backend (for S3 mode)
    const finalizeData = new FormData();
    finalizeData.append('original_filename', file.name);
    finalizeData.append('storage_path', storagePath);
    finalizeData.append('metadata', JSON.stringify(metadata));
    if (metadata.checksum) {
        finalizeData.append('checksum', metadata.checksum);
    }
    if (resolution) {
        finalizeData.append('resolution', resolution);
    }

    const finalizeResponse = await apiClient.post('/upload/finalize', finalizeData);
    return finalizeResponse.data;
};

export const deleteItem = async (itemId: string): Promise<void> => {
    await apiClient.delete(`/items/${itemId}`);
};

export const getItems = async (): Promise<ContentItem[]> => {
    const response = await apiClient.get('/items');
    return response.data;
};

export const updateItemMetadata = async (itemId: string, metadata: Record<string, any>): Promise<ContentItem> => {
    const response = await apiClient.put(`/items/${itemId}/metadata`, metadata);
    return response.data;
};

export const searchContent = async (q: string): Promise<SearchResponse> => {
    const response = await apiClient.get('/search', { params: { q } });
    return response.data;
};

export const getItemVersions = async (itemId: string): Promise<ContentItem[]> => {
    const response = await apiClient.get(`/items/${itemId}/versions`);
    return response.data;
};
