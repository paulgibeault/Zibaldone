import React from 'react';
import { FileSearch } from 'lucide-react';
import { type ContentItem } from '../../api';
import { MarkdownPreview } from '../MarkdownPreview';
import { getFileCategory, isTextBased } from '../../utils/fileTypes';

interface FilePreviewProps {
    item: ContentItem;
    metadata: Record<string, any>;
    textContent: string | null;
    isLoadingContent: boolean;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ item, metadata, textContent, isLoadingContent }) => {
    const type = (metadata.type || '').toLowerCase();
    const url = item.download_url ? (item.download_url.startsWith('http') ? item.download_url : `http://${window.location.hostname}:8000${item.download_url}`) : null;

    if (!url) return <div className="preview-placeholder">No preview available</div>;

    if (type.startsWith('image/')) {
        return <img src={url} alt={item.original_filename} className="preview-image" />;
    }

    if (type.startsWith('video/')) {
        return <video src={url} controls className="preview-video" />;
    }

    if (type.startsWith('audio/')) {
        return <audio src={url} controls className="preview-audio" />;
    }

    if (type === 'application/pdf') {
        return <iframe src={url} className="preview-pdf" title="PDF Preview" />;
    }

    if (type.includes('markdown')) {
        return (
            <div className="preview-markdown-wrapper">
                {isLoadingContent ? (
                    <div className="preview-loading">Loading content...</div>
                ) : (
                    <MarkdownPreview content={textContent || ''} />
                )}
            </div>
        );
    }

    const category = getFileCategory(metadata.type || '', item.original_filename);

    // If it's explicitly text-based OR it's unknown but has a summary (implying text extraction worked), show as text
    if (isTextBased(category) || (category === 'default' && metadata.summary)) {
        return (
            <div className="preview-text-wrapper">
                {isLoadingContent ? (
                    <div className="preview-loading">Loading content...</div>
                ) : (
                    <pre className="raw-text-preview">{textContent}</pre>
                )}
            </div>
        );
    }

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
