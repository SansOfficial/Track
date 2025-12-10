import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';
import { QRCodeSVG } from 'qrcode.react';

import { useUI } from '../context/UIContext';

import { useAuth } from '../context/AuthContext';

function WorkerManager() {
    const { fetchWithAuth } = useAuth();
    const { toast, confirm } = useUI();
    const [workers, setWorkers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newWorker, setNewWorker] = useState({ name: '', station: '下料', phone: '' });
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [stationFilter, setStationFilter] = useState('');

    const fetchWorkers = () => {
        let url = `${API_BASE_URL}/workers?page=${page}&page_size=5`;
        if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
        if (stationFilter) url += `&station=${encodeURIComponent(stationFilter)}`;

        fetchWithAuth(url)
            .then(res => res.json())
            .then(data => {
                setWorkers(data.data || []);
                setTotalPages(Math.ceil((data.total || 0) / 5));
            })
            .catch(err => {
                console.error(err);
                setWorkers([]);
            });
    };

    useEffect(() => {
        const timer = setTimeout(fetchWorkers, 300);
        return () => clearTimeout(timer);
    }, [page, searchQuery, stationFilter]);

    // ... redefine logic ... (Skipping comments for conciseness)

    const openModal = (worker = null) => {
        if (worker) {
            setNewWorker(worker);
        } else {
            setNewWorker({ name: '', station: '下料', phone: '' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setNewWorker({ name: '', station: '下料', phone: '' });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const url = newWorker.ID
            ? `${API_BASE_URL}/workers/${newWorker.ID}`
            : `${API_BASE_URL}/workers`;

        const method = newWorker.ID ? 'PUT' : 'POST';

        fetchWithAuth(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newWorker)
        })
            .then(async res => {
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || '操作失败');
                }
                return data;
            })
            .then(() => {
                toast.success(newWorker.ID ? '工人更新成功' : '工人添加成功');
                closeModal();
                if (!newWorker.ID) setPage(1);
                fetchWorkers();
            })
            .catch(err => {
                console.error(err);
                toast.error(err.message || '操作失败');
            });
    };

    const handleDelete = async (id) => {
        const confirmed = await confirm(`确定要删除工人 ${id} 吗？`);
        if (!confirmed) return;

        fetchWithAuth(`${API_BASE_URL}/workers/${id}`, { method: 'DELETE' })
            .then(() => {
                toast.success('工人删除成功！');
                fetchWorkers();
            })
            .catch(err => {
                console.error(err);
                toast.error('工人删除失败。');
            });
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">工人管理</h2>
                <div className="flex space-x-4">
                    <select
                        value={stationFilter}
                        onChange={(e) => { setStationFilter(e.target.value); setPage(1); }}
                        className="p-2 border border-gray-300 rounded-none focus:border-black outline-none transition-colors"
                    >
                        <option value="">所有工位</option>
                        <option value="下料">下料</option>
                        <option value="裁面">裁面</option>
                        <option value="封面">封面</option>
                        <option value="送货">送货</option>
                    </select>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="搜索姓名/电话..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-none focus:border-black outline-none transition-colors w-64"
                        />
                        <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="bg-white text-black px-6 py-2 rounded-none border border-black hover:border-black hover:border-b-4 hover:border-b-red-700 transition-all duration-300 inline-flex items-center justify-center text-sm font-medium group"
                    >
                        <span className="mr-2 group-hover:text-red-700 transition-colors">+</span> 添加工人
                    </button>
                </div>
            </div>

            <div className="bg-white rounded shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">姓名</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">工位</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">电话</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">OpenID</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">登录二维码</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {workers.map(worker => (
                            <tr key={worker.ID} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4 font-bold text-gray-900">{worker.name}</td>
                                <td className="p-4">
                                    <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">
                                        {worker.station}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-500 font-mono text-sm">{worker.phone}</td>
                                <td className="p-4 text-gray-400 font-mono text-xs truncate max-w-[100px]" title={worker.openid}>
                                    {worker.openid || '-'}
                                </td>
                                <td className="p-4">
                                    <div className="bg-white p-1 border rounded inline-block">
                                        <QRCodeSVG value={JSON.stringify({ type: 'login', id: worker.ID })} size={40} />
                                    </div>
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    <button
                                        onClick={() => openModal(worker)}
                                        className="text-gray-400 hover:text-black transition-colors p-1 rounded hover:bg-gray-100"
                                        title="编辑"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(worker.ID)}
                                        className="text-gray-400 hover:text-red-700 transition-colors p-1 rounded hover:bg-gray-100"
                                        title="删除"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {workers.length === 0 && (
                            <tr>
                                <td colSpan="5" className="p-8 text-center text-gray-400 text-sm">暂无工人数据</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {/* Pagination - Reuse or simplify? Keeping basic pagination from before */}
                {totalPages > 1 && (
                    <div className="p-4 flex justify-between items-center border-t border-gray-100">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="px-4 py-2 text-sm text-gray-500 hover:text-black disabled:opacity-30 transition-colors"
                        >
                            ← 上一页
                        </button>
                        <span className="text-xs text-gray-400 font-mono tracking-widest">{page} / {totalPages}</span>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="px-4 py-2 text-sm text-gray-500 hover:text-black disabled:opacity-30 transition-colors"
                        >
                            下一页 →
                        </button>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md p-6 rounded shadow-2xl animate-scale-in">
                        <h3 className="text-xl font-bold mb-6">{newWorker.ID ? '编辑工人' : '添加新工人'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">姓名</label>
                                <input
                                    type="text"
                                    value={newWorker.name}
                                    onChange={e => setNewWorker({ ...newWorker, name: e.target.value })}
                                    required
                                    className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">工位 (Station)</label>
                                <select
                                    value={newWorker.station}
                                    onChange={e => setNewWorker({ ...newWorker, station: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors"
                                >
                                    <option value="下料">下料</option>
                                    <option value="裁面">裁面</option>
                                    <option value="封面">封面</option>
                                    <option value="送货">送货</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">电话</label>
                                <input
                                    type="text"
                                    value={newWorker.phone}
                                    onChange={e => setNewWorker({ ...newWorker, phone: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">OpenID</label>
                                <input
                                    type="text"
                                    value={newWorker.openid || ''}
                                    onChange={e => setNewWorker({ ...newWorker, openid: e.target.value })}
                                    placeholder="可选，通常由系统自动绑定"
                                    className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors font-mono text-xs"
                                />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 mt-6">
                                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-500 hover:text-black transition-colors">取消</button>
                                <button type="submit" className="bg-black text-white px-6 py-2 hover:bg-gray-800 transition-colors">{newWorker.ID ? '保存更改' : '确认添加'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WorkerManager;
