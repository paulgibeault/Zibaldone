import { apiClient as client } from '../client';

export interface Skill {
    name: string;
    description: string;
    parameters: Record<string, any>;
}

export const listSkills = async (): Promise<Skill[]> => {
    const response = await client.get('/skills');
    return response.data;
};

export const triggerSkill = async (skillName: string, itemId: string, parameters?: Record<string, any>): Promise<any> => {
    const response = await client.post(`/skills/${skillName}/trigger`, {
        item_id: itemId,
        parameters
    });
    return response.data;
};
