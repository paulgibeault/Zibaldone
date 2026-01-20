import React from 'react';
import { type ContentItem } from '../../api';
import { Renderers } from './Renderers/RendererRegistry';

interface FilePreviewProps {
    item: ContentItem;
    metadata: Record<string, any>;
    textContent: string | null;
    isLoadingContent: boolean;
    onRequestTextContent?: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ item, metadata, textContent, isLoadingContent, onRequestTextContent }) => {
    const [forceTextMode, setForceTextMode] = React.useState(false);
    
    // Reset force mode when item changes
    React.useEffect(() => {
        setForceTextMode(false);
    }, [item.id]);

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
       else {
            // Enhanced code/text detection fallback
            const fname = item.original_filename.toLowerCase();
            const codeExtensions = [
                '.js', '.ts', '.tsx', '.jsx', 
                '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
                '.sh', '.bash', '.zsh', 
                '.yaml', '.yml', '.json', '.xml', '.sql', '.css', '.html', '.php', 
                '.dockerfile'
            ];
            
            const isCode = type.startsWith('text/') || 
                           type.includes('json') || 
                           type.includes('javascript') || 
                           type.includes('xml') || 
                           type.includes('yaml') ||
                           codeExtensions.some(ext => fname.endsWith(ext)) ||
                           fname === 'dockerfile' || fname === 'makefile';

            if (type === 'text/html' || fname.endsWith('.html') || fname.endsWith('.htm')) {
                 strategy = 'HtmlRenderer';
            } else if (isCode) {
                 strategy = 'CodeRenderer';
            } else {
                 strategy = 'DefaultRenderer';
            }
       }
       
       console.log(`[FilePreview] No explicit strategy for ${item.original_filename} (${type}). Fallback to: ${strategy}`);
    }

    // Override strategy if forceTextMode is active
    if (forceTextMode) {
        strategy = 'CodeRenderer';
    }

    // Ensure we have a valid key for the registry
    if (!Renderers[strategy] && strategy === 'DefaultRenderer') strategy = 'Default';
    
    // Safety check if strangely the strategy is still not in registry
    if (!Renderers[strategy]) {
        console.warn(`[FilePreview] Strategy '${strategy}' not found in registry. Using 'Default'.`);
        strategy = 'Default';
    }

    const SpecificRenderer = Renderers[strategy] || Renderers.Default;
    
    const handleViewAsText = () => {
        setForceTextMode(true);
        if (onRequestTextContent) onRequestTextContent();
    };

    return (
        <SpecificRenderer 
            item={item}
            url={url}
            metadata={metadata}
            textContent={textContent}
            isLoadingContent={isLoadingContent}
            onViewAsText={handleViewAsText}
        />
    );
};
