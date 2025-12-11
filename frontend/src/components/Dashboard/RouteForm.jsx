/**
 * RouteForm Component
 * 
 * Form to create and optimize a new delivery route.
 * Features:
 * - Depot location input
 * - Dynamic delivery points (5-20)
 * - Form validation
 * - Route optimization trigger
 * - Preview on map
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import InteractiveMap from '../Map/InteractiveMap';
import {
    Plus,
    Trash2,
    MapPin,
    Loader,
    AlertCircle,
    Save,
    X
} from 'lucide-react';

const RouteForm = () => {
    const navigate = useNavigate();

    // Form state
    const [routeName, setRouteName] = useState('');
    const [depot, setDepot] = useState({
        location: { latitude: 33.5731, longitude: -7.5898 },
        address: {
            street: 'Boulevard Mohammed V',
            city: 'Casablanca',
            postal_code: '20000',
            country: 'Morocco'
        }
    });

    const [deliveryPoints, setDeliveryPoints] = useState([
        createEmptyPoint()
    ]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showMap, setShowMap] = useState(false);

    /**
     * Create empty delivery point
     */
    function createEmptyPoint() {
        return {
            customer_name: '',
            address: {
                street: '',
                city: 'Casablanca',
                postal_code: '',
                country: 'Morocco'
            },
            location: {
                latitude: 0,
                longitude: 0
            },
            phone: '',
            instructions: '',
            package_count: 1,
            time_window_start: '',
            time_window_end: ''
        };
    }

    /**
     * Add delivery point
     */
    const addDeliveryPoint = () => {
        if (deliveryPoints.length >= 20) {
            alert('Maximum 20 delivery points allowed');
            return;
        }

        setDeliveryPoints([...deliveryPoints, createEmptyPoint()]);
    };

    /**
     * Remove delivery point
     */
    const removeDeliveryPoint = (index) => {
        if (deliveryPoints.length <= 1) {
            alert('At least 1 delivery point is required');
            return;
        }

        const newPoints = deliveryPoints.filter((_, i) => i !== index);
        setDeliveryPoints(newPoints);
    };

    /**
     * Update delivery point
     */
    const updateDeliveryPoint = (index, field, value) => {
        const newPoints = [...deliveryPoints];

        // Handle nested fields (address, location)
        if (field.includes('.')) {
            const [parent, child] = field.split('.');
            newPoints[index][parent][child] = value;
        } else {
            newPoints[index][field] = value;
        }

        setDeliveryPoints(newPoints);
    };

    /**
     * Load sample data
     */
    const loadSampleData = () => {
        if (!confirm('This will replace your current data with sample Moroccan routes. Continue?')) {
            return;
        }

        // Sample Casablanca deliveries
        const samplePoints = [
            {
                customer_name: 'Fatima Zahra Bennani',
                address: {
                    street: '15 Rue Allal Ben Abdellah',
                    city: 'Casablanca',
                    postal_code: '20250',
                    country: 'Morocco'
                },
                location: { latitude: 33.5880, longitude: -7.6114 },
                phone: '+212 662 345678',
                instructions: 'Appartement 3, 2ème étage',
                package_count: 2,
                time_window_start: '14:00',
                time_window_end: '18:00'
            },
            {
                customer_name: 'Mohammed El Amrani',
                address: {
                    street: '45 Avenue Hassan II',
                    city: 'Casablanca',
                    postal_code: '20100',
                    country: 'Morocco'
                },
                location: { latitude: 33.5950, longitude: -7.6187 },
                phone: '+212 661 234567',
                instructions: 'Bureau au rez-de-chaussée',
                package_count: 1,
                time_window_start: '09:00',
                time_window_end: '17:00'
            },
            {
                customer_name: 'Amina Lahlou',
                address: {
                    street: '78 Boulevard Zerktouni',
                    city: 'Casablanca',
                    postal_code: '20300',
                    country: 'Morocco'
                },
                location: { latitude: 33.5844, longitude: -7.6261 },
                phone: '+212 663 456789',
                instructions: 'Villa avec portail vert',
                package_count: 3,
                time_window_start: '10:00',
                time_window_end: '16:00'
            },
            {
                customer_name: 'Youssef Tazi',
                address: {
                    street: '22 Rue Ibn Batouta',
                    city: 'Casablanca',
                    postal_code: '20100',
                    country: 'Morocco'
                },
                location: { latitude: 33.5672, longitude: -7.6019 },
                phone: '+212 664 567890',
                instructions: 'Magasin au coin de la rue',
                package_count: 1,
                time_window_start: '08:00',
                time_window_end: '20:00'
            },
            {
                customer_name: 'Khadija Chafik',
                address: {
                    street: '33 Rue de Fès',
                    city: 'Casablanca',
                    postal_code: '20070',
                    country: 'Morocco'
                },
                location: { latitude: 33.5917, longitude: -7.6024 },
                phone: '+212 665 678901',
                instructions: 'Immeuble blanc, appartement 12',
                package_count: 2,
                time_window_start: '13:00',
                time_window_end: '19:00'
            }
        ];

        setRouteName('Livraisons Casablanca - Sample');
        setDeliveryPoints(samplePoints);
        setShowMap(true);
    };

    /**
     * Validate form
     */
    const validateForm = () => {
        // Route name
        if (!routeName.trim()) {
            return 'Route name is required';
        }

        // Depot
        if (!depot.location.latitude || !depot.location.longitude) {
            return 'Depot coordinates are required';
        }

        // Delivery points
        if (deliveryPoints.length < 5) {
            return 'At least 5 delivery points are required';
        }

        if (deliveryPoints.length > 20) {
            return 'Maximum 20 delivery points allowed';
        }

        // Validate each delivery point
        for (let i = 0; i < deliveryPoints.length; i++) {
            const point = deliveryPoints[i];

            if (!point.customer_name.trim()) {
                return `Delivery point ${i + 1}: Customer name is required`;
            }

            if (!point.address.street.trim()) {
                return `Delivery point ${i + 1}: Street address is required`;
            }

            if (!point.location.latitude || !point.location.longitude) {
                return `Delivery point ${i + 1}: Coordinates are required`;
            }

            if (point.location.latitude === 0 || point.location.longitude === 0) {
                return `Delivery point ${i + 1}: Invalid coordinates (cannot be 0,0)`;
            }
        }

        return null;
    };

    /**
     * Handle form submission
     */
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Prepare request data
            const requestData = {
                route_name: routeName,
                depot_location: depot.location,
                depot_address: depot.address,
                delivery_points: deliveryPoints
            };

            // Call optimization API
            const optimizedRoute = await api.routes.createRoute(requestData);

            // Navigate to route detail page
            navigate(`/routes/${optimizedRoute.route_id}`);
        } catch (err) {
            console.error('Route optimization failed:', err);
            setError(
                err.response?.data?.detail ||
                'Failed to optimize route. Please check your data and try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold text-gray-900">Create New Route</h1>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="btn btn-secondary"
                        >
                            <X className="w-4 h-4" />
                            Cancel
                        </button>
                    </div>
                    <p className="text-gray-600 mt-1">
                        Add delivery points and optimize your route
                    </p>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="alert alert-error mb-6">
                        <AlertCircle className="w-5 h-5" />
                        <span>{error}</span>
                        <button onClick={() => setError(null)}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Form Column */}
                    <div className="lg:col-span-2">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Route Name */}
                            <div className="card">
                                <div className="card-body">
                                    <h3 className="text-lg font-semibold mb-4">Route Information</h3>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Route Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={routeName}
                                            onChange={(e) => setRouteName(e.target.value)}
                                            className="input"
                                            placeholder="e.g., Morning Deliveries - Casablanca"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Depot */}
                            <div className="card">
                                <div className="card-body">
                                    <h3 className="text-lg font-semibold mb-4">Depot Location</h3>

                                    {/* Address Input */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-1">
                                            Address
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={depot.address?.street || ''}
                                                onChange={(e) => setDepot({
                                                    ...depot,
                                                    address: { ...depot.address, street: e.target.value }
                                                })}
                                                className="input flex-1"
                                                placeholder="Enter address (e.g., Boulevard Mohammed V, Casablanca)"
                                            />
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!depot.address?.street) {
                                                        setError('Please enter an address first');
                                                        return;
                                                    }
                                                    setLoading(true);
                                                    setError(null);
                                                    const fullAddress = `${depot.address.street}, ${depot.address.city || 'Morocco'}`;
                                                    const result = await api.geocoding.geocodeAddress(fullAddress);
                                                    if (result) {
                                                        setDepot({
                                                            ...depot,
                                                            location: { latitude: result.lat, longitude: result.lng }
                                                        });
                                                    } else {
                                                        setError('Could not find coordinates for this address');
                                                    }
                                                    setLoading(false);
                                                }}
                                                disabled={loading}
                                                className="btn btn-secondary btn-sm whitespace-nowrap"
                                            >
                                                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                                                Get Coords
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Enter address and click "Get Coords" to auto-fill latitude/longitude
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">
                                                Latitude *
                                            </label>
                                            <input
                                                type="number"
                                                step="0.000001"
                                                value={depot.location.latitude}
                                                onChange={(e) => setDepot({
                                                    ...depot,
                                                    location: { ...depot.location, latitude: parseFloat(e.target.value) || 0 }
                                                })}
                                                className="input"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1">
                                                Longitude *
                                            </label>
                                            <input
                                                type="number"
                                                step="0.000001"
                                                value={depot.location.longitude}
                                                onChange={(e) => setDepot({
                                                    ...depot,
                                                    location: { ...depot.location, longitude: parseFloat(e.target.value) || 0 }
                                                })}
                                                className="input"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Get Address from Coordinates */}
                                    <div className="mt-3">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (!depot.location.latitude || !depot.location.longitude) {
                                                    setError('Please enter coordinates first');
                                                    return;
                                                }
                                                setLoading(true);
                                                setError(null);
                                                const result = await api.geocoding.reverseGeocode(
                                                    depot.location.latitude,
                                                    depot.location.longitude
                                                );
                                                if (result) {
                                                    const addr = result.address;
                                                    setDepot({
                                                        ...depot,
                                                        address: {
                                                            street: addr.road || addr.pedestrian || addr.building || result.display_name.split(',')[0] || '',
                                                            city: addr.city || addr.town || addr.village || 'Unknown',
                                                            postal_code: addr.postcode || '',
                                                            country: addr.country || 'Morocco'
                                                        }
                                                    });
                                                } else {
                                                    setError('Could not find address for these coordinates');
                                                }
                                                setLoading(false);
                                            }}
                                            disabled={loading}
                                            className="btn btn-outline btn-sm"
                                        >
                                            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                                            Get Address from Coordinates
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Delivery Points */}
                            <div className="card">
                                <div className="card-body">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold">
                                            Delivery Points ({deliveryPoints.length}/20)
                                        </h3>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={loadSampleData}
                                                className="btn btn-sm btn-outline"
                                            >
                                                Load Sample
                                            </button>
                                            <button
                                                type="button"
                                                onClick={addDeliveryPoint}
                                                disabled={deliveryPoints.length >= 20}
                                                className="btn btn-sm btn-primary"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Point
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        {deliveryPoints.map((point, index) => (
                                            <div key={index} className="border border-gray-200 rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="font-medium text-gray-900">
                                                        Point {index + 1}
                                                    </h4>
                                                    {deliveryPoints.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeDeliveryPoint(index)}
                                                            className="text-red-600 hover:text-red-700"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium mb-1">
                                                            Customer Name *
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={point.customer_name}
                                                            onChange={(e) => updateDeliveryPoint(index, 'customer_name', e.target.value)}
                                                            className="input text-sm"
                                                            required
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-medium mb-1">
                                                            Phone
                                                        </label>
                                                        <input
                                                            type="tel"
                                                            value={point.phone}
                                                            onChange={(e) => updateDeliveryPoint(index, 'phone', e.target.value)}
                                                            className="input text-sm"
                                                            placeholder="+212 6XX XXX XXX"
                                                        />
                                                    </div>

                                                    <div className="md:col-span-2">
                                                        <label className="block text-xs font-medium mb-1">
                                                            Street Address *
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={point.address.street}
                                                            onChange={(e) => updateDeliveryPoint(index, 'address.street', e.target.value)}
                                                            className="input text-sm"
                                                            required
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-medium mb-1">
                                                            Latitude *
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.000001"
                                                            value={point.location.latitude}
                                                            onChange={(e) => updateDeliveryPoint(index, 'location.latitude', parseFloat(e.target.value))}
                                                            className="input text-sm"
                                                            required
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-medium mb-1">
                                                            Longitude *
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.000001"
                                                            value={point.location.longitude}
                                                            onChange={(e) => updateDeliveryPoint(index, 'location.longitude', parseFloat(e.target.value))}
                                                            className="input text-sm"
                                                            required
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-medium mb-1">
                                                            Packages
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={point.package_count}
                                                            onChange={(e) => updateDeliveryPoint(index, 'package_count', parseInt(e.target.value))}
                                                            className="input text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {deliveryPoints.length < 5 && (
                                        <p className="text-sm text-yellow-600 mt-4">
                                            ⚠️ Minimum 5 delivery points required for optimization
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowMap(!showMap)}
                                    className="btn btn-outline"
                                >
                                    <MapPin className="w-4 h-4" />
                                    {showMap ? 'Hide' : 'Show'} Map
                                </button>

                                <button
                                    type="submit"
                                    disabled={loading || deliveryPoints.length < 5}
                                    className="btn btn-primary"
                                >
                                    {loading ? (
                                        <>
                                            <Loader className="w-4 h-4 animate-spin" />
                                            Optimizing Route...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Optimize Route
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Map Preview Column */}
                    {showMap && (
                        <div className="lg:col-span-1">
                            <div className="card sticky top-20">
                                <div className="card-body">
                                    <h3 className="text-lg font-semibold mb-4">Map Preview</h3>
                                    <div className="h-[600px]">
                                        <InteractiveMap
                                            depot={depot}
                                            deliveryPoints={deliveryPoints.filter(p => p.location.latitude !== 0)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RouteForm;
