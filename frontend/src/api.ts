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
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));

    const response = await apiClient.post('/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const deleteItem = async (itemId: string): Promise<void> => {
    await apiClient.delete(`/items/${itemId}`);
};

export const getItems = async (): Promise<ContentItem[]> => {
    const response = await apiClient.get('/items');
    return response.data;
};
