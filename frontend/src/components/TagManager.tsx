import React, { useState, useEffect } from 'react';
import { type Tag, getTags, createTag, deleteTag, updateTag } from '../api';

const TagManager: React.FC = () => {
    const [tags, setTags] = useState<Tag[]>([]);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#6366f1');
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');

    useEffect(() => {
        fetchTags();
    }, []);

    const fetchTags = async () => {
        try {
            const data = await getTags();
            setTags(data);
        } catch (error) {
            console.error('Error fetching tags:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTag = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTagName.trim()) return;
        try {
            await createTag(newTagName, newTagColor);
            setNewTagName('');
            fetchTags();
        } catch (error) {
            console.error('Error creating tag:', error);
            alert('Failed to create tag. It might already exist.');
        }
    };

    const startEditing = (tag: Tag) => {
        setEditingId(tag.id);
        setEditName(tag.name);
        setEditColor(tag.color);
    };

    const cancelEditing = () => {
        setEditingId(null);
    };

    const handleUpdateTag = async (id: string) => {
        try {
            await updateTag(id, { name: editName, color: editColor });
            setEditingId(null);
            fetchTags();
        } catch (error) {
            console.error('Error updating tag:', error);
            alert('Failed to update tag.');
        }
    };

    const handleDeleteTag = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this tag?')) return;
        try {
            await deleteTag(id);
            fetchTags();
        } catch (error) {
            console.error('Error deleting tag:', error);
        }
    };

    return (
        <div className="tag-manager">
            <h2>Manage Tags</h2>
            <p className="subtitle">Group and organize your heap into curated collections.</p>

            <form onSubmit={handleCreateTag} className="create-tag-form">
                <input
                    type="text"
                    placeholder="New tag name..."
                    value={newTagName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTagName(e.target.value)}
                    className="tag-input"
                />
                <input
                    type="color"
                    value={newTagColor}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTagColor(e.target.value)}
                    className="color-picker"
                />
                <button type="submit" className="btn btn-primary">Add Tag</button>
            </form>

            {loading ? (
                <div className="loading">Loading tags...</div>
            ) : (
                <div className="tag-list">
                    {tags.length === 0 ? (
                        <div className="empty-state">No tags found. Start by creating one!</div>
                    ) : (
                        tags.map((tag: Tag) => (
                            <div key={tag.id} className="tag-item">
                                {editingId === tag.id ? (
                                    <div className="edit-form">
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                                            className="tag-input sm"
                                        />
                                        <input
                                            type="color"
                                            value={editColor}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditColor(e.target.value)}
                                            className="color-picker sm"
                                        />
                                        <button onClick={() => handleUpdateTag(tag.id)} className="btn btn-sm btn-primary">Save</button>
                                        <button onClick={cancelEditing} className="btn btn-sm btn-outline-secondary">Cancel</button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="tag-info">
                                            <span className="tag-badge" style={{ backgroundColor: tag.color }}>
                                                {tag.name}
                                            </span>
                                        </div>
                                        <div className="tag-actions">
                                            <button
                                                onClick={() => startEditing(tag)}
                                                className="btn btn-icon btn-secondary"
                                                title="Rename/Edit"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTag(tag.id)}
                                                className="btn btn-icon btn-danger"
                                                title="Delete Tag"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5 v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                                                    <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default TagManager;
