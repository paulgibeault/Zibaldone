import React from 'react';
import { RendererProps } from './types';

export const ImageRenderer: React.FC<RendererProps> = ({ item, url }) => {
    return <img src={url} alt={item.original_filename} className="preview-image" />;
};
