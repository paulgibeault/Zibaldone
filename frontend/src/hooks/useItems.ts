import { useState, useCallback } from 'react';
import { getItems, deleteItem, type ContentItem } from '../api';

export function useItems() {
    const [items, setItems] = useState<ContentItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<unknown>(null);

    const fetchItems = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getItems();
            // Sort by created_at desc
            data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setItems(data);
            setError(null);
        } catch (err) {
            console.error("Failed to fetch items:", err);
            setError(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const deleteItemAction = useCallback(async (id: string) => {
        try {
            await deleteItem(id);
            setItems(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            console.error("Failed to delete item:", err);
            throw err;
        }
    }, []);

    return { items, fetchItems, deleteItemAction, isLoading, error };
}
