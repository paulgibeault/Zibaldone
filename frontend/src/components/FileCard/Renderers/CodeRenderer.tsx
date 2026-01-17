import React from 'react';
import { RendererProps } from './types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyButton } from '../../CopyButton';

// Helper to guess language (simplified from original logic, can be improved)
const getLanguage = (filename: str, type: str): string => {
    const fname = filename.toLowerCase();
    const mime = type.toLowerCase();
    
    if (mime.includes('javascript') || fname.endsWith('.js') || fname.endsWith('.ts') || fname.endsWith('.tsx')) return 'typescript';
    if (mime.includes('python') || fname.endsWith('.py')) return 'python';
    if (mime.includes('json') || fname.endsWith('.json')) return 'json';
    if (mime.includes('css') || fname.endsWith('.css')) return 'css';
    if (fname.endsWith('.sh') || fname.endsWith('.bash')) return 'bash';
    if (fname.endsWith('.yaml') || fname.endsWith('.yml')) return 'yaml';
    if (fname.endsWith('.md')) return 'markdown';
    if (fname.endsWith('.sql')) return 'sql';
    if (fname.endsWith('.go')) return 'go';
    if (fname.endsWith('.rs')) return 'rust';
    if (fname.endsWith('.java')) return 'java';
    if (fname.endsWith('.c') || fname.endsWith('.cpp') || fname.endsWith('.h')) return 'cpp';
    
    return 'text';
};

export const CodeRenderer: React.FC<RendererProps> = ({ item, metadata, textContent, isLoadingContent }) => {
    const language = getLanguage(item.original_filename, metadata.mime_type || metadata.type || '');
    
    return (
        <div className="preview-text-wrapper">
            {isLoadingContent ? (
                <div className="preview-loading">Loading content...</div>
            ) : (
                <CopyButton text={textContent || ''} className="preview-copy-wrapper">
                    <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={language}
                        showLineNumbers={true}
                        customStyle={{ margin: 0, height: '100%', borderRadius: 0, fontSize: '13px' }}
                    >
                        {textContent || ''}
                    </SyntaxHighlighter>
                </CopyButton>
            )}
        </div>
    );
};
