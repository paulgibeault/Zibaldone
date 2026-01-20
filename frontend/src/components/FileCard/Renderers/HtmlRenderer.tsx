import React from 'react';
import { RendererProps } from './types';

export const HtmlRenderer: React.FC<RendererProps> = ({ url, isLoadingContent }) => {
    // If we're loading content, we might not have the URL ready or checked yet, 
    // but typically for HtmlRenderer we rely on the direct download URL (served by nginx/backend)
    // rather than fetching text content.

    if (isLoadingContent) {
        return <div className="preview-loading">Loading HTML preview...</div>;
    }

    if (!url) {
         return <div className="preview-error">No URL available for preview.</div>;
    }

    return (
        <div className="preview-html-wrapper" style={{ width: '100%', height: '100%', border: 'none' }}>
            <iframe 
                src={url} 
                title="HTML Preview"
                style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' }}
                // Sandbox attributes for security:
                // allow-scripts: might be needed for some dynamic HTML but risky. 
                // allow-same-origin: needed if the HTML loads local resources relative to itself, 
                // but if served from same domain as app, it gives access to app's storage/cookies.
                // For now, let's start restrictive. 
                // If the user needs scripts, we might need a "Enable Scripts" button or permissive mode.
                sandbox="allow-scripts allow-popups allow-forms" 
            />
        </div>
    );
};
