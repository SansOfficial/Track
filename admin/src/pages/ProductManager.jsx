import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';
import { useUI } from '../context/UIContext';

import { useAuth } from '../context/AuthContext';

function ProductManager() {
    const { fetchWithAuth } = useAuth();
    const { toast, confirm } = useUI();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', code: '', price: 0, image: '', category_id: 0 });
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    const [dynamicAttrs, setDynamicAttrs] = useState({});

    // 获取分类列表
    const fetchCategories = () => {
        fetchWithAuth(`${API_BASE_URL}/categories`)
            .then(res => res.json())
            .then(data => setCategories(Array.isArray(data) ? data : []))
            .catch(err => {
                console.error(err);
                setCategories([]);
            });
    };

    // Fetch products
    const fetchProducts = () => {
        let url = `${API_BASE_URL}/products`;
        const params = [];
        if (searchQuery) params.push(`q=${encodeURIComponent(searchQuery)}`);
        if (categoryFilter) params.push(`category_id=${categoryFilter}`);
        if (params.length > 0) url += '?' + params.join('&');

        fetchWithAuth(url)
            .then(res => res.json())
            .then(data => setProducts(Array.isArray(data) ? data : []))
            .catch(err => {
                console.error(err);
                setProducts([]);
            });
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, categoryFilter]);

    const openModal = (product = null) => {
        if (product) {
            setNewProduct(product);
            // 解析现有属性值
            const attrs = {};
            if (product.attribute_values) {
                product.attribute_values.forEach(av => {
                    attrs[av.attribute_id] = av.value;
                });
            }
            setDynamicAttrs(attrs);
        } else {
            setNewProduct({ name: '', code: '', price: 0, image: '', category_id: categories[0]?.ID || 0 });
            setDynamicAttrs({});
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setNewProduct({ name: '', code: '', price: 0, image: '', category_id: 0 });
        setDynamicAttrs({});
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const url = newProduct.ID
            ? `${API_BASE_URL}/products/${newProduct.ID}`
            : `${API_BASE_URL}/products`;
        const method = newProduct.ID ? 'PUT' : 'POST';

        // 转换动态属性为后端格式
        const attribute_values = Object.keys(dynamicAttrs).map(attrId => ({
            attribute_id: parseInt(attrId),
            value: dynamicAttrs[attrId]
        }));

        fetchWithAuth(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...newProduct,
                price: parseFloat(newProduct.price),
                attribute_values: attribute_values
            })
        })
            .then(async res => {
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || '操作失败');
                }
                return data;
            })
            .then(() => {
                toast.success(newProduct.ID ? '产品更新成功' : '产品添加成功');
                closeModal();
                fetchProducts();
            })
            .catch(err => {
                console.error(err);
                toast.error(err.message || '操作失败');
            });
    };

    // ... existing handleDelete and others ...

    // Helper to render dynamic inputs
    const renderDynamicAttributes = () => {
        const selectedCat = categories.find(c => c.ID === newProduct.category_id);
        if (!selectedCat || !selectedCat.attributes || selectedCat.attributes.length === 0) return null;

        return (
            <div className="bg-gray-50 p-4 rounded border border-gray-100 space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase">
                    {selectedCat.name} 专属属性
                </h4>
                {selectedCat.attributes.map(attr => (
                    <div key={attr.ID}>
                        <label className="block text-gray-700 text-sm font-medium mb-1">
                            {attr.name} {attr.required && <span className="text-red-500">*</span>}
                        </label>

                        {attr.type === 'textarea' ? (
                            <textarea
                                value={dynamicAttrs[attr.ID] || ''}
                                onChange={e => setDynamicAttrs({ ...dynamicAttrs, [attr.ID]: e.target.value })}
                                required={attr.required}
                                className="w-full p-2 border border-gray-300 rounded text-sm min-h-[60px]"
                            />
                        ) : attr.type === 'select' ? (
                            <select
                                value={dynamicAttrs[attr.ID] || ''}
                                onChange={e => setDynamicAttrs({ ...dynamicAttrs, [attr.ID]: e.target.value })}
                                required={attr.required}
                                className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                            >
                                <option value="">请选择</option>
                                {(() => {
                                    try {
                                        const opts = JSON.parse(attr.options || '[]');
                                        return opts.map((opt, idx) => (
                                            <option key={idx} value={opt}>{opt}</option>
                                        ));
                                    } catch (e) {
                                        return <option value="">选项配置错误</option>;
                                    }
                                })()}
                            </select>
                        ) : (
                            <input
                                type={attr.type === 'number' ? 'number' : 'text'}
                                value={dynamicAttrs[attr.ID] || ''}
                                onChange={e => setDynamicAttrs({ ...dynamicAttrs, [attr.ID]: e.target.value })}
                                required={attr.required}
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                            />
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const handleDelete = async (id) => {
        const shouldDelete = await confirm('确定删除该产品吗？');
        if (shouldDelete) {
            fetchWithAuth(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' })
                .then(res => {
                    if (!res.ok) {
                        return res.json().then(json => { throw new Error(json.error || '删除失败'); });
                    }
                    return res.json();
                })
                .then(() => {
                    toast.success('产品已删除');
                    fetchProducts();
                })
                .catch(err => {
                    console.error(err);
                    toast.error(err.message);
                });
        }
    };

    // Base URL for Images (Remove /api from API_BASE_URL)
    const IMAGE_BASE_URL = API_BASE_URL.replace('/api', '');

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        fetchWithAuth(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData,
        })
            .then(res => res.json())
            .then(data => {
                if (data.url) {
                    setNewProduct({ ...newProduct, image: data.url });
                    toast.success('图片上传成功');
                } else {
                    toast.error('图片上传失败');
                }
            })
            .catch(err => {
                console.error(err);
                toast.error('上传出错');
            });
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">产品管理</h2>
                <div className="flex space-x-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="搜索产品名称/编号..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
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
                        <span className="mr-2 group-hover:text-red-700 transition-colors">+</span> 添加产品
                    </button>
                </div>
            </div>

            {/* 分类筛选标签 */}
            <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
                <button
                    onClick={() => setCategoryFilter('')}
                    className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${categoryFilter === ''
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    全部
                </button>
                {categories.map(cat => (
                    <button
                        key={cat.ID}
                        onClick={() => setCategoryFilter(cat.ID.toString())}
                        className={`px-4 py-2 text-sm font-medium rounded-full transition-all whitespace-nowrap ${categoryFilter === cat.ID.toString()
                            ? 'bg-black text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        {cat.icon} {cat.name}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">图片</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">分类</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">名称</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">编号 / Code</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">规格</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {products.map(product => (
                            <tr key={product.ID} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                    {product.image ? (
                                        <img
                                            src={product.image.startsWith('http') ? product.image : `${IMAGE_BASE_URL}${product.image}`}
                                            alt={product.name}
                                            className="w-12 h-12 object-cover rounded border border-gray-100"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">无图</div>
                                    )}
                                </td>
                                <td className="p-4">
                                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                                        {product.category?.icon} {product.category?.name || '未分类'}
                                    </span>
                                </td>
                                <td className="p-4 font-medium text-gray-900">{product.name}</td>
                                <td className="p-4 text-gray-500 font-mono text-sm">{product.code}</td>
                                <td className="p-4">
                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                        {product.attribute_values && product.attribute_values.length > 0 ? (
                                            product.attribute_values.map((av, idx) => (
                                                <span key={idx} className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded border border-gray-200">
                                                    {av.attribute?.name}: {av.value}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-gray-300 text-xs">-</span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    <button
                                        onClick={() => openModal(product)}
                                        className="text-gray-400 hover:text-black transition-colors p-1 rounded hover:bg-gray-100"
                                        title="编辑"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(product.ID)}
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
                        {products.length === 0 && (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-gray-400 text-sm">暂无产品数据</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md p-6 rounded shadow-2xl animate-scale-in">
                        <h3 className="text-xl font-bold mb-6">{newProduct.ID ? '编辑产品' : '添加新产品'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">产品图片</label>
                                <div className="flex items-center space-x-4">
                                    <div className="w-16 h-16 bg-gray-100 rounded border border-gray-200 flex items-center justify-center overflow-hidden">
                                        {newProduct.image ? (
                                            <img
                                                src={newProduct.image.startsWith('http') ? newProduct.image : `${IMAGE_BASE_URL}${newProduct.image}`}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-xs text-gray-400">无图</span>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-xs file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 transition-colors cursor-pointer"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">支持 JPG, PNG. 建议 1:1 比例.</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">产品分类</label>
                                <select
                                    value={newProduct.category_id || ''}
                                    onChange={e => setNewProduct({ ...newProduct, category_id: parseInt(e.target.value) || 0 })}
                                    required
                                    className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors"
                                >
                                    <option value="">请选择分类</option>
                                    {categories.map(cat => (
                                        <option key={cat.ID} value={cat.ID}>
                                            {cat.icon} {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 动态属性字段 */}
                            {renderDynamicAttributes()}

                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">产品名称</label>
                                <input
                                    type="text"
                                    value={newProduct.name}
                                    onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                                    required
                                    className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">产品编号 (Code)</label>
                                <input
                                    type="text"
                                    value={newProduct.code}
                                    onChange={e => setNewProduct({ ...newProduct, code: e.target.value })}
                                    placeholder="如: MAT-001"
                                    className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors"
                                />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 mt-6">
                                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-500 hover:text-black transition-colors">取消</button>
                                <button type="submit" className="bg-black text-white px-6 py-2 hover:bg-gray-800 transition-colors">{newProduct.ID ? '保存更改' : '确认添加'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProductManager;
