import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Search, Loader, FileText, Eye, Printer, AlertCircle, X, Activity, Trash2, Save, ChevronDown, ChevronUp, FlaskConical, CheckCircle2, CheckCircle, Database, Clock, Mail, Zap, Bell, IndianRupee, Pencil, FileDown, MoreVertical, Calendar as CalendarIcon, Filter, RefreshCw, User, Download, Plus } from 'lucide-react';
import ReportPreview from '../components/ReportPreview';
import { toast } from 'react-toastify';

const getGroupStatus = (tests) => {
  if (tests.length === 0) return 'Pending';
  const allDelivered = tests.every(t => t.status === 'Delivered');
  if (allDelivered) return 'Delivered';
  
  const allCancelled = tests.every(t => t.status === 'Cancelled');
  if (allCancelled) return 'Cancelled';

  const allFinalOrDelivered = tests.every(t => t.status === 'Final' || t.status === 'Delivered' || t.status === 'Cancelled');
  if (allFinalOrDelivered) return 'Final';
  
  const anyProgress = tests.some(t => t.status === 'Final' || t.status === 'In Progress' || t.status === 'Delivered' || t.status === 'Processing' || t.status === 'Sample Collected');
  return anyProgress ? 'In Progress' : 'Pending';
};

const Reports = () => {
  const { currentUser, userData, activeLabId, subscription, checkFeature } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [reports, setReports] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active'); 
  const [doctorFilter, setDoctorFilter] = useState('All Doctors');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [doctors, setDoctors] = useState([]);
  
  const [selectedReport, setSelectedReport] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [editedResults, setEditedResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [fetchingMaster, setFetchingMaster] = useState(false);
  const [pendingPaymentBooking, setPendingPaymentBooking] = useState(null); 
  // expandedGroups: set of billIds that are expanded
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [emailSending, setEmailSending] = useState(null); // billId of group currently sending email
  const [labProfile, setLabProfile] = useState(null);
  const [paymentBooking, setPaymentBooking] = useState(null); // The booking document for the current quick payment
  const [isQuickPaying, setIsQuickPaying] = useState(false);
  const [isDeducting, setIsDeducting] = useState(null); // BillId of group being deducted
  const [previewGroupId, setPreviewGroupId] = useState(null);
  const [reportToDelete, setReportToDelete] = useState(null);

  // Helper to deduct 1 token for an action
  const deductTokenAction = async (actionName) => {
    if (subscription?.plan !== 'pay_as_you_go') return true;
    
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const token = await currentUser.getIdToken();
      
      const response = await fetch(`${BACKEND_URL}/api/tokens/deduct-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: actionName, labId: activeLabId })
      });
      
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || `Failed to deduct token for ${actionName}`);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Token deduction failed:", error);
      toast.error("Network error during token validation");
      return false;
    }
  };

  const handlePreviewClick = async (e, group) => {
    e.stopPropagation();

    // 1. If already deducted or not pay_as_you_go, open immediately
    if (group.tokenDeducted || subscription?.plan !== 'pay_as_you_go') {
      setPreviewGroupId(group.groupKey);
      handleMarkDelivered(group);
      return;
    }

    // 2. Perform one-time token deduction
    setIsDeducting(group.groupKey);
    const success = await deductTokenAction(`Preview & Print: ${group.patientName}`);
    
    if (success) {
      try {
        // Update ALL reports in this group to mark as deducted
        const batch = writeBatch(db);
        group.tests.forEach(test => {
          const reportRef = doc(db, 'reports', test.id);
          batch.update(reportRef, { tokenDeducted: true });
        });
        await batch.commit();
        
        // Now open the preview
        setPreviewGroupId(group.groupKey);
        handleMarkDelivered(group);
      } catch (err) {
        console.error("Error updating token status:", err);
        toast.error("Process failed, but token might have been deducted. Contact support if balance is wrong.");
      }
    }
    
    setIsDeducting(null);
  };

  // ─── Fetch reports from Firestore ─────────────────────────────────────────
  useEffect(() => {
    if (!activeLabId && userData?.role !== 'SuperAdmin') return;
    setLoading(true);
    let q = activeLabId
      ? query(collection(db, 'reports'), where('labId', '==', activeLabId))
      : query(collection(db, 'reports'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.status !== 'Cancelled') {
          items.push({ id: d.id, ...data });
        }
      });
      items.sort((a, b) => {
        const t = (v) => {
          if (!v) return 0;
          if (v.seconds) return v.seconds * 1000;
          if (v.toDate) return v.toDate().getTime();
          const d = new Date(v); return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return t(b.updatedAt || b.createdAt) - t(a.updatedAt || a.createdAt);
      });
      setReports(items);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsubscribe();
  }, [userData, activeLabId]);

  // Fetch Bookings to cross-reference doctor names
  useEffect(() => {
    const labId = activeLabId || userData?.labId;
    if (!labId) return;
    const q = query(collection(db, 'bookings'), where('labId', '==', labId));
    const unsubscribe = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBookings(items);
    });
    return () => unsubscribe();
  }, [activeLabId, userData]);

  // Fetch Doctors for filter
  useEffect(() => {
    const fetchDoctors = async () => {
      const labId = activeLabId || userData?.labId;
      if (!labId) return;
      try {
        const q = query(collection(db, 'doctors'), where('labId', '==', labId));
        const snap = await getDocs(q);
        const docsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDoctors(docsList);
      } catch (err) {
        console.error("Error fetching doctors for filter:", err);
      }
    };
    fetchDoctors();
  }, [activeLabId, userData]);

  // --- PERSISTENCE: Restore pending payment from localStorage on mount ---
  useEffect(() => {
    const saved = localStorage.getItem('pending_payment_booking');
    if (saved) {
      try {
        setPendingPaymentBooking(JSON.parse(saved));
      } catch (e) { console.error("Error restoring pending payment:", e); }
    }
  }, []);

  // Handle URL parameters for filters (e.g. from Sidebar)
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      if (statusParam === 'all') setStatusFilter('All');
      else if (statusParam === 'active') setStatusFilter('Active');
      else if (['Pending', 'In Progress', 'Finalized', 'Delivered', 'Cancelled'].includes(statusParam)) {
        setStatusFilter(statusParam);
      }
    }
  }, [searchParams]);

  // Sync state to localStorage
  useEffect(() => {
    if (pendingPaymentBooking) {
      localStorage.setItem('pending_payment_booking', JSON.stringify(pendingPaymentBooking));
    } else {
      localStorage.removeItem('pending_payment_booking');
    }
  }, [pendingPaymentBooking]);

  // Fetch Lab Details for Automation Settings
  useEffect(() => {
    const fetchLabSettings = async () => {
      const labId = activeLabId || userData?.labId;
      if (!labId) return;
      try {
        const snap = await getDoc(doc(db, 'labs', labId));
        if (snap.exists()) setLabProfile(snap.data());
      } catch (err) {
        console.error("Error fetching lab profile for automation check:", err);
      }
    };
    fetchLabSettings();
  }, [activeLabId, userData]);

  // ─── Group reports by billId ───────────────────────────────────────────────
  const groupedReports = useMemo(() => {
    const map = {};
    reports.forEach((r) => {
      const key = r.billId || r.id;
      // Cross-reference with bookings to find missing doctor info
      const constructedBookingId = r.bookingId || (r.labId && r.bookingNo ? `${r.labId}_${r.bookingNo}` : null);
      const booking = bookings.find(b => 
        (constructedBookingId && b.id === constructedBookingId) ||
        (r.bookingNo && b.bookingNo === r.bookingNo) || 
        (r.billId && b.billId === r.billId) ||
        (b.patientId === r.patientId && b.testNames?.includes(r.testName))
      );
      const doctorName = r.doctorName || r.referredBy || booking?.doctorName || 'SELF / DIRECT';

      if (!map[key]) {
        map[key] = {
          groupKey: key,
          billId: r.billId || key,
          bookingNo: r.bookingNo || booking?.bookingNo,
          bookingId: r.bookingId || booking?.id,
          patientName: r.patientName,
          patientAge: r.patientAge,
          patientGender: r.patientGender,
          patientId: r.patientId,
          labId: r.labId,
          doctorName: doctorName,
          tests: [],
          createdAt: r.createdAt,
          balance: 0,
          totalAmount: 0,
        };
      }
      map[key].tests.push(r);
      if (booking) {
        map[key].balance = parseFloat(booking.balance || 0);
        map[key].totalAmount = parseFloat(booking.totalAmount || 0);
        map[key].paymentStatus = booking.paymentStatus || 'Unpaid';
      }
      if (r.tokenDeducted) map[key].tokenDeducted = true;
      if (r.totalAmount && map[key].totalAmount === 0) map[key].totalAmount = parseFloat(r.totalAmount);
    });

    return Object.values(map).map(group => {
      // Stable sort for tests within the group (by creation time)
      group.tests.sort((a, b) => {
        const getTime = (v) => {
          if (!v) return 0;
          if (v.seconds) return v.seconds * 1000;
          if (v.toDate) return v.toDate().getTime();
          const d = new Date(v); return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return getTime(a.createdAt) - getTime(b.createdAt);
      });
      return group;
    }).sort((a, b) => {
      const getTime = (v) => {
        if (!v) return 0;
        if (v.seconds) return v.seconds * 1000;
        if (v.toDate) return v.toDate().getTime();
        const d = new Date(v); return isNaN(d.getTime()) ? 0 : d.getTime();
      };
      return getTime(b.createdAt) - getTime(a.createdAt);
    });
  }, [reports, bookings]);

  // ─── Filter groups ────────────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    return groupedReports.filter((g) => {
      // Date Filter
      if (dateRange.start || dateRange.end) {
        const groupDate = g.createdAt?.toDate ? g.createdAt.toDate() : (g.createdAt?.seconds ? new Date(g.createdAt.seconds * 1000) : (g.createdAt ? new Date(g.createdAt) : null));
        if (groupDate) {
          if (dateRange.start) {
            const start = new Date(dateRange.start);
            start.setHours(0, 0, 0, 0);
            if (groupDate < start) return false;
          }
          if (dateRange.end) {
            const end = new Date(dateRange.end);
            end.setHours(23, 59, 59, 999);
            if (groupDate > end) return false;
          }
        }
      }

      const nameMatch = g.patientName?.toLowerCase().includes(searchTerm.toLowerCase());
      const billMatch = g.billId?.toLowerCase().includes(searchTerm.toLowerCase());
      const testMatch = g.tests.some(t => t.testName?.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!nameMatch && !billMatch && !testMatch) return false;

      const groupStatus = getGroupStatus(g.tests);
      
      // Status Filter
      let passStatus = true;
      if (statusFilter !== 'All Status' && statusFilter !== 'All') {
        if (statusFilter === 'Active') passStatus = groupStatus !== 'Delivered' && groupStatus !== 'Cancelled';
        else if (statusFilter === 'In Progress') passStatus = groupStatus === 'Processing' || groupStatus === 'In Progress' || groupStatus === 'Sample Collected';
        else if (statusFilter === 'Finalized') passStatus = groupStatus === 'Final' || groupStatus === 'Completed';
        else passStatus = groupStatus === statusFilter;
      }
      if (!passStatus) return false;

      // Doctor Filter
      if (doctorFilter !== 'All Doctors') {
        const normalize = (name) => (name || '').toUpperCase().replace(/^(DR\.?|PROF\.?|MR\.?|MS\.?|MRS\.?)\s+/i, '').trim();
        const searchDoc = normalize(doctorFilter);
        const groupDoc = normalize(g.doctorName);
        
        if (!groupDoc.includes(searchDoc)) return false;
      }

      return true;
    });
  }, [groupedReports, searchTerm, statusFilter, dateRange, doctorFilter]);

  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredGroups.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredGroups, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);

  const statusCounts = useMemo(() => {
    const counts = { Total: 0, Pending: 0, Processing: 0, Final: 0, Delivered: 0, Cancelled: 0 };
    groupedReports.forEach(g => {
      counts.Total++;
      const s = getGroupStatus(g.tests);
      if (s === 'Pending') counts.Pending++;
      else if (s === 'Processing' || s === 'In Progress' || s === 'Sample Collected') counts.Processing++;
      else if (s === 'Final' || s === 'Completed') counts.Final++;
      else if (s === 'Delivered') counts.Delivered++;
      else if (s === 'Cancelled') counts.Cancelled++;
    });
    return counts;
  }, [groupedReports]);


  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleUpdateResultValue = (idx, val) => {
    const u = [...editedResults]; u[idx].value = val; setEditedResults(u);
  };

  const handleUpdateGridValue = (idx, titration, val) => {
    const u = [...editedResults];
    let g = {}; try { g = JSON.parse(u[idx].value || '{}'); } catch { g = {}; }
    g[titration] = val; u[idx].value = JSON.stringify(g); setEditedResults(u);
  };


  const triggerBookingSync = async (reportId, nextState, group) => {
    if (!group) return;
    const labId = activeLabId || userData?.labId;
    const firstTest = group.tests[0];
    const bookingNo = firstTest?.bookingNo;
    if (!labId || !bookingNo) return;

    // Create a virtual updated state to determine the next overall booking status
    const virtualTests = group.tests.map(t => {
      if (t.id === reportId) {
        if (nextState === 'collected_at' || nextState === 'received_at') {
          return { ...t, [nextState]: new Date() }; 
        }
        return { ...t, status: nextState };
      }
      return t;
    });

    let newStatus = 'Pending';
    const allFinal = virtualTests.every(t => t.status === 'Final');
    const anyProgress = virtualTests.some(t => t.status === 'Final' || t.status === 'In Progress');
    const anyReceived = virtualTests.some(t => t.received_at || t.reported_at);
    const anyCollected = virtualTests.some(t => t.collected_at || t.received_at || t.reported_at);

    if (allFinal) newStatus = 'Final';
    else if (anyProgress) newStatus = 'In Progress';
    else if (anyReceived) newStatus = 'Processing';
    else if (anyCollected) newStatus = 'Sample Collected';

    const bookingDocId = `${labId}_${bookingNo}`;
    await updateDoc(doc(db, 'bookings', bookingDocId), {
      status: newStatus,
      updatedAt: serverTimestamp()
    }).catch(e => console.warn("Booking sync error:", e));
  };

  const handleSaveResults = async () => {
    if (!selectedReport) return;
    
    // GUARD: If report is already Final, check for edit_final_reports permission
    if (selectedReport.status === 'Final' && !userData?.permissions?.can_edit_final_reports && userData?.role !== 'LabAdmin' && userData?.role !== 'SuperAdmin') {
      toast.error("Unauthorized: You do not have permission to edit finalized reports.");
      return;
    }

    setSaving(true);
    try {
      const allFilled = editedResults.filter(r => r.dataType !== 'Grid' && r.dataType !== 'Titer').every(r => r.value && r.value !== '');
      await updateDoc(doc(db, 'reports', selectedReport.id), {
        results: editedResults,
        status: 'In Progress',
        updatedAt: serverTimestamp(),
      });
      
      // Trigger Booking Sync
      const group = groupedReports.find(g => g.tests.some(t => t.id === selectedReport.id));
      if (group) triggerBookingSync(selectedReport.id, 'In Progress', group);

      setSelectedReport(null);
      toast.success('Results saved!');
    } catch (err) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const generateToken = () => {
    try {
      return window.crypto.randomUUID().replace(/-/g, '') + Date.now().toString(16);
    } catch(e) {
      return Date.now().toString(36) + Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
    }
  };

  const handleFinalizeReport = async (reportId, group = null) => {
    // Permission Check
    if (userData?.role !== 'LabAdmin' && userData?.role !== 'SuperAdmin' && !userData?.permissions?.can_approve_reports) {
      toast.error("Unauthorized: You do not have permission to finalize reports.");
      return;
    }

    try {
      const test = group?.tests?.find(t => t.id === reportId);
      const updatePayload = {
        status: 'Final',
        reported_at: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (!test?.viewToken) {
        updatePayload.viewToken = generateToken();
      }

      await updateDoc(doc(db, 'reports', reportId), updatePayload);
      toast.success('Report finalized!');

      if (group) {
        await triggerBookingSync(reportId, 'Final', group);

        // --- NEW: Payment Check for Quick Popup (Now triggers ONLY when ALL tests are final) ---
        try {
          const allTestsFinal = group.tests.every(t => t.id === reportId || t.status === 'Final' || t.status === 'Delivered');
          
          if (allTestsFinal) {
            const labId = activeLabId || userData?.labId;
            const bId = test?.bookingId || (labId && test?.bookingNo ? `${labId}_${test.bookingNo}` : null);
            
            if (bId) {
              const bSnap = await getDoc(doc(db, 'bookings', bId));
              if (bSnap.exists()) {
                const bData = bSnap.data();
                if (parseFloat(bData.balance || 0) > 0) {
                  // Trigger the payment popup after a short delay for better UX
                  setTimeout(() => {
                    setPaymentBooking({ id: bId, ...bData });
                    setPendingPaymentBooking({ id: bId, ...bData });
                  }, 800);
                }
              }
            }
          }
        } catch (e) {
          console.warn("Quick payment trigger failed:", e);
        }

        // --- AUTOMATION LOGIC (Notifications) ---
        const otherTests = group.tests.filter(t => t.id !== reportId);
        const allOthersFinal = otherTests.every(t => t.status === 'Final' || t.status === 'Delivered');

        if (allOthersFinal) {
          const labId = activeLabId || userData?.labId;
          const labDoc = await getDoc(doc(db, 'labs', labId));
          
          if (labDoc.exists()) {
            const lData = labDoc.data();
            if (lData.reportSettings?.autoEmailNotify && checkFeature('Email Support')) {
              console.log("Triggering Automatic Notification...");
              const token = await currentUser.getIdToken();
              const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
              
              fetch(`${BACKEND_URL}/api/send-notification`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  bookingId: group.billId,
                  labId: labId
                })
              }).catch(err => console.error("Auto-Notify Error:", err));
              
              toast.info('🚀 Sent automatic notification to patient (Booking Complete)');
            }
          }
        }
      }
    } catch (err) {
      toast.error('Finalization failed: ' + err.message);
    }
  };

  const handleTimestampAction = async (reportId, field, group = null, testName = '') => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { [field]: serverTimestamp(), updatedAt: serverTimestamp() });
      if (group) triggerBookingSync(reportId, field, group);
      
      const actionLabel = field === 'collected_at' ? 'Collected' : 'Received in Lab';
      const icon = field === 'collected_at' ? '💉' : '🔬';
      toast.success(`${testName ? testName + ': ' : ''}${actionLabel}`, { icon });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleGroupTimestampAction = async (group, field) => {
    try {
      const labId = activeLabId || userData?.labId;
      const firstTest = group.tests[0];
      const bookingNo = firstTest?.bookingNo;
      if (!labId || !bookingNo) return;

      const batchPromises = group.tests.map(test => {
        if (!test[field]) {
          return updateDoc(doc(db, 'reports', test.id), { 
            [field]: serverTimestamp(), 
            updatedAt: serverTimestamp() 
          });
        }
        return Promise.resolve();
      });

      await Promise.all(batchPromises);
      
      // Update overall booking status
      const bookingDocId = `${labId}_${bookingNo}`;
      let newStatus = field === 'collected_at' ? 'Sample Collected' : 'Processing';
      
      await updateDoc(doc(db, 'bookings', bookingDocId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      const actionMsg = field === 'collected_at' 
        ? `Specimen collection for ${group.patientName} completed successfully.` 
        : `All samples for ${group.patientName} have been received in the lab.`;
      
      const icon = field === 'collected_at' ? '💉' : '🧪';
      toast.success(actionMsg, { 
        icon,
        style: { borderRadius: '16px', fontWeight: '900', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }
      });
      
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleMarkDelivered = async (group) => {
    if (!group) return;
    try {
      const batch = writeBatch(db);
      const reportsToUpdate = group.tests.filter(t => t.status !== 'Delivered');
      
      // 1. Update all reports in group to Delivered
      reportsToUpdate.forEach(test => {
        batch.update(doc(db, 'reports', test.id), { 
          status: 'Delivered',
          delivered_at: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      // 2. ALSO Update Booking status to Delivered
      const labId = activeLabId || userData?.labId;
      const firstTest = group.tests[0];
      const bId = firstTest?.bookingId || (labId && firstTest?.bookingNo ? `${labId}_${firstTest.bookingNo}` : null);
      
      if (bId) {
        batch.update(doc(db, 'bookings', bId), { 
          status: 'Delivered',
          updatedAt: serverTimestamp() 
        });
      }

      await batch.commit();
    } catch (err) {
      console.error("Delivery Status Sync Error:", err);
    }
  };

  const confirmDeleteReport = async () => {
    if (!reportToDelete) return;
    
    // GUARD: check for delete_records permission
    if (!userData?.permissions?.can_delete_records && userData?.role !== 'LabAdmin' && userData?.role !== 'SuperAdmin') {
      toast.error("Unauthorized: You do not have permission to delete records.");
      setReportToDelete(null);
      return;
    }

    try {
      await deleteDoc(doc(db, 'reports', reportToDelete.id));
      toast.success('Report deleted!');
    } catch (err) {
      toast.error('Delete failed: ' + err.message);
    } finally {
      setReportToDelete(null);
    }
  };

  const handleSendGroupEmail = async (group) => {
    // 1. Plan Check
    const plan = subscription?.plan?.toLowerCase() || 'basic';
    if (plan === 'basic') {
      toast.info('🚀 Direct Email is a Pro feature. Please upgrade your plan to enable notifications.', {
        position: "top-center",
        autoClose: 5000
      });
      return;
    }

    if (emailSending) return;
    setEmailSending(group.groupKey);

    try {
      // 2. Trigger Enriched Backend API
      // We no longer fetch patient/lab details here to avoid client-side permission issues
      const token = await currentUser.getIdToken();
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      
      const payload = {
        bookingId: group.billId,
        labId: group.labId
      };

      const res = await fetch(`${BACKEND_URL}/api/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'SMTP Error');

      toast.success('Report notification sent to patient!');
    } catch (error) {
      console.error("Email Error:", error);
      toast.error('Email failed: ' + error.message);
    } finally {
      setEmailSending(null);
    }
  };

  const toggleGroup = (key) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ─── Render Helpers ───────────────────────────────────────────────────────

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Delivered': return 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20';
      case 'Final': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'In Progress': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      default: return 'bg-amber-50 text-amber-600 border-amber-200';
    }
  };

  const getTestBadge = (status) => {
    switch (status) {
      case 'Delivered':
      case 'Final': return 'bg-emerald-600 text-white';
      case 'In Progress': return 'bg-indigo-600 text-white';
      default: return 'bg-slate-200 text-slate-600';
    }
  };

  const DisplayDate = ({ ts }) => {
    if (!ts) return <span className="text-gray-300">-</span>;
    let ms = 0;
    if (ts.seconds) ms = ts.seconds * 1000;
    else if (ts.toDate) ms = ts.toDate().getTime();
    else { const d = new Date(ts); ms = isNaN(d.getTime()) ? 0 : d.getTime(); }
    if (!ms) return <span className="text-gray-300">-</span>;
    const d = new Date(ms);
    return (
      <div className="flex flex-col">
        <span className="font-bold">{`${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`}</span>
        <span className="text-[11px] font-black text-gray-400">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    );
  };

  const renderResultInput = (res, idx) => {
    const isWidal = selectedReport?.testName?.toUpperCase().includes('WIDAL');
    if (res.dataType === 'Grid' || res.dataType === 'Titer' || selectedReport?.reportLayout === 'Tabular table' || isWidal) {
      // For titration tests, we look for titrations in allowedOptions (e.g. "1:20, 1:40")
      // If empty, we use standard Widal titrations as fallback
      let titrations = (res.allowedOptions || '').split(/[ ,|]+/).map(s => s.trim().toUpperCase()).filter(s => s && !['NEGATIVE', 'NEG', 'NIL', 'NORMAL'].includes(s));
      if (titrations.length === 0) titrations = ["1:20", "1:40", "1:80", "1:160", "1:320"];
      
      let gridData = {}; try { gridData = JSON.parse(res.value || '{}'); } catch { gridData = {}; }
      return (
        <div className="flex overflow-x-auto pb-4 gap-4 no-scrollbar sm:grid sm:grid-cols-5 sm:gap-2 py-2 px-4 bg-slate-50/80 rounded-[20px] border border-slate-100 shadow-inner w-full">
          {titrations.map(t => {
            const currentVal = gridData[t] || '-';
            const isReactive = currentVal !== '-' && !['NEGATIVE','NIL','NORMAL','NEGATIVE (-)'].includes(currentVal.toUpperCase());
            return (
              <div key={t} className="flex flex-col gap-1 shrink-0">
                <div className="text-[9px] font-black text-brand-secondary/40 uppercase tracking-widest text-center">{t}</div>
                <select value={currentVal} onFocus={() => setFocusedIndex(idx)} onBlur={() => setFocusedIndex(null)}
                  onChange={(e) => handleUpdateGridValue(idx, t, e.target.value)}
                  className={`w-full border-2 rounded-lg px-1.5 py-1 text-[10px] font-black text-center transition-all duration-300 ${isReactive ? 'bg-rose-50 border-rose-400 text-rose-700 shadow-sm scale-105 z-10' : 'bg-white border-slate-100 text-slate-400 focus:border-brand-primary/40'}`}>
                  {["-","REACTIVE","WEAKLY","POSITIVE","NEGATIVE"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      );
    }
    if (res.dataType === 'Qualitative') {
      const options = (res.allowedOptions || '').split(',').map(s => s.trim()).filter(s => s);
      if (options.length === 0) options.push('Positive','Negative');
      const valStr = (res.value || '').toUpperCase();
      const colorClass = (valStr.includes('POSITIVE') || valStr.includes('REACTIVE')) && !valStr.includes('NON-REACTIVE') ? 'text-rose-600' : (valStr.includes('NEGATIVE') || valStr.includes('NON-REACTIVE')) ? 'text-emerald-600' : 'text-gray-800';
      
      return (
        <select value={res.value || ''} onFocus={() => setFocusedIndex(idx)} onBlur={() => setFocusedIndex(null)}
          onChange={(e) => handleUpdateResultValue(idx, e.target.value)}
          className={`w-full border-2 rounded-xl py-2 px-3 text-sm font-black outline-none transition-colors ${focusedIndex === idx ? 'bg-white border-blue-500 ring-4 ring-blue-100' : 'bg-slate-50/50 border-slate-100'} ${colorClass}`}>
          <option value="" className="text-gray-400">Select Option</option>
          {options.map(opt => <option key={opt} className="text-gray-800">{opt}</option>)}
        </select>
      );
    }
    return (
      <input type="text"
        className={`w-full border-2 rounded-xl py-2 px-3 text-sm font-black outline-none ${focusedIndex === idx ? 'bg-white border-blue-500 ring-4 ring-blue-100' : 'bg-slate-50/50 border-slate-100 placeholder:text-slate-400'}`}
        value={editedResults[idx]?.value || ''} onFocus={() => setFocusedIndex(idx)} onBlur={() => setFocusedIndex(null)}
        onChange={(e) => handleUpdateResultValue(idx, e.target.value)} placeholder="Enter result..." />
    );
  };

  // ─── When previewGroupId is set, build merged report for ReportPreview ────
  const previewReport = useMemo(() => {
    if (!previewGroupId) return null;
    const group = groupedReports.find(g => g.groupKey === previewGroupId);
    if (!group) return null;
    // Use first test's metadata for header, merge all results together
    const firstTest = group.tests[0];
    return {
      ...firstTest,
      testName: group.tests.map(t => t.testName).join(', '),
      results: group.tests.flatMap(t => (t.results || []).map(r => ({ ...r, _testName: t.testName }))),
    };
  }, [previewGroupId, groupedReports]);
  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 font-sans animate-in fade-in duration-500">
      <div className="max-w-full mx-auto w-full flex-1 flex flex-col overflow-hidden p-3 sm:p-4">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 shadow-sm transition-transform hover:scale-110">
              <FileText className="w-5 h-5 text-[#1E2A5A]" />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-[#1F2937] leading-tight">Reports List</h1>
            </div>
          </div>
        </div>

        {/* Compact Filter Row (Billing Style) */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Search Bar */}
          <div className="flex-1 min-w-[280px] relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3] group-focus-within:text-[#1E2A5A] transition-colors" />
            <input 
              type="text" 
              placeholder="Search name or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 bg-white border border-[#E5E7EB] rounded-xl pl-10 pr-4 text-[13px] font-bold text-[#1F2937] placeholder:text-[#98A2B3] outline-none focus:border-[#1E2A5A] focus:ring-4 focus:ring-[#1E2A5A]/5 transition-all shadow-sm"
            />
          </div>

          {/* Doctor Filter */}
          <div className="w-48 relative group">
            <select 
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="w-full h-10 bg-white border border-[#E5E7EB] rounded-xl pl-4 pr-10 text-[12px] font-bold text-[#1F2937] outline-none appearance-none cursor-pointer focus:border-[#1E2A5A] focus:ring-4 focus:ring-[#1E2A5A]/5 transition-all shadow-sm"
            >
              <option value="All Doctors">All Doctors</option>
              {doctors.map(doc => (
                <option key={doc.id} value={doc.name}>{doc.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3] pointer-events-none group-focus-within:text-[#1E2A5A]" />
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center gap-2 bg-white px-3 py-0 rounded-xl border border-[#E5E7EB] shadow-sm h-10">
            <CalendarIcon className="w-4 h-4 text-[#98A2B3]" />
            <div className="flex items-center gap-1">
              <input 
                type="date" 
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-transparent border-none text-[11px] font-bold text-[#1F2937] outline-none focus:ring-0 p-0 w-[95px] cursor-pointer"
              />
              <span className="text-[#E5E7EB]">-</span>
              <input 
                type="date" 
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-transparent border-none text-[11px] font-bold text-[#1F2937] outline-none focus:ring-0 p-0 w-[95px] cursor-pointer"
              />
            </div>
          </div>

          {/* Global Reset */}
          <button 
            onClick={() => { setSearchTerm(''); setStatusFilter('Active'); setDoctorFilter('All Doctors'); setDateRange({ start: '', end: '' }); }}
            className="flex items-center justify-center p-2.5 bg-white border border-[#E5E7EB] rounded-xl text-[#94A3B8] hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-all shadow-sm"
            title="Reset Filters"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Filter Chips (Billing Style) */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 -mb-1 mb-5">
          <div className="flex items-center gap-1.5 p-1 bg-white border border-[#E5E7EB] rounded-xl shadow-sm h-10 shrink-0">
            {[
              { id: 'All', label: 'All', color: 'bg-slate-400', count: statusCounts.Total },
              { id: 'Active', label: 'Active', color: 'bg-blue-500', count: statusCounts.Total - statusCounts.Delivered },
              { id: 'Pending', label: 'Pending', color: 'bg-orange-400', count: statusCounts.Pending },
              { id: 'In Progress', label: 'Processing', color: 'bg-indigo-500', count: statusCounts.Processing },
              { id: 'Finalized', label: 'Ready', color: 'bg-emerald-500', count: statusCounts.Final },
              { id: 'Delivered', label: 'Delivered', color: 'bg-sky-500', count: statusCounts.Delivered }
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
                <span className="text-[10px] font-black uppercase tracking-wider">{btn.label}</span>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md tabular-nums ${
                  statusFilter === btn.id ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#94A3B8]'
                }`}>
                  {btn.count}
                </span>
              </button>
            ))}
          </div>
        </div>


        {/* High-Density Table Container */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-[#F9FAFB]">
                <tr className="border-b border-[#E5E7EB]">
                  <th className="px-3.5 py-2.5 text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider">Report ID</th>
                  <th className="px-3.5 py-2.5 text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider">Patient Details</th>
                  <th className="px-3.5 py-2.5 text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider">Tests</th>
                  <th className="px-3.5 py-2.5 text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider">Doctor</th>
                  <th className="px-3.5 py-2.5 text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider">Report Date</th>
                  <th className="px-3.5 py-2.5 text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider text-center">Status</th>
                  <th className="px-3.5 py-2.5 text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider">Amount</th>
                  <th className="px-3.5 py-2.5 text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-20 text-center">
                      <Loader className="w-10 h-10 animate-spin text-[#1E2A5A] mx-auto mb-4" />
                      <p className="text-[14px] font-medium text-[#7B8794]">Fetching reports...</p>
                    </td>
                  </tr>
                ) : paginatedGroups.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-20 text-center">
                      <FileText className="w-12 h-12 text-[#E5E7EB] mx-auto mb-4" />
                      <p className="text-[16px] font-medium text-[#98A2B3]">No records matching your search</p>
                    </td>
                  </tr>
                ) : paginatedGroups.map((group) => {
                  const groupStatus = getGroupStatus(group.tests);
                  const statusColors = {
                    'Delivered': 'bg-[#ECFDF5] text-[#059669] border-[#D1FAE5]',
                    'Final': 'bg-[#ECFDF5] text-[#059669] border-[#D1FAE5]',
                    'In Progress': 'bg-[#FFFBEB] text-[#D97706] border-[#FEF3C7]',
                    'Pending': 'bg-[#F9FAFB] text-[#6B7280] border-[#F3F4F6]',
                    'Cancelled': 'bg-[#FEF2F2] text-[#DC2626] border-[#FEE2E2]'
                  };

                  return (
                    <tr key={group.groupKey} className="hover:bg-[#F9FAFB] transition-colors group border-b border-[#F3F4F6]">
                      <td className="px-3.5 py-2.5">
                        <div className={`inline-flex px-2 py-1 rounded-md text-[11px] font-bold transition-all ${group.balance > 0 ? 'bg-rose-600 text-white shadow-sm' : 'text-[#1E2A5A]'}`}>
                          {group.billId.replace('BKG', 'RPT')}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="text-[14px] font-semibold text-[#1F2937] leading-tight">{group.patientName}</div>
                        <div className="text-[11px] font-medium text-[#7B8794] mt-0.5">
                          {group.patientAge}Y • {group.patientGender} • {group.patientMobile || '9876543210'}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <div className="text-[11px] font-medium text-[#4B5563] leading-tight truncate max-w-[180px]">
                            {group.tests.slice(0, 2).map(t => t.testName).join(', ')}
                            {group.tests.length > 2 && '...'}
                          </div>
                          {group.tests.length > 2 && (
                            <div className="text-[9px] font-semibold text-[#1E2A5A] bg-[#1E2A5A]/5 px-1.5 py-0.5 rounded-full w-fit">
                              +{group.tests.length - 2} MORE
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="text-[12px] font-semibold text-[#374151] truncate max-w-[120px]">
                          {group.doctorName?.match(/^Dr\.?\s/i) ? group.doctorName : `Dr. ${group.doctorName}`}
                        </div>
                        <div className="text-[9px] font-semibold text-[#98A2B3] uppercase tracking-wider">Referred By</div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="text-[11px] font-semibold text-[#374151] tabular-nums">
                          {group.createdAt?.toDate ? group.createdAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '21 Apr, 2026'}
                        </div>
                        <div className="text-[10px] font-medium text-[#98A2B3] tabular-nums">
                          {group.createdAt?.toDate ? group.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:30 AM'}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider shadow-sm transition-all ${statusColors[groupStatus || 'Pending']}`}>
                           <div className="w-1 h-1 rounded-full bg-current opacity-80" />
                           {groupStatus === 'Final' || groupStatus === 'Delivered' ? 'Completed' : groupStatus}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="text-[13px] font-bold text-[#1F2937] tabular-nums">
                          ₹{(group.totalAmount || group.tests.reduce((acc, t) => acc + (parseFloat(t.price) || 0), 0)).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                           {(groupStatus === 'Final' || groupStatus === 'Delivered') && (
                             <>
                               <button 
                                 onClick={(e) => handlePreviewClick(e, group)}
                                 className="p-1.25 bg-[#F3F4F6] text-[#4B5563] rounded hover:bg-[#1E2A5A] hover:text-white transition-all active:scale-95"
                                 title="Print Report"
                               >
                                  <Printer className="w-3 h-3" />
                               </button>
                               <button 
                                 className="p-1.25 bg-[#F3F4F6] text-[#4B5563] rounded hover:bg-[#1E2A5A] hover:text-white transition-all active:scale-95"
                                 title="Download PDF"
                               >
                                  <Download className="w-3 h-3" />
                               </button>
                             </>
                           )}
                           
                           {(() => {
                              if (groupStatus === 'Final' || groupStatus === 'Delivered') return null;
                              
                              const allReceived = group.tests.every(t => t.received_at);
                              if (!allReceived) {
                                return (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGroupTimestampAction(group, 'received_at');
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 bg-[#14B8A6] text-white rounded hover:bg-[#0F766E] transition-all transform active:scale-95 text-[10px] font-semibold shadow-sm"
                                  >
                                    <FlaskConical className="w-3 h-3" />
                                    Sample
                                  </button>
                                );
                              }
                              
                              return (
                                <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   navigate(`/reports/${group.billId}/results`);
                                 }}
                                 className="flex items-center gap-1 px-2 py-1 bg-[#1E2A5A] text-white rounded hover:bg-[#1E2A5A]/90 transition-all transform active:scale-95 text-[10px] font-semibold shadow-sm"
                                >
                                 <Pencil className="w-3 h-3" />
                                 Enter Result
                               </button>
                             );
                           })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}

              </tbody>
            </table>
          </div>

          <div className="mt-auto border-t border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3 flex items-center justify-between">
            <div className="text-[13px] font-medium text-[#7B8794]">
              Showing {filteredGroups.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredGroups.length)} of {filteredGroups.length} reports
            </div>
            
            <div className="flex items-center gap-2">
               {Array.from({ length: Math.ceil(filteredGroups.length / itemsPerPage) }).map((_, i) => {
                 const p = i + 1;
                 const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
                 if (totalPages > 7) {
                   if (p > 1 && p < totalPages && (p < currentPage - 1 || p > currentPage + 1)) {
                     if (p === 2 || p === totalPages - 1) return <span key={p} className="text-slate-300 text-[10px]">...</span>;
                     return null;
                   }
                 }
                 return (
                   <button 
                     key={p} 
                     onClick={() => setCurrentPage(p)}
                     className={`w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-semibold transition-all ${currentPage === p ? 'bg-[#1E2A5A] text-white shadow-md' : 'text-[#7B8794] hover:bg-[#E5E7EB] hover:text-[#1F2937]'}`}
                   >
                     {p}
                   </button>
                 );
               })}
               
                  <select 
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-transparent text-[13px] font-semibold text-[#7B8794] outline-none cursor-pointer hover:text-[#1F2937]"
                  >
                    <option value={5}>5 per page</option>
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#98A2B3] pointer-events-none" />
            </div>
         </div>
      </div>

      {/* Report Preview */}
      {previewReport && (
        <ReportPreview 
          report={previewReport} 
          onClose={() => {
            setPreviewGroupId(null);
            // Re-sync pending payment state from storage when modal closes
            const saved = localStorage.getItem('pending_payment_booking');
            if (saved) {
              try {
                setPendingPaymentBooking(JSON.parse(saved));
              } catch (e) {
                setPendingPaymentBooking(null);
              }
            } else {
              setPendingPaymentBooking(null);
            }
          }} 
        />
      )}

      {/* Sticky Floating Red Button for skipped payments */}
      {pendingPaymentBooking && !paymentBooking && (
        <button 
          onClick={() => setPaymentBooking(pendingPaymentBooking)}
          className="fixed bottom-6 right-6 sm:bottom-10 sm:right-10 z-[150] bg-rose-600 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl shadow-2xl shadow-rose-600/40 hover:bg-rose-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-2 sm:gap-3 animate-bounce border border-rose-500/30"
        >
          <div className="w-7 h-7 sm:w-9 sm:h-9 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center backdrop-blur-md">
            <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="text-left">
            <div className="flex flex-col max-w-[120px] sm:max-w-[150px]">
              <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider leading-tight text-white/80 mb-0.5">Pending Payment</p>
              <p className="text-[12px] sm:text-[13px] font-bold text-white truncate">{pendingPaymentBooking.patientName}</p>
            </div>
            <p className="text-sm sm:text-lg font-bold tabular-nums">₹{pendingPaymentBooking.balance}</p>
          </div>
        </button>
      )}

      {/* Quick Payment Modal */}
      {paymentBooking && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1E2A5A]/90 backdrop-blur-md" onClick={() => setPaymentBooking(null)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-[#E5E7EB] animate-in zoom-in duration-300">
            <div className="bg-[#1E2A5A] p-10 text-white relative">
               <div className="absolute top-0 right-0 p-8">
                  <button onClick={() => setPaymentBooking(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                    <X className="w-6 h-6" />
                  </button>
               </div>
               <div className="flex items-center gap-5 mb-2">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight">Report Finalized</h3>
                    <p className="text-white/70 font-medium text-sm mt-1">Collect payment to complete</p>
                  </div>
               </div>
            </div>
            
            <div className="p-10 space-y-8">
               <div className="flex justify-between items-end bg-[#F9FAFB] p-6 rounded-3xl border border-[#E5E7EB]">
                  <div>
                    <p className="text-[12px] font-semibold text-[#98A2B3] uppercase tracking-wider mb-1">Total Due</p>
                    <p className="text-4xl font-bold text-[#1E2A5A] tabular-nums tracking-tight">₹{paymentBooking.balance}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-semibold text-[#98A2B3] uppercase tracking-wider mb-1">Patient</p>
                    <p className="text-[16px] font-bold text-[#1F2937]">{paymentBooking.patientName}</p>
                    <div className="mt-2 flex justify-end">
                      <span className="text-[11px] font-bold text-[#1E2A5A] bg-[#1E2A5A]/5 px-3 py-1 rounded-full border border-[#1E2A5A]/10">
                        ID: {paymentBooking.billId || paymentBooking.id}
                      </span>
                    </div>
                  </div>
               </div>

               <div className="space-y-6">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#7B8794] uppercase tracking-wider mb-3 ml-1">Receiving Amount (₹)</label>
                    <input 
                      type="number" 
                      className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl py-5 px-8 text-2xl font-bold text-[#1F2937] outline-none focus:ring-4 focus:ring-[#1E2A5A]/5 focus:bg-white transition-all tabular-nums"
                      autoFocus
                      placeholder="0.00"
                      id="quick-pay-amount"
                      defaultValue={paymentBooking.balance}
                    />
                  </div>

                  <div>
                     <label className="block text-[12px] font-semibold text-[#7B8794] uppercase tracking-wider mb-3 ml-1">Payment Method</label>
                     <div className="grid grid-cols-3 gap-3">
                        {['Cash', 'UPI', 'Card'].map(m => (
                          <button 
                            key={m}
                            onClick={() => {
                              document.querySelectorAll('.pay-mode-btn').forEach(b => {
                                b.classList.remove('bg-[#1E2A5A]', 'text-white', 'shadow-lg', 'shadow-[#1E2A5A]/20', 'border-transparent');
                                b.classList.add('bg-[#F9FAFB]', 'text-[#4B5563]', 'border-[#E5E7EB]');
                              });
                              const el = document.getElementById(`mode-${m}`);
                              el.classList.remove('bg-[#F9FAFB]', 'text-[#4B5563]', 'border-[#E5E7EB]');
                              el.classList.add('bg-[#1E2A5A]', 'text-white', 'shadow-lg', 'shadow-[#1E2A5A]/20', 'border-transparent');
                            }}
                            id={`mode-${m}`}
                            className={`pay-mode-btn py-4 rounded-xl text-[13px] font-bold border transition-all duration-300 ${m === 'Cash' ? 'bg-[#1E2A5A] text-white shadow-lg shadow-[#1E2A5A]/20 border-transparent' : 'bg-[#F9FAFB] text-[#4B5563] border-[#E5E7EB] hover:bg-[#F3F4F6]'}`}
                          >
                            {m}
                          </button>
                        ))}
                     </div>
                  </div>
               </div>

               <div className="flex flex-col gap-3 pt-4">
                  <button 
                    disabled={isQuickPaying}
                    onClick={async () => {
                      const amount = parseFloat(document.getElementById('quick-pay-amount').value);
                      const method = document.querySelector('.pay-mode-btn.text-white').innerText;
                      
                      if (!amount || amount <= 0) {
                        toast.error("Please enter a valid amount");
                        return;
                      }

                      setIsQuickPaying(true);
                      try {
                        const newPaid = (parseFloat(paymentBooking.paidAmount) || 0) + amount;
                        const newBalance = Math.max((parseFloat(paymentBooking.totalAmount) || 0) - newPaid, 0);
                        const paymentRecord = { amount: amount, method: method, date: new Date() };

                        const batch = writeBatch(db);
                        const newPayStatus = newBalance <= 0 ? 'Paid' : 'Unpaid';

                        batch.update(doc(db, 'bookings', paymentBooking.id), {
                          paidAmount: newPaid,
                          balance: newBalance,
                          paymentStatus: newPayStatus,
                          paymentHistory: paymentBooking.paymentHistory ? [...paymentBooking.paymentHistory, paymentRecord] : [paymentRecord],
                          updatedAt: serverTimestamp()
                        });

                        try {
                          const qSync = query(collection(db, 'reports'), 
                                              where('labId', '==', paymentBooking.labId), 
                                              where('bookingNo', '==', paymentBooking.bookingNo));
                          const sSnap = await getDocs(qSync);
                          sSnap.forEach(rDoc => {
                            batch.update(rDoc.ref, { paymentStatus: newPayStatus, updatedAt: serverTimestamp() });
                          });
                        } catch (e) {
                          console.warn("Reports paymentStatus sync failed:", e);
                        }

                        await batch.commit();
                        toast.success(`🎉 Success! Received ₹${amount} via ${method}`);
                        
                        if (newBalance <= 0) {
                          localStorage.removeItem('pending_payment_booking');
                          setPendingPaymentBooking(null);
                        } else {
                          const updated = { ...paymentBooking, balance: newBalance, paidAmount: newPaid };
                          localStorage.setItem('pending_payment_booking', JSON.stringify(updated));
                          setPendingPaymentBooking(updated);
                        }
                        setPaymentBooking(null);
                      } catch (err) {
                        toast.error("Payment failed: " + err.message);
                      } finally {
                        setIsQuickPaying(false);
                      }
                    }}
                    className="w-full py-5 bg-[#1E2A5A] text-white rounded-2xl text-[14px] font-bold uppercase tracking-widest shadow-xl shadow-[#1E2A5A]/20 hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isQuickPaying ? <Loader className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Confirm Payment</>}
                  </button>
                  <button 
                    onClick={() => setPaymentBooking(null)}
                    className="w-full py-3 text-[#98A2B3] text-[13px] font-semibold hover:text-[#1F2937] transition-all"
                  >
                    Skip For Now
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {reportToDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/80 backdrop-blur-3xl" onClick={() => setReportToDelete(null)}></div>
          <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-rose-50 px-8 py-6 border-b border-rose-100 flex items-center gap-4">
              <div className="p-3 bg-rose-100 rounded-2xl text-rose-600"><Trash2 className="w-8 h-8" /></div>
              <div>
                <h3 className="text-xl font-black text-rose-600 uppercase">Delete Report</h3>
                <p className="text-sm font-bold text-rose-400/80 uppercase tracking-widest mt-1">{reportToDelete.testName}</p>
              </div>
            </div>
            <div className="p-8">
              <p className="text-[14px] text-slate-500 font-medium leading-relaxed">
                Are you sure you want to permanently delete the <strong className="text-brand-dark uppercase">{reportToDelete.testName}</strong> report for <strong className="text-brand-dark uppercase">{reportToDelete.patientName}</strong>?
              </p>
              <div className="mt-8 flex gap-4 pt-6 border-t border-slate-100">
                <button onClick={() => setReportToDelete(null)}
                  className="flex-1 px-6 py-3 bg-slate-50 text-slate-500 font-black uppercase tracking-widest text-[12px] rounded-2xl hover:bg-slate-100 border border-slate-200">
                  Cancel
                </button>
                <button onClick={confirmDeleteReport}
                  className="flex-1 px-6 py-3 bg-rose-500 text-white font-black uppercase tracking-widest text-[12px] rounded-2xl hover:bg-rose-600 shadow-lg active:scale-95">
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
  );
};

export default Reports;
