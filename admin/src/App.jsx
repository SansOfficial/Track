import React from 'react';
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

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-white font-sans text-gray-900">
        {/* Minimal Sidebar */}
        <aside className="w-64 border-r border-gray-100 flex flex-col bg-white">
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
            <NavLink to="/products">产品管理</NavLink>
            <NavLink to="/workers">工人管理</NavLink>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-10 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<OrderList />} />
            <Route path="/create-order" element={<CreateOrder />} />
            <Route path="/products" element={<ProductManager />} />
            <Route path="/workers" element={<WorkerManager />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
