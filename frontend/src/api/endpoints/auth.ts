import { apiClient } from '../client';

// --- User & Profile ---

export const updateUserProfile = async (data: { display_name?: string; profile_color?: string }): Promise<any> => {
    const response = await apiClient.put('/auth/me', data);
    return response.data;
};

// --- Sessions ---

export interface Session {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
    last_used_at: string;
    is_active: boolean;
}

export const getSessions = async (): Promise<Session[]> => {
    const response = await apiClient.get('/auth/sessions');
    return response.data;
};

export const revokeSession = async (sessionId: string): Promise<any> => {
    const response = await apiClient.delete(`/auth/sessions/${sessionId}`);
    return response.data;
};

// --- Invites ---

export const createDeviceInvite = async (): Promise<{ code: string; expires_at: string }> => {
    const response = await apiClient.post('/auth/invite/device');
    return response.data;
};

export const createUserInvite = async (displayName: string): Promise<{ code: string; user_id: string; expires_at: string }> => {
    const response = await apiClient.post('/auth/invite/user', { display_name: displayName });
    return response.data;
};
