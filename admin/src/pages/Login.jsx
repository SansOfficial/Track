import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../context/UIContext';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();
    const { toast } = useUI();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await login(username, password);
        if (result.success) {
            toast.success('登录成功 / Login Success');
            navigate('/');
        } else {
            toast.error(result.error || '登录失败 / Login Failed');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white p-8 md:p-12 shadow-sm border border-gray-100 max-w-md w-full animate-scale-in relative">
                {/* Decorative Japanese Accent */}
                <div className="absolute top-0 left-0 w-full h-1 bg-red-700"></div>

                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-black text-white rounded-full mx-auto flex items-center justify-center text-3xl font-serif font-bold mb-4">
                        畳
                    </div>
                    <h1 className="text-2xl font-bold tracking-widest uppercase">Tatami Admin</h1>
                    <p className="text-xs text-gray-400 mt-2 tracking-[0.2em] uppercase">后台管理系统</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Username / 用户名</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-none focus:border-black outline-none transition-colors bg-gray-50 focus:bg-white"
                            placeholder="admin"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Password / 密码</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-none focus:border-black outline-none transition-colors bg-gray-50 focus:bg-white"
                            placeholder="••••••"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-black text-white py-3 font-bold uppercase tracking-widest hover:bg-red-700 transition-colors duration-300"
                    >
                        Login / 登录
                    </button>
                </form>

                <div className="mt-8 text-center text-[10px] text-gray-300 uppercase tracking-widest">
                    Tatami Factory Management System
                </div>
            </div>
        </div>
    );
}

export default Login;
