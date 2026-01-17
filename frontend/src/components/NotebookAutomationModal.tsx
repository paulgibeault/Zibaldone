import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Play } from 'lucide-react';
import { getNotebookTasks, createNotebookTask, updateNotebookTask, deleteNotebookTask } from '../api';
import { NotebookTask } from '../api/types';

interface NotebookAutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notebookId: string;
}

export const NotebookAutomationModal: React.FC<NotebookAutomationModalProps> = ({ isOpen, onClose, notebookId }) => {
  const [tasks, setTasks] = useState<NotebookTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTask, setEditingTask] = useState<NotebookTask | null>(null);
  
  // New Task State
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDefinition, setNewDefinition] = useState('{}');
  const [newTrigger, setNewTrigger] = useState('{"type": "manual"}');

  const fetchTasks = async () => {
    if (!notebookId) return;
    setLoading(true);
    try {
      const data = await getNotebookTasks(notebookId);
      setTasks(data);
    } catch (e) {
      console.error("Failed to fetch tasks", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTasks();
    }
  }, [isOpen, notebookId]);

  const handleCreate = async () => {
      try {
          await createNotebookTask(notebookId, {
              name: newName,
              definition_json: JSON.parse(newDefinition),
              trigger_config_json: JSON.parse(newTrigger),
              is_active: true
          });
          setIsCreating(false);
          setNewName('');
          setNewDefinition('{}');
          setNewTrigger('{"type": "manual"}');
          fetchTasks();
      } catch (e: any) {
          alert(`Failed to create task: ${e.message}`);
      }
  };

  const handleDelete = async (taskId: string) => {
      if (!window.confirm("Delete this task?")) return;
      try {
          await deleteNotebookTask(notebookId, taskId);
          fetchTasks();
      } catch (e) {
          console.error(e);
      }
  };

  const handleToggleActive = async (task: NotebookTask) => {
      try {
          await updateNotebookTask(notebookId, task.id, { is_active: !task.is_active });
          fetchTasks();
      } catch (e) {
          console.error(e);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3>Notebook Automation</h3>
          <button onClick={onClose} className="modal-close"><X size={20} /></button>
        </div>
        
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                 <h4>Defined Tasks</h4>
                 <button className="btn-primary" onClick={() => setIsCreating(true)} disabled={isCreating} style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
                    <Plus size={14} /> New Task
                 </button>
             </div>

             {isCreating && (
                 <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border-subtle)' }}>
                     <h5 style={{ marginTop: 0 }}>New Task</h5>
                     <div style={{ marginBottom: '0.5rem' }}>
                         <label style={{ display: 'block', fontSize: '0.8rem' }}>Name</label>
                         <input className="text-input" value={newName} onChange={e => setNewName(e.target.value)} style={{ width: '100%' }} />
                     </div>
                     <div style={{ marginBottom: '0.5rem' }}>
                         <label style={{ display: 'block', fontSize: '0.8rem' }}>Definition (JSON)</label>
                         <textarea className="text-input" value={newDefinition} onChange={e => setNewDefinition(e.target.value)} style={{ width: '100%', height: '60px', fontFamily: 'monospace', fontSize: '12px' }} />
                     </div>
                     <div style={{ marginBottom: '0.5rem' }}>
                         <label style={{ display: 'block', fontSize: '0.8rem' }}>Trigger (JSON)</label>
                         <textarea className="text-input" value={newTrigger} onChange={e => setNewTrigger(e.target.value)} style={{ width: '100%', height: '40px', fontFamily: 'monospace', fontSize: '12px' }} />
                     </div>
                     <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                         <button className="btn-secondary" onClick={() => setIsCreating(false)}>Cancel</button>
                         <button className="btn-primary" onClick={handleCreate}>Save</button>
                     </div>
                 </div>
             )}

             <div className="tasks-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                 {tasks.map(task => (
                     <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-paper)' }}>
                         <div>
                             <div style={{ fontWeight: 500 }}>{task.name}</div>
                             <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>Type: {task.trigger_config_json?.type || 'manual'}</div>
                         </div>
                         <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                             <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                 <input type="checkbox" checked={task.is_active} onChange={() => handleToggleActive(task)} />
                                 Active
                             </label>
                             <button className="icon-btn" style={{ color: 'red' }} onClick={() => handleDelete(task.id)}>
                                 <Trash2 size={16} />
                             </button>
                         </div>
                     </div>
                 ))}
                 {tasks.length === 0 && !isCreating && (
                     <div style={{ textAlign: 'center', color: 'var(--text-subtle)', padding: '2rem' }}>No automation tasks defined.</div>
                 )}
             </div>
        </div>
      </div>
    </div>
  );
};
