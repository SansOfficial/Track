
import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../config';
import { Link } from 'react-router-dom';
import { useUI } from '../context/UIContext';
import { printQRCode, printInvoice } from '../utils/print';
import { useAuth } from '../context/AuthContext';

function OrderList() {
    const { fetchWithAuth } = useAuth();
    const [orders, setOrders] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Batch Selection
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [showBatchActions, setShowBatchActions] = useState(false);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [editOrderItems, setEditOrderItems] = useState([]);
    const [editCurrentItem, setEditCurrentItem] = useState({
        product_id: '',
        length: '',
        width: '',
        height: '',
        quantity: 1,
        unit: '块',
        unit_price: ''
    });

    // Products & Customers for edit modal
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [editSelectedCategory, setEditSelectedCategory] = useState('');
    const [editingItemIndex, setEditingItemIndex] = useState(-1);
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const { toast, confirm } = useUI();

    useEffect(() => {
        fetchWithAuth(`${API_BASE_URL}/categories`)
            .then(res => res.json())
            .then(data => setCategories(Array.isArray(data) ? data : []))
            .catch(err => console.error(err));

        fetchWithAuth(`${API_BASE_URL}/products`)
            .then(res => res.json())
            .then(data => setProducts(data || []))
            .catch(err => console.error(err));

        fetchWithAuth(`${API_BASE_URL}/customers`)
            .then(res => res.json())
            .then(data => setCustomers(data || []))
            .catch(err => console.error(err));
    }, []);

    // 根据类别筛选产品
    const editFilteredProducts = editSelectedCategory
        ? products.filter(p => p.category_id === parseInt(editSelectedCategory))
        : products;

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders();
        }, 300);
        return () => clearTimeout(timer);
    }, [page, pageSize, statusFilter, searchQuery]);

    const fetchOrders = () => {
        let query = `?page=${page}&page_size=${pageSize}`;
        if (statusFilter) query += `&status=${statusFilter}`;
        if (searchQuery) query += `&q=${encodeURIComponent(searchQuery)}`;

        fetchWithAuth(`${API_BASE_URL}/orders${query}`)
            .then(res => res.json())
            .then(data => {
                if (data && Array.isArray(data.data)) {
                    setOrders(data.data);
                    setTotal(data.total || 0);
                    setTotalPages(Math.ceil((data.total || 0) / pageSize));
                } else {
                    setOrders([]);
                    setTotal(0);
                    setTotalPages(1);
                }
                setSelectedIds(new Set()); // Clear selection on fetch
            })
            .catch(err => console.error(err));
    };

    // Selection handlers
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(new Set(orders.map(o => o.ID)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id, checked) => {
        const newSet = new Set(selectedIds);
        if (checked) {
            newSet.add(id);
        } else {
            newSet.delete(id);
        }
        setSelectedIds(newSet);
    };

    const isAllSelected = orders.length > 0 && selectedIds.size === orders.length;

    // Batch operations
    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        const shouldDelete = await confirm(`确定要删除选中的 ${selectedIds.size} 个订单吗？操作无法撤销。`);
        if (!shouldDelete) return;

        let success = 0, fail = 0;
        for (const id of selectedIds) {
            try {
                const res = await fetchWithAuth(`${API_BASE_URL}/orders/${id}`, { method: 'DELETE' });
                if (res.ok) success++;
                else fail++;
            } catch {
                fail++;
            }
        }
        toast.success(`批量删除完成：成功 ${success}，失败 ${fail}`);
        fetchOrders();
    };

    const handleBatchStatusChange = async (newStatus) => {
        if (selectedIds.size === 0) return;
        const shouldChange = await confirm(`确定要将选中的 ${selectedIds.size} 个订单状态改为「${newStatus}」吗？`);
        if (!shouldChange) return;

        let success = 0, fail = 0;
        for (const id of selectedIds) {
            try {
                const res = await fetchWithAuth(`${API_BASE_URL}/orders/${id}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });
                if (res.ok) success++;
                else fail++;
            } catch {
                fail++;
            }
        }
        toast.success(`批量修改状态完成：成功 ${success}，失败 ${fail}`);
        fetchOrders();
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

    // Edit Modal
    const openEditModal = (order) => {
        setEditingOrder({
            ...order,
            address: order.address || ''
        });
        // Convert order_products to edit items
        const items = (order.order_products || []).map(op => ({
            id: op.ID,
            product_id: op.product_id,
            product_name: op.product?.name || '',
            length: op.length || 0,
            width: op.width || 0,
            height: op.height || 0,
            quantity: op.quantity || 1,
            unit: op.unit || '块',
            unit_price: op.unit_price || 0,
            total_price: op.total_price || 0
        }));
        setEditOrderItems(items);
        setEditCurrentItem({
            product_id: '',
            length: '',
            width: '',
            height: '',
            quantity: 1,
            unit: '块',
            unit_price: ''
        });
        setEditSelectedCategory('');
        setEditingItemIndex(-1);
        setIsEditModalOpen(true);
    };

    const handleEditAddItem = () => {
        if (!editCurrentItem.product_id) {
            toast.error('请选择产品');
            return;
        }
        if (!editCurrentItem.unit_price) {
            toast.error('请输入单价');
            return;
        }

        const product = products.find(p => p.ID === parseInt(editCurrentItem.product_id));
        const newItem = {
            product_id: parseInt(editCurrentItem.product_id),
            product_name: product ? product.name : 'Unknown',
            length: parseFloat(editCurrentItem.length) || 0,
            width: parseFloat(editCurrentItem.width) || 0,
            height: parseFloat(editCurrentItem.height) || 0,
            quantity: parseInt(editCurrentItem.quantity) || 1,
            unit: editCurrentItem.unit || '块',
            unit_price: parseFloat(editCurrentItem.unit_price),
            total_price: parseFloat(editCurrentItem.unit_price) * (parseInt(editCurrentItem.quantity) || 1)
        };

        if (editingItemIndex >= 0) {
            // 更新已有项
            const newItems = [...editOrderItems];
            newItems[editingItemIndex] = newItem;
            setEditOrderItems(newItems);
            setEditingItemIndex(-1);
        } else {
            // 添加新项
            setEditOrderItems([...editOrderItems, newItem]);
        }

        setEditCurrentItem({
            product_id: '',
            length: '',
            width: '',
            height: '',
            quantity: 1,
            unit: '块',
            unit_price: ''
        });
    };

    const handleEditItemClick = (index) => {
        const item = editOrderItems[index];
        // 找到产品所属的类别
        const product = products.find(p => p.ID === item.product_id);
        if (product) {
            setEditSelectedCategory(product.category_id?.toString() || '');
        }
        setEditCurrentItem({
            product_id: item.product_id.toString(),
            length: item.length.toString(),
            width: item.width.toString(),
            height: item.height.toString(),
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price.toString()
        });
        setEditingItemIndex(index);
    };

    const handleEditCancelEdit = () => {
        setEditingItemIndex(-1);
        setEditCurrentItem({
            product_id: '',
            length: '',
            width: '',
            height: '',
            quantity: 1,
            unit: '块',
            unit_price: ''
        });
    };

    const handleEditRemoveItem = (index) => {
        const newItems = [...editOrderItems];
        newItems.splice(index, 1);
        setEditOrderItems(newItems);
        if (editingItemIndex === index) {
            handleEditCancelEdit();
        } else if (editingItemIndex > index) {
            setEditingItemIndex(editingItemIndex - 1);
        }
    };

    const editTotalAmount = editOrderItems.reduce((sum, item) => sum + (item.total_price || 0), 0);

    const handleEditCustomerSearch = (value) => {
        setEditingOrder({ ...editingOrder, customer_name: value });
        if (value.trim()) {
            const matches = customers.filter(c =>
                c.name.toLowerCase().includes(value.toLowerCase()) ||
                c.phone.includes(value)
            );
            setFilteredCustomers(matches);
            setShowSuggestions(true);
        } else {
            setFilteredCustomers([]);
            setShowSuggestions(false);
        }
    };

    const handleEditSelectCustomer = (customer) => {
        setEditingOrder({
            ...editingOrder,
            customer_name: customer.name,
            phone: customer.phone,
            address: customer.address || ''
        });
        setShowSuggestions(false);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();

        if (editOrderItems.length === 0) {
            toast.error('请添加至少一个产品明细');
            return;
        }

        const payload = {
            customer_name: editingOrder.customer_name,
            phone: editingOrder.phone,
            address: editingOrder.address,
            amount: editTotalAmount,
            remark: editingOrder.remark,
            items: editOrderItems.map(({ id, product_name, total_price, ...rest }) => rest)
        };

        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/orders/${editingOrder.ID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '更新失败');
            }
            toast.success('订单更新成功');
            setIsEditModalOpen(false);
            setEditingOrder(null);
            fetchOrders();
        } catch (err) {
            console.error(err);
            toast.error(err.message || '更新失败');
        }
    };

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

    // Pagination helpers
    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, page - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start < maxVisible - 1) {
            start = Math.max(1, end - maxVisible + 1);
        }
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
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
            <div className="flex space-x-4 mb-4 border-b border-gray-100 pb-2 overflow-x-auto">
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

            {/* Batch Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="bg-gray-50 border border-gray-200 p-3 mb-4 flex items-center justify-between">
                    <span className="text-gray-700 text-sm font-medium">
                        已选择 <span className="font-bold text-black">{selectedIds.size}</span> 个订单
                    </span>
                    <div className="flex space-x-2">
                        <div className="relative">
                            <button
                                onClick={() => setShowBatchActions(!showBatchActions)}
                                className="bg-white text-black px-4 py-1.5 text-sm border border-black hover:bg-black hover:text-white transition-colors"
                            >
                                修改状态
                                <svg className="w-3 h-3 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {showBatchActions && (
                                <div className="absolute right-0 mt-1 bg-white border border-gray-200 shadow-lg z-10 min-w-[120px]">
                                    {['待下料', '待裁面', '待封面', '待送货', '待收款', '已完成'].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => { handleBatchStatusChange(s); setShowBatchActions(false); }}
                                            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleBatchDelete}
                            className="bg-white text-gray-600 px-4 py-1.5 text-sm border border-gray-300 hover:border-red-600 hover:text-red-600 transition-colors"
                        >
                            删除
                        </button>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="text-gray-400 px-3 py-1.5 text-sm hover:text-black transition-colors"
                        >
                            取消
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-4 w-10">
                                <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={handleSelectAll}
                                    className="w-4 h-4 rounded border-gray-300"
                                />
                            </th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">订单号</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">客户</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">产品</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">金额</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">状态</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {orders.map(order => (
                            <tr key={order.ID} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(order.ID) ? 'bg-blue-50' : ''}`}>
                                <td className="p-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(order.ID)}
                                        onChange={(e) => handleSelectOne(order.ID, e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300"
                                    />
                                </td>
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
                                            ? order.order_products.slice(0, 2).map((op, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-xs border-b border-gray-100 last:border-0 pb-0.5">
                                                    <span className="font-medium">{op.product?.name}</span>
                                                    <span className="text-gray-500 font-mono scale-90">
                                                        {op.length}x{op.width} * {op.quantity}
                                                    </span>
                                                </div>
                                            ))
                                            : <span className="text-gray-400">无明细</span>
                                        }
                                        {order.order_products && order.order_products.length > 2 && (
                                            <div className="text-xs text-gray-400">+{order.order_products.length - 2} 项</div>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-sm font-bold">¥{order.amount?.toFixed(2)}</td>
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

                {/* Enhanced Pagination */}
                <div className="p-4 flex justify-between items-center border-t border-gray-100">
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-500">
                            共 {total} 条记录
                        </span>
                        <select
                            value={pageSize}
                            onChange={(e) => { setPageSize(parseInt(e.target.value)); setPage(1); }}
                            className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-black"
                        >
                            <option value={10}>10条/页</option>
                            <option value={20}>20条/页</option>
                            <option value={50}>50条/页</option>
                            <option value={100}>100条/页</option>
                        </select>
                    </div>

                    <div className="flex items-center space-x-1">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(1)}
                            className="px-2 py-1 text-sm text-gray-500 hover:text-black disabled:opacity-30 transition-colors"
                            title="首页"
                        >
                            «
                        </button>
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="px-2 py-1 text-sm text-gray-500 hover:text-black disabled:opacity-30 transition-colors"
                        >
                            ‹
                        </button>

                        {getPageNumbers().map(p => (
                            <button
                                key={p}
                                onClick={() => setPage(p)}
                                className={`px-3 py-1 text-sm rounded transition-colors ${p === page
                                    ? 'bg-black text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}

                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="px-2 py-1 text-sm text-gray-500 hover:text-black disabled:opacity-30 transition-colors"
                        >
                            ›
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(totalPages)}
                            className="px-2 py-1 text-sm text-gray-500 hover:text-black disabled:opacity-30 transition-colors"
                            title="末页"
                        >
                            »
                        </button>

                        <span className="text-gray-400 mx-2">|</span>

                        <span className="text-sm text-gray-500">跳转</span>
                        <input
                            type="number"
                            min="1"
                            max={totalPages}
                            className="w-14 border border-gray-300 rounded px-2 py-1 text-sm text-center outline-none focus:border-black"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = parseInt(e.target.value);
                                    if (val >= 1 && val <= totalPages) {
                                        setPage(val);
                                    }
                                    e.target.value = '';
                                }
                            }}
                            placeholder={page}
                        />
                        <span className="text-sm text-gray-500">页</span>
                    </div>
                </div>
            </div>

            {/* Edit Modal - Full Featured */}
            {isEditModalOpen && editingOrder && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white w-full max-w-4xl p-6 rounded shadow-2xl animate-scale-in my-8 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-6 flex justify-between items-center">
                            <span>编辑订单 #{editingOrder.ID}</span>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-black">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </h3>

                        <form onSubmit={handleUpdate} className="space-y-6">
                            {/* Customer Info */}
                            <div className="bg-gray-50 p-4 rounded border">
                                <h4 className="font-bold mb-3 text-sm text-gray-600">客户信息</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="relative">
                                        <label className="block text-xs font-bold text-gray-500 mb-1">客户姓名</label>
                                        <input
                                            type="text"
                                            value={editingOrder.customer_name}
                                            onChange={(e) => handleEditCustomerSearch(e.target.value)}
                                            onFocus={() => {
                                                if (editingOrder.customer_name) {
                                                    setFilteredCustomers(customers.filter(c =>
                                                        c.name.toLowerCase().includes(editingOrder.customer_name.toLowerCase())
                                                    ));
                                                    setShowSuggestions(true);
                                                }
                                            }}
                                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                            className="w-full p-2 border rounded text-sm focus:border-black outline-none"
                                            required
                                        />
                                        {showSuggestions && filteredCustomers.length > 0 && (
                                            <div className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-32 overflow-y-auto mt-1">
                                                {filteredCustomers.map(c => (
                                                    <div
                                                        key={c.ID}
                                                        onClick={() => handleEditSelectCustomer(c)}
                                                        className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                                                    >
                                                        <div className="font-bold">{c.name}</div>
                                                        <div className="text-xs text-gray-500">{c.phone}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">联系电话</label>
                                        <input
                                            type="text"
                                            value={editingOrder.phone}
                                            onChange={(e) => setEditingOrder({ ...editingOrder, phone: e.target.value })}
                                            className="w-full p-2 border rounded text-sm focus:border-black outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">送货地址</label>
                                        <input
                                            type="text"
                                            value={editingOrder.address}
                                            onChange={(e) => setEditingOrder({ ...editingOrder, address: e.target.value })}
                                            className="w-full p-2 border rounded text-sm focus:border-black outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Product Items */}
                            <div className="bg-gray-50 p-4 rounded border">
                                <h4 className="font-bold mb-3 text-sm text-gray-600 flex justify-between">
                                    <span>产品明细</span>
                                    <span className="font-normal text-gray-400">{editOrderItems.length} 项</span>
                                </h4>

                                {/* Add Item Form */}
                                <div className={`p-3 rounded border mb-4 ${editingItemIndex >= 0 ? 'bg-yellow-50 border-yellow-300' : 'bg-white'}`}>
                                    {editingItemIndex >= 0 && (
                                        <div className="text-sm text-yellow-700 mb-2 font-medium">
                                            正在编辑第 {editingItemIndex + 1} 项
                                        </div>
                                    )}
                                    <div className="grid grid-cols-10 gap-2 items-end">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">类别</label>
                                            <select
                                                className="w-full p-2 border rounded text-sm"
                                                value={editSelectedCategory}
                                                onChange={e => {
                                                    setEditSelectedCategory(e.target.value);
                                                    setEditCurrentItem({ ...editCurrentItem, product_id: '' });
                                                }}
                                            >
                                                <option value="">全部</option>
                                                {categories.map(cat => (
                                                    <option key={cat.ID} value={cat.ID}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs text-gray-500 mb-1">产品</label>
                                            <select
                                                className="w-full p-2 border rounded text-sm"
                                                value={editCurrentItem.product_id}
                                                onChange={e => setEditCurrentItem({ ...editCurrentItem, product_id: e.target.value })}
                                            >
                                                <option value="">选择产品</option>
                                                {editFilteredProducts.map(p => (
                                                    <option key={p.ID} value={p.ID}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">长</label>
                                            <input type="number" className="w-full p-2 border rounded text-sm" value={editCurrentItem.length} onChange={e => setEditCurrentItem({ ...editCurrentItem, length: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">宽</label>
                                            <input type="number" className="w-full p-2 border rounded text-sm" value={editCurrentItem.width} onChange={e => setEditCurrentItem({ ...editCurrentItem, width: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">厚</label>
                                            <input type="number" className="w-full p-2 border rounded text-sm" value={editCurrentItem.height} onChange={e => setEditCurrentItem({ ...editCurrentItem, height: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">数量</label>
                                            <input type="number" className="w-full p-2 border rounded text-sm" value={editCurrentItem.quantity} onChange={e => setEditCurrentItem({ ...editCurrentItem, quantity: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">单位</label>
                                            <select className="w-full p-2 border rounded text-sm" value={editCurrentItem.unit} onChange={e => setEditCurrentItem({ ...editCurrentItem, unit: e.target.value })}>
                                                <option value="块">块</option>
                                                <option value="平米">平米</option>
                                                <option value="个">个</option>
                                                <option value="套">套</option>
                                                <option value="张">张</option>
                                                <option value="米">米</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">单价</label>
                                            <input type="number" className="w-full p-2 border rounded text-sm" value={editCurrentItem.unit_price} onChange={e => setEditCurrentItem({ ...editCurrentItem, unit_price: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="mt-3 flex justify-end space-x-2">
                                        {editingItemIndex >= 0 && (
                                            <button type="button" onClick={handleEditCancelEdit} className="px-3 py-1.5 text-gray-500 hover:text-black text-sm border border-gray-300 rounded">
                                                取消
                                            </button>
                                        )}
                                        <button type="button" onClick={handleEditAddItem} className="bg-black text-white px-4 py-1.5 rounded text-sm hover:bg-gray-800">
                                            {editingItemIndex >= 0 ? '保存修改' : '+ 添加'}
                                        </button>
                                    </div>
                                </div>

                                {/* Items List */}
                                {editOrderItems.length > 0 ? (
                                    <div className="overflow-x-auto bg-white rounded border">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-100 border-b">
                                                <tr>
                                                    <th className="p-2">产品</th>
                                                    <th className="p-2">尺寸</th>
                                                    <th className="p-2">数量</th>
                                                    <th className="p-2">单位</th>
                                                    <th className="p-2">单价</th>
                                                    <th className="p-2">小计</th>
                                                    <th className="p-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {editOrderItems.map((item, idx) => (
                                                    <tr key={idx} className={editingItemIndex === idx ? 'bg-yellow-50' : ''}>
                                                        <td className="p-2 font-medium">{item.product_name}</td>
                                                        <td className="p-2 font-mono text-gray-600 text-xs">{item.length}×{item.width}×{item.height}</td>
                                                        <td className="p-2">{item.quantity}</td>
                                                        <td className="p-2 text-gray-500">{item.unit}</td>
                                                        <td className="p-2">¥{item.unit_price}</td>
                                                        <td className="p-2 font-bold">¥{item.total_price?.toFixed(2)}</td>
                                                        <td className="p-2 space-x-1">
                                                            <button type="button" onClick={() => handleEditItemClick(idx)} className="text-gray-400 hover:text-black p-0.5" title="编辑">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                </svg>
                                                            </button>
                                                            <button type="button" onClick={() => handleEditRemoveItem(idx)} className="text-gray-400 hover:text-red-700 p-0.5" title="删除">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50 font-bold border-t">
                                                <tr>
                                                    <td colSpan="5" className="p-2 text-right">总金额:</td>
                                                    <td className="p-2 text-red-600">¥{editTotalAmount.toFixed(2)}</td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-gray-400 bg-white rounded border border-dashed">
                                        暂无产品明细
                                    </div>
                                )}
                            </div>

                            {/* Remark */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">备注</label>
                                <textarea
                                    value={editingOrder.remark || ''}
                                    onChange={(e) => setEditingOrder({ ...editingOrder, remark: e.target.value })}
                                    className="w-full p-2 border rounded text-sm focus:border-black outline-none h-20"
                                    placeholder="订单备注..."
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end space-x-3 pt-4 border-t">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-black transition-colors">
                                    取消
                                </button>
                                <button type="submit" className="bg-black text-white px-6 py-2 hover:bg-gray-800 transition-colors rounded">
                                    保存更改
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default OrderList;
