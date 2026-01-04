import React from 'react';

interface ViewContainerProps {
    children: React.ReactNode;
    className?: string;
}

export const ViewContainer = ({ children, className = '' }: ViewContainerProps) => {
    // We purposefully omit default padding here to let the main App container handle it 
    // or to simply avoid double-padding.
    // The main value here is the animation class and consistent block usage.
    return (
        <div className={`view-container fade-in ${className}`}>
            {children}
        </div>
    );
};
