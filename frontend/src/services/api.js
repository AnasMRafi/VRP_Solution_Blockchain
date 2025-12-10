/**
 * API Service
 * 
 * This module handles all HTTP requests to the backend API.
 * It uses axios for HTTP calls and includes:
 * - Automatic JWT token injection
 * - Error handling
 * - Request/response interceptors
 */

import axios from 'axios';

// Base URL for API - change this in production
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Create axios instance with default configuration
 */
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 second timeout for VRP optimization
});

/**
 * Request Interceptor
 * 
 * Automatically adds JWT token to all requests if available.
 * The token is retrieved from localStorage.
 */
apiClient.interceptors.request.use(
    (config) => {
        // Get token from localStorage
        const token = localStorage.getItem('access_token');

        // Add token to Authorization header if it exists
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Log request in development
        if (import.meta.env.DEV) {
            console.log(`→ ${config.method.toUpperCase()} ${config.url}`);
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

/**
 * Response Interceptor
 * 
 * Handles common response scenarios:
 * - 401: Token expired, redirect to login
 * - Network errors: Show user-friendly message
 */
apiClient.interceptors.response.use(
    (response) => {
        // Log successful response in development
        if (import.meta.env.DEV) {
            console.log(`← ${response.config.method.toUpperCase()} ${response.config.url} [${response.status}]`);
        }

        return response;
    },
    (error) => {
        // Handle specific error cases
        if (error.response) {
            // Server responded with error status
            const status = error.response.status;

            if (status === 401) {
                // Token expired or invalid - clear auth and redirect to login
                localStorage.removeItem('access_token');
                localStorage.removeItem('driver_id');
                window.location.href = '/login';
            }

            // Log error in development
            if (import.meta.env.DEV) {
                console.error(`✗ ${error.config.method.toUpperCase()} ${error.config.url} [${status}]`, error.response.data);
            }
        } else if (error.request) {
            // Request made but no response (network error)
            console.error('Network error: No response from server');
        } else {
            // Something else happened
            console.error('Request error:', error.message);
        }

        return Promise.reject(error);
    }
);

/**
 * API Service Object
 * 
 * Contains all API endpoint methods organized by resource.
 */
const api = {
    /**
     * Authentication Endpoints
     */
    auth: {
        /**
         * Login
         * @param {string} email - Driver email
         * @param {string} password - Driver password
         * @returns {Promise} Token and driver info
         */
        login: async (email, password) => {
            // OAuth2 password flow requires FormData
            const formData = new FormData();
            formData.append('username', email);  // OAuth2 uses 'username' field
            formData.append('password', password);

            const response = await apiClient.post('/auth/login', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            return response.data;
        },

        /**
         * Register new driver
         * @param {Object} driverData - Driver registration data
         * @returns {Promise} Created driver info
         */
        register: async (driverData) => {
            const response = await apiClient.post('/auth/register', driverData);
            return response.data;
        },

        /**
         * Get current driver info
         * @returns {Promise} Driver profile
         */
        getProfile: async () => {
            const response = await apiClient.get('/auth/me');
            return response.data;
        },

        /**
         * Logout
         * @returns {Promise}
         */
        logout: async () => {
            const response = await apiClient.post('/auth/logout');
            return response.data;
        },

        /**
         * Update profile
         * @param {Object} profileData - Profile update data
         * @returns {Promise} Updated profile
         */
        updateProfile: async (profileData) => {
            const response = await apiClient.put('/auth/profile', profileData);
            return response.data;
        },

        /**
         * Change password
         * @param {Object} passwordData - Current and new password
         * @returns {Promise} Success message
         */
        changePassword: async (passwordData) => {
            const response = await apiClient.put('/auth/password', passwordData);
            return response.data;
        },
    },

    /**
     * Route Endpoints
     */
    routes: {
        /**
         * Create and optimize a route
         * @param {Object} routeData - Route creation data
         * @returns {Promise} Optimized route
         */
        createRoute: async (routeData) => {
            const response = await apiClient.post('/routes/optimize', routeData);
            return response.data;
        },

        /**
         * List routes
         * @param {Object} params - Query parameters (status, limit, skip)
         * @returns {Promise} Array of routes
         */
        listRoutes: async (params = {}) => {
            const response = await apiClient.get('/routes/', { params });
            return response.data;
        },

        /**
         * Get route details
         * @param {string} routeId - Route ID
         * @returns {Promise} Complete route information
         */
        getRoute: async (routeId) => {
            const response = await apiClient.get(`/routes/${routeId}`);
            return response.data;
        },

        /**
         * Update route status
         * @param {string} routeId - Route ID
         * @param {string} newStatus - New status
         * @returns {Promise} Update confirmation
         */
        updateStatus: async (routeId, newStatus) => {
            const response = await apiClient.patch(`/routes/${routeId}/status`, null, {
                params: { new_status: newStatus }
            });
            return response.data;
        },

        /**
         * Confirm delivery
         * @param {string} routeId - Route ID
         * @param {Object} confirmationData - Delivery confirmation data
         * @returns {Promise} Confirmation result
         */
        confirmDelivery: async (routeId, confirmationData) => {
            const response = await apiClient.post(
                `/routes/${routeId}/confirm-delivery`,
                { ...confirmationData, route_id: routeId }
            );
            return response.data;
        },

        /**
         * Complete route
         * @param {string} routeId - Route ID
         * @returns {Promise} Completion confirmation
         */
        completeRoute: async (routeId) => {
            const response = await apiClient.post(`/routes/${routeId}/complete`);
            return response.data;
        },

        /**
         * Delete route
         * @param {string} routeId - Route ID
         * @returns {Promise} Deletion confirmation
         */
        deleteRoute: async (routeId) => {
            const response = await apiClient.delete(`/routes/${routeId}`);
            return response.data;
        },

        /**
         * Export route to CSV
         * @param {string} routeId - Route ID
         * @returns {Promise} Blob for download
         */
        exportCSV: async (routeId) => {
            const response = await apiClient.get(`/routes/${routeId}/export/csv`, {
                responseType: 'blob',
            });
            return response.data;
        },

        /**
         * Export route to PDF
         * @param {string} routeId - Route ID
         * @returns {Promise} Blob for download
         */
        exportPDF: async (routeId) => {
            const response = await apiClient.get(`/routes/${routeId}/export/pdf`, {
                responseType: 'blob',
            });
            return response.data;
        },

        /**
         * Verify route data integrity on blockchain
         * @param {string} routeId - Route ID
         * @returns {Promise} Verification result
         */
        verifyBlockchain: async (routeId) => {
            const response = await apiClient.get(`/routes/${routeId}/verify-blockchain`);
            return response.data;
        },
    },

    /**
     * Health Check
     */
    health: async () => {
        const response = await apiClient.get('/health');
        return response.data;
    },
};

/**
 * Helper function to download blob as file
 * @param {Blob} blob - File blob
 * @param {string} filename - Desired filename
 */
export const downloadFile = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

export default api;