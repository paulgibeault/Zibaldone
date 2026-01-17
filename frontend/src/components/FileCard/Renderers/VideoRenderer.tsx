import React from 'react';
import { RendererProps } from './types';

export const VideoRenderer: React.FC<RendererProps> = ({ url }) => {
    return <video src={url} controls className="preview-video" />;
};
