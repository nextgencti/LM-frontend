import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { 
  Users, Stethoscope, FileText, Calendar, 
  TrendingUp, IndianRupee, Clock, CheckCircle2,
  Zap, PlusCircle, LayoutDashboard, Settings,
  LogOut, MousePointer2, Activity, FlaskConical,
  Bell, ChevronDown, Plus, Sparkles, Filter, 
  UserPlus, FileCheck, ArrowRight, Wallet, X, Send, Loader
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from 'recharts';
import OutOfTokensModal from '../components/OutOfTokensModal';

const Dashboard = () => {
  const { userData, currentUser, subscription, activeLabId, labFullName, allPlans } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = userData?.role === 'SuperAdmin';
  
  const [stats, setStats] = useState({
    patients: 0,
    bookings: 0,
    tests: 0,
    doctors: 0,
    revenue: 0,
    pendingReports: 0,
    completedReports: 0,
    todayPatients: 0,
    todayBookings: 0,
    todayRevenue: 0,
    thisMonthRevenue: 0,
    urgentReports: 2 
  });

  const [recentBookings, setRecentBookings] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showValidityModal, setShowValidityModal] = useState(false);
  const [timeFilter, setTimeFilter] = useState('week'); // 'week' or 'month'

  useEffect(() => {
    fetchStats();
  }, [userData, activeLabId, timeFilter]);

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
    if (!activeLabId && !isSuperAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setChartData([]); // Reset chart data during transitions to prevent glitches
    try {
      const labIdVal = isNaN(activeLabId) ? activeLabId : String(activeLabId);
      const hasLab = !!activeLabId;
      const qParams = hasLab ? [where('labId', '==', labIdVal)] : [];
      
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [pSnap, bSnap, dSnap] = await Promise.all([
         getDocs(hasLab ? query(collection(db, 'patients'), ...qParams) : collection(db, 'patients')),
         getDocs(hasLab ? query(collection(db, 'bookings'), ...qParams) : collection(db, 'bookings')),
         getDocs(hasLab ? query(collection(db, 'doctors'), ...qParams) : collection(db, 'doctors'))
      ]);

      let totalRev = 0;
      let todayRev = 0;
      let monthRev = 0;
      let pending = 0;
      let delivered = 0;
      let todayBookingsCount = 0;
      let todayCollectionsCount = 0;
      let todayDeliveredCount = 0;
      let urgentReportsCount = 0;

      const finishedStatuses = ['Final', 'Completed', 'Delivered'];
      const collectedStatuses = ['Collected', 'In Progress', 'Final', 'Completed', 'Delivered'];

      const sortedBookings = [];
      bSnap.forEach(doc => {
        const data = { id: doc.id, ...doc.data() };
        sortedBookings.push(data);
        
        const createdDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
        const updatedDate = data.updatedAt?.toDate ? data.updatedAt.toDate() : createdDate;
        
        if (data.status !== 'Cancelled') {
          totalRev += (parseFloat(data.paidAmount) || 0);
          if (createdDate >= startOfToday) {
            todayRev += (parseFloat(data.paidAmount) || 0);
            todayBookingsCount++;
          }
          if (createdDate >= startOfMonth) monthRev += (parseFloat(data.paidAmount) || 0);
          
          if (collectedStatuses.includes(data.status) && updatedDate >= startOfToday) {
             todayCollectionsCount++;
          }

          if (data.status === 'Delivered' && updatedDate >= startOfToday) {
             todayDeliveredCount++;
          }
        }
        
        if (!finishedStatuses.includes(data.status) && data.status !== 'Cancelled') {
           pending++;
           if (data.urgency === 'Urgent' || data.urgency === 'STAT') {
              urgentReportsCount++;
           }
        } else if (data.status === 'Delivered') {
           delivered++;
        }
      });

      const latest = [...sortedBookings]
        .sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return tB - tA;
        })
        .slice(0, 5);
      
      setRecentBookings(latest);

      // Chart Data Generation
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      let chartItems = [];
      const rangeCount = timeFilter === 'week' ? 6 : 29;
      
      for(let i = rangeCount; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = d.toLocaleDateString('en-GB');
        const dayLabel = days[d.getDay()];
        const dateLabel = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        
        const count = sortedBookings.filter(b => {
           const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
           return bDate.toLocaleDateString('en-GB') === dateKey;
        }).length;

        chartItems.push({ 
          name: dayLabel, 
          dateLabel, 
          fullDate: dateKey, // Unique key for mapping
          bookings: count 
        });
      }
      setChartData(chartItems);

      let todayPatientsCount = 0;
      pSnap.forEach(doc => {
        const d = doc.data();
        const cDate = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
        if (cDate >= startOfToday) todayPatientsCount++;
      });

      setStats({
        patients: pSnap.size,
        bookings: bSnap.size,
        revenue: totalRev,
        doctors: dSnap.size,
        pendingReports: pending,
        deliveredReports: delivered,
        todayPatients: todayPatientsCount,
        todayBookings: todayBookingsCount,
        todayCollections: todayCollectionsCount,
        todayDelivered: todayDeliveredCount,
        todayRevenue: todayRev,
        thisMonthRevenue: monthRev,
        urgentReports: urgentReportsCount
      });

    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status) => {
    switch (status?.toUpperCase()) {
      case 'DELIVERED': return 'bg-sky-50 text-sky-600 border-sky-50';
      case 'PENDING': return 'bg-amber-50 text-amber-600 border-amber-50';
      case 'IN PROGRESS': return 'bg-indigo-50 text-indigo-600 border-indigo-50';
      case 'FINALIZED': return 'bg-emerald-50 text-emerald-600 border-emerald-50';
      default: return 'bg-slate-50 text-slate-500 border-slate-50';
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 1);
  };

  return (
    <div className="min-h-screen pb-4 animate-in fade-in duration-500">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6">
        
        {/* Header Section - Compact */}
        <div className="flex justify-between items-center py-4 gap-4">
          <div>
            <h1 className="text-xl font-display font-bold text-brand-dark flex items-center gap-2">
              Hello, {userData?.firstName || userData?.name?.split(' ')[0] || currentUser?.displayName?.split(' ')[0] || 'Admin'} 👋
            </h1>
            <p className="text-slate-500 font-semibold text-[11px]">Welcome back! Overview of {labFullName || 'your lab'} today.</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-50 shadow-xs">
               <Calendar className="w-3.5 h-3.5 text-slate-400" />
               <span className="text-[11px] font-bold text-slate-700">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
               <ChevronDown className="w-3.5 h-3.5 text-slate-300 ml-1" />
            </div>
            <button 
              onClick={() => navigate('/bookings?new=true')}
              className="bg-brand-dark text-white px-4 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 hover:bg-slate-800 transition-all active:scale-95 shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              New Booking
            </button>
          </div>
        </div>

        {/* Top Stats Cards - Compact */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {[
            { label: 'Patients', val: stats.patients, sub: `+${stats.todayPatients} today`, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-100/20' },
            { label: 'Bookings', val: stats.bookings, sub: `+${stats.todayBookings} today`, icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-100/20' },
            { label: 'Delivered', val: stats.deliveredReports, sub: `+${stats.todayDelivered || 0} today`, icon: FileCheck, color: 'text-purple-500', bg: 'bg-purple-100/20' },
            { label: 'Pending', val: stats.pendingReports, urgent: stats.urgentReports || 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-100/20' },
            { label: "Total Revenue", val: `₹${stats.revenue}`, sub: `+₹${stats.todayRevenue} today`, icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-100/20' },
          ].map((s, idx) => (
            <div key={idx} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group relative overflow-hidden">
              <div className="flex gap-2.5 items-center relative z-10">
                <div className={`p-2 rounded-xl ${s.bg} ${s.color}`}>
                  <s.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{s.label}</p>
                  <h3 className="text-base font-bold text-slate-800 tabular-nums leading-none">{s.val}</h3>
                </div>
              </div>
              <div className="mt-2 text-[9px] font-bold relative z-10 flex justify-between items-center">
                <div className={`${s.label.includes('Revenue') ? 'text-emerald-600' : s.label.includes('Pending') ? 'text-rose-600' : 'text-brand-primary'}`}>
                  {s.sub && s.sub}
                  {s.urgent !== undefined && <span className="flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" /> {s.urgent} urgent</span>}
                </div>
                <ArrowRight className="w-3 h-3 text-slate-200 group-hover:text-brand-primary transition-colors" />
              </div>
            </div>
          ))}
        </div>

        {/* MIDDLE SECTION - Compact */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
          
          <div className="lg:col-span-5 bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-[13px] font-display font-bold text-brand-dark tracking-tight">Bookings Overview</h2>
                <div className="relative group/filter">
                  <select 
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 bg-white border border-slate-100 rounded-xl text-[10px] font-bold text-slate-500 uppercase cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  >
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
            </div>
            <div className="h-[220px] w-full">
               <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                 <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 20 }}>
                   <defs>
                     <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                       <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f8fafc" />
                   <XAxis 
                     dataKey="fullDate" 
                     axisLine={false} 
                     tickLine={false} 
                     interval={chartData.length > 7 ? 4 : 0}
                     tick={(props) => {
                       const { x, y, payload } = props;
                       const dataItem = chartData.find(d => d.fullDate === payload.value);
                       return (
                         <g transform={`translate(${x},${y})`}>
                           <text x={0} y={15} dy={0} textAnchor="middle" fill="#64748B" fontSize={10} fontWeight="700">
                             {dataItem?.name || ''}
                           </text>
                           <text x={0} y={30} dy={0} textAnchor="middle" fill="#94A3B8" fontSize={9} fontWeight="600">
                             {dataItem?.dateLabel || ''}
                           </text>
                         </g>
                       );
                     }} 
                   />
                   <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 10, fontWeight: '700'}} />
                   <Tooltip 
                     content={({ active, payload }) => {
                       if (active && payload && payload.length) {
                         return (
                           <div className="bg-white p-3 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] border border-slate-50 -translate-y-8 animate-in zoom-in-95">
                             <p className="text-sm font-black text-brand-dark tabular-nums">{payload[0].value}</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Bookings</p>
                           </div>
                         );
                       }
                       return null;
                     }}
                   />
                   <Area 
                    type="monotone" 
                    dataKey="bookings" 
                    stroke="#10B981" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorBookings)" 
                    dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#10B981', strokeWidth: 3, stroke: '#fff' }}
                   />
                 </AreaChart>
               </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm flex flex-col h-full uppercase">
            <div className="flex justify-between items-center mb-5 px-1">
              <h2 className="text-[13px] font-display font-bold text-brand-dark tracking-tight">Recent Bookings</h2>
              <button 
                onClick={() => navigate('/bookings')}
                className="text-[9px] font-bold text-slate-400 hover:text-brand-primary flex items-center gap-1 transition-colors"
               >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            
            <div className="space-y-2.5 grow font-bold mt-1">
              {recentBookings.map((b, i) => (
                <div key={b.id} className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 transition-all rounded-xl px-1 py-1 -mx-1 border-b border-slate-50 last:border-0 pb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] shadow-sm ${
                      i % 5 === 0 ? 'bg-emerald-100 text-emerald-700' : 
                      i % 5 === 1 ? 'bg-amber-100 text-amber-700' :
                      i % 5 === 2 ? 'bg-indigo-100 text-indigo-700' : 
                      i % 5 === 3 ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {getInitials(b.patientName)}
                    </div>
                    <div className="flex flex-col">
                         <span className="text-[7px] text-slate-400 leading-none mb-0.5 font-bold uppercase tracking-tight">BKG-{b.bookingNo || 'XXXX'}</span>
                         <span className="text-[10px] text-brand-dark tracking-tighter leading-none font-bold capitalize">{b.patientName}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-[8px] text-slate-500 hidden xl:block font-bold">
                      {b.testIds?.length || 1} Tests
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[7px] font-black tracking-widest border ${getStatusStyle(b.status)}`}>
                      {b.status}
                    </span>
                    <div className="text-[8px] text-slate-400 w-12 text-right tabular-nums tracking-tighter">
                      {b.createdAt?.toDate ? b.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 bg-brand-dark text-white p-4 rounded-[32px] shadow-xl relative overflow-hidden flex flex-col justify-between group h-full">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 blur-3xl rounded-full -mr-16 -mt-16"></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xs font-bold tracking-tight uppercase opacity-80">Subscription Plan</h2>
                <div className="p-1.5 bg-slate-800/50 rounded-lg border border-white/5 text-amber-400">
                   <Sparkles className="w-3.5 h-3.5" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                   <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1 leading-none">Plan</p>
                   <p className="text-[11px] font-black text-brand-primary uppercase leading-tight">{subscription?.plan?.replace(/_/g, ' ') || 'PAY AS YOU GO'}</p>
                </div>
                {subscription?.plan === 'pay_as_you_go' ? (
                  <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1 leading-none">Tokens</p>
                    <p className="text-[14px] font-bold text-amber-400 tabular-nums leading-none">{subscription?.tokenBalance || 0}</p>
                  </div>
                ) : (
                  <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1 leading-none">Remaining</p>
                    <p className="text-[14px] font-bold text-amber-400 tabular-nums leading-none">
                      {(() => {
                        const expiry = new Date(subscription?.expiryDate);
                        const diffTime = expiry - new Date();
                        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return days > 0 ? `${days} Days` : 'Expired';
                      })()}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 mb-4 ml-1">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                   <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Valid Until</p>
                   <p className="text-[12px] font-bold tracking-tight tabular-nums">
                     {(() => {
                       const currentPlan = allPlans?.find(p => p.id === (subscription?.plan || 'basic').toLowerCase());
                       const noExpiry = currentPlan?.period?.toLowerCase().includes('token') || currentPlan?.period?.toLowerCase().includes('lifetime');
                       return noExpiry ? 'Lifetime / No Expiry' : formatDate(subscription?.expiryDate);
                     })()}
                   </p>
                </div>
              </div>

              {subscription?.plan === 'pay_as_you_go' && (
                <div className="px-1 mb-4">
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-1.5 text-right">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${(subscription?.tokenBalance || 0) > 10 ? 'bg-brand-primary' : 'bg-rose-500'}`} 
                        style={{ width: `${Math.min(100, ((subscription?.tokenBalance || 0) / 100) * 100)}%` }}
                      ></div>
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase">
                    <span>{subscription?.tokenBalance || 0} TOKENS AVAILABLE</span>
                    <span className={(subscription?.tokenBalance || 0) > 10 ? 'text-brand-primary' : 'text-rose-500'}>
                      {(subscription?.tokenBalance || 0) > 10 ? 'Healthy' : 'Low Balance'}
                    </span>
                  </div>
                </div>
              )}

              {(subscription?.plan === 'basic' || subscription?.plan === 'pro' || subscription?.plan === 'demo') && (
                <div className="px-1 mb-4">
                  {(() => {
                    const expiry = new Date(subscription?.expiryDate);
                    const now = new Date();
                    const diffTime = expiry - now;
                    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    // Assume 30 days for bar calculation if we don't have a start date
                    const percent = Math.max(0, Math.min(100, (daysRemaining / 30) * 100));
                    const statusColor = daysRemaining > 7 ? 'bg-brand-primary' : 'bg-rose-500';
                    const statusText = daysRemaining > 7 ? 'Active' : 'Expiring Soon';
                    
                    return (
                      <>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-1.5 text-right">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${statusColor}`} 
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase">
                          <span>{daysRemaining > 0 ? `${daysRemaining} DAYS REMAINING` : 'EXPIRED'}</span>
                          <span className={daysRemaining > 7 ? 'text-brand-primary' : 'text-rose-500'}>
                            {statusText}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="relative z-10 flex flex-col gap-2">
              {subscription?.plan === 'pay_as_you_go' ? (
                <button 
                  onClick={() => setShowTokenModal(true)}
                  className="w-full bg-brand-primary text-white py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-brand-primary/20 transition-all flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Buy Tokens
                </button>
              ) : (
                <button 
                  onClick={() => setShowValidityModal(true)}
                  className="w-full bg-brand-primary text-white py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-brand-primary/20 transition-all flex items-center justify-center gap-2 hover:bg-emerald-600"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Extend Validity
                </button>
              )}
              <button 
                onClick={() => navigate('/settings/billing')}
                className="w-full bg-white/5 text-white/50 py-1.5 rounded-xl font-bold text-[9px] uppercase transition-all border border-white/5"
              >
                Upgrade Plan
              </button>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION - Compact */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          
          <div className="lg:col-span-3 bg-white p-3.5 rounded-[32px] border border-slate-100 shadow-sm uppercase">
             <h2 className="text-[13px] font-display font-bold text-brand-dark tracking-tight mb-3 px-1">Today's Activity</h2>
             <div className="grid grid-cols-4 gap-2.5">
               {[
                 { label: 'New Bookings', icon: Calendar, val: stats.todayBookings, color: 'text-emerald-600', bg: 'bg-emerald-50/50', path: '/bookings' },
                 { label: 'Today Revenue', icon: IndianRupee, val: `₹${stats.todayRevenue?.toLocaleString('en-IN') || 0}`, color: 'text-amber-600', bg: 'bg-amber-50/50', path: '/bookings' },
                 { label: 'Reports Generated', icon: FileCheck, val: stats.todayReports, color: 'text-sky-600', bg: 'bg-sky-50/50', path: '/reports' },
                 { label: 'Pending Reports', icon: Clock, val: stats.pendingReports, urgent: stats.urgentReports, color: 'text-indigo-600', bg: 'bg-indigo-50/50', path: '/reports?filter=pending' },
               ].map((act, i) => (
                 <div key={i} className={`p-3 rounded-3xl ${act.bg} flex flex-col items-start justify-between min-h-[110px] border-none group relative overflow-hidden`}>
                    <div className={`p-2 rounded-xl bg-white ${act.color} shadow-xs mb-1.5 group-hover:scale-110 transition-transform`}>
                      <act.icon className="w-4 h-4" />
                    </div>
                    <div>
                       <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight mb-0.5 leading-none">{act.label}</p>
                       <h4 className="text-[18px] font-black text-brand-dark leading-none tabular-nums">{act.val}</h4>
                       {act.urgent > 0 && <p className="text-[8px] font-black text-rose-500 uppercase mt-1 flex items-center gap-1 animate-pulse">
                         {act.urgent} Urgent
                       </p>}
                    </div>
                    <button 
                      onClick={() => navigate(act.path)}
                      className="mt-2 text-[8px] font-black text-slate-400 group-hover:text-brand-primary flex items-center gap-1 transition-colors uppercase tracking-widest"
                    >
                      View all <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                 </div>
               ))}
             </div>
          </div>

          <div className="lg:col-span-2 bg-white p-3.5 rounded-[32px] border border-slate-100 shadow-sm uppercase">
             <h2 className="text-[13px] font-display font-bold text-brand-dark tracking-tight mb-3 px-1">Quick Actions</h2>
             <div className="grid grid-cols-3 gap-2.5">
               {[
                 { name: 'New Booking', icon: Calendar, color: 'text-emerald-700', bg: 'bg-emerald-50/50', path: '/bookings?new=true' },
                 { name: 'Add Patient', icon: UserPlus, color: 'text-sky-700', bg: 'bg-sky-50/50', path: '/patients?new=true' },
                 { name: 'Generate Report', icon: FileText, color: 'text-purple-700', bg: 'bg-purple-50/50', path: '/reports' },
                 { name: 'View Reports', icon: FileCheck, color: 'text-indigo-700', bg: 'bg-indigo-50/50', path: '/reports' },
                 { name: 'Pending Work', icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50/50', path: '/reports?filter=pending' },
                 { name: 'Add Doctor', icon: Stethoscope, color: 'text-green-700', bg: 'bg-green-50/50', path: '/doctors' },
               ].map((action, i) => (
                 <button 
                  key={i} 
                  onClick={() => navigate(action.path)}
                  className={`flex flex-col items-center justify-center p-3.5 ${action.bg} hover:shadow-md transition-all rounded-[24px] group border-none min-h-[85px] active:scale-95`}
                 >
                   <div className={`${action.color} group-hover:scale-110 transition-transform mb-1.5`}>
                     <action.icon className="w-5 h-5" />
                   </div>
                   <span className={`text-[9px] font-black ${action.color} uppercase tracking-tighter leading-tight text-center`}>{action.name}</span>
                 </button>
               ))}
             </div>
          </div>
        </div>

        {/* Global Notification - Slim */}
        <div className="mt-3 bg-emerald-50 border-none rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-tight leading-none">You have 2 pending reports to review.</p>
          </div>
          <button className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">
            View Now
          </button>
        </div>

        <OutOfTokensModal 
          isOpen={showTokenModal} 
          onClose={() => setShowTokenModal(false)} 
        />

        <ValidityRequestModal 
          isOpen={showValidityModal} 
          onClose={() => setShowValidityModal(false)} 
          labId={activeLabId || userData?.labId}
          labName={labFullName || userData?.labName}
        />
      </div>
    </div>
  );
};

const ValidityRequestModal = ({ isOpen, onClose, labId, labName }) => {
  const [months, setMonths] = useState(12);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'validityRequests'), {
        labId,
        labName,
        requestedMonths: parseInt(months),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success("Extension request sent successfully! Admin will review it shortly.");
      onClose();
    } catch (err) {
      console.error("Error sending validity request:", err);
      toast.error("Failed to send request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-dark/80 backdrop-blur-3xl animate-in fade-in" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-brand-dark px-8 py-6 border-b border-white/5 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-primary/10 rounded-xl text-brand-primary">
                 <Calendar className="w-5 h-5" />
              </div>
              <div>
                 <h3 className="text-[16px] font-bold text-white uppercase tracking-tight">Request Extension</h3>
                 <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-0.5">Extend Plan Validity</p>
              </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-all text-white/40 hover:text-white">
              <X className="w-5 h-5" />
           </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
           <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Extension Duration</label>
              <div className="grid grid-cols-2 gap-3">
                 {[
                   { label: '6 Months', val: 6 },
                   { label: '12 Months', val: 12 },
                   { label: '24 Months', val: 24 },
                   { label: '36 Months', val: 36 }
                 ].map(opt => (
                   <button 
                     key={opt.val}
                     type="button"
                     onClick={() => setMonths(opt.val)}
                     className={`py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border-2 ${months === opt.val ? 'bg-brand-primary/10 border-brand-primary text-brand-dark shadow-lg shadow-brand-primary/10' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'}`}
                   >
                     {opt.label}
                   </button>
                 ))}
              </div>
           </div>

           <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
              <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-[11px] font-medium text-amber-700 leading-relaxed">
                Your request will be sent to the admin. Once approved, your plan expiry will be updated automatically.
              </p>
           </div>

           <button 
             type="submit"
             disabled={submitting}
             className="w-full py-4 bg-brand-dark text-white rounded-[22px] text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-dark/20 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
           >
             {submitting ? (
               <Loader className="w-4 h-4 animate-spin" />
             ) : (
               <Send className="w-4 h-4 text-brand-primary" />
             )}
             {submitting ? 'Sending Request...' : 'Send Request'}
           </button>
        </form>
      </div>
    </div>
  );
};

export default Dashboard;
