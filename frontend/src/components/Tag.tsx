import React from 'react';
import { X, Check } from 'lucide-react';
import { type Tag as TagType } from '../api';

interface TagProps {
    tag: TagType;
    onRemove?: (tagId: string, e: React.MouseEvent) => void;
    onApprove?: (tagId: string, e: React.MouseEvent) => void;
    className?: string;
    style?: React.CSSProperties;
    showRemoveIcon?: boolean;
    showApproveIcon?: boolean;
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

// Start of Tag Component
export const Tag = ({
    tag,
    onRemove,
    onApprove,
    className = '',
    style = {},
    showRemoveIcon = false,
    showApproveIcon = false
}: TagProps) => {
    let contrastColor = getContrastColor(tag.color);
    const isUnapproved = tag.is_autocreated && !tag.is_approved;

    // For unapproved tags, the background is very faint/transparent (see .standard-tag.unapproved),
    // so we MUST use a color that contrasts with the CARD/PAGE background, not the tag background.
    // Usually that means the primary text color or the primary theme color.
    if (isUnapproved) {
        contrastColor = 'var(--text-primary)';
    }

    return (
        <span
            className={`standard-tag ${isUnapproved ? 'unapproved' : ''} ${className}`}
            style={{
                backgroundColor: `color-mix(in srgb, ${tag.color}, transparent calc(100% - (var(--tag-bg-opacity) * 100%)))`,
                color: contrastColor,
                ...style
            }}
        >
            {tag.name}
            {isUnapproved && (showApproveIcon || onApprove) && (
                <button
                    type="button"
                    className="approve-tag-btn"
                    onClick={(e) => onApprove?.(tag.id, e)}
                    style={{ color: contrastColor }}
                    title="Approve tag"
                >
                    <Check size={12} />
                </button>
            )}
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
