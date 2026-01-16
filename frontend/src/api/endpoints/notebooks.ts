import { apiClient } from '../client';
import { Notebook } from '../types';

export const getNotebooks = async (): Promise<Notebook[]> => {
  const response = await apiClient.get<Notebook[]>('/notebooks');
  return response.data;
};

export const getNotebook = async (id: string): Promise<Notebook> => {
  const response = await apiClient.get<Notebook>(`/notebooks/${id}`);
  return response.data;
};

export const createNotebook = async (title: string, description?: string): Promise<Notebook> => {
  const response = await apiClient.post<Notebook>('/notebooks', { title, description });
  return response.data;
};

export const updateNotebook = async (id: string, title?: string, description?: string): Promise<Notebook> => {
  const response = await apiClient.patch<Notebook>(`/notebooks/${id}`, { title, description });
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
