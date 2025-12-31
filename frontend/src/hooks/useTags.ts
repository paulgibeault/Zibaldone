import { useState, useCallback } from 'react';
import { type Tag, getTags, addTagToItem, removeTagFromItem } from '../api';

export const useTags = () => {
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTags = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getTags();
            setAllTags(data);
        } catch (err: any) {
            console.error('[useTags] Error fetching tags:', err);
            setError('Failed to fetch tags');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const toggleTagForItem = useCallback(async (itemId: string, tagId: string, currentTags: Tag[]) => {
        const isApplied = currentTags.some(t => t.id === tagId);
        try {
            if (isApplied) {
                await removeTagFromItem(itemId, tagId);
            } else {
                await addTagToItem(itemId, tagId);
            }
            return true;
        } catch (err) {
            console.error('[useTags] Error toggling tag:', err);
            return false;
        }
    }, []);

    return {
        allTags,
        isLoading,
        error,
        fetchTags,
        toggleTagForItem
    };
};
