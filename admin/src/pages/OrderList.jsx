
import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config';
import { QRCodeSVG } from 'qrcode.react'; // Keep for list display
import { Link } from 'react-router-dom';
import { useUI } from '../context/UIContext';
import { printQRCode, printInvoice } from '../utils/print';

import { useAuth } from '../context/AuthContext';

function OrderList() {
    const { fetchWithAuth } = useAuth();
    const [orders, setOrders] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1); // Keep totalPages for pagination
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);

    // UI Hooks
    const { toast, confirm } = useUI();

    useEffect(() => {
        // Debounce search? Or just search on enter/blur?
        // Let's search on effect change for now, maybe add debounce later if needed.
        // Or simpler: add a search button or search on "Enter". 
        // For standard "filters", usually "Enter" or typing with debounce.
        // Let's implement debounce manually or just use a button for simplicity?
        // Let's use a simple delay or just fetch.
        const timer = setTimeout(() => {
            fetchOrders();
        }, 300);
        return () => clearTimeout(timer);
    }, [page, statusFilter, searchQuery]);

    const fetchOrders = () => {
        let query = `?page=${page}&page_size=10`;
        if (statusFilter) query += `&status=${statusFilter}`;
        if (searchQuery) query += `&q=${encodeURIComponent(searchQuery)}`;

        fetchWithAuth(`${API_BASE_URL}/orders${query}`)
            .then(res => res.json())
            .then(data => {
                if (data && Array.isArray(data.data)) {
                    setOrders(data.data);
                    setTotalPages(Math.ceil((data.total || 0) / 10));
                } else {
                    setOrders([]);
                    setTotalPages(1);
                }
            })
            .catch(err => console.error(err));
    };

    const handleDelete = async (id) => {
        const shouldDelete = await confirm('确定要删除此订单吗？操作无法撤销。');
        if (!shouldDelete) return;

        fetchWithAuth(`${API_BASE_URL}/orders/${id}`, { method: 'DELETE' })
            .then(async res => {
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || '删除失败');
                }
                return res.json();
            })
            .then(() => {
                toast.success('订单已删除');
                fetchOrders();
            })
            .catch(err => {
                console.error(err);
                toast.error(err.message || '删除失败');
            });
    };

    const openEditModal = (order) => {
        setEditingOrder({ ...order }); // Copy to avoid mutation
        setIsEditModalOpen(true);
    };

    const handleUpdate = (e) => {
        e.preventDefault();
        fetchWithAuth(`${API_BASE_URL}/orders/${editingOrder.ID}/details`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...editingOrder,
                amount: parseFloat(editingOrder.amount)
            })
        })
            .then(res => res.json())
            .then(() => {
                toast.success('订单详情更新成功');
                setIsEditModalOpen(false);
                setEditingOrder(null);
                fetchOrders();
            })
            .catch(err => {
                console.error(err);
                toast.error('更新失败');
            });
    };

    // Removed handleUpdate as per instruction to remove editingOrder

    const getStatusBadge = (status) => {
        const colors = {
            '待下料': 'bg-gray-100 text-gray-800',
            '待裁面': 'bg-yellow-100 text-yellow-800',
            '待封面': 'bg-blue-100 text-blue-800',
            '待送货': 'bg-teal-100 text-teal-800',
            '待收款': 'bg-indigo-100 text-indigo-800',
            '已完成': 'bg-green-100 text-green-800'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${colors[status] || 'bg-gray-100'}`}>
                {status}
            </span>
        );
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">订单列表</h2>
                <div className="flex space-x-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="搜索订单号/客户/电话..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-none focus:border-black outline-none transition-colors w-64"
                        />
                        <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <Link to="/create-order" className="bg-white text-black px-6 py-2 rounded-none border border-black hover:border-black hover:border-b-4 hover:border-b-red-700 transition-all duration-300 inline-flex items-center justify-center text-sm font-medium group">
                        <span className="mr-2 group-hover:text-red-700 transition-colors">+</span> 新建订单
                    </Link>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex space-x-4 mb-6 border-b border-gray-100 pb-2 overflow-x-auto">
                {['', '待下料', '待裁面', '待封面', '待送货', '待收款', '已完成'].map(status => (
                    <button
                        key={status}
                        onClick={() => { setStatusFilter(status); setPage(1); }}
                        className={`pb-2 text-sm font-medium transition-colors whitespace-nowrap ${statusFilter === status
                            ? 'text-black border-b-2 border-black'
                            : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        {status === '' ? '全部' : getStatusBadge(status)}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">订单号</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">客户</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">产品</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">二维码</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">金额</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">状态</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {orders.map(order => (
                            <tr key={order.ID} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                    <div className="font-bold text-gray-900 text-xs font-mono">{order.order_no || `ID: ${order.ID}`}</div>
                                    <div className="text-xs text-gray-400 mt-1">ID: #{order.ID}</div>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm font-medium text-gray-900">{order.customer_name}</div>
                                    <div className="text-xs text-gray-400">{order.phone}</div>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm text-gray-900 max-w-[250px] space-y-1">
                                        {order.order_products && order.order_products.length > 0
                                            ? order.order_products.map((op, idx) => (
                                                <div key={idx} className="flex flex-col border-b border-gray-100 last:border-0 pb-0.5 mb-1">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="font-medium">{op.product?.name}</span>
                                                        <span className="text-gray-500 font-mono scale-90">
                                                            {op.length}x{op.width}x{op.height} * {op.quantity}
                                                        </span>
                                                    </div>
                                                    {op.product?.attribute_values && op.product.attribute_values.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-0.5 ml-1">
                                                            {op.product.attribute_values.map((av, i) => (
                                                                <span key={i} className="text-[10px] text-gray-400 bg-gray-50 px-1 rounded">
                                                                    {av.attribute?.name}:{av.value}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                            : <span className="text-gray-400">无明细</span>
                                        }
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">{order.remark}</div>
                                </td>
                                <td className="p-4">
                                    {order.qr_code && (
                                        <div className="w-10 h-10 bg-white p-1 border rounded inline-block">
                                            <QRCodeSVG value={order.qr_code} size={32} />
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 text-sm font-bold">¥{order.amount}</td>
                                <td className="p-4">{getStatusBadge(order.status)}</td>
                                <td className="p-4 text-right space-x-1">
                                    <button
                                        onClick={() => printQRCode(order)}
                                        className="text-gray-400 hover:text-black transition-colors p-1 rounded hover:bg-gray-100"
                                        title="打印标签"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => printInvoice(order)}
                                        className="text-gray-400 hover:text-black transition-colors p-1 rounded hover:bg-gray-100"
                                        title="打印销货清单"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => openEditModal(order)}
                                        className="text-gray-400 hover:text-black transition-colors p-1 rounded hover:bg-gray-100"
                                        title="编辑订单"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(order.ID)}
                                        className="text-gray-400 hover:text-red-700 transition-colors p-1 rounded hover:bg-gray-100"
                                        title="删除订单"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {orders.length === 0 && (
                            <tr>
                                <td colSpan="7" className="p-8 text-center text-gray-400 text-sm">暂无订单数据</td>
                            </tr>
                        )}
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
            {
                isEditModalOpen && editingOrder && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-lg p-6 rounded shadow-2xl animate-scale-in">
                            <h3 className="text-xl font-bold mb-6">编辑订单 #{editingOrder.ID}</h3>
                            <form onSubmit={handleUpdate} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-700 text-sm font-bold mb-2">客户姓名</label>
                                        <input
                                            type="text"
                                            value={editingOrder.customer_name}
                                            onChange={e => setEditingOrder({ ...editingOrder, customer_name: e.target.value })}
                                            className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-700 text-sm font-bold mb-2">联系电话</label>
                                        <input
                                            type="text"
                                            value={editingOrder.phone}
                                            onChange={e => setEditingOrder({ ...editingOrder, phone: e.target.value })}
                                            className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">订单金额 (¥)</label>
                                    <input
                                        type="number"
                                        value={editingOrder.amount}
                                        onChange={e => setEditingOrder({ ...editingOrder, amount: e.target.value })}
                                        className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">规格要求</label>
                                    <textarea
                                        value={editingOrder.specs}
                                        onChange={e => setEditingOrder({ ...editingOrder, specs: e.target.value })}
                                        className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors h-20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">备注</label>
                                    <textarea
                                        value={editingOrder.remark}
                                        onChange={e => setEditingOrder({ ...editingOrder, remark: e.target.value })}
                                        className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors h-16"
                                    />
                                </div>
                                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 mt-6">
                                    <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-black transition-colors">取消</button>
                                    <button type="submit" className="bg-black text-white px-6 py-2 hover:bg-gray-800 transition-colors">保存更改</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

export default OrderList;
