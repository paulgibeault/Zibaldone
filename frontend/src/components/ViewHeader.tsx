import React from 'react';

interface ViewHeaderProps {
    title: string;
    subtitle?: string;
    controls?: React.ReactNode;
    className?: string;
}

export const ViewHeader = ({ title, subtitle, controls, className = '' }: ViewHeaderProps) => {
    return (
        <div className={`manager-header ${className}`}>
            <div>
                <h2>{title}</h2>
                {subtitle && <p className="subtitle">{subtitle}</p>}
            </div>

            {controls && (
                <div className="filter-controls">
                    {controls}
                </div>
            )}
        </div>
    );
};
