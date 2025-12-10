/**
 * Header Component
 * 
 * Main navigation header with:
 * - Logo and branding
 * - Navigation links
 * - User profile dropdown
 * - Logout functionality
 * - Mobile responsive menu
 */

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Menu,
  X,
  Map,
  Plus,
  User,
  LogOut,
  Truck,
  LayoutDashboard,
  BarChart3,
  Users,
  Warehouse,
  Shield,
  ChevronDown
} from 'lucide-react';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const { driver, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = driver?.role === 'admin';

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  /**
   * Check if route is active
   */
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  /**
   * Main navigation links
   */
  const mainNavLinks = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard
    },
    {
      path: '/routes/new',
      label: 'New Route',
      icon: Plus
    },
    {
      path: '/analytics',
      label: 'Analytics',
      icon: BarChart3
    }
  ];

  /**
   * More navigation links (in dropdown)
   */
  const moreNavLinks = [
    {
      path: '/customers',
      label: 'Customers',
      icon: Users
    },
    {
      path: '/depots',
      label: 'Depots',
      icon: Warehouse
    }
  ];

  /**
   * Admin-only links
   */
  const adminNavLinks = [
    {
      path: '/admin',
      label: 'Admin Panel',
      icon: Shield
    }
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <div className="bg-primary-600 p-2 rounded-lg">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">
                RouteChain
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          {isAuthenticated && (
            <nav className="hidden md:flex items-center space-x-1">
              {mainNavLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(link.path)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}

              {/* More Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${moreNavLinks.some(l => isActive(l.path))
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  <span>More</span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {moreDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMoreDropdownOpen(false)}
                    />
                    <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      {moreNavLinks.map((link) => {
                        const Icon = link.icon;
                        return (
                          <Link
                            key={link.path}
                            to={link.path}
                            className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setMoreDropdownOpen(false)}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{link.label}</span>
                          </Link>
                        );
                      })}

                      {/* Admin link - only for admins */}
                      {isAdmin && (
                        <>
                          <hr className="my-1" />
                          {adminNavLinks.map((link) => {
                            const Icon = link.icon;
                            return (
                              <Link
                                key={link.path}
                                to={link.path}
                                className="flex items-center space-x-2 px-4 py-2 text-sm text-purple-700 hover:bg-purple-50"
                                onClick={() => setMoreDropdownOpen(false)}
                              >
                                <Icon className="w-4 h-4" />
                                <span>{link.label}</span>
                              </Link>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </nav>
          )}

          {/* User Profile & Actions */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center space-x-4">
              {/* Admin Badge */}
              {isAdmin && (
                <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                  Admin
                </span>
              )}

              {/* Driver Info */}
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {driver?.full_name}
                </p>
                <p className="text-xs text-gray-500">
                  {driver?.vehicle_type} • {driver?.license_plate || 'No plate'}
                </p>
              </div>

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                >
                  <User className="w-5 h-5" />
                </button>

                {/* Dropdown Menu */}
                {profileDropdownOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setProfileDropdownOpen(false)}
                    />

                    {/* Menu */}
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <div className="px-4 py-2 border-b border-gray-200">
                        <p className="text-sm font-medium text-gray-900">
                          {driver?.full_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {driver?.email}
                        </p>
                      </div>

                      <Link
                        to="/profile"
                        className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setProfileDropdownOpen(false)}
                      >
                        <User className="w-4 h-4" />
                        <span>Profile Settings</span>
                      </Link>

                      <Link
                        to="/analytics"
                        className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setProfileDropdownOpen(false)}
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>Analytics</span>
                      </Link>

                      {isAdmin && (
                        <Link
                          to="/admin"
                          className="flex items-center space-x-2 px-4 py-2 text-sm text-purple-700 hover:bg-purple-50"
                          onClick={() => setProfileDropdownOpen(false)}
                        >
                          <Shield className="w-4 h-4" />
                          <span>Admin Panel</span>
                        </Link>
                      )}

                      <hr className="my-1" />

                      <button
                        onClick={handleLogout}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Mobile Menu Button */}
          {isAuthenticated && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {isAuthenticated && mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <nav className="px-4 py-2 space-y-1">
            {[...mainNavLinks, ...moreNavLinks].map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium ${isActive(link.path)
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            {/* Admin link for mobile */}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium ${isActive('/admin')
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-purple-700 hover:bg-purple-50'
                  }`}
              >
                <Shield className="w-5 h-5" />
                <span>Admin Panel</span>
              </Link>
            )}
          </nav>

          {/* Mobile User Section */}
          <div className="border-t border-gray-200 px-4 py-3">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    {driver?.full_name}
                  </p>
                  {isAdmin && (
                    <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">Admin</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {driver?.email}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center justify-center space-x-2 w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;