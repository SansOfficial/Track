import React from 'react';
import CustomerManager from './pages/CustomerManager';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CreateOrder from './pages/CreateOrder';
import WorkerManager from './pages/WorkerManager';
import ProductManager from './pages/ProductManager';
import OrderList from './pages/OrderList';

// Helper component for Nav Link
const NavLink = ({ to, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`block py-3 px-6 text-sm font-medium transition-all duration-300 border-r-4 ${isActive
        ? 'border-red-700 text-black bg-gray-50'
        : 'border-transparent text-gray-500 hover:text-red-700 hover:bg-gray-50'
        }`}
    >
      {children}
    </Link>
  );
};

import { UIProvider } from './context/UIContext';

import Login from './pages/Login';
import Station from './pages/Station';
import { AuthProvider, useAuth } from './context/AuthContext';

// Protected Route Component
const PrivateRoute = ({ children }) => {
  const { token, loading } = useAuth();
  if (loading) return null; // Or a loading spinner
  return token ? children : <Login />; // If not logged in, show Login (or redirect)
};

// Helper Components for Logout
const LogoutButton = () => {
  const { logout } = useAuth();
  return (
    <button
      onClick={logout}
      className="w-full flex items-center justify-center space-x-2 py-2 border border-gray-300 text-gray-500 hover:text-red-700 hover:border-red-700 transition-colors uppercase text-xs font-bold tracking-widest"
    >
      <span>退出登录 / Logout</span>
    </button>
  );
};

const LogoutIcon = () => {
  const { logout } = useAuth();
  return (
    <button onClick={logout} className="flex flex-col items-center text-xs text-gray-500 hover:text-red-700">
      <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      <span className="mt-1">退出</span>
    </button>
  );
};

function App() {
  return (
    <UIProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </UIProvider>
  );
}

function AppContent() {
  const { token } = useAuth();
  const location = useLocation();

  // If not authenticated and trying to access generic pages, show Login.
  // Actually, PrivateRoute logic covers it, but for Layout rendering (Sidebar), we need to check token.

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/station" element={<Station />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // Station view for authenticated users (skip sidebar)
  if (location.pathname === '/station') {
    return <Station />;
  }

  return (
    <div className="flex h-screen bg-white font-sans text-gray-900 pb-16 md:pb-0">
      {/* Minimal Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 border-r border-gray-100 flex-col bg-white">
        <div className="p-10 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-700 rounded-full mx-auto mb-3 flex items-center justify-center text-white font-serif text-2xl font-bold">
              畳
            </div>
            <h1 className="text-lg font-bold tracking-[0.2em] text-black uppercase">Tatami</h1>
            <p className="text-[10px] text-gray-400 mt-1 tracking-widest uppercase">后台管理</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 mt-6">
          <NavLink to="/">仪表盘</NavLink>
          <NavLink to="/orders">订单列表</NavLink>
          <NavLink to="/customers">客户管理</NavLink>
          <NavLink to="/products">产品管理</NavLink>
          <NavLink to="/workers">工人管理</NavLink>

          <div className="pt-6 mt-6 border-t border-gray-100 px-6">
            <LogoutButton />
          </div>
        </nav>
      </aside>

      {/* Bottom Nav (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex justify-around items-center px-4 py-3 safe-area-pb">
        <Link to="/" className="flex flex-col items-center text-xs text-gray-500 hover:text-black">
          <span className="text-lg">📊</span>
          <span className="mt-1">仪表盘</span>
        </Link>
        <Link to="/orders" className="flex flex-col items-center text-xs text-gray-500 hover:text-black">
          <span className="text-lg">📦</span>
          <span className="mt-1">订单</span>
        </Link>
        <Link to="/customers" className="flex flex-col items-center text-xs text-gray-500 hover:text-black">
          <span className="text-lg">🧑</span>
          <span className="mt-1">客户</span>
        </Link>
        <Link to="/products" className="flex flex-col items-center text-xs text-gray-500 hover:text-black">
          <span className="text-lg">🏷️</span>
          <span className="mt-1">产品</span>
        </Link>
        <Link to="/workers" className="flex flex-col items-center text-xs text-gray-500 hover:text-black">
          <span className="text-lg">👥</span>
          <span className="mt-1">工人</span>
        </Link>
        <LogoutIcon />
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<OrderList />} />
          <Route path="/create-order" element={<CreateOrder />} />
          <Route path="/customers" element={<CustomerManager />} />
          <Route path="/products" element={<ProductManager />} />
          <Route path="/workers" element={<WorkerManager />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
