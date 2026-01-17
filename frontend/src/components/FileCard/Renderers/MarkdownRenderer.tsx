import React from 'react';
import { RendererProps } from './types';
import { MarkdownPreview } from '../../MarkdownPreview';
import { CopyButton } from '../../CopyButton';

export const MarkdownRenderer: React.FC<RendererProps> = ({ textContent, isLoadingContent }) => {
    return (
        <div className="preview-markdown-wrapper">
            {isLoadingContent ? (
                <div className="preview-loading">Loading content...</div>
            ) : (
                <CopyButton text={textContent || ''} className="preview-copy-wrapper">
                    <MarkdownPreview content={textContent || ''} />
                </CopyButton>
            )}
        </div>
    );
};
