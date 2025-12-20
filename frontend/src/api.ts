import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

export interface ContentItem {
    id: string;
    status: string;
    original_filename: string;
    storage_path: string;
    created_at: string;
    metadata_json: string;
}

export const uploadFile = async (file: File): Promise<ContentItem> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const getItems = async (): Promise<ContentItem[]> => {
    const response = await axios.get(`${API_URL}/items`);
    return response.data;
};
