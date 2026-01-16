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
