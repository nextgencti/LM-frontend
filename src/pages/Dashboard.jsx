import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { 
  Users, Stethoscope, FileText, Calendar, 
  TrendingUp, IndianRupee, Clock, CheckCircle2 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { userData, subscription, activeLabId } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = userData?.role === 'SuperAdmin';
  const [stats, setStats] = useState({
    patients: 0,
    bookings: 0,
    tests: 0,
    doctors: 0,
    revenue: 0,
    pendingReports: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [userData, activeLabId]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch (e) {
      return dateStr;
    }
  };

  const fetchStats = async () => {
    // GUARD: If no activeLabId and not superAdmin, don't query (avoids permission error)
    if (!activeLabId && !isSuperAdmin) {
      console.log("Dashboard: Waiting for activeLabId...");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const labIdVal = isNaN(activeLabId) ? activeLabId : String(activeLabId);
      const qParams = isSuperAdmin ? [] : [where('labId', '==', labIdVal)];
      
      console.log("Dashboard: Fetching stats for labId:", isSuperAdmin ? 'ALL' : labIdVal);

      const pSnap = await getDocs(isSuperAdmin ? collection(db, 'patients') : query(collection(db, 'patients'), ...qParams));
      const bSnap = await getDocs(isSuperAdmin ? collection(db, 'bookings') : query(collection(db, 'bookings'), ...qParams));
      const dSnap = await getDocs(isSuperAdmin ? collection(db, 'doctors') : query(collection(db, 'doctors'), ...qParams));
      
      // Special logic for tests: Include lab-specific AND global/system tests
      let allTestsCount = 0;
      if (!isSuperAdmin) {
         // Query Lab-specific tests
         const tSnap = await getDocs(query(collection(db, 'tests'), where('labId', '==', labIdVal)));
         // Query Global tests (Using 'GLOBAL' identifier as in Tests catalog)
         const gSnap = await getDocs(query(collection(db, 'tests'), where('labId', '==', 'GLOBAL')));
         allTestsCount = tSnap.size + gSnap.size;
      } else {
         const tSnap = await getDocs(collection(db, 'tests'));
         allTestsCount = tSnap.size;
      }
      
      let totalRev = 0;
      let pending = 0;
      bSnap.forEach(doc => {
        const data = doc.data();
        totalRev += (parseFloat(data.paidAmount) || 0);
        if (data.status !== 'Completed') pending++;
      });

      setStats({
        patients: pSnap.size,
        bookings: bSnap.size,
        tests: allTestsCount,
        doctors: dSnap.size,
        revenue: totalRev,
        pendingReports: pending
      });
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, gradient, onClick }) => (
    <div 
      onClick={onClick}
      className="relative bg-white p-4 rounded-[22px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] transition-all duration-300 cursor-pointer group overflow-hidden"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-[0.03] rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700`}></div>
      
      <div className="flex justify-between items-start relative z-10">
        <div className={`p-4 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg shadow-blue-900/10 group-hover:scale-110 transition-transform duration-500`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col items-end">
          <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
          <h3 className="text-2xl font-black text-slate-800 mt-0.5 tabular-nums">{value}</h3>
        </div>
      </div>
      
      <div className="mt-4 flex items-center text-[12px] font-black text-slate-300 uppercase tracking-widest relative z-10 group-hover:text-slate-500 transition-colors">
        View <TrendingUp className="w-2.5 h-2.5 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-light/20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto w-full">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-black text-brand-dark tracking-tighter">
              {isSuperAdmin ? 'Admin Overview' : 'Lab Overview'}
            </h1>
            <p className="text-slate-500 mt-2 text-base font-medium flex items-center">
              {isSuperAdmin 
                ? 'Overview of entire diagnostic network performance.' 
                : <>Manage your lab <span className="mx-2 px-2.5 py-0.5 bg-brand-light text-brand-dark rounded-lg border border-brand-primary/20 font-black tracking-tight uppercase text-xs shadow-sm">{userData?.labId}</span> from here.</>}
            </p>
          </div>
          
          {subscription && (
            <div className={`px-5 py-2.5 rounded-2xl text-[12px] font-black tracking-[0.2em] flex items-center shadow-md border-2 ${
              subscription.status === 'active' ? 'bg-white text-brand-primary border-brand-primary/10' : 'bg-rose-50 text-rose-600 border-rose-100'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full mr-3 ${subscription.status === 'active' ? 'bg-brand-primary shadow-[0_0_12px_rgba(155,207,131,0.5)]' : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]'}`}></div>
              {subscription.status.toUpperCase()} LICENSE
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Registered Patients" 
            value={stats.patients} 
            icon={Users} 
            gradient="from-brand-dark to-[#3a4778]"
            onClick={() => navigate('/patients')}
          />
          <StatCard 
            title="Total Bookings" 
            value={stats.bookings} 
            icon={Calendar} 
            gradient="from-brand-secondary to-[#8799b8]"
            onClick={() => navigate('/bookings')}
          />
          <StatCard 
            title="Revenue Track" 
            value={`₹${stats.revenue}`} 
            icon={IndianRupee} 
            gradient="from-brand-primary to-[#b4d9a4]"
            onClick={() => navigate('/billing')}
          />
          <StatCard 
            title="Pending Reports" 
            value={stats.pendingReports} 
            icon={Clock} 
            gradient="from-slate-700 to-slate-900"
            onClick={() => navigate('/reports')}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Service List */}
          <div className="lg:col-span-2 bg-white rounded-[40px] shadow-[0_20px_60px_rgb(0,0,0,0.02)] border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-brand-dark flex items-center tracking-tight">
                <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center mr-4 shadow-sm border border-brand-primary/10">
                  <CheckCircle2 className="w-5 h-5 text-brand-primary" />
                </div>
                Quick Access
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                onClick={() => navigate('/tests')}
                className="group flex items-center justify-between p-5 bg-brand-light/30 rounded-[28px] border border-transparent hover:border-brand-primary/30 hover:bg-white hover:shadow-2xl hover:shadow-brand-primary/10 transition-all duration-500 cursor-pointer overflow-hidden relative"
              >
                <div className="flex items-center relative z-10">
                  <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center mr-4 shadow-sm group-hover:bg-brand-primary group-hover:text-white transition-all duration-500 group-hover:rotate-6">
                    <FileText className="w-5 h-5 text-brand-primary group-hover:text-white" />
                  </div>
                  <div>
                    <p className="text-base font-black text-brand-dark">Tests</p>
                    <p className="text-[12px] text-slate-400 font-bold uppercase tracking-[0.2em]">{stats.tests} Available</p>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
              </div>

              <div 
                onClick={() => navigate('/doctors')}
                className="group flex items-center justify-between p-5 bg-slate-50 rounded-[28px] border border-transparent hover:border-brand-secondary/30 hover:bg-white hover:shadow-2xl hover:shadow-brand-secondary/10 transition-all duration-500 cursor-pointer overflow-hidden relative"
              >
                <div className="flex items-center relative z-10">
                  <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center mr-4 shadow-sm group-hover:bg-brand-secondary group-hover:text-white transition-all duration-500 group-hover:-rotate-6">
                    <Stethoscope className="w-5 h-5 text-brand-secondary group-hover:text-white" />
                  </div>
                  <div>
                    <p className="text-base font-black text-brand-dark">Doctors</p>
                    <p className="text-[12px] text-slate-400 font-bold uppercase tracking-[0.2em]">{stats.doctors} Registered</p>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-secondary/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
              </div>
            </div>
          </div>

          {/* Premium Subscription Card */}
          <div className="relative group overflow-hidden bg-brand-dark rounded-[40px] shadow-2xl p-8 text-white min-h-[320px]">
            <div className="absolute top-0 right-0 w-80 h-80 bg-brand-primary/20 blur-[100px] rounded-full -mr-40 -mt-40"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-secondary/10 blur-[80px] rounded-full -ml-32 -mb-32"></div>
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black tracking-tighter">License Details</h2>
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/10 group-hover:rotate-12 transition-transform duration-500">
                   <TrendingUp className="w-6 h-6 text-brand-light" />
                </div>
              </div>
              
              <div className="space-y-6 flex-grow">
                <div className="p-5 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md">
                  <p className="text-slate-400 text-[12px] uppercase tracking-[0.3em] font-black mb-2 opacity-60">Current Plan</p>
                  <p className="text-3xl font-black capitalize tracking-tight text-brand-light">{subscription?.plan || 'Standard'}</p>
                </div>
                
                <div className="flex items-center gap-4 px-2">
                  <div className="w-12 h-12 rounded-2xl bg-brand-light/10 flex items-center justify-center border border-brand-light/20 shadow-inner">
                    <Clock className="w-6 h-6 text-brand-light" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-[12px] uppercase tracking-widest font-black opacity-60">Valid Until</p>
                    <p className="text-xl font-black tracking-tighter tabular-nums text-white lg:text-lg xl:text-xl">{formatDate(subscription?.expiryDate)}</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-8">
                <button className="w-full bg-brand-light text-brand-dark font-black py-4 rounded-[22px] hover:shadow-[0_20px_40px_rgba(238,250,189,0.3)] hover:-translate-y-1 transition-all duration-300 transform active:scale-95 text-base uppercase tracking-widest">
                  Upgrade Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
