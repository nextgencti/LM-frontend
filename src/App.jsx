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
import ForgotPassword from './pages/ForgotPassword';
import AboutUs from './pages/AboutUs';
import PublicReportView from './pages/PublicReportView';
import HelpSupport from './pages/HelpSupport';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { Activity, Users, FileText, Calendar, LogOut, Stethoscope, IndianRupee, Shield, BookOpen, Settings as SettingsIcon, Globe, CreditCard, BarChart3, Menu, X, ChevronDown, Clock, HelpCircle } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import PreLoader from './components/PreLoader';
import TokenManager from './components/TokenManager';

const Layout = ({ children }) => {
  const { userData, subscription, activeLabId, setActiveLabId, isDemoLab, demoDaysRemaining } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    return localStorage.getItem('theme_pref') === 'dark';
  });
  const [labs, setLabs] = React.useState([]);
  const [labsLoading, setLabsLoading] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
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

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem('sidebar_collapsed', String(newVal));
      return newVal;
    });
  };

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
    <div className={`h-screen flex flex-col md:flex-row ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-sky-50 text-gray-900'} overflow-hidden print:block print:h-auto print:bg-white print:text-black print:overflow-visible`}>
      
      {/* Mobile Header (Top Bar) */}
      <header className="md:hidden bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm print:hidden">
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
        fixed inset-y-0 left-0 z-[70] w-64 bg-brand-dark shadow-2xl flex flex-col border-r border-white/5 transition-all duration-300 transform 
        md:relative md:translate-x-0 md:h-full md:shrink-0
        ${isSidebarCollapsed ? 'md:w-16' : 'md:w-56'}
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        print:hidden
      `}>
        {/* Floating Desktop Toggle Button (Outside Sidebar border) */}
        <button 
          onClick={toggleSidebar} 
          className="hidden md:flex absolute top-6 -right-3 z-50 w-6 h-6 bg-brand-primary border border-emerald-400/20 rounded-full items-center justify-center text-brand-dark hover:bg-emerald-400 transition-all shadow-[0_0_12px_rgba(16,185,129,0.6)] hover:shadow-[0_0_20px_rgba(16,185,129,0.95)] cursor-pointer group hover:scale-110 active:scale-90"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${isSidebarCollapsed ? '-rotate-90' : 'rotate-90'}`} />
        </button>

        <div className={`border-b border-white/5 flex items-center ${isSidebarCollapsed ? 'p-3 justify-center' : 'p-4 justify-between'}`}>
          <Link 
            to={userData?.role === 'SuperAdmin' ? (activeLabId ? '/dashboard' : '/superadmin') : '/dashboard'} 
            className="flex items-center space-x-3 group cursor-pointer active:scale-95 transition-transform shrink-0"
          >
            <div className={`bg-white rounded-xl shadow-md border border-white/10 overflow-hidden flex items-center justify-center transition-all duration-500 group-hover:scale-105 group-hover:rotate-3 shrink-0 ${isSidebarCollapsed ? 'w-8 h-8 p-1' : 'w-10 h-10 p-1.5'}`}>
              <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
            </div>
            {!isSidebarCollapsed && (
              <h1 className="text-xl font-display font-bold text-white tracking-tighter uppercase transition-colors group-hover:text-brand-primary truncate animate-in fade-in duration-300">
                Lab <span className="text-brand-primary group-hover:text-white transition-colors">Mitra</span>
              </h1>
            )}
          </Link>
          
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-white/50 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-3 flex flex-col gap-1 flex-grow overflow-y-auto custom-scrollbar">
          {userData?.role === 'SuperAdmin' && !isSidebarCollapsed && (
            <div className="mb-4 px-2 animate-in fade-in duration-300">
              <label className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2">
                <Shield className="w-3 h-3 text-brand-primary" />
                Select Lab
              </label>
              <select 
                className="w-full bg-white/5 border border-white/10 text-white text-[12px] rounded-lg focus:ring-brand-primary focus:border-brand-primary block p-2.5 font-medium tracking-tight outline-none"
                value={activeLabId || ''}
                onChange={(e) => setActiveLabId(e.target.value || null)}
              >
                <option value="" className="bg-brand-dark">Global Overview</option>
                {labs.map(lab => (
                  <option key={lab.id} value={lab.labId} className="bg-brand-dark">
                    {lab.labName || lab.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isSidebarCollapsed && (
            <div className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1.5 mt-2 ml-3 animate-in fade-in duration-300">Navigation</div>
          )}

          {userData?.role === 'SuperAdmin' && (
            <Link 
              to="/superadmin" 
              title={isSidebarCollapsed ? "SuperAdmin" : ""}
              className={`flex items-center rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${isSidebarCollapsed ? 'w-9 h-9 justify-center p-0 mx-auto' : 'w-full px-3 py-1.5 space-x-2.5'} ${location.pathname === '/superadmin' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-400 hover:bg-brand-primary/10 hover:text-brand-primary'}`}
            >
              <Shield className={`h-4 w-4 shrink-0 ${location.pathname === '/superadmin' ? 'text-white' : 'group-hover:text-brand-primary'}`} />
              {!isSidebarCollapsed && <span className="relative z-10 animate-in fade-in duration-300">SuperAdmin</span>}
            </Link>
          )}
          
          <Link 
            to={userData?.role === 'SuperAdmin' ? (activeLabId ? '/dashboard' : '/superadmin') : '/dashboard'} 
            title={isSidebarCollapsed ? "Dashboard" : ""}
            className={`flex items-center rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${isSidebarCollapsed ? 'w-9 h-9 justify-center p-0 mx-auto' : 'w-full px-3 py-1.5 space-x-2.5'} ${location.pathname === '/dashboard' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-400 hover:bg-brand-primary/10 hover:text-brand-primary'}`}
          >
            <Activity className={`h-4 w-4 shrink-0 ${location.pathname === '/dashboard' ? 'text-white' : 'group-hover:text-brand-primary'}`} />
            {!isSidebarCollapsed && <span className="relative z-10 animate-in fade-in duration-300">Dashboard</span>}
          </Link>
          
          {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_add_patients) && (
            <Link 
              to="/patients" 
              title={isSidebarCollapsed ? "Patients" : ""}
              className={`flex items-center rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${isSidebarCollapsed ? 'w-9 h-9 justify-center p-0 mx-auto' : 'w-full px-3 py-1.5 space-x-2.5'} ${location.pathname === '/patients' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-400 hover:bg-brand-primary/10 hover:text-brand-primary'}`}
            >
              <Users className={`h-4 w-4 shrink-0 ${location.pathname === '/patients' ? 'text-white' : 'group-hover:text-brand-primary'}`} />
              {!isSidebarCollapsed && <span className="relative z-10 animate-in fade-in duration-300">Patients</span>}
            </Link>
          )}
          
          {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_manage_doctors) && (
            <Link 
              to="/doctors" 
              title={isSidebarCollapsed ? "Doctors" : ""}
              className={`flex items-center rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${isSidebarCollapsed ? 'w-9 h-9 justify-center p-0 mx-auto' : 'w-full px-3 py-1.5 space-x-2.5'} ${location.pathname === '/doctors' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-400 hover:bg-brand-primary/10 hover:text-brand-primary'}`}
            >
              <Stethoscope className={`h-4 w-4 shrink-0 ${location.pathname === '/doctors' ? 'text-white' : 'group-hover:text-brand-primary'}`} />
              {!isSidebarCollapsed && <span className="relative z-10 animate-in fade-in duration-300">Doctors</span>}
            </Link>
          )}
          
          {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_manage_masters) && (
            <Link 
              to="/tests" 
              title={isSidebarCollapsed ? "Tests" : ""}
              className={`flex items-center rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${isSidebarCollapsed ? 'w-9 h-9 justify-center p-0 mx-auto' : 'w-full px-3 py-1.5 space-x-2.5'} ${location.pathname === '/tests' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-400 hover:bg-brand-primary/10 hover:text-brand-primary'}`}
            >
              <FileText className={`h-4 w-4 shrink-0 ${location.pathname === '/tests' ? 'text-white' : 'group-hover:text-brand-primary'}`} />
              {!isSidebarCollapsed && <span className="relative z-10 animate-in fade-in duration-300">Tests</span>}
            </Link>
          )}

          {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_book_tests) && (
            <Link 
              to="/bookings" 
              title={isSidebarCollapsed ? "Bookings" : ""}
              className={`flex items-center rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${isSidebarCollapsed ? 'w-9 h-9 justify-center p-0 mx-auto' : 'w-full px-3 py-1.5 space-x-2.5'} ${location.pathname === '/bookings' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-400 hover:bg-brand-primary/10 hover:text-brand-primary'}`}
            >
              <Calendar className={`h-4 w-4 shrink-0 ${location.pathname === '/bookings' ? 'text-white' : 'group-hover:text-brand-primary'}`} />
              {!isSidebarCollapsed && <span className="relative z-10 animate-in fade-in duration-300">Booking</span>}
            </Link>
          )}

          {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_view_billing) && (
            <Link 
              to="/billing" 
              title={isSidebarCollapsed ? "Bills" : ""}
              className={`flex items-center rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${isSidebarCollapsed ? 'w-9 h-9 justify-center p-0 mx-auto' : 'w-full px-3 py-1.5 space-x-2.5'} ${location.pathname === '/billing' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-400 hover:bg-brand-primary/10 hover:text-brand-primary'}`}
            >
              <IndianRupee className={`h-4 w-4 shrink-0 ${location.pathname === '/billing' ? 'text-white' : 'group-hover:text-brand-primary'}`} />
              {!isSidebarCollapsed && <span className="relative z-10 animate-in fade-in duration-300">Bills</span>}
            </Link>
          )}
          
          <Link 
            to="/reports" 
            title={isSidebarCollapsed ? "Reports" : ""}
            className={`flex items-center rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${isSidebarCollapsed ? 'w-9 h-9 justify-center p-0 mx-auto' : 'w-full px-3 py-1.5 space-x-2.5'} ${location.pathname.startsWith('/reports') ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-400 hover:bg-brand-primary/10 hover:text-brand-primary'}`}
          >
            <FileText className={`h-4 w-4 shrink-0 ${location.pathname.startsWith('/reports') ? 'text-white' : 'group-hover:text-brand-primary'}`} />
            {!isSidebarCollapsed && <span className="relative z-10 animate-in fade-in duration-300">Reports</span>}
          </Link>

          {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_view_analytics) && (
            <Link 
              to="/analytics" 
              title={isSidebarCollapsed ? "Analytics" : ""}
              className={`flex items-center rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${isSidebarCollapsed ? 'w-9 h-9 justify-center p-0 mx-auto' : 'w-full px-3 py-1.5 space-x-2.5'} ${location.pathname === '/analytics' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-400 hover:bg-brand-primary/10 hover:text-brand-primary'}`}
            >
              <BarChart3 className={`h-4 w-4 shrink-0 ${location.pathname === '/analytics' ? 'text-white' : 'group-hover:text-brand-primary'}`} />
              {!isSidebarCollapsed && <span className="relative z-10 animate-in fade-in duration-300">Analytics</span>}
            </Link>
          )}

          {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_access_settings) && (
            <Link 
              to="/settings" 
              title={isSidebarCollapsed ? "Settings" : ""}
              className={`flex items-center rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${isSidebarCollapsed ? 'w-9 h-9 justify-center p-0 mx-auto' : 'w-full px-3 py-1.5 space-x-2.5'} ${location.pathname === '/settings' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-400 hover:bg-brand-primary/10 hover:text-brand-primary'}`}
            >
              <SettingsIcon className={`h-4 w-4 shrink-0 ${location.pathname === '/settings' ? 'text-white' : 'group-hover:text-brand-primary'}`} />
              {!isSidebarCollapsed && <span className="relative z-10 animate-in fade-in duration-300">Settings</span>}
            </Link>
          )}

          <Link 
            to="/help" 
            title={isSidebarCollapsed ? "Help & Support" : ""}
            className={`flex items-center rounded-lg font-medium text-[13px] transition-all relative overflow-hidden group ${isSidebarCollapsed ? 'w-9 h-9 justify-center p-0 mx-auto' : 'w-full px-3 py-1.5 space-x-2.5'} ${location.pathname === '/help' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-slate-400 hover:bg-brand-primary/10 hover:text-brand-primary'}`}
          >
            <HelpCircle className={`h-4 w-4 shrink-0 ${location.pathname === '/help' ? 'text-white' : 'group-hover:text-brand-primary'}`} />
            {!isSidebarCollapsed && <span className="relative z-10 animate-in fade-in duration-300">Help & Support</span>}
          </Link>
        </div>

        {/* --- TOKEN MANAGEMENT (LabAdmin Only) --- */}
        {userData?.role === 'LabAdmin' && !isSidebarCollapsed && <TokenManager />}

        <div className="p-3 border-t border-white/5 mt-auto">
          <div className={`flex items-center group cursor-pointer transition-all duration-300 ${isSidebarCollapsed ? 'justify-center mb-4 p-0 bg-transparent border-0' : 'p-2 mb-2.5 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10'}`}>
            <div title={isSidebarCollapsed ? userData?.name || "User" : ""} className={`h-8 w-8 min-w-[32px] rounded-lg bg-brand-primary flex items-center justify-center text-brand-dark font-bold text-sm ${isSidebarCollapsed ? '' : 'mr-3'}`}>
              {userData?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden animate-in fade-in duration-300">
                <p className="text-[13px] font-semibold text-white truncate tracking-tight group-hover:text-brand-primary transition-colors">{userData?.name || 'User'}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{userData?.role || 'Staff'}</p>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleLogout}
            title={isSidebarCollapsed ? "Logout" : ""}
            className={`flex items-center justify-center border border-rose-500/30 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all duration-300 group mx-auto ${isSidebarCollapsed ? 'w-9 h-9 p-0' : 'w-full space-x-3 py-1.5 px-4'}`}
          >
            <LogOut className="h-3.5 w-3.5 opacity-80 group-hover:scale-110 transition-transform duration-300 shrink-0" />
            {!isSidebarCollapsed && <span className="text-[10px] font-bold uppercase tracking-wider animate-in fade-in duration-300">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Content Container */}
      <div className="flex-1 flex flex-col overflow-hidden print:block print:overflow-visible">
        {/* Demo Trial Banner */}
        {isDemoLab && demoDaysRemaining > 0 && userData?.role !== 'SuperAdmin' && (
          <div className={`px-4 py-2.5 flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest border-b transition-all shrink-0 ${
            demoDaysRemaining <= 3 
              ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white border-rose-600' 
              : demoDaysRemaining <= 7 
                ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white border-amber-500' 
                : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white border-violet-600'
          }`}>
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span>
              Free Demo Trial — <span className="underline decoration-2 underline-offset-4">{demoDaysRemaining} {demoDaysRemaining === 1 ? 'day' : 'days'}</span> remaining
            </span>
            <span className="hidden sm:inline opacity-70">•</span>
            <span className="hidden sm:inline opacity-80 normal-case tracking-normal font-bold">Full PRO access included</span>
          </div>
        )}

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-10 print:overflow-visible print:pb-0">
          {children}
        </main>
      </div>
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
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
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

      <Route 
        path="/help" 
        element={
          <ProtectedRoute allowedRoles={['LabAdmin', 'SuperAdmin', 'Staff']}>
            <Layout>
              <HelpSupport />
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
