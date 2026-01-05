import { useState } from 'react';
import { Edit2, Trash2, ShieldCheck, Check, X } from 'lucide-react';
import { type Tag as TagType } from '../../api';
import { getContrastColor } from '../Tag';

interface TagItemProps {
    tag: TagType;
    onUpdate: (id: string, name: string, color: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onApprove: (id: string) => Promise<void>;
}

export const TagItem = ({ tag, onUpdate, onDelete, onApprove }: TagItemProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(tag.name);
    const [editColor, setEditColor] = useState(tag.color);

    const handleSave = async () => {
        await onUpdate(tag.id, editName, editColor);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditName(tag.name);
        setEditColor(tag.color);
    };

    const isUnapproved = !tag.is_approved;
    const contrastColor = isUnapproved ? 'var(--text-primary)' : getContrastColor(tag.color);
    const opacityCalc = isUnapproved ? 'calc(var(--tag-bg-opacity) * 0.15)' : 'var(--tag-bg-opacity)';
    const backgroundColor = `color-mix(in srgb, ${tag.color}, transparent calc(100% - (${opacityCalc} * 100%)))`;

    return (
        <div
            className="tag-row-pill"
            style={{
                backgroundColor,
                color: contrastColor,
                borderColor: tag.color,
                borderStyle: isUnapproved ? 'dashed' : 'solid',
                borderWidth: '1px'
            }}
        >
            {isEditing ? (
                <div className="tag-edit-inline" onClick={e => e.stopPropagation()}>
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
                    />
                    <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); handleSave(); }}
                        className="btn-icon-pill"
                        title="Save"
                    >
                        <Check size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); handleCancel(); }}
                        className="btn-icon-pill danger"
                        title="Cancel"
                    >
                        <X size={14} />
                    </button>
                </div>
            ) : (
                <>
                    <span className="tag-text">{tag.name}</span>
                    <div className="tag-actions-group">
                        {!tag.is_approved ? (
                            <>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        onApprove(tag.id);
                                    }}
                                    className="btn-icon-pill"
                                    style={{ color: contrastColor }}
                                    title="Approve"
                                >
                                    <ShieldCheck size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        onDelete(tag.id);
                                    }}
                                    className="btn-icon-pill"
                                    style={{ color: contrastColor }}
                                    title="Delete"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsEditing(true);
                                    }}
                                    className="btn-icon-pill"
                                    style={{ color: contrastColor }}
                                    title="Edit"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        onDelete(tag.id);
                                    }}
                                    className="btn-icon-pill"
                                    style={{ color: contrastColor }}
                                    title="Delete"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
