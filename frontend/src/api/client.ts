import axios from 'axios';

// Use 127.0.0.1 to avoid potential localhost IPv6 resolution issues
const API_URL = 'http://127.0.0.1:8000/api';

export const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 30000, // 30 seconds timeout
});

// Log requests and responses for debugging
apiClient.interceptors.request.use(request => {
    // Add Authorization header if token exists
    const token = localStorage.getItem('zibaldone-token');
    if (token) {
        request.headers.Authorization = `Bearer ${token}`;
    }
    console.log('Starting Request', request);
    return request;
});

apiClient.interceptors.response.use(response => {
    console.log('Response:', response);
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
