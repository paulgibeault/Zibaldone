import React from 'react';
import { ImageRenderer } from './ImageRenderer';
import { VideoRenderer } from './VideoRenderer';
import { AudioRenderer } from './AudioRenderer';
import { PdfRenderer } from './PdfRenderer';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CodeRenderer } from './CodeRenderer';
import { DefaultRenderer } from './DefaultRenderer';
import { HtmlRenderer } from './HtmlRenderer';
import { RendererProps } from './types';

export const Renderers: Record<string, React.FC<RendererProps>> = {
    'ImageRenderer': ImageRenderer,
    'VideoRenderer': VideoRenderer,
    'AudioRenderer': AudioRenderer,
    'PdfRenderer': PdfRenderer,
    'MarkdownRenderer': MarkdownRenderer,
    'CodeRenderer': CodeRenderer,
    'HtmlRenderer': HtmlRenderer,
    'Default': DefaultRenderer
};
