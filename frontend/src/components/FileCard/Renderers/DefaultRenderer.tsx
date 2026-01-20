import React from 'react';
import { RendererProps } from './types';
import { FileSearch } from 'lucide-react';

export const DefaultRenderer: React.FC<RendererProps> = ({ url, onViewAsText }) => {
    return (
        <div className="preview-fallback">
            <FileSearch size={48} />
            <p>No preview available for this file type.</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="download-fallback-link">
                    Open in new tab
                </a>
                {onViewAsText && (
                    <button 
                        onClick={(e) => { e.preventDefault(); onViewAsText(); }}
                        className="btn btn-outline-secondary btn-sm"
                    >
                        Open as Text
                    </button>
                )}
            </div>
        </div>
    );
};
