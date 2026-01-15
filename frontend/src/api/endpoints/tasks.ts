import { apiClient as client } from '../client';

export const restartTask = async (taskId: string): Promise<void> => {
    await client.post(`/tasks/${taskId}/restart`);
};

export const deleteTask = async (taskId: string): Promise<void> => {
    await client.delete(`/tasks/${taskId}`);
};
