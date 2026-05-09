import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useSearchParams } from 'react-router-dom';
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
import { Activity, Users, FileText, Calendar, LogOut, Stethoscope, IndianRupee, Shield, BookOpen, Settings as SettingsIcon, Globe, CreditCard, BarChart3, Menu, X, ChevronDown } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import PreLoader from './components/PreLoader';
import TokenManager from './components/TokenManager';

const Layout = ({ children }) => {
  const { userData, subscription, activeLabId, setActiveLabId } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    return localStorage.getItem('theme_pref') === 'dark';
  });
  const [labs, setLabs] = React.useState([]);
  const [labsLoading, setLabsLoading] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isReportExpanded, setIsReportExpanded] = React.useState(() => {
    return location.pathname.startsWith('/reports');
  });

  // Close mobile menu on route change
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
    if (location.pathname.startsWith('/reports')) {
      setIsReportExpanded(true);
    }
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
    <div className={`h-screen flex flex-col md:flex-row ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-sky-50 text-gray-900'} overflow-hidden`}>
      
      {/* Mobile Header (Top Bar) */}
      <header className="md:hidden bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
          <Link to="/dashboard" className="flex items-center gap-3 active:scale-95 transition-transform group">
            <div className="w-10 h-10 bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden flex items-center justify-center p-1 group-hover:shadow-brand-primary/20">
              <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-black bg-clip-text text-brand-dark tracking-tighter uppercase group-hover:text-brand-primary transition-colors">
              Lab <span className="text-brand-primary group-hover:text-brand-dark transition-colors">Mitra</span>
            </h1>
          </Link>
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
          className="md:hidden fixed inset-0 bg-brand-dark/60 backdrop-blur-md z-[60] transition-opacity animate-in fade-in duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-[70] w-64 bg-[#1b2b4d] shadow-2xl flex flex-col border-r border-white/5 transition-transform duration-500 transform 
        md:relative md:translate-x-0 md:w-56 md:h-full md:shrink-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <Link 
            to={userData?.role === 'SuperAdmin' ? (activeLabId ? '/dashboard' : '/superadmin') : '/dashboard'} 
            className="flex items-center space-x-3 group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 bg-white rounded-xl shadow-md border border-slate-200/50 overflow-hidden flex items-center justify-center p-1.5 transition-all duration-500 group-hover:scale-105 group-hover:rotate-3">
              <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tighter uppercase transition-colors group-hover:text-[#8bc971]">
              Lab <span className="text-[#8bc971] group-hover:text-white transition-colors">Mitra</span>
            </h1>
          </Link>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-white/50 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-3 flex flex-col gap-1 flex-grow overflow-y-auto custom-scrollbar">
          {userData?.role === 'SuperAdmin' && (
            <div className="mb-4 px-2">
              <label className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] mb-1.5 block flex items-center gap-2">
                <Shield className="w-3 h-3 text-[#8bc971]" />
                Select Lab
              </label>
              <select 
                className="w-full bg-white/5 border border-white/10 text-white text-[12px] rounded-lg focus:ring-[#8bc971] focus:border-[#8bc971] block p-2.5 font-medium tracking-tight outline-none"
                value={activeLabId || ''}
                onChange={(e) => setActiveLabId(e.target.value || null)}
              >
                <option value="" className="bg-[#1b2b4d]">Global Overview</option>
                {labs.map(lab => (
                  <option key={lab.id} value={lab.labId} className="bg-[#1b2b4d]">
                    {lab.labName || lab.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1.5 mt-2 ml-3">Navigation</div>

          {userData?.role === 'SuperAdmin' && (
            <Link 
              to="/superadmin" 
              className={`flex items-center space-x-3 px-4 py-2 rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${location.pathname === '/superadmin' ? 'bg-[#8bc971] text-white' : 'text-[#8a98af] hover:bg-white/5 hover:text-white'}`}
            >
              <Shield className={`h-4.5 w-4.5 ${location.pathname === '/superadmin' ? 'text-white' : 'group-hover:text-[#8bc971]'}`} />
              <span>SuperAdmin</span>
            </Link>
          )}
          
          <Link 
            to={userData?.role === 'SuperAdmin' ? (activeLabId ? '/dashboard' : '/superadmin') : '/dashboard'} 
            className={`flex items-center space-x-3 px-4 py-2 rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${location.pathname === '/dashboard' ? 'bg-[#8bc971] text-white shadow-lg shadow-[#8bc971]/20' : 'text-[#8a98af] hover:bg-white/5 hover:text-white'}`}
          >
            <Activity className={`h-4.5 w-4.5 ${location.pathname === '/dashboard' ? 'text-white' : 'group-hover:text-[#8bc971]'}`} />
            <span className="relative z-10">Dashboard</span>
          </Link>
          
          {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_add_patients) && (
            <Link 
              to="/patients" 
              className={`flex items-center space-x-3 px-4 py-2 rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${location.pathname === '/patients' ? 'bg-[#8bc971] text-white shadow-lg shadow-[#8bc971]/20' : 'text-[#8a98af] hover:bg-white/5 hover:text-white'}`}
            >
              <Users className={`h-4.5 w-4.5 ${location.pathname === '/patients' ? 'text-white' : 'group-hover:text-[#8bc971]'}`} />
              <span className="relative z-10">Patients</span>
            </Link>
          )}
          
          {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_manage_doctors) && (
            <Link 
              to="/doctors" 
              className={`flex items-center space-x-3 px-4 py-2 rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${location.pathname === '/doctors' ? 'bg-[#8bc971] text-white shadow-lg shadow-[#8bc971]/20' : 'text-[#8a98af] hover:bg-white/5 hover:text-white'}`}
            >
              <Stethoscope className={`h-4.5 w-4.5 ${location.pathname === '/doctors' ? 'text-white' : 'group-hover:text-[#8bc971]'}`} />
              <span className="relative z-10">Doctors</span>
            </Link>
          )}
          
          {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_manage_masters) && (
            <Link 
              to="/tests" 
              className={`flex items-center space-x-3 px-4 py-2 rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${location.pathname === '/tests' ? 'bg-[#8bc971] text-white shadow-lg shadow-[#8bc971]/20' : 'text-[#8a98af] hover:bg-white/5 hover:text-white'}`}
            >
              <FileText className={`h-4.5 w-4.5 ${location.pathname === '/tests' ? 'text-white' : 'group-hover:text-[#8bc971]'}`} />
              <span className="relative z-10">Tests</span>
            </Link>
          )}

          {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_book_tests) && (
            <Link 
              to="/bookings" 
              className={`flex items-center space-x-3 px-4 py-2 rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${location.pathname === '/bookings' ? 'bg-[#8bc971] text-white shadow-lg shadow-[#8bc971]/20' : 'text-[#8a98af] hover:bg-white/5 hover:text-white'}`}
            >
              <Calendar className={`h-4.5 w-4.5 ${location.pathname === '/bookings' ? 'text-white' : 'group-hover:text-[#8bc971]'}`} />
              <span className="relative z-10">Booking</span>
            </Link>
          )}

          {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_view_billing) && (
            <Link 
              to="/billing" 
              className={`flex items-center space-x-3 px-4 py-2 rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${location.pathname === '/billing' ? 'bg-[#8bc971] text-white shadow-lg shadow-[#8bc971]/20' : 'text-[#8a98af] hover:bg-white/5 hover:text-white'}`}
            >
              <IndianRupee className={`h-4.5 w-4.5 ${location.pathname === '/billing' ? 'text-white' : 'group-hover:text-[#8bc971]'}`} />
              <span className="relative z-10">Bills</span>
            </Link>
          )}
          
          <Link 
            to="/reports" 
            className={`flex items-center space-x-3 px-4 py-2 rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${location.pathname.startsWith('/reports') ? 'bg-[#8bc971] text-white shadow-lg shadow-[#8bc971]/20' : 'text-[#8a98af] hover:bg-white/5 hover:text-white'}`}
          >
            <FileText className={`h-4.5 w-4.5 ${location.pathname.startsWith('/reports') ? 'text-white' : 'group-hover:text-[#8bc971]'}`} />
            <span className="relative z-10">Reports</span>
          </Link>

          {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_view_analytics) && (
            <Link 
              to="/analytics" 
              className={`flex items-center space-x-3 px-4 py-2 rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${location.pathname === '/analytics' ? 'bg-[#8bc971] text-white shadow-lg shadow-[#8bc971]/20' : 'text-[#8a98af] hover:bg-white/5 hover:text-white'}`}
            >
              <BarChart3 className={`h-4.5 w-4.5 ${location.pathname === '/analytics' ? 'text-white' : 'group-hover:text-[#8bc971]'}`} />
              <span className="relative z-10">Analytics</span>
            </Link>
          )}

          {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_access_settings) && (
            <Link 
              to="/settings" 
              className={`flex items-center space-x-3 px-4 py-2 rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${location.pathname === '/settings' ? 'bg-[#8bc971] text-white shadow-lg shadow-[#8bc971]/20' : 'text-[#8a98af] hover:bg-white/5 hover:text-white'}`}
            >
              <SettingsIcon className={`h-4.5 w-4.5 ${location.pathname === '/settings' ? 'text-white' : 'group-hover:text-[#8bc971]'}`} />
              <span className="relative z-10">Settings</span>
            </Link>
          )}
        </div>

        {/* --- TOKEN MANAGEMENT (LabAdmin Only) --- */}
        {userData?.role === 'LabAdmin' && <TokenManager />}

        <div className="p-3 border-t border-white/5 mt-auto">
          <div className="flex items-center mb-2.5 bg-white/5 p-2 rounded-xl border border-white/5 group cursor-pointer hover:bg-white/10 transition-all duration-300">
            <div className="h-8 w-8 min-w-[32px] rounded-lg bg-[#8bc971] flex items-center justify-center text-[#1b2b4d] font-bold text-sm mr-3">
              {userData?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-[13px] font-semibold text-white truncate tracking-tight group-hover:text-[#8bc971] transition-colors">{userData?.name || 'User'}</p>
              <p className="text-[9px] font-bold text-[#8a98af] uppercase tracking-wider truncate">{userData?.role || 'Staff'}</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-3 py-1.5 px-4 border border-rose-500/30 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all duration-300 group"
          >
            <LogOut className="h-3.5 w-3.5 opacity-80 group-hover:scale-110 transition-transform duration-300" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Logout</span>
          </button>
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
          <ProtectedRoute allowedRoles={['LabAdmin', 'Staff', 'SuperAdmin']}>
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
          <ProtectedRoute allowedRoles={['LabAdmin', 'Staff', 'SuperAdmin']}>
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
          <ProtectedRoute allowedRoles={['LabAdmin', 'SuperAdmin', 'Staff']}>
            <Layout>
              <BusinessAnalytics />
            </Layout>
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/settings" 
        element={
          <ProtectedRoute allowedRoles={['LabAdmin', 'SuperAdmin', 'Staff']}>
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
