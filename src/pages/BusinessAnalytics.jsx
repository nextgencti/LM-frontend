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
  const isPremiumPlan = ['pro', 'enterprise', 'pay_as_you_go'].includes(subscription?.plan?.toLowerCase()) || userData?.role === 'SuperAdmin';

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
        <h1 className="text-[28px] font-bold text-[#1F2937] tracking-tight mb-4">Access Denied</h1>
        <p className="text-[14px] font-medium text-[#7B8794] max-w-md leading-relaxed">
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
        <h1 className="text-[28px] font-bold text-[#1F2937] tracking-tight mb-4">Premium Feature Locked</h1>
        <p className="text-[14px] font-medium text-[#7B8794] max-w-md leading-relaxed">
          Business Analytics is only available for Laboratories on a <span className="text-[#1F2937] font-semibold">Premium or Flexible Plan</span>. Upgrade today to unlock financial insights, growth trends, and operation metrics.
        </p>
        <button className="mt-10 px-8 py-4 bg-[#1E2A5A] text-white rounded-2xl text-[13px] font-bold uppercase tracking-wider shadow-xl shadow-[#1E2A5A]/20 hover:scale-[1.02] transition-all active:scale-95">
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
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 w-full flex-grow text-slate-800 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 shadow-sm transition-transform hover:scale-110">
            <BarChart3 className="w-5 h-5 text-[#1E2A5A]" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[#1F2937] leading-tight">Business Intelligence</h1>
            <p className="text-[13px] font-medium text-[#7B8794] mt-1.5">Real-time performance metrics for {userData?.labId}.</p>
          </div>
        </div>
        
        <div className="flex gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-sm self-end md:self-auto h-[42px] shrink-0">
          {['0', '7', '30', '90'].map(range => (
            <button 
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap h-full border hover:border-slate-200 ${timeRange === range ? 'bg-[#1E2A5A] text-white shadow-sm border-transparent' : 'text-[#7B8794] hover:bg-slate-50 border-transparent'}`}
            >
              {range === '0' ? 'Today' : `${range} Days`}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 group relative overflow-hidden transition-all hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <div className="p-2 bg-brand-light/40 border border-brand-primary/10 rounded-xl text-brand-primary">
                 <IndianRupee className="w-4 h-4" />
              </div>
              <span className="flex items-center text-emerald-500 font-bold text-[10px] bg-emerald-50 px-2.5 py-1 rounded-lg">+12% <ArrowUpRight className="w-3 h-3 ml-0.5" /></span>
            </div>
            <p className="text-[12px] font-semibold text-[#98A2B3] uppercase tracking-wider mb-1">Total Revenue</p>
            <h3 className="text-[24px] font-bold text-[#1F2937]">₹{kpis.revenue}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 group relative overflow-hidden transition-all hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-secondary/5 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <div className="p-2 bg-slate-50 rounded-xl text-brand-secondary">
                 <Calendar className="w-4 h-4" />
              </div>
              <span className="flex items-center text-emerald-500 font-bold text-[10px] bg-emerald-50 px-2.5 py-1 rounded-lg">+4% <ArrowUpRight className="w-3 h-3 ml-0.5" /></span>
            </div>
            <p className="text-[12px] font-semibold text-[#98A2B3] uppercase tracking-wider mb-1">Bookings Count</p>
            <h3 className="text-[24px] font-bold text-[#1F2937]">{kpis.bookings}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 group relative overflow-hidden transition-all hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-500">
                 <Activity className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[12px] font-semibold text-[#98A2B3] uppercase tracking-wider mb-1">Avg. Order Value</p>
            <h3 className="text-[24px] font-bold text-[#1F2937]">₹{kpis.aov}</h3>
          </div>
        </div>

        <div className="bg-brand-dark p-5 rounded-2xl text-white group relative overflow-hidden transition-all hover:-translate-y-1 shadow-md shadow-brand-dark/20">
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand-primary/10 rounded-full -ml-8 -mb-8 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <div className="p-2 bg-white/10 rounded-xl text-brand-light border border-white/10">
                 <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-brand-light font-bold text-[10px] uppercase tracking-widest">Efficiency</span>
            </div>
            <p className="text-[12px] font-semibold text-white/60 uppercase tracking-wider mb-1">Collection Rate</p>
            <h3 className="text-[24px] font-bold text-white tabular-nums">{kpis.rate}%</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-[14px] font-bold text-[#1F2937]">Revenue Dynamics</h3>
              <p className="text-[12px] font-medium text-[#7B8794] mt-1">Daily billing performance trends.</p>
            </div>
            <div className="flex gap-4">
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-brand-primary"></div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Revenue</span>
               </div>
            </div>
          </div>
          
          <div className="h-[280px] w-full mt-auto">
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
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar Analytics */}
        <div className="space-y-4">
           {/* Pie Chart */}
           <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-[14px] font-bold text-[#1F2937] mb-6">Test Distribution</h3>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={testData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
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
              <div className="space-y-3 mt-6">
                 {testData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest truncate max-w-[120px]">{entry.name}</span>
                       </div>
                       <span className="text-[10px] font-bold text-brand-dark">{entry.value} Bookings</span>
                    </div>
                 ))}
              </div>
           </div>

           {/* Export Action */}
           <div className="bg-[#1E2A5A] p-6 rounded-2xl text-white transform transition-all hover:scale-[1.02] cursor-pointer group shadow-sm border border-white/10">
              <h4 className="text-[14px] font-bold text-white leading-tight mb-2 uppercase tracking-tight">Export Performance Report</h4>
              <p className="text-[12px] font-medium text-white/70 leading-relaxed mb-6">Generate a PDF summary of your entire laboratory financial growth and operational efficiency.</p>
              <button className="flex items-center justify-center gap-2 bg-white text-[#1E2A5A] w-full py-3 rounded-xl text-[12px] font-bold uppercase tracking-wider transition-all group-hover:gap-3 shadow-md">
                 Download PDF <Download className="w-3.5 h-3.5" />
              </button>
           </div>
        </div>
      </div>

    </div>
  );
};

export default BusinessAnalytics;
