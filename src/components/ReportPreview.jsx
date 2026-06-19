import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, limit, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Loader, X, Mail, IndianRupee, Save, Activity, User, ChevronLeft, Phone, Calendar, UserCheck, Fingerprint, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';
import ReportPdfViewer from './ReportPdfViewer';
import { pdf } from '@react-pdf/renderer';
import ReportDocument from './report-pdf/ReportDocument';

const docCache = {
  labs: {},
  patients: {},
  bookings: {},
  doctors: {},
  tests: {},
  reportsByBillId: {}
};

const fetchDocWithCache = async (collectionName, docId) => {
  if (!docId) return null;
  if (docCache[collectionName][docId] !== undefined) {
    return docCache[collectionName][docId];
  }
  try {
    const snap = await getDoc(doc(db, collectionName, String(docId)));
    const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    docCache[collectionName][docId] = data;
    return data;
  } catch (e) {
    console.warn(`Cache fetch failed for ${collectionName}/${docId}`, e);
    return null;
  }
};

const fetchReportsByBillIdWithCache = async (billId, labId) => {
  if (!billId || !labId) return [];
  const cacheKey = `${labId}_${billId}`;
  if (docCache.reportsByBillId[cacheKey] !== undefined) {
    return docCache.reportsByBillId[cacheKey];
  }
  try {
    const q = query(collection(db, 'reports'), where('billId', '==', billId), where('labId', '==', labId));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docCache.reportsByBillId[cacheKey] = data;
    return data;
  } catch (e) {
    console.warn(`Cache reports fetch failed for billId ${billId}`, e);
    return [];
  }
};

const fetchTestMasterWithCache = async (testId, testName, currentLabId) => {
  if (testId) {
    if (docCache.tests[testId] !== undefined) {
      return docCache.tests[testId];
    }
    try {
      const snap = await getDoc(doc(db, 'tests', testId));
      const data = snap.exists() ? snap.data() : null;
      docCache.tests[testId] = data;
      return data;
    } catch (e) {
      return null;
    }
  } else if (testName) {
    const cacheKey = `${currentLabId}_${testName}`;
    if (docCache.tests[cacheKey] !== undefined) {
      return docCache.tests[cacheKey];
    }
    try {
      const qLab = query(collection(db, 'tests'), where('labId', '==', currentLabId), where('testName', '==', testName), limit(1));
      const snapLab = await getDocs(qLab);
      if (!snapLab.empty) {
        const data = snapLab.docs[0].data();
        docCache.tests[cacheKey] = data;
        return data;
      }
      const qGlobal = query(collection(db, 'tests'), where('labId', '==', 'GLOBAL'), where('testName', '==', testName), limit(1));
      const snapGlobal = await getDocs(qGlobal);
      const data = !snapGlobal.empty ? snapGlobal.docs[0].data() : null;
      docCache.tests[cacheKey] = data;
      return data;
    } catch (e) {
      return null;
    }
  }
  return null;
};

