import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc, deleteDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, Loader, Calendar, User, FileText, CheckCircle, Clock, AlertCircle, X, Trash2, Database } from 'lucide-react';
import { toast } from 'react-toastify';
import { generateLabId, generateBatchIds } from '../utils/idGenerator';

const Bookings = () => {
  const { userData, activeLabId } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [tests, setTests] = useState([]);
  
  const [newBooking, setNewBooking] = useState({
    patientId: '', doctorId: '', testIds: [], 
    subtotal: 0, discount: 0, totalAmount: 0, paidAmount: 0, 
    status: 'Pending', urgency: 'Routine', notes: '',
    paymentStatus: 'Unpaid', balance: 0
  });
  
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [urgencyFilter, setUrgencyFilter] = useState('All');
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState(null);
  const [selectedTestsBooking, setSelectedTestsBooking] = useState(null);

  // Date Filters
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchBookings();
    if (showAddModal) {
      fetchCreationData();
    }
  }, [userData, activeLabId, showAddModal]);

  const confirmDeleteBooking = async () => {
    if (!bookingToDelete) return;
    try {
      const bId = bookingToDelete.id; 
      const bookingNo = bookingToDelete.bookingNo || bookingToDelete.bookingId || bookingToDelete.billId || bId; 
      
      // Delete Booking
      await deleteDoc(doc(db, 'bookings', bId));
      
      // Attempt to delete cascade
      try {
        const qReports = query(
          collection(db, 'reports'), 
          where('labId', '==', activeLabId), 
          where('bookingNo', '==', bookingNo)
        );
        const snap = await getDocs(qReports);
        for (const rDoc of snap.docs) {
            await deleteDoc(doc(db, 'reports', rDoc.id));
        }
        await deleteDoc(doc(db, 'bills', bId)); 
      } catch (e) {
        console.warn("Cascade delete skipped or failed:", e);
      }
      
      setBookings(prev => prev.filter(r => r.id !== bId));
      toast.success('Booking deleted permanently');
    } catch (error) {
      toast.error('Failed to delete booking: ' + error.message);
    } finally {
      setBookingToDelete(null);
    }
  };

  const fetchBookings = async () => {
    if (!activeLabId && userData?.role !== 'SuperAdmin') return;
    setLoading(true);
    try {
      let q;
      if (activeLabId) {
        q = query(collection(db, 'bookings'), where('labId', '==', activeLabId));
      } else {
        q = query(collection(db, 'bookings'));
      }
      
      const snapB = await getDocs(q);
      const rawBookings = snapB.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Sort by date desc
      rawBookings.sort((a, b) => {
        const getTime = (val) => {
          if (!val) return 0;
          if (val.seconds) return val.seconds * 1000 + (val.nanoseconds / 1000000);
          if (val.toDate) return val.toDate().getTime();
          const d = new Date(val);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      });
      
      setBookings(rawBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCreationData = async () => {
    try {
      let pQuery, dQuery, tQuery;
      if (activeLabId) {
        const labIdVal = isNaN(activeLabId) ? activeLabId : String(activeLabId);
        pQuery = query(collection(db, 'patients'), where('labId', '==', activeLabId));
        dQuery = query(collection(db, 'doctors'), where('labId', '==', activeLabId));
        tQuery = query(collection(db, 'tests'), where('labId', 'in', [labIdVal, 'GLOBAL']));
      } else {
        pQuery = query(collection(db, 'patients'));
        dQuery = query(collection(db, 'doctors'));
        tQuery = query(collection(db, 'tests'));
      }
      
      const [pSnap, dSnap, tSnap] = await Promise.all([getDocs(pQuery), getDocs(dQuery), getDocs(tQuery)]);
      
      setPatients(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDoctors(dSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const allTests = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const uniqueTests = [];
      const testNamesSeen = new Set();
      // Sort so Lab tests come first, GLOBAL last
      allTests.sort((a,b) => (a.labId === 'GLOBAL' ? 1 : -1));
      allTests.forEach(test => {
        const normalizedName = test.testName?.trim().toLowerCase();
        if(!testNamesSeen.has(normalizedName)) {
            uniqueTests.push(test);
            testNamesSeen.add(normalizedName);
        }
      });
      setTests(uniqueTests);
    } catch (err) {
      console.error("Error fetching creation data:", err);
    }
  };

  const calculateTotal = (selectedTestIds) => {
    const subtotal = tests
      .filter(t => selectedTestIds.includes(t.id))
      .reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);
    const finalTotal = Math.max(subtotal - (newBooking.discount || 0), 0);
    setNewBooking(prev => ({ 
      ...prev, 
      testIds: selectedTestIds, 
      subtotal: subtotal,
      totalAmount: finalTotal 
    }));
  };

  const handleDiscountChange = (val) => {
    const disc = parseFloat(val) || 0;
    const finalTotal = Math.max(newBooking.subtotal - disc, 0);
    setNewBooking(prev => ({ ...prev, discount: disc, totalAmount: finalTotal }));
  };


  const handleAddBooking = async (e) => {
    e.preventDefault();
    if (!activeLabId) {
      toast.error("Please select a laboratory first.");
      return;
    }
    if (!newBooking.patientId || newBooking.testIds.length === 0) {
      toast.error("Please select a patient and at least one test.");
      return;
    }

    setLoading(false); // Make sure general loading is false
    setIsSaving(true); // Show loader on button

    try {
      const selectedPatient = patients.find(p => p.id === newBooking.patientId);
      const selectedDoctor = doctors.find(d => d.id === newBooking.doctorId);
      
      // 1. Generate ALL necessary IDs in parallel batches
      const [bookingIds, billIds, reportIds] = await Promise.all([
        generateBatchIds('BKG', activeLabId, 1),
        generateBatchIds('BL', activeLabId, 1),
        generateBatchIds('RA', activeLabId, newBooking.testIds.length)
      ]);

      const bookingNo = bookingIds[0];
      const billId = billIds[0];
      const docId = `${activeLabId}_${bookingNo}`;

      // Calculate detailed test information
      const booked_tests = newBooking.testIds.map(testId => {
        const test = tests.find(t => t.id === testId);
        return { name: test?.testName || 'Unknown Test', price: test?.price || 0 };
      });
      const testNames = booked_tests.map(t => t.name).join(', ');

      // 2. Start Firestore Batch
      const batch = writeBatch(db);

      // --- A. Create Booking Doc ---
      const bookingData = {
        bookingId: bookingNo,
        bookingNo: bookingNo,
        billId: billId,
        patientId: newBooking.patientId,
        doctorId: newBooking.doctorId || null,
        testIds: newBooking.testIds,
        testNames: testNames,
        tests_detail: booked_tests,
        labId: activeLabId,
        status: newBooking.status,
        urgency: newBooking.urgency,
        notes: newBooking.notes,
        patientName: selectedPatient?.name || 'Unknown',
        doctorName: selectedDoctor?.name || 'Self',
        subtotal: newBooking.subtotal,
        discount: newBooking.discount,
        totalAmount: newBooking.totalAmount,
        paidAmount: newBooking.paidAmount || 0,
        balance: newBooking.totalAmount - (newBooking.paidAmount || 0),
        paymentStatus: (newBooking.totalAmount - (newBooking.paidAmount || 0)) <= 0 ? 'Paid' : 'Unpaid',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(doc(db, 'bookings', docId), bookingData);

      // --- B. Create Individual Report Docs ---
      newBooking.testIds.forEach((testId, idx) => {
        const test = tests.find(t => t.id === testId);
        if (!test) return;
        
        const testSlug = test.testName.replace(/ /g, "_").replace(/\//g, "-");
        const reportDocId = `${activeLabId}_${bookingNo}_${testSlug}`;
        
        batch.set(doc(db, 'reports', reportDocId), {
          reportId: reportIds[idx],
          bookingNo: bookingNo,
          billId: billId,
          patientId: newBooking.patientId,
          patientName: selectedPatient?.name || 'Unknown',
          patientAge: selectedPatient?.age || 0,
          patientGender: selectedPatient?.gender || 'Any',
          testName: test.testName,
          status: 'Pending',
          labId: activeLabId,
          reportLayout: test.reportLayout || 'Standard',
          results: [],
          registered_at: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      // --- C. Create Bill Document ---
      batch.set(doc(db, 'bills', docId), {
        billId: billId,
        billNo: billId,
        bookingId: docId,
        labId: activeLabId,
        patientId: newBooking.patientId,
        testIds: newBooking.testIds,
        testNames: testNames,
        tests_detail: booked_tests,
        totalAmount: newBooking.totalAmount,
        paidAmount: newBooking.paidAmount,
        balance: newBooking.totalAmount - newBooking.paidAmount,
        paymentStatus: newBooking.paidAmount >= newBooking.totalAmount ? 'Paid' : 'Unpaid',
        createdAt: serverTimestamp()
      });

      // 3. Commit ALL changes in ONE atomic network request
      await batch.commit();

      toast.success('🎉 Booking & Invoices created successfully!');
      
      setShowAddModal(false);
      setNewBooking({ 
        patientId: '', doctorId: '', testIds: [], 
        subtotal: 0, discount: 0, totalAmount: 0, 
        paidAmount: 0, status: 'Pending', urgency: 'Routine', notes: '',
        paymentStatus: 'Unpaid', balance: 0
      });
      fetchBookings();
    } catch (error) {
      console.error("Error creating booking:", error);
      toast.error("Failed to create booking: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredBookings = bookings.filter(b => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      b.patientName?.toLowerCase().includes(term) || 
      b.bookingId?.toLowerCase().includes(term) ||
      b.testNames?.toLowerCase().includes(term) ||
      b.testName?.toLowerCase().includes(term);
      
    const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
    const matchesUrgency = urgencyFilter === 'All' || b.urgency === urgencyFilter;

    // Date Filtering
    let matchesDate = true;
    if (b.createdAt) {
      let d = null;
      if (b.createdAt.toDate) d = b.createdAt.toDate();
      else if (b.createdAt.seconds) d = new Date(b.createdAt.seconds * 1000);
      else if (b.createdAt instanceof Date) d = b.createdAt;
      else d = new Date(b.createdAt);

      if (d && !isNaN(d.getTime())) {
        const bookingDateStr = d.toISOString().split('T')[0];
        matchesDate = bookingDateStr >= startDate && bookingDateStr <= endDate;
      }
    }

    return matchesSearch && matchesStatus && matchesUrgency && matchesDate;
  });

  const getUrgencyStyles = (urgency) => {
    switch (urgency) {
      case 'STAT': return 'bg-rose-500 text-white border-rose-600 shadow-sm shadow-rose-100';
      case 'Urgent': return 'bg-amber-400 text-amber-950 border-amber-500 shadow-sm shadow-amber-100';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case 'Final':
      case 'Completed': return 'bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-100';
      case 'Delivered': return 'bg-sky-500 text-white border-sky-600 shadow-sm shadow-sky-100';
      case 'In Progress':
      case 'Processing': return 'bg-indigo-500 text-white border-indigo-600 shadow-sm shadow-indigo-100';
      case 'Sample Collected': return 'bg-violet-500 text-white border-violet-600 shadow-sm shadow-violet-100';
      default: return 'bg-orange-400 text-white border-orange-500 shadow-sm shadow-orange-100'; // Pending
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-brand-dark tracking-tighter flex items-center text-left">
            <div className="p-2 bg-brand-light rounded-2xl mr-4 shadow-sm border border-brand-primary/10 transition-transform hover:scale-110">
              <Calendar className="w-8 h-8 text-brand-primary" />
            </div>
            Bookings
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Create and manage bookings here.</p>
        </div>
        
        <button 
          onClick={() => {
            if (!activeLabId && userData?.role === 'SuperAdmin') {
              alert("Super Admin: Please select a Laboratory from the top navigation dropdown to create a booking.");
              return;
            }
            setShowAddModal(true);
          }}
          disabled={!activeLabId && userData?.role === 'SuperAdmin'}
          className={`flex items-center px-6 py-4 rounded-[22px] font-black tracking-widest text-[11px] uppercase shadow-xl transition-all duration-300 group active:scale-95 ${
            (!activeLabId && userData?.role === 'SuperAdmin') 
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60' 
            : 'bg-brand-dark text-white hover:shadow-brand-dark/20 hover:-translate-y-1'
          }`}
        >
          <Plus className="w-5 h-5 mr-3 group-hover:rotate-90 transition-transform duration-300 text-brand-primary" />
          New Booking
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-7 rounded-[32px] shadow-[0_20px_50px_rgb(0,0,0,0.02)] border border-slate-100 mb-10">
        <div className="flex flex-col xl:flex-row gap-8 items-center">
          {/* Search Area */}
          <div className="relative flex-grow w-full max-w-2xl group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full pl-14 pr-6 py-4.5 border border-slate-200 bg-slate-50/30 rounded-[28px] focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white text-sm font-black text-brand-dark outline-none transition-all placeholder:text-slate-400 placeholder:font-bold"
              placeholder="Search by patient or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filters Area */}
          <div className="flex flex-wrap items-center gap-5 w-full xl:w-auto">
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:block">Status</span>
              <select 
                className="bg-white border border-slate-200 rounded-2xl px-5 py-3 text-[12px] font-black text-brand-dark outline-none focus:border-brand-primary/40 focus:ring-4 focus:ring-brand-primary/5 shadow-sm appearance-none cursor-pointer"
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Status</option>
                {["Pending", "Sample Collected", "Processing", "In Progress", "Final", "Completed", "Delivered"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:block">Urgency</span>
              <select 
                className="bg-white border border-slate-200 rounded-2xl px-5 py-3 text-[12px] font-black text-brand-dark outline-none focus:border-brand-primary/40 focus:ring-4 focus:ring-brand-primary/5 shadow-sm appearance-none cursor-pointer"
                value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}
              >
                <option value="All">All Priority</option>
                {["Routine", "Urgent", "STAT"].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            {/* Date Filters Area */}
            <div className="flex items-center gap-4 bg-brand-light/30 p-3 rounded-[24px] border border-brand-primary/10 px-6">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black text-brand-dark/40 uppercase tracking-widest">From</span>
                <input 
                  type="date" 
                  className="bg-white border border-brand-primary/10 rounded-xl px-4 py-2 text-[12px] font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/20 cursor-pointer shadow-sm tabular-nums"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="mx-2 h-4 w-px bg-brand-primary/20"></div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black text-brand-dark/40 uppercase tracking-widest">To</span>
                <input 
                  type="date" 
                  className="bg-white border border-brand-primary/10 rounded-xl px-4 py-2 text-[12px] font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/20 cursor-pointer shadow-sm tabular-nums"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-[0_20px_60px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-brand-light/40">
              <tr>
                <th className="px-8 py-6 text-left text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Booking ID</th>
                <th className="px-8 py-6 text-left text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Patient / Doctor</th>
                <th className="px-8 py-6 text-left text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Tests</th>
                <th className="px-8 py-6 text-left text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Status</th>
                <th className="px-8 py-6 text-left text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Total Amount</th>
                <th className="px-8 py-6 text-left text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Date</th>
                <th className="px-8 py-6 text-right text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-8 py-24 text-center">
                    <Loader className="h-10 w-10 animate-spin text-brand-primary mx-auto mb-4" />
                    <p className="text-slate-400 font-black uppercase text-[12px] tracking-widest">Loading...</p>
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-8 py-24 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-slate-300">
                      <Calendar className="w-10 h-10" />
                    </div>
                    <p className="text-brand-dark/40 font-black uppercase text-[12px] tracking-widest">No bookings found.</p>
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-brand-light/10 transition-all group relative hover:z-20">
                    <td className="px-8 py-7">
                      <div className="text-[12px] font-black text-brand-dark tracking-tighter bg-brand-light/50 px-3 py-1.5 rounded-xl border border-brand-primary/10 w-fit tabular-nums transition-colors group-hover:bg-brand-primary/20 group-hover:border-brand-primary/30">
                        {b.bookingId || b.billId}
                      </div>
                    </td>
                    <td className="px-8 py-7">
                      <div className="text-base font-black text-brand-dark tracking-tight mb-1">{b.patientName}</div>
                      <div className="text-[12px] font-black text-slate-400 flex items-center uppercase tracking-widest">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-secondary/40 mr-2"></div>
                        {b.doctorName || 'DIRECT VISIT'}
                      </div>
                    </td>
                    <td className="px-8 py-7">
                      {(() => {
                        const namesStr = b.testNames || b.testName || '';
                        if (!namesStr) return <span className="text-slate-300 italic font-medium uppercase text-[11px] tracking-widest">Unassigned</span>;
                        
                        const names = namesStr.split(',').map(n => n.trim());
                        if (names.length <= 1) return (
                          <div className="text-sm font-black text-brand-secondary uppercase">{names[0]}</div>
                        );
                        
                        return (
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-brand-dark uppercase tracking-tight">{names[0]}</span>
                            <button 
                              onClick={() => setSelectedTestsBooking(b)}
                              className="text-[10px] text-brand-primary font-black mt-1.5 bg-brand-primary/10 px-3 py-1 rounded-full w-fit border border-brand-primary/20 uppercase tracking-widest hover:bg-brand-primary hover:text-white transition-all duration-300 shadow-sm active:scale-95"
                            >
                              +{names.length - 1} MORE ITEMS
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-8 py-7">
                      <div className="flex flex-col gap-2">
                         <span className={`px-4 py-1.5 rounded-2xl text-[12px] font-black uppercase tracking-[0.1em] border flex items-center w-fit shadow-sm transition-all ${
                            b.status === 'Completed' ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20' : 
                            b.status === 'Processing' ? 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20' :
                            'bg-amber-50 text-amber-600 border-amber-100'
                         }`}>
                           <div className={`w-1.5 h-1.5 rounded-full mr-2 ${['Completed', 'Final'].includes(b.status) ? 'bg-brand-primary animate-pulse' : 'bg-current'}`}></div>
                           {b.status}
                         </span>
                         <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest border transition-all ${
                            b.urgency === 'STAT' ? 'bg-rose-50 text-rose-500 border-rose-100' :
                            b.urgency === 'Urgent' ? 'bg-amber-50 text-amber-500 border-amber-100' :
                            'bg-slate-50 text-slate-400 border-slate-100'
                         }`}>
                            PRIORITY: {b.urgency || 'ROUTINE'}
                         </span>
                      </div>
                    </td>
                    <td className="px-8 py-7">
                      <div className="text-lg font-black text-brand-dark tracking-tighter tabular-nums">₹{b.totalAmount}</div>
                      <div className={`text-[12px] font-black uppercase tracking-widest mt-1.5 flex items-center ${b.totalAmount - (b.paidAmount || 0) > 0 ? 'text-rose-500' : 'text-brand-primary'}`}>
                        <div className={`w-1 h-1 rounded-full mr-1.5 ${b.totalAmount - (b.paidAmount || 0) > 0 ? 'bg-rose-500' : 'bg-brand-primary'}`}></div>
                        {b.totalAmount - (b.paidAmount || 0) > 0 ? `DUE: ₹${b.totalAmount - (b.paidAmount || 0)}` : 'PAID'}
                      </div>
                    </td>
                    <td className="px-8 py-7 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-[12px] font-black text-brand-dark/70 tracking-tighter tabular-nums uppercase">
                          {(() => {
                            if (!b.createdAt) return 'DATE N/A';
                            let d = null;
                            if (b.createdAt.toDate) d = b.createdAt.toDate();
                            else if (b.createdAt.seconds) d = new Date(b.createdAt.seconds * 1000);
                            else d = new Date(b.createdAt);

                            if (!d || isNaN(d.getTime())) return 'DATE N/A';
                            
                            const day = d.getDate().toString().padStart(2, '0');
                            const month = (d.getMonth() + 1).toString().padStart(2, '0');
                            const year = d.getFullYear();
                            return `${day}/${month}/${year}`;
                          })()}
                        </div>
                        <div className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                          {(() => {
                             if (!b.createdAt) return '';
                             let d = null;
                             if (b.createdAt.toDate) d = b.createdAt.toDate();
                             else if (b.createdAt.seconds) d = new Date(b.createdAt.seconds * 1000);
                             else d = new Date(b.createdAt);
                             return d?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-7 text-right">
                      <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <button className="p-3 bg-brand-light/50 text-brand-dark hover:bg-brand-primary hover:text-white rounded-2xl transition-all shadow-sm border border-brand-primary/10" title="Print Invoice">
                          <FileText className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setBookingToDelete(b)}
                          className="p-3 bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white rounded-2xl transition-all shadow-sm border border-rose-100" title="Delete Booking">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modern Booking Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-brand-dark/80 flex items-center justify-center p-4 z-50 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[48px] shadow-3xl max-w-6xl w-full p-10 overflow-hidden relative border border-white/20">
            <button onClick={() => setShowAddModal(false)} className="absolute top-8 right-8 p-3 text-slate-300 hover:text-brand-dark hover:bg-brand-light rounded-[24px] rotate-90 hover:rotate-180 transition-all duration-500 z-10">
              <X className="w-7 h-7" />
            </button>
            
            <div className="mb-10 flex items-center gap-6">
              <div className="w-16 h-16 bg-brand-primary rounded-[28px] flex items-center justify-center shadow-xl shadow-brand-primary/20 rotate-6 shrink-0">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-4xl font-black text-brand-dark tracking-tighter">New Booking</h2>
                <p className="text-slate-400 font-bold text-[13px] uppercase tracking-[0.2em] mt-1">{userData?.labId} Standard Order</p>
              </div>
            </div>
            
            <form onSubmit={handleAddBooking} className="flex flex-col lg:flex-row gap-8 max-h-[75vh] min-h-[500px]">
              {/* Left Column: Inputs */}
              <div className="flex-[1.4] space-y-8 overflow-y-auto custom-scrollbar pr-6 pb-6 lg:border-r border-slate-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2">
                    <label className="block text-[12px] font-black text-brand-dark/60 uppercase tracking-[0.2em] mb-3 ml-2">1. Select Patient</label>
                    <div className="relative group">
                      <select required className="w-full bg-slate-50 border border-slate-200 rounded-[20px] py-4 px-6 text-base font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white transition-all appearance-none cursor-pointer shadow-sm group-hover:border-slate-300"
                        value={newBooking.patientId} onChange={e => setNewBooking({...newBooking, patientId: e.target.value})}
                      >
                        <option value="">Search Patient Archive...</option>
                        {patients.map(p => <option key={p.id} value={p.id}>{p.name} — {p.phone || 'NO CONTACT'}</option>)}
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-brand-primary transition-colors">
                        <User className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-black text-brand-dark/60 uppercase tracking-[0.2em] mb-3 ml-2">2. Referrer</label>
                    <div className="relative group">
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-[20px] py-4 px-6 text-base font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white transition-all appearance-none cursor-pointer shadow-sm group-hover:border-slate-300"
                        value={newBooking.doctorId} onChange={e => setNewBooking({...newBooking, doctorId: e.target.value})}
                      >
                        <option value="">SELF / DIRECT VISIT</option>
                        {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-brand-secondary transition-colors">
                        <User className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-black text-brand-dark/60 uppercase tracking-[0.2em] mb-3 ml-2">3. Priority</label>
                    <div className="relative group">
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-[20px] py-4 px-6 text-[15px] font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white transition-all appearance-none cursor-pointer shadow-sm group-hover:border-slate-300"
                        value={newBooking.urgency} onChange={e => setNewBooking({...newBooking, urgency: e.target.value})}
                      >
                        <option>Routine</option>
                        <option>Urgent</option>
                        <option>STAT</option>
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-amber-500 transition-colors">
                        <Clock className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>

              <div className="lg:col-span-2">
                <label className="block text-[12px] font-black text-brand-dark/60 uppercase tracking-[0.2em] mb-4 ml-2">4. Select Tests</label>
                <div className="mb-6 relative group">
                  <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none group-focus-within:text-brand-primary transition-colors text-slate-400">
                    <Search className="h-5 w-5" />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Search master test catalog..." 
                    value={testSearchQuery}
                    onChange={(e) => setTestSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[20px] pl-16 pr-6 py-4 text-[14px] font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white transition-all placeholder:text-slate-400 shadow-sm"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-2 gap-4 p-4 min-h-[160px] max-h-[300px] overflow-y-auto bg-slate-50/30 rounded-[36px] border border-slate-100 shadow-inner">
                  {tests.filter(t => t.testName?.toLowerCase().includes(testSearchQuery.toLowerCase())).map(t => (
                    <label key={t.id} className={`flex items-center p-4 rounded-[22px] border-2 transition-all cursor-pointer group relative overflow-hidden ${newBooking.testIds.includes(t.id) ? 'bg-brand-dark border-brand-dark text-white shadow-xl shadow-brand-dark/30' : 'bg-white border-transparent text-slate-600 hover:border-brand-primary/30 shadow-sm'}`}>
                      <input 
                        type="checkbox" 
                        className="hidden"
                        checked={newBooking.testIds.includes(t.id)}
                        onChange={(e) => {
                          const ids = e.target.checked 
                            ? [...newBooking.testIds, t.id]
                            : newBooking.testIds.filter(id => id !== t.id);
                          calculateTotal(ids);
                        }}
                      />
                      <span className="text-[11px] font-black uppercase tracking-tight relative z-10">{t.testName}</span>
                      <div className="ml-auto mr-4 text-[11px] font-black opacity-70 relative z-10 tabular-nums">₹{t.price}</div>
                      {newBooking.testIds.includes(t.id) && <div className="absolute top-0 right-0 w-8 h-8 bg-brand-primary rounded-bl-[22px] flex items-center justify-center p-1.5 shadow-lg"><CheckCircle className="w-4 h-4 text-white relative -top-0.5 -right-0.5" /></div>}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Billing & Notes Sidebar */}
              <div className="flex-1 flex flex-col gap-4">
                <div className="bg-brand-dark p-6 rounded-[36px] space-y-4 shadow-3xl shadow-brand-dark/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary/10 blur-[80px] rounded-full"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Subtotal</span>
                      <span className="font-black text-brand-light text-lg tabular-nums">₹{newBooking.subtotal || 0}</span>
                    </div>
                    <div className="space-y-1 mb-5">
                      <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Discount (₹)</label>
                      <input type="number" className="w-full bg-white/5 border border-white/10 rounded-[16px] p-3 text-[14px] font-black text-white outline-none focus:ring-4 focus:ring-brand-primary/30 transition-all tabular-nums"
                        placeholder="0"
                        value={newBooking.discount} onChange={e => handleDiscountChange(e.target.value)}
                      />
                    </div>
                    <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                      <div className="text-left py-1">
                        <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-1">Total</p>
                        <p className="text-2xl font-black text-white tracking-tighter tabular-nums">₹{newBooking.totalAmount || 0}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                         <p className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">Paid</p>
                         <input type="number" 
                           className="w-20 bg-transparent border-b-2 border-brand-primary py-0 text-right text-xl font-black text-brand-primary outline-none focus:bg-brand-primary/10 transition-all tabular-nums"
                           value={newBooking.paidAmount} onChange={e => setNewBooking({...newBooking, paidAmount: parseFloat(e.target.value) || 0})}
                         />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-brand-light/20 p-5 rounded-[32px] border border-brand-primary/10 space-y-2">
                   <label className="block text-[10px] font-black text-brand-dark/50 uppercase tracking-[0.3em] ml-2">Observations & History</label>
                   <textarea 
                     className="w-full bg-white/60 border border-slate-100 rounded-[20px] p-4 text-[12px] font-bold text-brand-dark outline-none focus:ring-8 focus:ring-brand-primary/5 h-20 resize-none shadow-inner transition-all"
                     placeholder="Notes, symptoms..."
                     value={newBooking.notes} onChange={e => setNewBooking({...newBooking, notes: e.target.value})}
                   ></textarea>
                </div>

                <div className="flex flex-col gap-3 mt-auto">
                    <button 
                      type="submit" 
                      disabled={isSaving} 
                      className={`w-full py-4.5 rounded-[22px] text-xs font-black uppercase tracking-[0.3em] transition-all border border-white/10 group flex items-center justify-center gap-3 ${
                        isSaving 
                          ? 'bg-brand-dark/80 cursor-not-allowed text-white/50' 
                          : 'bg-brand-dark text-white hover:shadow-2xl hover:shadow-brand-dark/30 active:scale-95'
                      }`}
                    >
                      {isSaving ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin text-brand-primary" />
                          Saving Data.....
                        </>
                      ) : (
                        <>
                          Save Booking 
                          <Plus className="inline w-4 h-4 ml-2 text-brand-primary group-hover:rotate-90 transition-transform" />
                        </>
                      )}
                    </button>
                    <button type="button" onClick={() => setShowAddModal(false)} className="w-full py-3.5 bg-slate-50 text-slate-400 rounded-[18px] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-100 transition-all active:scale-95">Cancel Order</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {bookingToDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/80 backdrop-blur-3xl animate-in fade-in" onClick={() => setBookingToDelete(null)}></div>
          <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-rose-50 px-8 py-6 border-b border-rose-100 flex items-center gap-4">
               <div className="p-3 bg-rose-100 rounded-2xl text-rose-600">
                  <Trash2 className="w-8 h-8" />
               </div>
               <div>
                  <h3 className="text-xl font-black text-rose-600 uppercase tracking-tight">Delete Booking</h3>
                  <p className="text-sm font-bold text-rose-400/80 uppercase tracking-widest mt-1">{bookingToDelete.bookingId || bookingToDelete.billId || 'Unknown ID'}</p>
               </div>
            </div>
            <div className="p-8">
               <p className="text-[14px] text-slate-500 font-medium leading-relaxed">
                  Are you sure you want to permanently delete the booking for <strong className="text-brand-dark uppercase">{bookingToDelete.patientName}</strong>? This will also delete any generated bills and reports. This action cannot be undone.
               </p>
               
               <div className="mt-8 flex gap-4 pt-6 border-t border-slate-100">
                 <button 
                   onClick={() => setBookingToDelete(null)}
                   className="flex-1 px-6 py-3.5 bg-slate-50 text-slate-500 font-black uppercase tracking-widest text-[12px] rounded-2xl hover:bg-slate-100 transition-colors border border-slate-200"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={confirmDeleteBooking}
                   className="flex-1 px-6 py-3.5 bg-rose-500 text-white font-black uppercase tracking-widest text-[12px] rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40 active:scale-95"
                 >
                   Yes, Delete
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Multiple Tests Display */}
      {selectedTestsBooking && (
        <div className="fixed inset-0 bg-brand-dark/60 flex items-center justify-center p-4 z-[100] backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white rounded-[40px] shadow-3xl max-w-md w-full p-8 relative border border-white/20 overflow-hidden transform animate-in zoom-in-95 duration-300">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary"></div>
              
              <button onClick={() => setSelectedTestsBooking(null)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-brand-dark hover:bg-slate-100 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-brand-dark">Test Panel</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedTestsBooking.patientName}</p>
                </div>
              </div>

              <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2 mb-6">
                {(selectedTestsBooking.testNames || "").split(',').map((name, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:bg-brand-primary/5 hover:border-brand-primary/20 transition-all">
                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[10px] font-black text-brand-primary shadow-sm group-hover:bg-brand-primary group-hover:text-white transition-all">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <span className="text-sm font-black text-brand-dark uppercase tracking-tight">{name.trim()}</span>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setSelectedTestsBooking(null)}
                className="w-full py-4 bg-brand-dark text-white rounded-[18px] text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-brand-dark/20 hover:scale-[1.02] transition-all active:scale-95"
              >
                Close Details
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default Bookings;
