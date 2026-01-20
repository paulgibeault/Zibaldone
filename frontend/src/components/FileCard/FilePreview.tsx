import React from 'react';
import { type ContentItem } from '../../api';
import { Renderers } from './Renderers/RendererRegistry';

interface FilePreviewProps {
    item: ContentItem;
    metadata: Record<string, any>;
    textContent: string | null;
    isLoadingContent: boolean;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ item, metadata, textContent, isLoadingContent }) => {
    const type = (metadata.mime_type || metadata.type || '').toLowerCase();
    const url = item.download_url ? (item.download_url.startsWith('http') ? item.download_url : `http://${window.location.hostname}:8000${item.download_url}`) : '';
    
    // 1. Check for explicit strategy from Backend
    let strategy = metadata.rendering_strategy;

    // 2. Fallback if no strategy (e.g. legacy items or external detection failing)
    if (!strategy) {
       // Minimal legacy fallback logic if needed, or just default to 'Default'
       // But better to replicate "simple" logic here or restart backend to re-detect?
       // For now, let's map common types if missing, similar to what backend would do
       // (This is technically duplication but useful for immediate feedback if backend didn't update yet)
       if (type.startsWith('image/')) strategy = 'ImageRenderer';
       else if (type.startsWith('video/')) strategy = 'VideoRenderer';
       else if (type.startsWith('audio/')) strategy = 'AudioRenderer';
       else if (type === 'application/pdf') strategy = 'PdfRenderer';
       else if (type.includes('markdown') || item.original_filename.endsWith('.md')) strategy = 'MarkdownRenderer';
       else if (type.startsWith('text/') || type.includes('json') || type.includes('javascript') || type.includes('xml') || type.includes('yaml')) strategy = 'CodeRenderer';
       else strategy = 'DefaultRenderer'; // Was 'Default' but registry might expect 'Default' or 'DefaultRenderer'? Registry.ts says 'Default': DefaultRenderer. Let's start with 'Default' but be robust.
       
       console.log(`[FilePreview] No explicit strategy for ${item.original_filename} (${type}). Fallback to: ${strategy}`);
    }

    // Ensure we have a valid key for the registry
    if (!Renderers[strategy] && strategy === 'DefaultRenderer') strategy = 'Default';
    
    // Safety check if strangely the strategy is still not in registry
    if (!Renderers[strategy]) {
        console.warn(`[FilePreview] Strategy '${strategy}' not found in registry. Using 'Default'.`);
        strategy = 'Default';
    }

    const SpecificRenderer = Renderers[strategy] || Renderers.Default;

    return (
        <SpecificRenderer 
            item={item}
            url={url}
            metadata={metadata}
            textContent={textContent}
            isLoadingContent={isLoadingContent}
        />
    );
};
