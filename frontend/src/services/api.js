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

// Base URL for API - auto-detect based on current hostname
// This allows the app to work from any device (phone, laptop) without config changes
const getApiBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    // Use same hostname as frontend, but port 8000
    const hostname = window.location.hostname;
    return `http://${hostname}:8000`;
};

const API_BASE_URL = getApiBaseUrl();

/**
 * Create axios instance with default configuration
 */
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 120000, // 120 second timeout for VRP optimization (can take 30+ seconds)
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
     * Customers API
     */
    customers: {
        list: async (params = {}) => {
            const response = await apiClient.get('/customers', { params });
            return response.data;
        },
        get: async (customerId) => {
            const response = await apiClient.get(`/customers/${customerId}`);
            return response.data;
        },
        create: async (customerData) => {
            const response = await apiClient.post('/customers', customerData);
            return response.data;
        },
        update: async (customerId, customerData) => {
            const response = await apiClient.put(`/customers/${customerId}`, customerData);
            return response.data;
        },
        delete: async (customerId) => {
            const response = await apiClient.delete(`/customers/${customerId}`);
            return response.data;
        },
        getDeliveries: async (customerId) => {
            const response = await apiClient.get(`/customers/${customerId}/deliveries`);
            return response.data;
        },
    },

    /**
     * Depots API
     */
    depots: {
        list: async () => {
            const response = await apiClient.get('/depots');
            return response.data;
        },
        get: async (depotId) => {
            const response = await apiClient.get(`/depots/${depotId}`);
            return response.data;
        },
        getDefault: async () => {
            const response = await apiClient.get('/depots/default');
            return response.data;
        },
        create: async (depotData) => {
            const response = await apiClient.post('/depots', depotData);
            return response.data;
        },
        update: async (depotId, depotData) => {
            const response = await apiClient.put(`/depots/${depotId}`, depotData);
            return response.data;
        },
        delete: async (depotId) => {
            const response = await apiClient.delete(`/depots/${depotId}`);
            return response.data;
        },
        setDefault: async (depotId) => {
            const response = await apiClient.post(`/depots/${depotId}/set-default`);
            return response.data;
        },
    },

    /**
     * Analytics API
     */
    analytics: {
        getSummary: async (days = 30) => {
            const response = await apiClient.get('/analytics/summary', { params: { days } });
            return response.data;
        },
        getRoutesByStatus: async (days = 30) => {
            const response = await apiClient.get('/analytics/routes-by-status', { params: { days } });
            return response.data;
        },
        getRoutesOverTime: async (days = 30) => {
            const response = await apiClient.get('/analytics/routes-over-time', { params: { days } });
            return response.data;
        },
        getTopCustomers: async (limit = 10) => {
            const response = await apiClient.get('/analytics/top-customers', { params: { limit } });
            return response.data;
        },
        getPerformance: async () => {
            const response = await apiClient.get('/analytics/performance-metrics');
            return response.data;
        },
    },

    /**
     * Admin API
     */
    admin: {
        listDrivers: async (params = {}) => {
            const response = await apiClient.get('/admin/drivers', { params });
            return response.data;
        },
        getDriver: async (driverId) => {
            const response = await apiClient.get(`/admin/drivers/${driverId}`);
            return response.data;
        },
        updateDriverRole: async (driverId, role) => {
            const response = await apiClient.put(`/admin/drivers/${driverId}/role`, null, {
                params: { role }
            });
            return response.data;
        },
        updateDriverStatus: async (driverId, status) => {
            const response = await apiClient.put(`/admin/drivers/${driverId}/status`, null, {
                params: { status_value: status }
            });
            return response.data;
        },
        deleteDriver: async (driverId) => {
            const response = await apiClient.delete(`/admin/drivers/${driverId}`);
            return response.data;
        },
        getOverview: async () => {
            const response = await apiClient.get('/admin/stats/overview');
            return response.data;
        },
        makeFirstAdmin: async (driverId) => {
            const response = await apiClient.post(`/admin/make-admin/${driverId}`);
            return response.data;
        },
    },

    /**
     * Navigation - OpenRouteService directions
     */
    navigation: {
        getDirections: async (coordinates) => {
            // Uses OpenRouteService API directly (free, open-source)
            const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY || '';

            if (!ORS_API_KEY) {
                console.warn('OpenRouteService API key not configured');
                return null;
            }

            const response = await axios.post(
                'https://api.openrouteservice.org/v2/directions/driving-car',
                { coordinates },
                {
                    headers: {
                        'Authorization': ORS_API_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        },

        // Open location in external map apps
        openInGoogleMaps: (lat, lng) => {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
        },
        openInWaze: (lat, lng) => {
            window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
        },
        openInAppleMaps: (lat, lng) => {
            window.open(`http://maps.apple.com/?daddr=${lat},${lng}`, '_blank');
        },
    },

    /**
     * Geocoding API - Uses Nominatim (OpenStreetMap, free, no API key)
     */
    geocoding: {
        /**
         * Forward geocode - Convert address to coordinates
         * @param {string} address - Address string to geocode
         * @returns {Promise<{lat: number, lng: number, display_name: string} | null>}
         */
        geocodeAddress: async (address) => {
            try {
                const response = await axios.get('https://nominatim.openstreetmap.org/search', {
                    params: {
                        q: address,
                        format: 'json',
                        limit: 1,
                        addressdetails: 1
                    },
                    headers: {
                        'User-Agent': 'RouteChain/1.0'  // Required by Nominatim TOS
                    }
                });

                if (response.data && response.data.length > 0) {
                    const result = response.data[0];
                    return {
                        lat: parseFloat(result.lat),
                        lng: parseFloat(result.lon),
                        display_name: result.display_name,
                        address_details: result.address
                    };
                }
                return null;
            } catch (error) {
                console.error('Geocoding error:', error);
                return null;
            }
        },

        /**
         * Reverse geocode - Convert coordinates to address
         * @param {number} lat - Latitude
         * @param {number} lng - Longitude
         * @returns {Promise<{display_name: string, address: object} | null>}
         */
        reverseGeocode: async (lat, lng) => {
            try {
                const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
                    params: {
                        lat: lat,
                        lon: lng,
                        format: 'json',
                        addressdetails: 1
                    },
                    headers: {
                        'User-Agent': 'RouteChain/1.0'  // Required by Nominatim TOS
                    }
                });

                if (response.data && response.data.display_name) {
                    return {
                        display_name: response.data.display_name,
                        address: response.data.address || {}
                    };
                }
                return null;
            } catch (error) {
                console.error('Reverse geocoding error:', error);
                return null;
            }
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