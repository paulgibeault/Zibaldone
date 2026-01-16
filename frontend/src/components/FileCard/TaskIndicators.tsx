import React from 'react';
import { Loader2 } from 'lucide-react';

interface RunningTaskSpinnerProps {
    className?: string;
    size?: number;
}

export const RunningTaskSpinner: React.FC<RunningTaskSpinnerProps> = ({ 
    className = "", 
    size = 14 
}) => {
    return (
        <Loader2 
            size={size} 
            className={`status-icon-running spin ${className}`} 
            strokeWidth={3}
        />
    );
};

interface StatusBadgeProps {
    count: number;
    className?: string;
    title?: string;
    children?: React.ReactNode;
    style?: React.CSSProperties;
}

export const FailedTaskBadge: React.FC<StatusBadgeProps> = ({ count, className = "", title, style }) => {
    if (count <= 0) return null;
    return (
        <div 
            className={`status-badge failed ${className}`} 
            title={title || `${count} Failed Tasks`}
            style={{ position: 'static', transform: 'none', ...style }}
        >
            {count}
        </div>
    );
};

export const PendingTaskBadge: React.FC<StatusBadgeProps> = ({ count, className = "", title, style }) => {
    if (count <= 0) return null;
    return (
        <div 
            className={`status-badge pending ${className}`} 
            title={title || `${count} Pending Tasks`}
            style={{ position: 'static', transform: 'none', ...style }}
        >
            {count}
        </div>
    );
};
