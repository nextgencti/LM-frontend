import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Search, Loader, FileText, IndianRupee, CheckCircle2, AlertCircle, Clock, Filter, Printer, X, Users, Stethoscope, Pencil } from 'lucide-react';
import { toast } from 'react-toastify';

const Bills = () => {
  const { userData, activeLabId } = useAuth();
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('Unpaid');
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

    const brand = { primary: '#9BCF83', secondary: '#6B85A8', dark: '#2D3250', light: '#EEFABD' };

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

  useEffect(() => {
    fetchBills();
  }, [userData, activeLabId]);

  const fetchBills = async () => {
    if (!activeLabId && userData?.role !== 'SuperAdmin') return;
    setLoading(true);
    try {
      let q;
      if (activeLabId) {
        q = query(collection(db, 'bookings'), where('labId', '==', activeLabId));
      } else {
        q = query(collection(db, 'bookings'));
      }
      
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort by date desc in JS to avoid Firestore missing composite index error
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
      
      setBills(items);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  };

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
      toast.success(`Payment of ₹${addAmount} (${method}) recorded!`);
    } catch (error) {
      console.error('Error updating payment:', error);
      alert("Update failed: " + error.message);
    }
  };

  return (
    <>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow text-slate-800 animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-brand-dark tracking-tighter flex items-center text-left leading-none">
            <div className="p-2 sm:p-2.5 bg-brand-light rounded-2xl mr-4 shadow-sm border border-brand-primary/10 transition-transform hover:scale-110">
              <IndianRupee className="w-7 h-7 sm:w-8 sm:h-8 text-brand-primary" />
            </div>
            Billing
          </h1>
          <p className="text-slate-500 mt-2 sm:mt-3 font-medium text-sm sm:text-base">Track and manage financial records.</p>
        </div>
      </div>

      {/* Sticky Filters Header */}
      <div className="sticky top-0 z-[40] -mx-4 sm:-mx-8 px-4 sm:px-8 py-4 bg-[#F8FAFC]/80 backdrop-blur-xl border-b border-slate-100 mb-8 transition-all">
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6 items-start lg:items-center">
          
          {/* Left Side: Search Bar */}
          <div className="relative flex-grow w-full lg:max-w-2xl group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
            </div>
            <input type="text"
              className="block w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-[22px] focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 text-sm font-bold text-brand-dark outline-none transition-all placeholder:text-slate-300 shadow-sm"
              placeholder="Search by invoice ID or patient..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          {/* Right Side: Quick Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-[24px] shadow-sm w-full lg:w-auto overflow-x-auto no-scrollbar">
            {[
              { id: 'Unpaid', label: 'Due', color: 'bg-rose-500', count: statusCounts.Unpaid },
              { id: 'Paid', label: 'Paid', color: 'bg-emerald-500', count: statusCounts.Paid },
              { id: 'All', label: 'All', color: 'bg-slate-400', count: statusCounts.All }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setFilter(btn.id)}
                className={`flex items-center gap-2.5 px-4 py-2 rounded-[18px] transition-all whitespace-nowrap group/btn ${
                  filter === btn.id 
                    ? 'bg-brand-dark text-white shadow-lg scale-[1.05]' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${filter === btn.id ? 'bg-white' : btn.color}`}></div>
                <span className="text-[11px] font-black uppercase tracking-wider">{btn.label}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg tabular-nums ${
                  filter === btn.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {btn.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto pr-2 -mr-2 custom-scrollbar min-h-0 bg-white rounded-[32px] shadow-sm border border-slate-100" style={{ maxHeight: 'calc(100vh - 360px)' }}>
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-[#f1f5f9] sticky top-0 z-[20] border-b border-slate-200">
            <tr>
              <th className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Invoice / Patient</th>
              <th className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Total Amount</th>
              <th className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Paid / Due</th>
              <th className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Status</th>
              <th className="px-8 py-5 text-right text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Recording Details</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center">
                    <Loader className="h-10 w-10 animate-spin text-brand-primary mx-auto mb-4" />
                    <p className="text-slate-400 font-black uppercase text-[12px] tracking-widest">Loading...</p>
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                      <IndianRupee className="w-8 h-8" />
                    </div>
                    <p className="text-slate-500 font-bold">No bills found.</p>
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <React.Fragment key={bill.id}>
                  <tr className="hover:bg-brand-light/10 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-brand-light/40 rounded-xl border border-brand-primary/10">
                          <FileText className="w-4 h-4 text-brand-primary" />
                        </div>
                        <div>
                          <div className="text-[14px] font-black text-brand-dark tracking-tight leading-none mb-1">{bill.billId || bill.bookingId}</div>
                          <div className="text-[12px] font-black text-brand-secondary uppercase tracking-tighter">{bill.patientName || 'Walk-in Patient'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-base font-black text-brand-dark tabular-nums tracking-tighter">₹{bill.totalAmount}</div>
                      <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">
                        {(() => {
                           if (!bill.createdAt) return 'Processing...';
                           const ts = bill.createdAt.seconds || bill.createdAt._seconds;
                           if (!ts) return 'N/A';
                           const d = new Date(ts * 1000);
                           return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
                        })()}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-[14px] font-bold text-slate-700 tabular-nums tracking-tight">Paid: ₹{bill.paidAmount || 0}</div>
                      <div className={`text-[12px] font-black uppercase tracking-widest mt-1 ${parseFloat(bill.balance || 0) > 0 ? 'text-rose-500' : 'text-brand-primary'}`}>
                        {parseFloat(bill.balance || 0) > 0 ? `Due: ₹${bill.balance}` : '• Fully Paid'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border shadow-sm ${
                        bill.paymentStatus === 'Paid' ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20' : 'bg-rose-50 text-rose-500 border-rose-100'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-2 ${bill.paymentStatus === 'Paid' ? 'bg-brand-primary animate-pulse shadow-brand-primary/50' : 'bg-rose-500 shadow-rose-500/50'}`}></div>
                        {bill.paymentStatus || 'Unpaid'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-3 transition-all min-h-[40px]">
                        {bill.paymentStatus !== 'Paid' ? (
                          <>
                             <div className="flex bg-slate-50 border border-slate-100 rounded-xl p-1 overflow-hidden h-[40px]">
                              <select 
                                className="bg-transparent border-none text-[10px] font-black text-brand-dark focus:ring-0 cursor-pointer pr-6"
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
                              className="w-24 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[12px] font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 transition-all tabular-nums h-[40px]"
                              value={payAmountInput[bill.id] || ''}
                              onChange={(e) => setPayAmountInput(prev => ({ ...prev, [bill.id]: e.target.value }))}
                            />
                             {parseFloat(payAmountInput[bill.id] || 0) > 0 && (
                               <button 
                                 onClick={() => handleUpdatePayment(bill.id, payAmountInput[bill.id])}
                                 className="px-5 py-2.5 bg-brand-dark text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-lg shadow-brand-dark/10 active:scale-95 h-[40px]"
                               >
                                 Collect
                               </button>
                             )}
                             <button 
                               onClick={() => {
                                 const currentMethod = payMethodInput[bill.id] || 'Cash';
                                 setPayMethodInput(prev => ({ ...prev, [bill.id]: currentMethod }));
                                 handleUpdatePayment(bill.id, bill.balance);
                               }}
                               className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-1.5 whitespace-nowrap h-[40px]"
                               title="Receive Full Payment"
                             >
                               <CheckCircle2 className="w-4 h-4" />
                               Full Pay
                             </button>
                          </>
                        ) : (
                           <div className="flex items-center gap-2">
                             {bill.paymentHistory && bill.paymentHistory.length > 0 && (
                               <button 
                                 onClick={() => setShowHistory(prev => ({ ...prev, [bill.id]: !prev[bill.id] }))}
                                 className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-brand-light hover:text-brand-primary transition-all border border-slate-100 flex items-center gap-2 px-4 h-[40px]"
                               >
                                 <Clock className="w-4 h-4" />
                                 <span className="text-[10px] font-black uppercase tracking-widest">History</span>
                               </button>
                             )}
                             <button 
                               onClick={() => setSelectedInvoice(bill)}
                               className="p-2.5 bg-brand-light/30 text-brand-primary rounded-xl hover:bg-brand-primary hover:text-white transition-all shadow-sm group/btn flex items-center gap-2 px-4 h-[40px]"
                               title="Print Invoice"
                             >
                               <Printer className="w-4 h-4" />
                               <span className="text-[11px] font-black uppercase tracking-widest">Print Invoice</span>
                             </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expandable Payment History Row */}
                  {showHistory[bill.id] && bill.paymentHistory && (
                    <tr className="bg-slate-50/50">
                      <td colSpan="5" className="px-12 py-8 border-b border-slate-100">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="w-10 h-10 rounded-2xl bg-brand-primary/10 flex items-center justify-center rotate-3 shadow-inner">
                              <Clock className="w-5 h-5 text-brand-primary" />
                           </div>
                           <div>
                             <h4 className="text-[13px] font-black text-brand-dark uppercase tracking-[0.2em] leading-none">Payment Timeline</h4>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Sequential records of all financial transactions</p>
                           </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                          {bill.paymentHistory.map((p, idx) => (
                            <div key={idx} className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex flex-col items-center text-center relative group/card hover:border-brand-primary/20 transition-all hover:shadow-md">
                               <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase mb-3 border shadow-sm ${
                                 p.method === 'UPI' ? 'bg-sky-50 text-sky-500 border-sky-100' : 
                                 p.method === 'Card' ? 'bg-violet-50 text-violet-500 border-violet-100' : 
                                 'bg-emerald-50 text-emerald-500 border-emerald-100'
                               }`}>
                                 {p.method}
                               </div>
                               <div className="text-xl font-black text-brand-dark mb-1 tabular-nums tracking-tighter">₹{p.amount}</div>
                               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                 {(() => {
                                   if (!p.date) return 'N/A';
                                   const d = p.date.seconds ? new Date(p.date.seconds * 1000) : new Date(p.date);
                                   return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()} • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;
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
