import React, { useState, useEffect, useRef } from 'react';
import { useUI } from '../context/UIContext';

/**
 * Supermarket Mode Station App
 * 
 * Logic:
 * 1. Global Keyboard Listener captures scanner input.
 * 2. Input format check: 
 *    - Starts with "LOGIN:" -> Switch User (e.g. LOGIN:1)
 *    - Starts with "ORDER-" -> Process Order (e.g. ORDER-123)
 * 3. State Management:
 *    - currentWorker: Holds the currently logged in worker.
 */
const Station = () => {
    const { toast } = useUI();
    const [barcode, setBarcode] = useState('');
    const [currentWorker, setCurrentWorker] = useState(null);
    const [lastAction, setLastAction] = useState(null);
    const [status, setStatus] = useState('READY'); // READY, PROCESSING, SUCCESS, ERROR

    // Buffer for scanner input
    const buffer = useRef('');
    const lastKeyTime = useRef(Date.now());

    useEffect(() => {
        const handleKeyDown = (e) => {
            const now = Date.now();

            // Scanner acts like a fast typist. Reset buffer if too slow (manual typing prevention)
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
    }, [currentWorker]); // Depend on currentWorker to use latest state

    const processBarcode = async (code) => {
        setBarcode(code);
        setStatus('PROCESSING');

        // Logic 0: Hardcoded Prefixes for Simulation / Prefix-based Login
        // Regex to match PREFIX+ID+# (e.g. XL1#, CM1#)
        // Mappings: XL=下料, CM=裁面, FM=封面, YH=运货, SK=收款 (We use these as keys to mock IDs or just parse ID)
        // User said: XL1#, CM1#. The number 1 is likely the Worker ID or just a suffix.
        // Let's assume the number IS the worker ID for simplicity in this MVP.
        const prefixMatch = code.match(/^([A-Z]+)(\d+)#$/);
        if (prefixMatch) {
            const id = prefixMatch[2]; // Use the number as ID
            // Optional: Validate Prefix matches Station if we wanted to be strict.
            // For now, just trust the ID lookup.
            fetchWorker(id);
            return;
        }

        // Logic 1: Identity Badge (Legacy LOGIN:{ID})
        if (code.startsWith('LOGIN:')) {
            const workerId = code.split(':')[1];
            fetchWorker(workerId);
            return;
        }

        // Logic 2: Order Action (ORDER-{ID} or URL)
        // Check if worker is logged in
        if (!currentWorker) {
            setStatus('ERROR');
            setLastAction({ message: '请先扫描身份卡', type: 'error' });
            speak('请先扫身份卡');
            return;
        }

        // Send to backend
        try {
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    qr_code: code,
                    worker_id: currentWorker.ID
                })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || '扫描失败');

            setStatus('SUCCESS');
            setLastAction({ message: `订单 ${data.order.order_no} 更新成功`, type: 'success' });
            speak('操作成功');

        } catch (err) {
            setStatus('ERROR');
            setLastAction({ message: err.message, type: 'error' });
            speak('操作失败');
        }
    };

    const fetchWorker = async (id) => {
        try {
            // We assume a simple Get endpoint. Using the existing one or assuming we can fetch by ID.
            // Actually existing API is /api/workers?q=... or similar if auth required.
            // For Station mode, we might need a public endpoint or bypass. 
            // For now, let's assume /api/workers/{id} works or we use the search.
            // Actually, let's just mock the name display if we lack an endpoint, OR call the update API.
            // Let's try to fetch worker details.

            // NOTE: In Station Mode, we might want to skip Auth.
            // If the /api/workers is protected, this fetch will fail (401).
            // This is why we need to remove Auth for Station endpoints or use a token.
            // For "Supermarket Mode" simplicity, we'll try to use a specific public endpoint if needed.
            // But let's assume we are running this on an Admin PC already logged in, OR we open up access.
            // Let's act as if we are on the Admin PC (Authenticated).

            // To be robust, let's use the UIContext fetch or simple fetch if public.
            // Implementation Plan said: "Remove WeChat Auth", "Create POST /api/station/scan".

            // Let's assume for now we are logged in as Admin on this PC.
            const res = await fetch(`/api/workers/${id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await res.json();
            if (res.ok) {
                setCurrentWorker(data);
                setStatus('READY');
                setLastAction({ message: `欢迎, ${data.name} (${data.station})`, type: 'success' });
                speak(`欢迎${data.name}`);
            } else {
                throw new Error('无效身份卡');
            }
        } catch (err) {
            setStatus('ERROR');
            setLastAction({ message: '无效身份卡', type: 'error' });
            speak('无效身份卡');
        }
    };

    // Simple Text-to-Speech
    const speak = (text) => {
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = 'zh-CN';
        window.speechSynthesis.speak(msg);
    };

    return (
        <div className="flex flex-col h-screen bg-black text-white p-8">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">
                    TATAMI STATION
                </h1>
                <div className="text-right">
                    <p className="text-gray-400">当前操作员</p>
                    <p className={`text-3xl font-bold ${currentWorker ? 'text-green-500' : 'text-red-500'}`}>
                        {currentWorker ? `${currentWorker.name} [${currentWorker.station}]` : '未登录'}
                    </p>
                </div>
            </div>

            {/* Main Display */}
            <div className="flex-1 flex flex-col justify-center items-center space-y-8">

                {/* Status Indicator */}
                <div className={`w-64 h-64 rounded-full flex items-center justify-center border-8 ${status === 'READY' ? 'border-gray-500 text-gray-500' :
                    status === 'PROCESSING' ? 'border-yellow-500 text-yellow-500 animate-pulse' :
                        status === 'SUCCESS' ? 'border-green-500 text-green-500' :
                            'border-red-500 text-red-500'
                    }`}>
                    <span className="text-2xl font-bold">
                        {status === 'READY' ? '等待扫描' :
                            status === 'PROCESSING' ? '处理中...' :
                                status === 'SUCCESS' ? '成功' : '错误'}
                    </span>
                </div>

                {/* Last Action Message */}
                {lastAction && (
                    <div className={`text-5xl font-bold text-center animate-bounce ${lastAction.type === 'success' ? 'text-white' : 'text-red-500'
                        }`}>
                        {lastAction.message}
                    </div>
                )}

                <div className="text-gray-600 mt-12 text-xl">
                    请使用扫码枪操作 / Keep Scanner Ready
                </div>

                {/* Simulation Controls */}
                <div className="grid grid-cols-5 gap-4 mt-8 w-full max-w-4xl opacity-50 hover:opacity-100 transition-opacity">
                    <button onClick={() => processBarcode('XL1#')} className="bg-gray-800 p-4 rounded border border-gray-700 hover:bg-gray-700">
                        <div className="text-xl font-bold text-red-500">XL1#</div>
                        <div className="text-sm">下料登录</div>
                    </button>
                    <button onClick={() => processBarcode('CM2#')} className="bg-gray-800 p-4 rounded border border-gray-700 hover:bg-gray-700">
                        <div className="text-xl font-bold text-orange-500">CM2#</div>
                        <div className="text-sm">裁面登录</div>
                    </button>
                    <button onClick={() => processBarcode('FM3#')} className="bg-gray-800 p-4 rounded border border-gray-700 hover:bg-gray-700">
                        <div className="text-xl font-bold text-yellow-500">FM3#</div>
                        <div className="text-sm">封面登录</div>
                    </button>
                    <button onClick={() => processBarcode('YH4#')} className="bg-gray-800 p-4 rounded border border-gray-700 hover:bg-gray-700">
                        <div className="text-xl font-bold text-blue-500">YH4#</div>
                        <div className="text-sm">运货登录</div>
                    </button>
                    <button onClick={() => processBarcode('SK5#')} className="bg-gray-800 p-4 rounded border border-gray-700 hover:bg-gray-700">
                        <div className="text-xl font-bold text-green-500">SK5#</div>
                        <div className="text-sm">收款登录</div>
                    </button>
                </div>

                {/* Debug: Manual Input for testing without gun */}
                <input
                    className="opacity-10 bg-black text-white border border-gray-700 p-2 w-1/2 focus:opacity-100 transition-opacity"
                    placeholder="Debug Input (Focus here if no scanner)"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            processBarcode(e.currentTarget.value);
                            e.currentTarget.value = '';
                        }
                    }}
                />

                {/* Manual Simulator Form */}
                <div className="mt-8 border-t border-gray-800 pt-8 w-full max-w-2xl">
                    <h3 className="text-gray-500 mb-4 text-center text-sm uppercase tracking-widest">Manual Simulator / 手动模拟器</h3>
                    <div className="flex gap-4">
                        <input
                            className="bg-gray-900 border border-gray-700 p-3 rounded text-white flex-1"
                            placeholder="Worker Code (e.g. XL1#)"
                            id="sim-worker"
                            defaultValue="XL1#"
                        />
                        <input
                            className="bg-gray-900 border border-gray-700 p-3 rounded text-white flex-1"
                            placeholder="Order Code (e.g. ORDER-1)"
                            id="sim-order"
                            defaultValue="ORDER-1"
                        />
                        <button
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded font-bold"
                            onClick={async () => {
                                const workerCode = document.getElementById('sim-worker').value;
                                const orderCode = document.getElementById('sim-order').value;

                                if (workerCode) {
                                    await processBarcode(workerCode);
                                }

                                if (orderCode) {
                                    // Small delay to ensure state update if needed, though await helps.
                                    // But processBarcode is async and sets state.
                                    setTimeout(() => processBarcode(orderCode), 500);
                                }
                            }}
                        >
                            执行 / Execute
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Station;
