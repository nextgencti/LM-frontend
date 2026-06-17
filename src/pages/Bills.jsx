import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Loader, FileText, IndianRupee, CheckCircle2, AlertCircle, Clock, Filter, Printer, X, Users, Stethoscope, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';

const Bills = () => {
  const { userData, activeLabId } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('Unpaid');
  const [dateRange, setDateRange] = useState({ 
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });
  const queryClient = useQueryClient();
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const [payAmountInput, setPayAmountInput] = useState({});
  const [payMethodInput, setPayMethodInput] = useState({}); // Default Cash
  const [showHistory, setShowHistory] = useState({}); // Track which bill history is open
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [labInfo, setLabInfo] = useState(null);

  useEffect(() => {
    const fetchLabInfo = async () => {
      if (!activeLabId) return;
      try {
        const labIdVal = isNaN(activeLabId) ? activeLabId : String(activeLabId);
        const labDoc = await getDoc(doc(db, 'labs', labIdVal));
        if (labDoc.exists()) {
          setLabInfo(labDoc.data());
        }
      } catch (err) {
        console.error("Error fetching lab info:", err);
      }
    };
    fetchLabInfo();
  }, [activeLabId]);

  const handlePrint = () => {
    if (!selectedInvoice) return;

    const brand = { primary: '#10B981', secondary: '#64748b', dark: '#1e293b', light: '#f8fafc' };

    const formatDate = (createdAt) => {
      if (!createdAt) return 'N/A';
      const ts = createdAt.seconds || createdAt._seconds || (createdAt instanceof Date ? createdAt.getTime()/1000 : null);
      if (!ts) return 'N/A';
      const d = new Date(ts * 1000);
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const cellBorder = 'border:1px solid #E5E7EB';
    const buildTestRows = () => {
      if (selectedInvoice.tests_detail && selectedInvoice.tests_detail.length > 0) {
        return selectedInvoice.tests_detail.map((t, i) => `
          <tr style="background:#fff">
            <td style="padding:6px 16px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;${cellBorder}">${t.name}</td>
            <td style="padding:6px 16px;font-size:13px;font-weight:800;color:${brand.dark};text-align:right;${cellBorder}">₹${t.price}</td>
          </tr>`).join('');
      }
      if (selectedInvoice.testNames) {
        return selectedInvoice.testNames.split(',').map((n, i) => `
          <tr style="background:#fff">
            <td style="padding:6px 16px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;${cellBorder}">${n.trim()}</td>
            <td style="padding:6px 16px;font-size:13px;font-weight:800;color:${brand.dark};text-align:right;${cellBorder}">-</td>
          </tr>`).join('');
      }
      return `<tr><td style="padding:10px 16px;font-size:13px;color:#374151;font-style:italic;${cellBorder}">Standard Billed Items</td><td style="padding:10px 16px;text-align:right;${cellBorder}">-</td></tr>`;
    };

    const balance = Math.max((selectedInvoice.totalAmount || 0) - (selectedInvoice.paidAmount || 0), 0);
    const isPaid = selectedInvoice.paymentStatus === 'Paid' || balance === 0;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Invoice – ${selectedInvoice.billId || selectedInvoice.bookingId}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      background: white;
      color: #111827;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: A4 portrait; margin: 0; }
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div style="width:210mm;min-height:297mm;background:white;padding:0;position:relative;margin:0 auto;">

    <!-- Top Accent Bar -->
    <div style="height:8px;background:${brand.primary};width:100%;"></div>

    <div style="padding:12mm 15mm;">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10mm;">
        <div>
          <div style="font-size:36px;font-weight:900;color:${brand.dark};letter-spacing:-1px;line-height:1;">INVOICE</div>
          <div style="height:4px;width:80px;background:${brand.primary};margin:6px 0 8px 0;border-radius:2px;"></div>
          <div style="font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:2px;">Receipt for Medical Services</div>
        </div>
        <div style="text-align:right;">
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:8px;">
            <div style="width:30px;height:30px;background:${brand.primary};border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;color:white;font-size:16px;">₹</div>
            <span style="font-size:22px;font-weight:900;color:${brand.dark};letter-spacing:-0.5px;">${labInfo?.labName?.split(' ')[0] || 'DBS'} <span style="color:${brand.primary};">${labInfo?.labName?.split(' ').slice(1).join(' ') || 'Pathology'}</span></span>
          </div>
          <div style="background:#F3F4F6;padding:4px 12px;border-radius:6px;display:inline-block;margin-bottom:4px;">
            <span style="font-size:11px;font-weight:800;color:${brand.dark};text-transform:uppercase;letter-spacing:1px;">Invoice #: ${selectedInvoice.billId || selectedInvoice.bookingId}</span>
          </div><br/>
          <span style="font-size:11px;font-weight:600;color:#6B7280;">Date: ${formatDate(selectedInvoice.createdAt)}</span>
        </div>
      </div>

      <!-- Divider -->
      <div style="height:1px;background:#E5E7EB;margin-bottom:8mm;"></div>

      <!-- Patient + Doctor Cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8mm;">
        <div style="border-left:4px solid ${brand.primary};padding:14px 16px;background:#F9FAFB;border-radius:0 12px 12px 0;">
          <div style="font-size:10px;font-weight:800;color:#9CA3AF;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Billed To Patient</div>
          <div style="font-size:16px;font-weight:900;color:${brand.dark};text-transform:uppercase;">${selectedInvoice.patientName || 'Walk-in Patient'}</div>
        </div>
        <div style="border-left:4px solid ${brand.secondary};padding:14px 16px;background:#F9FAFB;border-radius:0 12px 12px 0;">
          <div style="font-size:10px;font-weight:800;color:#9CA3AF;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Referred By</div>
          <div style="font-size:14px;font-weight:700;color:${brand.dark};">${selectedInvoice.doctorName || 'Self / Direct'}</div>
          <div style="margin-top:6px;font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;">Priority: ${selectedInvoice.urgency || 'Routine'}</div>
        </div>
      </div>

      <!-- Tests Table -->
      <div style="overflow:hidden;border:1px solid #E5E7EB;margin-bottom:8mm;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th style="padding:8px 16px;text-align:left;font-size:11px;font-weight:800;color:${brand.dark};text-transform:uppercase;letter-spacing:2px;border:1px solid #E5E7EB;">Description (Tests)</th>
              <th style="padding:8px 16px;text-align:right;font-size:11px;font-weight:800;color:${brand.dark};text-transform:uppercase;letter-spacing:2px;border:1px solid #E5E7EB;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${buildTestRows()}
          </tbody>
        </table>
      </div>

      <!-- Totals + Watermark -->
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10mm;">
        <!-- Watermark -->
        <div style="opacity:0.15;transform:rotate(-12deg);transform-origin:center left;">
          ${isPaid ? `<div style="border:5px solid ${brand.primary};color:${brand.primary};font-size:48px;font-weight:900;padding:10px 20px;border-radius:12px;letter-spacing:4px;display:inline-block;">PAID</div>` : ''}
        </div>
        <!-- Amounts Table -->
        <div style="min-width:280px;border:1px solid #E5E7EB;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 12px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;${cellBorder}">Subtotal</td>
              <td style="padding:6px 12px;font-size:13px;font-weight:800;color:${brand.dark};text-align:right;${cellBorder}">₹${selectedInvoice.subtotal || selectedInvoice.totalAmount}</td>
            </tr>
            ${(selectedInvoice.discount > 0) ? `
            <tr>
              <td style="padding:6px 12px;font-size:12px;font-weight:700;color:#EF4444;text-transform:uppercase;${cellBorder}">Discount</td>
              <td style="padding:6px 12px;font-size:13px;font-weight:800;color:#EF4444;text-align:right;${cellBorder}">−₹${selectedInvoice.discount}</td>
            </tr>` : ''}
            <tr style="background:${brand.light}">
              <td style="padding:8px 12px;font-size:15px;font-weight:900;color:${brand.dark};text-transform:uppercase;${cellBorder}">Grand Total</td>
              <td style="padding:8px 12px;font-size:18px;font-weight:900;color:${brand.dark};text-align:right;${cellBorder}">₹${selectedInvoice.totalAmount}</td>
            </tr>
            <tr>
              <td style="padding:6px 12px;font-size:12px;font-weight:700;color:${brand.primary};text-transform:uppercase;${cellBorder}">Amount Paid</td>
              <td style="padding:6px 12px;font-size:13px;font-weight:800;color:${brand.primary};text-align:right;${cellBorder}">₹${selectedInvoice.paidAmount || 0}</td>
            </tr>
            ${balance > 0 ? `
            <tr>
              <td style="padding:6px 12px;font-size:12px;font-weight:800;color:#EF4444;text-transform:uppercase;${cellBorder}">Balance Due</td>
              <td style="padding:6px 12px;font-size:13px;font-weight:900;color:#EF4444;text-align:right;${cellBorder}">₹${balance}</td>
            </tr>` : ''}
          </table>
        </div>
      </div>

      <!-- Footer -->
      <div style="border-top:1px solid #E5E7EB;padding-top:8mm;text-align:center;">
        <div style="display:flex;justify-content:center;gap:8px;margin-bottom:8px;">
          <div style="width:8px;height:8px;border-radius:50%;background:${brand.primary};"></div>
          <div style="width:8px;height:8px;border-radius:50%;background:${brand.secondary};"></div>
          <div style="width:8px;height:8px;border-radius:50%;background:${brand.dark};"></div>
        </div>
        <div style="font-size:12px;font-weight:800;color:${brand.dark};text-transform:uppercase;letter-spacing:3px;margin-bottom:4px;">Thank you for trusting ${labInfo?.labName || 'our services'}</div>
        <div style="font-size:10px;font-weight:600;color:#D1D5DB;text-transform:uppercase;letter-spacing:1px;">Quality Diagnostics • Real-time Results • Professional Excellence</div>
        <div style="margin-top:10px;font-size:9px;color:#D1D5DB;font-style:italic;">This is a system generated legal receipt. Signature not required.</div>
      </div>

    </div>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) { alert('Please allow popups for this site to print.'); return; }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 1200);
  };

  const { data: bills = [], isLoading: loading, refetch: fetchBills } = useQuery({
    queryKey: ['bills', activeLabId, dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!activeLabId && userData?.role !== 'SuperAdmin') return [];
      const start = new Date(dateRange.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);

      let q = activeLabId 
        ? query(collection(db, 'bookings'), where('labId', '==', activeLabId), where('createdAt', '>=', start), where('createdAt', '<=', end))
        : query(collection(db, 'bookings'), where('createdAt', '>=', start), where('createdAt', '<=', end));

      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      items.sort((a, b) => {
        const getTime = (val) => {
          if (!val) return 0;
          if (val.seconds) return val.seconds * 1000 + (val.nanoseconds / 1000000);
          if (val.toDate) return val.toDate().getTime();
          const d = new Date(val);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      });
      
      return items;
    },
    enabled: !!userData,
    onError: (error) => {
      console.error('Error fetching bills:', error);
      if (error.message && error.message.includes('requires an index')) {
         const urlMatch = error.message.match(/(https:\/\/console\.firebase\.google\.com[^\s]+)/);
         const indexUrl = urlMatch ? urlMatch[0] : null;
         toast.error(
           (t) => (
             <div className="flex flex-col gap-2">
               <span className="font-bold">Database Index Required!</span>
               <span className="text-xs">To enable Date Filtering and save reads, please create a Firebase Index.</span>
               {indexUrl && (
                 <a href={indexUrl} target="_blank" rel="noreferrer" className="bg-brand-dark text-white px-3 py-1.5 rounded-lg text-xs font-bold text-center mt-1">
                   Create Index Now
                 </a>
               )}
             </div>
           ),
           { duration: 15000, position: 'top-center' }
         );
      } else {
         toast.error("Failed to load bills");
      }
    }
  });

  // ─── Filters & Counts ──────────────────────────────────────────────────
  const statusCounts = React.useMemo(() => {
    const counts = { All: bills.length, Paid: 0, Unpaid: 0 };
    bills.forEach(b => {
      if (b.paymentStatus === 'Paid') counts.Paid++;
      else counts.Unpaid++;
    });
    return counts;
  }, [bills]);

  const filteredBills = React.useMemo(() => {
    return bills.filter(b => {
      const nameMatch = b.patientName?.toLowerCase().includes(searchTerm.toLowerCase());
      const idMatch = b.billId?.toLowerCase().includes(searchTerm.toLowerCase()) || b.id?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!nameMatch && !idMatch) return false;

      if (filter === 'All') return true;
      return b.paymentStatus === filter;
    });
  }, [bills, searchTerm, filter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter, rowsPerPage]);

  const paginatedBills = React.useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredBills.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredBills, currentPage, rowsPerPage]);

  const handleUpdatePayment = async (billId, addAmount) => {
    const bill = bills.find(b => b.id === billId);
    if (!bill || !addAmount || isNaN(addAmount)) return;
    
    const method = payMethodInput[billId] || 'Cash';
    const newPaid = (parseFloat(bill.paidAmount) || 0) + parseFloat(addAmount);
    const newBalance = Math.max((parseFloat(bill.totalAmount) || 0) - newPaid, 0);
    
    // New payment record
    const paymentRecord = {
      amount: parseFloat(addAmount),
      method: method,
      date: new Date()
    };

    try {
      await updateDoc(doc(db, 'bookings', billId), {
        paidAmount: newPaid,
        balance: newBalance,
        paymentStatus: newBalance <= 0 ? 'Paid' : 'Unpaid',
        paymentHistory: bill.paymentHistory ? [...bill.paymentHistory, paymentRecord] : [paymentRecord],
        updatedAt: serverTimestamp()
      });
      setPayAmountInput(prev => ({ ...prev, [billId]: '' }));
      fetchBills();
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['reportsAndBookings'] });
      toast.success(`Payment of ₹${addAmount} (${method}) recorded!`);
    } catch (error) {
      console.error('Error updating payment:', error);
      alert("Update failed: " + error.message);
    }
  };

  return (
    <>
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 w-full flex-grow text-slate-800 animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-brand-dark leading-tight flex items-center">
            <div className="p-2 bg-brand-light rounded-xl mr-3 shadow-sm border border-brand-primary/10 transition-transform hover:scale-110">
              <IndianRupee className="w-5 h-5 text-brand-primary" />
            </div>
            Billing
          </h1>
          <p className="text-[11px] font-medium text-slate-500 mt-1 tracking-wide">Track and manage financial records and patient invoices.</p>
        </div>
      </div>

      {/* Search and Filters Header */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        {/* Left Side: Search Bar */}
        <div className="flex-[2] relative group shadow-sm transition-all focus-within:shadow-md rounded-xl max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
          <input type="text"
            className="w-full h-10 pl-11 pr-6 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary/20 transition-all font-bold text-[13px] text-brand-dark outline-none placeholder:text-slate-400 shadow-sm"
            placeholder="Search by invoice ID or patient..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {/* Right Side: Quick Filter Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 -mb-1">
          <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-sm h-10 shrink-0">
            {[
              { id: 'Unpaid', label: 'Due', color: 'bg-rose-500', count: statusCounts.Unpaid },
              { id: 'Paid', label: 'Paid', color: 'bg-emerald-500', count: statusCounts.Paid },
              { id: 'All', label: 'All', color: 'bg-slate-400', count: statusCounts.All }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setFilter(btn.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap h-full ${
                  filter === btn.id 
                    ? 'bg-brand-dark text-white shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${filter === btn.id ? 'bg-white' : btn.color}`}></div>
                <span className="text-[10px] font-bold uppercase tracking-wider">{btn.label}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md tabular-nums ${
                  filter === btn.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {btn.count}
                </span>
              </button>
            ))}
          </div>
          
          {/* Date Picker */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-sm h-10 shrink-0 px-2 overflow-hidden">
             <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-transparent text-[11px] font-bold text-slate-600 outline-none cursor-pointer w-[110px]"
             />
             <span className="text-slate-300 mx-1">-</span>
             <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-transparent text-[11px] font-bold text-slate-600 outline-none cursor-pointer w-[110px]"
             />
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto pr-2 -mr-2 custom-scrollbar min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 relative" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="sticky top-0 z-20 bg-slate-50 px-6 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider shadow-sm">Invoice / Patient</th>
              <th className="sticky top-0 z-20 bg-slate-50 px-6 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider shadow-sm">Total Amount</th>
              <th className="sticky top-0 z-20 bg-slate-50 px-6 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider shadow-sm">Paid / Due</th>
              <th className="sticky top-0 z-20 bg-slate-50 px-6 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider shadow-sm">Status</th>
              <th className="sticky top-0 z-20 bg-slate-50 px-6 py-3 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider shadow-sm">Recording Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <Loader className="w-10 h-10 animate-spin text-brand-dark mx-auto mb-5" />
                    <p className="text-[14px] font-medium text-slate-500">Synchronizing Records...</p>
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-32 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-[40px] flex items-center justify-center mx-auto mb-6 transition-transform hover:rotate-12">
                      <IndianRupee className="w-8 h-8 text-slate-200" />
                    </div>
                    <p className="text-[16px] font-medium text-slate-400">Zero Matching Records Found</p>
                  </td>
                </tr>
              ) : (
                paginatedBills.map((bill) => (
                  <React.Fragment key={bill.id}>
                  <tr className="hover:bg-slate-50 transition-colors group border-b border-slate-100 relative">
                    <td className="px-6 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className={`inline-flex px-2 py-1 rounded-md text-[11px] font-bold transition-all ${parseFloat(bill.balance || 0) > 0 ? 'bg-rose-600 text-white shadow-sm' : 'text-brand-dark bg-slate-100'}`}>
                          {bill.billId || bill.bookingId}
                        </div>
                        <div>
                          <div className="text-[14px] font-semibold text-brand-dark leading-tight group-hover:text-brand-primary transition-colors">{bill.patientName || 'Walk-in Patient'}</div>
                          <div className="text-[11px] font-medium text-slate-500 mt-0.5 uppercase tracking-wider">
                            Patient ID: {bill.patientId?.includes('_') ? bill.patientId.split('_')[1] : bill.patientId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-2.5">
                      <div className="text-[13px] font-bold text-brand-dark tabular-nums tracking-tighter flex items-center gap-1.5">
                        ₹{bill.totalAmount}
                        {bill.discount > 0 && (
                          <span className="text-[10px] text-slate-400 font-medium line-through decoration-rose-400/40">₹{bill.subtotal || (parseFloat(bill.totalAmount) + parseFloat(bill.discount))}</span>
                        )}
                      </div>
                      <div className="text-[11px] font-medium text-slate-500 mt-1">
                        {(() => {
                           if (!bill.createdAt) return 'Processing...';
                           const ts = bill.createdAt.seconds || bill.createdAt._seconds;
                           if (!ts) return 'N/A';
                           const d = new Date(ts * 1000);
                           return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-2.5">
                      <div className="text-[13px] font-bold text-slate-700 tabular-nums tracking-tight">Paid: ₹{bill.paidAmount || 0}</div>
                      <div className={`text-[11px] font-semibold uppercase tracking-wider mt-1 ${parseFloat(bill.balance || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {parseFloat(bill.balance || 0) > 0 ? `Due: ₹${bill.balance}` : '• Fully Paid'}
                      </div>
                    </td>
                    <td className="px-6 py-2.5">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${
                        bill.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${bill.paymentStatus === 'Paid' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        {bill.paymentStatus || 'Unpaid'}
                      </span>
                    </td>
                    <td className="px-6 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2 transition-all">
                        {bill.paymentStatus !== 'Paid' && bill.status !== 'Cancelled' ? (
                          <>
                             <div className="flex bg-slate-50 border border-slate-200 rounded-lg p-0.5 overflow-hidden h-9">
                              <select 
                                className="bg-transparent border-none text-[11px] font-bold text-brand-dark focus:ring-0 cursor-pointer pr-5 py-0"
                                value={payMethodInput[bill.id] || 'Cash'}
                                onChange={(e) => setPayMethodInput(prev => ({ ...prev, [bill.id]: e.target.value }))}
                              >
                                <option value="Cash">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="Card">Card</option>
                              </select>
                            </div>
                            <input 
                              type="number"
                              placeholder="Amount"
                              className="w-24 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/5 focus:border-brand-primary transition-all tabular-nums h-9 shadow-sm"
                              value={payAmountInput[bill.id] || ''}
                              onChange={(e) => setPayAmountInput(prev => ({ ...prev, [bill.id]: e.target.value }))}
                            />
                             {parseFloat(payAmountInput[bill.id] || 0) > 0 && (
                               <button 
                                 onClick={() => handleUpdatePayment(bill.id, payAmountInput[bill.id])}
                                 className="px-3 py-1.5 bg-brand-dark text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-all shadow-sm active:scale-95 h-9"
                               >
                                 Collect
                               </button>
                             )}
                             <button 
                               onClick={() => {
                                 toast(
                                   ({ closeToast }) => (
                                     <div className="flex flex-col gap-3 p-1">
                                       <h3 className="font-bold text-brand-dark text-[14px]">Confirm Payment</h3>
                                       <p className="text-[12px] text-slate-600">Are you sure you want to collect the full balance of <span className="font-bold text-brand-dark">₹{bill.balance}</span> via {payMethodInput[bill.id] || 'Cash'}?</p>
                                       <div className="flex justify-end gap-2 mt-2">
                                         <button onClick={closeToast} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors">Cancel</button>
                                         <button onClick={() => {
                                           const currentMethod = payMethodInput[bill.id] || 'Cash';
                                           setPayMethodInput(prev => ({ ...prev, [bill.id]: currentMethod }));
                                           handleUpdatePayment(bill.id, bill.balance);
                                           closeToast();
                                         }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-[11px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-sm">Confirm</button>
                                       </div>
                                     </div>
                                   ),
                                   { position: "top-center", autoClose: false, closeOnClick: false, draggable: false }
                                 );
                               }}
                               className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-sm active:scale-95 flex items-center gap-1.5 whitespace-nowrap h-9"
                               title="Receive Full Payment"
                             >
                               <CheckCircle2 className="w-3.5 h-3.5" />
                               Full Pay
                             </button>
                          </>
                        ) : (
                           <div className="flex items-center gap-2">
                             {bill.status !== 'Cancelled' && (
                               <>
                                 {bill.paymentHistory && bill.paymentHistory.length > 0 && (
                                   <button 
                                     onClick={() => setShowHistory(prev => ({ ...prev, [bill.id]: !prev[bill.id] }))}
                                     className="px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 hover:text-brand-dark transition-all border border-slate-200 flex items-center gap-1.5 h-9"
                                   >
                                     <Clock className="w-3.5 h-3.5" />
                                     <span className="text-[10px] font-bold uppercase tracking-wider">History</span>
                                   </button>
                                 )}
                                 <button 
                                   onClick={() => setSelectedInvoice(bill)}
                                   className="px-3 py-1.5 bg-slate-50 text-brand-dark border border-slate-200 rounded-lg hover:bg-brand-dark hover:text-white transition-all shadow-sm flex items-center gap-1.5 h-9"
                                   title="Print Invoice"
                                 >
                                   <Printer className="w-3.5 h-3.5" />
                                   <span className="text-[10px] font-bold uppercase tracking-wider">Print</span>
                                 </button>
                               </>
                             )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expandable Payment History Row */}
                  {showHistory[bill.id] && bill.paymentHistory && (
                    <tr className="bg-slate-50">
                      <td colSpan="5" className="px-12 py-8 border-b border-slate-200">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-slate-200">
                              <Clock className="w-5 h-5 text-brand-dark" />
                           </div>
                           <div>
                             <h4 className="text-[14px] font-bold text-brand-dark leading-none">Payment Timeline</h4>
                             <p className="text-[11px] font-medium text-slate-500 mt-1.5 uppercase tracking-wider">Sequential records of all financial transactions</p>
                           </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                          {bill.paymentHistory.map((p, idx) => (
                            <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center relative group/card hover:border-brand-primary/20 transition-all hover:shadow-md">
                               <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase mb-3 border shadow-sm ${
                                 p.method === 'UPI' ? 'bg-sky-50 text-sky-600 border-sky-100' : 
                                 p.method === 'Card' ? 'bg-violet-50 text-violet-600 border-violet-100' : 
                                 'bg-emerald-50 text-emerald-600 border-emerald-100'
                               }`}>
                                 {p.method}
                               </div>
                               <div className="text-xl font-bold text-brand-dark mb-1 tabular-nums tracking-tighter flex items-baseline gap-1">
                                 ₹{p.amount}
                                 {p.discount > 0 && (
                                   <span className="text-[10px] font-bold text-rose-500 whitespace-nowrap">
                                     (-₹{p.discount} Disc)
                                   </span>
                                 )}
                               </div>
                               <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                                 {(() => {
                                   if (!p.date) return 'N/A';
                                   const d = p.date.seconds ? new Date(p.date.seconds * 1000) : (p.date.toDate ? p.date.toDate() : new Date(p.date));
                                   return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;
                                 })()}
                               </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

      {/* Pagination Footer */}
      <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-4 px-6 pb-6">
        <div className="flex items-center gap-4">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Records <span className="text-brand-dark font-bold px-1">{(currentPage - 1) * rowsPerPage + 1}-{Math.min(currentPage * rowsPerPage, filteredBills.length)}</span> of <span className="text-brand-dark font-bold">{filteredBills.length}</span>
          </p>
          <div className="h-3 w-[1px] bg-slate-200 hidden md:block" />
          <select 
             className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-[11px] font-bold text-brand-dark outline-none cursor-pointer hover:bg-white transition-all uppercase tracking-wider"
             value={rowsPerPage}
             onChange={e => setRowsPerPage(parseInt(e.target.value))}
           >
             <option value={5}>5 / page</option>
             <option value={10}>10 / page</option>
             <option value={20}>20 / page</option>
             <option value={50}>50 / page</option>
           </select>
        </div>

        <div className="flex items-center gap-2">
             <button 
               onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
               disabled={currentPage === 1}
               className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 hover:text-brand-dark hover:border-brand-dark disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-sm active:scale-90"
              >
               <ChevronLeft className="w-4 h-4" />
             </button>
             
             <div className="flex items-center gap-2">
               {(() => {
                 const totalPages = Math.ceil(filteredBills.length / rowsPerPage);
                 if (totalPages === 0) return null;
                 
                 let pages = [];
                 if (totalPages <= 7) {
                   for (let i = 1; i <= totalPages; i++) pages.push(i);
                 } else {
                   if (currentPage <= 4) {
                     pages = [1, 2, 3, 4, 5, '...', totalPages];
                   } else if (currentPage >= totalPages - 3) {
                     pages = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
                   } else {
                     pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
                   }
                 }
                 
                 return pages.map((p, i) => (
                    <button 
                      key={i}
                      onClick={() => p !== '...' && setCurrentPage(p)}
                      disabled={p === '...'}
                      className={`w-9 h-9 rounded-xl text-[12px] font-bold transition-all duration-300 flex items-center justify-center ${
                        currentPage === p 
                          ? 'bg-brand-dark text-white shadow-lg' 
                          : p === '...' 
                            ? 'bg-transparent text-slate-400 cursor-default border-none'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {p}
                    </button>
                 ));
               })()}
             </div>

             <button 
               onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredBills.length / rowsPerPage), p + 1))}
               disabled={currentPage === Math.ceil(filteredBills.length / rowsPerPage) || Math.ceil(filteredBills.length / rowsPerPage) === 0}
               className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 hover:text-brand-dark hover:border-brand-dark disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-sm active:scale-90"
              >
               <ChevronRight className="w-5 h-5" />
             </button>
        </div>
      </div>

      {/* Printable Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:p-0 print:bg-white print:absolute print:inset-0 print:block">
          <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto hide-scrollbar rounded-[32px] shadow-2xl relative print:max-h-none print:shadow-none print:rounded-none overflow-visible print:w-full print:max-w-full">
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 sm:px-8 py-4 sm:py-5 flex items-center justify-between z-10 rounded-t-[32px] no-print">
              <h2 className="text-lg sm:text-xl font-black text-brand-dark uppercase tracking-tighter">Invoice Preview</h2>
              <div className="flex gap-2 sm:gap-3">
                <button 
                  onClick={handlePrint}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 bg-brand-primary text-white font-black text-[11px] sm:text-sm uppercase tracking-widest rounded-xl hover:bg-brand-primary/90 transition-all shadow-lg flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button 
                  onClick={() => setSelectedInvoice(null)}
                  className="p-2 sm:p-2.5 bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* The Actual Printed Section */}
            <div id="printable-invoice" className="bg-white relative">
              {/* Top Accent Bar */}
              <div className="absolute top-0 left-0 right-0 h-4 bg-brand-primary print:h-3"></div>
              
              <div className="p-6 sm:p-10 pt-10 sm:pt-14">
                {/* Header */}
                <div className="flex justify-between items-start mb-6 sm:mb-12">
                  <div>
                    <h1 className="text-3xl sm:text-5xl font-black text-brand-dark uppercase tracking-tighter mb-1">INVOICE</h1>
                    <div className="h-1 sm:h-1.5 w-16 sm:w-24 bg-brand-primary mb-3"></div>
                    <p className="text-[10px] sm:text-[12px] font-black text-slate-400 uppercase tracking-[0.1em] sm:tracking-[0.2em] ml-1">Receipt for Medical Services</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl sm:text-3xl font-black text-brand-dark uppercase tracking-tighter mb-1 flex items-center justify-end">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 bg-brand-primary rounded-lg mr-2 sm:mr-3 shadow-sm border border-black/5 flex items-center justify-center">
                         <IndianRupee className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                      </div>
                      {labInfo?.labName?.split(' ')[0] || 'DBS'} <span className="text-brand-primary ml-1.5 sm:ml-2">{labInfo?.labName?.split(' ').slice(1).join(' ') || 'Pathology'}</span>
                    </div>
                    <div className="space-y-1 mt-4">
                      <p className="text-[11px] font-black text-brand-dark uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-md inline-block">Invoice #: {selectedInvoice.billId || selectedInvoice.bookingId}</p>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block">
                        Date: {(() => {
                        if (!selectedInvoice?.createdAt) return 'N/A';
                        const ts = selectedInvoice.createdAt.seconds || selectedInvoice.createdAt._seconds;
                        if (!ts) return 'N/A';
                        const d = new Date(ts * 1000);
                        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
                      })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Patient Details Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-12">
                  <div className="p-6 bg-slate-50/50 rounded-[24px] border-l-4 border-brand-primary shadow-sm">
                    <div className="flex items-center mb-3">
                      <Users className="w-4 h-4 text-brand-primary mr-2" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Billed To Patient</p>
                    </div>
                    <p className="text-lg sm:text-xl font-black text-brand-dark uppercase tracking-tight">{selectedInvoice.patientName || 'Walk-in Patient'}</p>
                    {selectedInvoice.patientDetails && (
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black text-slate-500 uppercase">
                        {selectedInvoice.patientDetails.age && <span className="bg-white px-2 py-1 rounded border border-slate-100 shadow-sm">Age: {selectedInvoice.patientDetails.age} Yrs</span>}
                        {selectedInvoice.patientDetails.gender && <span className="bg-white px-2 py-1 rounded border border-slate-100 shadow-sm">Gender: {selectedInvoice.patientDetails.gender}</span>}
                      </div>
                    )}
                  </div>
                  <div className="p-6 bg-slate-50/50 rounded-[24px] border-l-4 border-brand-secondary shadow-sm">
                    <div className="flex items-center mb-3">
                      <Stethoscope className="w-4 h-4 text-brand-secondary mr-2" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Referred By</p>
                    </div>
                    <p className="text-lg sm:text-xl font-black text-brand-dark uppercase tracking-tight">{selectedInvoice.doctorName || 'Self / Direct'}</p>
                    <div className="mt-3 text-[11px] font-black text-slate-500 uppercase">
                       <span className="bg-white px-2 py-1 rounded border border-slate-100 shadow-sm flex items-center w-fit">
                         Priority: <span className="text-brand-secondary ml-1">{selectedInvoice.urgency || 'Routine'}</span>
                       </span>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="mb-12 overflow-hidden rounded-[24px] border border-slate-200 shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-brand-dark">
                      <tr>
                        <th className="px-8 py-5 text-[11px] font-black text-white uppercase tracking-[0.2em]">Description (Tests)</th>
                        <th className="px-8 py-5 text-[11px] font-black text-white uppercase tracking-[0.2em] text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvoice.tests_detail && selectedInvoice.tests_detail.length > 0 ? (
                        selectedInvoice.tests_detail.map((test, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-5 text-[14px] font-bold text-slate-700 uppercase">{test.name}</td>
                            <td className="px-8 py-5 text-[14px] font-black text-brand-dark text-right tabular-nums">₹{test.price}</td>
                          </tr>
                        ))
                      ) : selectedInvoice.testNames ? (
                        selectedInvoice.testNames.split(',').map((testName, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-5 text-[14px] font-bold text-slate-700 uppercase">{testName.trim()}</td>
                            <td className="px-8 py-5 text-[14px] font-black text-brand-dark text-right tabular-nums">-</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-5 text-[14px] font-bold text-slate-700 uppercase italic">Standard Billed Items</td>
                          <td className="px-8 py-5 text-[14px] font-black text-brand-dark text-right tabular-nums">-</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Totals & Watermark Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-end">
                  <div className="relative flex justify-center md:justify-start">
                    {selectedInvoice.paymentStatus === 'Paid' && (
                      <div className="opacity-20 rotate-[-12deg] pointer-events-none scale-75 sm:scale-100 transform origin-center md:origin-left">
                        <div className="border-[6px] border-brand-primary text-brand-primary text-5xl sm:text-6xl font-black p-4 sm:p-6 rounded-2xl uppercase tracking-widest inline-block shadow-lg">PAID</div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between text-[13px] font-black text-slate-400 uppercase tracking-widest pl-4">
                      <span>Subtotal</span>
                      <span className="tabular-nums text-slate-600">₹{selectedInvoice.subtotal || selectedInvoice.totalAmount}</span>
                    </div>
                    {(selectedInvoice.discount > 0) && (
                      <div className="flex justify-between text-[13px] font-black text-rose-400 uppercase tracking-widest pl-4">
                        <span>Discount</span>
                        <span className="tabular-nums">- ₹{selectedInvoice.discount}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xl font-black text-brand-dark uppercase bg-brand-light/30 p-5 rounded-2xl border border-brand-primary/10 shadow-inner">
                      <span>Grand Total</span>
                      <span className="tabular-nums tracking-tighter">₹{selectedInvoice.totalAmount}</span>
                    </div>
                    <div className="flex justify-between text-[13px] font-black text-brand-primary uppercase tracking-widest pl-4 pt-1">
                      <span>Amount Paid</span>
                      <span className="tabular-nums">₹{selectedInvoice.paidAmount || 0}</span>
                    </div>
                    {((selectedInvoice.totalAmount || 0) - (selectedInvoice.paidAmount || 0)) > 0 && (
                      <div className="flex justify-between text-[14px] font-black text-rose-500 uppercase tracking-widest pl-4 pt-4 border-t border-slate-100">
                        <span>Balance Due</span>
                        <span className="tabular-nums">₹{Math.max((selectedInvoice.totalAmount || 0) - (selectedInvoice.paidAmount || 0), 0)}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Footer Section */}
                <div className="mt-24 text-center border-t-2 border-slate-100 pt-8">
                  <div className="flex justify-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-brand-primary"></div>
                    <div className="w-2 h-2 rounded-full bg-brand-secondary"></div>
                    <div className="w-2 h-2 rounded-full bg-brand-dark"></div>
                  </div>
                  <p className="text-[12px] font-black text-brand-dark uppercase tracking-[0.3em] mb-2">Thank you for trusting Lab Mitra</p>
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Quality Diagnostics • Real-time Results • Professional Excellence</p>
                  <div className="mt-6 text-[9px] font-bold text-slate-300 uppercase italic">This is a system generated legal receipt. Signature not required.</div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </div>
    </>

  );
};

export default Bills;
