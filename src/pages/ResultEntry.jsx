import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs, serverTimestamp, orderBy, writeBatch } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Loader, Save, ArrowLeft, AlertCircle, CheckCircle2, Info, Send, 
  History, Calendar, Search, Maximize2, User, Copy, FileText, 
  MessageSquare, ChevronRight, LayoutDashboard, Database, Activity,
  Stethoscope, Thermometer, FlaskConical, Droplets, ArrowDown, ArrowUp,
  ChevronDown, Plus
} from 'lucide-react';

const ResultEntry = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userData, activeLabId } = useAuth();
  
  const [booking, setBooking] = useState(null);
  const [patient, setPatient] = useState(null);
  const [report, setReport] = useState(null);
  const [parameters, setParameters] = useState([]);
  const [rules, setRules] = useState([]);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [allReports, setAllReports] = useState([]);
  const [reportDocIds, setReportDocIds] = useState({});
  
  // New UI states
  const [activeTestId, setActiveTestId] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState([]);
  const [focusedParamId, setFocusedParamId] = useState(null);
  const [technicianComment, setTechnicianComment] = useState('');

  const handleResultChange = (tid, paramId, value) => {
    setResults(prev => ({ ...prev, [`${tid}_${paramId}`]: value }));
  };

  const handleUpdateGridValue = (tid, paramId, titer, value) => {
    let currentData = {};
    const key = `${tid}_${paramId}`;
    try {
      currentData = JSON.parse(results[key] || '{}');
    } catch (e) {
      currentData = {};
    }
    
    const newData = { ...currentData, [titer]: value };
    setResults(prev => ({ ...prev, [key]: JSON.stringify(newData) }));
  };

  const resultsArrayToMap = (arr) => {
    if (!Array.isArray(arr)) return {};
    return arr.reduce((acc, curr) => {
      acc[curr.id] = curr.value;
      return acc;
    }, {});
  };

  const resultsMapToArray = (map) => {
    return Object.keys(map).map(id => ({
      id,
      value: map[id]
    }));
  };

  const toggleExpandAll = () => {
    const groups = [...new Set(activeParameters.map(p => p.groupName).filter(Boolean))];
    if (collapsedGroups.length > 0) {
      setCollapsedGroups([]);
    } else {
      setCollapsedGroups(groups);
    }
  };

  const toggleGroup = (groupName) => {
    if (!groupName) return;
    setCollapsedGroups(prev => 
      prev.includes(groupName) 
        ? prev.filter(g => g !== groupName) 
        : [...prev, groupName]
    );
  };

  useEffect(() => {
    if (bookingId && activeLabId) {
      fetchData();
    }
  }, [bookingId, activeLabId]);

  // Handle ESC key to go back
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        navigate(-1);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Booking by billId (the common logical ID used in the app)
      const bQuery = query(
        collection(db, 'bookings'), 
        where('billId', '==', bookingId), 
        where('labId', '==', activeLabId)
      );
      const bSnap = await getDocs(bQuery);
      
      let bData = null;
      if (!bSnap.empty) {
        bData = bSnap.docs[0].data();
      } else {
        // Fallback: Try searching by bookingId field
        const bQuery2 = query(
          collection(db, 'bookings'), 
          where('bookingId', '==', bookingId), 
          where('labId', '==', activeLabId)
        );
        const bSnap2 = await getDocs(bQuery2);
        if (!bSnap2.empty) {
          bData = bSnap2.docs[0].data();
        }
      }

      if (!bData) {
        console.error("Booking not found in Firestore for ID:", bookingId);
        alert("Booking not found");
        return navigate('/reports');
      }

      setBooking(bData);

      // 2. Fetch all reports for this booking/bill
      const bookingNo = bData.bookingNo || bData.bookingId;
      
      const rQuery = query(
        collection(db, 'reports'), 
        where('bookingNo', '==', bookingNo), 
        where('labId', '==', activeLabId)
      );
      const rSnap = await getDocs(rQuery);
      
      if (!rSnap.empty) {
        const reportsData = rSnap.docs.map(doc => ({ ...doc.data(), _id: doc.id }));
        setAllReports(reportsData);

        // Load ALL results from ALL reports into a single global map with unique keys (testId_paramId)
        const globalResultsMap = {};
        const testNamesArr = Array.isArray(bData.testNames) 
          ? bData.testNames 
          : (typeof bData.testNames === 'string' ? bData.testNames.split(', ') : []);

        reportsData.forEach(rep => {
          if (Array.isArray(rep.results)) {
            const testIdx = testNamesArr.indexOf(rep.testName);
            const tid = (testIdx !== -1 && bData.testIds) ? bData.testIds[testIdx] : null;
            
            rep.results.forEach(res => {
              if (res.parameterId && tid) {
                globalResultsMap[`${tid}_${res.parameterId}`] = res.value;
              }
            });
          }
        });
        setResults(globalResultsMap);
        
        // Match active test
        const activeTestIdx = bData.testIds?.indexOf(activeTestId) !== -1 ? bData.testIds.indexOf(activeTestId) : 0;
        const activeTestName = Array.isArray(bData.testNames) 
          ? bData.testNames[activeTestIdx] 
          : (typeof bData.testNames === 'string' ? bData.testNames.split(', ')[activeTestIdx] : '');
        
        const matched = reportsData.find(r => r.testName?.toUpperCase().trim() === activeTestName.toUpperCase().trim());
        if (matched) {
          setReport(matched);
          setTechnicianComment(matched.technicianComment || '');
        }
      } else {
        setAllReports([]);
      }

      const patientDoc = await getDoc(doc(db, 'patients', bData.patientId));
      setPatient(patientDoc.exists() ? patientDoc.data() : null);

      // 3. Fetch Test Definitions (Parameters & Rules are embedded here)
      const paramsList = [];
      const rulesList = [];
      
      if (bData.testIds && bData.testIds.length > 0) {
        for (const tid of bData.testIds) {
          const tDoc = await getDoc(doc(db, 'tests', tid));
          
          if (tDoc.exists()) {
            const tData = tDoc.data();
            
            // Extract parameters from groups
            if (Array.isArray(tData.groups)) {
              tData.groups.forEach(group => {
                if (Array.isArray(group.parameters)) {
                  group.parameters.forEach(param => {
                    // Normalize parameter for the UI
                    const normalizedParam = {
                      ...param,
                      id: param.code || param.name, 
                      testId: tid,
                      groupName: (group.group_name || group.groupName || group.name || '').trim(),
                      groupOrder: Number(group.group_order || group.groupOrder || 0),
                      paramOrder: Number(param.order || param.sort_order || 0)
                    };
                    paramsList.push(normalizedParam);
                    
                    // Extract rules if present
                    if (Array.isArray(param.rules)) {
                      param.rules.forEach(rule => {
                        rulesList.push({
                          ...rule,
                          parameterId: normalizedParam.id,
                          testId: tid
                        });
                      });
                    }
                  });
                }
              });
            }
          }
        }
      }

      // Sort parameters by group order then parameter order
      paramsList.sort((a, b) => {
        if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
        return a.paramOrder - b.paramOrder;
      });
      
      setParameters(paramsList);
      setRules(rulesList);
      
      if (bData.testIds?.length > 0 && !activeTestId) {
        setActiveTestId(bData.testIds[0]);
      }

    } catch (error) {
      // Error handled by UI
    } finally {
      setLoading(false);
    }
  };

  // Sync metadata when switching tests - Preserve global results state
  useEffect(() => {
    if (activeTestId && allReports.length > 0) {
      const activeTestIdx = booking?.testIds?.indexOf(activeTestId);
      const activeTestName = (Array.isArray(booking?.testNames) 
        ? booking.testNames[activeTestIdx] 
        : (typeof booking?.testNames === 'string' ? booking.testNames.split(', ')[activeTestIdx] : '')) || '';
      
      const matchedReport = allReports.find(r => r.testName?.toUpperCase().trim() === activeTestName.toUpperCase().trim());
      if (matchedReport) {
        setReport(matchedReport);
        setTechnicianComment(matchedReport.technicianComment || '');
      }
    }
  }, [activeTestId, allReports, booking]);

  const getRefRange = (parameter) => {
    // Find matching rule based on patient demographics (gender, age)
    const matchingRules = rules.filter(r => {
      if (r.parameterId !== parameter.id) return false;
      if (r.gender !== 'Any' && r.gender !== 'Both' && patient && r.gender !== patient.gender) return false;
      if (patient) {
        const age = patient.age;
        // Basic age matching (assumes rule age is in years)
        if (age < r.ageMin || age > r.ageMax) return false;
      }
      return true;
    });

    const rule = matchingRules[0];
    return rule ? rule.normalRange : '---';
  };

  const getValidation = (parameter, value) => {
    if (!value || isNaN(value)) return null;
    const val = parseFloat(value);
    
    // Find matching rule based on patient demographics
    const matchingRules = rules.filter(r => {
      if (r.parameterId !== parameter.id) return false;
      if (r.gender !== 'Any' && r.gender !== 'Both' && patient && r.gender !== patient.gender) return false;
      if (patient) {
        const age = patient.age;
        if (age < r.ageMin || age > r.ageMax) return false;
      }
      return true;
    });

    const rule = matchingRules[0];
    if (!rule) return null;

    // Parse range (handles "min - max" or "min-max" formats)
    const rangeParts = rule.normalRange.split('-').map(s => s.trim()).map(parseFloat);
    const min = rangeParts[0];
    const max = rangeParts[1];
    
    const criticalLow = parseFloat(rule.criticalLow);
    const criticalHigh = parseFloat(rule.criticalHigh);

    if (val <= criticalLow || val >= criticalHigh) {
        return { 
            status: 'Critical', 
            label: 'Critical', 
            color: 'text-rose-600', 
            bg: 'bg-rose-50', 
            indicator: <ArrowDown className="w-3 h-3" />,
            icon: <AlertCircle className="w-3.5 h-3.5 text-rose-500" />,
            range: rule.normalRange
        };
    }
    if (val < min) {
        return { 
            status: 'Low', 
            label: 'Low', 
            color: 'text-amber-600', 
            bg: 'bg-amber-50', 
            indicator: <ArrowDown className="w-3 h-3" />,
            icon: <ArrowDown className="w-3.5 h-3.5 text-amber-500" />,
            range: rule.normalRange
        };
    }
    if (val > max) {
        return { 
            status: 'High', 
            label: 'High', 
            color: 'text-orange-600', 
            bg: 'bg-orange-50', 
            indicator: <ArrowUp className="w-3 h-3" />,
            icon: <ArrowUp className="w-3.5 h-3.5 text-orange-500" />,
            range: rule.normalRange
        };
    }
    
    return { 
        status: 'Normal', 
        label: 'Normal', 
        color: 'text-[#8bc971]', 
        bg: 'bg-green-50', 
        indicator: null,
        icon: <div className="w-2 h-2 bg-[#8bc971] rounded-full" />,
        range: rule.normalRange
    };
  };

  const handleSave = async () => {
    if (!booking || !isAllTestsComplete) return;
    setIsFinalizing(true);
    try {
      const batch = writeBatch(db);
      const bookingNo = booking.bookingNo || booking.bookingId;
      const bDocId = `${activeLabId}_${bookingNo}`;

      const testNamesArr = Array.isArray(booking.testNames) 
        ? booking.testNames 
        : (typeof booking.testNames === 'string' ? booking.testNames.split(', ') : []);

      for (const rep of allReports) {
        const testIdx = testNamesArr.indexOf(rep.testName);
        if (testIdx === -1) continue;
        
        const testId = booking.testIds[testIdx];
        const testParams = parameters.filter(p => p.testId === testId);
        
        const testDetail = Array.isArray(booking.tests_detail) 
          ? booking.tests_detail.find(td => td.name === rep.testName)
          : null;
        const testPrice = testDetail?.price || 0;

        const reportResults = testParams.map(p => {
          const resValue = results[`${testId}_${p.id}`] || '';
          return {
            parameterId: p.id,
            name: p.name,
            parameter: p.name,
            value: resValue,
            unit: p.unit || '',
            range: getRefRange(p),
            status: getValidation(p, resValue)?.status || 'Normal',
            groupName: p.groupName || 'General'
          };
        });

        const reportDocId = rep._id;
        if (!reportDocId) continue;
        
        batch.update(doc(db, 'reports', reportDocId), {
          results: reportResults,
          technicianComment: technicianComment || '',
          status: 'Final',
          price: testPrice,
          totalAmount: booking.totalAmount || 0,
          reported_at: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      batch.update(doc(db, 'bookings', bDocId), { 
        updatedAt: serverTimestamp(),
        status: 'Final' 
      });

      await batch.commit();
      queryClient.invalidateQueries({ queryKey: ['reportsAndBookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success("All Reports Finalized Successfully!");
      navigate('/reports');
    } catch (error) {
      toast.error("Failed to finalize: " + error.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!booking) return;
    setIsSavingDraft(true);
    try {
      const batch = writeBatch(db);
      const testNamesArr = Array.isArray(booking.testNames) 
        ? booking.testNames 
        : (typeof booking.testNames === 'string' ? booking.testNames.split(', ') : []);

      for (const rep of allReports) {
        const testIdx = testNamesArr.indexOf(rep.testName);
        if (testIdx === -1) continue;
        
        const testId = booking.testIds[testIdx];
        const testParams = parameters.filter(p => p.testId === testId);
        
        const reportResults = testParams.map(p => {
          const resValue = results[`${testId}_${p.id}`] || '';
          return {
            parameterId: p.id,
            name: p.name,
            parameter: p.name,
            value: resValue,
            unit: p.unit || '',
            range: getRefRange(p),
            status: getValidation(p, resValue)?.status || 'Normal',
            groupName: p.groupName || 'General'
          };
        });

        const reportDocId = rep._id;
        if (!reportDocId) continue;
        
        batch.update(doc(db, 'reports', reportDocId), {
          results: reportResults,
          technicianComment: technicianComment || '',
          status: 'In Progress',
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      queryClient.invalidateQueries({ queryKey: ['reportsAndBookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success("Draft Saved Successfully!");
    } catch (error) {
      toast.error("Failed to save draft: " + error.message);
    } finally {
      setIsSavingDraft(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Loader className="w-8 h-8 animate-spin text-brand-dark" />
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Hydrating Workspace...</p>
      </div>
    </div>
  );

  const activeParameters = parameters.filter(p => {
    const match = p.testId === activeTestId;
    return match;
  });

   // Smart Progress Calculation - Titer/Widal tests are considered 'Auto-Complete'
   const isTiter = (p) => {
     const tName = (Array.isArray(booking?.testNames) 
       ? booking.testNames[booking?.testIds?.indexOf(p.testId)] 
       : (typeof booking?.testNames === 'string' ? booking.testNames.split(', ')[booking?.testIds?.indexOf(p.testId)] : '')) || '';
     return p.dataType === 'Grid' || p.dataType === 'Titer' || tName.toUpperCase().includes('WIDAL');
   };

   const filledCount = parameters.filter(p => isTiter(p) || (results[`${p.testId}_${p.id}`] && results[`${p.testId}_${p.id}`].toString().trim() !== '')).length;
   const totalCount = parameters.length;
   const progress = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;
   const isAllTestsComplete = totalCount > 0 && filledCount === totalCount;
   
   // Helper to check if a specific test tab is complete
   const isTestTabComplete = (testId) => {
     const testParams = parameters.filter(p => p.testId === testId);
     return testParams.length > 0 && testParams.every(p => isTiter(p) || (results[`${p.testId}_${p.id}`] && results[`${p.testId}_${p.id}`].toString().trim() !== ''));
   };
  
  const selectedParam = parameters.find(p => p.id === focusedParamId);

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden uppercase">
      <div className="max-w-[1700px] mx-auto w-full flex-1 flex flex-col overflow-hidden p-2 md:p-3 space-y-2">
      
      {/* 1. TOP HEADER & BREADCRUMBS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-primary/10 rounded-md flex items-center justify-center border border-brand-primary/20">
            <FileText className="w-4 h-4 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold text-brand-dark tracking-tight leading-none">Report Entry</h1>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              <Link to="/dashboard" className="hover:text-brand-dark">Dashboard</Link>
              <ChevronRight className="w-2 h-2" />
              <Link to="/reports" className="hover:text-brand-dark">Reports</Link>
              <ChevronRight className="w-2 h-2" />
              <span className="text-slate-500">Entry</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 bg-white border border-slate-200 rounded-md text-[9px] font-semibold text-brand-dark hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
            <History className="w-3 h-3" /> History
          </button>
          <button className="px-3 py-1 bg-white border border-slate-200 rounded-md text-[9px] font-semibold text-brand-dark flex items-center gap-2 shadow-sm">
            <Calendar className="w-3 h-3" /> 23 Apr, 2026
          </button>
        </div>
      </div>

      {/* 2. PATIENT INFO BAR */}
      <div className="bg-white p-0.5 rounded-sm border border-slate-200 shadow-sm flex flex-wrap items-center shrink-0">
        <div className="flex items-center gap-1.5 px-3 border-r border-slate-100 h-11 bg-slate-50/50">
           <User className="w-3.5 h-3.5 text-brand-primary" />
           <p className="text-[10px] font-black text-brand-dark uppercase tracking-[0.15em]">Patient</p>
        </div>
        
        <div className="px-4 py-1.5 border-r border-slate-100 flex flex-col justify-start h-11 min-w-[140px]">
          <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5 leading-none">Patient Name</p>
          <p className="text-[12px] font-bold text-brand-dark leading-tight truncate">{booking?.patientName}</p>
        </div>
        <div className="px-4 py-1.5 border-r border-slate-100 flex flex-col justify-start h-11 min-w-[110px]">
          <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5 leading-none">Age / Gender</p>
          <p className="text-[12px] font-bold text-brand-dark leading-tight">{patient?.age} {patient?.ageUnit || 'Years'} / {patient?.gender}</p>
        </div>
        <div className="px-4 py-1.5 border-r border-slate-100 flex flex-col justify-start h-11 min-w-[120px]">
          <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5 leading-none">Patient ID</p>
          <p className="text-[11px] font-bold text-brand-dark leading-tight truncate">{booking?.patientId || '---'}</p>
        </div>
        <div className="px-4 py-1.5 border-r border-slate-100 flex flex-col justify-start h-11 min-w-[100px]">
          <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5 leading-none">Booking ID</p>
          <p className="text-[12px] font-bold text-brand-primary leading-tight">{booking?.billId || bookingId}</p>
        </div>
        <div className="px-4 py-1.5 border-r border-slate-100 flex flex-col justify-start h-11 min-w-[90px]">
          <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5 leading-none">Sample Type</p>
          <p className="text-[12px] font-bold text-brand-dark leading-tight">{report?.sampleType || 'Blood'}</p>
        </div>
        <div className="px-4 py-1.5 flex flex-col justify-start h-11 min-w-[130px]">
          <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5 leading-none">Collected On</p>
          <p className="text-[11px] font-bold text-brand-dark leading-tight whitespace-nowrap">23 Apr, 2026 <span className="text-slate-400 font-medium ml-1">09:15 AM</span></p>
        </div>
      </div>

      {/* 3. TEST SELECTION TABS (MINI) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar px-0.5 shrink-0 min-h-[38px]">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2 shrink-0">Selected Tests</p>
        {Array.isArray(booking?.testIds) && booking.testIds.map((tid, idx) => {
          const name = Array.isArray(booking?.testNames) 
            ? booking.testNames[idx] 
            : (typeof booking.testNames === 'string' ? booking.testNames.split(', ')[idx] : 'Test');
          
          const isComplete = isTestTabComplete(tid);
          const isActive = activeTestId === tid;
          
          return (
            <button
              key={idx}
              onClick={() => setActiveTestId(tid)}
              className={`px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all border flex-shrink-0 flex items-center gap-1.5 
                ${isActive 
                  ? 'bg-brand-dark text-white border-brand-dark shadow-sm' 
                  : isComplete 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
              {isComplete ? (
                <CheckCircle2 className={`w-3 h-3 ${isActive ? 'text-brand-primary' : 'text-emerald-500'}`} />
              ) : (
                <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white/40' : 'bg-slate-300'}`} />
              )}
              {name}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0 overflow-hidden">
        
        {/* MAIN COLUMN */}
        <div className="flex-1 space-y-2 w-full min-h-0 flex flex-col overflow-hidden">
          
          {/* 4. ACTIVE TEST HEADER & OPTIONS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-brand-primary rounded-full" />
              <h2 className="text-sm font-bold text-brand-dark tracking-tight uppercase">
                {(Array.isArray(booking?.testNames) 
                  ? booking.testNames[booking?.testIds?.indexOf(activeTestId)] 
                  : (typeof booking.testNames === 'string' ? booking.testNames.split(', ')[booking?.testIds?.indexOf(activeTestId)] : 'Analysis')) || 'Result Entry'}
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={toggleExpandAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-500 hover:text-brand-dark transition-all shadow-sm"
              >
                {collapsedGroups.length > 0 ? (
                  <><Plus className="w-3.5 h-3.5" /> Expand All</>
                ) : (
                  <><Maximize2 className="w-3.5 h-3.5" /> Collapse All</>
                )}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-sm border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-50 text-brand-dark text-[11px] font-bold uppercase tracking-widest border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5 w-48 border-r border-slate-200 bg-slate-50">Parameter</th>
                    <th className="px-3 py-2.5 text-center border-r border-slate-200 bg-slate-50">Result</th>
                    <th className="px-1.5 py-2.5 w-12 text-center border-r border-slate-200 bg-slate-50">Unit</th>
                    <th className="px-1.5 py-2.5 w-20 text-center bg-slate-50">Ref Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                {activeParameters.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-3 py-8 text-center text-slate-400 font-medium italic text-[10px]">
                      No parameters defined
                    </td>
                  </tr>
                ) : (() => {
                  const activeTestName = (Array.isArray(booking?.testNames) 
                    ? booking.testNames[booking?.testIds?.indexOf(activeTestId)] 
                    : (typeof booking.testNames === 'string' ? booking.testNames.split(', ')[booking?.testIds?.indexOf(activeTestId)] : '')) || '';
                  
                  const isTestTitration = activeTestName.toUpperCase().includes('WIDAL');
                  let lastGroupName = '';

                  return (
                    <>
                      {isTestTitration && (
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <td className="px-4 py-1.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Titration Scales</td>
                          <td className="px-3 py-1.5 text-center">
                             <div className="grid grid-cols-5 gap-1.5 w-full">
                               {["1:20", "1:40", "1:80", "1:160", "1:320"].map(t => (
                                 <div key={t} className="text-[11px] font-bold text-brand-dark text-center uppercase py-1 border-x border-slate-100 bg-white/50">{t}</div>
                               ))}
                             </div>
                          </td>
                          <td colSpan="2"></td>
                        </tr>
                      )}
                      {activeParameters.map((param, idx) => {
                        const showGroupHeader = param.groupName && param.groupName !== lastGroupName;
                        lastGroupName = param.groupName;
                        const val = results[`${param.testId}_${param.id}`] || '';
                        const validation = getValidation(param, val);
                        const isTitration = isTestTitration || 
                                           param.dataType === 'Grid' || 
                                           param.dataType === 'Titer';
                        
                        let gridData = {};
                        if (isTitration) {
                          try { gridData = JSON.parse(val || '{}'); } catch (e) { gridData = {}; }
                        }
                    
                    return (
                      <React.Fragment key={param.id}>
                        {showGroupHeader && (
                          <tr 
                            onClick={() => toggleGroup(param.groupName)}
                            className="bg-[#e8f0fe] cursor-pointer hover:bg-[#d0e1fd] transition-colors"
                          >
                            <td colSpan="4" className="px-3 py-1.5 border-y border-slate-200">
                               <div className="flex items-center justify-between w-full">
                                 <span className="text-[10px] font-bold text-brand-dark uppercase tracking-wider">{param.groupName}</span>
                                 <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsedGroups.includes(param.groupName) ? '-rotate-90 text-slate-400' : 'text-brand-dark'}`} />
                               </div>
                            </td>
                          </tr>
                        )}
                        {!collapsedGroups.includes(param.groupName) && (
                          <tr 
                            className={`group transition-colors border-b border-slate-200 relative ${focusedParamId === param.id ? 'bg-brand-primary/10' : 'hover:bg-slate-50/30'}`}
                          >
                          <td className="px-3 py-1 relative border-r border-slate-200">
                             {focusedParamId === param.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-primary" />}
                             <p className="text-[11px] font-bold text-brand-dark leading-tight uppercase">{param.name}</p>
                          </td>
                          <td className="px-3 py-1 border-r border-slate-200">
                            {isTitration ? (
                              <div className="grid grid-cols-5 gap-1.5 w-full py-0.5">
                                {["1:20", "1:40", "1:80", "1:160", "1:320"].map(t => {
                                  const cellVal = gridData[t] || '-';
                                  const isReactive = cellVal !== '-' && !['NEGATIVE','NEG','NIL','NORMAL'].includes(cellVal.toUpperCase());
                                  return (
                                    <div key={t} className="relative flex flex-col gap-0 group/sel">
                                      <select 
                                        value={cellVal}
                                        onFocus={() => setFocusedParamId(param.id)}
                                        onChange={(e) => handleUpdateGridValue(param.testId, param.id, t, e.target.value)}
                                        className={`w-full appearance-none border rounded-[2px] py-0.5 pl-2 pr-6 text-[12px] font-bold text-center outline-none transition-all focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary shadow-sm ${isReactive ? 'bg-rose-50 border-rose-400 text-rose-600' : 'bg-slate-50/50 border-slate-400 text-slate-500 hover:border-brand-dark/40'}`}
                                      >
                                        {["-", "REACTIVE", "WEAKLY"].map(opt => (
                                          <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                      </select>
                                      <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover/sel:text-slate-600">
                                        <ChevronDown className="w-2.5 h-2.5" />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : param.dataType === 'Qualitative' || param.dataType === 'Semi-Quantitative' || (param.allowedOptions && param.allowedOptions.trim().length > 0) ? (
                              <div className="flex justify-center relative group/sel w-28 mx-auto">
                                <select 
                                  value={val}
                                  onFocus={() => setFocusedParamId(param.id)}
                                  onChange={(e) => handleResultChange(param.testId, param.id, e.target.value)}
                                  className={`w-full appearance-none border rounded-[2px] py-0.5 pl-2 pr-6 text-[12px] font-bold text-center outline-none transition-all focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary shadow-sm ${
                                    (val.toUpperCase().includes('POSITIVE') || val.toUpperCase().includes('REACTIVE') || val.trim() === '+') && !val.toUpperCase().includes('NON-REACTIVE')
                                      ? 'bg-rose-50 border-rose-400 text-rose-600'
                                      : (val.toUpperCase().includes('NEGATIVE') || val.toUpperCase().includes('NON-REACTIVE') || val.trim() === '-')
                                        ? 'bg-emerald-50 border-emerald-400 text-emerald-600'
                                        : 'bg-white border-slate-300 text-slate-700 hover:border-brand-dark/40'
                                  }`}
                                >
                                  <option value="">---</option>
                                  {(() => {
                                    const opts = (param.allowedOptions || '')
                                      .split(',')
                                      .map(s => s.trim())
                                      .filter(s => s);
                                    if (opts.length === 0 && (param.dataType === 'Qualitative' || param.dataType === 'Semi-Quantitative')) {
                                      opts.push('POSITIVE', 'NEGATIVE');
                                    }
                                    return opts.map(opt => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ));
                                  })()}
                                </select>
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover/sel:text-slate-600">
                                  <ChevronDown className="w-2.5 h-2.5" />
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                <input 
                                  type="text" 
                                  className={`w-28 bg-white border border-slate-300 rounded-[2px] px-3 py-0.5 text-[12px] font-bold text-center outline-none transition-all focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary shadow-sm ${validation ? `${validation.bg} ${validation.color} !border-${validation.color.split('-')[1]}-400/30` : 'text-brand-dark hover:border-slate-400'}`}
                                  value={val}
                                  onChange={(e) => handleResultChange(param.testId, param.id, e.target.value)}
                                  onFocus={() => setFocusedParamId(param.id)}
                                  placeholder="---"
                                />
                              </div>
                            )}
                          </td>
                          <td className="px-1.5 py-1 text-[9px] font-semibold text-slate-500 text-center">{isTitration ? 'Titer' : (param.unit || '---')}</td>
                          <td className="px-1.5 py-1 text-[9px] font-semibold text-slate-500 text-center">{isTitration ? 'Up to 1:80' : getRefRange(param)}</td>
                        </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>

        </div>

        {/* SIDE PANEL (PARAMETER DETAILS) */}
        <div className="w-full lg:w-56 space-y-1.5 flex-shrink-0 lg:overflow-y-auto lg:max-h-full">
          <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-50 px-2 py-1 border-b border-slate-100">
               <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Reference</p>
            </div>
            <div className="p-2 space-y-1.5">
              {selectedParam ? (
                <>
                  <div>
                    <h3 className="text-[12px] font-bold text-brand-dark leading-tight">{selectedParam.name}</h3>
                    <p className="text-[8px] font-semibold text-slate-400">Biological Reference</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                     <div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Unit</p>
                        <p className="text-[11px] font-bold text-brand-dark">{selectedParam.unit || '---'}</p>
                     </div>
                     <div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Range</p>
                        <p className="text-[11px] font-bold text-brand-dark">{getRefRange(selectedParam)}</p>
                     </div>
                  </div>
                </>
              ) : (
                <div className="py-4 text-center space-y-1">
                   <Search className="w-3.5 h-3.5 text-slate-200 mx-auto" />
                   <p className="text-[8px] font-bold text-slate-300 uppercase tracking-wider">
                     Select Field
                   </p>
                </div>
              )}
            </div>
          </div>
 
           <div className="bg-white p-1.5 rounded-md border border-slate-200 shadow-sm">
             <div className="flex items-center gap-1 mb-0.5">
               <MessageSquare className="w-2.5 h-2.5 text-slate-400" />
               <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Observations</p>
             </div>
             <textarea 
               value={technicianComment}
               onChange={(e) => setTechnicianComment(e.target.value)}
               className="w-full h-8 bg-slate-50 border border-slate-200 rounded-sm p-1.5 text-[10px] font-medium text-brand-dark outline-none focus:bg-white focus:border-brand-primary transition-all placeholder:text-slate-300 resize-none"
               placeholder="Notes..."
             />
          </div>

          <div className="bg-white p-1.5 rounded-md border border-slate-200 shadow-sm space-y-1">
             <div className="flex items-center justify-between">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Progress</p>
                <p className="text-[9px] font-bold text-brand-dark uppercase tracking-tighter">{filledCount}/{totalCount}</p>
             </div>
             <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                <div 
                  className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-brand-primary' : 'bg-amber-400'}`} 
                  style={{ width: `${progress}%` }} 
                />
             </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <button 
              onClick={handleSaveDraft}
              disabled={isSavingDraft || isFinalizing}
              className={`w-full px-3 py-2 bg-white border border-slate-200 text-brand-dark rounded-[2px] text-[10px] font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50`}
            >
              {isSavingDraft ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </button>

            <button 
              onClick={handleSave}
              disabled={isSavingDraft || isFinalizing || !isAllTestsComplete}
              className={`w-full px-3 py-2 text-white rounded-[2px] text-[10px] font-bold shadow-md transition-all flex items-center justify-center gap-1.5 uppercase tracking-widest border ${isAllTestsComplete ? 'bg-brand-primary border-brand-primary/20 hover:bg-emerald-500 hover:shadow-lg' : 'bg-slate-300 border-slate-200 cursor-not-allowed opacity-80'}`}
            >
              {isFinalizing ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Finalize Report
            </button>
          </div>
            
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1">
              {isAllTestsComplete ? (
                <>
                  <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse" />
                  <p className="text-[8px] font-black text-brand-dark uppercase tracking-widest">Ready</p>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                  <p className="text-[8px] font-black text-amber-500 uppercase">Pending ({totalCount - filledCount})</p>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => navigate(-1)}
                className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-md text-[9px] font-bold text-slate-700 hover:bg-slate-200 hover:text-brand-dark transition-all shadow-sm uppercase flex items-center justify-center gap-1.5 active:scale-95"
              >
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
              <button 
                onClick={() => navigate('/reports')}
                className="px-2.5 py-1.5 bg-rose-50 border border-rose-100 rounded-md text-[9px] font-bold text-rose-600 hover:bg-rose-100 transition-all shadow-sm uppercase active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        </div>
      </div>
    </div>
  );
};

export default ResultEntry;
