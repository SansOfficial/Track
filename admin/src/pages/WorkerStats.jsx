import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

function WorkerStats() {
    const { fetchWithAuth } = useAuth();
    const [stats, setStats] = useState({
        worker_totals: [],
        daily_work: [],
        station_work: [],
        recent_logs: [],
        date_range: { start: '', end: '' }
    });
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [selectedWorker, setSelectedWorker] = useState('');

    const fetchStats = () => {
        let url = `${API_BASE_URL}/workers/stats?start_date=${startDate}&end_date=${endDate}`;
        if (selectedWorker) url += `&worker_id=${selectedWorker}`;

        fetchWithAuth(url)
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(err => console.error(err));
    };

    useEffect(() => {
        fetchStats();
    }, [startDate, endDate, selectedWorker]);

    const totalWork = stats.worker_totals.reduce((sum, w) => sum + w.count, 0);

    return (
        <div className="space-y-6">
            {/* 页面标题和日期选择 */}
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold">工作量统计</h2>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-500">开始</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded focus:border-black outline-none"
                        />
                    </div>
                    <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-500">结束</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded focus:border-black outline-none"
                        />
                    </div>
                    {selectedWorker && (
                        <button
                            onClick={() => setSelectedWorker('')}
                            className="px-3 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 text-sm"
                        >
                            清除筛选
                        </button>
                    )}
                </div>
            </div>

            {/* 汇总卡片 */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
                    <div className="text-3xl font-bold text-black">{totalWork}</div>
                    <div className="text-sm text-gray-500 mt-1">总处理量</div>
                </div>
                <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
                    <div className="text-3xl font-bold text-blue-600">{stats.worker_totals.length}</div>
                    <div className="text-sm text-gray-500 mt-1">参与工人数</div>
                </div>
                <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
                    <div className="text-3xl font-bold text-green-600">
                        {stats.worker_totals.length > 0 ? Math.round(totalWork / stats.worker_totals.length) : 0}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">人均处理量</div>
                </div>
                <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
                    <div className="text-3xl font-bold text-purple-600">{stats.station_work.length}</div>
                    <div className="text-sm text-gray-500 mt-1">活跃工位</div>
                </div>
            </div>

            {/* 图表区域 */}
            <div className="grid grid-cols-2 gap-6">
                {/* 每日工作量 */}
                <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-4 border-l-4 border-red-700 pl-3">每日工作量</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.daily_work}>
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 工位分布 */}
                <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-4 border-l-4 border-teal-600 pl-3">工位分布</h3>
                    <div className="h-64 flex items-center justify-center">
                        {stats.station_work.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.station_work}
                                        dataKey="count"
                                        nameKey="station"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        label={({ station, count }) => `${station}: ${count}`}
                                    >
                                        {stats.station_work.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <span className="text-gray-400">暂无数据</span>
                        )}
                    </div>
                </div>
            </div>

            {/* 工人排行榜 */}
            <div className="bg-white rounded shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold border-l-4 border-yellow-500 pl-3">工人排行榜</h3>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">排名</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">姓名</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">工位</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">处理量</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">占比</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {stats.worker_totals.map((worker, index) => (
                            <tr key={worker.worker_id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                            index === 1 ? 'bg-gray-200 text-gray-700' :
                                                index === 2 ? 'bg-orange-100 text-orange-700' :
                                                    'bg-gray-100 text-gray-500'
                                        }`}>
                                        {index + 1}
                                    </span>
                                </td>
                                <td className="p-4 font-bold text-gray-900">{worker.worker_name}</td>
                                <td className="p-4">
                                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                                        {worker.station}
                                    </span>
                                </td>
                                <td className="p-4 font-mono text-lg">{worker.count}</td>
                                <td className="p-4">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-red-700 rounded-full"
                                                style={{ width: `${totalWork > 0 ? (worker.count / totalWork * 100) : 0}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            {totalWork > 0 ? (worker.count / totalWork * 100).toFixed(1) : 0}%
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <button
                                        onClick={() => setSelectedWorker(worker.worker_id.toString())}
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        查看详情
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {stats.worker_totals.length === 0 && (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-gray-400 text-sm">
                                    该时间段内暂无工作记录
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default WorkerStats;
