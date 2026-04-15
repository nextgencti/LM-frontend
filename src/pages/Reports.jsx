import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp, deleteDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Search, Loader, FileText, Eye, AlertCircle, X, Activity, Trash2, Save, ChevronDown, ChevronUp, FlaskConical, CheckCircle2, Clock, Mail, Zap, Bell, IndianRupee, Pencil } from 'lucide-react';
import ReportPreview from '../components/ReportPreview';
import { toast } from 'react-toastify';

const Reports = () => {
  const { currentUser, userData, activeLabId, subscription, checkFeature } = useAuth();
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [previewGroupId, setPreviewGroupId] = useState(null);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All Status');
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

  // ─── Fetch reports from Firestore ─────────────────────────────────────────
  useEffect(() => {
    if (!activeLabId && userData?.role !== 'SuperAdmin') return;
    setLoading(true);
    let q = activeLabId
      ? query(collection(db, 'reports'), where('labId', '==', activeLabId))
      : query(collection(db, 'reports'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach((d) => items.push({ id: d.id, ...d.data() }));
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

  // --- PERSISTENCE: Restore pending payment from localStorage on mount ---
  useEffect(() => {
    const saved = localStorage.getItem('pending_payment_booking');
    if (saved) {
      try {
        setPendingPaymentBooking(JSON.parse(saved));
      } catch (e) { console.error("Error restoring pending payment:", e); }
    }
  }, []);

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
      if (!map[key]) {
        map[key] = {
          groupKey: key,
          billId: r.billId || key,
          patientName: r.patientName,
          patientAge: r.patientAge,
          patientGender: r.patientGender,
          patientId: r.patientId,
          labId: r.labId,
          tests: [],
          createdAt: r.createdAt,
        };
      }
      map[key].tests.push(r);
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
  }, [reports]);

  // ─── Filter groups ────────────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    return groupedReports.filter((g) => {
      const nameMatch = g.patientName?.toLowerCase().includes(searchTerm.toLowerCase());
      const billMatch = g.billId?.toLowerCase().includes(searchTerm.toLowerCase());
      const testMatch = g.tests.some(t => t.testName?.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!nameMatch && !billMatch && !testMatch) return false;
      if (statusFilter === 'All Status') return true;
      const allFinal = g.tests.every(t => t.status === 'Final');
      const anyProgress = g.tests.some(t => t.status === 'In Progress');
      const groupStatus = allFinal ? 'Final' : anyProgress ? 'In Progress' : 'Pending';
      return groupStatus === statusFilter;
    });
  }, [groupedReports, searchTerm, statusFilter]);

  // ─── Load results when a report is selected ───────────────────────────────
  useEffect(() => {
    if (!selectedReport) return;
    const loadResults = async () => {
      if (selectedReport.results && selectedReport.results.length > 0) {
        setEditedResults([...selectedReport.results]);
        return;
      }
      setFetchingMaster(true);
      try {
        let q;
        if (userData?.role === 'SuperAdmin') {
          q = query(collection(db, 'tests'), where('testName', '==', selectedReport.testName));
        } else {
          const labIdVal = isNaN(activeLabId) ? activeLabId : String(activeLabId);
          q = query(collection(db, 'tests'), where('testName', '==', selectedReport.testName), where('labId', 'in', [labIdVal, 'GLOBAL']));
        }
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docs = snap.docs.map(d => d.data());
          let testData = docs[0];
          if (userData?.role !== 'SuperAdmin') {
            const labIdVal = isNaN(activeLabId) ? activeLabId : String(activeLabId);
            testData = docs.find(d => d.labId === labIdVal) || docs.find(d => d.labId === 'GLOBAL') || docs[0];
          }
          const gender = selectedReport.patientGender || 'Any';
          const autoResults = [];
          (testData.groups || []).forEach(group => {
            (group.parameters || []).forEach(param => {
              let bestRange = '';
              if (param.rules?.length > 0) {
                const rule = param.rules.find(r => (r.gender === gender || r.gender === 'Any') && r.normalRange);
                bestRange = rule ? rule.normalRange : '';
              }
              autoResults.push({
                parameter: param.name || 'Undefined',
                value: '',
                unit: param.unit || '',
                range: bestRange,
                dataType: param.dataType || 'Quantitative',
                allowedOptions: param.allowedOptions || '',
                groupName: group.name || group.group_name || 'General',
              });
            });
          });
          setEditedResults(autoResults);
        } else {
          setEditedResults([]);
        }
      } catch (err) {
        console.error('Master Fallback Error:', err);
      } finally {
        setFetchingMaster(false);
      }
    };
    loadResults();
  }, [selectedReport]);

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
    setSaving(true);
    try {
      const allFilled = editedResults.filter(r => r.dataType !== 'Grid' && r.dataType !== 'Titer').every(r => r.value && r.value !== '');
      await updateDoc(doc(db, 'reports', selectedReport.id), {
        results: editedResults,
        status: allFilled ? 'In Progress' : 'In Progress',
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

        // --- NEW: Payment Check for Quick Popup ---
        try {
          const labId = activeLabId || userData?.labId;
          const bookingNo = group.tests?.[0]?.bookingNo;
          if (labId && bookingNo) {
            const bDocId = `${labId}_${bookingNo}`;
            const bSnap = await getDoc(doc(db, 'bookings', bDocId));
            if (bSnap.exists()) {
              const bData = bSnap.data();
              if (parseFloat(bData.balance || 0) > 0) {
                // Trigger the payment popup after a short delay for better UX
                setTimeout(() => {
                  setPaymentBooking({ id: bDocId, ...bData });
                  setPendingPaymentBooking({ id: bDocId, ...bData });
                }, 800);
              }
            }
          }
        } catch (e) {
          console.warn("Quick payment trigger failed:", e);
        }

        // --- AUTOMATION LOGIC (Notifications) ---
        const otherTests = group.tests.filter(t => t.id !== reportId);
        const allOthersFinal = otherTests.every(t => t.status === 'Final');

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

  const confirmDeleteReport = async () => {
    if (!reportToDelete) return;
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
  const getGroupStatus = (tests) => {
    if (tests.every(t => t.status === 'Final')) return 'Final';
    if (tests.some(t => t.status === 'In Progress')) return 'In Progress';
    return 'Pending';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Final': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'In Progress': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      default: return 'bg-amber-50 text-amber-600 border-amber-200';
    }
  };

  const getTestBadge = (status) => {
    switch (status) {
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow text-slate-800 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-brand-dark flex items-center tracking-tighter">
            <div className="bg-brand-light p-2.5 sm:p-3 rounded-2xl sm:rounded-[22px] mr-4 sm:mr-5 shadow-sm border border-brand-primary/10 transition-transform hover:rotate-6">
              <Activity className="w-7 h-7 sm:w-8 sm:h-8 text-brand-primary" />
            </div>
            Reports
          </h1>
          <p className="text-slate-500 font-bold mt-2 sm:ml-20 text-[13px] sm:text-[15px] leading-relaxed">Grouped by patient booking. Enter results per test.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
          {/* Automation Status Badge */}
          {labProfile?.reportSettings?.autoEmailNotify ? (
            <div className={`flex items-center gap-3 px-5 py-2.5 rounded-full border shadow-sm transition-all ${subscription?.plan?.toLowerCase() === 'pro' ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
              <Zap className={`w-4 h-4 ${subscription?.plan?.toLowerCase() === 'pro' ? 'text-teal-500 fill-teal-500' : 'text-amber-500'}`} />
              <div className="flex flex-col leading-none">
                <span className="text-[10px] font-black uppercase tracking-widest">Auto Notify: ON</span>
                {subscription?.plan?.toLowerCase() !== 'pro' && (
                  <span className="text-[8px] font-black uppercase text-amber-500/80 mt-1">Requires PRO Plan</span>
                )}
              </div>
            </div>
          ) : (
             <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-slate-50 border border-slate-100 text-slate-400 select-none shadow-sm opacity-60">
               <Bell className="w-4 h-4" />
               <span className="text-[10px] font-black uppercase tracking-widest leading-none">Auto Notify: OFF</span>
             </div>
          )}

          {/* Live Sync Badge */}
          <div className="flex items-center gap-3 bg-brand-light/20 px-6 py-3 rounded-full border border-brand-primary/10 select-none shadow-sm">
            <div className="w-2.5 h-2.5 bg-brand-primary rounded-full animate-pulse shadow-md shadow-brand-primary/50"></div>
            <span className="text-[11px] font-black text-brand-dark uppercase tracking-[0.2em] leading-none">Live Sync Active</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-5 sm:p-6 rounded-[32px] shadow-[0_20px_50px_rgb(0,0,0,0.02)] border border-slate-100 mb-10 flex flex-col md:flex-row gap-5 sm:gap-8 items-center">
        <div className="relative flex-grow w-full max-w-2xl group">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
          </div>
          <input type="text"
            className="block w-full pl-14 pr-6 py-4.5 bg-slate-50/50 border border-slate-100 rounded-[28px] focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 text-sm font-bold text-brand-dark outline-none transition-all placeholder:text-slate-300 shadow-inner"
            placeholder="Search by patient, bill ID, or test name..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-4 bg-white px-6 py-3 sm:py-4 rounded-[28px] border border-slate-100 shadow-sm w-full sm:w-auto justify-between sm:justify-start">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Filter</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent border-none py-1 text-[12px] font-black text-brand-dark focus:ring-0 outline-none cursor-pointer flex-grow text-right sm:text-left">
            <option value="All Status">All Status</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Final">Final</option>
          </select>
        </div>
      </div>

      {/* Grouped Reports List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-[40px] p-32 flex flex-col items-center justify-center border border-slate-100 shadow-sm">
            <Loader className="w-12 h-12 animate-spin text-brand-primary mb-4" />
            <p className="text-brand-dark/40 font-black uppercase text-[12px] tracking-[0.3em]">Loading reports...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="bg-white rounded-[40px] p-32 text-center border border-slate-100 shadow-sm">
            <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-xl font-black text-brand-dark/30 uppercase tracking-[0.3em]">No reports found.</p>
          </div>
        ) : filteredGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.groupKey);
          const groupStatus = getGroupStatus(group.tests);
          const allFinal = groupStatus === 'Final';
          const totalTests = group.tests.length;
          const finalCount = group.tests.filter(t => t.status === 'Final').length;

          return (
            <div key={group.groupKey}
              className={`bg-white rounded-[28px] border-y border-r transition-all duration-300 overflow-hidden ${
                isExpanded 
                  ? 'border-l-[6px] border-l-brand-primary border-brand-primary/20 bg-brand-light/5 shadow-[0_22px_70px_rgba(155,207,131,0.15)] scale-[1.005] z-10' 
                  : 'border-l-4 border-l-transparent border-slate-100 shadow-sm hover:shadow-md hover:scale-[1.002]'
              }`}>

              {/* Group Header Row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 px-6 sm:px-8 py-5 sm:py-6 cursor-pointer" onClick={() => toggleGroup(group.groupKey)}>
                
                {/* ID + Mobile Status Row */}
                <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                  <div className="text-[10px] sm:text-[11px] font-black text-brand-dark bg-brand-light/50 px-3 py-1.5 rounded-xl border border-brand-primary/10 uppercase tabular-nums whitespace-nowrap text-center shadow-sm">
                    {group.billId}
                  </div>
                  <div className={`sm:hidden px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border whitespace-nowrap ${getStatusBadge(groupStatus)}`}>
                    {groupStatus}
                  </div>
                </div>

                {/* Patient Info */}
                <div className="flex-grow min-w-0 w-full sm:w-auto">
                  <div className="text-[15px] sm:text-[16px] font-black text-brand-dark uppercase tracking-tight leading-none mb-1">{group.patientName}</div>
                  {group.patientAge && (
                    <div className="text-[11px] sm:text-[12px] text-slate-400 font-bold tracking-widest">{group.patientAge} Yrs / {group.patientGender || '--'}</div>
                  )}
                </div>

                {/* Test Pills */}
                <div className="flex flex-wrap gap-2 max-w-full sm:max-w-[300px] lg:max-w-[420px]">
                  {group.tests.map(t => (
                    <span key={t.id} className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wide shadow-sm ${getTestBadge(t.status)}`}>
                      {t.testName}
                    </span>
                  ))}
                </div>

                {/* Vertical Stack for Tracking on Small screens, horizontal on desk */}
                <div className="flex sm:flex-row flex-wrap items-center gap-3 sm:gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-50 mt-2 sm:mt-0">
                  {/* Progress Indicator */}
                  <div className="flex flex-col items-start sm:items-center gap-1">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{finalCount}/{totalTests} Done</div>
                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                      <div className={`h-full rounded-full transition-all ${allFinal ? 'bg-emerald-500' : 'bg-brand-primary'}`}
                        style={{ width: `${(finalCount / totalTests) * 100}%` }} />
                    </div>
                  </div>

                  {/* Desktop Status Badge */}
                  <div className={`hidden sm:flex px-4 py-1.5 rounded-2xl text-[11px] font-black uppercase border whitespace-nowrap ${getStatusBadge(groupStatus)}`}>
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${allFinal ? 'bg-emerald-500' : 'bg-current'}`}></span>
                      {groupStatus}
                    </span>
                  </div>

                  {/* Collective Actions */}
                  <div className="flex flex-grow sm:flex-grow-0 justify-end gap-2">
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const test0 = group.tests?.[0];
                          const bId = test0?.bookingId || (test0?.labId && test0?.bookingNo ? `${test0.labId}_${test0.bookingNo}` : null);
                          if (bId) navigate(`/bookings?edit=${bId}`); 
                        }}
                        className="p-2 sm:px-4 sm:py-2 bg-amber-50 text-amber-500 font-black text-[10px] uppercase rounded-xl border border-amber-100 hover:bg-amber-100 transition-all flex items-center justify-center gap-1.5"
                        title="Edit Booking"
                      >
                        <Pencil className="w-4 h-4" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      {!group.tests.some(t => t.collected_at) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleGroupTimestampAction(group, 'collected_at'); }}
                          className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-amber-500 text-white text-[9px] sm:text-[10px] font-black uppercase rounded-xl shadow-lg shadow-amber-500/10 hover:bg-amber-600 transition-all active:scale-95 whitespace-nowrap border-b-2 sm:border-b-4 border-amber-700"
                        >
                          <FlaskConical className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="sm:hidden">Collect</span> <span className="hidden sm:inline">Collect Sample</span>
                        </button>
                      )}
                      {group.tests.some(t => t.collected_at) && !group.tests.every(t => t.received_at) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleGroupTimestampAction(group, 'received_at'); }}
                          className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-brand-secondary text-white text-[9px] sm:text-[10px] font-black uppercase rounded-xl shadow-lg shadow-brand-secondary/10 hover:bg-brand-secondary/80 transition-all active:scale-95 whitespace-nowrap border-b-2 sm:border-b-4 border-brand-secondary"
                        >
                          <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="sm:hidden">Receive</span> <span className="hidden sm:inline">Receive in Lab</span>
                        </button>
                      )}

                    {/* Preview/Email */}
                    {allFinal && (
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setPreviewGroupId(group.groupKey); }}
                          className="p-2 sm:px-4 sm:py-2 bg-brand-primary text-white font-black text-[10px] uppercase rounded-xl shadow-lg shadow-brand-primary/10 hover:scale-105 active:scale-95">
                          <Eye className="w-4 h-4 sm:mr-1 inline" /> <span className="hidden sm:inline">Preview</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleSendGroupEmail(group); }} disabled={emailSending === group.groupKey}
                          className="p-2 sm:px-4 sm:py-2 bg-brand-dark text-white font-black text-[10px] uppercase rounded-xl shadow-lg hover:scale-105 active:scale-95">
                          {emailSending === group.groupKey ? <Loader className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4 sm:mr-1 inline" />} <span className="hidden sm:inline">Email</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Toggle */}
                  <button onClick={(e) => { e.stopPropagation(); toggleGroup(group.groupKey); }}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-brand-light border border-slate-100 transition-all text-slate-400">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded: Individual Tests Table */}
              {isExpanded && (
                <div className="border-t border-slate-100 divide-y divide-slate-50 animate-in slide-in-from-top-2 duration-200">
                  {group.tests.map((test) => (
                    <div key={test.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-6 sm:px-8 py-5 sm:py-4 hover:bg-slate-50/50 transition-all border-b border-slate-50 last:border-0 relative">
                      
                      {/* Test Flask icon */}
                      <div className={`p-2 rounded-xl ${test.status === 'Final' ? 'bg-emerald-100 text-emerald-600' : test.status === 'In Progress' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        <FlaskConical className="w-4 h-4" />
                      </div>

                      {/* Test Name */}
                      <div className="flex-grow">
                        <div className="text-[14px] font-black text-brand-dark uppercase tracking-tight">{test.testName}</div>
                        <div className={`text-[11px] font-bold mt-0.5 ${test.status === 'Final' ? 'text-emerald-600' : test.status === 'In Progress' ? 'text-indigo-600' : 'text-amber-500'}`}>
                          {test.status || 'Pending'}
                        </div>
                      </div>

                      {/* Tracking Steps - Scrollable on mobile */}
                      <div className="flex overflow-x-auto pb-2 sm:pb-0 gap-1.5 text-[8px] sm:text-[9px] uppercase font-black tracking-wider w-full sm:w-auto no-scrollbar">
                        {['Reg','Coll','Rec','Fin'].map((st, i) => {
                          const isActive = [test.registered_at, test.collected_at, test.received_at, test.reported_at][i];
                          const labels = ['Registered','Collected','Received','Finalized'];
                          return (
                            <div key={st} title={labels[i]} className={`px-2 py-1.5 rounded-lg border text-center transition-all min-w-[50px] sm:min-w-[60px] ${isActive ? 'bg-brand-light border-brand-primary/20 text-brand-dark' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                              {st}
                            </div>
                          );
                        })}
                      </div>

                      {/* Actions - Full width on mobile */}
                      <div className="flex gap-2 items-center w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                        {test.received_at && (
                          <div className="flex gap-2 flex-grow sm:flex-grow-0">
                            {test.status !== 'Final' && (
                              <button onClick={() => { setSelectedReport(test); setEditedResults([]); }}
                                className="flex-1 sm:flex-none bg-brand-dark text-[10px] sm:text-[11px] font-black text-white px-4 py-2.5 sm:py-1.5 rounded-xl shadow-lg shadow-brand-dark/10 hover:bg-brand-secondary transition-all uppercase tracking-widest active:scale-95 leading-none">
                                Results
                              </button>
                            )}

                            {test.status === 'In Progress' && !test.reported_at && (
                              <button onClick={() => handleFinalizeReport(test.id, group)}
                                className="flex-1 sm:flex-none bg-brand-primary text-[10px] sm:text-[11px] font-black text-white px-4 py-2.5 sm:py-1.5 rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-105 transition-all uppercase tracking-widest active:scale-95 leading-none">
                                Finalize
                              </button>
                            )}
                          </div>
                        )}

                        <button onClick={() => setReportToDelete(test)}
                          className="p-2.5 sm:p-2 bg-rose-50 text-rose-400 rounded-xl border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Results Entry Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/80 backdrop-blur-3xl" onClick={() => setSelectedReport(null)}></div>
          <div className="relative bg-white w-full max-w-7xl rounded-[48px] shadow-2xl overflow-hidden border border-white/20 flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300">
            
            <div className="bg-brand-dark px-6 sm:px-12 py-6 sm:py-8 flex justify-between items-center select-none shadow-xl z-20">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="bg-brand-primary p-2 sm:p-3 rounded-2xl sm:rounded-[24px] shadow-lg shadow-brand-primary/20 rotate-6">
                  <FlaskConical className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tighter uppercase leading-none">Record Data</h2>
                  <p className="text-[10px] sm:text-[12px] font-black text-brand-primary uppercase tracking-[0.4em] mt-1 sm:mt-2">{selectedReport.testName}</p>
                </div>
              </div>
              <button onClick={() => setSelectedReport(null)}
                className="p-2 sm:p-3 bg-white/5 hover:bg-brand-light hover:text-brand-dark rounded-2xl transition-all text-white/50 border border-white/10">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="px-12 py-6 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-8">
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">Patient</span>
                <span className="text-brand-dark font-black text-lg tracking-tight uppercase">{selectedReport.patientName}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">Age / Gender</span>
                <span className="text-slate-600 font-bold uppercase tracking-widest">{selectedReport.patientAge || '??'} Y / {selectedReport.patientGender || '--'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">Bill ID</span>
                <span className="text-brand-secondary font-black tracking-widest">{selectedReport.billId}</span>
              </div>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-grow bg-white p-0">
              {fetchingMaster ? (
                <div className="flex items-center justify-center p-24">
                  <Loader className="w-10 h-10 animate-spin text-brand-primary" />
                </div>
              ) : (
                <table className="min-w-full border-collapse">
                  <thead className="bg-[#F8FAFC] sticky top-0 z-10 border-b border-brand-primary/10">
                    <tr className="text-[12px] font-black text-brand-dark uppercase tracking-[0.3em] text-center">
                      <th className="px-6 py-4 w-16 border-r border-brand-primary/5">#</th>
                      <th className="px-6 py-4 text-left border-r border-brand-primary/5">Parameter</th>
                      <th className="px-6 py-4 border-r border-brand-primary/5">Value</th>
                      <th className="px-6 py-4 border-r border-brand-primary/5">Unit</th>
                      <th className="px-6 py-4">Reference Range</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {editedResults.length === 0 ? (
                      <tr><td colSpan="5" className="px-12 py-24 text-center">
                        <AlertCircle className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                        <p className="text-xl font-black text-brand-dark/20 uppercase tracking-widest">No parameters found</p>
                      </td></tr>
                    ) : editedResults.map((res, idx) => (
                      <tr key={idx} className={`transition-all border-b border-slate-50 ${idx === focusedIndex ? 'bg-brand-light/5' : 'hover:bg-slate-50/50 even:bg-slate-50/20'}`}>
                        <td className={`px-4 py-3 text-center text-xs font-black w-14 border-r border-slate-50 ${idx === focusedIndex ? 'text-brand-primary' : 'text-slate-300'}`}>{idx + 1}</td>
                        <td className="px-6 py-3 border-r border-slate-50 min-w-[180px] max-w-[250px]">
                          <div className={`text-sm tracking-tight uppercase ${idx === focusedIndex ? 'text-brand-dark font-black' : 'text-slate-500 font-bold'}`}>
                            {res.parameter}
                          </div>
                          {res.groupName && res.groupName !== 'General' && (
                            <div className="text-[10px] text-slate-400 font-bold uppercase">{res.groupName}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-50 bg-slate-50/20 min-w-[200px]">
                          {renderResultInput(res, idx)}
                        </td>
                        <td className="px-6 py-3 text-center border-r border-slate-50">
                          <div className="text-[12px] font-black text-brand-secondary bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 uppercase tabular-nums">{res.unit || '---'}</div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="text-[12px] font-black text-slate-700 bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-200 inline-block tabular-nums tracking-tighter">{res.range || 'N/A'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end items-center gap-4">
              <button onClick={() => setSelectedReport(null)}
                className="px-8 py-3.5 rounded-[22px] bg-white text-slate-400 text-[12px] font-black uppercase tracking-widest hover:text-brand-dark transition-all border border-slate-200 shadow-sm">
                Cancel
              </button>
              <button onClick={handleSaveResults} disabled={saving}
                className="px-14 py-3.5 rounded-[22px] bg-brand-primary text-white text-[12px] font-black uppercase tracking-[0.3em] hover:shadow-2xl hover:shadow-brand-primary/30 transition-all flex items-center disabled:opacity-50 active:scale-95 gap-3">
                {saving ? <><Loader className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Results</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Preview */}
      {previewReport && (
        <ReportPreview report={previewReport} onClose={() => setPreviewGroupId(null)} />
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
            <p className="text-[7px] sm:text-[9px] font-black uppercase tracking-[0.1em] leading-none opacity-80 mb-0.5 sm:mb-1 whitespace-nowrap">Pending: {pendingPaymentBooking.patientName}</p>
            <p className="text-sm sm:text-lg font-black tabular-nums tracking-tighter">₹{pendingPaymentBooking.balance}</p>
          </div>
        </button>
      )}

      {/* Quick Payment Modal */}
      {paymentBooking && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/90 backdrop-blur-2xl" onClick={() => setPaymentBooking(null)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[48px] shadow-3xl overflow-hidden border border-white/20 animate-in zoom-in duration-300">
            <div className="bg-brand-primary p-10 text-white relative">
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
                    <h3 className="text-2xl font-black uppercase tracking-tighter">Report Finalized!</h3>
                    <p className="text-white/60 font-bold text-xs uppercase tracking-widest mt-1">Direct Payment Collection</p>
                  </div>
               </div>
            </div>
            
            <div className="p-10 space-y-8">
               <div className="flex justify-between items-end bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Balance Due</p>
                    <p className="text-4xl font-black text-brand-dark tabular-nums tracking-tighter">₹{paymentBooking.balance}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Patient</p>
                    <p className="text-sm font-black text-brand-dark uppercase tracking-tight">{paymentBooking.patientName}</p>
                  </div>
               </div>

               <div className="space-y-6">
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Receiving Amount (₹)</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-8 text-2xl font-black text-brand-dark outline-none focus:ring-8 focus:ring-brand-primary/5 focus:bg-white transition-all tabular-nums"
                      autoFocus
                      placeholder="0.00"
                      id="quick-pay-amount"
                      defaultValue={paymentBooking.balance}
                    />
                  </div>

                  <div>
                     <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Payment Method</label>
                     <div className="grid grid-cols-3 gap-3">
                        {['Cash', 'UPI', 'Card'].map(m => (
                          <button 
                            key={m}
                            onClick={() => {
                              // Direct DOM manipulation fallback for speed + State sync
                              document.querySelectorAll('.pay-mode-btn').forEach(b => {
                                b.classList.remove('bg-brand-dark', 'text-white', 'shadow-lg', 'border-transparent');
                                b.classList.add('bg-slate-50', 'text-slate-600', 'border-slate-100');
                              });
                              const el = document.getElementById(`mode-${m}`);
                              el.classList.remove('bg-slate-50', 'text-slate-600', 'border-slate-100');
                              el.classList.add('bg-brand-dark', 'text-white', 'shadow-lg', 'border-transparent');
                            }}
                            id={`mode-${m}`}
                            className={`pay-mode-btn py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-all duration-300 ${m === 'Cash' ? 'bg-brand-dark text-white shadow-lg border-transparent' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'}`}
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
                      const method = document.querySelector('.pay-mode-btn.bg-brand-dark').innerText;
                      
                      if (!amount || amount <= 0) {
                        toast.error("Please enter a valid amount");
                        return;
                      }

                      setIsQuickPaying(true);
                      try {
                        const newPaid = (parseFloat(paymentBooking.paidAmount) || 0) + amount;
                        const newBalance = Math.max((parseFloat(paymentBooking.totalAmount) || 0) - newPaid, 0);
                        
                        const paymentRecord = {
                          amount: amount,
                          method: method,
                          date: new Date()
                        };

                        await updateDoc(doc(db, 'bookings', paymentBooking.id), {
                          paidAmount: newPaid,
                          balance: newBalance,
                          paymentStatus: newBalance <= 0 ? 'Paid' : 'Unpaid',
                          paymentHistory: paymentBooking.paymentHistory ? [...paymentBooking.paymentHistory, paymentRecord] : [paymentRecord],
                          updatedAt: serverTimestamp()
                        });
                        
                        toast.success(`🎉 Success! Received ₹${amount} via ${method}`);
                        setPaymentBooking(null);
                        setPendingPaymentBooking(null);
                      } catch (err) {
                        toast.error("Payment failed: " + err.message);
                      } finally {
                        setIsQuickPaying(false);
                      }
                    }}
                    className="w-full py-5 bg-brand-primary text-white rounded-[24px] text-[12px] font-black uppercase tracking-[0.3em] shadow-xl shadow-brand-primary/20 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isQuickPaying ? <Loader className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Confirm Payment</>}
                  </button>
                  <button 
                    onClick={() => setPaymentBooking(null)}
                    className="w-full py-3 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-brand-dark transition-all"
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
  );
};

export default Reports;
