import { apiClient } from '../client';
import { Notebook, ChatRequest, ChatResponse } from '../types';

export const getNotebooks = async (): Promise<Notebook[]> => {
  const response = await apiClient.get<Notebook[]>('/notebooks');
  return response.data;
};

export const getNotebook = async (id: string): Promise<Notebook> => {
  const response = await apiClient.get<Notebook>(`/notebooks/${id}`);
  return response.data;
};

export const createNotebook = async (title: string, description?: string, view_mode?: string): Promise<Notebook> => {
  const response = await apiClient.post<Notebook>('/notebooks', { title, description, view_mode });
  return response.data;
};

export const updateNotebook = async (id: string, title?: string, description?: string, view_mode?: string): Promise<Notebook> => {
  const response = await apiClient.patch<Notebook>(`/notebooks/${id}`, { title, description, view_mode });
  return response.data;
};

export const deleteNotebook = async (id: string): Promise<void> => {
  await apiClient.delete(`/notebooks/${id}`);
};

export const addItemsToNotebook = async (notebookId: string, itemIds: string[]): Promise<Notebook> => {
  const response = await apiClient.post<Notebook>(`/notebooks/${notebookId}/items`, { item_ids: itemIds });
  return response.data;
};

export const removeItemFromNotebook = async (notebookId: string, itemId: string): Promise<Notebook> => {
  const response = await apiClient.delete<Notebook>(`/notebooks/${notebookId}/items/${itemId}`);
  return response.data;
};

// --- Notebook Task API ---

export const getNotebookTasks = async (notebookId: string): Promise<any[]> => {
  const response = await apiClient.get<any[]>(`/notebooks/${notebookId}/tasks`);
  return response.data;
};

export const createNotebookTask = async (notebookId: string, task: { name: string, definition_json: any, trigger_config_json: any, is_active: boolean }): Promise<any> => {
  const response = await apiClient.post<any>(`/notebooks/${notebookId}/tasks`, { ...task, notebook_id: notebookId });
  return response.data;
};

export const updateNotebookTask = async (notebookId: string, taskId: string, updates: Partial<{ name: string, definition_json: any, trigger_config_json: any, is_active: boolean }>): Promise<any> => {
  const response = await apiClient.patch<any>(`/notebooks/${notebookId}/tasks/${taskId}`, updates);
  return response.data;
};

export const deleteNotebookTask = async (notebookId: string, taskId: string): Promise<void> => {
  await apiClient.delete(`/notebooks/${notebookId}/tasks/${taskId}`);
};

export const chatNotebook = async (notebookId: string, payload: ChatRequest): Promise<ChatResponse> => {
  const response = await apiClient.post<ChatResponse>(`/notebooks/${notebookId}/chat`, payload);
  return response.data;
};
