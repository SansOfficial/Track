import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';

function ProductManager() {
    const [products, setProducts] = useState([]);
    const [newProduct, setNewProduct] = useState({ name: '', code: '', price: 0, image: '' });

    // Fetch products
    const fetchProducts = () => {
        fetch(`${API_BASE_URL}/products`)
            .then(res => res.json())
            .then(data => setProducts(data))
            .catch(err => console.error(err));
    };

    useEffect(() => {
        fetchProducts();
    }, []);

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
                setNewProduct({ name: '', code: '', price: 0, image: '' });
                fetchProducts();
            })
            .catch(err => console.error(err));
    };

    const handleDelete = (id) => {
        if (window.confirm('确定删除该产品吗？')) {
            fetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' })
                .then(() => fetchProducts())
                .catch(err => console.error(err));
        }
    };

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold mb-8">产品管理</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-xl font-bold mb-4 text-gray-700">{newProduct.ID ? '编辑产品' : '添加新产品'}</h3>
                    <form onSubmit={handleSubmit} className="card space-y-4">
                        <div>
                            <label className="block text-gray-700 mb-1">产品名称</label>
                            <input
                                type="text"
                                value={newProduct.name}
                                onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                                required
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 mb-1">产品编号 (Code)</label>
                            <input
                                type="text"
                                value={newProduct.code}
                                onChange={e => setNewProduct({ ...newProduct, code: e.target.value })}
                                placeholder="如: MAT-001"
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 mb-1">单价 (¥)</label>
                            <input
                                type="number"
                                value={newProduct.price}
                                onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div className="flex space-x-2">
                            <button type="submit" className="btn-secondary flex-1">{newProduct.ID ? '保存修改' : '添加产品'}</button>
                            {newProduct.ID && <button type="button" onClick={() => setNewProduct({ name: '', code: '', price: 0, image: '' })} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100">取消</button>}
                        </div>
                    </form>
                </div>

                <div>
                    <h3 className="text-xl font-bold mb-4 text-gray-700">产品列表</h3>
                    <div className="card overflow-hidden p-0 border-t border-gray-100">
                        <table className="w-full text-left">
                            <thead className="bg-white border-b border-gray-200">
                                <tr>
                                    <th className="p-3 font-normal text-xs text-gray-400 uppercase tracking-widest">名称</th>
                                    <th className="p-3 font-normal text-xs text-gray-400 uppercase tracking-widest">编号</th>
                                    <th className="p-3 font-normal text-xs text-gray-400 uppercase tracking-widest">单价</th>
                                    <th className="p-3 font-normal text-xs text-gray-400 uppercase tracking-widest">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {products.map(product => (
                                    <tr key={product.ID} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-3 font-medium">{product.name}</td>
                                        <td className="p-3 text-gray-500 font-mono text-xs">{product.code}</td>
                                        <td className="p-3 text-red-700 font-mono">¥{product.price}</td>
                                        <td className="p-3 space-x-3">
                                            <button onClick={() => setNewProduct(product)} className="text-gray-400 hover:text-black text-sm transition-colors">编辑</button>
                                            <button onClick={() => handleDelete(product.ID)} className="text-gray-400 hover:text-red-700 text-sm transition-colors">删除</button>
                                        </td>
                                    </tr>
                                ))}
                                {products.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="p-4 text-center text-gray-400">暂无产品</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProductManager;
