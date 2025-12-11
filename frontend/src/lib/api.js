import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
    baseURL: 'http://localhost:8080/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// ===== REQUEST INTERCEPTOR =====
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');

    // Public endpoints that don't need authentication
    const publicEndpoints = ['/auth/login', '/auth/register'];
    const isPublic = publicEndpoints.some(endpoint => config.url.includes(endpoint));

    // Add token if available
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // ✅ FIX: Don't block non-public requests without token
    // Let the backend return 401, which we handle in response interceptor

    return config;
}, (error) => {
    return Promise.reject(error);
});

// ===== RESPONSE INTERCEPTOR =====
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Ignore cancelled requests (from our abort logic)
        if (axios.isCancel(error)) {
            return new Promise(() => {}); // Swallow the error
        }

        const status = error.response?.status;

        if (status === 401) {
            // ✅ Only redirect if NOT already on login page
            if (!window.location.pathname.includes('/login')) {
                console.error("Session expired or invalid token.");
                localStorage.removeItem('authToken');
                toast.error("Session expired. Please login again.");

                // Delay redirect to let user read the toast
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
            }
        }

        return Promise.reject(error);
    }
);

export default api;