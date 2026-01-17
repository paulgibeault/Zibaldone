import React from 'react';
import { RendererProps } from './types';

export const PdfRenderer: React.FC<RendererProps> = ({ url }) => {
    return <iframe src={url} className="preview-pdf" title="PDF Preview" />;
};
