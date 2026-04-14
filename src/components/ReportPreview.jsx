import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Loader, Printer, X, Download, ShieldCheck, Mail, Phone, MapPin, Building } from 'lucide-react';
import QRCode from "react-qr-code";
import { toast } from 'react-toastify';

const ReportPreview = ({ report, onClose, isPublicView = false, publicData = null }) => {
  const { subscription, userData, currentUser, checkFeature } = useAuth();
  const [loading, setLoading] = useState(true);
  const [emailSending, setEmailSending] = useState(false);
  const [reportData, setReportData] = useState(report); // Local copy for latest data
  const [labProfile, setLabProfile] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [doctorData, setDoctorData] = useState(null);
  
  // Standardized QR Data for Verification & Direct Access
  const qrUrl = reportData.viewToken 
    ? `${window.location.origin}/v/${reportData.viewToken}`
    : JSON.stringify({ 
        id: report.bookingId || report.id, 
        patient: report.patientName, 
        status: 'Verified' 
      });
  
  const QRCodeComponent = (QRCode && QRCode.default) ? QRCode.default : QRCode;
  
  useEffect(() => {
    if (report) {
      setReportData(report); 
      fetchReportContext();
    }
    // Lock body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [report]);

  const formatDate = (val, includeTime = false) => {
    if (!val) return 'N/A';
    let date;
    if (val.seconds) date = new Date(val.seconds * 1000);
    else if (val._seconds) date = new Date(val._seconds * 1000);
    else date = new Date(val);
    
    if (isNaN(date.getTime())) return 'N/A';
    const d = String(date.getDate()).padStart(2, '0'), m = String(date.getMonth() + 1).padStart(2, '0'), y = date.getFullYear();
    let str = `${d}/${m}/${y}`;
    if (includeTime) str += ` ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return str;
  };

  const fetchMasterMetadata = async (reportDoc) => {
    try {
      let masterDoc = null;
      // 1. Priority: testId
      if (reportDoc.testId) {
        const tDoc = await getDoc(doc(db, 'tests', reportDoc.testId));
        if (tDoc.exists()) masterDoc = tDoc.data();
      }

      // 2. Fallback: testName (robust)
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
          // Prefer specific match with Category > GLOBAL > any first match
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
      setLoading(false);
      return;
    }

    setLoading(true);
    let profileToUse = { 
      labName: 'Diagnostic Laboratory',
      address: 'Independent Testing Facility',
      phone: 'Not Provided',
      email: 'info@lab.com',
      watermarkText: 'CONFIDENTIAL',
      footerText: 'This report is electronically generated. Please correlate clinically.'
    };

    try {
      if (report.billId) {
        try {
          const q = query(collection(db, 'reports'), where('billId', '==', report.billId), where('labId', '==', report.labId));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const allReports = await Promise.all(snap.docs.map(async (docSnap) => {
              const r = { id: docSnap.id, ...docSnap.data() };
              // Fetch metadata if missing
              if (!r.category || r.category === 'General' || !r.sampleType || r.sampleType === 'N/A') {
                const meta = await fetchMasterMetadata(r);
                if (meta) {
                  r.category = r.category && r.category !== 'General' ? r.category : meta.category;
                  r.sampleType = r.sampleType && r.sampleType !== 'N/A' ? r.sampleType : meta.sampleType;
                }
              }
              return r;
            }));

            const mergedResults = allReports.flatMap(r => 
              (r.results || []).map(res => ({ 
                ...res, 
                _testName: r.testName, 
                _category: r.category || 'General', 
                _sampleType: r.sampleType || 'N/A' 
              }))
            );
            const mergedTestNames = allReports.map(r => r.testName).join(', ');
            setReportData({
              ...allReports[0],
              testName: mergedTestNames,
              results: mergedResults,
              status: allReports.every(r => r.status === 'Final') ? 'Final' : 'In Progress'
            });
          }
        } catch (e) { console.warn("Multi-test fetch failed:", e.message); }
      } else if (report.id) {
        try {
          const rDoc = await getDoc(doc(db, 'reports', report.id));
          if (rDoc.exists()) {
            let rData = { id: rDoc.id, ...rDoc.data() };
            if (!rData.category || rData.category === 'General' || !rData.sampleType || rData.sampleType === 'N/A') {
              const meta = await fetchMasterMetadata(rData);
              if (meta) {
                rData.category = rData.category && rData.category !== 'General' ? rData.category : meta.category;
                rData.sampleType = rData.sampleType && rData.sampleType !== 'N/A' ? rData.sampleType : meta.sampleType;
              }
            }
            setReportData(rData);
          }
        } catch (e) { console.warn("Single-test fetch failed:", e.message); }
      }

      if (report.labId) {
        try {
          const labDoc = await getDoc(doc(db, 'labs', report.labId));
          if (labDoc.exists()) profileToUse = { ...profileToUse, ...labDoc.data() };
        } catch (e) { console.warn("Lab fetch failed"); }
      }
      setLabProfile(profileToUse);

      // Use the 'report' prop directly to avoid stale state issues in the first pass
      const pId = report.patientId || (report.labId && report.patient_id ? String(report.labId) + '_' + String(report.patient_id) : report.patient_id);
      if (pId) {
        try {
          const pDoc = await getDoc(doc(db, 'patients', String(pId)));
          if (pDoc.exists()) setPatientData({ id: pDoc.id, ...pDoc.data() });
        } catch (e) { console.warn("Patient fetch failed"); }
      }
      
      if (report.bookingId) {
        try {
          const bDoc = await getDoc(doc(db, 'bookings', report.bookingId));
          if (bDoc.exists() && bDoc.data().doctorId) {
            const dDoc = await getDoc(doc(db, 'doctors', bDoc.data().doctorId));
            if (dDoc.exists()) setDoctorData(dDoc.data());
          }
        } catch (e) { console.warn("Doctor fetch failed"); }
      }
    } catch (globalError) {
      console.error("Critical error in report fetch:", globalError);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printContent = document.querySelector('.printable-page');
    if (!printContent) return;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Report</title><script src="https://cdn.tailwindcss.com"></script><style>
      @page { size: A4 portrait; margin: 6mm; } 
      html { zoom: 100%; } 
      body { background: white; font-family: Arial; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
      .printable-page { -webkit-print-color-adjust: exact; print-color-adjust: exact; position: relative; z-index: 10; background: transparent !important; }
      .watermark-layer { 
        position: fixed !important; 
        top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important;
        display: flex !important; align-items: center !important; justify-content: center !important;
        z-index: 5 !important; 
        opacity: 1 !important; 
        visibility: visible !important;
        pointer-events: none !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    </style></head><body>${printContent.outerHTML}<script>window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 1200); };</script></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleEmailReport = async () => {
    if (!checkFeature('Email Support')) {
      toast.info('🚀 Email Support is not available in your current plan. Please upgrade to enable this.', { position: "top-center" });
      return;
    }

    if (emailSending) return;
    
    // 2. Extract Patient Email
    const patientEmail = patientData?.email || report?.patientEmail;
    if (!patientEmail) {
      toast.warn('No email found for this patient. Please update profile.');
      return;
    }    setEmailSending(true);

    try {
      // 1. Ensure html2pdf is loaded in main window
      if (!window.html2pdf) {
        const sc = document.createElement('script');
        sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        document.head.appendChild(sc);
        await new Promise(r => sc.onload = r);
      }

      const element = document.querySelector('.printable-page');
      if (!element) throw new Error("Report content not found");

      // 2. Create a Hidden Sandboxed Iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-10000px';
      iframe.style.top = '0';
      iframe.style.width = '210mm';
      iframe.style.height = '100%';
      document.body.appendChild(iframe);

      // 3. Inject Clean Content and Safe Styles into Iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Export PDF</title>
          <style>
            body { background: white !important; font-family: Arial, sans-serif !important; margin: 0; padding: 0; }
            .pdf-wrapper { width: 210mm; min-height: 297mm; padding: 15mm; background: white; box-sizing: border-box; }
            * { box-sizing: border-box; }
            .flex { display: flex !important; }
            .flex-col { flex-direction: column !important; }
            .justify-between { justify-content: space-between !important; }
            .items-center { align-items: center !important; }
            .grid { display: grid !important; }
            .grid-cols-2 { grid-template-columns: repeat(2, 1fr) !important; }
            .gap-4 { gap: 1rem !important; }
            .w-full { width: 100% !important; }
            .border-b { border-bottom: 2px solid #064e3b !important; }
            .border-b-2 { border-bottom: 2px solid #000 !important; }
            .bg-emerald-900 { background-color: #064e3b !important; color: white !important; }
            .text-emerald-900 { color: #064e3b !important; }
            .text-emerald-700 { color: #047857 !important; }
            .font-black { font-weight: 900 !important; }
            .font-bold { font-weight: bold !important; }
            .uppercase { text-transform: uppercase !important; }
            .text-sm { font-size: 14px !important; }
            .text-xs { font-size: 12px !important; }
            .text-gray-500 { color: #6b7280 !important; }
            .text-gray-700 { color: #374151 !important; }
            
            table { width: 100% !important; border-collapse: collapse !important; margin-top: 20px !important; }
            th { border-bottom: 2px solid #111827 !important; text-align: left !important; padding: 10px !important; font-size: 12px !important; background: #f8fafc !important; color: #475569 !important; }
            td { border-bottom: 1px solid #f1f5f9 !important; padding: 10px !important; font-size: 13px !important; font-weight: bold !important; }
            
            .watermark-layer { display: none !important; }
            header { border-bottom: 3px solid #064e3b !important; padding-bottom: 15px !important; margin-bottom: 20px !important; }
            .text-4xl { font-size: 32px !important; margin-bottom: 10px !important; }
          </style>
        </head>
        <body>
          <div class="pdf-wrapper">
            ${element.innerHTML}
          </div>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
        </body>
        </html>
      `);
      iframeDoc.close();

      // Give it a moment to render
      await new Promise(r => setTimeout(r, 500));

      const opt = {
        margin: 0,
        filename: `Report_${reportData.patientName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // 4. Generate PDF from Iframe content
      const pdfBase64 = await iframe.contentWindow.html2pdf().from(iframeDoc.body).set(opt).outputPdf('datauristring');

      // Cleanup
      document.body.removeChild(iframe);

      const token = await currentUser.getIdToken();
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

      const payload = {
        to: patientEmail,
        patientName: reportData.patientName,
        labName: labProfile?.labName || 'Diagnostic Lab',
        bookingId: reportData.billId || reportData.id,
        pdfBase64: pdfBase64.split(',')[1]
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
      if (!res.ok) throw new Error(data.error || 'Server Error');

      toast.success('Professional PDF emailed successfully!');
    } catch (error) {
       console.error("PDF Email Error:", error);
       toast.error('Failed to send PDF: ' + error.message);
    } finally {
      setEmailSending(false);
    }
  };

  const getFlag = (value, rangeStr) => {
    if (!value || !rangeStr) return '';
    const v = parseFloat(value);
    if (isNaN(v)) return '';
    const range = String(rangeStr).toLowerCase();
    const rangeMatch = range.match(/([\d\.]+)\s*-\s*([\d\.]+)/);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]), max = parseFloat(rangeMatch[2]);
      if (v < min) return 'L'; if (v > max) return 'H'; return 'N';
    }
    const ltMatch = range.match(/<\s*([\d\.]+)/);
    if (ltMatch) return v >= parseFloat(ltMatch[1]) ? 'H' : 'N';
    return '';
  };

  if (!report) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-gray-900/95 backdrop-blur-xl flex flex-col pt-0 pb-4 print:static print:bg-white print:overflow-visible print:block print:inset-auto">
      <div className="bg-[#1e1e2d] border-b border-white/5 px-2 sm:px-6 py-2.5 sm:py-4 flex justify-between items-center shrink-0 print:hidden top-0 sticky z-[310] gap-1 sm:gap-4 overflow-hidden">
        <div className="text-white/90 font-black tracking-tight sm:tracking-widest text-[10px] sm:text-sm uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-[30%] sm:max-w-[40%]">
          Preview: <span className="text-brand-primary">{report.patientName}</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 flex-nowrap">
          {!isPublicView && (
            <button 
              onClick={handleEmailReport} 
              disabled={emailSending}
              className={`flex items-center px-2.5 sm:px-6 py-2 rounded-lg sm:rounded-xl font-black transition shadow-lg shrink-0 text-[10px] sm:text-sm ${emailSending ? 'bg-slate-100/10 text-slate-500' : 'bg-brand-dark border border-white/10 text-white hover:bg-brand-secondary active:scale-95'}`}
            >
              {emailSending ? <Loader className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin mr-1.5 sm:mr-2" /> : <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-brand-primary" />}
              <span className="hidden xs:inline">{emailSending ? 'Sending...' : 'Email Report'}</span>
              <span className="xs:hidden">{emailSending ? '...' : 'Email'}</span>
            </button>
          )}
          <button onClick={handlePrint} className="flex items-center px-2.5 sm:px-6 py-2 bg-emerald-600 text-white rounded-lg sm:rounded-xl font-black hover:bg-emerald-700 transition shadow-lg shrink-0 active:scale-95 text-[10px] sm:text-sm">
            <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> 
            <span className="hidden xs:inline">Print Report</span>
            <span className="xs:hidden">Print</span>
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1.5 sm:p-2 bg-white/5 hover:bg-rose-500 text-white/70 hover:text-white rounded-lg sm:rounded-xl transition shrink-0 border border-white/5">
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-grow overflow-y-auto w-full flex flex-col items-center p-2 sm:p-8 print:p-0 custom-scrollbar print:overflow-visible print:block print:h-auto pb-20">
        {loading ? (
           <div className="flex flex-col items-center justify-center text-white h-full pb-20 print:hidden mt-20">
              <Loader className="w-12 h-12 animate-spin mb-2 text-emerald-500" />
              <p className="font-bold tracking-widest uppercase text-xs">Fetching All Test Data...</p>
           </div>
        ) : (
        <div className="!bg-white !text-[#111827] w-full sm:max-w-[210mm] min-h-screen sm:min-h-[297mm] shadow-2xl relative print:shadow-none printable-page flex flex-col mx-auto transition-all">
          <div className="absolute inset-0 !bg-white pointer-events-none z-[-1]"></div>
            
            {/* Watermark Overlay (Text or Image) */}
            {labProfile?.reportSettings?.watermark?.enabled && (
              <div className="watermark-layer absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden select-none">
                {labProfile.reportSettings.watermark.type === 'image' && labProfile.reportSettings.watermark.image ? (
                  <img 
                    src={labProfile.reportSettings.watermark.image} 
                    alt="Watermark" 
                    style={{ 
                      opacity: labProfile.reportSettings.watermark.opacity || 0.05,
                      width: '60%',
                      height: 'auto',
                      objectFit: 'contain',
                      transform: `rotate(${labProfile.reportSettings.watermark.rotation || 0}deg)`
                    }}
                  />
                ) : (
                  <div 
                    style={{ 
                      transform: `rotate(${labProfile.reportSettings.watermark.rotation || -45}deg)`, 
                      opacity: labProfile.reportSettings.watermark.opacity || 0.05,
                      fontSize: labProfile.reportSettings.watermark.text?.length > 15 ? '60px' : '85px',
                    }} 
                    className="font-black text-gray-900 border-[6px] border-gray-900 px-12 py-6 uppercase tracking-[0.4em] whitespace-nowrap text-center"
                  >
                    {labProfile.reportSettings.watermark.text || 'LAB MITRA'}
                  </div>
                )}
              </div>
            )}

            <div className="relative z-10 flex-grow flex flex-col pb-20">
            <header className="border-b-[3px] border-emerald-900 pb-6 mb-6 px-6 pt-10 !bg-white relative">
              {/* Lab Mitra App Branding */}
              <div className="absolute top-2 right-6 flex items-center gap-1.5 opacity-60 print:opacity-50 select-none">
                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-gray-400">Powered By</span>
                <div className="flex items-center gap-0.5">
                  <img src="/favicon.png" alt="Logo" className="w-2.5 h-2.5 opacity-80" style={{ filter: 'grayscale(100%)' }} />
                  <span className="text-[8px] font-black tracking-[0.1em] text-gray-700">LabMitra</span>
                </div>
              </div>
              {labProfile?.reportSettings?.useCustomHeader && labProfile?.reportSettings?.headerImage ? (
                <div className="w-full mb-2">
                  <img 
                    src={labProfile.reportSettings.headerImage} 
                    alt="Lab Header" 
                    className="w-full h-auto max-h-48 object-contain"
                  />
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row justify-between items-start !bg-white gap-6">
                  <div className="max-w-md w-full">
                    <h1 className="text-2xl sm:text-4xl font-black !text-emerald-900 uppercase tracking-tighter leading-none mb-3">
                      {labProfile?.labFullName || labProfile?.labName || 'Diagnostic Laboratory'}
                    </h1>
                    <div className="space-y-1">
                      {labProfile?.reportSettings?.showAddress !== false && labProfile?.address && (
                        <p className="text-[11px] sm:text-sm font-bold !text-gray-700 flex items-center">
                          <MapPin className="w-3 sm:w-3.5 h-3 sm:h-3.5 mr-1.5 shrink-0" /> <span className="leading-tight">{labProfile.address}</span>
                        </p>
                      )}
                      {labProfile?.reportSettings?.showPhone !== false && (labProfile?.phone || labProfile?.mobile) && (
                        <p className="text-[11px] sm:text-sm font-bold !text-gray-700 flex items-center">
                          <Phone className="w-3 sm:w-3.5 h-3 sm:h-3.5 mr-1.5 shrink-0" /> {labProfile.phone || labProfile.mobile}
                        </p>
                      )}
                      {labProfile?.reportSettings?.showEmail !== false && labProfile?.email && (
                        <p className="text-[11px] sm:text-sm font-bold !text-gray-700 flex items-center">
                          <Mail className="w-3 sm:w-3.5 h-3 sm:h-3.5 mr-1.5 shrink-0" /> {labProfile.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right !bg-white self-end sm:self-start">
                    <div className="bg-emerald-50 border border-emerald-200 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl mb-2 inline-block">
                      <h2 className="text-base sm:text-lg font-black !text-emerald-900 uppercase tracking-widest m-0 leading-none">Diagnostic Report</h2>
                    </div>
                  </div>
                </div>
              )}
            </header>

            <section className="px-6 mb-8 !bg-white">
              <div className="!bg-white border-[1.5px] border-gray-300 rounded-lg p-3 sm:p-4 flex flex-row items-stretch justify-between gap-4 sm:gap-6">
                <div className="grid grid-cols-[max-content_auto] sm:grid-cols-[max-content_auto_max-content_auto] gap-x-3 sm:gap-x-6 gap-y-0.5 sm:gap-y-0.5 text-[11px] sm:text-[13px] font-bold !text-gray-900 flex-1">
                  <div className="text-gray-500 font-medium uppercase tracking-tighter whitespace-nowrap">Name</div> <div className="uppercase whitespace-nowrap">: {reportData.patientName}</div>
                  <div className="text-gray-500 font-medium uppercase tracking-tighter whitespace-nowrap">Reg. Date</div> <div className="whitespace-nowrap">: {formatDate(reportData.createdAt, true)}</div>
                  
                  <div className="text-gray-500 font-medium uppercase tracking-tighter whitespace-nowrap">Age/Gender</div> <div className="whitespace-nowrap">: {patientData?.age || reportData.patientAge || '??'} Y / {patientData?.gender || reportData.patientGender || '--'}</div>
                  <div className="text-gray-500 font-medium uppercase tracking-tighter whitespace-nowrap">Received Date</div> <div className="whitespace-nowrap">: {formatDate(reportData.createdAt, true)}</div>
                  
                  <div className="text-gray-500 font-medium uppercase tracking-tighter whitespace-nowrap">Referred By</div> <div className="uppercase whitespace-nowrap">: {doctorData?.name || reportData.doctorName || 'Self'}</div>
                  <div className="text-gray-500 font-medium uppercase tracking-tighter whitespace-nowrap">Collection Date</div> <div className="whitespace-nowrap">: {formatDate(reportData.createdAt, true)}</div>
                  
                  <div className="text-gray-500 font-medium uppercase tracking-tighter whitespace-nowrap">Patient ID</div> 
                  <div className="whitespace-nowrap">: {(() => {
                        const rawId = patientData?.patientId || reportData?.patientId || reportData?.patient_id || report?.patientId || report?.patient_id || patientData?.id;
                        if (!rawId) return '--';
                        return String(rawId).split('_').pop();
                      })()}
                  </div>
                  <div className="text-gray-500 font-medium uppercase tracking-tighter whitespace-nowrap">Report Date</div> <div className="whitespace-nowrap">: {formatDate(reportData.updatedAt || reportData.createdAt, true)}</div>
                  
                  <div className="text-gray-500 font-medium uppercase tracking-tighter whitespace-nowrap">Report ID</div> <div className="uppercase whitespace-nowrap">: {reportData.reportId || reportData.bookingNo || reportData.bookingId || reportData.booking_id || '--'}</div>
                  <div className="text-gray-500 font-medium uppercase tracking-tighter whitespace-nowrap">Status</div> <div className="text-emerald-700 font-bold uppercase whitespace-nowrap">: {reportData.status || 'Final'}</div>
                </div>
                <div className="flex flex-col items-center justify-center !bg-white pl-4 sm:pl-6 border-l border-gray-200 shrink-0">
                  <QRCodeComponent value={qrUrl} size={50} className="sm:w-[75px] sm:h-[75px]" />
                  <p className="text-[7px] sm:text-[8px] text-gray-400 text-center mt-1 font-medium tracking-widest uppercase whitespace-nowrap">Scan to Verify</p>
                </div>
              </div>
            </section>

            <section className="px-6 flex-grow !bg-white">
              {(() => {
                const results = reportData.results || [];
                if (results.length === 0) return (
                   <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                      <p className="text-gray-300 font-bold uppercase tracking-widest">No Results Finalized Yet</p>
                   </div>
                );
                const nested = results.reduce((acc, curr) => {
                  const t = curr._testName || reportData.testName?.split(',')[0]?.trim() || 'General';
                  const g = curr.groupName || 'General';
                  if (!acc[t]) acc[t] = {}; if (!acc[t][g]) acc[t][g] = [];
                  acc[t][g].push(curr); return acc;
                }, {});

                return (
                  <div className="flex flex-col gap-8 w-full !bg-white">
                    {Object.entries(nested).map(([testTit, grpData], tIdx) => {
                      const firstGrp = Object.values(grpData)[0] || [];
                      const firstP = firstGrp[0] || {};
                      const catName = firstP._category || 'General';
                      const samType = firstP._sampleType || 'N/A';

                      return (
                        <div key={tIdx} className="w-full !bg-white">
                          <div className="bg-emerald-50 border-l-4 border-emerald-600 px-4 py-2 mb-4 flex items-baseline gap-3">
                             <h2 className="text-[14px] font-bold uppercase text-emerald-900 tracking-tighter shrink-0">Test: {testTit}</h2>
                             <span className="text-[11px] font-bold text-blue-900/70 border-l border-gray-300 pl-3">Category: {catName}</span>
                             <span className="text-[10px] font-medium text-gray-500 uppercase tracking-widest bg-white/60 px-2 py-0.5 rounded ml-auto">Sample: {samType}</span>
                          </div>
                          <div className="flex flex-col gap-0 w-full px-2">
                           {Object.entries(grpData).map(([grpN, params], gIdx) => {
                              const isWid = testTit.toUpperCase().includes('WIDAL') || grpN.toUpperCase().includes('WIDAL');
                              const isGridTy = params[0]?.dataType === 'Grid' || params[0]?.dataType === 'Titer' || reportData?.reportLayout === 'Tabular table' || isWid;
                              return (
                                <div key={gIdx} className="mb-0 w-full !bg-white">
                                   {grpN !== 'General' && (
                                      <div className="flex items-center gap-3 mt-1.5 mb-0.5">
                                         <h4 className="text-[12px] font-black uppercase text-blue-900 bg-slate-100/50 px-4 py-1.5 rounded-lg border-l-4 border-blue-600 tracking-widest !bg-white whitespace-nowrap">
                                            {grpN}
                                         </h4>
                                         <div className="h-px bg-slate-100 flex-grow opacity-50" />
                                      </div>
                                   )}
                                   {isGridTy ? (
                                      (() => {
                                         const allT = new Set(); params.forEach(res => { try { Object.keys(JSON.parse(res.value || '{}')).forEach(k => allT.add(k)); } catch(e){} });
                                         let titrs = Array.from(allT).sort((a,b) => (parseInt(a.split(':')[1])||0) - (parseInt(b.split(':')[1])||0));
                                         if (isWid) titrs = titrs.length ? titrs.filter(t => (parseInt(t.split(':')[1])||0)<=320) : ["1:20","1:40","1:80","1:160","1:320"];
                                         return (
                                           <div className="border border-gray-200 rounded-lg overflow-x-auto shadow-sm !bg-white no-scrollbar">
                                             <table className="min-w-[600px] sm:w-full text-left !bg-white">
                                               <thead><tr className="bg-gray-50 border-b border-gray-200 text-gray-700">
                                                 <th className="py-2 sm:py-2.5 px-3 sm:px-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest leading-none">Parameter</th>
                                                 {titrs.map(t => <th key={t} className="py-2 sm:py-2.5 px-1 sm:px-2 text-[9px] sm:text-[10px] font-black uppercase text-center leading-none tracking-tighter">{t}</th>)}
                                               </tr></thead>
                                               <tbody className="divide-y divide-gray-100 !bg-white">{params.map((res, i) => {
                                                 let vm_grid = {}; try { vm_grid = JSON.parse(res.value || '{}'); } catch(e){}
                                                 return (<tr key={i} className="bg-white"><td className="py-2.5 sm:py-3 px-3 sm:px-4 text-[11px] sm:text-xs font-bold text-gray-800">{res.parameter}</td>
                                                   {titrs.map(t => {
                                                     const v_g = vm_grid[t] || '-'; const isRea_g = v_g.toUpperCase().includes('POS') || v_g.toUpperCase().includes('REA');
                                                     return <td key={t} className={`py-2.5 sm:py-3 px-1 sm:px-2 text-[12px] sm:text-[13px] font-black text-center ${isRea_g ? 'text-red-600' : 'text-gray-400'}`}>{v_g === 'REACTIVE' ? '+' : v_g}</td>
                                                   })}
                                                 </tr>)
                                               })}</tbody>
                                             </table>
                                           </div>
                                         )
                                      })()
                                   ) : (
                                      <div className="overflow-x-auto w-full no-scrollbar">
                                        <table className="min-w-[650px] sm:w-full text-left !bg-white">
                                          <thead><tr className="border-b-[1.5px] border-gray-800 text-gray-900 bg-slate-50">
                                            <th className="py-1.5 px-2 text-[10px] sm:text-[11px] font-black uppercase text-slate-500 w-[35%] tracking-tight">Parameter</th>
                                            <th className="py-1.5 px-2 text-[10px] sm:text-[11px] font-black uppercase text-slate-500 w-[15%] tracking-tight">Result</th>
                                            <th className="py-1.5 px-2 text-[10px] sm:text-[11px] font-black uppercase text-slate-500 w-[10%] text-center tracking-tight">Flag</th>
                                            <th className="py-1.5 px-2 text-[10px] sm:text-[11px] font-black uppercase text-slate-500 w-[15%] tracking-tight">Unit</th>
                                            <th className="py-1.5 px-2 text-[10px] sm:text-[11px] font-black uppercase text-slate-500 w-[25%] text-right tracking-tight">Ref. Range</th>
                                          </tr></thead>
                                          <tbody className="divide-y divide-gray-100 !bg-white">{params.map((res, i) => {
                                            const f = getFlag(res.value, res.range); const isAbn = f === 'H' || f === 'L';
                                            return (<tr key={i} className={`bg-white ${isAbn ? 'font-bold' : ''}`}>
                                              <td className="py-1 px-2 text-[12px] sm:text-[13px] text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis">{res.parameter}</td>
                                              <td className="py-1 px-2">
                                                {(() => {
                                                  const valStr = (res.value || '').toUpperCase();
                                                  const isPos = valStr.includes('POSITIVE') || (valStr.includes('REACTIVE') && !valStr.includes('NON-REACTIVE'));
                                                  const isNeg = valStr.includes('NEGATIVE') || valStr.includes('NON-REACTIVE');
                                                  if (isPos) return <span className="text-[10px] sm:text-[11px] text-rose-600 font-black">{res.value}</span>;
                                                  if (isNeg) return <span className="text-[10px] sm:text-[11px] text-emerald-600 font-black">{res.value}</span>;
                                                  return (
                                                    <span className={`text-[10px] sm:text-[11px] ${isAbn ? (f==='H'?'text-rose-600 font-black':'text-blue-600 font-black') : 'text-gray-800 font-bold'}`}>
                                                      {res.value || '-'}
                                                    </span>
                                                  );
                                                })()}
                                              </td>
                                              <td className="py-1 px-2 text-center leading-none"><span className={`text-[10px] sm:text-[11px] font-bold ${isAbn ? (f==='H'?'text-rose-600':'text-blue-600') : 'text-emerald-600'}`}>{f}</span></td>
                                              <td className="py-1 px-2 text-[10px] sm:text-[11px] font-semibold text-slate-500">{res.unit || '-'}</td>
                                              <td className={`py-1 px-2 text-[10px] sm:text-[11px] text-right tabular-nums ${isAbn ? 'font-bold text-gray-900 border-gray-100 pl-2' : 'text-gray-500 font-medium'}`}>{res.range || '-'}</td>
                                            </tr>)
                                          })}</tbody>
                                        </table>
                                      </div>
                                   )}
                                </div>
                              );
                           })}
                        </div>
                       </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="mt-16 mb-10 flex flex-col items-center !bg-white">
                 <div className="flex items-center gap-4 mb-2">
                    <div className="h-px w-20 bg-gray-200"></div>
                    <p className="text-[13px] font-black text-gray-900 tracking-[0.3em] uppercase">End of Report</p>
                    <div className="h-px w-20 bg-gray-200"></div>
                 </div>
                 <div className="w-full mt-12 pt-6 border-t border-gray-100 text-center">
                    <p className="text-[10px] text-gray-400 italic font-medium">This is an electronically generated report. Clinical correlation is recommended.</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-bold uppercase tracking-wider">Printed On: {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                 </div>
              </div>
            </section>

            <footer className="px-6 pb-12 mt-auto !bg-white relative z-10">
              {labProfile?.reportSettings?.useCustomFooter && labProfile?.reportSettings?.footerImage && (
                <div className="w-full mb-8 border-t border-gray-100 pt-4">
                  <img 
                    src={labProfile.reportSettings.footerImage} 
                    alt="Lab Footer" 
                    className="w-full h-auto max-h-24 object-contain"
                  />
                </div>
              )}
              <div className="flex justify-between items-end !bg-white pt-4">
                 <div className="opacity-70 grayscale hover:grayscale-0 transition-all"><QRCodeComponent value={qrUrl} size={65} /></div>
                 <div className="text-right flex flex-col items-end">
                    <div className="w-64 h-[1.5px] bg-gray-800 mb-2"></div>
                    <p className="text-[13px] font-black text-gray-900 uppercase tracking-tighter">Authorized Signatory</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Diagnostic Pathology Dept.</p>
                 </div>
              </div>
            </footer>
          </div>
        </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print { 
          html, body { height: auto !important; background: white !important; margin: 0 !important; } 
          body * { visibility: hidden !important; } 
          .printable-page, .printable-page * { visibility: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
          .printable-page { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; z-index: 10; background: transparent !important; } 
          .watermark-layer { 
            position: fixed !important; 
            top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important;
            display: flex !important; align-items: center !important; justify-content: center !important;
            z-index: 0 !important;
            visibility: visible !important;
          }
          @page { size: A4 portrait; margin: 6mm; } 
        }
      `}} />
    </div>
  );
};

export default ReportPreview;
