import React from 'react';
import { ArrowLeft, Trash2, Plus, LayoutList, Grid, Calendar, Layout, Bot } from 'lucide-react';
import { NotebookViewMode } from '../api/types';
import { EditableField } from './common/EditableField';

interface NotebookHeaderProps {
    title: string;
    onTitleChange: (newTitle: string) => void;
    onBack: () => void;
    viewMode: NotebookViewMode;
    onViewModeChange: (mode: NotebookViewMode) => void;
    onAddFiles: () => void;
    onToggleAutomation: () => void;
    onDeleteNotebook: () => void;
    children?: React.ReactNode;
}

export const NotebookHeader: React.FC<NotebookHeaderProps> = ({
    title,
    onTitleChange,
    onBack,
    viewMode,
    onViewModeChange,
    onAddFiles,
    onToggleAutomation,
    onDeleteNotebook,
    children
}) => {
    return (
        <div className="notebook-header">
            {/* Top Row: Back, Title, Top Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: children ? '1rem' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                    <button onClick={onBack} className="btn btn-ghost btn-sm btn-icon" style={{ margin: 0 }}>
                        <ArrowLeft size={18} />
                    </button>
                    <EditableField
                        value={title}
                        onSave={onTitleChange}
                        className="notebook-title"
                        style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.5rem' }}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="join">
                        <button
                            onClick={() => onViewModeChange('GRID')}
                            className={`btn btn-sm btn-ghost ${viewMode === 'GRID' ? 'active text-primary' : ''}`}
                            title="Grid View"
                        >
                            <Grid size={18} />
                        </button>
                        <button
                            onClick={() => onViewModeChange('FEED')}
                            className={`btn btn-sm btn-ghost ${viewMode === 'FEED' ? 'active text-primary' : ''}`}
                            title="Notebook View"
                        >
                            <LayoutList size={18} />
                        </button>
                        <button
                            onClick={() => onViewModeChange('CALENDAR')}
                            className={`btn btn-sm btn-ghost ${viewMode === 'CALENDAR' ? 'active text-primary' : ''}`}
                            title="Calendar View"
                        >
                            <Calendar size={18} />
                        </button>
                        <button
                            onClick={() => onViewModeChange('PROJECT')}
                            className={`btn btn-sm btn-ghost ${viewMode === 'PROJECT' ? 'active text-primary' : ''}`}
                            title="Project View"
                        >
                            <Layout size={18} />
                        </button>
                    </div>

                    <button
                        onClick={onAddFiles}
                        className="btn btn-primary btn-sm gap-2"
                    >
                        <Plus size={14} /> Add Files
                    </button>
                    <button onClick={onToggleAutomation} className="btn btn-ghost btn-sm btn-icon" title="Automation">
                        <Bot size={16} />
                    </button>
                    <button onClick={onDeleteNotebook} className="btn btn-ghost btn-sm btn-icon text-danger" title="Delete Notebook">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Content Row (Description, Search, etc.) */}
            {children && (
                <div style={{ paddingLeft: 'calc(18px + 1rem)' /* Align with title text roughly */ }}>
                     {children}
                </div>
            )}
        </div>
    );
};
