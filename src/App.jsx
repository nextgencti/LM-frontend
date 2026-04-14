import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Tests from './pages/Tests';
import MasterParameters from './pages/MasterParameters';
import Doctors from './pages/Doctors';
import Bookings from './pages/Bookings';
import Reports from './pages/Reports';
import ParameterSettings from './pages/ParameterSettings';
import Bills from './pages/Bills';
import ResultEntry from './pages/ResultEntry';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Settings from './pages/Settings';
import BusinessAnalytics from './pages/BusinessAnalytics';
import Home from './pages/Home';
import Signup from './pages/Signup';
import AboutUs from './pages/AboutUs';
import PublicReportView from './pages/PublicReportView';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { Activity, Users, FileText, Calendar, LogOut, Stethoscope, IndianRupee, Shield, BookOpen, Settings as SettingsIcon, Globe, CreditCard, BarChart3, Menu, X } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import PreLoader from './components/PreLoader';

const Layout = ({ children }) => {
  const { userData, subscription, activeLabId, setActiveLabId } = useAuth();
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    return localStorage.getItem('theme_pref') === 'dark';
  });
  const [labs, setLabs] = React.useState([]);
  const [labsLoading, setLabsLoading] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Close mobile menu on route change
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);


  React.useEffect(() => {
    if (userData?.role === 'SuperAdmin') {
      fetchLabs();
    }
  }, [userData]);

  const fetchLabs = async () => {
    setLabsLoading(true);
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      const querySnapshot = await getDocs(collection(db, 'labs'));
      const labsList = [];
      querySnapshot.forEach((doc) => {
        labsList.push({ id: doc.id, ...doc.data() });
      });
      setLabs(labsList);
    } catch (error) {
      console.error('Error fetching labs for selector:', error);
    } finally {
      setLabsLoading(false);
    }
  };
  
  const handleLogout = async () => {
    sessionStorage.removeItem('superadmin_pin_verified');
    await signOut(auth);
  };

  return (
    <div className={`h-screen flex flex-col md:flex-row ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-gray-50 text-gray-900'} overflow-hidden`}>
      
      {/* Mobile Header (Top Bar) */}
      <header className="md:hidden bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
          <div className="w-10 h-10 bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden flex items-center justify-center p-1">
            <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-black bg-clip-text text-brand-dark tracking-tighter uppercase">
            Lab <span className="text-brand-primary">Mitra</span>
          </h1>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-slate-50 rounded-xl text-brand-dark hover:bg-slate-100 transition-colors"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-brand-dark/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl flex flex-col border-r border-slate-100 transition-transform duration-300 transform 
        md:relative md:translate-x-0 md:w-64 md:shadow-xl md:h-full md:shrink-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden flex items-center justify-center p-1 transition-transform group-hover:scale-110">
              <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-black text-brand-dark tracking-tighter uppercase">
              Lab <span className="text-brand-primary">Mitra</span>
            </h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-brand-dark">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-4 flex flex-col gap-1.5 flex-grow overflow-y-auto custom-scrollbar">
          {userData?.role === 'SuperAdmin' && (
            <div className="mb-6 px-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block flex items-center gap-2">
                <Shield className="w-3 h-3 text-brand-primary" />
                Select Lab
              </label>
              <select 
                className="w-full bg-brand-light/20 border border-brand-primary/10 text-brand-dark text-sm rounded-xl focus:ring-brand-primary focus:border-brand-primary block p-3 font-bold tracking-tight"
                value={activeLabId || ''}
                onChange={(e) => setActiveLabId(e.target.value || null)}
              >
                <option value="">Global Overview</option>
                {labs.map(lab => (
                  <option key={lab.id} value={lab.labId}>
                    {lab.labName || lab.id}
                  </option>
                ))}
              </select>
              {activeLabId ? (
                <p className="mt-2 text-[9px] text-brand-primary font-black uppercase tracking-widest bg-brand-primary/5 px-2 py-1 rounded-full text-center">● Lab Management Active</p>
              ) : (
                <p className="mt-2 text-[9px] text-brand-secondary font-black uppercase tracking-widest bg-brand-secondary/5 px-2 py-1 rounded-full text-center">● SuperAdmin Overview</p>
              )}
            </div>
          )}

          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 mt-2 ml-3">Menu</div>

          {userData?.role === 'SuperAdmin' && (
            <Link 
              to="/superadmin" 
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all relative overflow-hidden group ${location.pathname === '/superadmin' ? 'bg-brand-dark text-white shadow-lg shadow-brand-dark/20' : 'bg-brand-light/20 text-brand-dark hover:bg-brand-light/50 border border-brand-primary/10'}`}
            >
              {location.pathname === '/superadmin' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-primary rounded-r-full" />}
              <Shield className="h-5 w-5" />
              <span>SuperAdmin</span>
            </Link>
          )}
          
          <Link 
            to={userData?.role === 'SuperAdmin' ? (activeLabId ? '/dashboard' : '/superadmin') : '/dashboard'} 
            className={`flex items-center space-x-3 px-4 py-3.5 rounded-2xl font-black text-sm transition-all relative overflow-hidden group ${location.pathname === '/dashboard' ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20' : 'text-slate-400 hover:bg-brand-light/50 hover:text-brand-dark'}`}
          >
            {location.pathname === '/dashboard' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-primary rounded-r-full" />}
            <Activity className={`h-5 w-5 ${location.pathname === '/dashboard' ? 'text-brand-light' : 'group-hover:text-brand-primary transition-colors'}`} />
            <span>Dashboard</span>
          </Link>
          
          {(userData?.role !== 'Staff' || userData?.permissions?.can_add_patients) && (
            <Link 
              to="/patients" 
              className={`flex items-center space-x-3 px-4 py-3.5 rounded-2xl font-black text-sm transition-all relative overflow-hidden group ${location.pathname === '/patients' ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20' : 'text-slate-400 hover:bg-brand-light/50 hover:text-brand-dark'}`}
            >
              {location.pathname === '/patients' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-primary rounded-r-full" />}
              <Users className={`h-5 w-5 ${location.pathname === '/patients' ? 'text-brand-light' : 'group-hover:text-brand-primary transition-colors'}`} />
              <span>Patients</span>
            </Link>
          )}
          
          {(userData?.role !== 'Staff' || userData?.permissions?.can_manage_masters) && (
            <Link 
              to="/doctors" 
              className={`flex items-center space-x-3 px-4 py-3.5 rounded-2xl font-black text-sm transition-all relative overflow-hidden group ${location.pathname === '/doctors' ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20' : 'text-slate-400 hover:bg-brand-light/50 hover:text-brand-dark'}`}
            >
              {location.pathname === '/doctors' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-primary rounded-r-full" />}
              <Stethoscope className={`h-5 w-5 ${location.pathname === '/doctors' ? 'text-brand-light' : 'group-hover:text-brand-primary transition-colors'}`} />
              <span>Doctors</span>
            </Link>
          )}
          
          {(userData?.role !== 'Staff' || userData?.permissions?.can_manage_masters) && (
            <Link 
              to="/tests" 
              className={`flex items-center space-x-3 px-4 py-3.5 rounded-2xl font-black text-sm transition-all relative overflow-hidden group ${location.pathname === '/tests' ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20' : 'text-slate-400 hover:bg-brand-light/50 hover:text-brand-dark'}`}
            >
              {location.pathname === '/tests' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-primary rounded-r-full" />}
              <FileText className={`h-5 w-5 ${location.pathname === '/tests' ? 'text-brand-light' : 'group-hover:text-brand-primary transition-colors'}`} />
              <span>Tests</span>
            </Link>
          )}

          {(userData?.role !== 'Staff' || userData?.permissions?.can_book_tests) && (
            <Link 
              to="/bookings" 
              className={`flex items-center space-x-3 px-4 py-3.5 rounded-2xl font-black text-sm transition-all relative overflow-hidden group ${location.pathname === '/bookings' ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20' : 'text-slate-400 hover:bg-brand-light/50 hover:text-brand-dark'}`}
            >
              {location.pathname === '/bookings' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-primary rounded-r-full" />}
              <Calendar className={`h-5 w-5 ${location.pathname === '/bookings' ? 'text-brand-light' : 'group-hover:text-brand-primary transition-colors'}`} />
              <span>Bookings</span>
            </Link>
          )}

          {(userData?.role !== 'Staff' || userData?.permissions?.can_view_billing) && (
            <Link 
              to="/billing" 
              className={`flex items-center space-x-3 px-4 py-3.5 rounded-2xl font-black text-sm transition-all relative overflow-hidden group ${location.pathname === '/billing' ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20' : 'text-slate-400 hover:bg-brand-light/50 hover:text-brand-dark'}`}
            >
              {location.pathname === '/billing' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-primary rounded-r-full" />}
              <IndianRupee className={`h-5 w-5 ${location.pathname === '/billing' ? 'text-brand-light' : 'group-hover:text-brand-primary transition-colors'}`} />
              <span>Bills</span>
            </Link>
          )}
          
          <Link 
            to="/reports" 
            className={`flex items-center space-x-3 px-4 py-3.5 rounded-2xl font-black text-sm transition-all relative overflow-hidden group ${location.pathname === '/reports' ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20' : 'text-slate-400 hover:bg-brand-light/50 hover:text-brand-dark'}`}
          >
            {location.pathname === '/reports' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-primary rounded-r-full" />}
            <FileText className={`h-5 w-5 ${location.pathname === '/reports' ? 'text-brand-light' : 'group-hover:text-brand-primary transition-colors'}`} />
            <span>Reports</span>
          </Link>

          {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin') && (
            <Link 
              to="/analytics" 
              className={`flex items-center space-x-3 px-4 py-3.5 rounded-2xl font-black text-sm transition-all relative overflow-hidden group ${location.pathname === '/analytics' ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20' : 'text-slate-400 hover:bg-brand-light/50 hover:text-brand-dark'}`}
            >
              {location.pathname === '/analytics' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-primary rounded-r-full" />}
              <BarChart3 className={`h-5 w-5 ${location.pathname === '/analytics' ? 'text-brand-light' : 'group-hover:text-brand-primary transition-colors'}`} />
              <span>Analytics</span>
            </Link>
          )}

          {(userData?.role !== 'Staff' || userData?.permissions?.can_access_settings) && (
            <Link 
              to="/settings" 
              className={`flex items-center space-x-3 px-4 py-3.5 rounded-2xl font-black text-sm transition-all relative overflow-hidden group ${location.pathname === '/settings' ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20' : 'text-slate-400 hover:bg-brand-light/50 hover:text-brand-dark'}`}
            >
              {location.pathname === '/settings' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-primary rounded-r-full" />}
              <SettingsIcon className={`h-5 w-5 ${location.pathname === '/settings' ? 'text-brand-light' : 'group-hover:text-brand-primary transition-colors'}`} />
              <span>Lab Settings</span>
            </Link>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50/80 mt-auto">
          <div className="flex items-center mb-5 bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
            <div className="h-10 w-10 min-w-[40px] rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary font-black tracking-tight text-lg shadow-inner mr-3">
              {userData?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-black text-gray-900 truncate tracking-tight">{userData?.name || 'User'}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">{userData?.role || 'Staff'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="flex flex-col items-center justify-center py-2 px-1 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:shadow-sm transition-all focus:ring-2 focus:ring-gray-200"
              title="Toggle Theme"
            >
              <span className="text-lg mb-1">{isDarkMode ? '☀️' : '🌙'}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Theme</span>
            </button>
            
            <button 
              onClick={handleLogout}
              className="flex flex-col items-center justify-center py-2 px-1 bg-white border border-rose-100 text-rose-600 rounded-xl hover:bg-rose-50 hover:border-rose-200 hover:shadow-sm transition-all pointer-events-auto focus:ring-2 focus:ring-rose-200"
              title="Logout from Lab Mitra"
            >
              <LogOut className="h-5 w-5 mb-1 opacity-80" />
              <span className="text-[9px] font-black uppercase tracking-widest">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-10">
        {children}
      </main>
    </div>
  );
};

function App() {
  const { loading } = useAuth();

  if (loading) {
    return <PreLoader message="Verifying Cloud Identity" />;
  }

  return (
    <>
      <ToastContainer position="bottom-right" autoClose={3000} hideProgressBar={false} closeOnClick pauseOnHover theme="colored" />
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/about" element={<AboutUs />} />
      
      {/* Protected Routes wrapped in Layout */}
      <Route 
        path="/superadmin" 
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin']}>
            <Layout>
              <SuperAdminDashboard />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['LabAdmin', 'Staff', 'SuperAdmin']}>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/patients" 
        element={
          <ProtectedRoute allowedRoles={['LabAdmin', 'Staff', 'SuperAdmin']}>
            <Layout>
              <Patients />
            </Layout>
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/doctors" 
        element={
          <ProtectedRoute allowedRoles={['LabAdmin', 'Staff', 'SuperAdmin']}>
            <Layout>
              <Doctors />
            </Layout>
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/tests" 
        element={
          <ProtectedRoute allowedRoles={['LabAdmin', 'Staff', 'SuperAdmin']}>
            <Layout>
              <Tests />
            </Layout>
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/tests/:testId/parameters" 
        element={
          <ProtectedRoute allowedRoles={['LabAdmin']}>
            <Layout>
              <ParameterSettings />
            </Layout>
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/master-parameters" 
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin']}>
            <Layout>
              <MasterParameters />
            </Layout>
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/bookings" 
        element={
          <ProtectedRoute allowedRoles={['LabAdmin', 'Staff', 'SuperAdmin']}>
            <Layout>
              <Bookings />
            </Layout>
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/billing" 
        element={
          <ProtectedRoute allowedRoles={['LabAdmin', 'Staff', 'SuperAdmin']}>
            <Layout>
              <Bills />
            </Layout>
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/reports/:bookingId/results" 
        element={
          <ProtectedRoute allowedRoles={['LabAdmin', 'Staff']}>
            <Layout>
              <ResultEntry />
            </Layout>
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/reports" 
        element={
          <ProtectedRoute allowedRoles={['LabAdmin', 'Staff', 'SuperAdmin']}>
            <Layout>
              <Reports />
            </Layout>
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/analytics" 
        element={
          <ProtectedRoute allowedRoles={['LabAdmin', 'SuperAdmin']}>
            <Layout>
              <BusinessAnalytics />
            </Layout>
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/settings" 
        element={
          <ProtectedRoute allowedRoles={['LabAdmin', 'SuperAdmin']}>
            <Layout>
              <Settings />
            </Layout>
          </ProtectedRoute>
        } 
      />

      {/* Public Secure Report View */}
      <Route path="/v/:token" element={<PublicReportView />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </>
  );
}

export default App;
