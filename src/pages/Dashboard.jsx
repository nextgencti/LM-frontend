import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { 
  Users, Stethoscope, FileText, Calendar, 
  TrendingUp, IndianRupee, Clock, CheckCircle2,
  Zap, PlusCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OutOfTokensModal from '../components/OutOfTokensModal';

const Dashboard = () => {
  const { userData, subscription, activeLabId, labFullName } = useAuth();
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
  const [showTokenModal, setShowTokenModal] = useState(false);

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
      const hasLab = !!activeLabId;
      const qParams = hasLab ? [where('labId', '==', labIdVal)] : [];
      
      console.log("Dashboard: Fetching stats for labId:", hasLab ? labIdVal : 'ALL (Global Overview)');

      const pSnap = await getDocs(hasLab ? query(collection(db, 'patients'), ...qParams) : collection(db, 'patients'));
      const bSnap = await getDocs(hasLab ? query(collection(db, 'bookings'), ...qParams) : collection(db, 'bookings'));
      const dSnap = await getDocs(hasLab ? query(collection(db, 'doctors'), ...qParams) : collection(db, 'doctors'));
      
      // Special logic for tests: Include lab-specific AND global/system tests with deduplication
      let allTestsCount = 0;
      if (activeLabId) {
         const labIdVal = isNaN(activeLabId) ? activeLabId : String(activeLabId);
         
         // Fetch both lab-specific and global tests in parallel for performance
         const [tSnap, gSnap] = await Promise.all([
           getDocs(query(collection(db, 'tests'), where('labId', '==', labIdVal))),
           getDocs(query(collection(db, 'tests'), where('labId', '==', 'GLOBAL')))
         ]);

         const labSpecific = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
         const globalTests = gSnap.docs.map(d => ({ id: d.id, ...d.data() }));

         // Use testCode as the unique identifier for deduplication
         const labTestCodes = new Set(labSpecific.map(t => t.testCode));
         const uniqueGlobal = globalTests.filter(gt => !labTestCodes.has(gt.testCode));

         allTestsCount = labSpecific.length + uniqueGlobal.length;
      } else {
         const tSnap = await getDocs(collection(db, 'tests'));
         allTestsCount = tSnap.size;
      }
      
      let totalRev = 0;
      let pending = 0;
      const finishedStatuses = ['Final', 'Completed', 'Delivered'];

      bSnap.forEach(doc => {
        const data = doc.data();
        totalRev += (parseFloat(data.paidAmount) || 0);
        // A booking is pending if its status is not one of the finished statuses
        if (!finishedStatuses.includes(data.status)) {
          pending++;
        }
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
      className="relative bg-white p-3.5 rounded-[22px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] transition-all duration-300 cursor-pointer group overflow-hidden"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-[0.03] rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700`}></div>
      
      <div className="flex justify-between items-start relative z-10">
        <div className={`p-3 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg shadow-blue-900/10 group-hover:scale-110 transition-transform duration-500`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col items-end shrink-0">
          <p className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
          <h3 className="text-lg sm:text-xl font-black text-slate-800 mt-0.5 tabular-nums">{value}</h3>
        </div>
      </div>
      
      <div className="mt-3 flex items-center text-[11px] font-black text-slate-300 uppercase tracking-widest relative z-10 group-hover:text-slate-500 transition-colors uppercase">
        View <TrendingUp className="w-2.5 h-2.5 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-light/20 px-4 sm:px-5 lg:px-8 py-6 animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto w-full">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-6">
          <div className="md:max-w-xl">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tighter flex items-center flex-wrap gap-x-3 gap-y-2">
              {isSuperAdmin ? (
                <span className="text-brand-dark">Admin <span className="text-brand-primary">Overview</span></span>
              ) : (() => {
                const nameToUse = labFullName || subscription?.labFullName || subscription?.labName || 'Lab';
                const words = nameToUse.split(' ');
                const first = words[0];
                const rest = words.slice(1).join(' ');
                return (
                  <>
                    <span className="text-brand-dark">{first}</span>
                    {rest && <span className="text-brand-primary ml-2">{rest}</span>}
                    <span className="text-slate-300 font-medium scale-110 hidden sm:inline mx-2">|</span>
                    <span className="text-brand-primary italic opacity-80 sm:text-[0.9em]">Overview</span>
                  </>
                );
              })()}
            </h1>
            <p className="text-slate-500 mt-3 text-sm sm:text-base font-medium leading-relaxed">
              {isSuperAdmin 
                ? 'Comprehensive overview of your diagnostic network performance and synchronized lab activities.' 
                : <span className="flex flex-wrap items-center gap-y-1">
                    Manage your clinical operations for 
                    <span className="mx-2 px-3 py-1 bg-brand-light text-brand-dark rounded-xl border border-brand-primary/20 font-black tracking-tight uppercase text-[10px] shadow-sm">
                      {activeLabId}
                    </span> 
                    from here.
                  </span>}
            </p>
          </div>
          
          {subscription && (
            <div className={`px-4 py-2 rounded-2xl text-[11px] font-black tracking-[0.2em] flex items-center shadow-md border-2 ${
              subscription.status === 'active' ? 'bg-white text-brand-primary border-brand-primary/10' : 'bg-rose-50 text-rose-600 border-rose-100'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2.5 ${subscription.status === 'active' ? 'bg-brand-primary shadow-[0_0_12px_rgba(155,207,131,0.5)]' : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]'}`}></div>
              {subscription.status.toUpperCase()} PAY AS YOU GO
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
          <div className="lg:col-span-2 bg-white rounded-[32px] shadow-[0_20px_60px_rgb(0,0,0,0.02)] border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-brand-dark flex items-center tracking-tight">
                <div className="w-8 h-8 rounded-xl bg-brand-light flex items-center justify-center mr-3 shadow-sm border border-brand-primary/10">
                  <CheckCircle2 className="w-4 h-4 text-brand-primary" />
                </div>
                Quick Access
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div 
                onClick={() => navigate('/tests')}
                className="group flex items-center justify-between p-4 bg-brand-light/30 rounded-[24px] border border-transparent hover:border-brand-primary/30 hover:bg-white hover:shadow-2xl hover:shadow-brand-primary/10 transition-all duration-500 cursor-pointer overflow-hidden relative"
              >
                <div className="flex items-center relative z-10">
                  <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center mr-3 shadow-sm group-hover:bg-brand-primary group-hover:text-white transition-all duration-500 group-hover:rotate-6">
                    <FileText className="w-4 h-4 text-brand-primary group-hover:text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-brand-dark">Tests</p>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em]">{stats.tests} Available</p>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
              </div>
    
              <div 
                onClick={() => navigate('/doctors')}
                className="group flex items-center justify-between p-4 bg-slate-50 rounded-[24px] border border-transparent hover:border-brand-secondary/30 hover:bg-white hover:shadow-2xl hover:shadow-brand-secondary/10 transition-all duration-500 cursor-pointer overflow-hidden relative"
              >
                <div className="flex items-center relative z-10">
                  <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center mr-3 shadow-sm group-hover:bg-brand-secondary group-hover:text-white transition-all duration-500 group-hover:-rotate-6">
                    <Stethoscope className="w-4 h-4 text-brand-secondary group-hover:text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-brand-dark">Doctors</p>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em]">{stats.doctors} Registered</p>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-secondary/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
              </div>
            </div>
          </div>

          {/* Premium Subscription Card */}
          <div className="relative group overflow-hidden bg-brand-dark rounded-[32px] shadow-2xl p-6 text-white min-h-[280px]">
            <div className="absolute top-0 right-0 w-80 h-80 bg-brand-primary/20 blur-[100px] rounded-full -mr-40 -mt-40"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-secondary/10 blur-[80px] rounded-full -ml-32 -mb-32"></div>
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black tracking-tighter">Subscription details</h2>
                <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/10 group-hover:rotate-12 transition-transform duration-500">
                   <TrendingUp className="w-5 h-5 text-brand-light" />
                </div>
              </div>
              
              <div className="space-y-4 flex-grow">
                <div className="flex gap-3">
                  <div className="flex-1 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                    <p className="text-slate-400 text-[10px] uppercase tracking-[0.3em] font-black mb-1 opacity-60">Plan</p>
                    <p className="text-xl font-black uppercase tracking-tight text-brand-light">{subscription?.plan?.replace(/_/g, ' ') || 'Standard'}</p>
                  </div>
                  {subscription?.plan === 'pay_as_you_go' && (
                    <div className="flex-1 p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 backdrop-blur-md relative overflow-hidden group/token">
                      <Zap className="absolute -right-2 -bottom-2 w-12 h-12 text-amber-500/10 group-hover/token:scale-110 transition-transform" />
                      <p className="text-amber-500/60 text-[10px] uppercase tracking-[0.3em] font-black mb-1">Tokens</p>
                      <p className="text-2xl font-black tracking-tight text-amber-400 tabular-nums">{subscription?.tokenBalance || 0}</p>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-4 px-2">
                  <div className="w-10 h-10 rounded-xl bg-brand-light/10 flex items-center justify-center border border-brand-light/20 shadow-inner">
                    <Clock className="w-5 h-5 text-brand-light" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-[10px] uppercase tracking-widest font-black opacity-60 leading-none mb-1">Valid Until</p>
                    <p className="text-lg font-black tracking-tighter tabular-nums text-white">{formatDate(subscription?.expiryDate)}</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex flex-col gap-2.5">
                {subscription?.plan === 'pay_as_you_go' && (
                  <button 
                    onClick={() => setShowTokenModal(true)}
                    className="w-full bg-amber-500 text-white font-black py-3 rounded-[18px] hover:shadow-[0_20px_40px_rgba(245,158,11,0.3)] hover:-translate-y-1 transition-all duration-300 transform active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <PlusCircle className="w-4.5 h-4.5" />
                    Buy Tokens
                  </button>
                )}
                <button className="w-full bg-white/10 text-white border border-white/10 font-black py-2.5 rounded-[14px] hover:bg-white/20 transition-all duration-300 transform active:scale-95 text-[10px] uppercase tracking-widest">
                  Upgrade Plan
                </button>
              </div>
            </div>
            
            <OutOfTokensModal 
              isOpen={showTokenModal} 
              onClose={() => setShowTokenModal(false)} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
