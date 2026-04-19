import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc, deleteDoc, serverTimestamp, Timestamp, writeBatch, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, Loader, Calendar, User, FileText, CheckCircle, Clock, AlertCircle, X, Trash2, Database, Pencil, IndianRupee, ShieldAlert, AlertTriangle, Zap } from 'lucide-react';
import { toast } from 'react-toastify';
import OutOfTokensModal from '../components/OutOfTokensModal';
import { generateLabId, generateBatchIds } from '../utils/idGenerator';

const Bookings = () => {
  const { userData, activeLabId, subscription, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState(null);
  const [originalTestIds, setOriginalTestIds] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [tests, setTests] = useState([]);
  const [sourcePage, setSourcePage] = useState(null); 
  
  const [newBooking, setNewBooking] = useState({
    patientId: '', doctorId: '', testIds: [], 
    subtotal: 0, discount: 0, totalAmount: 0, paidAmount: 0, 
    status: 'Pending', urgency: 'Routine', notes: '',
    paymentStatus: 'Unpaid', balance: 0
  });
  
  const [statusFilter, setStatusFilter] = useState('Active'); // Default: Everything except Delivered
  const [urgencyFilter, setUrgencyFilter] = useState('All');
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState(null);
  const [selectedTestsBooking, setSelectedTestsBooking] = useState(null);
  const [showTokenModal, setShowTokenModal] = useState(false);

  // Date Filters
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const isEditMode = params.get('edit');
    
    // Only fetch the full list if we are NOT in immediate edit mode (to avoid flicker)
    // or if the modal is NOT shown.
    if (!isEditMode) {
      fetchBookings();
    }
    
    if (showAddModal) {
      fetchCreationData();
    }
  }, [userData, activeLabId, showAddModal, location.search]);

  // Handle URL Param for Editing
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editId = params.get('edit');
    if (editId && activeLabId) {
      handleOpenEditFromUrl(editId);
    }
  }, [location.search, activeLabId]);

  // Handle URL Param for Auto-Opening New Booking with Patient
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldAutoOpen = params.get('autoOpen');
    const pid = params.get('patientId');
    
    if (shouldAutoOpen === 'true' && pid && activeLabId) {
      // --- PAY AS YOU GO ENFORCEMENT ---
      const isPayAsYouGo = subscription?.plan === 'pay_as_you_go';
      const balance = subscription?.tokenBalance || 0;
      if (isPayAsYouGo && balance <= 0) {
        setShowTokenModal(true);
      } else {
        setNewBooking(prev => ({ ...prev, patientId: pid }));
        setIsEditing(false);
        setShowAddModal(true);
      }
      
      // Clean URL
      navigate('/bookings', { replace: true });
    }
  }, [location.search, activeLabId]);

  const handleOpenEditFromUrl = async (bId) => {
    const params = new URLSearchParams(location.search);
    const fromParam = params.get('from');
    if (fromParam) setSourcePage(fromParam);

    try {
      const bSnap = await getDoc(doc(db, 'bookings', bId));
      if (bSnap.exists()) {
        const bData = { id: bSnap.id, ...bSnap.data() };
        handleEditBooking(bData);
        // Clear param after opening so URL stays clean, but state preserves context
        navigate('/bookings', { replace: true });
      }
    } catch (e) {
      console.error("URL Edit load error:", e);
    }
  };

  const handleEditBooking = (booking) => {
    setNewBooking({
      patientId: booking.patientId,
      doctorId: booking.doctorId || '',
      testIds: booking.testIds || [],
      subtotal: booking.subtotal || 0,
      discount: booking.discount || 0,
      totalAmount: booking.totalAmount || 0,
      paidAmount: booking.paidAmount || 0,
      status: booking.status || 'Pending',
      urgency: booking.urgency || 'Routine',
      notes: booking.notes || '',
      paymentStatus: booking.paymentStatus || 'Unpaid',
      balance: booking.balance || 0
    });
    setEditingBookingId(booking.id);
    setOriginalTestIds(booking.testIds || []);
    setIsEditing(true);
    setShowAddModal(true);
  };

  const exitModal = () => {
    setShowAddModal(false);
    setIsEditing(false);
    setEditingBookingId(null);
    if (sourcePage === 'reports') {
      navigate('/reports');
    } else {
      fetchBookings();
    }
  };

  const confirmDeleteBooking = async () => {
    if (!bookingToDelete) return;
    
    // GUARD: check for delete_records permission
    if (!userData?.permissions?.can_delete_records && userData?.role !== 'LabAdmin' && userData?.role !== 'SuperAdmin') {
      toast.error("Unauthorized: You do not have permission to delete records.");
      setBookingToDelete(null);
      return;
    }

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
      if (sourcePage === 'reports') {
        navigate('/reports');
      }
    } catch (error) {
      toast.error('Failed to delete booking: ' + error.message);
    } finally {
      setBookingToDelete(null);
    }
  };

  // ─── Filters & Counts ──────────────────────────────────────────────────
  const filteredBookings = React.useMemo(() => {
    return bookings.filter(b => {
      // 1. Search Match
      const nameMatch = b.patientName?.toLowerCase().includes(searchTerm.toLowerCase());
      const idMatch = b.billId?.toLowerCase().includes(searchTerm.toLowerCase()) || b.id?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!nameMatch && !idMatch) return false;

      // 2. Date Match
      if (b.createdAt) {
        const bDate = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        
        // Start date check (midnight of startDate)
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        
        // End date check (end of endDate)
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        if (bDate < start || bDate > end) return false;
      }

      // 3. Urgency Filter
      if (urgencyFilter !== 'All' && b.urgency !== urgencyFilter) return false;

      // 4. Status Filter
      if (statusFilter === 'All') return true;
      if (statusFilter === 'Active') return b.status !== 'Delivered';
      return b.status === statusFilter;
    });
  }, [bookings, searchTerm, statusFilter, urgencyFilter, startDate, endDate]);

  const statusCounts = React.useMemo(() => {
    // We only filter counts by DATE, but not by SEARCH or STATUS button, 
    // to show overall stats for the period.
    const dateFiltered = bookings.filter(b => {
      if (!b.createdAt) return true;
      const bDate = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return bDate >= start && bDate <= end;
    });

    const counts = { Pending: 0, 'Processing': 0, 'Final': 0, 'Delivered': 0, Total: dateFiltered.length };
    dateFiltered.forEach(b => {
      if (b.status === 'Pending') counts.Pending++;
      else if (b.status === 'Processing' || b.status === 'In Progress' || b.status === 'Sample Collected') counts.Processing++;
      else if (b.status === 'Final' || b.status === 'Completed') counts.Final++;
      else if (b.status === 'Delivered') counts.Delivered++;
    });
    return counts;
  }, [bookings, startDate, endDate]);

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

    // --- PAY AS YOU GO ENFORCEMENT ---
    const isPayAsYouGo = subscription?.plan === 'pay_as_you_go';
    const balance = subscription?.tokenBalance || 0;
    
    if (isPayAsYouGo && balance <= 0) {
      setShowTokenModal(true);
      return;
    }

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
          paymentStatus: (newBooking.totalAmount - (newBooking.paidAmount || 0)) <= 0 ? 'Paid' : 'Unpaid',
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

  const handleUpdateBooking = async (e) => {
    if (e) e.preventDefault();
    if (!activeLabId || !editingBookingId) return;

    setIsSaving(true);
    try {
      const selectedPatient = patients.find(p => p.id === newBooking.patientId);
      const selectedDoctor = doctors.find(d => d.id === newBooking.doctorId);
      const bookingNo = bookings.find(b => b.id === editingBookingId)?.bookingNo;

      // 1. Calculate Test Diffs
      const addedTestIds = newBooking.testIds.filter(id => !originalTestIds.includes(id));
      const removedTestIds = originalTestIds.filter(id => !newBooking.testIds.includes(id));

      // 2. Generate IDs for NEW reports if needed
      let newReportIds = [];
      if (addedTestIds.length > 0) {
        newReportIds = await generateBatchIds('RA', activeLabId, addedTestIds.length);
      }

      // 3. Prep detailed test info
      const booked_tests = newBooking.testIds.map(testId => {
        const test = tests.find(t => t.id === testId);
        return { name: test?.testName || 'Unknown Test', price: test?.price || 0 };
      });
      const testNames = booked_tests.map(t => t.name).join(', ');

      const batch = writeBatch(db);

      // --- A. Update Booking Doc ---
      batch.update(doc(db, 'bookings', editingBookingId), {
        doctorId: newBooking.doctorId || null,
        doctorName: selectedDoctor?.name || 'Self',
        testIds: newBooking.testIds,
        testNames: testNames,
        tests_detail: booked_tests,
        status: newBooking.status,
        urgency: newBooking.urgency,
        notes: newBooking.notes,
        subtotal: newBooking.subtotal,
        discount: newBooking.discount,
        totalAmount: newBooking.totalAmount,
        paidAmount: newBooking.paidAmount || 0,
        balance: newBooking.totalAmount - (newBooking.paidAmount || 0),
        paymentStatus: (newBooking.totalAmount - (newBooking.paidAmount || 0)) <= 0 ? 'Paid' : 'Unpaid',
        updatedAt: serverTimestamp()
      });

      // --- B. Inherit Workflow Progress from Existing Reports ---
      let inheritedColl = null;
      let inheritedRec = null;
      const qExist = query(collection(db, 'reports'), 
                           where('labId', '==', activeLabId), 
                           where('bookingNo', '==', bookingNo));
      const existSnap = await getDocs(qExist);
      existSnap.forEach(rDoc => {
        const d = rDoc.data();
        if (d.collected_at && (!inheritedColl || d.collected_at.seconds < inheritedColl.seconds)) inheritedColl = d.collected_at;
        if (d.received_at && (!inheritedRec || d.received_at.seconds < inheritedRec.seconds)) inheritedRec = d.received_at;
      });

      // --- C. Create NEW Reports ---
      addedTestIds.forEach((testId, idx) => {
        const test = tests.find(t => t.id === testId);
        if (!test) return;
        const testSlug = test.testName.replace(/ /g, "_").replace(/\//g, "-");
        const reportDocId = `${activeLabId}_${bookingNo}_${testSlug}`;
        
        batch.set(doc(db, 'reports', reportDocId), {
          reportId: newReportIds[idx],
          bookingNo: bookingNo,
          billId: newBooking.billId || bookings.find(b => b.id === editingBookingId)?.billId || '',
          patientId: newBooking.patientId,
          patientName: selectedPatient?.name || 'Unknown',
          patientAge: selectedPatient?.age || 0,
          patientGender: selectedPatient?.gender || 'Any',
          testName: test.testName,
          status: inheritedRec ? 'In Progress' : (inheritedColl ? 'Sample Collected' : 'Pending'),
          paymentStatus: (newBooking.totalAmount - (newBooking.paidAmount || 0)) <= 0 ? 'Paid' : 'Unpaid',
          labId: activeLabId,
          reportLayout: test.reportLayout || 'Standard',
          results: [],
          registered_at: serverTimestamp(),
          collected_at: inheritedColl || null,
          received_at: inheritedRec || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      // --- C. Handle REMOVED Reports ---
      for (const testId of removedTestIds) {
          const test = tests.find(t => t.id === testId);
          if (test) {
            const testSlug = test.testName.replace(/ /g, "_").replace(/\//g, "-");
            const reportDocId = `${activeLabId}_${bookingNo}_${testSlug}`;
            batch.delete(doc(db, 'reports', reportDocId));
          }
      }

      // --- D. Update Bill Document ---
      batch.update(doc(db, 'bills', editingBookingId), {
        testIds: newBooking.testIds,
        testNames: testNames,
        tests_detail: booked_tests,
        totalAmount: newBooking.totalAmount,
        paidAmount: newBooking.paidAmount,
        balance: newBooking.totalAmount - newBooking.paidAmount,
        paymentStatus: newBooking.paidAmount >= newBooking.totalAmount ? 'Paid' : 'Unpaid',
        updatedAt: serverTimestamp()
      });


      await batch.commit();
      toast.success('🎉 Booking updated successfully!');
      exitModal();
    } catch (error) {
      console.error("Error updating booking:", error);
      toast.error("Failed to update booking: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };


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
    <>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow text-slate-800 animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-brand-dark tracking-tighter flex items-center text-left leading-none">
            <div className="p-2 sm:p-2.5 bg-brand-light rounded-2xl mr-4 shadow-sm border border-brand-primary/10 transition-transform hover:scale-110">
              <Calendar className="w-7 h-7 sm:w-8 sm:h-8 text-brand-primary" />
            </div>
            Bookings
          </h1>
          <p className="text-slate-500 mt-2 sm:mt-3 font-medium text-sm sm:text-base">Catalog and manage diagnostic orders.</p>
        </div>
        
        <button 
          onClick={() => {
            if (!activeLabId && userData?.role === 'SuperAdmin') {
              alert("Super Admin: Please select a Laboratory from the top navigation dropdown to create a booking.");
              return;
            }

            // --- PAY AS YOU GO ENFORCEMENT ---
            const isPayAsYouGo = subscription?.plan === 'pay_as_you_go';
            const balance = subscription?.tokenBalance || 0;
            if (isPayAsYouGo && balance <= 0) {
              setShowTokenModal(true);
              return;
            }

            setShowAddModal(true);
          }}
          disabled={!activeLabId && userData?.role === 'SuperAdmin'}
          className={`w-full md:w-auto flex items-center justify-center px-8 py-4.5 rounded-2xl font-black tracking-widest text-[11px] uppercase shadow-xl transition-all duration-300 group active:scale-95 ${
            (!activeLabId && userData?.role === 'SuperAdmin') 
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60' 
            : 'bg-brand-dark text-white hover:shadow-brand-dark/20 hover:-translate-y-1'
          }`}
        >
          <Plus className="w-5 h-5 mr-3 group-hover:rotate-90 transition-transform duration-300 text-brand-primary" />
          New Booking
        </button>
      </div>

      {/* Sticky Filters Header */}
      <div className="sticky top-0 z-[40] -mx-4 sm:-mx-8 px-4 sm:px-8 py-4 bg-[#F8FAFC]/80 backdrop-blur-xl border-b border-slate-100 mb-8 transition-all">
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6 items-start lg:items-center">
          
          {/* Left Side: Search & Dates Below */}
          <div className="flex flex-col gap-3.5 w-full lg:max-w-xl xl:max-w-2xl">
            {/* Search Bar */}
            <div className="relative w-full group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
              </div>
              <input type="text"
                className="block w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-[22px] focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 text-sm font-bold text-brand-dark outline-none transition-all placeholder:text-slate-300 shadow-sm"
                placeholder="Search by patient or booking ID..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            {/* Date Filters - Moved under search bar */}
            <div className="flex items-center gap-4 bg-white/50 px-5 py-2.5 rounded-[20px] border border-slate-200 w-fit">
               <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">From</span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent border-none text-[12px] font-black text-brand-dark focus:ring-0 outline-none cursor-pointer" />
               </div>
               <div className="text-slate-200 font-bold">/</div>
               <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">To</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent border-none text-[12px] font-black text-brand-dark focus:ring-0 outline-none cursor-pointer" />
               </div>
            </div>
          </div>

          {/* Quick Filter Buttons & Urgency */}
          <div className="flex flex-col md:flex-row xl:flex-row flex-wrap items-center gap-4 flex-grow lg:justify-end w-full lg:w-auto">
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-x-auto no-scrollbar">
              {[
                { id: 'Active', label: 'Active', color: 'bg-brand-primary', count: (statusCounts.Total || 0) - (statusCounts.Delivered || 0) },
                { id: 'Pending', label: 'Pending', color: 'bg-amber-500', count: statusCounts.Pending },
                { id: 'Processing', label: 'In Progress', color: 'bg-indigo-500', count: statusCounts.Processing },
                { id: 'Final', label: 'Finalized', color: 'bg-emerald-500', count: statusCounts.Final },
                { id: 'Delivered', label: 'Delivered', color: 'bg-sky-500', count: statusCounts.Delivered },
                { id: 'All', label: 'All', color: 'bg-slate-400', count: statusCounts.Total }
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setStatusFilter(btn.id)}
                  className={`flex items-center gap-2.5 px-4 py-2 rounded-[18px] transition-all whitespace-nowrap group/btn ${
                    statusFilter === btn.id 
                      ? 'bg-brand-dark text-white shadow-lg scale-[1.05]' 
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${statusFilter === btn.id ? 'bg-white' : btn.color}`}></div>
                  <span className="text-[11px] font-black uppercase tracking-wider">{btn.label}</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg tabular-nums ${
                    statusFilter === btn.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {btn.count}
                  </span>
                </button>
              ))}
              
              <div className="w-[1px] h-6 bg-slate-100 mx-1 hidden xl:block"></div>
              
              <div className="flex items-center gap-2 px-3">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Priority</span>
                <select className="bg-transparent border-none py-1 text-[11px] font-bold text-brand-dark outline-none cursor-pointer"
                  value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
                  <option value="All">All Priority</option>
                  <option value="Routine">Routine</option>
                  <option value="Urgent">Urgent</option>
                  <option value="STAT">STAT</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto pr-2 -mr-2 custom-scrollbar min-h-0 bg-white rounded-[32px] shadow-sm border border-slate-100 relative" style={{ maxHeight: 'calc(100vh - 360px)' }}>
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-[#f1f5f9] sticky top-0 z-[10] border-b border-slate-200">
              <tr>
                <th className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Booking ID</th>
                <th className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Patient / Doctor</th>
                <th className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Tests</th>
                <th className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Status</th>
                <th className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Total Amount</th>
                <th className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Date</th>
                <th className="px-8 py-5 text-right text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Actions</th>
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
                      <div className="text-[10px] font-bold text-slate-400 flex items-center uppercase tracking-widest">
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
                            ['Completed', 'Final', 'Delivered'].includes(b.status) ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                            b.status === 'Processing' ? 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20' :
                            'bg-amber-50 text-amber-600 border-amber-100'
                         }`}>
                           <div className={`w-1.5 h-1.5 rounded-full mr-2 ${['Completed', 'Final', 'Delivered'].includes(b.status) ? 'bg-emerald-500 animate-pulse' : 'bg-current'}`}></div>
                           {b.status}
                         </span>
                         <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all ${
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
                      <div className="flex justify-end gap-3 transition-all">
                        <button 
                          onClick={() => handleEditBooking(b)}
                          className="p-3 bg-amber-50 text-amber-500 hover:bg-amber-500 hover:text-white rounded-2xl transition-all shadow-sm border border-amber-100" title="Edit Booking">
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button className="p-3 bg-brand-light/50 text-brand-dark hover:bg-brand-primary hover:text-white rounded-2xl transition-all shadow-sm border border-brand-primary/10" title="Print Invoice">
                          <FileText className="w-5 h-5" />
                        </button>
                        {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_delete_records) && (
                          <button 
                            onClick={() => setBookingToDelete(b)}
                            className="p-3 bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white rounded-2xl transition-all shadow-sm border border-rose-100" title="Delete Booking">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
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
        <div className="fixed inset-0 bg-brand-dark/80 flex items-center justify-center p-2 sm:p-4 z-[200] backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[28px] sm:rounded-[40px] shadow-3xl max-w-5xl w-full p-4 sm:p-8 overflow-hidden relative border border-white/20 flex flex-col max-h-[96vh]">
            <button onClick={exitModal} className="absolute top-3 sm:top-6 right-3 sm:right-6 p-2 sm:p-2 text-slate-300 hover:text-brand-dark hover:bg-brand-light rounded-2xl rotate-90 hover:rotate-180 transition-all duration-500 z-10">
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            
            <div className="mb-4 sm:mb-8 flex items-center gap-3 sm:gap-5 shrink-0">
              <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-[22px] flex items-center justify-center shadow-xl rotate-6 shrink-0 transition-all ${isEditing ? 'bg-amber-500 shadow-amber-500/20' : 'bg-brand-primary shadow-brand-primary/20'}`}>
                {isEditing ? <Pencil className="w-5 h-5 sm:w-7 sm:h-7 text-white" /> : <Calendar className="w-5 h-5 sm:w-7 sm:h-7 text-white" />}
              </div>
              <div>
                <h2 className="text-xl sm:text-3xl font-black text-brand-dark tracking-tighter uppercase leading-none">
                  {isEditing ? 'Modify Booking' : 'New Entry'}
                </h2>
                <p className="text-slate-400 font-bold text-[9px] sm:text-[12px] uppercase tracking-[0.2em] mt-1.5 sm:mt-1.5 leading-none">
                  {isEditing ? `Editing Order: ${editingBookingId}` : `${userData?.labId} Standard Order`}
                </p>
              </div>
            </div>
            
            <form onSubmit={isEditing ? handleUpdateBooking : handleAddBooking} className="flex flex-col lg:flex-row gap-3 sm:gap-6 max-h-[85vh] min-h-[400px]">
              {/* Left Column: Inputs */}
              <div className="flex-[1.4] space-y-3 sm:space-y-5 overflow-y-auto custom-scrollbar pr-2 sm:pr-6 pb-6 lg:border-r border-slate-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] sm:text-[11px] font-black text-brand-dark/60 uppercase tracking-[0.2em] mb-1 sm:mb-1.5 ml-2">1. Select Patient</label>
                    <div className="relative group">
                      <select 
                        required 
                        disabled={isEditing}
                        className={`w-full bg-slate-50 border border-slate-200 rounded-[12px] sm:rounded-[14px] py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white transition-all appearance-none cursor-pointer shadow-sm group-hover:border-slate-300 ${isEditing ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                        value={newBooking.patientId} 
                        onChange={e => !isEditing && setNewBooking({...newBooking, patientId: e.target.value})}
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
                    <label className="block text-[10px] sm:text-[11px] font-black text-brand-dark/60 uppercase tracking-[0.2em] mb-1 sm:mb-1.5 ml-2">2. Referrer</label>
                    <div className="relative group">
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-[12px] sm:rounded-[14px] py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white transition-all appearance-none cursor-pointer shadow-sm group-hover:border-slate-300"
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
                    <label className="block text-[10px] sm:text-[11px] font-black text-brand-dark/60 uppercase tracking-[0.2em] mb-1 sm:mb-1.5 ml-2">3. Priority</label>
                    <div className="relative group">
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-[12px] sm:rounded-[14px] py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-[13px] font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white transition-all appearance-none cursor-pointer shadow-sm group-hover:border-slate-300"
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
                <label className="block text-[11px] sm:text-[12px] font-black text-brand-dark/60 uppercase tracking-[0.2em] mb-2 sm:mb-3 ml-2">4. Select Tests</label>
                <div className="mb-2 sm:mb-3 relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 sm:pl-5 flex items-center pointer-events-none group-focus-within:text-brand-primary transition-colors text-slate-400">
                    <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Search master catalog..." 
                    value={testSearchQuery}
                    onChange={(e) => setTestSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[12px] sm:rounded-[14px] pl-10 sm:pl-12 pr-4 sm:pr-5 py-1.5 sm:py-2 text-xs sm:text-[13px] font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white transition-all placeholder:text-slate-400 shadow-sm"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-2 gap-1.5 sm:gap-2 p-2 sm:p-2.5 min-h-[140px] max-h-[180px] overflow-y-auto bg-slate-50/30 rounded-[16px] sm:rounded-[22px] border border-slate-100 shadow-inner">
                  {tests.filter(t => t.testName?.toLowerCase().includes(testSearchQuery.toLowerCase())).map(t => (
                    <label key={t.id} className={`flex items-center p-2 sm:p-2.5 rounded-[12px] sm:rounded-[14px] border-2 transition-all cursor-pointer group relative overflow-hidden ${newBooking.testIds.includes(t.id) ? 'bg-brand-dark border-brand-dark text-white shadow-xl shadow-brand-dark/30' : 'bg-white border-transparent text-slate-600 hover:border-brand-primary/30 shadow-sm'}`}>
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
                      <span className="text-[10px] font-black uppercase tracking-tight relative z-10">{t.testName}</span>
                      <div className="ml-auto mr-4 text-[10px] font-black opacity-70 relative z-10 tabular-nums">₹{t.price}</div>
                      {newBooking.testIds.includes(t.id) && <div className="absolute top-0 right-0 w-6 h-6 bg-brand-primary rounded-bl-[16px] flex items-center justify-center p-1 shadow-lg"><CheckCircle className="w-3 h-3 text-white relative -top-0.5 -right-0.5" /></div>}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Billing & Notes Sidebar */}
              <div className="flex-1 flex flex-col gap-3 sm:gap-4">
                <div className="bg-brand-dark p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] space-y-2.5 sm:space-y-3 shadow-3xl shadow-brand-dark/20 relative overflow-hidden shrink-0">
                  <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 bg-brand-primary/10 blur-[60px] sm:blur-[80px] rounded-full"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-center mb-1.5 sm:mb-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Subtotal</span>
                      <span className="font-black text-brand-light text-base sm:text-base tabular-nums">₹{newBooking.subtotal || 0}</span>
                    </div>
                    <div className="space-y-0.5 mb-2 sm:mb-4">
                      <label className="block text-[10px] font-black text-white/30 uppercase tracking-widest mb-0.5">Discount (₹)</label>
                      <input 
                        type="number" 
                        disabled={!userData?.permissions?.can_apply_discounts && userData?.role !== 'LabAdmin' && userData?.role !== 'SuperAdmin'}
                        className={`w-full bg-white/5 border border-white/10 rounded-[10px] sm:rounded-[14px] p-2 sm:p-2.5 text-[13px] sm:text-[13px] font-black text-white outline-none focus:ring-4 focus:ring-brand-primary/30 transition-all tabular-nums ${(!userData?.permissions?.can_apply_discounts && userData?.role !== 'LabAdmin' && userData?.role !== 'SuperAdmin') ? 'opacity-30 cursor-not-allowed' : ''}`}
                        placeholder="0"
                        value={newBooking.discount} onChange={e => handleDiscountChange(e.target.value)}
                      />
                    </div>
                    <div className="pt-2 sm:pt-3 border-t border-white/10 flex justify-between items-end">
                      <div className="text-left py-0.5 sm:py-0.5">
                        <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-0.5 sm:mb-0.5">Total</p>
                        <p className="text-lg sm:text-xl font-black text-white tracking-tighter tabular-nums">₹{newBooking.totalAmount || 0}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-0.5 sm:gap-0.5">
                         <p className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">Paid</p>
                         <input type="number" 
                           className="w-16 sm:w-20 bg-transparent border-b-2 border-brand-primary py-0 text-right text-base sm:text-lg font-black text-brand-primary outline-none focus:bg-brand-primary/10 transition-all tabular-nums"
                           value={newBooking.paidAmount} onChange={e => setNewBooking({...newBooking, paidAmount: parseFloat(e.target.value) || 0})}
                         />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-brand-light/20 p-3 sm:p-4 rounded-[20px] sm:rounded-[24px] border border-brand-primary/10 space-y-1 sm:space-y-1 shrink-0">
                   <label className="block text-[10px] font-black text-brand-dark/50 uppercase tracking-[0.3em] ml-2">Observations & History</label>
                   <textarea 
                     className="w-full bg-white/60 border border-slate-100 rounded-[12px] sm:rounded-[16px] p-2.5 sm:p-3 text-[12px] font-bold text-brand-dark outline-none focus:ring-8 focus:ring-brand-primary/5 h-12 sm:h-16 resize-none shadow-inner transition-all"
                     placeholder="Notes, symptoms..."
                     value={newBooking.notes} onChange={e => setNewBooking({...newBooking, notes: e.target.value})}
                   ></textarea>
                </div>

                <div className="flex flex-col gap-2 sm:gap-2.5 mt-auto pt-1">
                    <button 
                      type="submit" 
                      disabled={isSaving} 
                      className={`w-full py-2.5 sm:py-3.5 rounded-[16px] sm:rounded-[20px] text-[11px] font-black uppercase tracking-[0.3em] transition-all border border-white/10 group flex items-center justify-center gap-3 ${
                        isSaving 
                          ? 'bg-brand-dark/80 cursor-not-allowed text-white/50' 
                          : isEditing 
                            ? 'bg-amber-500 text-white hover:bg-amber-600 hover:shadow-2xl hover:shadow-amber-500/30 active:scale-95'
                            : 'bg-brand-dark text-white hover:shadow-2xl hover:shadow-brand-dark/30 active:scale-95'
                      }`}
                    >
                      {isSaving ? (
                        <>
                          <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-brand-primary" />
                          {isEditing ? 'Updating...' : 'Saving...'}
                        </>
                      ) : (
                        <>
                          {isEditing ? 'Update Booking' : 'Save Booking'}
                          {isEditing ? (
                            <Pencil className="inline w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1 text-white hover:rotate-12 transition-transform" />
                          ) : (
                            <Plus className="inline w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1 text-brand-primary group-hover:rotate-90 transition-transform" />
                          )}
                        </>
                      )}
                    </button>
                    <button type="button" onClick={exitModal} className="w-full py-2 sm:py-2.5 bg-slate-50 text-slate-400 rounded-[12px] sm:rounded-[14px] text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-100 transition-all active:scale-95">Cancel Order</button>
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
      <OutOfTokensModal 
        isOpen={showTokenModal} 
        onClose={() => setShowTokenModal(false)} 
      />
    </>
  );
};

export default Bookings;

