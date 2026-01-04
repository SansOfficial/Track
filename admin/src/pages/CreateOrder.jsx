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
        unit_price: '',
        extra_attrs: {} // 额外属性值
    });

    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // 编辑模式
    const [editingIndex, setEditingIndex] = useState(-1);

    // 附件图片
    const [attachments, setAttachments] = useState([]);
    const [uploadingImage, setUploadingImage] = useState(false);

    const navigate = useNavigate();
    const IMAGE_BASE_URL = API_BASE_URL.replace('/api', '');

    useEffect(() => {
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

    // 图片上传处理
    const uploadImage = async (file) => {
        if (!file || !file.type.startsWith('image/')) {
            toast.error('请上传图片文件');
            return null;
        }

        setUploadingImage(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (data.url) {
                return data.url;
            } else {
                toast.error('图片上传失败');
                return null;
            }
        } catch (err) {
            console.error(err);
            toast.error('上传出错');
            return null;
        } finally {
            setUploadingImage(false);
        }
    };

    const handleImageUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        for (const file of files) {
            const url = await uploadImage(file);
            if (url) {
                setAttachments(prev => [...prev, url]);
            }
        }
        e.target.value = ''; // 清空input以便再次上传同一文件
    };

    const handlePaste = async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    const url = await uploadImage(file);
                    if (url) {
                        setAttachments(prev => [...prev, url]);
                        toast.success('图片已粘贴上传');
                    }
                }
                break;
            }
        }
    };

    const handleRemoveAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // 获取当前选中产品的额外属性定义
    const selectedProduct = products.find(p => p.ID === parseInt(currentItem.product_id));
    const productAttrs = selectedProduct?.attributes || [];

    // 面积单位配置：单位名称 -> 换算系数 (mm² 转换为该单位需要除以的数)
    const areaUnits = {
        '平米': 1000000,
        '平方米': 1000000,
        '㎡': 1000000,
        '平方厘米': 100,
        '平方分米': 10000,
        'cm²': 100,
        'dm²': 10000,
        'm²': 1000000,
    };

    // 长度单位配置：单位名称 -> 换算系数 (mm 转换为该单位需要除以的数)
    const lengthUnits = {
        '米': 1000,
        'm': 1000,
        '分米': 100,
        'dm': 100,
        '厘米': 10,
        'cm': 10,
    };

    // 判断是否是面积单位
    const isAreaUnit = (unit) => Object.keys(areaUnits).includes(unit);
    // 判断是否是长度单位
    const isLengthUnit = (unit) => Object.keys(lengthUnits).includes(unit);

    // 计算面积（平方毫米转为对应单位）
    const calculateArea = (length, width, unit) => {
        const l = parseFloat(length) || 0;
        const w = parseFloat(width) || 0;
        const divisor = areaUnits[unit] || 1000000;
        return (l * w) / divisor;
    };

    // 计算长度（毫米转为对应单位）
    const calculateLength = (length, unit) => {
        const l = parseFloat(length) || 0;
        const divisor = lengthUnits[unit] || 1000;
        return l / divisor;
    };

    // 获取自动计算的数量
    const getAutoQuantity = () => {
        if (isAreaUnit(currentItem.unit)) {
            return calculateArea(currentItem.length, currentItem.width, currentItem.unit);
        }
        if (isLengthUnit(currentItem.unit)) {
            return calculateLength(currentItem.length, currentItem.unit);
        }
        return null;
    };

    // 当前是否需要自动计算数量
    const autoQuantity = getAutoQuantity();
    const isAutoCalculate = autoQuantity !== null;

    // 处理额外属性值变化
    const handleExtraAttrChange = (attrName, value) => {
        setCurrentItem({
            ...currentItem,
            extra_attrs: {
                ...currentItem.extra_attrs,
                [attrName]: value
            }
        });
    };

    // Item Management
    const handleAddItem = () => {
        if (!currentItem.product_id) {
            toast.error('请选择产品');
            return;
        }
        
        // 获取数量
        const finalQuantity = parseFloat(currentItem.quantity);
        
        if (!finalQuantity || finalQuantity <= 0) {
            toast.error('数量必须大于0');
            return;
        }
        if (!currentItem.unit_price) {
            toast.error('请输入单价');
            return;
        }

        // 检查必填的额外属性
        for (const attr of productAttrs) {
            if (attr.required && !currentItem.extra_attrs[attr.name]) {
                toast.error(`请填写${attr.name}`);
                return;
            }
        }

        const product = products.find(p => p.ID === parseInt(currentItem.product_id));
        const newItem = {
            ...currentItem,
            product_id: parseInt(currentItem.product_id),
            length: parseFloat(currentItem.length) || 0,
            width: parseFloat(currentItem.width) || 0,
            height: parseFloat(currentItem.height) || 0,
            quantity: finalQuantity,
            unit: currentItem.unit || '块',
            unit_price: parseFloat(currentItem.unit_price),
            product_name: product ? product.name : 'Unknown',
            total_price: parseFloat(currentItem.unit_price) * finalQuantity,
            extra_attrs: currentItem.extra_attrs,
            extra_attrs_json: JSON.stringify(currentItem.extra_attrs) // 用于发送到后端
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
            unit_price: '',
            extra_attrs: {}
        });
    };

    const handleEditItem = (index) => {
        const item = orderItems[index];
        setCurrentItem({
            product_id: item.product_id.toString(),
            length: item.length.toString(),
            width: item.width.toString(),
            height: item.height.toString(),
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price.toString(),
            extra_attrs: item.extra_attrs || {}
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
            unit_price: '',
            extra_attrs: {}
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
            attachments: JSON.stringify(attachments),
            items: orderItems.map(({ product_name, total_price, extra_attrs, extra_attrs_json, ...rest }) => ({
                ...rest,
                extra_attrs: extra_attrs_json || JSON.stringify(extra_attrs || {})
            }))
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
        <div className="max-w-7xl mx-auto px-4">
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
                        {/* 第一行：产品选择 + 长宽高数量（符合阅读直觉） */}
                        <div className="grid grid-cols-3 sm:grid-cols-6 xl:grid-cols-12 gap-3 mb-3">
                            <div className="col-span-3 sm:col-span-2 xl:col-span-3">
                                <label className="block text-xs font-bold text-gray-500 mb-1">选择产品</label>
                                <select
                                    className="w-full p-2 border rounded text-sm"
                                    value={currentItem.product_id}
                                    onChange={e => setCurrentItem({ ...currentItem, product_id: e.target.value, extra_attrs: {} })}
                                >
                                    <option value="">-- 选择产品 --</option>
                                    {products.map(p => (
                                        <option key={p.ID} value={p.ID}>{p.icon || '📦'} {p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-1 xl:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">长 <span className="text-gray-400 font-normal">mm</span></label>
                                <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0" value={currentItem.length} onChange={e => setCurrentItem({ ...currentItem, length: e.target.value })} />
                            </div>
                            <div className="col-span-1 xl:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">宽 <span className="text-gray-400 font-normal">mm</span></label>
                                <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0" value={currentItem.width} onChange={e => setCurrentItem({ ...currentItem, width: e.target.value })} />
                            </div>
                            <div className="col-span-1 xl:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">高 <span className="text-gray-400 font-normal">mm</span></label>
                                <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0" value={currentItem.height} onChange={e => setCurrentItem({ ...currentItem, height: e.target.value })} />
                            </div>
                            <div className="col-span-3 sm:col-span-2 xl:col-span-3">
                                <label className="block text-xs font-bold text-gray-500 mb-1">
                                    数量 
                                    {isAutoCalculate && autoQuantity > 0 && (
                                        <button
                                            type="button"
                                            className="text-blue-500 hover:text-blue-700 ml-1"
                                            onClick={() => setCurrentItem({ ...currentItem, quantity: autoQuantity.toFixed(4) })}
                                            title="点击填入自动计算的数量"
                                        >
                                            ← {autoQuantity.toFixed(4)}
                                        </button>
                                    )}
                                </label>
                                <input 
                                    type="number" 
                                    className="w-full p-2 border rounded text-sm" 
                                    placeholder="1" 
                                    value={currentItem.quantity} 
                                    onChange={e => setCurrentItem({ ...currentItem, quantity: e.target.value })} 
                                />
                            </div>
                        </div>
                        
                        {/* 第二行：单位、单价、按钮 */}
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 items-end">
                            <div className="col-span-1 sm:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">单位</label>
                                <select className="w-full p-2 border rounded text-sm bg-white" value={currentItem.unit} onChange={e => setCurrentItem({ ...currentItem, unit: e.target.value })}>
                                    <optgroup label="常规单位">
                                        <option value="块">块</option>
                                        <option value="个">个</option>
                                        <option value="套">套</option>
                                        <option value="张">张</option>
                                        <option value="片">片</option>
                                    </optgroup>
                                    <optgroup label="面积单位 (自动计算)">
                                        <option value="平米">平米</option>
                                        <option value="平方米">平方米</option>
                                        <option value="㎡">㎡</option>
                                        <option value="平方分米">平方分米</option>
                                        <option value="平方厘米">平方厘米</option>
                                    </optgroup>
                                    <optgroup label="长度单位 (自动计算)">
                                        <option value="米">米</option>
                                        <option value="分米">分米</option>
                                        <option value="厘米">厘米</option>
                                    </optgroup>
                                </select>
                            </div>
                            <div className="col-span-1 sm:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">单价</label>
                                <input type="number" className="w-full p-2 border rounded text-sm" placeholder="0" value={currentItem.unit_price} onChange={e => setCurrentItem({ ...currentItem, unit_price: e.target.value })} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 flex space-x-1">
                                {editingIndex >= 0 && (
                                    <button type="button" onClick={handleCancelEdit} className="text-gray-400 hover:text-black p-2 border rounded" title="取消">
                                        ✕
                                    </button>
                                )}
                                <button type="button" onClick={handleAddItem} className="bg-black text-white px-4 py-2 rounded text-sm hover:bg-gray-800 flex-1">
                                    {editingIndex >= 0 ? '✓ 保存' : '+ 添加'}
                                </button>
                            </div>
                        </div>

                        {/* 额外属性输入区域 */}
                        {productAttrs.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="text-xs font-bold text-gray-500 mb-2">额外属性</div>
                                <div className="grid grid-cols-4 gap-3">
                                    {productAttrs.map(attr => (
                                        <div key={attr.ID}>
                                            <label className="block text-xs text-gray-500 mb-1">
                                                {attr.name} {attr.required && <span className="text-red-500">*</span>}
                                            </label>
                                            {attr.type === 'select' ? (
                                                <select
                                                    className="w-full p-2 border rounded text-sm bg-white"
                                                    value={currentItem.extra_attrs[attr.name] || ''}
                                                    onChange={e => handleExtraAttrChange(attr.name, e.target.value)}
                                                >
                                                    <option value="">请选择</option>
                                                    {(() => {
                                                        try {
                                                            const options = JSON.parse(attr.options || '[]');
                                                            return options.map((opt, idx) => (
                                                                <option key={idx} value={opt}>{opt}</option>
                                                            ));
                                                        } catch {
                                                            return null;
                                                        }
                                                    })()}
                                                </select>
                                            ) : attr.type === 'textarea' ? (
                                                <textarea
                                                    className="w-full p-2 border rounded text-sm"
                                                    value={currentItem.extra_attrs[attr.name] || ''}
                                                    onChange={e => handleExtraAttrChange(attr.name, e.target.value)}
                                                    rows={2}
                                                    placeholder={`请输入${attr.name}`}
                                                />
                                            ) : attr.type === 'number' ? (
                                                <input
                                                    type="number"
                                                    className="w-full p-2 border rounded text-sm"
                                                    value={currentItem.extra_attrs[attr.name] || ''}
                                                    onChange={e => handleExtraAttrChange(attr.name, e.target.value)}
                                                    placeholder={`请输入${attr.name}`}
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    className="w-full p-2 border rounded text-sm"
                                                    value={currentItem.extra_attrs[attr.name] || ''}
                                                    onChange={e => handleExtraAttrChange(attr.name, e.target.value)}
                                                    placeholder={`请输入${attr.name}`}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Items List */}
                    {orderItems.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-100 border-b">
                                    <tr>
                                        <th className="p-3">产品</th>
                                        <th className="p-3">尺寸 (长×宽×高)</th>
                                        <th className="p-3">额外属性</th>
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
                                            <td className="p-3 text-xs text-gray-600">
                                                {item.extra_attrs && Object.keys(item.extra_attrs).length > 0 ? (
                                                    <div className="space-y-0.5">
                                                        {Object.entries(item.extra_attrs).map(([key, value]) => (
                                                            value && <div key={key}><span className="text-gray-400">{key}:</span> {value}</div>
                                                        ))}
                                                    </div>
                                                ) : '-'}
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
                                        <td colSpan="6" className="p-3 text-right">总金额:</td>
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

                {/* 附件图片 */}
                <div className="bg-white p-6 rounded shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold mb-4 border-l-4 border-black pl-3">
                        附件图片
                        <span className="text-sm font-normal text-gray-400 ml-2">（可粘贴图片快捷上传）</span>
                    </h3>
                    
                    {/* 上传区域 */}
                    <div 
                        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
                        onPaste={handlePaste}
                        tabIndex={0}
                    >
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageUpload}
                            className="hidden"
                            id="attachment-upload"
                        />
                        <label htmlFor="attachment-upload" className="cursor-pointer">
                            <div className="text-gray-400 mb-2">
                                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <p className="text-gray-500 text-sm">
                                点击上传图片，或 <span className="font-bold text-black">Ctrl+V 粘贴</span> 图片
                            </p>
                            <p className="text-gray-400 text-xs mt-1">支持 JPG、PNG 格式</p>
                        </label>
                        {uploadingImage && (
                            <div className="mt-2 text-blue-500 text-sm">上传中...</div>
                        )}
                    </div>

                    {/* 已上传图片预览 */}
                    {attachments.length > 0 && (
                        <div className="mt-4 grid grid-cols-4 gap-4">
                            {attachments.map((url, index) => (
                                <div key={index} className="relative group">
                                    <img
                                        src={url.startsWith('http') ? url : `${IMAGE_BASE_URL}${url}`}
                                        alt={`附件 ${index + 1}`}
                                        className="w-full h-24 object-cover rounded border border-gray-200"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveAttachment(index)}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="删除"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
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
