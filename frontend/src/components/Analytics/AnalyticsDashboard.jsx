/**
 * Analytics Dashboard Component
 * 
 * Shows performance metrics, charts, and trends for route analytics.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    Package,
    MapPin,
    Clock,
    CheckCircle,
    XCircle,
    Calendar,
    Users,
    Loader,
    AlertCircle,
    ArrowLeft,
    RefreshCw
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    Legend
} from 'recharts';

const AnalyticsDashboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState(30);

    // Analytics data
    const [summary, setSummary] = useState(null);
    const [statusData, setStatusData] = useState([]);
    const [timeData, setTimeData] = useState([]);
    const [performance, setPerformance] = useState(null);
    const [topCustomers, setTopCustomers] = useState([]);

    useEffect(() => {
        fetchAnalytics();
    }, [period]);

    const fetchAnalytics = async () => {
        setLoading(true);
        setError(null);

        try {
            const [summaryRes, statusRes, timeRes, perfRes, customersRes] = await Promise.all([
                api.analytics.getSummary(period),
                api.analytics.getRoutesByStatus(period),
                api.analytics.getRoutesOverTime(period),
                api.analytics.getPerformance(),
                api.analytics.getTopCustomers(5)
            ]);

            setSummary(summaryRes);
            setStatusData(statusRes.data || []);
            setTimeData(timeRes.data || []);
            setPerformance(perfRes);
            setTopCustomers(customersRes.top_customers || []);
        } catch (err) {
            console.error('Failed to fetch analytics:', err);
            setError('Failed to load analytics data');
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ icon: Icon, title, value, subValue, trend, color = 'primary' }) => {
        const colorClasses = {
            primary: 'text-primary-600 bg-primary-50',
            green: 'text-green-600 bg-green-50',
            blue: 'text-blue-600 bg-blue-50',
            purple: 'text-purple-600 bg-purple-50',
            amber: 'text-amber-600 bg-amber-50'
        };

        return (
            <div className="card">
                <div className="card-body">
                    <div className="flex items-center justify-between">
                        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
                            <Icon className="w-6 h-6" />
                        </div>
                        {trend !== undefined && (
                            <div className={`flex items-center gap-1 text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                {Math.abs(trend)}%
                            </div>
                        )}
                    </div>
                    <div className="mt-4">
                        <p className="text-2xl font-bold text-gray-900">{value}</p>
                        <p className="text-sm text-gray-600">{title}</p>
                        {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
                            <p className="text-gray-600 mt-1">Track your delivery performance</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-4 sm:mt-0">
                        <select
                            value={period}
                            onChange={(e) => setPeriod(Number(e.target.value))}
                            className="input"
                        >
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                            <option value={365}>Last year</option>
                        </select>

                        <button
                            onClick={fetchAnalytics}
                            className="btn btn-outline"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="alert alert-error mb-6">
                        <AlertCircle className="w-5 h-5" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        icon={MapPin}
                        title="Total Routes"
                        value={summary?.routes?.total || 0}
                        subValue={`${summary?.routes?.completed || 0} completed`}
                        trend={performance?.trends?.routes}
                        color="primary"
                    />
                    <StatCard
                        icon={Package}
                        title="Deliveries"
                        value={summary?.deliveries?.total || 0}
                        subValue={`${summary?.deliveries?.success_rate || 0}% success rate`}
                        trend={performance?.trends?.deliveries}
                        color="green"
                    />
                    <StatCard
                        icon={TrendingUp}
                        title="Distance (km)"
                        value={summary?.distance?.total_km || 0}
                        subValue={`${summary?.distance?.average_per_route_km || 0} km/route avg`}
                        trend={performance?.trends?.distance}
                        color="blue"
                    />
                    <StatCard
                        icon={Clock}
                        title="Total Hours"
                        value={summary?.time?.total_hours || 0}
                        color="purple"
                    />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Routes by Status - Pie Chart */}
                    <div className="card">
                        <div className="card-body">
                            <h3 className="text-lg font-semibold mb-4">Routes by Status</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={statusData.filter(d => d.count > 0)}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="count"
                                            nameKey="status"
                                            label={({ status, count }) => `${status}: ${count}`}
                                        >
                                            {statusData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap justify-center gap-4 mt-4">
                                {statusData.map((item) => (
                                    <div key={item.status} className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <span className="text-sm text-gray-600 capitalize">{item.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Routes Over Time - Line Chart */}
                    <div className="card">
                        <div className="card-body">
                            <h3 className="text-lg font-semibold mb-4">Routes Over Time</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={timeData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(value) => {
                                                const date = new Date(value);
                                                return `${date.getMonth() + 1}/${date.getDate()}`;
                                            }}
                                        />
                                        <YAxis />
                                        <Tooltip
                                            labelFormatter={(value) => new Date(value).toLocaleDateString()}
                                        />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="routes"
                                            stroke="#3b82f6"
                                            name="Routes"
                                            strokeWidth={2}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="deliveries"
                                            stroke="#22c55e"
                                            name="Deliveries"
                                            strokeWidth={2}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Comparison & Top Customers */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Week Comparison */}
                    <div className="card">
                        <div className="card-body">
                            <h3 className="text-lg font-semibold mb-4">This Week vs Last Week</h3>
                            <div className="space-y-4">
                                {performance && (
                                    <>
                                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                            <span className="text-gray-600">Routes Created</span>
                                            <div className="flex items-center gap-4">
                                                <span className="font-semibold">{performance.this_week?.routes || 0}</span>
                                                <span className="text-gray-400">vs</span>
                                                <span className="text-gray-600">{performance.last_week?.routes || 0}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                            <span className="text-gray-600">Routes Completed</span>
                                            <div className="flex items-center gap-4">
                                                <span className="font-semibold">{performance.this_week?.completed || 0}</span>
                                                <span className="text-gray-400">vs</span>
                                                <span className="text-gray-600">{performance.last_week?.completed || 0}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                            <span className="text-gray-600">Deliveries Made</span>
                                            <div className="flex items-center gap-4">
                                                <span className="font-semibold">{performance.this_week?.deliveries || 0}</span>
                                                <span className="text-gray-400">vs</span>
                                                <span className="text-gray-600">{performance.last_week?.deliveries || 0}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                            <span className="text-gray-600">Distance (km)</span>
                                            <div className="flex items-center gap-4">
                                                <span className="font-semibold">{performance.this_week?.distance || 0}</span>
                                                <span className="text-gray-400">vs</span>
                                                <span className="text-gray-600">{performance.last_week?.distance || 0}</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Top Customers */}
                    <div className="card">
                        <div className="card-body">
                            <h3 className="text-lg font-semibold mb-4">Top Customers</h3>
                            {topCustomers.length > 0 ? (
                                <div className="space-y-3">
                                    {topCustomers.map((customer, index) => (
                                        <div
                                            key={customer.customer_id}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${index === 0 ? 'bg-amber-500' :
                                                        index === 1 ? 'bg-gray-400' :
                                                            index === 2 ? 'bg-amber-700' : 'bg-gray-300'
                                                    }`}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{customer.name}</p>
                                                    {customer.company && (
                                                        <p className="text-sm text-gray-500">{customer.company}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-primary-600">{customer.delivery_count}</p>
                                                <p className="text-xs text-gray-500">deliveries</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>No customer data yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
