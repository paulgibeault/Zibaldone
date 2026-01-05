import { apiClient } from '../client';

export const updateUserProfile = async (data: { display_name?: string; profile_color?: string }): Promise<any> => {
    // We used /auth/me in backend, so we need to match that.
    // The backend router prefix is /api/auth.
    const response = await apiClient.put('/auth/me', data);
    return response.data;
};
