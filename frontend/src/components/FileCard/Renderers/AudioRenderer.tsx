import React from 'react';
import { RendererProps } from './types';

export const AudioRenderer: React.FC<RendererProps> = ({ url }) => {
    return <audio src={url} controls className="preview-audio" />;
};
