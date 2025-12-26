import axios from 'axios';

// Use 127.0.0.1 to avoid potential localhost IPv6 resolution issues
const API_URL = 'http://127.0.0.1:8000/api';

const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 30000, // 30 seconds timeout
});

// Log requests and responses for debugging
apiClient.interceptors.request.use(request => {
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

export interface ContentItem {
    id: string;
    status: string;
    original_filename: string;
    storage_path: string;
    created_at: string;
    metadata_json: string;
}

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
