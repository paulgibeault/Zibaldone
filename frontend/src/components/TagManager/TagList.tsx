
import { type Tag as TagType } from '../../api';
import { TagItem } from './TagItem';

interface TagListProps {
    tags: TagType[];
    loading?: boolean;
    onUpdate: (id: string, name: string, color: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onApprove: (id: string) => Promise<void>;
}

export const TagList = ({ tags, loading, onUpdate, onDelete, onApprove }: TagListProps) => {
    if (loading) {
        return <div className="loading-small">Loading tags...</div>;
    }

    return (
        <div className="tag-grid-scroll" style={{ flex: 1 }}>
            {tags.map(tag => (
                <TagItem
                    key={tag.id}
                    tag={tag}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onApprove={onApprove}
                />
            ))}
        </div>
    );
};
