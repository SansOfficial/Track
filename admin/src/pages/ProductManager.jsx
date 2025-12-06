import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';
import { useUI } from '../context/UIContext';

function ProductManager() {
    const { toast, confirm } = useUI();
    const [products, setProducts] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', code: '', price: 0, image: '' });
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch products
    const fetchProducts = () => {
        let url = `${API_BASE_URL}/products`;
        if (searchQuery) {
            url += `?q=${encodeURIComponent(searchQuery)}`;
        }

        fetch(url)
            .then(res => res.json())
            .then(data => setProducts(Array.isArray(data) ? data : []))
            .catch(err => {
                console.error(err);
                setProducts([]);
            });
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const openModal = (product = null) => {
        if (product) {
            setNewProduct(product);
        } else {
            setNewProduct({ name: '', code: '', price: 0, image: '' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setNewProduct({ name: '', code: '', price: 0, image: '' });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const url = newProduct.ID
            ? `${API_BASE_URL}/products/${newProduct.ID}`
            : `${API_BASE_URL}/products`;
        const method = newProduct.ID ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newProduct, price: parseFloat(newProduct.price) })
        })
            .then(res => res.json())
            .then(() => {
                toast.success(newProduct.ID ? '产品更新成功' : '产品添加成功');
                closeModal();
                fetchProducts();
            })
            .catch(err => {
                console.error(err);
                toast.error('操作失败');
            });
    };

    const handleDelete = async (id) => {
        const shouldDelete = await confirm('确定删除该产品吗？');
        if (shouldDelete) {
            fetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' })
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

            <div className="bg-white rounded shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">名称</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">编号 / Code</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">单价</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {products.map(product => (
                            <tr key={product.ID} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4 font-medium text-gray-900">{product.name}</td>
                                <td className="p-4 text-gray-500 font-mono text-sm">{product.code}</td>
                                <td className="p-4 text-red-700 font-bold">¥{product.price}</td>
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
                                <td colSpan="4" className="p-8 text-center text-gray-400 text-sm">暂无产品数据</td>
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
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">单价 (¥)</label>
                                <input
                                    type="number"
                                    value={newProduct.price}
                                    onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
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
