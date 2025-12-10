/**
 * Dashboard Component
 * 
 * Main dashboard showing:
 * - Statistics cards
 * - Route list with filters
 * - Quick actions
 * - Status badges
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  Plus,
  MapPin,
  Clock,
  TrendingUp,
  CheckCircle,
  Loader,
  AlertCircle,
  FileText,
  Trash2,
  BarChart3,
  Users,
  Warehouse,
  Shield,
  ArrowRight,
  Search,
  X
} from 'lucide-react';
import { format } from 'date-fns';

const Dashboard = () => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(null);

  const { driver } = useAuth();
  const navigate = useNavigate();

  /**
   * Fetch routes on mount
   */
  useEffect(() => {
    fetchRoutes();
  }, [filter, search]);

  /**
   * Fetch routes from API
   */
  const fetchRoutes = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {};

      // Add status filter if not 'all'
      if (filter !== 'all') {
        params.status_filter = filter;
      }

      if (search.trim()) {
        params.search = search.trim();
      }

      const data = await api.routes.listRoutes(params);
      setRoutes(data);
    } catch (err) {
      console.error('Failed to fetch routes:', err);
      setError('Failed to load routes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calculate statistics from routes
   */
  const calculateStats = () => {
    const totalRoutes = routes.length;
    const completedRoutes = routes.filter(r => r.status === 'completed').length;
    const inProgressRoutes = routes.filter(r => r.status === 'in_progress').length;

    const totalDistance = routes.reduce((sum, r) => sum + (r.total_distance_km || 0), 0);
    const totalDeliveries = routes.reduce((sum, r) => sum + (r.delivery_count || 0), 0);
    const completedDeliveries = routes.reduce((sum, r) => sum + (r.completed_deliveries || 0), 0);

    return {
      totalRoutes,
      completedRoutes,
      inProgressRoutes,
      totalDistance: totalDistance.toFixed(1),
      totalDeliveries,
      completedDeliveries,
      completionRate: totalDeliveries > 0
        ? ((completedDeliveries / totalDeliveries) * 100).toFixed(0)
        : 0
    };
  };

  const stats = calculateStats();

  /**
   * Get status badge styling
   */
  const getStatusBadge = (status) => {
    const badges = {
      draft: 'badge-gray',
      optimized: 'badge-primary',
      assigned: 'badge-warning',
      in_progress: 'badge-warning',
      completed: 'badge-success',
      cancelled: 'badge-danger'
    };

    return badges[status] || 'badge-gray';
  };

  /**
   * Get status label
   */
  const getStatusLabel = (status) => {
    const labels = {
      draft: 'Draft',
      optimized: 'Optimized',
      assigned: 'Assigned',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled'
    };

    return labels[status] || status;
  };

  /**
   * Handle route deletion
   */
  const handleDelete = async (routeId) => {
    if (!confirm('Are you sure you want to delete this route?')) {
      return;
    }

    setDeleting(routeId);

    try {
      await api.routes.deleteRoute(routeId);

      // Remove from list
      setRoutes(routes.filter(r => r.route_id !== routeId));

      // Show success message
      alert('Route deleted successfully');
    } catch (err) {
      console.error('Failed to delete route:', err);
      alert(err.response?.data?.detail || 'Failed to delete route');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {driver?.full_name}!
          </h1>
          <p className="text-gray-600 mt-1">
            Manage your delivery routes and track performance
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Routes */}
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Routes</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {stats.totalRoutes}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-primary-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Completed Routes */}
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    {stats.completedRoutes}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Total Distance */}
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Distance</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {stats.totalDistance}<span className="text-lg text-gray-600 ml-1">km</span>
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Completion Rate */}
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {stats.completionRate}<span className="text-lg text-gray-600 ml-1">%</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.completedDeliveries}/{stats.totalDeliveries} deliveries
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Analytics */}
            <Link
              to="/analytics"
              className="card group hover:shadow-lg transition-all hover:scale-105 cursor-pointer"
            >
              <div className="card-body text-center">
                <div className="w-14 h-14 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">Analytics</h3>
                <p className="text-sm text-gray-500 mt-1">View reports & charts</p>
                <div className="flex items-center justify-center gap-1 mt-2 text-primary-600 text-sm font-medium">
                  Open <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>

            {/* Customers */}
            <Link
              to="/customers"
              className="card group hover:shadow-lg transition-all hover:scale-105 cursor-pointer"
            >
              <div className="card-body text-center">
                <div className="w-14 h-14 mx-auto bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">Customers</h3>
                <p className="text-sm text-gray-500 mt-1">Manage customer database</p>
                <div className="flex items-center justify-center gap-1 mt-2 text-primary-600 text-sm font-medium">
                  Open <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>

            {/* Depots */}
            <Link
              to="/depots"
              className="card group hover:shadow-lg transition-all hover:scale-105 cursor-pointer"
            >
              <div className="card-body text-center">
                <div className="w-14 h-14 mx-auto bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Warehouse className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">Depots</h3>
                <p className="text-sm text-gray-500 mt-1">Warehouse locations</p>
                <div className="flex items-center justify-center gap-1 mt-2 text-primary-600 text-sm font-medium">
                  Open <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>

            {/* Admin Panel - Only shown to admins */}
            {driver?.role === 'admin' ? (
              <Link
                to="/admin"
                className="card group hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-2 border-purple-200"
              >
                <div className="card-body text-center">
                  <div className="w-14 h-14 mx-auto bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Shield className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-semibold text-purple-700">Admin Panel</h3>
                  <p className="text-sm text-gray-500 mt-1">Manage drivers & system</p>
                  <div className="flex items-center justify-center gap-1 mt-2 text-purple-600 text-sm font-medium">
                    Open <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ) : (
              <Link
                to="/profile"
                className="card group hover:shadow-lg transition-all hover:scale-105 cursor-pointer"
              >
                <div className="card-body text-center">
                  <div className="w-14 h-14 mx-auto bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Users className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Profile</h3>
                  <p className="text-sm text-gray-500 mt-1">Your account settings</p>
                  <div className="flex items-center justify-center gap-1 mt-2 text-primary-600 text-sm font-medium">
                    Open <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Routes Section */}
        <div className="card">
          <div className="card-body">
            {/* Header with filters */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-900">Your Routes</h2>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                {/* Search Input */}
                <div className="relative flex items-center">
                  <Search className="absolute left-4 w-4 h-4 text-gray-400 z-10 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search routes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input !pl-11 pr-8 text-sm w-48"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2 text-gray-400 hover:text-gray-600 z-10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="input text-sm"
                >
                  <option value="all">All Routes</option>
                  <option value="optimized">Optimized</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>

                {/* New Route Button */}
                <Link
                  to="/routes/new"
                  className="btn btn-primary whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  New Route
                </Link>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-8 h-8 animate-spin text-primary-600" />
                <span className="ml-3 text-gray-600">Loading routes...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="alert alert-error">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
                <button onClick={fetchRoutes} className="btn btn-sm btn-outline">
                  Retry
                </button>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && routes.length === 0 && (
              <div className="text-center py-12">
                <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No routes yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Create your first optimized delivery route to get started
                </p>
                <Link to="/routes/new" className="btn btn-primary">
                  <Plus className="w-4 h-4" />
                  Create First Route
                </Link>
              </div>
            )}

            {/* Routes List */}
            {!loading && !error && routes.length > 0 && (
              <div className="space-y-4">
                {routes.map((route) => (
                  <div
                    key={route.route_id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {route.route_name}
                          </h3>
                          <span className={`badge ${getStatusBadge(route.status)}`}>
                            {getStatusLabel(route.status)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <p className="font-medium text-gray-700">Created</p>
                            <p>{format(new Date(route.created_at), 'MMM dd, yyyy')}</p>
                          </div>

                          <div>
                            <p className="font-medium text-gray-700">Deliveries</p>
                            <p>
                              {route.completed_deliveries}/{route.delivery_count}
                              {route.delivery_count > 0 && (
                                <span className="text-xs text-gray-500 ml-1">
                                  ({Math.round((route.completed_deliveries / route.delivery_count) * 100)}%)
                                </span>
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="font-medium text-gray-700">Distance</p>
                            <p>{route.total_distance_km?.toFixed(1) || 'N/A'} km</p>
                          </div>

                          <div>
                            <p className="font-medium text-gray-700">Duration</p>
                            <p>{route.total_duration_minutes?.toFixed(0) || 'N/A'} min</p>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 ml-4">
                        <button
                          onClick={() => navigate(`/routes/${route.route_id}`)}
                          className="btn btn-primary btn-sm"
                        >
                          <FileText className="w-4 h-4" />
                          View Details
                        </button>

                        {(route.status === 'draft' || route.status === 'optimized') && (
                          <button
                            onClick={() => handleDelete(route.route_id)}
                            disabled={deleting === route.route_id}
                            className="btn btn-error btn-sm"
                          >
                            {deleting === route.route_id ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;