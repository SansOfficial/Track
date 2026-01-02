import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config';

import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { printOrder } from '../utils/print';

function CreateOrder() {
    const { fetchWithAuth } = useAuth();
    const { toast, confirm } = useUI();

    const [formData, setFormData] = useState({
        customer_name: '',
        phone: '',
        deadline_str: new Date().toISOString().split('T')[0], // Default to today
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
        unit_price: ''
    });

    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        // Fetch products
        fetchWithAuth(`${API_BASE_URL}/products`)
            .then(res => res.json())
            .then(data => setProducts(data))
            .catch(err => console.error(err));

        // Fetch customers
        fetchWithAuth(`${API_BASE_URL}/customers`)
            .then(res => res.json())
            .then(data => setCustomers(data))
            .catch(err => console.error(err));
    }, []);

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
            phone: customer.phone
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
            unit_price: parseFloat(currentItem.unit_price),
            product_name: product ? product.name : 'Unknown',
            total_price: parseFloat(currentItem.unit_price) * parseInt(currentItem.quantity)
        };

        setOrderItems([...orderItems, newItem]);
        setCurrentItem({
            product_id: '',
            length: '',
            width: '',
            height: '',
            quantity: 1,
            unit_price: ''
        });
    };

    const handleRemoveItem = (index) => {
        const newItems = [...orderItems];
        newItems.splice(index, 1);
        setOrderItems(newItems);
    };

    const totalAmount = orderItems.reduce((sum, item) => sum + item.total_price, 0);

    const handleSubmit = (e) => {
        e.preventDefault();

        if (orderItems.length === 0) {
            toast.error('请添加至少一个产品详情');
            return;
        }

        // Construct payload
        const payload = {
            ...formData,
            amount: totalAmount,
            items: orderItems.map(({ product_name, total_price, ...rest }) => rest) // Exclude display fields
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

                // Construct Order object for printing
                const orderForPrint = {
                    ...data,
                    order_products: orderItems.map(item => ({
                        ...item,
                        product: { name: item.product_name }
                    }))
                };

                const shouldPrint = await confirm('是否立即打印订单二维码？');
                if (shouldPrint) {
                    printOrder(orderForPrint);
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
            <h2 className="text-3xl font-bold mb-8">新建订单 (详细模式)</h2>
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
                    </div>
                </div>

                {/* Product Items */}
                <div className="bg-white p-6 rounded shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold mb-4 border-l-4 border-black pl-3 flex justify-between">
                        <span>产品明细</span>
                        <span className="text-sm font-normal text-gray-500">已添加 {orderItems.length} 项</span>
                    </h3>

                    {/* Add Item Form */}
                    <div className="bg-gray-50 p-4 rounded border border-gray-200 mb-6">
                        <div className="grid grid-cols-12 gap-4 items-end">
                            <div className="col-span-3">
                                <label className="block text-xs font-bold text-gray-500 mb-1">选择产品</label>
                                <select
                                    className="w-full p-2 border rounded text-sm"
                                    value={currentItem.product_id}
                                    onChange={e => setCurrentItem({ ...currentItem, product_id: e.target.value })}
                                >
                                    <option value="">-- 选择产品 --</option>
                                    {products.map(p => (
                                        <option key={p.ID} value={p.ID}>{p.name} ({p.code})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">长 (cm)</label>
                                <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0" value={currentItem.length} onChange={e => setCurrentItem({ ...currentItem, length: e.target.value })} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">宽 (cm)</label>
                                <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0" value={currentItem.width} onChange={e => setCurrentItem({ ...currentItem, width: e.target.value })} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">高/厚 (cm)</label>
                                <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0" value={currentItem.height} onChange={e => setCurrentItem({ ...currentItem, height: e.target.value })} />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1">数量</label>
                                <input type="number" className="w-full p-2 border rounded text-sm" placeholder="1" value={currentItem.quantity} onChange={e => setCurrentItem({ ...currentItem, quantity: e.target.value })} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">单价 (¥)</label>
                                <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0.00" value={currentItem.unit_price} onChange={e => setCurrentItem({ ...currentItem, unit_price: e.target.value })} />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button type="button" onClick={handleAddItem} className="bg-black text-white px-4 py-2 rounded text-sm hover:bg-gray-800">+ 添加明细</button>
                        </div>
                    </div>

                    {/* Items List */}
                    {orderItems.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-100 border-b">
                                    <tr>
                                        <th className="p-3">产品</th>
                                        <th className="p-3">尺寸 (L x W x H)</th>
                                        <th className="p-3">数量</th>
                                        <th className="p-3">单价</th>
                                        <th className="p-3">小计</th>
                                        <th className="p-3 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {orderItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="p-3 font-medium">{item.product_name}</td>
                                            <td className="p-3 font-mono text-gray-600">
                                                {item.length} x {item.width} x {item.height}
                                            </td>
                                            <td className="p-3">{item.quantity}</td>
                                            <td className="p-3">¥{item.unit_price}</td>
                                            <td className="p-3 font-bold">¥{item.total_price}</td>
                                            <td className="p-3 text-right">
                                                <button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700">删除</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50 font-bold border-t border-gray-300">
                                    <tr>
                                        <td colSpan="4" className="p-3 text-right">总金额:</td>
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
                            <label className="block text-gray-700 font-bold mb-2">预计完成日期 (Deadline)</label>
                            <input type="date" name="deadline_str" value={formData.deadline_str} onChange={handleChange} className="w-full p-2 border rounded outline-none focus:border-black transition-colors" />
                        </div>
                        <div>
                            <label className="block text-gray-700 font-bold mb-2">规格详情 / 备注</label>
                            <textarea name="remark" value={formData.remark} onChange={handleChange} className="w-full p-2 border rounded h-24 outline-none focus:border-black transition-colors" placeholder="请输入具体规格要求或其他备注信息..."></textarea>
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
