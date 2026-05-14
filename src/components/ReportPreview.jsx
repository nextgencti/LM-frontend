import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, limit, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Loader, X, Mail, IndianRupee, Save, Activity, User, ChevronLeft, Phone, Calendar, UserCheck, Fingerprint, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';
import ReportPdfViewer from './ReportPdfViewer';

const ReportPreview = ({ report, onClose, isPublicView = false, publicData = null }) => {
  const { currentUser, checkFeature } = useAuth();
  const [loading, setLoading] = useState(true);
  const [emailSending, setEmailSending] = useState(false);
  const [reportData, setReportData] = useState(report);
  const [labProfile, setLabProfile] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [doctorData, setDoctorData] = useState(null);
  const [bookingData, setBookingData] = useState(null);
  const [showQuickPay, setShowQuickPay] = useState(false);
  const [isQuickPaying, setIsQuickPaying] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [quickDiscount, setQuickDiscount] = useState(0);

  useEffect(() => {
    if (report) {
      setReportData(report); 
      fetchReportContext();
    }
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, [report]);

  const fetchMasterMetadata = async (reportDoc) => {
    try {
      let masterDoc = null;
      if (reportDoc.testId) {
        const tDoc = await getDoc(doc(db, 'tests', reportDoc.testId));
        if (tDoc.exists()) masterDoc = tDoc.data();
      }
      if (!masterDoc && reportDoc.testName) {
        const baseName = String(reportDoc.testName).split(',')[0].trim();
        const labIdVal = reportDoc.labId || 'GLOBAL';
        const searchIds = Array.from(new Set([labIdVal, 'GLOBAL']));
        const tQ = query(collection(db, 'tests'), 
          where('testName', '==', baseName), 
          where('labId', 'in', searchIds),
          limit(5)
        );
        const tSnap = await getDocs(tQ);
        if (!tSnap.empty) {
          const docs = tSnap.docs.map(d => d.data());
          masterDoc = docs.find(d => d.labId === labIdVal && d.category && d.category !== 'General') 
                    || docs.find(d => d.labId === 'GLOBAL') 
                    || docs[0];
        }
      }
      if (masterDoc) {
        return {
          category: (masterDoc.category && masterDoc.category !== 'General') ? masterDoc.category : 'General',
          sampleType: (masterDoc.sampleType && masterDoc.sampleType !== 'N/A') ? masterDoc.sampleType : 'N/A'
        };
      }
    } catch (e) { console.warn("Metadata lookup failed", e.message); }
    return null;
  };

  const fetchReportContext = async () => {
    if (isPublicView && publicData) {
      setReportData(publicData.reportData);
      setLabProfile(publicData.labProfile || null);
      setPatientData(publicData.patientData || null);
      setDoctorData(publicData.doctorData || null);
      setBookingData(publicData.bookingData || null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let profileToUse = { 
      labName: 'Diagnostic Laboratory',
      address: 'Independent Testing Facility',
      phone: 'Not Provided',
      email: 'info@lab.com'
    };

    try {
      // 1. Fetch Lab Profile
      if (report.labId) {
        const labDoc = await getDoc(doc(db, 'labs', report.labId));
        if (labDoc.exists()) profileToUse = { ...profileToUse, ...labDoc.data() };
      }
      setLabProfile(profileToUse);

      // 2. Fetch Patient Data
      const pId = report.patientId || (report.labId && report.patient_id ? String(report.labId) + '_' + String(report.patient_id) : report.patient_id);
      let pData = null;
      if (pId) {
        const pDoc = await getDoc(doc(db, 'patients', String(pId)));
        if (pDoc.exists()) {
          pData = { id: pDoc.id, ...pDoc.data() };
          setPatientData(pData);
        }
      }

      // 3. Fetch Doctor & Booking Metadata
      const resId = report.bookingId || (report.labId && report.bookingNo ? `${report.labId}_${report.bookingNo}` : null);
      let bData = null;
      if (resId) {
        const bDoc = await getDoc(doc(db, 'bookings', resId));
        if (bDoc.exists()) {
          bData = { id: bDoc.id, ...bDoc.data() };
          setBookingData(bData);
          if (bData.doctorId) {
            const dDoc = await getDoc(doc(db, 'doctors', bData.doctorId));
            if (dDoc.exists()) setDoctorData(dDoc.data());
          }
        }
      }

      // 4. Fetch & Process Reports (with Re-hydration)
      let reportsToProcess = [];
      if (report.billId) {
        const q = query(collection(db, 'reports'), where('billId', '==', report.billId), where('labId', '==', report.labId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          reportsToProcess = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        }
      } else if (report.id) {
        const rDoc = await getDoc(doc(db, 'reports', report.id));
        if (rDoc.exists()) reportsToProcess = [{ id: rDoc.id, ...rDoc.data() }];
      }

      // Re-hydrate logic for all fetched reports
      const processedReports = await Promise.all(reportsToProcess.map(async (r) => {
        let tData = null;
        const currentLabId = String(report.labId || r.labId);
        
        // 1. Try direct ID match if it exists
        if (r.testId) {
          try {
            const tDoc = await getDoc(doc(db, 'tests', r.testId));
            if (tDoc.exists()) tData = tDoc.data();
          } catch (e) { console.warn("ID lookup failed", e); }
        }
        
        // 2. Targeted Search by Name (to avoid permission errors)
        if (!tData && r.testName) {
          try {
            // Check Lab-specific first
            const qLab = query(collection(db, 'tests'), where('labId', '==', currentLabId), where('testName', '==', r.testName), limit(1));
            const snapLab = await getDocs(qLab);
            if (!snapLab.empty) {
              tData = snapLab.docs[0].data();
            } else {
              // Check Global catalog second
              const qGlobal = query(collection(db, 'tests'), where('labId', '==', 'GLOBAL'), where('testName', '==', r.testName), limit(1));
              const snapGlobal = await getDocs(qGlobal);
              if (!snapGlobal.empty) tData = snapGlobal.docs[0].data();
            }
          } catch (e) { console.warn("Name lookup failed", e); }
        }

        if (tData) {
          // Auto-fill category/sampleType
          const masterCat = tData.category || tData.testCategory;
          const masterSam = tData.sampleType;
          if (!r.category || r.category === 'General') r.category = masterCat || r.category;
          if (!r.sampleType || r.sampleType === 'N/A') r.sampleType = masterSam || r.sampleType;

          // Map parameters
          const paramMap = {};
          if (Array.isArray(tData.groups)) {
            tData.groups.forEach(g => {
              const gName = (g.group_name || g.groupName || g.name || 'General').trim();
              if (Array.isArray(g.parameters)) {
                g.parameters.forEach(p => {
                  const pid = (p.code || '').trim().toUpperCase();
                  const pname = (p.name || '').trim().toUpperCase();
                  
                  let rangeVal = '---';
                  if (Array.isArray(p.rules)) {
                    const rule = p.rules.find(rule => {
                      if (rule.gender !== 'Any' && rule.gender !== 'Both' && pData && rule.gender !== pData.gender) return false;
                      if (pData && pData.age) {
                        if (pData.age < rule.ageMin || pData.age > rule.ageMax) return false;
                      }
                      return true;
                    });
                    if (rule) rangeVal = rule.normalRange;
                  }
                  
                  const meta = { group: gName, range: rangeVal };
                  if (pid) paramMap[pid] = meta;
                  if (pname) paramMap[pname] = meta;
                });
              }
            });
          }

          if (Array.isArray(r.results)) {
            r.results = r.results.map(res => {
              const rId = (res.parameterId || '').trim().toUpperCase();
              const rName = (res.name || res.parameter || '').trim().toUpperCase();
              const meta = paramMap[rId] || paramMap[rName] || { group: 'General', range: '---' };
              
              return {
                ...res,
                parameter: res.parameter || res.name,
                groupName: (res.groupName && res.groupName !== 'General') ? res.groupName : meta.group,
                range: (res.range && res.range !== '-' && res.range !== '---') ? res.range : meta.range
              };
            });
          }
        }
        return r;
      }));

      if (processedReports.length > 0) {
        const mergedResults = processedReports.flatMap(r => 
          (r.results || []).map(res => ({ 
            ...res, 
            _testName: r.testName, 
            _category: r.category || 'General', 
            _sampleType: r.sampleType || 'N/A' 
          }))
        );
        setReportData({ 
          ...processedReports[0], 
          testName: processedReports.map(r => r.testName).join(', '), 
          results: mergedResults 
        });
      }

    } catch (err) { 
      console.error("Report context fetch error:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  const qrUrl = React.useMemo(() => {
    // Use high-entropy viewToken if available, otherwise fallback to direct ID for legacy support
    const token = reportData.viewToken || report.id || reportData.id;
    return `${window.location.origin}/v/${token}`;
  }, [reportData.viewToken, report.id, reportData.id]);

  useEffect(() => {
    if (!loading && reportData && labProfile && patientData) {
      if (pdfData || pdfLoading) return;
      const fetchPdf = async () => {
        try {
          setPdfLoading(true);
          let token = currentUser ? await currentUser.getIdToken() : null;
          const endpoint = isPublicView && !currentUser ? `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/api/public/generate-report` : `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/api/generate-report`;
          const res = await axios.post(endpoint, { reportData, labProfile, patientData, doctorData, bookingData, qrUrl }, { headers: token ? { Authorization: `Bearer ${token}` } : {}, responseType: 'blob' });
          setPdfData(res.data);
        } catch (e) {
          console.error('[PDF_FETCH_ERROR]:', e);
          if (e.response?.status !== 401) toast.error('Failed to render PDF preview.');
        } finally { setPdfLoading(false); }
      };
      fetchPdf();
    }
  }, [loading, reportData, labProfile, patientData, isPublicView, qrUrl, currentUser, doctorData]);

  const handleMarkDelivered = async () => {
    // Only if currently not delivered and is finalized
    if (!bookingData || bookingData.status === 'Delivered' || isPublicView) return;
    
    try {
      const batch = writeBatch(db);
      
      // Update booking
      batch.update(doc(db, 'bookings', bookingData.id), { 
        status: 'Delivered', 
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp() 
      });
      
      // Update all reports for this booking to Delivered
      const q = query(
        collection(db, 'reports'), 
        where('labId', '==', bookingData.labId), 
        where('bookingNo', '==', bookingData.bookingNo)
      );
      const snap = await getDocs(q);
      snap.forEach(rDoc => {
        if (rDoc.data().status !== 'Delivered') {
          batch.update(rDoc.ref, { 
            status: 'Delivered', 
            deliveredAt: serverTimestamp(),
            updatedAt: serverTimestamp() 
          });
        }
      });
      
      await batch.commit();
      setBookingData(prev => ({ ...prev, status: 'Delivered' }));
    } catch (err) {
      console.error("Error updating status to Delivered:", err);
    }
  };

  const handleEmailReport = async () => {
    if (!checkFeature('Email Support')) { toast.info('🚀 Upgrade to enable Email Support.'); return; }
    if (emailSending || !pdfData) return;
    const email = patientData?.email || report?.patientEmail;
    if (!email) { toast.warn('No email found for this patient.'); return; }
    setEmailSending(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(pdfData);
      reader.onloadend = async () => {
        try {
          const base64data = reader.result.split(',')[1];
          const token = await currentUser.getIdToken();
          const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/api/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
              to: email, 
              patientName: reportData.patientName, 
              labName: labProfile?.labName || 'Diagnostic Lab', 
              bookingId: reportData.billId || reportData.id, 
              pdfBase64: base64data 
            })
          });
          if (!res.ok) throw new Error('Email failed');
          toast.success('Professional PDF emailed successfully!');
          handleMarkDelivered();
        } catch (error) {
          toast.error('Email failed: ' + error.message);
        } finally {
          setEmailSending(false);
        }
      };
    } catch (error) { 
      toast.error('Initialization failed: ' + error.message);
      setEmailSending(false);
    }
  };

  if (!report) return null;

  return (
    <div className={`fixed inset-0 z-[300] bg-gray-900/95 ${isPublicView ? '' : 'backdrop-blur-xl p-2 sm:p-6'} flex flex-col print:static print:bg-transparent print:p-0`}>
      {(loading || pdfLoading) && !pdfData && (
        <div className="absolute inset-0 z-[310] bg-gray-900/95 backdrop-blur-xl flex flex-col items-center justify-center">
          <Loader className="w-12 h-12 animate-spin mb-4 text-emerald-500" />
          <p className="font-bold tracking-widest uppercase text-[10px] text-white">Fetching Diagnostic Data...</p>
        </div>
      )}

      {pdfData && (
        <div className={`w-full h-full ${isPublicView ? 'max-w-full' : 'max-w-[1600px]'} mx-auto flex flex-row ${!isPublicView ? 'gap-6' : ''} relative animate-in fade-in zoom-in duration-500 items-stretch`}>
          {/* Clinical & Financial Context Sidebar - SEPARATE CARD */}
          {!isPublicView && (
            <div className="w-[350px] hidden lg:flex flex-col bg-blue-50 rounded-[5px] shadow-3xl overflow-y-auto no-scrollbar border border-blue-100">
            {/* Top Navigation / Back Button - HIGHLIGHTED */}
            <div className="p-3 bg-white border-b border-slate-100 flex items-center gap-4">
              <button onClick={onClose} className="group flex items-center gap-2 bg-slate-900 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-[5px] transition-all duration-300 shadow-lg shadow-slate-200 active:scale-95">
                <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                <span className="text-[9px] font-black uppercase tracking-widest">Back</span>
              </button>
              <div className="h-3 w-[1px] bg-slate-200 mx-1"></div>
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Patient Explorer</h3>
            </div>

            {/* Header / Patient Summary */}
            <div className="p-3 bg-white border-b border-blue-100/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-[5px] flex items-center justify-center border border-white shadow-sm shrink-0">
                  <User className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-[18px] font-black text-slate-900 tracking-tight uppercase leading-none">{patientData?.name || reportData.patientName}</h2>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <p className="text-emerald-600 font-bold text-[8px] uppercase tracking-widest">Active Profile</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 space-y-3">
              {/* Patient Details Grid - NEW ICON STYLE */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-2.5 rounded-[12px] border border-blue-100 shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Age / Sex</p>
                    <p className="text-[11px] font-black text-slate-700">{(patientData?.age || reportData.patientAge) || '--'} / {(patientData?.gender || reportData.patientGender) || '--'}</p>
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-[12px] border border-purple-100 shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                    <Fingerprint className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Patient ID</p>
                    <p className="text-[11px] font-black text-slate-700 truncate">{patientData?.patientId || 'NEW'}</p>
                  </div>
                </div>
                <div className="col-span-2 bg-white p-2.5 rounded-[12px] border border-indigo-100 shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Primary Contact</p>
                    <p className="text-[11px] font-black text-slate-700">{patientData?.phone || 'Not Provided'}</p>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em]">Billing</h3>
                  <span className={`text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm ${bookingData?.paymentStatus === 'Paid' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {bookingData?.paymentStatus || 'Unpaid'}
                  </span>
                </div>

                <div className="bg-white rounded-[5px] p-2.5 border border-blue-100 shadow-sm space-y-1.5">
                  <div className="flex justify-between items-center pb-1 border-b border-blue-50">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
                    <span className="text-[10px] font-black text-slate-800">₹{bookingData?.totalAmount || 0}</span>
                  </div>
                  <div className="flex justify-between items-center pb-1 border-b border-slate-50">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Settled</span>
                    <span className="text-[10px] font-black text-emerald-600">₹{bookingData?.paidAmount || 0}</span>
                  </div>
                  <div className="flex justify-between items-center pt-0.5">
                    <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Balance</span>
                    <span className="text-[15px] font-black text-rose-600 tracking-tighter">₹{bookingData?.balance || 0}</span>
                  </div>
                </div>

                {parseFloat(bookingData?.balance || 0) > 0 && (
                  <button onClick={() => setShowQuickPay(true)} className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-[5px] text-[9px] font-black uppercase tracking-[0.2em] transition-all shadow-lg flex items-center justify-center gap-2">
                    <IndianRupee className="w-3 h-3" /> Collect Payment
                  </button>
                )}
              </div>

              {/* Clinical Metadata - CARD STYLE */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-2 rounded-[12px] border border-emerald-100 shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Referred By</p>
                    <p className="text-[10px] font-black text-slate-700 uppercase italic truncate">{doctorData?.name || bookingData?.doctorName || 'Self'}</p>
                  </div>
                </div>
                <div className="bg-white p-2 rounded-[12px] border border-blue-100 shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Reg. Date</p>
                    <p className="text-[10px] font-black text-slate-700 truncate">{bookingData?.createdAt?.toDate ? bookingData.createdAt.toDate().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit' }) : '---'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Brand - REFINED */}
            <div className="mt-auto m-3 p-3 bg-white rounded-[12px] border border-blue-100 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center shadow-md shrink-0">
                <Activity className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-900 tracking-widest uppercase leading-none mb-1">{labProfile?.labName || 'Laboratory'}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Diagnostic Excellence</p>
              </div>
            </div>
            </div>
          )}


          {/* PDF Viewer Content Area - SEPARATE CARD */}
          <div className={`flex-1 flex flex-col bg-white ${isPublicView ? '' : 'rounded-[5px] shadow-3xl border border-slate-100'} overflow-hidden`}>
            <ReportPdfViewer pdfBuffer={pdfData} onClose={onClose} onEmail={!isPublicView ? handleEmailReport : null} onDeliver={!isPublicView ? handleMarkDelivered : null} isEmailing={emailSending} fileName={`${reportData.patientName || 'Patient'}_Report.pdf`} isPublic={isPublicView} isRestricted={labProfile?.reportSettings?.restrictUnpaidReports && bookingData?.paymentStatus !== 'Paid'} onRestrict={() => setShowQuickPay(true)} />
          </div>
        </div>
      )}

      {!isPublicView && bookingData && parseFloat(bookingData.balance || 0) > 0 && !showQuickPay && (
        <button onClick={() => setShowQuickPay(true)} className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[350] bg-rose-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl shadow-2xl flex items-center gap-2 animate-bounce border border-rose-500/30">
          <IndianRupee className="w-4 h-4" />
          <div className="text-left font-black">
            <p className="text-[8px] uppercase opacity-80 leading-none">Pay Balance</p>
            <p className="text-lg leading-none">₹{bookingData.balance}</p>
          </div>
        </button>
      )}

      {!isPublicView && showQuickPay && bookingData && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/90 backdrop-blur-2xl" onClick={() => setShowQuickPay(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[48px] shadow-3xl overflow-hidden border border-white/20 animate-in zoom-in duration-300">
            <div className="bg-rose-600 p-8 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md"><IndianRupee className="w-7 h-7" /></div>
                <div><h3 className="text-2xl font-black uppercase tracking-tighter">Settle Payment</h3><p className="text-white/60 font-bold text-xs uppercase tracking-widest">Balance: ₹{bookingData.balance}</p></div>
              </div>
              <button onClick={() => setShowQuickPay(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Patient Details</label>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                  <p className="font-black text-brand-dark uppercase">{reportData.patientName}</p>
                  <span className="text-[10px] font-black text-brand-primary bg-brand-light px-2.5 py-1 rounded-xl">ID: {bookingData.billId || bookingData.id}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Discount (₹)</label>
                  <input 
                    type="number" 
                    id="preview-pay-discount" 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-xl font-black text-rose-500 outline-none" 
                    value={quickDiscount}
                    onChange={(e) => {
                      const disc = parseFloat(e.target.value) || 0;
                      setQuickDiscount(disc);
                      // Update amount input as well
                      const amountInput = document.getElementById('preview-pay-amount');
                      if (amountInput) amountInput.value = Math.max((bookingData.balance || 0) - disc, 0);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">To Receive (₹)</label>
                  <input type="number" id="preview-pay-amount" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-xl font-black text-brand-dark outline-none" defaultValue={Math.max((bookingData.balance || 0) - quickDiscount, 0)} />
                </div>
              </div>

              <div className="flex gap-2">
                {['Cash', 'UPI', 'Card'].map(m => (
                  <button key={m} id={`preview-mode-${m}`} onClick={() => {
                    document.querySelectorAll('.preview-pay-mode').forEach(b => b.classList.remove('bg-brand-dark', 'text-white'));
                    document.getElementById(`preview-mode-${m}`).classList.add('bg-brand-dark', 'text-white');
                  }} className={`preview-pay-mode flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-100 ${m === 'Cash' ? 'bg-brand-dark text-white' : 'bg-slate-50 text-slate-600'}`}>{m}</button>
                ))}
              </div>

              <button disabled={isQuickPaying} onClick={async () => {
                const amount = parseFloat(document.getElementById('preview-pay-amount').value) || 0;
                const discount = quickDiscount;
                const method = document.querySelector('.preview-pay-mode.bg-brand-dark').innerText;
                
                if (amount < 0 || discount < 0) { toast.error("Invalid values"); return; }
                if (amount === 0 && discount === 0) { toast.error("Enter amount or discount"); return; }
                
                setIsQuickPaying(true);
                try {
                  const newTotal = Math.max((parseFloat(bookingData.totalAmount) || 0) - discount, 0);
                  const newDiscount = (parseFloat(bookingData.discount) || 0) + discount;
                  const newPaid = (parseFloat(bookingData.paidAmount) || 0) + amount;
                  const newBalance = Math.max(newTotal - newPaid, 0);
                  const newStatus = newBalance <= 0 ? 'Paid' : 'Unpaid';
                  
                  const batch = writeBatch(db);
                  batch.update(doc(db, 'bookings', bookingData.id), { 
                    totalAmount: newTotal,
                    discount: newDiscount,
                    paidAmount: newPaid, 
                    balance: newBalance, 
                    paymentStatus: newStatus, 
                    paymentHistory: [...(bookingData.paymentHistory || []), { amount, method, discount, date: new Date() }], 
                    updatedAt: serverTimestamp() 
                  });
                  
                  const qSync = query(collection(db, 'reports'), where('labId', '==', bookingData.labId), where('bookingNo', '==', bookingData.bookingNo));
                  const sSnap = await getDocs(qSync);
                  sSnap.forEach(rDoc => batch.update(rDoc.ref, { paymentStatus: newStatus, updatedAt: serverTimestamp() }));
                  
                  await batch.commit();
                  toast.success(`Success! Received ₹${amount}${discount > 0 ? ` with ₹${discount} discount` : ''}`);
                  setBookingData(prev => ({ ...prev, totalAmount: newTotal, discount: newDiscount, paidAmount: newPaid, balance: newBalance, paymentStatus: newStatus }));
                  setQuickDiscount(0);
                  setShowQuickPay(false);
                } catch (err) { toast.error("Payment failed: " + err.message); } finally { setIsQuickPaying(false); }
              }} className="w-full py-4 bg-rose-600 text-white rounded-[5px] text-sm font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3">
                {isQuickPaying ? <Loader className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> Confirm Payment</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportPreview;
