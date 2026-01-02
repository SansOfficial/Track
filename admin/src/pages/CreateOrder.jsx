import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config';

import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { printQRCode } from '../utils/print';

function CreateOrder() {
    const { fetchWithAuth } = useAuth();
    const { toast, confirm } = useUI();

    const [formData, setFormData] = useState({
        customer_name: '',
        phone: '',
        address: '',
        deadline_str: new Date().toISOString().split('T')[0],
        specs: '',
        remark: ''
    });

    // Order Items State
    const [orderItems, setOrderItems] = useState([]);
    const [currentItem, setCurrentItem] = useState({
        product_id: '',
        length: '',
        width: '',
        height: '',
        quantity: 1,
        unit: '块',
        unit_price: ''
    });

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // 编辑模式
    const [editingIndex, setEditingIndex] = useState(-1);

    const navigate = useNavigate();

    useEffect(() => {
        // Fetch categories
        fetchWithAuth(`${API_BASE_URL}/categories`)
            .then(res => res.json())
            .then(data => setCategories(Array.isArray(data) ? data : []))
            .catch(err => console.error(err));

        // Fetch products
        fetchWithAuth(`${API_BASE_URL}/products`)
            .then(res => res.json())
            .then(data => setProducts(Array.isArray(data) ? data : []))
            .catch(err => console.error(err));

        // Fetch customers
        fetchWithAuth(`${API_BASE_URL}/customers`)
            .then(res => res.json())
            .then(data => setCustomers(data || []))
            .catch(err => console.error(err));
    }, []);

    // 根据类别筛选产品
    const filteredProducts = selectedCategory
        ? products.filter(p => p.category_id === parseInt(selectedCategory))
        : products;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });

        if (name === 'customer_name') {
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
        }
    };

    const handleSelectCustomer = (customer) => {
        setFormData({
            ...formData,
            customer_name: customer.name,
            phone: customer.phone,
            address: customer.address || ''
        });
        setShowSuggestions(false);
    };

    // Item Management
    const handleAddItem = () => {
        if (!currentItem.product_id) {
            toast.error('请选择产品');
            return;
        }
        if (!currentItem.quantity || currentItem.quantity < 1) {
            toast.error('数量必须大于0');
            return;
        }
        if (!currentItem.unit_price) {
            toast.error('请输入单价');
            return;
        }

        const product = products.find(p => p.ID === parseInt(currentItem.product_id));
        const newItem = {
            ...currentItem,
            product_id: parseInt(currentItem.product_id),
            length: parseFloat(currentItem.length) || 0,
            width: parseFloat(currentItem.width) || 0,
            height: parseFloat(currentItem.height) || 0,
            quantity: parseInt(currentItem.quantity),
            unit: currentItem.unit || '块',
            unit_price: parseFloat(currentItem.unit_price),
            product_name: product ? product.name : 'Unknown',
            total_price: parseFloat(currentItem.unit_price) * parseInt(currentItem.quantity)
        };

        if (editingIndex >= 0) {
            // 更新已有项
            const newItems = [...orderItems];
            newItems[editingIndex] = newItem;
            setOrderItems(newItems);
            setEditingIndex(-1);
        } else {
            // 添加新项
            setOrderItems([...orderItems, newItem]);
        }

        // 重置表单
        setCurrentItem({
            product_id: '',
            length: '',
            width: '',
            height: '',
            quantity: 1,
            unit: '块',
            unit_price: ''
        });
    };

    const handleEditItem = (index) => {
        const item = orderItems[index];
        // 找到产品所属的类别
        const product = products.find(p => p.ID === item.product_id);
        if (product) {
            setSelectedCategory(product.category_id?.toString() || '');
        }
        setCurrentItem({
            product_id: item.product_id.toString(),
            length: item.length.toString(),
            width: item.width.toString(),
            height: item.height.toString(),
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price.toString()
        });
        setEditingIndex(index);
    };

    const handleCancelEdit = () => {
        setEditingIndex(-1);
        setCurrentItem({
            product_id: '',
            length: '',
            width: '',
            height: '',
            quantity: 1,
            unit: '块',
            unit_price: ''
        });
    };

    const handleRemoveItem = (index) => {
        const newItems = [...orderItems];
        newItems.splice(index, 1);
        setOrderItems(newItems);
        if (editingIndex === index) {
            handleCancelEdit();
        } else if (editingIndex > index) {
            setEditingIndex(editingIndex - 1);
        }
    };

    const totalAmount = orderItems.reduce((sum, item) => sum + item.total_price, 0);

    const handleSubmit = (e) => {
        e.preventDefault();

        if (orderItems.length === 0) {
            toast.error('请添加至少一个产品详情');
            return;
        }

        const payload = {
            ...formData,
            amount: totalAmount,
            items: orderItems.map(({ product_name, total_price, ...rest }) => rest)
        };

        fetchWithAuth(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(async res => {
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || '创建失败');
                }
                return data;
            })
            .then(async (data) => {
                toast.success('订单创建成功');

                const orderForPrint = {
                    ...data,
                    order_products: orderItems.map(item => ({
                        ...item,
                        product: { name: item.product_name }
                    }))
                };

                const shouldPrint = await confirm('是否立即打印订单标签？');
                if (shouldPrint) {
                    printQRCode(orderForPrint);
                }

                navigate('/');
            })
            .catch(err => {
                console.error(err);
                toast.error(err.message || '创建失败，请重试');
            });
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8">新建订单</h2>
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Customer Info */}
                <div className="bg-white p-6 rounded shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold mb-4 border-l-4 border-black pl-3">客户信息</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="relative">
                            <label className="block text-gray-700 font-bold mb-2">客户姓名</label>
                            <input
                                type="text"
                                name="customer_name"
                                value={formData.customer_name}
                                onChange={handleChange}
                                onFocus={() => {
                                    if (formData.customer_name) {
                                        setFilteredCustomers(customers.filter(c => c.name.toLowerCase().includes(formData.customer_name.toLowerCase())));
                                        setShowSuggestions(true);
                                    }
                                }}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                required
                                className="w-full p-2 border rounded"
                                placeholder="输入姓名 (自动联想)"
                                autoComplete="off"
                            />
                            {showSuggestions && filteredCustomers.length > 0 && (
                                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto mt-1">
                                    {filteredCustomers.map(c => (
                                        <div
                                            key={c.ID}
                                            onClick={() => handleSelectCustomer(c)}
                                            className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-50 last:border-0"
                                        >
                                            <div className="font-bold text-sm">{c.name}</div>
                                            <div className="text-xs text-gray-500">{c.phone}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-gray-700 font-bold mb-2">联系电话</label>
                            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full p-2 border rounded" placeholder="请输入电话" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-gray-700 font-bold mb-2">送货地址</label>
                            <input type="text" name="address" value={formData.address} onChange={handleChange} className="w-full p-2 border rounded" placeholder="选择客户后自动带出，可手动修改" />
                        </div>
                    </div>
                </div>

                {/* Product Items */}
                <div className="bg-white p-6 rounded shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold mb-4 border-l-4 border-black pl-3 flex justify-between">
                        <span>产品明细</span>
                        <span className="text-sm font-normal text-gray-500">已添加 {orderItems.length} 项</span>
                    </h3>

                    {/* Add Item Form */}
                    <div className={`p-4 rounded border mb-6 ${editingIndex >= 0 ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'}`}>
                        {editingIndex >= 0 && (
                            <div className="text-sm text-yellow-700 mb-3 font-medium">
                                正在编辑第 {editingIndex + 1} 项
                            </div>
                        )}
                        <div className="grid grid-cols-12 gap-3 items-end">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">选择类别</label>
                                <select
                                    className="w-full p-2 border rounded text-sm"
                                    value={selectedCategory}
                                    onChange={e => {
                                        setSelectedCategory(e.target.value);
                                        setCurrentItem({ ...currentItem, product_id: '' });
                                    }}
                                >
                                    <option value="">全部类别</option>
                                    {categories.map(cat => (
                                        <option key={cat.ID} value={cat.ID}>{cat.icon} {cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">选择产品</label>
                                <select
                                    className="w-full p-2 border rounded text-sm"
                                    value={currentItem.product_id}
                                    onChange={e => setCurrentItem({ ...currentItem, product_id: e.target.value })}
                                >
                                    <option value="">-- 选择 --</option>
                                    {filteredProducts.map(p => (
                                        <option key={p.ID} value={p.ID}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1">长</label>
                                <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0" value={currentItem.length} onChange={e => setCurrentItem({ ...currentItem, length: e.target.value })} />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1">宽</label>
                                <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0" value={currentItem.width} onChange={e => setCurrentItem({ ...currentItem, width: e.target.value })} />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1">厚</label>
                                <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0" value={currentItem.height} onChange={e => setCurrentItem({ ...currentItem, height: e.target.value })} />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1">数量</label>
                                <input type="number" className="w-full p-2 border rounded text-sm" placeholder="1" value={currentItem.quantity} onChange={e => setCurrentItem({ ...currentItem, quantity: e.target.value })} />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1">单位</label>
                                <select className="w-full p-2 border rounded text-sm bg-white" value={currentItem.unit} onChange={e => setCurrentItem({ ...currentItem, unit: e.target.value })}>
                                    <option value="块">块</option>
                                    <option value="平米">平米</option>
                                    <option value="个">个</option>
                                    <option value="套">套</option>
                                    <option value="张">张</option>
                                    <option value="米">米</option>
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1">单价</label>
                                <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0" value={currentItem.unit_price} onChange={e => setCurrentItem({ ...currentItem, unit_price: e.target.value })} />
                            </div>
                        </div>
                        <div className="mt-3 flex justify-end space-x-2">
                            {editingIndex >= 0 && (
                                <button type="button" onClick={handleCancelEdit} className="px-4 py-2 text-gray-500 hover:text-black text-sm border border-gray-300 rounded">
                                    取消编辑
                                </button>
                            )}
                            <button type="button" onClick={handleAddItem} className="bg-black text-white px-6 py-2 rounded text-sm hover:bg-gray-800">
                                {editingIndex >= 0 ? '保存修改' : '+ 添加明细'}
                            </button>
                        </div>
                    </div>

                    {/* Items List */}
                    {orderItems.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-100 border-b">
                                    <tr>
                                        <th className="p-3">产品</th>
                                        <th className="p-3">尺寸 (长×宽×厚)</th>
                                        <th className="p-3">数量</th>
                                        <th className="p-3">单位</th>
                                        <th className="p-3">单价</th>
                                        <th className="p-3">小计</th>
                                        <th className="p-3 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {orderItems.map((item, idx) => (
                                        <tr key={idx} className={editingIndex === idx ? 'bg-yellow-50' : ''}>
                                            <td className="p-3 font-medium">{item.product_name}</td>
                                            <td className="p-3 font-mono text-gray-600">
                                                {item.length} × {item.width} × {item.height}
                                            </td>
                                            <td className="p-3">{item.quantity}</td>
                                            <td className="p-3 text-gray-500">{item.unit}</td>
                                            <td className="p-3">¥{item.unit_price}</td>
                                            <td className="p-3 font-bold">¥{item.total_price?.toFixed(2)}</td>
                                            <td className="p-3 text-right space-x-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditItem(idx)}
                                                    className="text-gray-400 hover:text-black transition-colors p-1"
                                                    title="编辑"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(idx)}
                                                    className="text-gray-400 hover:text-red-700 transition-colors p-1"
                                                    title="删除"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50 font-bold border-t border-gray-300">
                                    <tr>
                                        <td colSpan="5" className="p-3 text-right">总金额:</td>
                                        <td className="p-3 text-lg text-red-600">¥{totalAmount.toFixed(2)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded border border-dashed border-gray-300">
                            暂无产品明细，请在上方添加
                        </div>
                    )}
                </div>

                {/* Additional Info */}
                <div className="bg-white p-6 rounded shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold mb-4 border-l-4 border-black pl-3">其他信息</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-gray-700 font-bold mb-2">预计完成日期</label>
                            <input type="date" name="deadline_str" value={formData.deadline_str} onChange={handleChange} className="w-full p-2 border rounded outline-none focus:border-black transition-colors" />
                        </div>
                        <div>
                            <label className="block text-gray-700 font-bold mb-2">备注</label>
                            <textarea name="remark" value={formData.remark} onChange={handleChange} className="w-full p-2 border rounded h-24 outline-none focus:border-black transition-colors" placeholder="请输入备注信息..."></textarea>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4 space-x-4">
                    <button type="button" onClick={() => navigate('/')} className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded hover:bg-gray-300 transition-colors">取消</button>
                    <button type="submit" className="px-8 py-3 bg-black text-white font-bold rounded hover:bg-gray-800 transition-colors shadow-lg">创建订单</button>
                </div>
            </form>
        </div>
    );
}

export default CreateOrder;
