import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config';

import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { printOrder } from '../utils/print';

function CreateOrder() {
    const { fetchWithAuth } = useAuth();
    const { toast, confirm } = useUI();

    // Debug log to verify version
    useEffect(() => console.log('CreateOrder Component Loaded - v20251206-2'), []);

    const [formData, setFormData] = useState({
        customer_name: '',
        phone: '',
        amount: 0,
        specs: '',
        remark: ''
    });
    const [products, setProducts] = useState([]);
    const [selectedProducts, setSelectedProducts] = useState([]); // Array of product IDs

    const navigate = useNavigate();

    useEffect(() => {
        // Fetch products for selection
        fetchWithAuth(`${API_BASE_URL}/products`)
            .then(res => res.json())
            .then(data => setProducts(data))
            .catch(err => console.error(err));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleProductToggle = (productId, price) => {
        const currentSelected = new Set(selectedProducts);
        if (currentSelected.has(productId)) {
            currentSelected.delete(productId);
        } else {
            currentSelected.add(productId);
        }
        const newSelected = Array.from(currentSelected);
        setSelectedProducts(newSelected);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Construct payload
        const payload = {
            ...formData,
            amount: parseFloat(formData.amount),
            product_ids: selectedProducts
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

                // Construct Order object for printing (enrich with product names)
                const fullProductDetails = selectedProducts.map(id => products.find(p => p.ID === id)).filter(Boolean);
                const orderForPrint = {
                    ...data, // includes qr_code
                    ...payload,
                    products: fullProductDetails
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
        <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-8">新建订单</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-gray-700 font-bold mb-2">客户姓名</label>
                        <input type="text" name="customer_name" value={formData.customer_name} onChange={handleChange} required className="w-full p-2 border rounded" placeholder="请输入客户姓名" />
                    </div>
                    <div>
                        <label className="block text-gray-700 font-bold mb-2">联系电话</label>
                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full p-2 border rounded" placeholder="请输入联系电话" />
                    </div>
                </div>

                <div>
                    <label className="block text-gray-700 font-bold mb-2">选择产品 (可多选)</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border p-2 rounded max-h-40 overflow-y-auto">
                        {products.map(product => (
                            <label key={product.ID} className={`flex items-center space-x-2 p-2 rounded cursor-pointer border ${selectedProducts.includes(product.ID) ? 'border-black bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <input
                                    type="checkbox"
                                    checked={selectedProducts.includes(product.ID)}
                                    onChange={() => handleProductToggle(product.ID, product.price)}
                                    className="accent-black"
                                />
                                <div className="text-sm">
                                    <div className="font-bold">{product.name}</div>
                                    <div className="text-gray-500 text-xs">¥{product.price}</div>
                                </div>
                            </label>
                        ))}
                        {products.length === 0 && <div className="text-gray-400 text-sm p-2 col-span-3">请先在“产品管理”中添加产品</div>}
                    </div>
                </div>

                <div>
                    <label className="block text-gray-700 font-bold mb-2">订单金额 (¥)</label>
                    <input type="number" name="amount" value={formData.amount} onChange={handleChange} required className="w-full p-2 border rounded outline-none focus:border-black transition-colors" placeholder="0.00" />
                </div>

                <div>
                    <label className="block text-gray-700 font-bold mb-2">规格详情 / 备注</label>
                    <textarea name="remark" value={formData.remark} onChange={handleChange} className="w-full p-2 border rounded h-32 outline-none focus:border-black transition-colors" placeholder="请输入具体规格要求或其他备注信息..."></textarea>
                </div>

                <div className="flex justify-end pt-4 space-x-4">
                    <button type="button" onClick={() => navigate('/')} className="btn-secondary">取消</button>
                    <button type="submit" className="btn-secondary">创建订单</button>
                </div>
            </form>
        </div>
    );
}

export default CreateOrder;
