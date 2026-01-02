import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';

function CategoryManager() {
    const { fetchWithAuth } = useAuth();
    const { toast, confirm } = useUI();
    const [categories, setCategories] = useState([]);

    // UI State
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState({ name: '', icon: '', sort_order: 0 });

    const [selectedCatForAttrs, setSelectedCatForAttrs] = useState(null); // The category whose attributes we are editing
    const [newAttr, setNewAttr] = useState({ name: '', type: 'text', required: false, options: '' });

    const fetchCategories = () => {
        fetchWithAuth(`${API_BASE_URL}/categories`)
            .then(res => res.json())
            .then(data => {
                const sorted = (Array.isArray(data) ? data : []).sort((a, b) => a.sort_order - b.sort_order);
                setCategories(sorted);
                // If we are editing attributes for a category, refresh that category's data
                if (selectedCatForAttrs) {
                    const found = sorted.find(c => c.ID === selectedCatForAttrs.ID);
                    if (found) setSelectedCatForAttrs(found);
                }
            })
            .catch(err => {
                console.error(err);
                toast.error('获取分类失败');
            });
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    // --- Category CRUD ---

    const handleSaveCategory = (e) => {
        e.preventDefault();
        const url = editingCategory.ID
            ? `${API_BASE_URL}/categories/${editingCategory.ID}`
            : `${API_BASE_URL}/categories`;

        const method = editingCategory.ID ? 'PUT' : 'POST';

        fetchWithAuth(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...editingCategory,
                sort_order: parseInt(editingCategory.sort_order) || 0
            })
        })
            .then(async res => {
                if (!res.ok) throw new Error((await res.json()).error);
                return res.json();
            })
            .then(() => {
                toast.success(editingCategory.ID ? '分类已更新' : '分类已创建');
                setIsCatModalOpen(false);
                fetchCategories();
            })
            .catch(err => toast.error(err.message));
    };

    const handleDeleteCategory = async (id) => {
        if (!await confirm('确定要删除此分类吗？包含产品的分类无法删除。')) return;

        fetchWithAuth(`${API_BASE_URL}/categories/${id}`, { method: 'DELETE' })
            .then(async res => {
                if (!res.ok) throw new Error((await res.json()).error);
                toast.success('分类已删除');
                fetchCategories();
                if (selectedCatForAttrs?.ID === id) setSelectedCatForAttrs(null);
            })
            .catch(err => toast.error(err.message));
    };

    // --- Attribute CRUD ---

    const handleAddAttribute = (e) => {
        e.preventDefault();
        if (!selectedCatForAttrs) return;

        let optionsToSend = '';
        if (newAttr.type === 'select') {
            // Convert newline-separated string to JSON array
            const lines = newAttr.options.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length === 0) {
                toast.error('请至少输入一个选项');
                return;
            }
            optionsToSend = JSON.stringify(lines);
        }

        fetchWithAuth(`${API_BASE_URL}/categories/${selectedCatForAttrs.ID}/attributes`, {
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
                fetchCategories(); // Refresh to show new attribute
            })
            .catch(err => toast.error(err.message));
    };

    // ... (handleDeleteAttribute remains same) ...



    const handleDeleteAttribute = async (attrId) => {
        if (!await confirm('删除属性将清空所有产品该属性的值，确定吗？')) return;

        fetchWithAuth(`${API_BASE_URL}/categories/${selectedCatForAttrs.ID}/attributes/${attrId}`, { method: 'DELETE' })
            .then(async res => {
                if (!res.ok) throw new Error((await res.json()).error);
                toast.success('属性已删除');
                fetchCategories();
            })
            .catch(err => toast.error(err.message));
    };

    return (
        <div className="flex h-[calc(100vh-100px)]">
            {/* Left: Category List */}
            <div className="w-1/3 pr-6 border-r border-gray-100 overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">分类列表</h2>
                    <button
                        onClick={() => { setEditingCategory({ name: '', icon: '', sort_order: 0 }); setIsCatModalOpen(true); }}
                        className="bg-black text-white px-3 py-1 text-sm hover:bg-gray-800"
                    >
                        + 新建
                    </button>
                </div>

                <div className="space-y-2">
                    {categories.map(cat => (
                        <div
                            key={cat.ID}
                            onClick={() => setSelectedCatForAttrs(cat)}
                            className={`p-4 rounded border cursor-pointer transition-all flex justify-between items-center ${selectedCatForAttrs?.ID === cat.ID
                                ? 'border-black bg-gray-50 shadow-sm'
                                : 'border-gray-200 hover:border-gray-400'
                                }`}
                        >
                            <div className="flex items-center space-x-3">
                                <span className="text-xl">{cat.icon}</span>
                                <div>
                                    <div className="font-bold">{cat.name}</div>
                                    <div className="text-xs text-gray-500">{cat.attributes?.length || 0} 个自定义属性</div>
                                </div>
                            </div>
                            <div className="flex space-x-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); setIsCatModalOpen(true); }}
                                    className="p-1 text-gray-400 hover:text-black"
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.ID); }}
                                    className="p-1 text-gray-400 hover:text-red-700"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Attribute Manager */}
            <div className="w-2/3 pl-6 overflow-y-auto">
                {selectedCatForAttrs ? (
                    <div>
                        <div className="mb-6 pb-6 border-b border-gray-100">
                            <h2 className="text-2xl font-bold flex items-center">
                                <span className="mr-2">{selectedCatForAttrs.icon}</span>
                                {selectedCatForAttrs.name} - 属性配置
                            </h2>
                            <p className="text-gray-500 text-sm mt-1">
                                为该分类下的产品定义额外的字段。
                            </p>
                        </div>

                        {/* Attribute List */}
                        <div className="mb-8 space-y-3">
                            {selectedCatForAttrs.attributes?.map(attr => (
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
                                        className="text-red-400 hover:text-red-700 text-sm font-medium"
                                    >
                                        移除
                                    </button>
                                </div>
                            ))}
                            {(!selectedCatForAttrs.attributes || selectedCatForAttrs.attributes.length === 0) && (
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
                        <p>请在左侧选择一个分类以管理其属性</p>
                    </div>
                )}
            </div>

            {/* Category Modal */}
            {isCatModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded shadow-lg w-96 animate-scale-in">
                        <h3 className="text-xl font-bold mb-4">{editingCategory.ID ? '编辑分类' : '新建分类'}</h3>
                        <form onSubmit={handleSaveCategory} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">名称</label>
                                <input
                                    type="text"
                                    value={editingCategory.name}
                                    onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                                    className="w-full p-2 border rounded"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">图标 (Emoji)</label>
                                <input
                                    type="text"
                                    value={editingCategory.icon}
                                    onChange={e => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                                    className="w-full p-2 border rounded"
                                    placeholder="e.g. 📦"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">排序 (较小在前)</label>
                                <input
                                    type="number"
                                    value={editingCategory.sort_order}
                                    onChange={e => setEditingCategory({ ...editingCategory, sort_order: e.target.value })}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div className="flex justify-end space-x-2 pt-4">
                                <button type="button" onClick={() => setIsCatModalOpen(false)} className="px-4 py-2 text-gray-500">取消</button>
                                <button type="submit" className="px-4 py-2 bg-black text-white rounded">保存</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CategoryManager;
