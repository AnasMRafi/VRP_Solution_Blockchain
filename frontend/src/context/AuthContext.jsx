/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the app.
 * Uses React Context API to avoid prop drilling.
 * 
 * Features:
 * - Login/logout functionality
 * - Persistent authentication (localStorage)
 * - User profile management
 * - Protected route handling
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

// Create the context
const AuthContext = createContext(null);

/**
 * Authentication Provider Component
 * 
 * Wraps the entire app and provides auth state/methods to all children.
 */
export const AuthProvider = ({ children }) => {
  // State
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  /**
   * Check if user is authenticated on mount
   * This runs once when the app loads
   */
  useEffect(() => {
    checkAuth();
  }, []);
  
  /**
   * Check Authentication Status
   * 
   * Verifies if a valid token exists and fetches driver profile.
   */
  const checkAuth = async () => {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      setLoading(false);
      return;
    }
    
    try {
      // Fetch driver profile with existing token
      const driverData = await api.auth.getProfile();
      setDriver(driverData);
      setError(null);
    } catch (err) {
      // Token invalid or expired
      console.error('Auth check failed:', err);
      localStorage.removeItem('access_token');
      localStorage.removeItem('driver_id');
      setDriver(null);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Login
   * 
   * Authenticates user and stores token.
   * 
   * @param {string} email - Driver email
   * @param {string} password - Driver password
   * @returns {Promise<boolean>} Success status
   */
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      // Call login API
      const response = await api.auth.login(email, password);
      
      // Store token and driver ID
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('driver_id', response.driver_id);
      
      // Fetch full driver profile
      const driverData = await api.auth.getProfile();
      setDriver(driverData);
      
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Login failed:', err);
      
      // Extract error message
      const errorMessage = err.response?.data?.detail || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      
      setLoading(false);
      return false;
    }
  };
  
  /**
   * Register
   * 
   * Creates a new driver account.
   * 
   * @param {Object} driverData - Registration data
   * @returns {Promise<boolean>} Success status
   */
  const register = async (driverData) => {
    setLoading(true);
    setError(null);
    
    try {
      // Call register API
      await api.auth.register(driverData);
      
      // Auto-login after successful registration
      const loginSuccess = await login(driverData.email, driverData.password);
      
      setLoading(false);
      return loginSuccess;
    } catch (err) {
      console.error('Registration failed:', err);
      
      // Extract error message
      const errorMessage = err.response?.data?.detail || 'Registration failed. Please try again.';
      setError(errorMessage);
      
      setLoading(false);
      return false;
    }
  };
  
  /**
   * Logout
   * 
   * Clears authentication state and redirects to login.
   */
  const logout = async () => {
    try {
      // Call logout API (optional, mainly for logging)
      await api.auth.logout();
    } catch (err) {
      console.error('Logout API call failed:', err);
    } finally {
      // Clear local state regardless of API call result
      localStorage.removeItem('access_token');
      localStorage.removeItem('driver_id');
      setDriver(null);
      setError(null);
    }
  };
  
  /**
   * Update Driver Profile
   * 
   * Refreshes the driver data from the server.
   */
  const refreshProfile = async () => {
    try {
      const driverData = await api.auth.getProfile();
      setDriver(driverData);
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  };
  
  // Context value object
  const value = {
    driver,
    loading,
    error,
    login,
    register,
    logout,
    refreshProfile,
    isAuthenticated: !!driver,
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * useAuth Hook
 * 
 * Custom hook to access auth context.
 * Must be used within AuthProvider.
 * 
 * @returns {Object} Auth context value
 * 
 * @example
 * const { driver, login, logout, isAuthenticated } = useAuth();
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;