import { apiClient } from '../client';
import type { Tag } from '../types';

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
