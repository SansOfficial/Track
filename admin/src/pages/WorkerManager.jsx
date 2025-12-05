import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';
import { QRCodeSVG } from 'qrcode.react';

function WorkerManager() {
    const [workers, setWorkers] = useState([]);
    const [newWorker, setNewWorker] = useState({ name: '', station: '下料', phone: '' });
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchWorkers = () => {
        fetch(`${API_BASE_URL}/workers?page=${page}&page_size=5`)
            .then(res => res.json())
            .then(data => {
                setWorkers(data.data);
                setTotalPages(Math.ceil(data.total / 5));
            })
            .catch(err => console.error(err));
    };

    useEffect(() => {
        fetchWorkers();
    }, [page]);

    const handleSubmit = (e) => {
        e.preventDefault();

        const url = newWorker.ID
            ? `${API_BASE_URL}/workers/${newWorker.ID}`
            : `${API_BASE_URL}/workers`;

        const method = newWorker.ID ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newWorker)
        })
            .then(res => res.json())
            .then(() => {
                setNewWorker({ name: '', station: '下料', phone: '' });
                // If adding, go to page 1. If editing, stay on current page usually, but for simplicity we reload
                if (!newWorker.ID) setPage(1);
                fetchWorkers();
            })
            .catch(err => console.error(err));
    };

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold mb-8">工人管理</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-xl font-bold mb-4 text-gray-700">{newWorker.ID ? '编辑工人' : '添加新工人'}</h3>
                    <form onSubmit={handleSubmit} className="card space-y-4">
                        <div>
                            <label className="block text-gray-700 mb-1">姓名</label>
                            <input type="text" value={newWorker.name} onChange={e => setNewWorker({ ...newWorker, name: e.target.value })} required className="w-full p-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-gray-700 mb-1">工位</label>
                            <select value={newWorker.station} onChange={e => setNewWorker({ ...newWorker, station: e.target.value })} className="w-full p-2 border rounded">
                                <option value="下料">下料</option>
                                <option value="裁面">裁面</option>
                                <option value="封面">封面</option>
                                <option value="送货">送货</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-700 mb-1">手机号</label>
                            <input type="tel" value={newWorker.phone} onChange={e => setNewWorker({ ...newWorker, phone: e.target.value })} className="w-full p-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-gray-700 mb-1">OpenID (可选)</label>
                            <input type="text" value={newWorker.openid || ''} onChange={e => setNewWorker({ ...newWorker, openid: e.target.value })} placeholder="小程序登录页显示的 ID" className="w-full p-2 border rounded font-mono text-xs" />
                        </div>
                        <div className="flex space-x-2">
                            <button type="submit" className="btn-secondary flex-1">{newWorker.ID ? '保存修改' : '添加工人'}</button>
                            {newWorker.ID && <button type="button" onClick={() => setNewWorker({ name: '', station: '下料', phone: '' })} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100">取消</button>}
                        </div>
                    </form>
                </div>

                <div>
                    <h3 className="text-xl font-bold mb-4 text-gray-700">工人列表</h3>
                    <div className="card overflow-hidden p-0 border-t border-gray-100">
                        <table className="w-full text-left">
                            <thead className="bg-white border-b border-gray-200">
                                <tr>
                                    <th className="p-3 font-normal text-xs text-gray-400 uppercase tracking-widest">姓名</th>
                                    <th className="p-3 font-normal text-xs text-gray-400 uppercase tracking-widest">工位</th>
                                    <th className="p-3 font-normal text-xs text-gray-400 uppercase tracking-widest">手机号</th>
                                    <th className="p-3 font-normal text-xs text-gray-400 uppercase tracking-widest">OpenID</th>
                                    <th className="p-3 font-normal text-xs text-gray-400 uppercase tracking-widest">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {workers.map(worker => (
                                    <tr key={worker.ID} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-3 font-medium">{worker.name}</td>
                                        <td className="p-3 text-sm text-gray-600">{worker.station}</td>
                                        <td className="p-3 text-gray-500 font-mono text-xs">{worker.phone}</td>
                                        <td className="p-3 text-xs font-mono text-gray-400 truncate max-w-[100px]" title={worker.openid}>{worker.openid}</td>
                                        <td className="p-3">
                                            <button onClick={() => setNewWorker(worker)} className="text-gray-400 hover:text-black text-sm font-bold transition-colors">编辑</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-4 flex justify-between items-center border-t">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className="px-3 py-1 border rounded disabled:opacity-50"
                            >
                                上一页
                            </button>
                            <span>第 {page} 页 / 共 {totalPages} 页</span>
                            <button
                                disabled={page === totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="px-3 py-1 border rounded disabled:opacity-50"
                            >
                                下一页
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WorkerManager;
