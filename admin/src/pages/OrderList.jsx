import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';

function OrderList() {
    const [orders, setOrders] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [editingOrder, setEditingOrder] = useState(null);

    useEffect(() => {
        fetchOrders();
    }, [page, statusFilter]);

    const fetchOrders = () => {
        const statusQuery = statusFilter ? `&status=${statusFilter}` : '';
        fetch(`${API_BASE_URL}/orders?page=${page}&page_size=10${statusQuery}`)
            .then(res => res.json())
            .then(data => {
                setOrders(data.data);
                setTotalPages(Math.ceil(data.total / 10));
            })
            .catch(err => console.error(err));
    };

    const handleDelete = (id) => {
        if (window.confirm('确定要删除这个订单吗？')) {
            fetch(`${API_BASE_URL}/orders/${id}`, { method: 'DELETE' })
                .then(() => fetchOrders())
                .catch(err => console.error(err));
        }
    };

    const handleUpdate = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/orders/${editingOrder.ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingOrder)
        })
            .then(res => res.json())
            .then(() => {
                setEditingOrder(null);
                fetchOrders();
            })
            .catch(err => console.error(err));
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold tracking-tight">订单列表</h2>
                <Link to="/create-order" className="btn-primary">
                    + 新建订单
                </Link>
            </div>

            {/* Filter */}
            <div className="mb-6 flex justify-end">
                <div className="relative">
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
                        className="appearance-none p-2 pr-8 border-b border-gray-300 outline-none focus:border-red-700 bg-transparent text-sm cursor-pointer transition-colors"
                    >
                        <option value="">全部状态</option>
                        <option value="待下料">待下料</option>
                        <option value="下料">下料</option>
                        <option value="裁面">裁面</option>
                        <option value="封面">封面</option>
                        <option value="已完成">已完成</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="border-t border-gray-100">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white border-b border-gray-200">
                        <tr>
                            <th className="p-4 font-normal text-xs text-gray-400 uppercase tracking-widest">ID</th>
                            <th className="p-4 font-normal text-xs text-gray-400 uppercase tracking-widest">客户</th>
                            <th className="p-4 font-normal text-xs text-gray-400 uppercase tracking-widest">产品</th>
                            <th className="p-4 font-normal text-xs text-gray-400 uppercase tracking-widest">状态</th>
                            <th className="p-4 font-normal text-xs text-gray-400 uppercase tracking-widest">金额</th>
                            <th className="p-4 font-normal text-xs text-gray-400 uppercase tracking-widest">二维码</th>
                            <th className="p-4 font-normal text-xs text-gray-400 uppercase tracking-widest">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {orders.map(order => (
                            <tr key={order.ID} className="hover:bg-gray-50 transition-colors group">
                                <td className="p-4 text-sm font-mono text-gray-500">{order.ID}</td>
                                <td className="p-4 font-medium text-gray-900">{order.customer_name}</td>
                                <td className="p-4 text-sm text-gray-600">
                                    {order.products && order.products.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {order.products.map(p => (
                                                <span key={p.ID} className="bg-gray-100 text-gray-600 px-2 py-1 text-[10px] border border-gray-200 uppercase tracking-wider">{p.name}</span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-gray-300">-</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <span className={`px-3 py-1 text-[10px] border uppercase tracking-wider ${order.status === '已完成' ? 'border-black text-black' :
                                        order.status === '待下料' ? 'border-gray-300 text-gray-400 dashed' :
                                            'border-red-700 text-red-700'
                                        }`}>
                                        {order.status}
                                    </span>
                                </td>
                                <td className="p-4 font-mono text-gray-900">¥{order.amount.toLocaleString()}</td>
                                <td className="p-4">
                                    <div className="opacity-50 group-hover:opacity-100 transition-opacity">
                                        <QRCodeSVG value={order.qr_code} size={32} />
                                    </div>
                                    <div className="text-[10px] text-gray-300 mt-1 font-mono group-hover:text-gray-500">{order.qr_code}</div>
                                </td>
                                <td className="p-4 space-x-4">
                                    <button onClick={() => setEditingOrder(order)} className="text-gray-400 hover:text-black text-sm transition-colors border-b border-transparent hover:border-black pb-0.5">编辑</button>
                                    <button onClick={() => handleDelete(order.ID)} className="text-gray-400 hover:text-red-700 text-sm transition-colors border-b border-transparent hover:border-red-700 pb-0.5">删除</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 flex justify-between items-center border-t border-gray-100 mt-4">
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

            {/* Edit Modal */}
            {editingOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-lg shadow-2xl w-96 max-w-full">
                        <h3 className="text-xl font-bold mb-6">编辑订单</h3>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">客户</label>
                                <input
                                    type="text"
                                    value={editingOrder.customer_name}
                                    onChange={e => setEditingOrder({ ...editingOrder, customer_name: e.target.value })}
                                    className="w-full p-2 border rounded outline-none focus:border-black transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">金额</label>
                                <input
                                    type="number"
                                    value={editingOrder.amount}
                                    onChange={e => setEditingOrder({ ...editingOrder, amount: parseFloat(e.target.value) })}
                                    className="w-full p-2 border rounded outline-none focus:border-black transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">备注</label>
                                <textarea
                                    value={editingOrder.remark}
                                    onChange={e => setEditingOrder({ ...editingOrder, remark: e.target.value })}
                                    className="w-full p-2 border rounded outline-none focus:border-black transition-colors"
                                    rows="3"
                                />
                            </div>
                            <div className="flex justify-end space-x-2 pt-4">
                                <button type="button" onClick={() => setEditingOrder(null)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">取消</button>
                                <button type="submit" className="px-4 py-2 bg-black text-white rounded hover:opacity-80">保存</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default OrderList;
