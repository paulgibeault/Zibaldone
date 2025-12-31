import React from 'react';
import { X } from 'lucide-react';
import { type Tag as TagType } from '../api';

interface TagProps {
    tag: TagType;
    onRemove?: (tagId: string, e: React.MouseEvent) => void;
    className?: string;
    style?: React.CSSProperties;
    showRemoveIcon?: boolean;
    key?: string | number;
}

// Helper to determine text color based on background brightness and theme
export const getContrastColor = (hexcolor: string) => {
    if (!hexcolor) return 'var(--text-primary)';

    // Get the current theme's tag opacity
    const root = document.documentElement;
    const opacity = parseFloat(getComputedStyle(root).getPropertyValue('--tag-bg-opacity').trim() || '0.9');

    // If opacity is low (light mode), use primary text color
    if (opacity < 0.4) {
        return 'var(--text-primary)';
    }

    const hex = hexcolor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.6 ? '#0f172a' : '#ffffff';
};

export const Tag = ({
    tag,
    onRemove,
    className = '',
    style = {},
    showRemoveIcon = false
}: TagProps) => {
    const contrastColor = getContrastColor(tag.color);

    return (
        <span
            className={`standard-tag ${className}`}
            style={{
                backgroundColor: `color-mix(in srgb, ${tag.color}, transparent calc(100% - (var(--tag-bg-opacity) * 100%)))`,
                color: contrastColor,
                ...style
            }}
        >
            {tag.name}
            {showRemoveIcon && onRemove && (
                <button
                    type="button"
                    className="remove-tag-mini"
                    onClick={(e) => onRemove(tag.id, e)}
                    style={{ color: contrastColor }}
                    title="Remove tag"
                >
                    <X size={12} />
                </button>
            )}
        </span>
    );
};
