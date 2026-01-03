import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';

function ProductManager() {
    const { fetchWithAuth } = useAuth();
    const { toast, confirm } = useUI();
    const [products, setProducts] = useState([]);

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState({ name: '', code: '', icon: '', image: '', sort_order: 0 });

    const [selectedProductForAttrs, setSelectedProductForAttrs] = useState(null);
    const [newAttr, setNewAttr] = useState({ name: '', type: 'text', required: false, options: '' });

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    // Batch Selection
    const [selectedIds, setSelectedIds] = useState(new Set());

    const IMAGE_BASE_URL = API_BASE_URL.replace('/api', '');

    const fetchProducts = () => {
        let url = `${API_BASE_URL}/products`;
        if (searchQuery) {
            url += `?q=${encodeURIComponent(searchQuery)}`;
        }
        fetchWithAuth(url)
            .then(res => res.json())
            .then(data => {
                const sorted = (Array.isArray(data) ? data : []).sort((a, b) => a.sort_order - b.sort_order);
                setProducts(sorted);
                setSelectedIds(new Set());
                if (selectedProductForAttrs) {
                    const found = sorted.find(p => p.ID === selectedProductForAttrs.ID);
                    if (found) setSelectedProductForAttrs(found);
                }
            })
            .catch(err => {
                console.error(err);
                toast.error('获取产品失败');
            });
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Selection handlers
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(new Set(products.map(p => p.ID)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id, checked) => {
        const newSet = new Set(selectedIds);
        if (checked) newSet.add(id);
        else newSet.delete(id);
        setSelectedIds(newSet);
    };

    const isAllSelected = products.length > 0 && selectedIds.size === products.length;

    // Batch delete
    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        const shouldDelete = await confirm(`确定要删除选中的 ${selectedIds.size} 个产品吗？`);
        if (!shouldDelete) return;

        let success = 0, fail = 0;
        for (const id of selectedIds) {
            try {
                const res = await fetchWithAuth(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' });
                if (res.ok) success++;
                else fail++;
            } catch {
                fail++;
            }
        }
        toast.success(`批量删除完成：成功 ${success}，失败 ${fail}`);
        fetchProducts();
    };

    // --- Product CRUD ---

    const handleSaveProduct = (e) => {
        e.preventDefault();
        const url = editingProduct.ID
            ? `${API_BASE_URL}/products/${editingProduct.ID}`
            : `${API_BASE_URL}/products`;

        const method = editingProduct.ID ? 'PUT' : 'POST';

        fetchWithAuth(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...editingProduct,
                sort_order: parseInt(editingProduct.sort_order) || 0
            })
        })
            .then(async res => {
                if (!res.ok) throw new Error((await res.json()).error);
                return res.json();
            })
            .then(() => {
                toast.success(editingProduct.ID ? '产品已更新' : '产品已创建');
                setIsModalOpen(false);
                fetchProducts();
            })
            .catch(err => toast.error(err.message));
    };

    const handleDeleteProduct = async (id) => {
        if (!await confirm('确定要删除此产品吗？已绑定订单的产品无法删除。')) return;

        fetchWithAuth(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' })
            .then(async res => {
                if (!res.ok) throw new Error((await res.json()).error);
                toast.success('产品已删除');
                fetchProducts();
                if (selectedProductForAttrs?.ID === id) setSelectedProductForAttrs(null);
            })
            .catch(err => toast.error(err.message));
    };

    // --- Attribute CRUD ---

    const handleAddAttribute = (e) => {
        e.preventDefault();
        if (!selectedProductForAttrs) return;

        let optionsToSend = '';
        if (newAttr.type === 'select') {
            const lines = newAttr.options.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length === 0) {
                toast.error('请至少输入一个选项');
                return;
            }
            optionsToSend = JSON.stringify(lines);
        }

        fetchWithAuth(`${API_BASE_URL}/products/${selectedProductForAttrs.ID}/attributes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...newAttr,
                options: optionsToSend
            })
        })
            .then(async res => {
                if (!res.ok) throw new Error((await res.json()).error);
                return res.json();
            })
            .then(() => {
                toast.success('属性已添加');
                setNewAttr({ name: '', type: 'text', required: false, options: '' });
                fetchProducts();
            })
            .catch(err => toast.error(err.message));
    };

    const handleDeleteAttribute = async (attrId) => {
        if (!await confirm('确定要删除此属性吗？')) return;

        fetchWithAuth(`${API_BASE_URL}/products/${selectedProductForAttrs.ID}/attributes/${attrId}`, { method: 'DELETE' })
            .then(async res => {
                if (!res.ok) throw new Error((await res.json()).error);
                toast.success('属性已删除');
                fetchProducts();
            })
            .catch(err => toast.error(err.message));
    };

    // File Upload
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
                    setEditingProduct({ ...editingProduct, image: data.url });
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
        <div className="flex h-[calc(100vh-100px)]">
            {/* Left: Product List */}
            <div className="w-1/3 pr-6 border-r border-gray-100 overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">产品列表</h2>
                    <button
                        onClick={() => { setEditingProduct({ name: '', code: '', icon: '', image: '', sort_order: 0 }); setIsModalOpen(true); }}
                        className="bg-black text-white px-3 py-1 text-sm hover:bg-gray-800"
                    >
                        + 新建
                    </button>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                    <input
                        type="text"
                        placeholder="搜索产品..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-none focus:border-black outline-none transition-colors"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>

                {/* Batch Actions */}
                {selectedIds.size > 0 && (
                    <div className="bg-gray-50 border border-gray-200 p-3 mb-4 flex items-center justify-between">
                        <span className="text-gray-700 text-sm font-medium">
                            已选择 <span className="font-bold text-black">{selectedIds.size}</span> 个产品
                        </span>
                        <div className="flex space-x-2">
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

                <div className="space-y-2">
                    {products.map(prod => (
                        <div
                            key={prod.ID}
                            onClick={() => setSelectedProductForAttrs(prod)}
                            className={`p-4 rounded border cursor-pointer transition-all flex justify-between items-center ${selectedProductForAttrs?.ID === prod.ID
                                ? 'border-black bg-gray-50 shadow-sm'
                                : 'border-gray-200 hover:border-gray-400'
                                } ${selectedIds.has(prod.ID) ? 'bg-blue-50' : ''}`}
                        >
                            <div className="flex items-center space-x-3">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(prod.ID)}
                                    onChange={(e) => { e.stopPropagation(); handleSelectOne(prod.ID, e.target.checked); }}
                                    className="w-4 h-4 rounded border-gray-300"
                                    onClick={(e) => e.stopPropagation()}
                                />
                                {prod.image ? (
                                    <img
                                        src={prod.image.startsWith('http') ? prod.image : `${IMAGE_BASE_URL}${prod.image}`}
                                        alt={prod.name}
                                        className="w-10 h-10 object-cover rounded border border-gray-100"
                                    />
                                ) : (
                                    <span className="text-xl w-10 h-10 flex items-center justify-center bg-gray-100 rounded">{prod.icon || '📦'}</span>
                                )}
                                <div>
                                    <div className="font-bold">{prod.name}</div>
                                    <div className="text-xs text-gray-500">
                                        {prod.code && <span className="font-mono mr-2">{prod.code}</span>}
                                        {prod.attributes?.length || 0} 个自定义属性
                                    </div>
                                </div>
                            </div>
                            <div className="flex space-x-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditingProduct(prod); setIsModalOpen(true); }}
                                    className="text-gray-400 hover:text-black transition-colors p-1 rounded hover:bg-gray-100"
                                    title="编辑"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteProduct(prod.ID); }}
                                    className="text-gray-400 hover:text-red-700 transition-colors p-1 rounded hover:bg-gray-100"
                                    title="删除"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                    {products.length === 0 && (
                        <div className="text-center py-8 text-gray-400">暂无产品数据</div>
                    )}
                </div>
            </div>

            {/* Right: Attribute Manager */}
            <div className="w-2/3 pl-6 overflow-y-auto">
                {selectedProductForAttrs ? (
                    <div>
                        <div className="mb-6 pb-6 border-b border-gray-100">
                            <h2 className="text-2xl font-bold flex items-center">
                                <span className="mr-2">{selectedProductForAttrs.icon || '📦'}</span>
                                {selectedProductForAttrs.name} - 属性配置
                            </h2>
                            <p className="text-gray-500 text-sm mt-1">
                                为该产品定义额外的自定义字段（可选）。
                            </p>
                        </div>

                        {/* Attribute List */}
                        <div className="mb-8 space-y-3">
                            {selectedProductForAttrs.attributes?.map(attr => (
                                <div key={attr.ID} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                                    <div className="flex items-center space-x-4">
                                        <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded text-gray-600 uppercase w-16 text-center">
                                            {attr.type}
                                        </span>
                                        <span className="font-bold text-gray-800">{attr.name}</span>
                                        {attr.required && <span className="text-xs text-red-500 border border-red-200 px-1 rounded">必填</span>}
                                        {attr.type === 'select' && (
                                            <span className="text-xs text-gray-400 max-w-xs truncate" title={attr.options}>
                                                选项: {attr.options}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDeleteAttribute(attr.ID)}
                                        className="text-gray-400 hover:text-red-700 transition-colors p-1 rounded hover:bg-gray-100"
                                        title="移除"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                            {(!selectedProductForAttrs.attributes || selectedProductForAttrs.attributes.length === 0) && (
                                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded border border-dashed border-gray-200">
                                    暂无自定义属性
                                </div>
                            )}
                        </div>

                        {/* Add Attribute Form */}
                        <div className="bg-gray-50 p-6 rounded border border-gray-200">
                            <h3 className="font-bold mb-4 text-sm uppercase tracking-wider text-gray-500">添加新属性</h3>
                            <form onSubmit={handleAddAttribute} className="grid grid-cols-12 gap-4 items-end">
                                <div className="col-span-3">
                                    <label className="block text-xs font-bold mb-1">名称</label>
                                    <input
                                        type="text"
                                        value={newAttr.name}
                                        onChange={e => setNewAttr({ ...newAttr, name: e.target.value })}
                                        className="w-full p-2 border rounded text-sm"
                                        placeholder="如: 颜色"
                                        required
                                    />
                                </div>
                                <div className="col-span-3">
                                    <label className="block text-xs font-bold mb-1">类型</label>
                                    <select
                                        value={newAttr.type}
                                        onChange={e => setNewAttr({ ...newAttr, type: e.target.value })}
                                        className="w-full p-2 border rounded text-sm bg-white"
                                    >
                                        <option value="text">文本 (Text)</option>
                                        <option value="number">数字 (Number)</option>
                                        <option value="select">下拉单选 (Select)</option>
                                        <option value="textarea">多行文本 (Textarea)</option>
                                    </select>
                                </div>
                                <div className="col-span-4">
                                    <label className="block text-xs font-bold mb-1">
                                        选项配置 {newAttr.type !== 'select' && <span className="font-normal text-gray-400">(仅下拉有效)</span>}
                                    </label>
                                    <textarea
                                        value={newAttr.options}
                                        onChange={e => setNewAttr({ ...newAttr, options: e.target.value })}
                                        className="w-full p-2 border rounded text-sm disabled:bg-gray-100 min-h-[38px] align-top"
                                        placeholder={newAttr.type === 'select' ? "输入选项，每行一个\n例如：\n红色\n蓝色" : "无需配置"}
                                        disabled={newAttr.type !== 'select'}
                                        rows={newAttr.type === 'select' ? 3 : 1}
                                    />
                                </div>
                                <div className="col-span-2 flex items-center justify-center pb-2 space-x-2">
                                    <label className="flex items-center space-x-1 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newAttr.required}
                                            onChange={e => setNewAttr({ ...newAttr, required: e.target.checked })}
                                        />
                                        <span className="text-xs">必填</span>
                                    </label>
                                    <button
                                        type="submit"
                                        className="bg-black text-white px-4 py-2 text-sm rounded hover:bg-gray-800"
                                    >
                                        添加
                                    </button>
                                </div>
                            </form>
                            <div className="mt-2 text-xs text-gray-400">
                                提示：下拉选项请直接输入，每行代表一个选项。
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <div className="text-4xl mb-4">👈</div>
                        <p>请在左侧选择一个产品以管理其属性</p>
                    </div>
                )}
            </div>

            {/* Product Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded shadow-lg w-[480px] animate-scale-in">
                        <h3 className="text-xl font-bold mb-4">{editingProduct.ID ? '编辑产品' : '新建产品'}</h3>
                        <form onSubmit={handleSaveProduct} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">产品图片</label>
                                <div className="flex items-center space-x-4">
                                    <div className="w-16 h-16 bg-gray-100 rounded border border-gray-200 flex items-center justify-center overflow-hidden">
                                        {editingProduct.image ? (
                                            <img
                                                src={editingProduct.image.startsWith('http') ? editingProduct.image : `${IMAGE_BASE_URL}${editingProduct.image}`}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : editingProduct.icon ? (
                                            <span className="text-2xl">{editingProduct.icon}</span>
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1">名称 *</label>
                                    <input
                                        type="text"
                                        value={editingProduct.name}
                                        onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                                        className="w-full p-2 border rounded"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1">编号 (Code)</label>
                                    <input
                                        type="text"
                                        value={editingProduct.code || ''}
                                        onChange={e => setEditingProduct({ ...editingProduct, code: e.target.value })}
                                        className="w-full p-2 border rounded"
                                        placeholder="如: TTM-001"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1">图标 (Emoji)</label>
                                    <input
                                        type="text"
                                        value={editingProduct.icon || ''}
                                        onChange={e => setEditingProduct({ ...editingProduct, icon: e.target.value })}
                                        className="w-full p-2 border rounded"
                                        placeholder="e.g. 📦"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1">排序 (较小在前)</label>
                                    <input
                                        type="number"
                                        value={editingProduct.sort_order}
                                        onChange={e => setEditingProduct({ ...editingProduct, sort_order: e.target.value })}
                                        className="w-full p-2 border rounded"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end space-x-2 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500">取消</button>
                                <button type="submit" className="px-4 py-2 bg-black text-white rounded">保存</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProductManager;
