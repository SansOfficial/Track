import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import API_BASE_URL from '../config';

import { useAuth } from '../context/AuthContext';

function Dashboard() {
    const { fetchWithAuth } = useAuth();
    const [stats, setStats] = useState({
        summary: { total: 0, completed: 0, revenue: 0 },
        trend: [],
        status_dist: [],
        top_products: []
    });
    const [period, setPeriod] = useState('week'); // week, month, year

    useEffect(() => {
        fetchWithAuth(`${API_BASE_URL}/dashboard/stats?period=${period}`)
            .then(res => res.json())
            .then(data => {
                setStats({
                    summary: (data && data.summary) || { total: 0, completed: 0, revenue: 0 },
                    trend: (data && Array.isArray(data.trend)) ? data.trend : [],
                    status_dist: (data && Array.isArray(data.status_dist)) ? data.status_dist : [],
                    top_products: (data && Array.isArray(data.top_products)) ? data.top_products : []
                });
            })
            .catch(err => console.error(err));
    }, [period]);

    // Custom Colors for Japanese Minimalist Theme
    const COLORS = ['#000000', '#b91c1c', '#a8a29e', '#57534e', '#d1d5db'];
    // Logic: Black (Completed), Red (Active), Grays (Waiting/Others)

    // Helper to assign color based on status name
    const getStatusColor = (status) => {
        const colorMap = {
            '已完成': '#000000', // Black
            '待下料': '#b91c1c', // Red
            '待裁面': '#c2410c', // Orange
            '待封面': '#b45309', // Amber
            '待送货': '#15803d', // Green
            '待收款': '#0f766e', // Teal
        };
        return colorMap[status] || '#d1d5db'; // Default Gray
    };

    const getPeriodLabel = () => {
        if (period === 'week') return '近7日';
        if (period === 'month') return '近30日';
        if (period === 'year') return '近12个月';
        return '';
    };

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold tracking-tight">仪表盘</h2>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="card">
                    <h3 className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-widest">总订单数</h3>
                    <p className="text-5xl font-bold text-black font-mono">{stats.summary.total}</p>
                </div>
                <div className="card">
                    <h3 className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-widest">已完成</h3>
                    <p className="text-5xl font-bold text-black font-mono">{stats.summary.completed}</p>
                </div>
                <div className="card">
                    <h3 className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-widest">总营收 (¥)</h3>
                    <p className="text-5xl font-bold text-red-700 font-mono">
                        {stats.summary.revenue ? stats.summary.revenue.toLocaleString() : 0}
                    </p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue Trend */}
                <div className="card h-80 flex flex-col relative">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold border-l-4 border-red-700 pl-3">{getPeriodLabel()}营收趋势</h3>
                        <div className="flex space-x-1">
                            {['week', 'month', 'year'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className={`px-3 py-1 text-xs border transition-colors ${period === p
                                        ? 'bg-black text-white border-black'
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                                        }`}
                                >
                                    {p === 'week' ? '本周' : p === 'month' ? '本月' : '全年'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.trend}>
                                <XAxis
                                    dataKey="date"
                                    tickLine={false}
                                    axisLine={{ stroke: '#e5e7eb' }}
                                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                                    interval={period === 'month' ? 4 : 0} // Skip ticks for dense month view
                                    tickFormatter={(value) => {
                                        if (period === 'year') {
                                            return `${value.split('-')[1]}月`;
                                        }
                                        return value;
                                    }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f9fafb' }}
                                    contentStyle={{ border: '1px solid #f3f4f6', boxShadow: 'none', borderRadius: '0px' }}
                                />
                                <Bar dataKey="revenue" name="营收" fill="#b91c1c" radius={[0, 0, 0, 0]} barSize={period === 'month' ? 10 : 20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Distribution */}
                <div className="card h-80 flex flex-col">
                    <h3 className="text-sm font-bold mb-6 border-l-4 border-black pl-3">订单状态分布</h3>
                    <div className="flex-1 w-full flex items-center justify-center text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.status_dist}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {stats.status_dist.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={getStatusColor(entry.name)} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Legend Overlay or Side */}
                        <div className="absolute right-8 top-8 space-y-2 hidden sm:block">
                            {stats.status_dist.map((entry, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getStatusColor(entry.name) }}></div>
                                    <span className="text-xs text-gray-500">{entry.name} ({entry.value})</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Product Sales Section */}
            <div className="card h-80 flex flex-col">
                <h3 className="text-sm font-bold mb-6 border-l-4 border-gray-800 pl-3">产品销量排行 (Top 5)</h3>
                <div className="flex-1 w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={stats.top_products} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tickLine={false}
                                axisLine={false}
                                width={100}
                                tick={{ fill: '#374151', fontSize: 11, fontWeight: 500 }}
                            />
                            <Tooltip
                                cursor={{ fill: '#f9fafb' }}
                                contentStyle={{ border: '1px solid #f3f4f6', boxShadow: 'none', borderRadius: '0px' }}
                            />
                            <Bar dataKey="count" name="销量" fill="#57534e" radius={[0, 4, 4, 0]} barSize={20}>
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="text-center text-gray-300 text-xs font-mono tracking-widest pt-8 uppercase">
                Tatami System • 仪表盘
            </div>
        </div >
    );
}

export default Dashboard;
