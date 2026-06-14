import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  TrendingUp, TrendingDown, IndianRupee, Users, Activity, 
  Calendar, Award, Loader, Filter, Download, ArrowUpRight, 
  ChevronRight, PieChart as PieChartIcon, BarChart3, ShieldAlert
} from 'lucide-react';

const BusinessAnalytics = () => {
  const { userData, subscription, activeLabId } = useAuth();
  
  // RBAC check
  const hasPermission = userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_view_analytics;
  
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [timeRange, setTimeRange] = useState('30'); // Days
  
  // Premium Feature check
  const isPremiumPlan = ['pro', 'enterprise', 'pay_as_you_go', 'demo'].includes(subscription?.plan?.toLowerCase()) || userData?.role === 'SuperAdmin';

  useEffect(() => {
    if (isPremiumPlan) {
      fetchAnalyticsData();
    } else {
       setLoading(false);
    }
  }, [activeLabId, timeRange, isPremiumPlan]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const isSuperAdmin = userData?.role === 'SuperAdmin';
      const effectiveLabId = activeLabId || userData?.labId;
      const labIdVal = isNaN(effectiveLabId) ? effectiveLabId : String(effectiveLabId);
      
      let q;
      if (isSuperAdmin && !activeLabId) {
        q = query(collection(db, 'bookings'));
      } else {
        if (!labIdVal) {
          setLoading(false);
          return;
        }
        q = query(
          collection(db, 'bookings'),
          where('labId', '==', labIdVal)
        );
      }

      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by date desc in JS to avoid Firestore missing composite index error
      data.sort((a, b) => {
        const getTime = (val) => {
          if (!val) return 0;
          if (val.seconds) return val.seconds * 1000 + (val.nanoseconds / 1000000);
          if (val.toDate) return val.toDate().getTime();
          const d = new Date(val);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      });

      setBookings(data);
    } catch (err) {
      console.error("Error fetching analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  // 0. Filtered Bookings based on Time Range (to make KPIs accurate)
  const filteredBookings = useMemo(() => {
    const now = new Date();
    const rangeDays = parseInt(timeRange);
    const cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - rangeDays, 0, 0, 0);

    return bookings.filter(b => {
      if (!b.createdAt) return false;
      const date = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return date >= cutoffDate && b.status !== 'Cancelled';
    });
  }, [bookings, timeRange]);

  // 1. Revenue & Booking Trends (Day-wise)
  const trendsData = useMemo(() => {
    const days = {};
    const now = new Date();
    const rangeDays = parseInt(timeRange);
    
    // Initialize last N days
    for (let i = rangeDays; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      days[label] = { label, revenue: 0, count: 0 };
    }

    filteredBookings.forEach(b => {
      if (!b.createdAt) return;
      const date = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      const label = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      if (days[label]) {
        days[label].revenue += (parseFloat(b.paidAmount) || 0);
        days[label].count += 1;
      }
    });

    return Object.values(days);
  }, [filteredBookings, timeRange]);

  // 2. Test Distribution
  const testData = useMemo(() => {
    const counts = {};
    filteredBookings.forEach(b => {
      const tests = b.testNames ? b.testNames.split(',') : [];
      tests.forEach(t => {
        const name = t.trim();
        if (name) counts[name] = (counts[name] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredBookings]);

  // 3. KPI Calculations
  const kpis = useMemo(() => {
    const totalRevenue = filteredBookings.reduce((acc, b) => acc + (parseFloat(b.paidAmount) || 0), 0);
    const totalBilled = filteredBookings.reduce((acc, b) => acc + (parseFloat(b.totalAmount) || 0), 0);
    const avgOrderValue = filteredBookings.length > 0 ? totalRevenue / filteredBookings.length : 0;
    const collectionRate = totalBilled > 0 ? (totalRevenue / totalBilled) * 100 : 0;

    return {
      revenue: totalRevenue.toLocaleString(),
      bookings: filteredBookings.length,
      aov: Math.round(avgOrderValue).toLocaleString(),
      rate: Math.round(collectionRate)
    };
  }, [filteredBookings]);

  const COLORS = ['#9BCF83', '#6B85A8', '#2D3250', '#EEFABD', '#8799b8'];

  if (!hasPermission) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-amber-50 rounded-[32px] flex items-center justify-center mb-8 shadow-inner border border-amber-100">
          <ShieldAlert className="w-12 h-12 text-amber-500" />
        </div>
        <h1 className="text-[28px] font-bold text-brand-dark tracking-tight mb-4">Access Denied</h1>
        <p className="text-[14px] font-medium text-slate-500 max-w-md leading-relaxed">
          You do not have the required permissions to view business analytics. Please contact your Laboratory Administrator.
        </p>
      </div>
    );
  }

  if (!isPremiumPlan) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-rose-50 rounded-[32px] flex items-center justify-center mb-8 shadow-inner border border-rose-100">
          <ShieldAlert className="w-12 h-12 text-rose-500" />
        </div>
        <h1 className="text-[28px] font-bold text-brand-dark tracking-tight mb-4">Premium Feature Locked</h1>
        <p className="text-[14px] font-medium text-slate-500 max-w-md leading-relaxed">
          Business Analytics is only available for Laboratories on a <span className="text-brand-dark font-semibold">Premium or Flexible Plan</span>. Upgrade today to unlock financial insights, growth trends, and operation metrics.
        </p>
        <button className="mt-10 px-8 py-4 bg-brand-dark text-white rounded-2xl text-[13px] font-bold uppercase tracking-wider shadow-xl shadow-brand-dark/20 hover:scale-[1.02] transition-all active:scale-95">
          Upgrade Plan
        </button>
      </div>
    );
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader className="w-12 h-12 text-brand-primary animate-spin mb-4" />
      <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Compiling Market Intelligence...</p>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 w-full flex-grow text-slate-800 animate-in fade-in duration-500 relative print:p-0 print:m-0 print:max-w-full print:bg-white print:text-black">
      
      {/* Decorative Brand Background */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] pointer-events-none -mr-20 -mt-20 print:hidden"></div>
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-brand-secondary/5 rounded-full blur-[100px] pointer-events-none -ml-20 -mb-20 print:hidden"></div>

      {/* Print-Only Lab Details Header */}
      <div className="hidden print:flex justify-between items-start border-b border-slate-200 pb-3 mb-4 w-full">
        <div>
          <h2 className="text-[18px] font-black text-brand-dark uppercase tracking-tight">
            {subscription?.labFullName || subscription?.labName || 'Pathology Laboratory'}
          </h2>
          <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
            {subscription?.address || 'Clinical Diagnostic Services'}
          </p>
          <div className="flex gap-4 text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
            {subscription?.phone && <span>Contact: {subscription.phone}</span>}
            {subscription?.email && <span>Email: {subscription.email}</span>}
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest border border-brand-primary/20 px-2 py-0.5 rounded-md">
            Performance Report
          </span>
          <p className="text-[9px] text-slate-400 font-semibold mt-1.5">
            Period: {timeRange === '0' ? 'Today' : timeRange === '365' ? '1 Year' : `${timeRange} Days`}
          </p>
          <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
            Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-light rounded-xl mr-3 shadow-sm border border-brand-primary/10 transition-transform hover:scale-110">
            <BarChart3 className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-brand-dark leading-tight">Business Intelligence</h1>
            <p className="text-[13px] font-medium text-slate-500 mt-1.5">Real-time performance metrics for {subscription?.labName || userData?.labId || 'your laboratory'}.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="flex gap-1.5 bg-white/80 backdrop-blur p-1 rounded-xl border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.04)] h-[42px] shrink-0 relative z-10">
            {['0', '7', '30', '90', '365'].map(range => (
              <button 
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap h-full border hover:border-slate-200 ${timeRange === range ? 'bg-brand-dark text-white shadow-sm border-transparent' : 'text-slate-500 hover:bg-slate-50 border-transparent'}`}
              >
                {range === '0' ? 'Today' : range === '365' ? '1 Year' : `${range} Days`}
              </button>
            ))}
          </div>

          <button 
            onClick={() => window.print()} 
            className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-[12px] font-bold uppercase tracking-wider transition-all shadow-md hover:scale-[1.02] active:scale-95 h-[42px]"
          >
            Print <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 relative z-10 print:grid-cols-4 print:gap-3 print:mb-4">
        <div className="bg-emerald-50/40 p-6 rounded-[24px] shadow-[0_8px_30px_rgb(16,185,129,0.06)] border border-emerald-100 group relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(16,185,129,0.1)] print:p-3 print:rounded-xl print:shadow-none print:border-slate-200">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/50 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700 print:hidden"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-5 print:mb-2">
              <div className="p-2.5 bg-emerald-100 border border-emerald-200/50 rounded-xl text-emerald-600 print:p-1.5">
                 <IndianRupee className="w-5 h-5 print:w-4 print:h-4" />
              </div>
              <span className="flex items-center text-emerald-600 font-bold text-[10px] bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200/50 print:px-2 print:py-1">+12% <ArrowUpRight className="w-3 h-3 ml-0.5" /></span>
            </div>
            <p className="text-[12px] font-semibold text-emerald-700/70 uppercase tracking-wider mb-1 print:text-[10px]">Total Revenue</p>
            <h3 className="text-[24px] font-bold text-brand-dark print:text-[18px]">₹{kpis.revenue}</h3>
          </div>
        </div>

        <div className="bg-sky-50/40 p-6 rounded-[24px] shadow-[0_8px_30px_rgb(14,165,233,0.06)] border border-sky-100 group relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(14,165,233,0.1)] print:p-3 print:rounded-xl print:shadow-none print:border-slate-200">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-100/50 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700 print:hidden"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-5 print:mb-2">
              <div className="p-2.5 bg-sky-100 border border-sky-200/50 rounded-xl text-sky-600 print:p-1.5">
                 <Calendar className="w-5 h-5 print:w-4 print:h-4" />
              </div>
              <span className="flex items-center text-sky-600 font-bold text-[10px] bg-sky-100 px-3 py-1.5 rounded-lg border border-sky-200/50 print:px-2 print:py-1">+4% <ArrowUpRight className="w-3 h-3 ml-0.5" /></span>
            </div>
            <p className="text-[12px] font-semibold text-sky-700/70 uppercase tracking-wider mb-1 print:text-[10px]">Bookings Count</p>
            <h3 className="text-[24px] font-bold text-brand-dark print:text-[18px]">{kpis.bookings}</h3>
          </div>
        </div>

        <div className="bg-indigo-50/40 p-6 rounded-[24px] shadow-[0_8px_30px_rgb(99,102,241,0.06)] border border-indigo-100 group relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(99,102,241,0.1)] print:p-3 print:rounded-xl print:shadow-none print:border-slate-200">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100/50 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700 print:hidden"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-5 print:mb-2">
              <div className="p-2.5 bg-indigo-100 border border-indigo-200/50 rounded-xl text-indigo-600 print:p-1.5">
                 <Activity className="w-5 h-5 print:w-4 print:h-4" />
              </div>
            </div>
            <p className="text-[12px] font-semibold text-indigo-700/70 uppercase tracking-wider mb-1 print:text-[10px]">Avg. Order Value</p>
            <h3 className="text-[24px] font-bold text-brand-dark print:text-[18px]">₹{kpis.aov}</h3>
          </div>
        </div>

        <div className="bg-violet-50/40 p-6 rounded-[24px] shadow-[0_8px_30px_rgb(139,92,246,0.06)] border border-violet-100 group relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(139,92,246,0.1)] print:p-3 print:rounded-xl print:shadow-none print:border-slate-200">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-100/50 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700 print:hidden"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-5 print:mb-2">
              <div className="p-2.5 bg-violet-100 border border-violet-200/50 rounded-xl text-violet-600 print:p-1.5">
                 <TrendingUp className="w-5 h-5 print:w-4 print:h-4" />
              </div>
              <span className="flex items-center text-violet-600 font-bold text-[10px] bg-violet-100 px-3 py-1.5 rounded-lg border border-violet-200/50 print:px-2 print:py-1">Efficiency</span>
            </div>
            <p className="text-[12px] font-semibold text-violet-700/70 uppercase tracking-wider mb-1 print:text-[10px]">Collection Rate</p>
            <h3 className="text-[24px] font-bold text-brand-dark print:text-[18px] tabular-nums">{kpis.rate}%</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10 print:grid-cols-3 print:gap-3">
        
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-md rounded-[24px] border border-white p-6 flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.04)] print:col-span-2 print:p-4 print:rounded-xl print:shadow-none print:border-slate-200">
          <div className="flex items-center justify-between mb-6 print:mb-3">
            <div>
              <h3 className="text-[14px] font-bold text-brand-dark print:text-[12px]">Revenue Dynamics</h3>
              <p className="text-[12px] font-medium text-slate-500 mt-1 print:text-[10px] print:mt-0">Daily billing performance trends.</p>
            </div>
            <div className="flex gap-4 print:hidden">
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-brand-primary"></div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Revenue</span>
               </div>
            </div>
          </div>
          
          <div className="h-[280px] print:h-[280px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendsData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9BCF83" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#9BCF83" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} 
                  width={40}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#9BCF83" 
                  strokeWidth={1} 
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar Analytics */}
        <div className="space-y-6 print:space-y-0">
           {/* Pie Chart */}
           <div className="bg-white/70 backdrop-blur-md rounded-[24px] border border-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] print:p-4 print:rounded-xl print:shadow-none print:border-slate-200">
              <h3 className="text-[14px] font-bold text-brand-dark mb-6 print:mb-3 print:text-[12px]">Test Distribution</h3>
              <div className="h-[200px] print:h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={testData}
                      cx="50%"
                      cy="50%"
                      innerRadius="50%"
                      outerRadius="80%"
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {testData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                       contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#2D3250', color: 'white' }}
                       itemStyle={{ color: 'white', fontSize: '9px', fontWeight: 700 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 mt-6 print:mt-3 print:space-y-1">
                 {testData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest truncate max-w-[120px] print:max-w-[100px]">{entry.name}</span>
                       </div>
                       <span className="text-[10px] font-bold text-brand-dark">{entry.value} Bookings</span>
                    </div>
                 ))}
              </div>
           </div>

        </div>
      </div>



    </div>
  );
};

export default BusinessAnalytics;
