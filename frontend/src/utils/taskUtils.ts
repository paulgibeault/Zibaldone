import { ProcessingTask } from '../api/types';

export const isTaskFailed = (task: ProcessingTask): boolean => {
    if (task.status === 'FAILED') {
        return true;
    }
    
    if (task.status === 'COMPLETED' && task.result_json) {
        try {
            const result = JSON.parse(task.result_json);
            if (result && result.status === 'failure') {
                return true;
            }
        } catch (e) {
            // ignore json parse error
            return false;
        }
    }
    
    return false;
};

export const isRunningTask = (task: ProcessingTask): boolean => {
    return task.status === 'RUNNING';
};

export const isPendingTask = (task: ProcessingTask): boolean => {
    return task.status === 'PENDING';
};
