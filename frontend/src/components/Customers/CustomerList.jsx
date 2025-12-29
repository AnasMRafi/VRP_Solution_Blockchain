/**
 * Customers List Component
 * 
 * Manage customer database with CRUD operations.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    Users,
    Plus,
    Search,
    Edit2,
    Trash2,
    MapPin,
    Phone,
    Mail,
    Building,
    Loader,
    AlertCircle,
    ArrowLeft,
    X,
    Save,
    Package
} from 'lucide-react';

const CustomerList = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        address: {
            street: '',
            city: '',
            postal_code: '',
            country: 'Morocco',
            latitude: null,
            longitude: null,
            notes: ''
        },
        notes: ''
    });

    useEffect(() => {
        fetchCustomers();
    }, [search]);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const params = search ? { search } : {};
            const data = await api.customers.list(params);
            setCustomers(data.customers || []);
        } catch (err) {
            console.error('Failed to fetch customers:', err);
            setError('Failed to load customers');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (editingCustomer) {
                await api.customers.update(editingCustomer.customer_id, formData);
            } else {
                await api.customers.create(formData);
            }
            setShowForm(false);
            setEditingCustomer(null);
            resetForm();
            fetchCustomers();
        } catch (err) {
            console.error('Failed to save customer:', err);
            setError(err.response?.data?.detail || 'Failed to save customer');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (customer) => {
        setEditingCustomer(customer);
        setFormData({
            name: customer.name || '',
            email: customer.email || '',
            phone: customer.phone || '',
            company: customer.company || '',
            address: customer.address || {
                street: '',
                city: '',
                postal_code: '',
                country: 'Morocco'
            },
            notes: customer.notes || ''
        });
        setShowForm(true);
    };

    const handleDelete = async (customerId) => {
        if (!confirm('Are you sure you want to delete this customer?')) return;

        try {
            await api.customers.delete(customerId);
            fetchCustomers();
        } catch (err) {
            console.error('Failed to delete customer:', err);
            setError('Failed to delete customer');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            phone: '',
            company: '',
            address: {
                street: '',
                city: '',
                postal_code: '',
                country: 'Morocco'
            },
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
                            <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
                            <p className="text-gray-600 mt-1">Manage your customer database</p>
                        </div>
                    </div>

                    <button
                        onClick={() => { setShowForm(true); setEditingCustomer(null); resetForm(); }}
                        className="btn btn-primary mt-4 sm:mt-0"
                    >
                        <Plus className="w-4 h-4" />
                        Add Customer
                    </button>
                </div>

                {error && !showForm && (
                    <div className="alert alert-error mb-6">
                        <AlertCircle className="w-5 h-5" />
                        <span>{error}</span>
                        <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
                    </div>
                )}

                {/* Search */}
                <div className="mb-6">
                    <div className="relative flex items-center">
                        <Search className="absolute left-4 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search customers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input !pl-12 w-full max-w-md"
                        />
                    </div>
                </div>

                {/* Customer List */}
                {loading && customers.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader className="w-8 h-8 animate-spin text-primary-600" />
                    </div>
                ) : customers.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No customers yet</h3>
                        <p className="text-gray-600 mb-4">Add your first customer to get started</p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="btn btn-primary"
                        >
                            <Plus className="w-4 h-4" />
                            Add Customer
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {customers.map((customer) => (
                            <div key={customer.customer_id} className="card">
                                <div className="card-body">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg">
                                                {customer.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                                                {customer.company && (
                                                    <p className="text-sm text-gray-600 flex items-center gap-1">
                                                        <Building className="w-3 h-3" />
                                                        {customer.company}
                                                    </p>
                                                )}
                                                <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                                                    {customer.email && (
                                                        <span className="flex items-center gap-1">
                                                            <Mail className="w-3 h-3" />
                                                            {customer.email}
                                                        </span>
                                                    )}
                                                    {customer.phone && (
                                                        <span className="flex items-center gap-1">
                                                            <Phone className="w-3 h-3" />
                                                            {customer.phone}
                                                        </span>
                                                    )}
                                                    {customer.address?.city && (
                                                        <span className="flex items-center gap-1">
                                                            <MapPin className="w-3 h-3" />
                                                            {customer.address.city}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-500 flex items-center gap-1">
                                                <Package className="w-4 h-4" />
                                                {customer.delivery_count || 0} deliveries
                                            </span>
                                            <button
                                                onClick={() => handleEdit(customer)}
                                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(customer.customer_id)}
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

                {/* Customer Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold">
                                        {editingCustomer ? 'Edit Customer' : 'Add Customer'}
                                    </h2>
                                    <button
                                        onClick={() => { setShowForm(false); setEditingCustomer(null); setError(null); }}
                                        className="p-2 hover:bg-gray-100 rounded-lg"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Error inside modal */}
                                {error && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        <span>{error}</span>
                                        <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="input w-full"
                                            placeholder="Customer name"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="input w-full"
                                                placeholder="email@example.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                            <input
                                                type="tel"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                className="input w-full"
                                                placeholder="+212 600 000000"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                                        <input
                                            type="text"
                                            value={formData.company}
                                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                            className="input w-full"
                                            placeholder="Company name (optional)"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.address.street}
                                            onChange={(e) => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })}
                                            className="input w-full"
                                            placeholder="123 Main Street"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.address.city}
                                                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                                                className="input w-full"
                                                placeholder="Casablanca"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                                            <input
                                                type="text"
                                                value={formData.address.postal_code}
                                                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, postal_code: e.target.value } })}
                                                className="input w-full"
                                                placeholder="20000"
                                            />
                                        </div>
                                    </div>

                                    {/* GPS Coordinates with Geocoding */}
                                    <div className="bg-blue-50 p-3 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-medium text-gray-700">
                                                <MapPin className="w-4 h-4 inline mr-1" />
                                                GPS Coordinates
                                            </label>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!formData.address.street || !formData.address.city) {
                                                        setError('Please enter street address and city first');
                                                        return;
                                                    }
                                                    setLoading(true);
                                                    setError(null);
                                                    const fullAddress = `${formData.address.street}, ${formData.address.city}, Morocco`;
                                                    try {
                                                        const result = await api.geocoding.geocodeAddress(fullAddress);
                                                        if (result) {
                                                            setFormData({
                                                                ...formData,
                                                                address: {
                                                                    ...formData.address,
                                                                    latitude: result.lat,
                                                                    longitude: result.lng
                                                                }
                                                            });
                                                        } else {
                                                            setError('Could not find coordinates for this address');
                                                        }
                                                    } catch (err) {
                                                        setError('Geocoding failed');
                                                    }
                                                    setLoading(false);
                                                }}
                                                disabled={loading}
                                                className="btn btn-sm btn-secondary"
                                            >
                                                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                                                Get GPS from Address
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={formData.address.latitude || ''}
                                                    onChange={(e) => setFormData({ ...formData, address: { ...formData.address, latitude: parseFloat(e.target.value) || null } })}
                                                    className="input w-full text-sm"
                                                    placeholder="33.5731"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={formData.address.longitude || ''}
                                                    onChange={(e) => setFormData({ ...formData, address: { ...formData.address, longitude: parseFloat(e.target.value) || null } })}
                                                    className="input w-full text-sm"
                                                    placeholder="-7.5898"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Click "Get GPS from Address" to auto-fill coordinates via Nominatim
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            className="input w-full"
                                            rows={3}
                                            placeholder="Additional notes..."
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => { setShowForm(false); setEditingCustomer(null); setError(null); }}
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
                                            {editingCustomer ? 'Update' : 'Create'}
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

export default CustomerList;
