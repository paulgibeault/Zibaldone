import { apiClient as client } from '../client';
import { ProcessingTask } from '../types';

export interface FetchTasksParams {
    limit?: number;
    offset?: number;
    status?: string;
}

export const fetchTasks = async (params: FetchTasksParams = {}): Promise<ProcessingTask[]> => {
    const query = new URLSearchParams();
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.offset) query.append('offset', params.offset.toString());
    if (params.status) query.append('status', params.status);
    
    const response = await client.get(`/tasks/?${query.toString()}`);
    return response.data;
};

export const cancelTask = async (taskId: string): Promise<void> => {
    await client.post(`/tasks/${taskId}/cancel`);
};

export const restartTask = async (taskId: string): Promise<void> => {
    await client.post(`/tasks/${taskId}/restart`);
};

export const restartAllFailedTasks = async (taskIds?: string[]): Promise<void> => {
    await client.post(`/tasks/restart-failed`, taskIds || []);
};

export const deleteTask = async (taskId: string): Promise<void> => {
    await client.delete(`/tasks/${taskId}`);
};

export const pauseTaskProcessing = async (): Promise<void> => {
    await client.post(`/tasks/control/pause`);
};

export const resumeTaskProcessing = async (): Promise<void> => {
    await client.post(`/tasks/control/resume`);
};

export const getTaskProcessingStatus = async (): Promise<{ status: string }> => {
    const response = await client.get(`/tasks/control/status`);
    return response.data;
};
