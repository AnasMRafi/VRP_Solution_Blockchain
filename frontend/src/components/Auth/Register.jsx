/**
 * Register Component
 * 
 * Driver registration form with validation.
 * Features:
 * - Form validation
 * - Password strength indicator
 * - Vehicle type selection
 * - Phone number formatting
 * - Auto-login after registration
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { User, Mail, Lock, Phone, Car, Hash, Loader } from 'lucide-react';

const Register = () => {
    // Form state
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        vehicle_type: 'van',
        license_plate: '',
        max_capacity: 20
    });

    const [errors, setErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const { register, loading, error: authError } = useAuth();
    const navigate = useNavigate();

    /**
     * Handle input changes
     * Updates form state and clears related errors
     */
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    /**
     * Validate form data
     * Returns object with error messages
     */
    const validateForm = () => {
        const newErrors = {};

        // Full name validation
        if (!formData.full_name.trim()) {
            newErrors.full_name = 'Full name is required';
        } else if (formData.full_name.length < 2) {
            newErrors.full_name = 'Name must be at least 2 characters';
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!emailRegex.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }

        // Password validation
        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        } else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(formData.password)) {
            newErrors.password = 'Password must contain letters and numbers';
        }

        // Confirm password validation
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        // Phone validation (Moroccan format) - optional
        const cleanPhone = formData.phone.replace(/[\s\-]/g, '');
        if (cleanPhone) {
            const phoneRegex = /^(\+212|0)[5-7]\d{8}$/;
            if (!phoneRegex.test(cleanPhone)) {
                newErrors.phone = 'Invalid Moroccan phone number (e.g., +212 661 234567 or 0661234567)';
            }
        }

        // License plate validation - optional (no validation needed)

        // Capacity validation
        if (formData.max_capacity < 1 || formData.max_capacity > 100) {
            newErrors.max_capacity = 'Capacity must be between 1 and 100';
        }

        return newErrors;
    };

    /**
     * Get password strength
     * Returns: weak, medium, strong
     */
    const getPasswordStrength = () => {
        const password = formData.password;
        if (!password) return null;

        let strength = 0;

        // Length check
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;

        // Complexity checks
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;

        if (strength <= 2) return 'weak';
        if (strength <= 4) return 'medium';
        return 'strong';
    };

    /**
     * Handle form submission
     */
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate form
        const newErrors = validateForm();
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        // Prepare data for API (exclude confirmPassword)
        const { confirmPassword, ...registrationData } = formData;

        // Call register API
        const success = await register(registrationData);

        if (success) {
            // Registration successful, navigate to dashboard
            navigate('/dashboard');
        }
        // If failed, authError will be displayed
    };

    const passwordStrength = getPasswordStrength();

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 p-4">
            <div className="card w-full max-w-2xl">
                <div className="card-body">
                    <h1 className="text-2xl font-bold text-center mb-2">
                        Create Driver Account
                    </h1>
                    <p className="text-center text-gray-600 mb-6">
                        Join RouteChain for optimized delivery routes
                    </p>

                    {/* Display auth error */}
                    {authError && (
                        <div className="alert alert-error mb-4">
                            {authError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Full Name */}
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Full Name *
                            </label>
                            <div className="relative flex items-center">
                                <User className="absolute left-4 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                                <input
                                    type="text"
                                    name="full_name"
                                    value={formData.full_name}
                                    onChange={handleChange}
                                    className={`input !pl-12 ${errors.full_name ? 'input-error' : ''}`}
                                    placeholder="Mohammed El Amrani"
                                />
                            </div>
                            {errors.full_name && (
                                <p className="text-red-600 text-xs mt-1">{errors.full_name}</p>
                            )}
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Email Address *
                            </label>
                            <div className="relative flex items-center">
                                <Mail className="absolute left-4 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className={`input !pl-12 ${errors.email ? 'input-error' : ''}`}
                                    placeholder="driver@routechain.ma"
                                />
                            </div>
                            {errors.email && (
                                <p className="text-red-600 text-xs mt-1">{errors.email}</p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Password *
                            </label>
                            <div className="relative flex items-center">
                                <Lock className="absolute left-4 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className={`input !pl-12 pr-20 ${errors.password ? 'input-error' : ''}`}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-primary-600 hover:text-primary-700"
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>

                            {/* Password strength indicator */}
                            {formData.password && (
                                <div className="mt-2">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${passwordStrength === 'weak'
                                                    ? 'w-1/3 bg-red-500'
                                                    : passwordStrength === 'medium'
                                                        ? 'w-2/3 bg-yellow-500'
                                                        : 'w-full bg-green-500'
                                                    }`}
                                            />
                                        </div>
                                        <span className="text-xs font-medium text-gray-600">
                                            {passwordStrength === 'weak' && 'Weak'}
                                            {passwordStrength === 'medium' && 'Medium'}
                                            {passwordStrength === 'strong' && 'Strong'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {errors.password && (
                                <p className="text-red-600 text-xs mt-1">{errors.password}</p>
                            )}
                            <p className="text-gray-500 text-xs mt-1">
                                Must be at least 8 characters with letters and numbers
                            </p>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Confirm Password *
                            </label>
                            <div className="relative flex items-center">
                                <Lock className="absolute left-4 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className={`input !pl-12 ${errors.confirmPassword ? 'input-error' : ''}`}
                                    placeholder="••••••••"
                                />
                            </div>
                            {errors.confirmPassword && (
                                <p className="text-red-600 text-xs mt-1">{errors.confirmPassword}</p>
                            )}
                        </div>

                        {/* Phone Number */}
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Phone Number (optional)
                            </label>
                            <div className="relative flex items-center">
                                <Phone className="absolute left-4 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className={`input !pl-12 ${errors.phone ? 'input-error' : ''}`}
                                    placeholder="+212 661 234567"
                                />
                            </div>
                            {errors.phone && (
                                <p className="text-red-600 text-xs mt-1">{errors.phone}</p>
                            )}
                        </div>

                        {/* Two column layout for vehicle info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Vehicle Type *
                                </label>
                                <div className="relative flex items-center">
                                    <Car className="absolute left-3 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                                    <select
                                        name="vehicle_type"
                                        value={formData.vehicle_type}
                                        onChange={handleChange}
                                        className="input pl-10 appearance-none bg-white cursor-pointer"
                                        style={{ paddingLeft: '2.5rem' }}
                                    >
                                        <option value="bike">Bike/Motorcycle</option>
                                        <option value="car">Car</option>
                                        <option value="van">Van</option>
                                        <option value="truck">Truck</option>
                                    </select>
                                </div>
                            </div>

                            {/* Max Capacity */}
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Max Capacity (packages) *
                                </label>
                                <input
                                    type="number"
                                    name="max_capacity"
                                    value={formData.max_capacity}
                                    onChange={handleChange}
                                    min="1"
                                    max="100"
                                    className={`input ${errors.max_capacity ? 'input-error' : ''}`}
                                    placeholder="20"
                                />
                                {errors.max_capacity && (
                                    <p className="text-red-600 text-xs mt-1">{errors.max_capacity}</p>
                                )}
                            </div>
                        </div>

                        {/* License Plate */}
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Vehicle License Plate (optional)
                            </label>
                            <div className="relative flex items-center">
                                <Hash className="absolute left-4 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                                <input
                                    type="text"
                                    name="license_plate"
                                    value={formData.license_plate}
                                    onChange={handleChange}
                                    className={`input !pl-12 ${errors.license_plate ? 'input-error' : ''}`}
                                    placeholder="A-12345"
                                />
                            </div>
                            {errors.license_plate && (
                                <p className="text-red-600 text-xs mt-1">{errors.license_plate}</p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary w-full"
                        >
                            {loading ? (
                                <>
                                    <Loader className="w-4 h-4 animate-spin" />
                                    Creating Account...
                                </>
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </form>

                    {/* Login Link */}
                    <p className="text-center text-sm text-gray-600 mt-4">
                        Already have an account?{' '}
                        <Link to="/login" className="text-primary-600 hover:underline font-medium">
                            Login here
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;