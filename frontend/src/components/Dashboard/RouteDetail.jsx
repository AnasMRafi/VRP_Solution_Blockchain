/**
 * RouteDetail Component
 * 
 * Displays detailed information about an optimized route.
 * Features:
 * - Route information and statistics
 * - Interactive map with optimized route visualization
 * - Delivery points list with status tracking
 * - Route actions (start, complete, delete, export)
 * - Blockchain verification
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import InteractiveMap from '../Map/InteractiveMap';
import {
    ArrowLeft,
    MapPin,
    Loader,
    AlertCircle,
    CheckCircle,
    XCircle,
    Clock,
    Truck,
    Package,
    Navigation,
    Play,
    Square,
    Trash2,
    Download,
    Shield,
    ShieldCheck,
    ShieldAlert,
    FileText,
    RefreshCw,
    User,
    Phone,
    MessageSquare
} from 'lucide-react';

const RouteDetail = () => {
    const { routeId } = useParams();
    const navigate = useNavigate();

    // State
    const [route, setRoute] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);

    // Blockchain verification state
    const [verifying, setVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState(null);

    /**
     * Fetch route details
     */
    const fetchRoute = async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await api.routes.getRoute(routeId);
            setRoute(data);
        } catch (err) {
            console.error('Failed to fetch route:', err);
            setError(
                err.response?.data?.detail ||
                'Failed to load route details'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoute();
    }, [routeId]);

    /**
     * Update route status
     */
    const updateStatus = async (newStatus) => {
        setActionLoading('status');

        try {
            await api.routes.updateStatus(routeId, newStatus);
            await fetchRoute(); // Refresh data
        } catch (err) {
            console.error('Failed to update status:', err);
            alert(err.response?.data?.detail || 'Failed to update route status');
        } finally {
            setActionLoading(null);
        }
    };

    /**
     * Confirm a delivery
     */
    const confirmDelivery = async (pointId) => {
        setActionLoading(`confirm-${pointId}`);

        try {
            await api.routes.confirmDelivery(routeId, {
                point_id: pointId,
                status: 'delivered'
            });
            await fetchRoute(); // Refresh data
        } catch (err) {
            console.error('Failed to confirm delivery:', err);
            alert(err.response?.data?.detail || 'Failed to confirm delivery');
        } finally {
            setActionLoading(null);
        }
    };

    /**
     * Mark delivery as failed
     */
    const failDelivery = async (pointId) => {
        const reason = prompt('Enter failure reason:');
        if (!reason) return;

        setActionLoading(`fail-${pointId}`);

        try {
            await api.routes.confirmDelivery(routeId, {
                point_id: pointId,
                status: 'failed',
                notes: reason
            });
            await fetchRoute(); // Refresh data
        } catch (err) {
            console.error('Failed to mark delivery as failed:', err);
            alert(err.response?.data?.detail || 'Failed to update delivery');
        } finally {
            setActionLoading(null);
        }
    };

    /**
     * Complete the route
     */
    const completeRoute = async () => {
        if (!confirm('Are you sure you want to complete this route? This action cannot be undone.')) {
            return;
        }

        setActionLoading('complete');

        try {
            await api.routes.completeRoute(routeId);
            await fetchRoute(); // Refresh data
        } catch (err) {
            console.error('Failed to complete route:', err);
            alert(err.response?.data?.detail || 'Failed to complete route');
        } finally {
            setActionLoading(null);
        }
    };

    /**
     * Delete the route
     */
    const deleteRoute = async () => {
        if (!confirm('Are you sure you want to delete this route? This action cannot be undone.')) {
            return;
        }

        setActionLoading('delete');

        try {
            await api.routes.deleteRoute(routeId);
            navigate('/dashboard');
        } catch (err) {
            console.error('Failed to delete route:', err);
            alert(err.response?.data?.detail || 'Failed to delete route');
            setActionLoading(null);
        }
    };

    /**
     * Export route as CSV
     */
    const exportCSV = async () => {
        setActionLoading('export-csv');

        try {
            const blob = await api.routes.exportCSV(routeId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `route_${routeId}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Failed to export CSV:', err);
            alert('Failed to export route as CSV');
        } finally {
            setActionLoading(null);
        }
    };

    /**
     * Export route as PDF
     */
    const exportPDF = async () => {
        setActionLoading('export-pdf');

        try {
            const blob = await api.routes.exportPDF(routeId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `route_${routeId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Failed to export PDF:', err);
            alert('Failed to export route as PDF');
        } finally {
            setActionLoading(null);
        }
    };

    /**
     * Verify blockchain integrity
     */
    const verifyBlockchain = async () => {
        setVerifying(true);
        setVerificationResult(null);

        try {
            const result = await api.routes.verifyBlockchain(routeId);
            setVerificationResult(result);
        } catch (err) {
            console.error('Blockchain verification failed:', err);
            setVerificationResult({
                verified: false,
                message: err.response?.data?.detail || 'Verification failed'
            });
        } finally {
            setVerifying(false);
        }
    };

    /**
     * Get status badge styling
     */
    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-800',
            in_progress: 'bg-blue-100 text-blue-800',
            completed: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800'
        };

        return (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || styles.pending}`}>
                {status?.replace('_', ' ').toUpperCase()}
            </span>
        );
    };

    /**
     * Get delivery status icon
     */
    const getDeliveryStatusIcon = (status) => {
        switch (status) {
            case 'delivered':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'failed':
                return <XCircle className="w-5 h-5 text-red-500" />;
            case 'in_transit':
                return <Truck className="w-5 h-5 text-blue-500" />;
            default:
                return <Clock className="w-5 h-5 text-gray-400" />;
        }
    };

    /**
     * Format distance
     */
    const formatDistance = (km) => {
        if (!km && km !== 0) return '—';
        return `${km.toFixed(1)} km`;
    };

    /**
     * Format duration
     */
    const formatDuration = (minutes) => {
        if (!minutes && minutes !== 0) return '—';
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);

        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins} min`;
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Route</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button onClick={() => navigate('/dashboard')} className="btn-primary">
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Not found
    if (!route) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Route Not Found</h2>
                    <p className="text-gray-600 mb-4">The requested route does not exist.</p>
                    <button onClick={() => navigate('/dashboard')} className="btn-primary">
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </button>

                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                {route.route_name || `Route ${route.route_id}`}
                            </h1>
                            <p className="text-gray-600 mt-1">
                                Route ID: {route.route_id}
                            </p>
                        </div>
                        {getStatusBadge(route.status)}
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Route Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Map */}
                        <div className="card">
                            <div className="card-body">
                                <h3 className="text-lg font-semibold mb-4">Route Map</h3>
                                <div className="h-[400px] rounded-lg overflow-hidden border border-gray-200">
                                    <InteractiveMap
                                        depot={{
                                            location: route.depot_location,
                                            address: route.depot_address
                                        }}
                                        deliveryPoints={route.delivery_points || []}
                                        routeGeometry={route.optimization_result?.geometry}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Route Statistics */}
                        <div className="card">
                            <div className="card-body">
                                <h3 className="text-lg font-semibold mb-4">Route Statistics</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                                        <Navigation className="w-6 h-6 text-primary-600 mx-auto mb-2" />
                                        <div className="text-2xl font-bold text-gray-900">
                                            {formatDistance(route.optimization_result?.total_distance_km)}
                                        </div>
                                        <div className="text-sm text-gray-600">Total Distance</div>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                                        <Clock className="w-6 h-6 text-primary-600 mx-auto mb-2" />
                                        <div className="text-2xl font-bold text-gray-900">
                                            {formatDuration(route.optimization_result?.total_duration_minutes)}
                                        </div>
                                        <div className="text-sm text-gray-600">Est. Duration</div>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                                        <Package className="w-6 h-6 text-primary-600 mx-auto mb-2" />
                                        <div className="text-2xl font-bold text-gray-900">
                                            {route.delivery_points?.length || 0}
                                        </div>
                                        <div className="text-sm text-gray-600">Stops</div>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                                        <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                                        <div className="text-2xl font-bold text-gray-900">
                                            {route.delivery_points?.filter(p => p.status === 'delivered').length || 0}
                                        </div>
                                        <div className="text-sm text-gray-600">Completed</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Delivery Points */}
                        <div className="card">
                            <div className="card-body">
                                <h3 className="text-lg font-semibold mb-4">Delivery Points</h3>
                                <div className="space-y-3">
                                    {route.delivery_points?.map((point, index) => (
                                        <div
                                            key={point.point_id || index}
                                            className="border border-gray-200 rounded-lg p-4"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start space-x-3">
                                                    <div className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-semibold">
                                                        {route.optimization_result?.optimized_order?.[index] || index + 1}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-medium text-gray-900">
                                                                {point.customer_name}
                                                            </h4>
                                                            {getDeliveryStatusIcon(point.status)}
                                                        </div>
                                                        <p className="text-sm text-gray-600 mt-1">
                                                            {point.address?.street}, {point.address?.city}
                                                        </p>

                                                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                                            {point.phone && (
                                                                <div className="flex items-center gap-1">
                                                                    <Phone className="w-3 h-3" />
                                                                    {point.phone}
                                                                </div>
                                                            )}
                                                            {point.package_count && (
                                                                <div className="flex items-center gap-1">
                                                                    <Package className="w-3 h-3" />
                                                                    {point.package_count} packages
                                                                </div>
                                                            )}
                                                        </div>

                                                        {point.instructions && (
                                                            <div className="flex items-start gap-1 mt-2 text-sm text-gray-500">
                                                                <MessageSquare className="w-3 h-3 mt-0.5" />
                                                                {point.instructions}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action buttons */}
                                                {route.status === 'in_progress' && point.status === 'pending' && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => confirmDelivery(point.point_id)}
                                                            disabled={actionLoading === `confirm-${point.point_id}`}
                                                            className="btn-sm btn-success"
                                                        >
                                                            {actionLoading === `confirm-${point.point_id}` ? (
                                                                <Loader className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <CheckCircle className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => failDelivery(point.point_id)}
                                                            disabled={actionLoading === `fail-${point.point_id}`}
                                                            className="btn-sm btn-error"
                                                        >
                                                            {actionLoading === `fail-${point.point_id}` ? (
                                                                <Loader className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <XCircle className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Actions & Blockchain */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Route Actions */}
                        <div className="card">
                            <div className="card-body">
                                <h3 className="text-lg font-semibold mb-4">Actions</h3>
                                <div className="space-y-3">
                                    {/* Start Route */}
                                    {(route.status === 'pending' || route.status === 'optimized') && (
                                        <button
                                            onClick={() => updateStatus('in_progress')}
                                            disabled={actionLoading === 'status'}
                                            className="btn btn-primary w-full"
                                        >
                                            {actionLoading === 'status' ? (
                                                <Loader className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Play className="w-4 h-4" />
                                            )}
                                            Start Route
                                        </button>
                                    )}

                                    {/* Complete Route */}
                                    {route.status === 'in_progress' && (
                                        <button
                                            onClick={completeRoute}
                                            disabled={actionLoading === 'complete'}
                                            className="btn btn-success w-full"
                                        >
                                            {actionLoading === 'complete' ? (
                                                <Loader className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <CheckCircle className="w-4 h-4" />
                                            )}
                                            Complete Route
                                        </button>
                                    )}

                                    {/* Cancel Route */}
                                    {['pending', 'optimized', 'in_progress'].includes(route.status) && (
                                        <button
                                            onClick={() => updateStatus('cancelled')}
                                            disabled={actionLoading === 'status'}
                                            className="btn btn-warning w-full"
                                        >
                                            <Square className="w-4 h-4" />
                                            Cancel Route
                                        </button>
                                    )}

                                    <hr className="my-4" />

                                    {/* Export Options */}
                                    <button
                                        onClick={exportCSV}
                                        disabled={actionLoading === 'export-csv'}
                                        className="btn btn-outline w-full"
                                    >
                                        {actionLoading === 'export-csv' ? (
                                            <Loader className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Download className="w-4 h-4" />
                                        )}
                                        Export CSV
                                    </button>

                                    <button
                                        onClick={exportPDF}
                                        disabled={actionLoading === 'export-pdf'}
                                        className="btn btn-outline w-full"
                                    >
                                        {actionLoading === 'export-pdf' ? (
                                            <Loader className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <FileText className="w-4 h-4" />
                                        )}
                                        Export PDF
                                    </button>

                                    <hr className="my-4" />

                                    {/* Delete Route */}
                                    {route.status !== 'in_progress' && (
                                        <button
                                            onClick={deleteRoute}
                                            disabled={actionLoading === 'delete'}
                                            className="btn btn-error w-full"
                                        >
                                            {actionLoading === 'delete' ? (
                                                <Loader className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                            Delete Route
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Blockchain Verification */}
                        <div className="card">
                            <div className="card-body">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-primary-600" />
                                    Blockchain Verification
                                </h3>

                                {route.blockchain_tx_hash ? (
                                    <>
                                        {/* Blockchain info */}
                                        <div className="bg-gray-50 rounded-lg p-3 mb-4">
                                            <div className="text-sm">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-gray-600">Transaction:</span>
                                                    <span className="font-mono text-xs">
                                                        {route.blockchain_tx_hash?.slice(0, 10)}...
                                                    </span>
                                                </div>
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-gray-600">Block:</span>
                                                    <span className="font-mono">{route.blockchain_block}</span>
                                                </div>
                                                {route.data_hash && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Data Hash:</span>
                                                        <span className="font-mono text-xs">
                                                            {route.data_hash?.slice(0, 10)}...
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Verification button */}
                                        <button
                                            onClick={verifyBlockchain}
                                            disabled={verifying}
                                            className="btn-outline w-full"
                                        >
                                            {verifying ? (
                                                <>
                                                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                                                    Verifying...
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw className="w-4 h-4 mr-2" />
                                                    Verify Integrity
                                                </>
                                            )}
                                        </button>

                                        {/* Verification result */}
                                        {verificationResult && (
                                            <div className={`mt-4 p-3 rounded-lg ${verificationResult.verified
                                                ? 'bg-green-50 border border-green-200'
                                                : 'bg-red-50 border border-red-200'
                                                }`}>
                                                <div className="flex items-center gap-2">
                                                    {verificationResult.verified ? (
                                                        <>
                                                            <ShieldCheck className="w-5 h-5 text-green-500" />
                                                            <span className="font-medium text-green-800">
                                                                Data Verified
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ShieldAlert className="w-5 h-5 text-red-500" />
                                                            <span className="font-medium text-red-800">
                                                                Verification Failed
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                <p className="text-sm mt-1 text-gray-600">
                                                    {verificationResult.message}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-4 text-gray-500">
                                        <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">
                                            Route not recorded on blockchain
                                        </p>
                                        <p className="text-xs mt-1">
                                            Blockchain may not be available
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Route Info */}
                        <div className="card">
                            <div className="card-body">
                                <h3 className="text-lg font-semibold mb-4">Route Info</h3>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Created:</span>
                                        <span>{new Date(route.created_at).toLocaleDateString()}</span>
                                    </div>

                                    {route.actual_start_time && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Started:</span>
                                            <span>{new Date(route.actual_start_time).toLocaleTimeString()}</span>
                                        </div>
                                    )}

                                    {route.completed_at && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Completed:</span>
                                            <span>{new Date(route.completed_at).toLocaleTimeString()}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Driver:</span>
                                        <span className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            {route.driver_id}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RouteDetail;