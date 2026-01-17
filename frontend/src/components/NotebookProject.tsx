import React from 'react';
import { ContentItem } from '../api/types';
import { Layout } from 'lucide-react';

interface NotebookProjectProps {
  items: ContentItem[];
}

export const NotebookProject: React.FC<NotebookProjectProps> = ({ items }) => {
  return (
    <div className="notebook-project-placeholder" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '4rem',
        color: 'var(--text-subtle)',
        border: '2px dashed var(--border-subtle)',
        borderRadius: '12px',
        margin: '2rem'
    }}>
      <Layout size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
      <h3>Project Canvas</h3>
      <p>A whitespace for your ideas. Coming soon!</p>
      <p style={{ fontSize: '0.9rem', marginTop: '1rem' }}>{items.length} items available.</p>
    </div>
  );
};
