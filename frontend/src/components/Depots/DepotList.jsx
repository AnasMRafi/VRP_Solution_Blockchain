/**
 * Depots List Component
 * 
 * Manage depot/warehouse locations.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    Warehouse,
    Plus,
    MapPin,
    Phone,
    Clock,
    Star,
    Edit2,
    Trash2,
    Loader,
    AlertCircle,
    ArrowLeft,
    X,
    Save,
    CheckCircle
} from 'lucide-react';

const DepotList = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [depots, setDepots] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingDepot, setEditingDepot] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        location: {
            latitude: '',
            longitude: '',
            address: ''
        },
        is_default: false,
        capacity: '',
        operating_hours: '',
        contact_phone: '',
        notes: ''
    });

    useEffect(() => {
        fetchDepots();
    }, []);

    const fetchDepots = async () => {
        setLoading(true);
        try {
            const data = await api.depots.list();
            setDepots(data || []);
        } catch (err) {
            console.error('Failed to fetch depots:', err);
            setError('Failed to load depots');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const submitData = {
            ...formData,
            location: {
                ...formData.location,
                latitude: parseFloat(formData.location.latitude) || 0,
                longitude: parseFloat(formData.location.longitude) || 0
            },
            capacity: formData.capacity ? parseInt(formData.capacity) : null
        };

        try {
            if (editingDepot) {
                await api.depots.update(editingDepot.depot_id, submitData);
            } else {
                await api.depots.create(submitData);
            }
            setShowForm(false);
            setEditingDepot(null);
            resetForm();
            fetchDepots();
        } catch (err) {
            console.error('Failed to save depot:', err);
            setError(err.response?.data?.detail || 'Failed to save depot');
        } finally {
            setLoading(false);
        }
    };

    const handleSetDefault = async (depotId) => {
        try {
            await api.depots.setDefault(depotId);
            fetchDepots();
        } catch (err) {
            console.error('Failed to set default depot:', err);
            setError('Failed to set default depot');
        }
    };

    const handleDelete = async (depotId) => {
        if (!confirm('Are you sure you want to delete this depot?')) return;

        try {
            await api.depots.delete(depotId);
            fetchDepots();
        } catch (err) {
            console.error('Failed to delete depot:', err);
            setError('Failed to delete depot');
        }
    };

    const handleEdit = (depot) => {
        setEditingDepot(depot);
        setFormData({
            name: depot.name || '',
            location: {
                latitude: depot.location?.latitude || '',
                longitude: depot.location?.longitude || '',
                address: depot.location?.address || ''
            },
            is_default: depot.is_default || false,
            capacity: depot.capacity || '',
            operating_hours: depot.operating_hours || '',
            contact_phone: depot.contact_phone || '',
            notes: depot.notes || ''
        });
        setShowForm(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            location: { latitude: '', longitude: '', address: '' },
            is_default: false,
            capacity: '',
            operating_hours: '',
            contact_phone: '',
            notes: ''
        });
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Depots</h1>
                            <p className="text-gray-600 mt-1">Manage your warehouse locations</p>
                        </div>
                    </div>

                    <button
                        onClick={() => { setShowForm(true); setEditingDepot(null); resetForm(); }}
                        className="btn btn-primary mt-4 sm:mt-0"
                    >
                        <Plus className="w-4 h-4" />
                        Add Depot
                    </button>
                </div>

                {error && (
                    <div className="alert alert-error mb-6">
                        <AlertCircle className="w-5 h-5" />
                        <span>{error}</span>
                        <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
                    </div>
                )}

                {/* Depot List */}
                {loading && depots.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader className="w-8 h-8 animate-spin text-primary-600" />
                    </div>
                ) : depots.length === 0 ? (
                    <div className="text-center py-12">
                        <Warehouse className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No depots yet</h3>
                        <p className="text-gray-600 mb-4">Add your first depot to use as route starting point</p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="btn btn-primary"
                        >
                            <Plus className="w-4 h-4" />
                            Add Depot
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {depots.map((depot) => (
                            <div key={depot.depot_id} className={`card ${depot.is_default ? 'ring-2 ring-primary-500' : ''}`}>
                                <div className="card-body">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-3 rounded-xl ${depot.is_default ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-700'}`}>
                                                <Warehouse className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-gray-900">{depot.name}</h3>
                                                    {depot.is_default && (
                                                        <span className="px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="mt-2 space-y-1 text-sm text-gray-500">
                                                    {depot.location?.address && (
                                                        <p className="flex items-center gap-1">
                                                            <MapPin className="w-3 h-3" />
                                                            {depot.location.address}
                                                        </p>
                                                    )}
                                                    {depot.operating_hours && (
                                                        <p className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {depot.operating_hours}
                                                        </p>
                                                    )}
                                                    {depot.contact_phone && (
                                                        <p className="flex items-center gap-1">
                                                            <Phone className="w-3 h-3" />
                                                            {depot.contact_phone}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {!depot.is_default && (
                                                <button
                                                    onClick={() => handleSetDefault(depot.depot_id)}
                                                    className="p-2 hover:bg-primary-50 text-primary-600 rounded-lg transition-colors"
                                                    title="Set as default"
                                                >
                                                    <Star className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleEdit(depot)}
                                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(depot.depot_id)}
                                                className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Depot Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold">
                                        {editingDepot ? 'Edit Depot' : 'Add Depot'}
                                    </h2>
                                    <button
                                        onClick={() => { setShowForm(false); setEditingDepot(null); }}
                                        className="p-2 hover:bg-gray-100 rounded-lg"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="input w-full"
                                            placeholder="Main Warehouse"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                        <input
                                            type="text"
                                            value={formData.location.address}
                                            onChange={(e) => setFormData({ ...formData, location: { ...formData.location, address: e.target.value } })}
                                            className="input w-full"
                                            placeholder="123 Industrial Zone"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Latitude *</label>
                                            <input
                                                type="number"
                                                step="any"
                                                required
                                                value={formData.location.latitude}
                                                onChange={(e) => setFormData({ ...formData, location: { ...formData.location, latitude: e.target.value } })}
                                                className="input w-full"
                                                placeholder="33.5731"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Longitude *</label>
                                            <input
                                                type="number"
                                                step="any"
                                                required
                                                value={formData.location.longitude}
                                                onChange={(e) => setFormData({ ...formData, location: { ...formData.location, longitude: e.target.value } })}
                                                className="input w-full"
                                                placeholder="-7.5898"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Operating Hours</label>
                                            <input
                                                type="text"
                                                value={formData.operating_hours}
                                                onChange={(e) => setFormData({ ...formData, operating_hours: e.target.value })}
                                                className="input w-full"
                                                placeholder="08:00-18:00"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                                            <input
                                                type="tel"
                                                value={formData.contact_phone}
                                                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                                                className="input w-full"
                                                placeholder="+212 500 000000"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="is_default"
                                            checked={formData.is_default}
                                            onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                                            className="w-4 h-4 text-primary-600"
                                        />
                                        <label htmlFor="is_default" className="text-sm text-gray-700">
                                            Set as default depot
                                        </label>
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => { setShowForm(false); setEditingDepot(null); }}
                                            className="btn btn-secondary flex-1"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="btn btn-primary flex-1"
                                        >
                                            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            {editingDepot ? 'Update' : 'Create'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DepotList;
