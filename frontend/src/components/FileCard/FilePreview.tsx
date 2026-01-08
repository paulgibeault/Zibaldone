import React from 'react';
import { FileSearch } from 'lucide-react';
import { type ContentItem } from '../../api';
import { MarkdownPreview } from '../MarkdownPreview';
import { getFileCategory, isTextBased } from '../../utils/fileTypes';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface FilePreviewProps {
    item: ContentItem;
    metadata: Record<string, any>;
    textContent: string | null;
    isLoadingContent: boolean;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ item, metadata, textContent, isLoadingContent }) => {
    const type = (metadata.mime_type || metadata.type || '').toLowerCase();
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

    if (type === 'text/html' || type.includes('html')) {
        return <iframe src={url} className="preview-html" title="HTML Preview" style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' }} />;
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
    
    // Fallback: If it's a known text mime type that wasn't caught above, try to verify if it's code/text
    const category = getFileCategory(type, item.original_filename);

    // If it's explicitly text-based OR it's unknown but has a summary (implying text extraction worked), show as text
    if (isTextBased(category) || (category === 'default' && metadata.summary) || type.startsWith('text/')) {
        let language = 'text';
        const filename = item.original_filename.toLowerCase();
        
        if (type.includes('javascript') || filename.endsWith('.js') || filename.endsWith('.ts') || filename.endsWith('.tsx')) language = 'typescript';
        else if (type.includes('python') || filename.endsWith('.py')) language = 'python';
        else if (type.includes('json') || filename.endsWith('.json')) language = 'json';
        else if (type.includes('css') || filename.endsWith('.css')) language = 'css';
        else if (filename.endsWith('.sh') || filename.endsWith('.bash')) language = 'bash';
        else if (filename.endsWith('.yaml') || filename.endsWith('.yml')) language = 'yaml';
        else if (filename.endsWith('.md')) language = 'markdown';
        else if (filename.endsWith('.sql')) language = 'sql';
        else if (filename.endsWith('.go')) language = 'go';
        else if (filename.endsWith('.rs')) language = 'rust';
        else if (filename.endsWith('.java')) language = 'java';
        else if (filename.endsWith('.c') || filename.endsWith('.cpp') || filename.endsWith('.h')) language = 'cpp';

        return (
            <div className="preview-text-wrapper">
                {isLoadingContent ? (
                    <div className="preview-loading">Loading content...</div>
                ) : (
                    <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={language}
                        showLineNumbers={true}
                        customStyle={{ margin: 0, height: '100%', borderRadius: 0, fontSize: '13px' }}
                    >
                        {textContent || ''}
                    </SyntaxHighlighter>
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
