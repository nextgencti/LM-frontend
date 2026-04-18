import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Loader, Save, ArrowLeft, AlertCircle, CheckCircle2, Info, Send } from 'lucide-react';

const ResultEntry = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { userData } = useAuth();
  
  const [booking, setBooking] = useState(null);
  const [patient, setPatient] = useState(null);
  const [report, setReport] = useState(null);
  const [parameters, setParameters] = useState([]);
  const [rules, setRules] = useState([]);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const handleResultChange = (paramId, value) => {
    setResults(prev => ({ ...prev, [paramId]: value }));
  };

  useEffect(() => {
    fetchData();
  }, [bookingId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Booking and Report
      const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
      const reportDoc = await getDoc(doc(db, 'reports', bookingId));
      
      if (!bookingDoc.exists()) {
        alert("Booking not found");
        return navigate('/reports');
      }

      const bData = bookingDoc.data();
      
      // Multi-tenant Security Check
      if (bData.labId !== userData.labId) {
        alert("Access Denied: This booking does not belong to your lab.");
        return navigate('/reports');
      }

      setBooking(bData);
      setReport(reportDoc.exists() ? reportDoc.data() : null);
      setResults(reportDoc.exists() ? reportDoc.data().results || {} : {});

      // 2. Fetch Patient Details for Validation
      const patientDoc = await getDoc(doc(db, 'patients', bData.patientId));
      const pData = patientDoc.exists() ? patientDoc.data() : null;
      setPatient(pData);

      // 3. Fetch Parameters for the Tests in this Booking
      const paramsList = [];
      for (const testId of bData.testIds) {
        const pQuery = query(collection(db, 'testParameters'), where('testId', '==', testId), where('labId', '==', userData.labId));
        const pSnap = await getDocs(pQuery);
        pSnap.forEach(doc => paramsList.push({ id: doc.id, ...doc.data() }));
      }
      setParameters(paramsList);

      // 4. Fetch Rules for these Parameters
      const rulesList = [];
      for (const param of paramsList) {
        const rQuery = query(collection(db, 'parameterRules'), where('parameterId', '==', param.id), where('labId', '==', userData.labId));
        const rSnap = await getDocs(rQuery);
        rSnap.forEach(doc => rulesList.push({ id: doc.id, ...doc.data() }));
      }
      setRules(rulesList);

    } catch (error) {
      console.error("Error fetching entry data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getValidation = (parameter, value) => {
    if (!value || isNaN(value)) return null;
    const val = parseFloat(value);
    
    // Find matching rule based on patient demographics
    const matchingRules = rules.filter(r => {
      if (r.parameterId !== parameter.id) return false;
      
      // Gender match
      if (r.gender !== 'Both' && patient && r.gender !== patient.gender) return false;
      
      // Age match (assuming age stored as number in patient)
      if (patient) {
        const age = patient.age;
        if (age < r.ageMin || age > r.ageMax) return false;
      }
      
      return true;
    });

    // Use the most specific rule (usually the first matching one)
    const rule = matchingRules[0];
    
    if (!rule) return null;

    // Range check
    const [min, max] = rule.normalRange.split('-').map(parseFloat);
    const criticalLow = parseFloat(rule.criticalLow);
    const criticalHigh = parseFloat(rule.criticalHigh);

    if (val <= criticalLow || val >= criticalHigh) return { status: 'Critical', color: 'text-red-600 bg-red-50 border-red-200' };
    if (val < min || val > max) return { status: 'Abnormal', color: 'text-orange-600 bg-orange-50 border-orange-200' };
    
    return { status: 'Normal', color: 'text-green-600 bg-green-50 border-green-200' };
  };

  const generateToken = () => {
    try {
      return window.crypto.randomUUID().replace(/-/g, '') + Date.now().toString(16);
    } catch(e) {
      return Date.now().toString(36) + Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatePayload = {
        results: results,
        status: 'Final',
        reported_at: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      if (report && !report.viewToken) {
        updatePayload.viewToken = generateToken();
      }

      await updateDoc(doc(db, 'reports', bookingId), updatePayload);
      
      // Also update booking status
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'Final'
      });

      alert("Results saved successfully!");
      navigate('/reports');
    } catch (error) {
      console.error("Error saving results:", error);
      alert("Failed to save results.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndNotify = async () => {
    setNotifying(true);
    try {
      // 1. Save Results
      const updatePayload = {
        results: results,
        status: 'Final',
        reported_at: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      if (report && !report.viewToken) {
        updatePayload.viewToken = generateToken();
      }

      await updateDoc(doc(db, 'reports', bookingId), updatePayload);
      
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'Final'
      });

      // 2. Fetch Lab Details (if needed) for the email or fallback to userData
      const labRef = await getDoc(doc(db, 'labs', userData.labId));
      let labName = userData.labId; // fallback
      if (labRef.exists()) labName = labRef.data().labName;

      // 3. Trigger Notification
      const token = localStorage.getItem('jwt_token');
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      
      const payload = {
        to: patient?.email || '', // The notification requires patient email.  If empty, the backend or GAS might fail, but we'll try. 
        patientName: booking?.patientName || 'Patient',
        labName: labName,
        bookingId: bookingId,
        testNames: booking?.testNames || []
      };

      if (!payload.to) {
         alert("Results saved. Patient does not have an email address recorded. Cannot send notification.");
         navigate('/reports');
         return;
      }

      const res = await fetch(`${BACKEND_URL}/api/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send notification');

      alert("Results saved & notification sent successfully!");
      navigate('/reports');
    } catch (error) {
      console.error("Error saving and notifying:", error);
      alert("Results saved, but failed to send notification: " + error.message);
      navigate('/reports');
    } finally {
      setNotifying(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 w-full animate-in fade-in duration-500">
      <button onClick={() => navigate('/reports')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 hover:text-brand-primary transition-all active:scale-95 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> back to reports
      </button>

      <div className="bg-white rounded-[42px] shadow-[0_32px_128px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden mb-12">
        <div className="bg-brand-dark px-10 py-10 flex justify-between items-center relative overflow-hidden">
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
          
          <div className="relative z-10 flex items-center gap-6">
            <div className="p-4 bg-brand-primary rounded-[22px] shadow-lg shadow-brand-primary/20 rotate-3 transition-transform hover:rotate-6">
               <Info className="w-7 h-7 text-white" />
            </div>
            <div>
               <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Result Entry</h1>
               <div className="flex items-center gap-3 mt-1.5 font-black text-[10px] uppercase tracking-[0.3em] text-white/50">
                  <span className="text-brand-primary">Booking ID: #{bookingId}</span>
               </div>
            </div>
          </div>
          <div className="relative z-10 hidden md:block">
             <div className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 bg-brand-primary rounded-full animate-pulse shadow-sm shadow-brand-primary/50"></div>
                Status: {booking?.status}
             </div>
          </div>
        </div>

        {/* Patient Information Bar */}
        <div className="px-10 py-6 bg-brand-light/30 border-b border-brand-primary/5 flex flex-wrap gap-12 items-center">
           <div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Patient Name</div>
              <div className="text-sm font-black text-brand-dark uppercase tracking-wide">{booking?.patientName}</div>
           </div>
           <div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Gender / Age</div>
              <div className="text-sm font-black text-brand-dark uppercase tracking-wide">{patient?.gender} / {patient?.age} {patient?.ageUnit||'YRS'}</div>
           </div>
           <div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tests</div>
              <div className="text-sm font-black text-brand-dark uppercase tracking-widest">{booking?.testNames?.join(', ') || 'N/A'}</div>
           </div>
        </div>

        <div className="p-10 bg-white">
          <div className="space-y-8">
            {parameters.map((param) => {
              const validation = getValidation(param, results[param.id]);
              return (
                <div key={param.id} className={`p-8 rounded-[32px] border transition-all duration-300 ${validation?.status === 'Critical' ? 'bg-rose-50 border-rose-100 shadow-xl shadow-rose-500/5' : validation?.status === 'Abnormal' ? 'bg-amber-50 border-amber-100' : 'bg-slate-50/50 border-slate-100 hover:border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs border ${validation?.status === 'Critical' ? 'bg-white border-rose-200 text-rose-500' : 'bg-white border-slate-200 text-slate-400'}`}>
                         {param.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-brand-dark uppercase tracking-tight">{param.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">{param.unit || 'No Unit'}</span>
                        </div>
                      </div>
                    </div>
                    {validation && (
                      <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border shadow-sm animate-in zoom-in duration-300 ${validation.status === 'Critical' ? 'bg-rose-500 text-white border-rose-600' : validation.status === 'Abnormal' ? 'bg-amber-500 text-white border-amber-600' : 'bg-brand-primary text-white border-brand-primary/50'}`}>
                        {validation.status}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="relative group flex-grow max-w-sm">
                       <input
                        type="number"
                        className={`w-full px-8 py-5 bg-white border rounded-[22px] text-lg font-black outline-none transition-all shadow-inner focus:ring-8 ${validation?.status === 'Critical' ? 'border-rose-200 text-rose-600 focus:ring-rose-500/5 focus:border-rose-500' : 'border-slate-100 text-brand-dark focus:ring-brand-primary/5 focus:border-brand-primary'}`}
                        placeholder="Enter value..."
                        value={results[param.id] || ''}
                        onChange={(e) => handleResultChange(param.id, e.target.value)}
                      />
                      {results[param.id] && (
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 p-2 bg-slate-50 rounded-xl border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                           {param.unit}
                        </div>
                      )}
                    </div>
                    <div className="flex-grow bg-white/60 p-5 rounded-[22px] border border-slate-100/50 flex items-center justify-between shadow-sm">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-brand-light rounded-xl flex items-center justify-center border border-brand-primary/10">
                             <CheckCircle2 className="w-4 h-4 text-brand-primary" />
                          </div>
                          <div>
                             <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-0.5">Normal Range</div>
                             <div className="text-xs font-black text-brand-dark tabular-nums uppercase">{param.defaultRange || '---'} <span className="text-[10px] opacity-40 ml-1">{param.unit}</span></div>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-10 bg-slate-50/50 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex gap-4 w-full md:w-auto">
            <button
              onClick={handleSave}
              disabled={saving || notifying}
              className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-5 bg-white text-brand-dark rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-sm border border-slate-200 hover:border-brand-primary active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 text-brand-primary" />}
              Save Only
            </button>
            <button
              onClick={handleSaveAndNotify}
              disabled={saving || notifying}
              className="flex-1 md:flex-none flex items-center justify-center gap-3 px-10 py-5 bg-brand-primary text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-2xl shadow-brand-primary/20 disabled:opacity-50 active:scale-[0.98] border border-white/10 group"
            >
              {notifying ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 group-hover:scale-110 group-hover:translate-x-1 transition-all" />}
              Save & Notify
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultEntry;
