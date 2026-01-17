import React from 'react';
import { ContentItem } from '../api/types';
import { Calendar } from 'lucide-react';

interface NotebookCalendarProps {
  items: ContentItem[];
}

export const NotebookCalendar: React.FC<NotebookCalendarProps> = ({ items }) => {
  return (
    <div className="notebook-calendar-placeholder" style={{ 
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
      <Calendar size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
      <h3>Calendar View</h3>
      <p>Organize your files by date. Coming soon!</p>
      <p style={{ fontSize: '0.9rem', marginTop: '1rem' }}>{items.length} items to schedule.</p>
    </div>
  );
};
