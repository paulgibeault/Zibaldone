import axios from 'axios';

// Use 127.0.0.1 to avoid potential localhost IPv6 resolution issues
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 30000, // 30 seconds timeout
    headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    }
});

// Log requests and responses for debugging
apiClient.interceptors.request.use(request => {
    // Add Authorization header if token exists
    const token = localStorage.getItem('zibaldone-token');
    if (token) {
        request.headers.Authorization = `Bearer ${token}`;
    }
    
    if (import.meta.env.DEV) {
        const headersLog = { ...request.headers };
        if (headersLog.Authorization) {
            headersLog.Authorization = 'Bearer [REDACTED]';
        }
        console.log(`[API] ${request.method?.toUpperCase()} ${request.url}`, { ...request, headers: headersLog });
    }
    return request;
});

apiClient.interceptors.response.use(response => {
    if (import.meta.env.DEV) {
        console.log(`[API] Response ${response.status} ${response.config.url}`);
    }
    return response;
}, error => {
    console.error('API Error:', error);

    // Check for 401 Unauthorized
    if (error.response && error.response.status === 401) {
        console.warn("Unauthorized access detected. Dispatching auth:unauthorized event.");
        window.dispatchEvent(new Event('auth:unauthorized'));
    }

    if (error.code === 'ECONNABORTED') {
        console.error('Request timed out');
    }
    return Promise.reject(error);
});
