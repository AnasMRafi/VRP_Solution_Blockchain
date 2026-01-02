/**
 * Admin Dashboard Component
 * 
 * Admin panel for managing drivers, viewing system stats,
 * and performing admin-only operations.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
    Shield,
    Users,
    MapPin,
    Package,
    Warehouse,
    Edit2,
    Trash2,
    Loader,
    AlertCircle,
    ArrowLeft,
    X,
    Check,
    Search,
    UserCheck,
    UserX,
    ChevronDown,
    Route,
    User,
    Navigation
} from 'lucide-react';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const { driver } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [overview, setOverview] = useState(null);
    const [drivers, setDrivers] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [depots, setDepots] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [driverFilter, setDriverFilter] = useState('');
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [activeTab, setActiveTab] = useState('drivers');

    useEffect(() => {
        // Check if user is admin
        if (driver?.role !== 'admin') {
            navigate('/dashboard');
            return;
        }
        fetchData();
    }, [driver, search, roleFilter, driverFilter, activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [overviewData, driversData] = await Promise.all([
                api.admin.getOverview(),
                api.admin.listDrivers({ search: activeTab === 'drivers' ? search : '', role_filter: roleFilter || undefined })
            ]);
            setOverview(overviewData);
            setDrivers(driversData || []);

            // Fetch customers/depots based on active tab
            if (activeTab === 'customers') {
                const customersData = await api.customers.list({ search: search || undefined });
                setCustomers(customersData.customers || []);
            } else if (activeTab === 'depots') {
                const depotsData = await api.depots.list();
                setDepots(depotsData || []);
            } else if (activeTab === 'routes') {
                const routesData = await api.routes.listRoutes();
                setRoutes(routesData || []);
            }
        } catch (err) {
            console.error('Failed to fetch admin data:', err);
            setError(err.response?.status === 403 ? 'Admin access required' : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateRole = async (driverId, newRole) => {
        try {
            await api.admin.updateDriverRole(driverId, newRole);
            setShowRoleModal(false);
            setSelectedDriver(null);
            fetchData();
        } catch (err) {
            console.error('Failed to update role:', err);
            setError(err.response?.data?.detail || 'Failed to update role');
        }
    };

    const handleUpdateStatus = async (driverId, newStatus) => {
        try {
            await api.admin.updateDriverStatus(driverId, newStatus);
            fetchData();
        } catch (err) {
            console.error('Failed to update status:', err);
            setError(err.response?.data?.detail || 'Failed to update status');
        }
    };

    const handleDeleteDriver = async (driverId) => {
        if (!confirm('Are you sure you want to delete this driver? This action cannot be undone.')) return;

        try {
            await api.admin.deleteDriver(driverId);
            fetchData();
        } catch (err) {
            console.error('Failed to delete driver:', err);
            setError(err.response?.data?.detail || 'Failed to delete driver');
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            available: 'bg-green-100 text-green-700',
            on_route: 'bg-blue-100 text-blue-700',
            off_duty: 'bg-gray-100 text-gray-700',
            on_break: 'bg-amber-100 text-amber-700'
        };
        return colors[status] || 'bg-gray-100 text-gray-700';
    };

    const getRoleBadge = (role) => {
        const colors = {
            admin: 'bg-purple-100 text-purple-700',
            driver: 'bg-blue-100 text-blue-700',
            dispatcher: 'bg-cyan-100 text-cyan-700'
        };
        return colors[role] || 'bg-gray-100 text-gray-700';
    };

    // Filter customers/depots by selected driver
    const filteredCustomers = driverFilter
        ? customers.filter(c => c.driver_id === driverFilter)
        : customers;

    const filteredDepots = driverFilter
        ? depots.filter(d => d.driver_id === driverFilter)
        : depots;

    const filteredRoutes = driverFilter
        ? routes.filter(r => r.driver_id === driverFilter)
        : routes;

    const getRouteStatusColor = (status) => {
        const colors = {
            draft: 'bg-gray-100 text-gray-700',
            optimized: 'bg-blue-100 text-blue-700',
            assigned: 'bg-cyan-100 text-cyan-700',
            in_progress: 'bg-amber-100 text-amber-700',
            completed: 'bg-green-100 text-green-700',
            cancelled: 'bg-red-100 text-red-700'
        };
        return colors[status] || 'bg-gray-100 text-gray-700';
    };

    if (loading && !overview) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-100 rounded-xl">
                            <Shield className="w-6 h-6 text-purple-700" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
                            <p className="text-gray-600">Manage drivers, customers, and depots</p>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="alert alert-error mb-6">
                        <AlertCircle className="w-5 h-5" />
                        <span>{error}</span>
                        <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
                    </div>
                )}

                {/* Overview Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="card">
                        <div className="card-body text-center">
                            <Users className="w-8 h-8 mx-auto text-primary-600 mb-2" />
                            <p className="text-2xl font-bold">{overview?.drivers?.total || 0}</p>
                            <p className="text-sm text-gray-600">Total Drivers</p>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-body text-center">
                            <MapPin className="w-8 h-8 mx-auto text-green-600 mb-2" />
                            <p className="text-2xl font-bold">{overview?.routes?.active || 0}</p>
                            <p className="text-sm text-gray-600">Active Routes</p>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-body text-center">
                            <Package className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                            <p className="text-2xl font-bold">{overview?.customers || 0}</p>
                            <p className="text-sm text-gray-600">Customers</p>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-body text-center">
                            <Warehouse className="w-8 h-8 mx-auto text-amber-600 mb-2" />
                            <p className="text-2xl font-bold">{overview?.depots || 0}</p>
                            <p className="text-sm text-gray-600">Depots</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {['drivers', 'customers', 'depots', 'routes'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setSearch(''); setDriverFilter(''); }}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${activeTab === tab
                                ? 'bg-primary-600 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {tab === 'drivers' && <Users className="w-4 h-4 inline mr-2" />}
                            {tab === 'customers' && <Package className="w-4 h-4 inline mr-2" />}
                            {tab === 'depots' && <Warehouse className="w-4 h-4 inline mr-2" />}
                            {tab === 'routes' && <Navigation className="w-4 h-4 inline mr-2" />}
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Driver Management Tab */}
                {activeTab === 'drivers' && (
                    <div className="card">
                        <div className="card-body">
                            <h2 className="text-xl font-semibold mb-4">Driver Management</h2>

                            {/* Filters */}
                            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                                <div className="relative flex-1 min-w-0">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by name, email, or ID..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                                    />
                                </div>
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className="select-btn w-[200px]"
                                >
                                    <option value="">All Roles</option>
                                    <option value="admin">Admin</option>
                                    <option value="driver">Driver</option>
                                    <option value="dispatcher">Dispatcher</option>
                                </select>
                            </div>

                            {/* Drivers Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200 bg-gray-50">
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Driver</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">ID</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Role</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Vehicle</th>
                                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {drivers.map((d) => (
                                            <tr key={d.driver_id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                                                            {d.full_name?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900">{d.full_name}</p>
                                                            <p className="text-sm text-gray-500">{d.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <code className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                                                        {d.driver_id}
                                                    </code>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getRoleBadge(d.role || 'driver')}`}>
                                                        {d.role || 'driver'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor(d.status)}`}>
                                                        {d.status?.replace('_', ' ') || 'available'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-600">
                                                    {d.vehicle_type} {d.license_plate && `• ${d.license_plate}`}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => { setSelectedDriver(d); setShowRoleModal(true); }}
                                                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                                            title="Change role"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        {d.driver_id !== driver?.driver_id && (
                                                            <button
                                                                onClick={() => handleDeleteDriver(d.driver_id)}
                                                                className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                                                title="Delete driver"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {drivers.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        No drivers found
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Customers Tab */}
                {activeTab === 'customers' && (
                    <div className="card">
                        <div className="card-body">
                            <h2 className="text-xl font-semibold mb-4">All Customers</h2>

                            {/* Filters */}
                            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                                <div className="relative flex-1 min-w-0">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by name, email, ID, or owner ID..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                                    />
                                </div>
                                <select
                                    value={driverFilter}
                                    onChange={(e) => setDriverFilter(e.target.value)}
                                    className="select-btn w-[200px]"
                                >
                                    <option value="">All Drivers</option>
                                    {drivers.map((d) => (
                                        <option key={d.driver_id} value={d.driver_id}>
                                            {d.full_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Customers Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200 bg-gray-50">
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">ID</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Contact</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Location</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Owner</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Deliveries</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredCustomers.map((c) => (
                                            <tr key={c.customer_id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                                            {c.name?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900">{c.name}</p>
                                                            {c.company && <p className="text-sm text-gray-500">{c.company}</p>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <code className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                                                        {c.customer_id}
                                                    </code>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-600">
                                                    {c.email && <p>{c.email}</p>}
                                                    {c.phone && <p>{c.phone}</p>}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-600">
                                                    {c.address?.city || '-'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <code className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                                                        {c.driver_id}
                                                    </code>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-600">
                                                    {c.delivery_count || 0}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {filteredCustomers.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        No customers found
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Depots Tab */}
                {activeTab === 'depots' && (
                    <div className="card">
                        <div className="card-body">
                            <h2 className="text-xl font-semibold mb-4">All Depots</h2>

                            {/* Filters */}
                            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                                <div className="relative flex-1 min-w-0">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by name, ID, or owner ID..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                                    />
                                </div>
                                <select
                                    value={driverFilter}
                                    onChange={(e) => setDriverFilter(e.target.value)}
                                    className="select-btn w-[200px]"
                                >
                                    <option value="">All Drivers</option>
                                    {drivers.map((d) => (
                                        <option key={d.driver_id} value={d.driver_id}>
                                            {d.full_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Depots Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200 bg-gray-50">
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Depot</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">ID</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Address</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Hours</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Owner</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Default</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredDepots.map((d) => (
                                            <tr key={d.depot_id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                                                            <Warehouse className="w-5 h-5" />
                                                        </div>
                                                        <p className="font-medium text-gray-900">{d.name}</p>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <code className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                                                        {d.depot_id}
                                                    </code>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-600">
                                                    {d.location?.address || '-'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-600">
                                                    {d.operating_hours || '-'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <code className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                                                        {d.driver_id}
                                                    </code>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {d.is_default && (
                                                        <span className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded-full">
                                                            Default
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {filteredDepots.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        No depots found
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Routes Tab */}
                {activeTab === 'routes' && (
                    <div className="card">
                        <div className="card-body">
                            <h2 className="text-xl font-semibold mb-4">All Routes</h2>

                            {/* Filters */}
                            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                                <div className="relative flex-1 min-w-0">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by name, ID, or owner ID..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                                    />
                                </div>
                                <select
                                    value={driverFilter}
                                    onChange={(e) => setDriverFilter(e.target.value)}
                                    className="select-btn w-[200px]"
                                >
                                    <option value="">All Drivers</option>
                                    {drivers.map((d) => (
                                        <option key={d.driver_id} value={d.driver_id}>
                                            {d.full_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Routes Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200 bg-gray-50">
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Route</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">ID</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Deliveries</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Distance</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Owner</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRoutes.map((r) => (
                                            <tr key={r.route_id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
                                                            <MapPin className="w-5 h-5" />
                                                        </div>
                                                        <p className="font-medium text-gray-900">{r.route_name}</p>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <code className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                                                        {r.route_id}
                                                    </code>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getRouteStatusColor(r.status)}`}>
                                                        {r.status?.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-600">
                                                    {r.completed_deliveries}/{r.delivery_count}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-600">
                                                    {r.total_distance_km ? `${r.total_distance_km.toFixed(1)} km` : '-'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <code className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                                                        {r.driver_id}
                                                    </code>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {filteredRoutes.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        No routes found
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Role Change Modal */}
                {showRoleModal && selectedDriver && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold">Change Role</h2>
                                    <button
                                        onClick={() => { setShowRoleModal(false); setSelectedDriver(null); }}
                                        className="p-2 hover:bg-gray-100 rounded-lg"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <p className="text-gray-600 mb-4">
                                    Change role for <strong>{selectedDriver.full_name}</strong>
                                </p>

                                <div className="space-y-3">
                                    {['driver', 'dispatcher', 'admin'].map((role) => (
                                        <button
                                            key={role}
                                            onClick={() => handleUpdateRole(selectedDriver.driver_id, role)}
                                            className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors ${selectedDriver.role === role
                                                ? 'border-primary-500 bg-primary-50'
                                                : 'border-gray-200 hover:border-primary-300'
                                                }`}
                                        >
                                            <span className="font-medium capitalize">{role}</span>
                                            {selectedDriver.role === role && (
                                                <Check className="w-5 h-5 text-primary-600" />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => { setShowRoleModal(false); setSelectedDriver(null); }}
                                    className="btn btn-secondary w-full mt-4"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