const ReportPreview = ({ 
  report, 
  onClose, 
  isPublicView = false, 
  publicData = null,
  preloadedLabProfile = null,
  preloadedPatientData = null,
  preloadedBookingData = null,
  preloadedDoctorData = null,
  preloadedReports = null
}) => {
  const { currentUser, checkFeature } = useAuth();
  const [loading, setLoading] = useState(true);
  const [emailSending, setEmailSending] = useState(false);
  const [reportData, setReportData] = useState(report);
  const [labProfile, setLabProfile] = useState(preloadedLabProfile);
  const [patientData, setPatientData] = useState(preloadedPatientData);
  const [doctorData, setDoctorData] = useState(preloadedDoctorData);
  const [bookingData, setBookingData] = useState(preloadedBookingData);
  const [showQuickPay, setShowQuickPay] = useState(false);
  const [isQuickPaying, setIsQuickPaying] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfRendering, setPdfRendering] = useState(true);
  const [quickDiscount, setQuickDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [reportEngine, setReportEngine] = useState('react-pdf'); // 'puppeteer' or 'react-pdf'
  const [perfLogs, setPerfLogs] = useState({
    puppeteer: { genTime: null, loadTime: null, size: null },
    reactPdf: { genTime: null, loadTime: null, size: null }
  });
  const loadStartRef = React.useRef(null);

  const handleEngineChange = (engine) => {
    setReportEngine(engine);
    setPdfData(null); // Clear buffer to trigger re-generation in useEffect
    setPdfRendering(true);
  };

  useEffect(() => {
    if (report) {
      setReportData(report); 
      setPdfData(null); // Clear buffer to prevent stale cache of previous reports
      setPdfRendering(true);
      fetchReportContext();
    }
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, [report, preloadedLabProfile, preloadedPatientData, preloadedBookingData, preloadedDoctorData, preloadedReports]);

  const fetchMasterMetadata = async (reportDoc) => {
    try {
      let masterDoc = null;
      if (reportDoc.testId) {
        masterDoc = await fetchTestMasterWithCache(reportDoc.testId, null, reportDoc.labId);
      }
      if (!masterDoc && reportDoc.testName) {
        masterDoc = await fetchTestMasterWithCache(null, reportDoc.testName, reportDoc.labId);
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
    let profileToUse = preloadedLabProfile || { 
      labName: 'Diagnostic Laboratory',
      address: 'Independent Testing Facility',
      phone: 'Not Provided',
      email: 'info@lab.com'
    };

    try {
      const pId = report.patientId || (report.labId && report.patient_id ? String(report.labId) + '_' + String(report.patient_id) : report.patient_id);
      const resId = report.bookingId || (report.labId && report.bookingNo ? `${report.labId}_${report.bookingNo}` : null);

      // 1. Fetch Lab Profile, Patient Data, Booking Data, and Reports concurrently (preferring preloaded)
      const [labData, patientDataVal, bookingDataVal, reportsDataVal] = await Promise.all([
        preloadedLabProfile ? Promise.resolve(preloadedLabProfile) : (report.labId ? fetchDocWithCache('labs', report.labId) : Promise.resolve(null)),
        preloadedPatientData ? Promise.resolve(preloadedPatientData) : (pId ? fetchDocWithCache('patients', String(pId)) : Promise.resolve(null)),
        preloadedBookingData ? Promise.resolve(preloadedBookingData) : (resId ? fetchDocWithCache('bookings', resId) : Promise.resolve(null)),
        preloadedReports 
          ? Promise.resolve(preloadedReports)
          : (report.billId 
              ? fetchReportsByBillIdWithCache(report.billId, report.labId)
              : (report.id ? fetchDocWithCache('reports', report.id).then(r => r ? [r] : []) : Promise.resolve([])))
      ]);

      if (labData) {
        profileToUse = { ...profileToUse, ...labData };
      }
      setLabProfile(profileToUse);

      const finalPatientData = patientDataVal || preloadedPatientData;
      if (finalPatientData) {
        setPatientData(finalPatientData);
      }

      const finalBookingData = bookingDataVal || preloadedBookingData;
      if (finalBookingData) {
        setBookingData(finalBookingData);
      }

      const reportsToProcess = reportsDataVal || [];

      // 2. Fetch Doctor Profile and all required Test Masters concurrently
      const subPromises = [];
      
      // Index 0: Doctor
      const docIdToFetch = finalBookingData?.doctorId || report.doctorId;
      if (preloadedDoctorData) {
        subPromises.push(Promise.resolve(preloadedDoctorData));
      } else if (docIdToFetch) {
        subPromises.push(fetchDocWithCache('doctors', docIdToFetch));
      } else {
        subPromises.push(Promise.resolve(null));
      }

      // Index 1+: Test Masters
      reportsToProcess.forEach((r) => {
        const currentLabId = String(report.labId || r.labId);
        subPromises.push(
          fetchTestMasterWithCache(r.testId, r.testName, currentLabId)
            .then(data => ({ reportId: r.id, data }))
        );
      });

      const subResults = await Promise.all(subPromises);

      // Map Doctor
      const doctorDataVal = subResults[0] || preloadedDoctorData;
      if (doctorDataVal) {
        setDoctorData(doctorDataVal);
      }

      // Map Test Masters
      const testMastersMap = {};
      subResults.slice(1).forEach((res) => {
        if (res && res.data) {
          testMastersMap[res.reportId] = res.data;
        }
      });

      // Synchronously process reports using testMastersMap
      const processedReports = reportsToProcess.map((r) => {
        const tData = testMastersMap[r.id];

        if (tData) {
          const masterCat = tData.category || tData.testCategory;
          const masterSam = tData.sampleType;
          if (!r.category || r.category === 'General') r.category = masterCat || r.category;
          if (!r.sampleType || r.sampleType === 'N/A') r.sampleType = masterSam || r.sampleType;

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
                      if (rule.gender !== 'Any' && rule.gender !== 'Both' && finalPatientData && rule.gender !== finalPatientData.gender) return false;
                      if (finalPatientData && finalPatientData.age) {
                        if (finalPatientData.age < rule.ageMin || finalPatientData.age > rule.ageMax) return false;
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
      });

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
      if (pdfLoading) return;
      const fetchPdf = async () => {
        try {
          setPdfLoading(true);
          const genStart = performance.now();
          loadStartRef.current = null;

          if (reportEngine === 'puppeteer') {
            let token = currentUser ? await currentUser.getIdToken() : null;
            const endpoint = isPublicView && !currentUser ? `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/api/public/generate-report` : `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/api/generate-report`;
            const res = await axios.post(endpoint, { reportData, labProfile, patientData, doctorData, bookingData, qrUrl }, { headers: token ? { Authorization: `Bearer ${token}` } : {}, responseType: 'blob' });
            
            const genDuration = Math.round(performance.now() - genStart);
            const fileSize = (res.data.size / 1024).toFixed(2);
            
            setPerfLogs(prev => ({
              ...prev,
              puppeteer: {
                ...prev.puppeteer,
                genTime: genDuration,
                size: fileSize
              }
            }));

            loadStartRef.current = performance.now();
            setPdfData(res.data);
          } else {
            // React-PDF Client Side Generation
            const doc = (
              <ReportDocument
                reportData={reportData}
                labProfile={labProfile}
                patientData={patientData}
                doctorData={doctorData}
                bookingData={bookingData}
                qrUrl={qrUrl}
              />
            );
            const blob = await pdf(doc).toBlob();
            const genDuration = Math.round(performance.now() - genStart);
            const fileSize = (blob.size / 1024).toFixed(2);

            setPerfLogs(prev => ({
              ...prev,
              reactPdf: {
                ...prev.reactPdf,
                genTime: genDuration,
                size: fileSize
              }
            }));

            loadStartRef.current = performance.now();
            setPdfData(blob);
          }
        } catch (e) {
          console.error('[PDF_FETCH_ERROR]:', e);
          if (e.response?.status !== 401) toast.error('Failed to render PDF preview.');
          setPdfRendering(false);
        } finally { setPdfLoading(false); }
      };
      fetchPdf();
    }
  }, [loading, reportData, labProfile, patientData, isPublicView, qrUrl, currentUser, doctorData, reportEngine]);

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
      {(
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

              {/* Tests Ordered */}
              {bookingData && (bookingData.tests_detail?.length > 0 || bookingData.testNames) && (
                <div className="space-y-2">
                  <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em]">Tests Ordered</h3>
                  <div className="bg-white rounded-[5px] p-2.5 border border-blue-100 shadow-sm space-y-1.5">
                    {bookingData.tests_detail?.length > 0 ? (
                      bookingData.tests_detail.map((t, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-blue-50 last:border-b-0">
                          <span className="text-[9px] font-bold text-slate-700 uppercase tracking-wide">{t.name}</span>
                          <span className="text-[9px] font-black text-slate-500">₹{t.price || 0}</span>
                        </div>
                      ))
                    ) : (
                      bookingData.testNames?.split(',').map((name, idx) => (
                        <div key={idx} className="py-1 border-b border-blue-50 last:border-b-0">
                          <span className="text-[9px] font-bold text-slate-700 uppercase tracking-wide">{name.trim()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

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

              {/* PDF Engine Comparison Switch (Developer/Testing Options) */}
              <div className="bg-white rounded-[16px] border border-orange-200 p-3.5 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5 text-orange-600" />
                  </div>
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-wider">PDF Engine (Testing)</h3>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEngineChange('puppeteer')}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      reportEngine === 'puppeteer'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm shadow-slate-900/10'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Puppeteer
                  </button>
                  <button
                    onClick={() => handleEngineChange('react-pdf')}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      reportEngine === 'react-pdf'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/10'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    React-PDF
                  </button>
                </div>

                {/* Performance Logging Display */}
                <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[8.5px]">
                  <div className="flex justify-between items-center pb-1 border-b border-slate-200/50">
                    <span className="font-bold text-slate-400 uppercase tracking-wide">Metric</span>
                    <span className="font-black text-slate-500 uppercase tracking-wide">Puppeteer vs R-PDF</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500">PDF Gen Time:</span>
                    <span className="font-black text-slate-700 text-right">
                      {perfLogs.puppeteer.genTime ? `${perfLogs.puppeteer.genTime}ms` : '--'} / {perfLogs.reactPdf.genTime ? `${perfLogs.reactPdf.genTime}ms` : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500">Viewer Render:</span>
                    <span className="font-black text-slate-700 text-right">
                      {perfLogs.puppeteer.loadTime ? `${perfLogs.puppeteer.loadTime}ms` : '--'} / {perfLogs.reactPdf.loadTime ? `${perfLogs.reactPdf.loadTime}ms` : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500">File Size:</span>
                    <span className="font-black text-slate-700 text-right">
                      {perfLogs.puppeteer.size ? `${perfLogs.puppeteer.size}KB` : '--'} / {perfLogs.reactPdf.size ? `${perfLogs.reactPdf.size}KB` : '--'}
                    </span>
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
            <ReportPdfViewer 
              pdfBuffer={pdfData} 
              onClose={onClose} 
              onEmail={!isPublicView ? handleEmailReport : null} 
              onDeliver={!isPublicView ? handleMarkDelivered : null} 
              isEmailing={emailSending} 
              fileName={`${reportData.patientName || 'Patient'}_Report.pdf`} 
              isPublic={isPublicView} 
              isRestricted={labProfile?.reportSettings?.restrictUnpaidReports && bookingData?.paymentStatus !== 'Paid'} 
              onRestrict={() => setShowQuickPay(true)} 
              onLoadSuccess={() => {
                setPdfRendering(false);
                if (loadStartRef.current) {
                  const loadDuration = Math.round(performance.now() - loadStartRef.current);
                  setPerfLogs(prev => {
                    const logKey = reportEngine === 'puppeteer' ? 'puppeteer' : 'reactPdf';
                    return {
                      ...prev,
                      [logKey]: {
                        ...prev[logKey],
                        loadTime: loadDuration
                      }
                    };
                  });
                  loadStartRef.current = null;
                }
              }}
              onLoadError={() => {
                setPdfRendering(false);
              }}
            />
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
                  <button 
                    key={m} 
                    onClick={() => setPaymentMethod(m)} 
                    className={`preview-pay-mode flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-100 transition-all ${
                      paymentMethod === m 
                        ? 'bg-brand-dark text-white shadow-lg' 
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <button disabled={isQuickPaying} onClick={async () => {
                const amount = parseFloat(document.getElementById('preview-pay-amount').value) || 0;
                const discount = quickDiscount;
                const method = paymentMethod;
                
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
