import { apiClient as client } from '../client';

export const restartTask = async (taskId: string): Promise<void> => {
    await client.post(`/tasks/${taskId}/restart`);
};
