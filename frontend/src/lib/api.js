import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
    baseURL: 'http://localhost:8080/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');

    // List of endpoints that don't require auth
    const publicEndpoints = ['/auth/login', '/auth/register'];
    const isPublic = publicEndpoints.some(endpoint => config.url.includes(endpoint));

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    } else if (!isPublic) {
        // CRITICAL FIX: If no token and not a public endpoint, CANCEL the request.
        // This prevents the 401 error from the server and stops the login loop.
        console.warn(`[API] Blocked request to ${config.url} because no token was found.`);
        const controller = new AbortController();
        config.signal = controller.signal;
        controller.abort("No Auth Token"); // Cancel request
        return Promise.reject(new axios.Cancel("No Auth Token"));
    }

    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response Interceptor
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Ignore cancellations (caused by our logic above)
        if (axios.isCancel(error)) {
            return new Promise(() => {}); // Return pending promise to swallow error
        }

        const status = error.response?.status;

        if (status === 401) {
            console.error("Session expired or invalid token.");

            // Only redirect if we are NOT already on the login page
            if (!window.location.pathname.includes('/login')) {
                // Optional: Clear token only if you are sure
                // localStorage.removeItem('authToken');
                toast.error("Session expired. Please login again.");

                // Allow user to read the toast before redirecting (2 seconds)
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            }
        }
        return Promise.reject(error);
    }
);

export default api;