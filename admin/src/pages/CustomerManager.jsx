import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';

function CustomerManager() {
    const { fetchWithAuth } = useAuth();
    const { toast, confirm } = useUI();
    const [customers, setCustomers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '', remark: '' });
    
    // Filters
    const [searchQuery, setSearchQuery] = useState('');

    const fetchCustomers = () => {
        let url = `${API_BASE_URL}/customers?`;
        if (searchQuery) url += `q=${encodeURIComponent(searchQuery)}`;

        fetchWithAuth(url)
            .then(res => res.json())
            .then(data => {
                setCustomers(data || []);
            })
            .catch(err => {
                console.error(err);
                setCustomers([]);
            });
    };

    useEffect(() => {
        const timer = setTimeout(fetchCustomers, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const openModal = (customer = null) => {
        if (customer) {
            setNewCustomer(customer);
        } else {
            setNewCustomer({ name: '', phone: '', address: '', remark: '' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setNewCustomer({ name: '', phone: '', address: '', remark: '' });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const url = newCustomer.ID
            ? `${API_BASE_URL}/customers/${newCustomer.ID}`
            : `${API_BASE_URL}/customers`;

        const method = newCustomer.ID ? 'PUT' : 'POST';

        fetchWithAuth(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCustomer)
        })
            .then(async res => {
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || '操作失败');
                }
                return data;
            })
            .then(() => {
                toast.success(newCustomer.ID ? '客户更新成功' : '客户添加成功');
                closeModal();
                fetchCustomers();
            })
            .catch(err => {
                console.error(err);
                toast.error(err.message || '操作失败');
            });
    };

    const handleDelete = async (id) => {
        const confirmed = await confirm(`确定要删除此客户吗？`);
        if (!confirmed) return;

        fetchWithAuth(`${API_BASE_URL}/customers/${id}`, { method: 'DELETE' })
            .then(() => {
                toast.success('客户删除成功！');
                fetchCustomers();
            })
            .catch(err => {
                console.error(err);
                toast.error('客户删除失败。');
            });
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">客户管理</h2>
                <div className="flex space-x-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="搜索客户姓名/电话..."
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
                        <span className="mr-2 group-hover:text-red-700 transition-colors">+</span> 添加客户
                    </button>
                </div>
            </div>

            <div className="bg-white rounded shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">姓名</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">电话</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">地址</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider">备注</th>
                            <th className="p-4 font-medium text-gray-500 text-xs uppercase tracking-wider text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {customers.map(customer => (
                            <tr key={customer.ID} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4 font-bold text-gray-900">{customer.name}</td>
                                <td className="p-4 text-gray-500 font-mono text-sm">{customer.phone}</td>
                                <td className="p-4 text-gray-600 text-sm">{customer.address || '-'}</td>
                                <td className="p-4 text-gray-400 text-sm max-w-xs truncate">{customer.remark || '-'}</td>
                                <td className="p-4 text-right space-x-2">
                                    <button
                                        onClick={() => openModal(customer)}
                                        className="text-gray-400 hover:text-black transition-colors p-1 rounded hover:bg-gray-100"
                                        title="编辑"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(customer.ID)}
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
                        {customers.length === 0 && (
                            <tr>
                                <td colSpan="5" className="p-8 text-center text-gray-400 text-sm">暂无客户数据</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md p-6 rounded shadow-2xl animate-scale-in">
                        <h3 className="text-xl font-bold mb-6">{newCustomer.ID ? '编辑客户' : '添加新客户'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">姓名</label>
                                <input
                                    type="text"
                                    value={newCustomer.name}
                                    onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                    required
                                    className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">电话</label>
                                <input
                                    type="text"
                                    value={newCustomer.phone}
                                    onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                    required
                                    className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">地址</label>
                                <input
                                    type="text"
                                    value={newCustomer.address}
                                    onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">备注</label>
                                <textarea
                                    value={newCustomer.remark}
                                    onChange={e => setNewCustomer({ ...newCustomer, remark: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-colors"
                                    rows="3"
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 mt-6">
                                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-500 hover:text-black transition-colors">取消</button>
                                <button type="submit" className="bg-black text-white px-6 py-2 hover:bg-gray-800 transition-colors">{newCustomer.ID ? '保存更改' : '确认添加'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CustomerManager;
