/**
 * Profile Page Component
 * 
 * Complete user profile management with:
 * - Edit profile (name, phone, vehicle info)
 * - Change password
 * - Performance statistics
 * - Account settings
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
    User,
    Mail,
    Phone,
    Truck,
    MapPin,
    Calendar,
    Edit3,
    Save,
    X,
    Lock,
    Key,
    Eye,
    EyeOff,
    BarChart3,
    Package,
    Clock,
    CheckCircle,
    XCircle,
    TrendingUp,
    Award,
    Settings,
    LogOut,
    Loader,
    AlertCircle,
    Shield
} from 'lucide-react';

const Profile = () => {
    const navigate = useNavigate();
    const { driver, logout, refreshProfile } = useAuth();

    // State
    const [activeTab, setActiveTab] = useState('profile');
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Profile form state
    const [profileData, setProfileData] = useState({
        full_name: '',
        phone: '',
        vehicle_type: '',
        license_plate: '',
        max_capacity: 20
    });

    // Password form state
    const [passwordData, setPasswordData] = useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });

    // Stats state
    const [stats, setStats] = useState({
        totalRoutes: 0,
        completedRoutes: 0,
        totalDeliveries: 0,
        completedDeliveries: 0,
        failedDeliveries: 0,
        totalDistance: 0,
        avgRating: 0,
        activeDate: null
    });

    // Routes for stats calculation
    const [routes, setRoutes] = useState([]);

    /**
     * Fetch routes for statistics (same as Dashboard)
     */
    const fetchRoutesForStats = async () => {
        try {
            const data = await api.routes.listRoutes({});
            setRoutes(data);

            // Calculate stats from routes (same logic as Dashboard)
            const totalRoutes = data.length;
            const completedRoutes = data.filter(r => r.status === 'completed').length;
            const totalDistance = data.reduce((sum, r) => sum + (r.total_distance_km || 0), 0);
            const totalDeliveries = data.reduce((sum, r) => sum + (r.delivery_count || 0), 0);
            const completedDeliveries = data.reduce((sum, r) => sum + (r.completed_deliveries || 0), 0);
            const failedDeliveries = totalDeliveries - completedDeliveries;

            setStats({
                totalRoutes,
                completedRoutes,
                totalDeliveries,
                completedDeliveries,
                failedDeliveries,
                totalDistance,
                avgRating: 0,
                activeDate: driver?.created_at
            });
        } catch (err) {
            console.error('Failed to fetch routes for stats:', err);
        }
    };

    // Initialize profile data from driver and fetch stats
    useEffect(() => {
        if (driver) {
            setProfileData({
                full_name: driver.full_name || '',
                phone: driver.phone || '',
                vehicle_type: driver.vehicle_type || 'car',
                license_plate: driver.license_plate || '',
                max_capacity: driver.max_capacity || 20
            });

            // Fetch routes for accurate statistics
            fetchRoutesForStats();
        }
    }, [driver]);

    /**
     * Handle profile form changes
     */
    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        setProfileData(prev => ({
            ...prev,
            [name]: name === 'max_capacity' ? parseInt(value) || 0 : value
        }));
    };

    /**
     * Handle password form changes
     */
    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    /**
     * Save profile changes
     */
    const handleSaveProfile = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            await api.auth.updateProfile(profileData);
            await refreshProfile();
            setSuccess('Profile updated successfully!');
            setEditing(false);
        } catch (err) {
            console.error('Failed to update profile:', err);
            setError(err.response?.data?.detail || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Change password
     */
    const handleChangePassword = async (e) => {
        e.preventDefault();

        // Validation
        if (passwordData.new_password !== passwordData.confirm_password) {
            setError('New passwords do not match');
            return;
        }

        if (passwordData.new_password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            await api.auth.changePassword({
                current_password: passwordData.current_password,
                new_password: passwordData.new_password
            });
            setSuccess('Password changed successfully!');
            setPasswordData({
                current_password: '',
                new_password: '',
                confirm_password: ''
            });
        } catch (err) {
            console.error('Failed to change password:', err);
            setError(err.response?.data?.detail || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handle logout
     */
    const handleLogout = async () => {
        if (confirm('Are you sure you want to log out?')) {
            await logout();
            navigate('/login');
        }
    };

    /**
     * Get vehicle icon
     */
    const getVehicleIcon = () => {
        return <Truck className="w-5 h-5" />;
    };

    /**
     * Format date
     */
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    /**
     * Calculate completion rate
     */
    const getCompletionRate = () => {
        if (stats.totalDeliveries === 0) return 0;
        return Math.round((stats.completedDeliveries / stats.totalDeliveries) * 100);
    };

    const tabs = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'security', label: 'Security', icon: Lock },
        { id: 'stats', label: 'Statistics', icon: BarChart3 },
        { id: 'settings', label: 'Settings', icon: Settings }
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
                    <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="alert alert-error mb-6">
                        <AlertCircle className="w-5 h-5" />
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {success && (
                    <div className="alert alert-success mb-6">
                        <CheckCircle className="w-5 h-5" />
                        <span>{success}</span>
                        <button onClick={() => setSuccess(null)} className="ml-auto">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sidebar / Profile Card */}
                    <div className="lg:col-span-1">
                        <div className="card">
                            <div className="card-body text-center">
                                {/* Avatar */}
                                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center mb-4">
                                    <span className="text-3xl font-bold text-white">
                                        {driver?.full_name?.charAt(0)?.toUpperCase() || 'D'}
                                    </span>
                                </div>

                                <h2 className="text-xl font-bold text-gray-900">{driver?.full_name}</h2>
                                <p className="text-gray-600 text-sm">{driver?.email}</p>

                                <div className="flex items-center justify-center gap-2 mt-2 text-sm text-gray-500">
                                    <Truck className="w-4 h-4" />
                                    <span className="capitalize">{driver?.vehicle_type || 'Vehicle'}</span>
                                </div>

                                {/* Quick Stats */}
                                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200">
                                    <div>
                                        <p className="text-2xl font-bold text-primary-600">{stats.completedRoutes}</p>
                                        <p className="text-xs text-gray-500">Routes</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-green-600">{getCompletionRate()}%</p>
                                        <p className="text-xs text-gray-500">Success</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="card mt-4">
                            <div className="p-2">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${activeTab === tab.id
                                            ? 'bg-primary-50 text-primary-700'
                                            : 'text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        <tab.icon className="w-5 h-5" />
                                        <span className="font-medium">{tab.label}</span>
                                    </button>
                                ))}

                                <hr className="my-2" />

                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-red-600 hover:bg-red-50 transition-colors"
                                >
                                    <LogOut className="w-5 h-5" />
                                    <span className="font-medium">Logout</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-3">
                        {/* Profile Tab */}
                        {activeTab === 'profile' && (
                            <div className="card">
                                <div className="card-body">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-lg font-semibold">Profile Information</h3>
                                        {!editing ? (
                                            <button
                                                onClick={() => setEditing(true)}
                                                className="btn btn-outline btn-sm"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                                Edit
                                            </button>
                                        ) : (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditing(false)}
                                                    className="btn btn-secondary btn-sm"
                                                >
                                                    <X className="w-4 h-4" />
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSaveProfile}
                                                    disabled={loading}
                                                    className="btn btn-primary btn-sm"
                                                >
                                                    {loading ? (
                                                        <Loader className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Save className="w-4 h-4" />
                                                    )}
                                                    Save
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Full Name */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Full Name
                                            </label>
                                            {editing ? (
                                                <input
                                                    type="text"
                                                    name="full_name"
                                                    value={profileData.full_name}
                                                    onChange={handleProfileChange}
                                                    className="input w-full"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2 text-gray-900">
                                                    <User className="w-5 h-5 text-gray-400" />
                                                    <span>{driver?.full_name || 'Not set'}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Email (read-only) */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Email Address
                                            </label>
                                            <div className="flex items-center gap-2 text-gray-900">
                                                <Mail className="w-5 h-5 text-gray-400" />
                                                <span>{driver?.email}</span>
                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                                    Read-only
                                                </span>
                                            </div>
                                        </div>

                                        {/* Phone */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Phone Number
                                            </label>
                                            {editing ? (
                                                <input
                                                    type="tel"
                                                    name="phone"
                                                    value={profileData.phone}
                                                    onChange={handleProfileChange}
                                                    className="input w-full"
                                                    placeholder="+212 600 000000"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2 text-gray-900">
                                                    <Phone className="w-5 h-5 text-gray-400" />
                                                    <span>{driver?.phone || 'Not set'}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Vehicle Type */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Vehicle Type
                                            </label>
                                            {editing ? (
                                                <select
                                                    name="vehicle_type"
                                                    value={profileData.vehicle_type}
                                                    onChange={handleProfileChange}
                                                    className="input w-full"
                                                >
                                                    <option value="bike">Bike</option>
                                                    <option value="car">Car</option>
                                                    <option value="van">Van</option>
                                                    <option value="truck">Truck</option>
                                                </select>
                                            ) : (
                                                <div className="flex items-center gap-2 text-gray-900">
                                                    <Truck className="w-5 h-5 text-gray-400" />
                                                    <span className="capitalize">{driver?.vehicle_type || 'Not set'}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* License Plate */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                License Plate
                                            </label>
                                            {editing ? (
                                                <input
                                                    type="text"
                                                    name="license_plate"
                                                    value={profileData.license_plate}
                                                    onChange={handleProfileChange}
                                                    className="input w-full"
                                                    placeholder="ABC-123"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2 text-gray-900">
                                                    <MapPin className="w-5 h-5 text-gray-400" />
                                                    <span>{driver?.license_plate || 'Not set'}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Max Capacity */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Max Capacity (packages)
                                            </label>
                                            {editing ? (
                                                <input
                                                    type="number"
                                                    name="max_capacity"
                                                    value={profileData.max_capacity}
                                                    onChange={handleProfileChange}
                                                    className="input w-full"
                                                    min="1"
                                                    max="100"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2 text-gray-900">
                                                    <Package className="w-5 h-5 text-gray-400" />
                                                    <span>{driver?.max_capacity || 20} packages</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Additional Info */}
                                    <div className="mt-8 pt-6 border-t border-gray-200">
                                        <h4 className="text-sm font-medium text-gray-700 mb-4">Account Information</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <Calendar className="w-4 h-4" />
                                                <span>Member since: {formatDate(driver?.created_at)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <Clock className="w-4 h-4" />
                                                <span>Last login: {formatDate(driver?.last_login)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Security Tab */}
                        {activeTab === 'security' && (
                            <div className="card">
                                <div className="card-body">
                                    <h3 className="text-lg font-semibold mb-6">Change Password</h3>

                                    <form onSubmit={handleChangePassword} className="max-w-md">
                                        {/* Current Password */}
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Current Password
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showPasswords.current ? 'text' : 'password'}
                                                    name="current_password"
                                                    value={passwordData.current_password}
                                                    onChange={handlePasswordChange}
                                                    className="input w-full pr-10"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPasswords(p => ({ ...p, current: !p.current }))}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                >
                                                    {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* New Password */}
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                New Password
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showPasswords.new ? 'text' : 'password'}
                                                    name="new_password"
                                                    value={passwordData.new_password}
                                                    onChange={handlePasswordChange}
                                                    className="input w-full pr-10"
                                                    required
                                                    minLength={8}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPasswords(p => ({ ...p, new: !p.new }))}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                >
                                                    {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">At least 8 characters</p>
                                        </div>

                                        {/* Confirm Password */}
                                        <div className="mb-6">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Confirm New Password
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showPasswords.confirm ? 'text' : 'password'}
                                                    name="confirm_password"
                                                    value={passwordData.confirm_password}
                                                    onChange={handlePasswordChange}
                                                    className="input w-full pr-10"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPasswords(p => ({ ...p, confirm: !p.confirm }))}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                >
                                                    {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="btn btn-primary"
                                        >
                                            {loading ? (
                                                <Loader className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Key className="w-4 h-4" />
                                            )}
                                            Update Password
                                        </button>
                                    </form>

                                    {/* Security Info */}
                                    <div className="mt-8 pt-6 border-t border-gray-200">
                                        <h4 className="text-sm font-medium text-gray-700 mb-4">Security Tips</h4>
                                        <ul className="space-y-2 text-sm text-gray-600">
                                            <li className="flex items-start gap-2">
                                                <Shield className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                                                Use a strong password with letters, numbers, and symbols
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <Shield className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                                                Never share your password with anyone
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <Shield className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                                                Log out from shared devices
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Statistics Tab */}
                        {activeTab === 'stats' && (
                            <div className="space-y-6">
                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="card">
                                        <div className="card-body text-center">
                                            <MapPin className="w-8 h-8 text-primary-600 mx-auto mb-2" />
                                            <p className="text-3xl font-bold text-gray-900">{stats.totalRoutes}</p>
                                            <p className="text-sm text-gray-600">Total Routes</p>
                                        </div>
                                    </div>

                                    <div className="card">
                                        <div className="card-body text-center">
                                            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                                            <p className="text-3xl font-bold text-green-600">{stats.completedRoutes}</p>
                                            <p className="text-sm text-gray-600">Completed</p>
                                        </div>
                                    </div>

                                    <div className="card">
                                        <div className="card-body text-center">
                                            <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                                            <p className="text-3xl font-bold text-blue-600">{stats.totalDeliveries}</p>
                                            <p className="text-sm text-gray-600">Deliveries</p>
                                        </div>
                                    </div>

                                    <div className="card">
                                        <div className="card-body text-center">
                                            <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                                            <p className="text-3xl font-bold text-purple-600">{stats.totalDistance.toFixed(1)}</p>
                                            <p className="text-sm text-gray-600">KM Driven</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Stats */}
                                <div className="card">
                                    <div className="card-body">
                                        <h3 className="text-lg font-semibold mb-4">Performance Overview</h3>

                                        <div className="space-y-6">
                                            {/* Completion Rate */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium text-gray-700">Delivery Success Rate</span>
                                                    <span className="text-sm font-bold text-green-600">{getCompletionRate()}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-3">
                                                    <div
                                                        className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                                                        style={{ width: `${getCompletionRate()}%` }}
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {stats.completedDeliveries} of {stats.totalDeliveries} deliveries completed
                                                </p>
                                            </div>

                                            {/* Stats Table */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-gray-50 rounded-lg p-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                                        <span className="text-sm text-gray-600">Successful Deliveries</span>
                                                    </div>
                                                    <p className="text-2xl font-bold text-gray-900">{stats.completedDeliveries}</p>
                                                </div>

                                                <div className="bg-gray-50 rounded-lg p-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <XCircle className="w-4 h-4 text-red-500" />
                                                        <span className="text-sm text-gray-600">Failed Deliveries</span>
                                                    </div>
                                                    <p className="text-2xl font-bold text-gray-900">{stats.failedDeliveries}</p>
                                                </div>
                                            </div>

                                            {/* Achievement Badge */}
                                            {stats.completedRoutes >= 10 && (
                                                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4">
                                                    <div className="flex items-center gap-3">
                                                        <Award className="w-10 h-10 text-amber-500" />
                                                        <div>
                                                            <p className="font-semibold text-amber-800">Experienced Driver</p>
                                                            <p className="text-sm text-amber-600">Completed 10+ routes</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Settings Tab */}
                        {activeTab === 'settings' && (
                            <div className="card">
                                <div className="card-body">
                                    <h3 className="text-lg font-semibold mb-6">Account Settings</h3>

                                    {/* Notifications */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between py-3 border-b border-gray-200">
                                            <div>
                                                <p className="font-medium text-gray-900">Email Notifications</p>
                                                <p className="text-sm text-gray-600">Receive updates about your routes</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" defaultChecked />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-between py-3 border-b border-gray-200">
                                            <div>
                                                <p className="font-medium text-gray-900">Route Reminders</p>
                                                <p className="text-sm text-gray-600">Get reminded about scheduled routes</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" defaultChecked />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-between py-3">
                                            <div>
                                                <p className="font-medium text-gray-900">Dark Mode</p>
                                                <p className="text-sm text-gray-600">Switch to dark theme</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Danger Zone */}
                                    <div className="mt-8 pt-6 border-t border-gray-200">
                                        <h4 className="text-sm font-medium text-red-600 mb-4">Danger Zone</h4>
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-red-800">Delete Account</p>
                                                    <p className="text-sm text-red-600">Permanently delete your account and all data</p>
                                                </div>
                                                <button className="btn btn-error btn-sm">
                                                    Delete Account
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
