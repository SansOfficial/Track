import React, { useState, useEffect, useRef } from 'react';
import { useUI } from '../context/UIContext';
import API_BASE_URL from '../config';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * 工位数据大屏 (Station Dashboard)
 * 
 * 风格: 管理后台一致 (Clean White/Gray/Black)
 * 语言: 中文
 */
const Station = () => {
    const { toast } = useUI();
    const [stats, setStats] = useState({
        today_output: 0,
        leaderboard: [],
        station_dist: [],
        upcoming_orders: [], // Updated from three_day_progress
        recent_logs: [],
        error_logs: []
    });
    const [lastScanStatus, setLastScanStatus] = useState(null); // { type: 'success'|'error', message: '' }

    // Buffer for scanner input
    const buffer = useRef('');
    const lastKeyTime = useRef(Date.now());

    // --- 1. Data Fetching ---
    const fetchStats = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/station/stats`);
            const data = await res.json();
            if (res.ok) {
                // Prevent unnecessary re-renders (Fix flashing)
                setStats(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
                    return data;
                });
            }
        } catch (err) {
            console.error("Failed to fetch station stats:", err);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 3000);
        return () => clearInterval(interval);
    }, []);

    // --- 2. Scanner Logic ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            const now = Date.now();
            if (now - lastKeyTime.current > 100) {
                buffer.current = '';
            }
            lastKeyTime.current = now;

            if (e.key === 'Enter') {
                processBarcode(buffer.current);
                buffer.current = '';
            } else if (e.key.length === 1) {
                buffer.current += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const processBarcode = async (code) => {
        // Parse Prefix
        let scannerCode = '';
        let qrCode = code;

        if (code.includes('#')) {
            const parts = code.split('#');
            if (parts.length >= 2) {
                scannerCode = parts[0] + '#';
                qrCode = parts.slice(1).join('#');
            }
        }

        try {
            const res = await fetch(`${API_BASE_URL}/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    qr_code: qrCode,
                    scanner_code: scannerCode,
                })
            });
            const data = await res.json();

            if (!res.ok) {
                setLastScanStatus({ type: 'error', message: data.message || data.error || '扫描失败' });
                speak('操作失败');
            } else {
                setLastScanStatus({ type: 'success', message: data.message || '操作成功' });
                speak('操作成功');
                fetchStats(); // Update UI immediately
            }
        } catch (err) {
            setLastScanStatus({ type: 'error', message: '网络错误' });
            speak('网络错误');
        }

        // Clear status after 3s
        setTimeout(() => setLastScanStatus(null), 3000);
    };

    const speak = (text) => {
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = 'zh-CN';
        window.speechSynthesis.speak(msg);
    };

    // --- 3. Order Details Popover ---
    const [popover, setPopover] = useState({ show: false, x: 0, y: 0, order: null, loading: false });
    const popoverRef = useRef(null);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setPopover(prev => ({ ...prev, show: false }));
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleOrderClick = async (e, orderId) => {
        e.stopPropagation(); // Prevent double trigger
        if (!orderId) return;

        // Calculate position: Show to the right of the mouse, or slightly below
        // Adjust if close to screen edge (simple safeguard)
        let x = e.clientX + 20;
        let y = e.clientY - 50;

        // Prevent going off-screen (approximate width 300px)
        if (x + 320 > window.innerWidth) {
            x = e.clientX - 340; // Flip to left
        }

        setPopover({ show: true, x, y, order: null, loading: true });

        try {
            const res = await fetch(`${API_BASE_URL}/orders/${orderId}`);
            if (res.ok) {
                const data = await res.json();
                setPopover(prev => ({ ...prev, order: data, loading: false }));
            } else {
                setPopover(prev => ({ ...prev, show: false }));
                toast.error("无法获取订单详情");
            }
        } catch (err) {
            console.error(err);
            setPopover(prev => ({ ...prev, show: false }));
        }
    };

    const OrderPopover = () => {
        if (!popover.show) return null;
        const { order, loading } = popover;

        return (
            <div
                ref={popoverRef}
                className="fixed z-50 bg-white rounded shadow-2xl border border-gray-200 w-80 text-sm animate-scale-up origin-top-left"
                style={{ top: popover.y, left: popover.x }}
            >
                {loading ? (
                    <div className="p-4 text-center text-gray-400">加载中...</div>
                ) : order ? (
                    <>
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center rounded-t">
                            <span className="font-bold text-gray-800 font-mono">{order.order_no}</span>
                            <span className="px-2 py-0.5 rounded bg-black text-white text-xs">{order.status}</span>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <div className="text-gray-500 text-xs mb-1">客户信息</div>
                                <div className="font-medium">{order.customer_name} <span className="text-gray-400 font-mono ml-1">{order.phone}</span></div>
                            </div>
                            <div>
                                <div className="text-gray-500 text-xs mb-1">产品 ({order.products?.length || 0})</div>
                                <div className="max-h-24 overflow-y-auto bg-gray-50 p-2 rounded">
                                    {order.products?.map((p, i) => (
                                        <div key={i} className="flex justify-between text-xs mb-1">
                                            <span>{p.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {order.remark && (
                                <div className="text-xs bg-yellow-50 text-yellow-800 p-2 rounded">
                                    备注: {order.remark}
                                </div>
                            )}
                        </div>
                    </>
                ) : null}
            </div>
        );
    };

    // --- 4. UI Components ---

    // 领奖台 (Podium) - Light Theme
    const Podium = ({ workers }) => {
        const top3 = [workers[0], workers[1], workers[2]];

        return (
            <div className="flex items-end justify-center space-x-2 h-32">
                {/* 2nd Place */}
                <div className="flex flex-col items-center w-24">
                    <div className="text-gray-600 font-bold text-sm truncate w-full text-center">{top3[1]?.name || '-'}</div>
                    <div className="w-full bg-gray-100 h-16 flex items-end justify-center border-t-2 border-gray-300 relative shadow-sm rounded-t">
                        <span className="text-xl font-bold text-gray-800 mb-1">{top3[1]?.count || 0}</span>
                        <div className="absolute -top-2 w-5 h-5 bg-gray-300 text-white text-[10px] font-bold rounded-full flex items-center justify-center">2</div>
                    </div>
                </div>
                {/* 1st Place */}
                <div className="flex flex-col items-center w-28">
                    <div className="text-black font-bold text-base mb-1 truncate w-full text-center">{top3[0]?.name || '-'}</div>
                    <div className="w-full bg-yellow-50 h-24 flex items-end justify-center border-t-4 border-yellow-400 relative shadow-md rounded-t z-10">
                        <span className="text-3xl font-black text-black mb-1">{top3[0]?.count || 0}</span>
                        <div className="absolute -top-3 text-yellow-500">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                        </div>
                    </div>
                </div>
                {/* 3rd Place */}
                <div className="flex flex-col items-center w-24">
                    <div className="text-gray-500 font-bold text-xs truncate w-full text-center">{top3[2]?.name || '-'}</div>
                    <div className="w-full bg-gray-50 h-12 flex items-end justify-center border-t-2 border-gray-200 relative shadow-sm rounded-t">
                        <span className="text-lg font-bold text-gray-400 mb-1">{top3[2]?.count || 0}</span>
                        <div className="absolute -top-2 w-5 h-5 bg-gray-200 text-white text-[10px] font-bold rounded-full flex items-center justify-center">3</div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 text-black p-8 font-sans overflow-hidden flex flex-col">
            {/* Header: Title | Podium | Total */}
            <div className="flex justify-between items-end mb-6 bg-white p-4 rounded shadow-sm border border-gray-200">
                {/* Left: Title */}
                <div className="w-1/4">
                    <h1 className="text-3xl font-black tracking-tight text-black">
                        生产实时大屏
                    </h1>
                    <p className="text-gray-400 text-sm mt-1 uppercase tracking-widest font-medium">Production Dashboard</p>
                </div>

                {/* Center: Top 3 Podium */}
                <div className="flex-1 flex justify-center -mb-4">
                    <Podium workers={stats.leaderboard || []} />
                </div>

                {/* Right: Total Output */}
                <div className="w-1/4 text-right">
                    <div className="text-6xl font-mono font-black text-black tracking-tighter">{stats.today_output}</div>
                    <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mt-1">今日累计工序 (Total Process)</div>
                </div>
            </div>

            {/* Main Grid */}
            {/* Main Content: 3 Columns */}
            <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">

                {/* Left Column: 3-Day Task Overview */}
                <div className="col-span-4 bg-white rounded flex flex-col shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h2 className="text-lg font-bold text-black border-l-4 border-blue-600 pl-3">三日任务概览</h2>
                        <span className="text-xs text-gray-400">Order Overview</span>
                    </div>
                    <div className="p-2 border-b border-gray-100 grid grid-cols-12 text-xs font-bold text-gray-500 bg-white">
                        <div className="col-span-3 pl-2">客户</div>
                        <div className="col-span-4">产品</div>
                        <div className="col-span-3 text-center">截止</div>
                        <div className="col-span-2 text-right pr-2">状态</div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                        {(stats.upcoming_orders || []).map((order, idx) => {
                            const isToday = new Date(order.deadline).toDateString() === new Date().toDateString();
                            return (
                                <div key={order.ID || idx} className="grid grid-cols-12 py-3 px-2 border-b border-gray-50 hover:bg-blue-50 transition-colors items-center text-sm">
                                    <div className="col-span-3 font-medium text-gray-900 truncate pl-2" title={order.customer_name}>{order.customer_name}</div>
                                    <div className="col-span-4 text-gray-600 text-xs">
                                        {(order.products || []).map(p => p.name).join(", ")}
                                    </div>
                                    <div className={`col-span-3 text-center text-xs px-1 py-0.5 rounded ${isToday ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                                        {new Date(order.deadline).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                                    </div>
                                    <div className="col-span-2 text-right pr-2">
                                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{order.status}</span>
                                    </div>
                                </div>
                            )
                        })}
                        {(stats.upcoming_orders || []).length === 0 && (
                            <div className="p-10 text-center text-gray-400 text-sm">暂无三天内任务</div>
                        )}
                    </div>
                </div>

                {/* Center Column: Work Logs */}
                <div className="col-span-5 bg-white rounded flex flex-col shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h2 className="text-lg font-bold text-black border-l-4 border-green-500 pl-3">工序记录</h2>
                        <div className="flex items-center">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2"></span>
                            <span className="text-xs text-gray-400">Live Activity</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {(stats.recent_logs || []).map((log, idx) => (
                            <div
                                key={log.ID || idx}
                                className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-all ${log.order_id ? 'cursor-pointer group' : ''}`}
                                onClick={(e) => log.order_id && handleOrderClick(e, log.order_id)}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center">
                                        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${log.is_success ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                        <span className="font-bold text-gray-900 mr-2">{log.worker_name}</span>
                                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{log.station}</span>
                                    </div>
                                    <span className="text-xs text-gray-400 font-mono">
                                        {new Date(log.ID ? log.CreatedAt : Date.now()).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-600 pl-3.5 border-l-2 border-gray-100 ml-0.5">
                                    {log.message}
                                    {log.order_id && <span className="ml-2 text-blue-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity">查看 &rarr;</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Overlay for Last Action Feedback */}
                    {lastScanStatus && (
                        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 min-w-[300px] p-4 shadow-2xl border ${lastScanStatus.type === 'success' ? 'bg-white border-green-500 text-green-700' : 'bg-red-600 border-red-700 text-white'
                            } animate-bounce-up transition-all z-50 rounded-lg text-center`}>
                            <h3 className="text-lg font-bold flex items-center justify-center">
                                {lastScanStatus.type === 'success' ? (
                                    <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                    <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                                )}
                                {lastScanStatus.message}
                            </h3>
                        </div>
                    )}
                </div>

                {/* Right Column: Error Logs & Station Distribution */}
                <div className="col-span-3 flex flex-col gap-6 h-full min-h-0">
                    {/* Top: Error Logs (60%) */}
                    <div className="bg-white rounded flex flex-col shadow-sm border border-gray-200 overflow-hidden h-[60%]">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold text-black border-l-4 border-red-500 pl-3">异常记录</h2>
                            <span className="text-xs text-gray-400">Errors</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                            {(stats.error_logs || []).map((log, idx) => (
                                <div key={log.ID || idx} className="p-3 bg-red-50/50 rounded border border-red-100">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-red-800 text-sm">{log.worker_name || '未知员工'}</span>
                                        <span className="text-xs text-red-400">{new Date(log.CreatedAt).toLocaleTimeString()}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 break-all font-mono bg-white p-1.5 rounded border border-red-50 mb-1">
                                        {log.content}
                                    </div>
                                    <div className="text-xs text-red-600 font-medium">
                                        {log.message}
                                    </div>
                                </div>
                            ))}
                            {(stats.error_logs || []).length === 0 && (
                                <div className="text-center py-10 text-gray-400 text-sm">
                                    无异常记录
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom: Station Distribution (40%) */}
                    <div className="bg-white rounded flex flex-col shadow-sm border border-gray-200 overflow-hidden h-[40%]">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold text-black border-l-4 border-purple-500 pl-3">工位分布</h2>
                            <span className="text-xs text-gray-400">Station Dist</span>
                        </div>
                        <div className="flex-1 p-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.station_dist || []}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={70}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {(stats.station_dist || []).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][index % 6]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend
                                        layout="vertical"
                                        verticalAlign="middle"
                                        align="right"
                                        wrapperStyle={{ fontSize: '10px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

            </div>



            {popover.show && <OrderPopover />}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f5f9; 
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1; 
                    border-radius: 2px;
                }
                 @keyframes bounce-up {
                    0% { transform: translateY(50px); opacity: 0; }
                    80% { transform: translateY(-5px); opacity: 1; }
                    100% { transform: translateY(0); opacity: 1; }
                }
                .animate-bounce-up {
                    animation: bounce-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                 @keyframes scale-up {
                    0% { transform: scale(0.9); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-scale-up {
                    animation: scale-up 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                @keyframes fade-in {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
                .animate-fade-in {
                     animation: fade-in 0.2s ease-out;
                }
            `}</style>
        </div >
    );
};

export default Station;
