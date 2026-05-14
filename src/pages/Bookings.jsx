import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc, deleteDoc, serverTimestamp, Timestamp, writeBatch, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, Loader, Calendar, User, FileText, CheckCircle, Clock, AlertCircle, X, Trash2, Database, Pencil, IndianRupee, ShieldAlert, AlertTriangle, Zap, Download, ChevronLeft, ChevronRight, Filter, Eye, Printer, MoreVertical, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import OutOfTokensModal from '../components/OutOfTokensModal';
import ReportPreview from '../components/ReportPreview';
import BookingForm from '../components/BookingForm';
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

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // New Filters
  const [paymentFilter, setPaymentFilter] = useState('All');

  // UI State
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [previewReport, setPreviewReport] = useState(null);
  const [isFetchingReport, setIsFetchingReport] = useState(null); // stores booking id being fetched

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

  // Handle URL Param for Auto-Opening New Booking
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldAutoOpen = params.get('autoOpen');
    const pid = params.get('patientId');
    const isNew = params.get('new');
    
    if ((shouldAutoOpen === 'true' && activeLabId) || (isNew === 'true' && activeLabId)) {
      // --- PAY AS YOU GO ENFORCEMENT ---
      const isPayAsYouGo = subscription?.plan === 'pay_as_you_go';
      const balance = subscription?.tokenBalance || 0;
      if (isPayAsYouGo && balance <= 0) {
        setShowTokenModal(true);
      } else {
        // CHECK FOR PRESERVED STATE FIRST
        const saved = sessionStorage.getItem('pendingBookingState');
        if (saved) {
          try {
            const { newBooking: savedBooking, isEditing: savedEditing, editingBookingId: savedId } = JSON.parse(saved);
            setNewBooking(savedBooking);
            setIsEditing(savedEditing);
            setEditingBookingId(savedId);
            setShowAddModal(true);
            sessionStorage.removeItem('pendingBookingState');
            return; // Skip standard auto-open if we restored state
          } catch (e) {
            console.error("Error restoring state:", e);
          }
        }

        if (pid) {
          setNewBooking(prev => ({ ...prev, patientId: pid }));
          setShowAddModal(true);
        } else if (isNew === 'true') {
          setNewBooking({
            patientId: '', doctorId: '', testIds: [], 
            subtotal: 0, discount: 0, totalAmount: 0, paidAmount: 0, 
            status: 'Pending', urgency: 'Routine', notes: '',
            paymentStatus: 'Unpaid', balance: 0
          });
          setShowAddModal(true);
        }
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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Handle ESC key to close overlays/modals
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (selectedTestsBooking) setSelectedTestsBooking(null);
        else if (bookingToDelete) setBookingToDelete(null);
        else if (previewReport) setPreviewReport(null);
        else if (showTokenModal) setShowTokenModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedTestsBooking, bookingToDelete, previewReport, showTokenModal]);

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

  const confirmCancelBooking = async () => {
    if (!bookingToDelete) return;
    
    if (!userData?.permissions?.can_edit_records && userData?.role !== 'LabAdmin' && userData?.role !== 'SuperAdmin') {
      toast.error("Unauthorized: You do not have permission to cancel records.");
      setBookingToDelete(null);
      return;
    }

    try {
      const bId = bookingToDelete.id; 
      const bookingNo = bookingToDelete.bookingNo || bookingToDelete.bookingId || bookingToDelete.billId || bId; 
      
      // Update Booking Status to Cancelled & Reset Financials
      await setDoc(doc(db, 'bookings', bId), { 
        status: 'Cancelled',
        totalAmount: 0,
        paidAmount: 0,
        balance: 0,
        paymentStatus: 'Cancelled'
      }, { merge: true });
      
      // Attempt to cascade cancel to reports
      try {
        const qReports = query(
          collection(db, 'reports'), 
          where('labId', '==', activeLabId), 
          where('bookingNo', '==', bookingNo)
        );
        const snap = await getDocs(qReports);
        for (const rDoc of snap.docs) {
            await setDoc(doc(db, 'reports', rDoc.id), { status: 'Cancelled' }, { merge: true });
        }
      } catch (e) {
        console.warn("Cascade cancel skipped or failed:", e);
      }
      
      setBookings(prev => prev.map(r => r.id === bId ? { 
        ...r, 
        status: 'Cancelled',
        totalAmount: 0,
        paidAmount: 0,
        balance: 0,
        paymentStatus: 'Cancelled'
      } : r));
      toast.success('Booking cancelled successfully');
      if (sourcePage === 'reports') {
        navigate('/reports');
      }
    } catch (error) {
      toast.error('Failed to cancel booking: ' + error.message);
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
      const matchesStatus = () => {
          if (statusFilter === 'All') return true;
          if (statusFilter === 'Active') return b.status !== 'Delivered' && b.status !== 'Cancelled';
          if (statusFilter === 'In Progress') return b.status === 'Processing' || b.status === 'In Progress' || b.status === 'Sample Collected';
          if (statusFilter === 'Finalized') return b.status === 'Final' || b.status === 'Completed';
          return b.status === statusFilter;
      };
      if (!matchesStatus()) return false;

      // 5. Payment Filter
      if (paymentFilter !== 'All') {
          if (paymentFilter === 'Paid' && b.paymentStatus !== 'Paid') return false;
          if (paymentFilter === 'Unpaid' && b.paymentStatus !== 'Unpaid') return false;
      }

      return true;
    });
  }, [bookings, searchTerm, statusFilter, urgencyFilter, paymentFilter, startDate, endDate]);

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

    const counts = { Pending: 0, 'Processing': 0, 'Final': 0, 'Delivered': 0, Cancelled: 0, Total: dateFiltered.length };
    dateFiltered.forEach(b => {
      if (b.status === 'Pending') counts.Pending++;
      else if (b.status === 'Processing' || b.status === 'In Progress' || b.status === 'Sample Collected') counts.Processing++;
      else if (b.status === 'Final' || b.status === 'Completed') counts.Final++;
      else if (b.status === 'Delivered') counts.Delivered++;
      else if (b.status === 'Cancelled') counts.Cancelled++;
    });
    return counts;
  }, [bookings, startDate, endDate]);

  const paginatedBookings = React.useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredBookings.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredBookings, currentPage, rowsPerPage]);

  const handleExportCSV = () => {
    const headers = ["Booking ID", "Bill ID", "Patient Name", "Doctor Name", "Tests", "Status", "Amount", "Paid", "Balance", "Payment Status", "Date"];
    const rows = filteredBookings.map(b => [
      b.bookingId || '',
      b.billId || '',
      b.patientName || '',
      b.doctorName || 'Self',
      b.testNames || '',
      b.status || '',
      b.totalAmount || 0,
      b.paidAmount || 0,
      b.balance || 0,
      b.paymentStatus || '',
      b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().toLocaleString() : new Date(b.createdAt).toLocaleString()) : ''
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `bookings_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        status: 'Sample Collected',
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
          price: test.price || 0,
          totalAmount: newBooking.totalAmount || 0,
          status: 'Sample Collected',
          paymentStatus: (newBooking.totalAmount - (newBooking.paidAmount || 0)) <= 0 ? 'Paid' : 'Unpaid',
          labId: activeLabId,
          doctorName: selectedDoctor?.name || 'Self',
          reportLayout: test.reportLayout || 'Standard',
          results: [],
          registered_at: serverTimestamp(),
          collected_at: serverTimestamp(),
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
          doctorName: selectedDoctor?.name || 'Self',
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


  const handlePrintReport = async (booking) => {
    if (!activeLabId || !booking.bookingNo) return;
    
    setIsFetchingReport(booking.id);
    try {
      const q = query(
        collection(db, 'reports'), 
        where('labId', '==', activeLabId), 
        where('bookingNo', '==', booking.bookingNo)
      );
      const snap = await getDocs(q);
      const reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (reports.length === 0) {
        toast.info("No reports found for this booking.");
        return;
      }

      // Stable sort for tests (by creation time)
      reports.sort((a, b) => {
        const getTime = (v) => {
          if (!v) return 0;
          if (v.seconds) return v.seconds * 1000;
          if (v.toDate) return v.toDate().getTime();
          const d = new Date(v); return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return getTime(a.createdAt || 0) - getTime(b.createdAt || 0);
      });

      // Merge metadata from first test + results from all tests
      const firstTest = reports[0];
      const mergedReport = {
        ...firstTest,
        testName: reports.map(t => t.testName).join(', '),
        results: reports.flatMap(t => (t.results || []).map(r => ({ ...r, _testName: t.testName }))),
      };

      setPreviewReport(mergedReport);
    } catch (error) {
      console.error("Error fetching reports for print:", error);
      toast.error("Failed to load report for printing.");
    } finally {
      setIsFetchingReport(null);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
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
      case 'Cancelled': return 'bg-slate-500 text-white border-slate-600 shadow-sm shadow-slate-100';
      default: return 'bg-orange-400 text-white border-orange-500 shadow-sm shadow-orange-100'; // Pending
    }
  };

  const handleNewBooking = () => {
    if (!activeLabId && userData?.role === 'SuperAdmin') {
      toast.info("Super Admin: Please select a Laboratory from the top selection dropdown to create a booking.");
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
  };

  return (
    <>
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 w-full flex-grow text-slate-800 animate-in fade-in duration-500">
      
      {showAddModal ? (
        <div className="flex-grow flex flex-col bg-[#F0F7FF] -mx-4 sm:-mx-6 lg:-mx-8 -mb-3 animate-in fade-in slide-in-from-bottom-2 duration-500 min-h-[calc(100vh-100px)]">
          <BookingForm 
            isEditing={isEditing}
            editingBookingId={editingBookingId}
            patients={patients}
            doctors={doctors}
            tests={tests}
            newBooking={newBooking}
            setNewBooking={setNewBooking}
            isSaving={isSaving}
            onSave={isEditing ? handleUpdateBooking : handleAddBooking}
            onClose={exitModal}
            userData={userData}
            activeLabId={activeLabId}
            refreshData={fetchCreationData}
          />
        </div>
      ) : (
        <div className="flex flex-col">
          {/* 1. Page Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <div>
              <h1 className="text-[20px] font-bold text-[#1F2937] leading-tight flex items-center">
                <div className="p-2 bg-brand-light rounded-xl mr-3 shadow-sm border border-brand-primary/10 transition-transform hover:scale-110">
                  <Calendar className="w-5 h-5 text-brand-primary" />
                </div>
                Bookings
              </h1>
              <p className="text-[11px] font-medium text-[#7B8794] mt-1 tracking-wide">Catalog and manage diagnostic orders and patient records.</p>
            </div>
            
            <button 
              onClick={handleNewBooking}
              className="w-full md:w-auto bg-[#1E2A5A] text-white px-5 py-2.5 rounded-xl font-bold tracking-widest text-[10px] uppercase shadow-lg hover:shadow-[#1E2A5A]/20 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2 group border border-white/10"
            >
              <Plus className="w-3.5 h-3.5 text-white group-hover:rotate-90 transition-transform duration-500" />
              New Booking
            </button>
          </div>

          {/* 2. Compact Filter Row (Billing Style) */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Search Bar */}
            <div className="flex-1 min-w-[280px] relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3] group-focus-within:text-[#1E2A5A] transition-colors" />
              <input 
                type="text" 
                className="w-full h-10 pl-11 pr-4 bg-white border border-[#E5E7EB] rounded-[5px] focus:ring-4 focus:ring-[#1E2A5A]/5 focus:border-[#1E2A5A] transition-all font-bold text-[13px] text-[#1F2937] outline-none placeholder:text-slate-300 shadow-sm"
                placeholder="Search by patient name, ID or booking ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-2 p-1 bg-white border border-[#E5E7EB] rounded-[5px] shadow-sm h-10">
              <div className="flex items-center gap-2 px-3">
                <Calendar className="w-4 h-4 text-[#98A2B3]" />
                <div className="flex items-center gap-1.5">
                  <input 
                    type="date" 
                    className="bg-transparent border-none text-[11px] font-bold text-[#1F2937] focus:ring-0 p-0 w-[100px] cursor-pointer"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-widest">To</span>
                  <input 
                    type="date" 
                    className="bg-transparent border-none text-[11px] font-bold text-[#1F2937] focus:ring-0 p-0 w-[100px] cursor-pointer"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Quick Priority Filter */}
            <div className="flex items-center gap-1.5 p-1 bg-white border border-[#E5E7EB] rounded-[5px] shadow-sm h-10">
              {['All', 'STAT', 'Urgent'].map((p) => (
                <button
                  key={p}
                  onClick={() => setUrgencyFilter(p)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                    urgencyFilter === p 
                      ? 'bg-[#1E2A5A] text-white shadow-sm' 
                      : 'text-[#64748B] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Reset & Export Group */}
            <div className="flex items-center gap-2 ml-auto">
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setStartDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
                  setEndDate(new Date().toISOString().split('T')[0]);
                  setStatusFilter('Active');
                  setUrgencyFilter('All');
                  setPaymentFilter('All');
                }}
                className="w-10 h-10 flex items-center justify-center bg-white border border-[#E5E7EB] rounded-xl text-[#64748B] hover:text-[#1E2A5A] hover:bg-[#F8FAFC] transition-all shadow-sm group"
                title="Reset Filters"
              >
                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              </button>

              <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 h-10 bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl text-[10px] font-bold text-[#1F2937] hover:bg-[#1E2A5A] hover:text-white transition-all uppercase tracking-widest shadow-sm active:scale-95 group"
              >
                <Download className="w-3.5 h-3.5 text-[#1E2A5A] group-hover:text-white transition-colors" />
                CSV
              </button>
            </div>
          </div>

          {/* Quick Status Chips (Billing Style) */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 -mb-1 mb-6">
            <div className="flex items-center gap-1 p-1 bg-white border border-[#E5E7EB] rounded-[5px] shadow-sm h-10 shrink-0">
              {[
                { id: 'All', label: 'All', color: 'bg-slate-400', count: statusCounts.Total },
                { id: 'Active', label: 'Active', color: 'bg-blue-500', count: statusCounts.Total - statusCounts.Delivered - statusCounts.Cancelled },
                { id: 'Pending', label: 'Pending', color: 'bg-orange-400', count: statusCounts.Pending },
                { id: 'In Progress', label: 'Processing', color: 'bg-indigo-500', count: statusCounts.Processing },
                { id: 'Finalized', label: 'Ready', color: 'bg-emerald-500', count: statusCounts.Final },
                { id: 'Delivered', label: 'Delivered', color: 'bg-sky-500', count: statusCounts.Delivered },
                { id: 'Cancelled', label: 'Cancelled', color: 'bg-rose-500', count: statusCounts.Cancelled }
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setStatusFilter(btn.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap h-full ${
                    statusFilter === btn.id 
                      ? 'bg-[#1E2A5A] text-white shadow-sm' 
                      : 'text-[#64748B] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${statusFilter === btn.id ? 'bg-white' : btn.color}`}></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider">{btn.label}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md tabular-nums ${
                    statusFilter === btn.id ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#94A3B8]'
                  }`}>
                    {btn.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-grow overflow-y-auto pr-2 -mr-2 custom-scrollbar min-h-0 bg-white rounded-xl shadow-sm border border-[#E5E7EB] relative" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th className="sticky top-0 z-20 bg-[#F9FAFB] px-6 py-3 text-left text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider shadow-sm">Booking ID</th>
                  <th className="sticky top-0 z-20 bg-[#F9FAFB] px-6 py-3 text-left text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider shadow-sm">Patient / Doctor</th>
                  <th className="sticky top-0 z-20 bg-[#F9FAFB] px-6 py-3 text-left text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider shadow-sm">Tests</th>
                  <th className="sticky top-0 z-20 bg-[#F9FAFB] px-6 py-3 text-left text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider shadow-sm">Status</th>
                  <th className="sticky top-0 z-20 bg-[#F9FAFB] px-6 py-3 text-left text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider shadow-sm">Amount</th>
                  <th className="sticky top-0 z-20 bg-[#F9FAFB] px-6 py-3 text-left text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider shadow-sm">Date</th>
                  <th className="sticky top-0 z-20 bg-[#F9FAFB] px-6 py-3 text-right text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider shadow-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-24 text-center">
                       <Loader className="w-10 h-10 animate-spin text-[#1E2A5A] mx-auto mb-5" />
                       <p className="text-[14px] font-medium text-[#7B8794]">Synchronizing Records...</p>
                    </td>
                  </tr>
                ) : filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-32 text-center">
                       <div className="w-20 h-20 bg-slate-50 rounded-[40px] flex items-center justify-center mx-auto mb-6 transition-transform hover:rotate-12">
                         <Database className="w-8 h-8 text-slate-200" />
                       </div>
                       <p className="text-[16px] font-medium text-[#98A2B3]">Zero Matching Records Found</p>
                    </td>
                  </tr>
                ) : paginatedBookings.map((b) => (
                  <tr key={b.id} className={`hover:bg-[#F9FAFB] transition-colors group border-b border-[#F3F4F6] ${activeDropdownId === b.id ? 'z-50' : 'z-auto'}`}>
                    <td className="px-6 py-2.5">
                      <div className={`inline-flex px-2 py-1 rounded-md text-[11px] font-bold transition-all ${b.balance > 0 ? 'bg-rose-600 text-white shadow-sm' : 'text-[#1E2A5A] bg-slate-100'}`}>
                        {b.billId || b.bookingId}
                      </div>
                    </td>
                    <td className="px-6 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#F1F5F9] flex items-center justify-center text-[#1E2A5A] font-bold text-xs border border-[#E5E7EB] shadow-sm group-hover:scale-110 transition-transform">
                          {getInitials(b.patientName)}
                        </div>
                        <div>
                          <div className="text-[14px] font-semibold text-[#1F2937] leading-tight group-hover:text-brand-primary transition-colors">{b.patientName}</div>
                          <div className="text-[11px] font-medium text-[#7B8794] mt-0.5 uppercase tracking-wider">Dr. {b.doctorName || 'DIRECT VISIT'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-2.5 max-w-[200px]">
                      <div className="text-[11px] font-medium text-[#4B5563] leading-tight mb-0.5">{b.testIds?.length} Tests</div>
                      <div className="text-[11px] font-medium text-[#7B8794] truncate" title={b.testNames}>{b.testNames}</div>
                    </td>
                    <td className="px-6 py-2.5">
                       <div className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest inline-flex items-center gap-1.5 shadow-sm border ${getStatusStyles(b.status || 'Pending')}`}>
                         <div className="w-1 h-1 rounded-full bg-white opacity-60" />
                         {b.status}
                       </div>
                    </td>
                    <td className="px-6 py-2.5">
                       <div className={`text-[13px] font-bold tracking-tight mb-0.5 tabular-nums ${b.status === 'Cancelled' ? 'text-slate-400 line-through opacity-50' : 'text-[#1F2937]'}`}>
                         ₹{b.totalAmount}
                       </div>
                       <div className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 ${b.status === 'Cancelled' ? 'text-slate-400' : b.paymentStatus === 'Paid' ? 'text-emerald-500' : 'text-rose-500'}`}>
                         <div className={`w-0.5 h-0.5 rounded-full ${b.status === 'Cancelled' ? 'bg-slate-400' : b.paymentStatus === 'Paid' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                         {b.status === 'Cancelled' ? 'Cancelled' : b.paymentStatus}
                       </div>
                    </td>
                    <td className="px-6 py-2.5 whitespace-nowrap">
                       <div className="text-[11px] font-semibold text-[#374151] tracking-tight mb-0.5 whitespace-nowrap tabular-nums">
                         {b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date(b.createdAt).toLocaleDateString('en-GB')) : 'N/A'}
                       </div>
                       <div className="text-[10px] font-medium text-[#98A2B3] tabular-nums">
                         {b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })) : '--:--'}
                       </div>
                    </td>
                    <td className="px-6 py-2.5 text-right">
                       <div className="flex items-center justify-end gap-1 isolate">
                         <button 
                           onClick={() => setSelectedTestsBooking(b)}
                            className="p-2 text-slate-400 hover:text-[#1E2A5A] hover:bg-[#F1F5F9] rounded-xl transition-all"
                            title="View Full Details"
                          >
                           <Eye className="w-4 h-4" />
                         </button>
                         {['Final', 'Completed', 'Finalized', 'Delivered'].includes(b.status) && (
                           <button 
                             onClick={() => handlePrintReport(b)}
                             disabled={isFetchingReport === b.id}
                             className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all disabled:opacity-50" 
                             title="Print Report"
                           >
                             {isFetchingReport === b.id ? (
                               <Loader className="w-4 h-4 animate-spin text-emerald-600" />
                             ) : (
                               <Printer className="w-4 h-4" />
                             )}
                           </button>
                         )}
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             handleEditBooking(b);
                           }}
                           className="p-2 text-slate-400 hover:text-[#1E2A5A] hover:bg-[#F1F5F9] rounded-xl transition-all"
                           title="Edit Booking"
                         >
                           <Pencil className="w-4 h-4" />
                         </button>
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             setBookingToDelete(b);
                           }}
                           className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                           title="Cancel Booking"
                         >
                           <X className="w-4 h-4" />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 6. Professional Pagination Footer */}
          <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-4 px-6 pb-6">
            <div className="flex items-center gap-4">
              <p className="text-[11px] font-medium text-[#7B8794] uppercase tracking-wider">
                Records <span className="text-[#1F2937] font-bold px-1">{(currentPage - 1) * rowsPerPage + 1}-{Math.min(currentPage * rowsPerPage, filteredBookings.length)}</span> of <span className="text-[#1F2937] font-bold">{filteredBookings.length}</span>
              </p>
              <div className="h-3 w-[1px] bg-[#E5E7EB] hidden md:block" />
              <select 
                 className="bg-[#F8FAFC] border border-[#E5E7EB] px-3 py-1.5 rounded-[5px] text-[11px] font-bold text-[#1F2937] outline-none cursor-pointer hover:bg-white transition-all uppercase tracking-wider"
                 value={rowsPerPage}
                 onChange={e => {
                    setRowsPerPage(parseInt(e.target.value));
                    setCurrentPage(1);
                 }}
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
                className="w-10 h-10 flex items-center justify-center bg-white border border-[#E5E7EB] rounded-xl text-[#64748B] hover:text-[#1E2A5A] hover:bg-[#F8FAFC] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1.5">
                {[...Array(Math.ceil(filteredBookings.length / rowsPerPage))].map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-10 h-10 rounded-xl text-[11px] font-bold transition-all duration-200 ${
                      currentPage === i + 1 
                        ? 'bg-[#1E2A5A] text-white shadow-md' 
                        : 'bg-white text-[#64748B] hover:bg-[#F8FAFC] border border-[#E5E7EB]'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredBookings.length / rowsPerPage), p + 1))}
                disabled={currentPage === Math.ceil(filteredBookings.length / rowsPerPage)}
                className="w-10 h-10 flex items-center justify-center bg-white border border-[#E5E7EB] rounded-xl text-[#64748B] hover:text-[#1E2A5A] hover:bg-[#F8FAFC] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>  
      )}

      {/* Cancel Confirmation Modal */}
      {bookingToDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/80 backdrop-blur-3xl animate-in fade-in" onClick={() => setBookingToDelete(null)}></div>
          <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-rose-50 px-8 py-6 border-b border-rose-100 flex items-center gap-4">
               <div className="p-3 bg-rose-100 rounded-2xl text-rose-600">
                  <X className="w-8 h-8" />
               </div>
               <div>
                  <h3 className="text-xl font-bold text-rose-600 uppercase tracking-tight">Cancel Booking</h3>
                  <p className="text-sm font-bold text-rose-400/80 uppercase tracking-widest mt-1">{bookingToDelete.bookingId || bookingToDelete.billId || 'Unknown ID'}</p>
               </div>
            </div>
            <div className="p-8">
               <p className="text-[14px] text-slate-500 font-medium leading-relaxed">
                  Are you sure you want to cancel the booking for <strong className="text-brand-dark uppercase">{bookingToDelete.patientName}</strong>? This will also cancel any generated bills and reports.
               </p>
               
               <div className="mt-8 flex gap-4 pt-6 border-t border-slate-100">
                 <button 
                   onClick={() => setBookingToDelete(null)}
                   className="flex-1 px-6 py-3.5 bg-slate-50 text-slate-500 font-bold uppercase tracking-widest text-[12px] rounded-2xl hover:bg-slate-100 transition-colors border border-slate-200"
                 >
                   Keep Booking
                 </button>
                 <button 
                   onClick={confirmCancelBooking}
                   className="flex-1 px-6 py-3.5 bg-rose-500 text-white font-bold uppercase tracking-widest text-[12px] rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40 active:scale-95"
                 >
                   Yes, Cancel
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
                  <h3 className="text-xl font-bold text-brand-dark">Test Panel</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedTestsBooking.patientName}</p>
                </div>
              </div>

              <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2 mb-6">
                {(selectedTestsBooking.testNames || "").split(',').map((name, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:bg-brand-primary/5 hover:border-brand-primary/20 transition-all">
                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[10px] font-bold text-brand-primary shadow-sm group-hover:bg-brand-primary group-hover:text-white transition-all">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <span className="text-sm font-bold text-brand-dark uppercase tracking-tight">{name.trim()}</span>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setSelectedTestsBooking(null)}
                className="w-full py-4 bg-brand-dark text-white rounded-[18px] text-[11px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-brand-dark/20 hover:scale-[1.02] transition-all active:scale-95"
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
      {previewReport && (
        <ReportPreview 
          report={previewReport} 
          onClose={() => setPreviewReport(null)} 
        />
      )}
    </div>
    </>
  );
};

export default Bookings;

