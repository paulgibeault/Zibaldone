import React from 'react';
import { RendererProps } from './types';
import { FileSearch } from 'lucide-react';

export const DefaultRenderer: React.FC<RendererProps> = ({ url }) => {
    return (
        <div className="preview-fallback">
            <FileSearch size={48} />
            <p>No preview available for this file type.</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="download-fallback-link">
                Open in new tab
            </a>
        </div>
    );
};
