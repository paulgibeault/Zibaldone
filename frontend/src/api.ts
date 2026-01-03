import axios from 'axios';

// Use 127.0.0.1 to avoid potential localhost IPv6 resolution issues
const API_URL = 'http://127.0.0.1:8000/api';

const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 30000, // 30 seconds timeout
});

// Log requests and responses for debugging
apiClient.interceptors.request.use(request => {
    // Add Authorization header if token exists
    const token = localStorage.getItem('zibaldone-token');
    if (token) {
        request.headers.Authorization = `Bearer ${token}`;
    }
    console.log('Starting Request', request);
    return request;
});

apiClient.interceptors.response.use(response => {
    console.log('Response:', response);
    return response;
}, error => {
    console.error('API Error:', error);
    if (error.code === 'ECONNABORTED') {
        console.error('Request timed out');
    }
    return Promise.reject(error);
});

export interface Tag {
    id: string;
    name: string;
    color: string;
    is_autocreated: boolean;
    is_approved: boolean;
    created_at: string;
}

export interface ProcessingTask {
    id: string;
    item_id: string;
    name: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    message?: string;
    start_time: string;
    end_time?: string;
    result_json?: string;
}

export interface ContentItem {
    id: string;
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    original_filename: string;
    storage_path: string;
    created_at: string;
    metadata_json: string;
    download_url?: string;
    tags: Tag[];
    tasks: ProcessingTask[];
}

export const getTags = async (): Promise<Tag[]> => {
    const response = await apiClient.get('/tags');
    return response.data;
};

export const createTag = async (name: string, color: string): Promise<Tag> => {
    const response = await apiClient.post('/tags', { name, color });
    return response.data;
};

export const updateTag = async (tagId: string, data: Partial<Tag>): Promise<Tag> => {
    const response = await apiClient.patch(`/tags/${tagId}`, data);
    return response.data;
};

export const deleteTag = async (tagId: string): Promise<void> => {
    await apiClient.delete(`/tags/${tagId}`);
};

export const approveTag = async (tagId: string): Promise<Tag> => {
    const response = await apiClient.post(`/tags/${tagId}/approve`);
    return response.data;
};

export const addTagToItem = async (itemId: string, tagId: string): Promise<ContentItem> => {
    const response = await apiClient.post(`/items/${itemId}/tags/${tagId}`);
    return response.data;
};

export const removeTagFromItem = async (itemId: string, tagId: string): Promise<ContentItem> => {
    const response = await apiClient.delete(`/items/${itemId}/tags/${tagId}`);
    return response.data;
};

export const uploadFile = async (file: File, metadata: Record<string, any> = {}): Promise<ContentItem> => {
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

        const response = await apiClient.post('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    }

    // 3. Finalize upload in backend (for S3 mode)
    const finalizeData = new FormData();
    finalizeData.append('original_filename', file.name);
    finalizeData.append('storage_path', storagePath);
    finalizeData.append('metadata', JSON.stringify(metadata));

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

export interface SearchResponse {
    tags: Tag[];
    items: ContentItem[];
}

export const searchContent = async (q: string): Promise<SearchResponse> => {
    const response = await apiClient.get('/search', { params: { q } });
    return response.data;
};
