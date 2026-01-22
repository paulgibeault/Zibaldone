import React from 'react';
import { Modal } from '../Modal';
import { TaskList } from './TaskList';
import './TaskManager.css';

interface TaskManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenFile: (itemId: string) => void;
}

export const TaskManagerModal: React.FC<TaskManagerModalProps> = ({ isOpen, onClose, onOpenFile }) => {
    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose}
            title="Task Manager"
            className="task-manager-modal"
            width="1000px"
        >
            <TaskList refreshTrigger={isOpen ? Date.now() : 0} onOpenFile={onOpenFile} />
        </Modal>
    );
};
