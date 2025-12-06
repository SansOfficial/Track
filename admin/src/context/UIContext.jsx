import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

const UIContext = createContext();

export const useUI = () => useContext(UIContext);

export const UIProvider = ({ children }) => {
    // Toast State
    const [toasts, setToasts] = useState([]);

    // Confirm State
    const [confirmConfig, setConfirmConfig] = useState(null);

    // -- Toast Logic --
    const addToast = useCallback((message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 3000);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // -- Confirm Logic --
    const confirm = useCallback((message) => {
        return new Promise((resolve) => {
            setConfirmConfig({
                message,
                onConfirm: () => {
                    setConfirmConfig(null);
                    resolve(true);
                },
                onCancel: () => {
                    setConfirmConfig(null);
                    resolve(false);
                }
            });
        });
    }, []);

    return (
        <UIContext.Provider value={{ toast: { success: (m) => addToast(m, 'success'), error: (m) => addToast(m, 'error') }, confirm }}>
            {children}

            {/* Render Toasts */}
            {createPortal(
                <div className="fixed top-4 right-4 z-[9999] space-y-2">
                    {toasts.map(t => (
                        <div key={t.id} className={`shadow-lg px-6 py-3 border-l-4 text-sm font-medium animate-slide-in min-w-[200px] bg-white text-black ${t.type === 'success' ? 'border-black' : 'border-red-700'
                            }`}>
                            {t.type === 'success' && <span className="mr-2 text-green-600">✓</span>}
                            {t.type === 'error' && <span className="mr-2 text-red-600">✕</span>}
                            {t.message}
                        </div>
                    ))}
                </div>,
                document.body
            )}

            {/* Render Confirm Modal */}
            {confirmConfig && createPortal(
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white p-6 shadow-2xl w-full max-w-sm border border-gray-100 animate-scale-in">
                        <h3 className="text-lg font-bold mb-4">确认操作</h3>
                        <p className="text-gray-600 mb-6">{confirmConfig.message}</p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={confirmConfig.onCancel}
                                className="px-4 py-2 text-gray-500 hover:text-black transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={confirmConfig.onConfirm}
                                className="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors"
                            >
                                确定
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </UIContext.Provider>
    );
};
