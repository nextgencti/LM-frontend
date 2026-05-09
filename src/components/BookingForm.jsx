import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Search, Plus, User, Stethoscope, Clock, 
  Trash2, IndianRupee, FileText, CheckCircle, 
  Printer, ArrowRight, MousePointer2, FlaskConical,
  RotateCcw, Save, FileCheck, AlertCircle, Calendar, Phone, Users, Loader, ChevronLeft, ChevronDown
} from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { generateLabId } from '../utils/idGenerator';
import { toast } from 'react-toastify';

const BookingForm = ({ 
  isEditing, 
  editingBookingId, 
  patients, 
  doctors, 
  tests, 
  newBooking, 
  setNewBooking, 
  isSaving, 
  onSave, 
  onClose,
  userData,
  activeLabId,
  refreshData
}) => {
  const [testSearch, setTestSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');

  // Quick Add Modals State
  const [showQuickPatient, setShowQuickPatient] = useState(false);
  const [showQuickDoctor, setShowQuickDoctor] = useState(false);
  const [isSavingQuick, setIsSavingQuick] = useState(false);
  
  const [quickPatient, setQuickPatient] = useState({
    name: '', age: '', ageUnit: 'Years', gender: 'Male', phone: '', email: '', address: '', honorific: 'Mr.', isAuto: true
  });
  
  const [quickDoctor, setQuickDoctor] = useState({
    name: '', phone: '', email: '', clinic: '', specialization: '', commissionType: 'Percentage', commissionValue: '0', honorific: 'Dr.', status: 'Active'
  });

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (showQuickPatient) setShowQuickPatient(false);
        else if (showQuickDoctor) setShowQuickDoctor(false);
        else if (onClose) onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showQuickPatient, showQuickDoctor, onClose]);

  const handleSaveQuickPatient = async (e) => {
    e.preventDefault();
    if (!activeLabId) {
      toast.error("Laboratory context missing.");
      return;
    }
    
    let honorificPrefix = '';
    if (quickPatient.honorific && quickPatient.honorific !== 'None' && quickPatient.honorific !== 'Auto') {
      honorificPrefix = quickPatient.honorific + ' ';
    }
    let finalName = quickPatient.name.trim();
    const allHonorifics = ['Mr.', 'Ms.', 'Mrs.', 'Master', 'Baby', 'Miss', 'Dr.', 'Prof.', 'Shri', 'Smt.'];
    allHonorifics.forEach(h => {
      const regex = new RegExp(`^${h.replace('.', '\\.')}\\s+`, 'i');
      finalName = finalName.replace(regex, '');
    });
    if (honorificPrefix) {
      finalName = honorificPrefix + finalName.trim();
    }

    try {
      setIsSavingQuick(true);
      const finalPid = await generateLabId('PAT', activeLabId);
      const docId = `${activeLabId}_${finalPid}`;
      
      const saveData = {
        name: finalName,
        age: quickPatient.age,
        ageUnit: quickPatient.ageUnit,
        gender: quickPatient.gender,
        phone: quickPatient.phone,
        email: quickPatient.email,
        address: quickPatient.address,
        patientId: finalPid,
        labId: activeLabId,
        updatedAt: serverTimestamp(),
        registered_at: serverTimestamp(),
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'patients', docId), saveData, { merge: true });
      
      if (refreshData) {
        await refreshData();
      }

      // Auto select
      setNewBooking(prev => ({ ...prev, patientId: docId }));
      
      setShowQuickPatient(false);
      setQuickPatient({ name: '', age: '', ageUnit: 'Years', gender: 'Male', phone: '', email: '', address: '', honorific: 'Mr.', isAuto: true });
      toast.success("Patient created and selected!");
    } catch (error) {
      console.error("Error saving patient:", error);
      toast.error("Failed to save patient.");
    } finally {
      setIsSavingQuick(false);
    }
  };

  const handleSaveQuickDoctor = async (e) => {
    e.preventDefault();
    if (!activeLabId) {
      toast.error("Laboratory context missing.");
      return;
    }

    let honorificPrefix = '';
    if (quickDoctor.honorific && quickDoctor.honorific !== 'None') {
      honorificPrefix = quickDoctor.honorific + ' ';
    }
    let formattedName = quickDoctor.name.trim();
    const allHonorifics = ['Mr.', 'Ms.', 'Mrs.', 'Master', 'Baby', 'Miss', 'Dr.', 'Prof.', 'Shri', 'Smt.'];
    allHonorifics.forEach(h => {
      const regex = new RegExp(`^${h.replace('.', '\\.')}\\s+`, 'i');
      formattedName = formattedName.replace(regex, '');
    });
    if (honorificPrefix) {
      formattedName = honorificPrefix + formattedName.trim();
    }

    try {
      setIsSavingQuick(true);
      const doctorDataToSave = {
        ...quickDoctor,
        name: formattedName,
        doctorId: `DOC-${Date.now()}`,
        labId: activeLabId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'doctors'), doctorDataToSave);
      
      if (refreshData) {
        await refreshData();
      }

      // Auto select
      setNewBooking(prev => ({ ...prev, doctorId: docRef.id }));
      
      setShowQuickDoctor(false);
      setQuickDoctor({ name: '', phone: '', email: '', clinic: '', specialization: '', commissionType: 'Percentage', commissionValue: '0', honorific: 'Dr.' });
      toast.success("Doctor created and selected!");
    } catch (error) {
      console.error("Error saving doctor:", error);
      toast.error("Failed to save doctor.");
    } finally {
      setIsSavingQuick(false);
    }
  };

  // Find selected objects for card display
  const selectedPatient = useMemo(() => 
    patients.find(p => p.id === newBooking.patientId), 
    [patients, newBooking.patientId]
  );
  
  const selectedDoctor = useMemo(() => 
    doctors.find(d => d.id === newBooking.doctorId), 
    [doctors, newBooking.doctorId]
  );

  const filteredPatients = useMemo(() => {
    if (!patientSearch) return [];
    return patients.filter(p => 
      p.name?.toLowerCase().includes(patientSearch.toLowerCase()) || 
      p.phone?.includes(patientSearch)
    ).slice(0, 5);
  }, [patients, patientSearch]);

  const filteredTests = useMemo(() => {
    return tests.filter(t => 
      t.testName?.toLowerCase().includes(testSearch.toLowerCase())
    ).slice(0, 10);
  }, [tests, testSearch]);

  const selectedTestsData = useMemo(() => {
    return tests.filter(t => newBooking.testIds.includes(t.id));
  }, [tests, newBooking.testIds]);

  const calculateTotal = (selectedIds) => {
    const subtotal = tests
      .filter(t => selectedIds.includes(t.id))
      .reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);
    const finalTotal = Math.max(subtotal - (newBooking.discount || 0), 0);
    const balance = Math.max(finalTotal - (newBooking.paidAmount || 0), 0);
    
    setNewBooking(prev => ({ 
      ...prev, 
      testIds: selectedIds, 
      subtotal: subtotal,
      totalAmount: finalTotal,
      balance: balance,
      paymentStatus: balance <= 0 ? 'Paid' : 'Unpaid'
    }));
  };

  const handlePaidAmountChange = (val) => {
    const paid = Math.min(parseFloat(val) || 0, newBooking.totalAmount);
    const balance = Math.max(newBooking.totalAmount - paid, 0);
    setNewBooking(prev => ({ 
      ...prev, 
      paidAmount: paid, 
      balance: balance,
      paymentStatus: balance <= 0 ? 'Paid' : 'Unpaid'
    }));
  };

  const handleDiscountChange = (val) => {
    const disc = parseFloat(val) || 0;
    const finalTotal = Math.max(newBooking.subtotal - disc, 0);
    const balance = Math.max(finalTotal - (newBooking.paidAmount || 0), 0);
    setNewBooking(prev => ({ 
      ...prev, 
      discount: disc, 
      totalAmount: finalTotal,
      balance: balance,
      paymentStatus: balance <= 0 ? 'Paid' : 'Unpaid'
    }));
  };

  return (
    <div className="flex flex-col h-full bg-[#F0F7FF]">
      {/* Header Bar */}
      <div className="sticky top-0 z-50 bg-slate-50/95 backdrop-blur-sm px-4 py-1.5 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 mb-0.5 gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-slate-50 border border-slate-200 rounded-[5px] shadow-sm transition-transform hover:scale-110">
            <Calendar className="w-4.5 h-4.5 text-[#1E2A5A]" />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-[#1F2937] leading-tight">
              {isEditing ? 'Modify Booking' : 'New Booking / Registration'}
            </h2>
            <p className="text-[12px] font-medium text-[#7B8794] mt-0.5">Create a new test booking for patient</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button" 
            onClick={onClose}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-[5px] text-[11px] font-semibold text-slate-600 uppercase tracking-wider hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-sm mr-1.5"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
            BACK
          </button>
          <button 
            type="button" 
            onClick={() => {
              setNewBooking({
                patientId: '', doctorId: '', testIds: [], 
                subtotal: 0, discount: 0, totalAmount: 0, paidAmount: 0, 
                status: 'Pending', urgency: 'Routine', notes: '',
                paymentStatus: 'Unpaid', balance: 0
              });
              setPatientSearch('');
              setTestSearch('');
            }}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-[5px] text-[11px] font-semibold text-slate-600 uppercase tracking-wider hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            CLEAR
          </button>
          <button 
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-1.5 bg-[#1E2A5A] text-white rounded-[5px] text-[12px] font-bold uppercase tracking-wider shadow-md shadow-brand-dark/10 hover:bg-brand-secondary transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            SAVE BOOKING
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow px-3 pb-2">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-x-5 gap-y-5">
          
          {/* SECTION 1: Patient Information */}
          <div className="bg-white p-4 rounded-[5px] border border-slate-200 shadow-sm space-y-4 transition-all hover:border-[#1E2A5A]/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-4 bg-[#1E2A5A] rounded-full"></div>
              <h3 className="text-[14px] font-bold text-[#1F2937]">Patient Information</h3>
            </div>
            
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-grow relative group">
                  <input 
                    type="text" 
                    placeholder="Search by name or phone number..."
                    className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-300 rounded-[5px] text-[12px] font-bold text-[#1F2937] outline-none focus:ring-4 focus:ring-[#1E2A5A]/5 focus:border-[#1E2A5A] transition-all placeholder:text-slate-300 shadow-sm"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filteredPatients.length > 0) {
                        e.preventDefault();
                        const p = filteredPatients[0];
                        setNewBooking(prev => ({ ...prev, patientId: p.id }));
                        setPatientSearch('');
                        toast.success(`Patient ${p.name} selected`);
                      }
                    }}
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#98A2B3] group-focus-within:text-[#1E2A5A] transition-colors cursor-pointer" />
                  {filteredPatients.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-100 rounded-[5px] shadow-xl z-50 overflow-hidden divide-y divide-slate-50">
                       {filteredPatients.map(p => (
                         <button 
                          key={p.id}
                          onClick={() => {
                            setNewBooking(prev => ({ ...prev, patientId: p.id }));
                            setPatientSearch('');
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                         >
                           <div>
                             <p className="text-[12px] font-semibold text-[#1b2b4d] leading-none capitalize">{p.name}</p>
                             <p className="text-[10px] font-medium text-slate-400 uppercase mt-0.5">PAT-{p.id.substring(0, 8)}</p>
                           </div>
                           <p className="text-[11px] font-medium text-slate-500 tabular-nums">{p.phone}</p>
                         </button>
                       ))}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setShowQuickPatient(true)}
                  type="button"
                  className="px-4 py-1.5 bg-[#1E2A5A] text-white rounded-[5px] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm hover:bg-brand-secondary transition-all active:scale-95 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  NEW PATIENT
                </button>
              </div>

              {selectedPatient ? (
                <div className="p-2 bg-white rounded-[5px] border border-slate-100 flex gap-2.5 items-center animate-in slide-in-from-top-2 duration-300 shadow-sm">
                  <div className="w-9 h-9 bg-[#f0f9d8] rounded-[5px] flex items-center justify-center text-lg font-bold text-[#1b2b4d] uppercase shrink-0">
                    {selectedPatient.name?.[0]}
                  </div>
                  <div className="flex-grow flex justify-between items-center px-0.5 min-w-0">
                    <div className="space-y-0.5 min-w-0 flex-shrink">
                      <p className="text-[13px] font-bold text-[#1F2937] leading-tight capitalize">{selectedPatient.name}</p>
                      <p className="text-[10px] font-medium text-[#7B8794]">PAT-{selectedPatient.labId || 'XXXX'}</p>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                       <span className="px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#EF4444] text-[9px] font-bold uppercase tracking-wider">
                         {selectedPatient.gender || 'FEMALE'}
                       </span>
                       <p className="text-[11px] font-bold text-[#1F2937] leading-none">{selectedPatient.age || '45'} {selectedPatient.ageUnit || 'Years'}</p>
                    </div>
                    <div className="space-y-0.5 text-right flex flex-col items-end">
                       <div className="flex items-center gap-1">
                         <Phone className="w-3 h-3 text-[#98A2B3]" />
                         <span className="text-[12px] font-bold text-[#1F2937] tabular-nums leading-none">{selectedPatient.phone}</span>
                       </div>
                       <p className="text-[10px] font-medium text-[#7B8794] leading-tight line-clamp-1">
                         {selectedPatient.address || 'No address provided'}
                       </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 border-2 border-dashed border-slate-100 rounded-[5px] flex flex-col items-center justify-center gap-1.5 opacity-50 bg-slate-50/50">
                   <User className="w-5 h-5 text-slate-300" />
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Patient selection required</p>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: Doctor Information */}
          <div className="bg-white p-4 rounded-[5px] border border-slate-200 shadow-sm space-y-4 transition-all hover:border-[#1E2A5A]/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-4 bg-[#1E2A5A] rounded-full"></div>
              <h3 className="text-[14px] font-bold text-[#1F2937]">Doctor Information</h3>
            </div>
            
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-grow relative">
                  <select 
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-[5px] text-[12px] font-bold text-[#1F2937] outline-none focus:ring-4 focus:ring-[#1E2A5A]/5 focus:border-[#1E2A5A] transition-all appearance-none cursor-pointer shadow-sm"
                    value={newBooking.doctorId}
                    onChange={(e) => setNewBooking(prev => ({ ...prev, doctorId: e.target.value }))}
                  >
                    <option value="">SELF / DIRECT VISIT</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown className="w-3.5 h-3.5 text-[#98A2B3]" />
                  </div>
                </div>
                <button 
                  onClick={() => setShowQuickDoctor(true)}
                  type="button"
                  className="px-4 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-[5px] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-indigo-100 transition-all active:scale-95 shrink-0 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  ADD DOCTOR
                </button>
              </div>

              {selectedDoctor ? (
                <div className="p-2 bg-white rounded-[5px] border border-slate-100 flex gap-2.5 items-center animate-in slide-in-from-top-2 duration-300 shadow-sm">
                  <div className="w-9 h-9 bg-blue-50 rounded-[5px] flex items-center justify-center text-blue-500 shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                   <div className="flex-grow flex justify-between items-center px-0.5">
                    <div className="space-y-0.5">
                      <p className="text-[13px] font-bold text-[#1F2937] leading-tight capitalize">
                        {selectedDoctor.name?.match(/^Dr\.?\s/i) ? selectedDoctor.name : `Dr. ${selectedDoctor.name}`}
                      </p>
                      {(selectedDoctor.degrees || selectedDoctor.speciality) && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {selectedDoctor.degrees && <p className="text-[10px] font-medium text-[#7B8794] uppercase tracking-wider">{selectedDoctor.degrees}</p>}
                          {selectedDoctor.degrees && selectedDoctor.speciality && <span className="w-1 h-1 rounded-full bg-slate-200"></span>}
                          {selectedDoctor.speciality && <p className="text-[10px] font-bold text-[#1E2A5A] uppercase tracking-wider leading-none">{selectedDoctor.speciality}</p>}
                        </div>
                      )}
                    </div>
                    <div className="space-y-0.5 text-right flex flex-col items-end">
                       {selectedDoctor.phone && (
                         <div className="flex items-center gap-1">
                           <Phone className="w-3 h-3 text-[#98A2B3]" />
                           <span className="text-[12px] font-bold text-[#1F2937] tabular-nums leading-none">{selectedDoctor.phone}</span>
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              ) : (
                 <div className="p-2 bg-slate-50/50 rounded-[5px] border border-slate-100 flex gap-2.5 items-center opacity-70">
                  <div className="w-9 h-9 bg-white rounded-[5px] border border-slate-100 shadow-sm flex items-center justify-center text-slate-300">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div className="flex-grow">
                    <p className="text-[13px] font-bold text-[#1F2937] leading-tight">Self / Direct Visit</p>
                    <p className="text-[11px] font-medium text-[#7B8794] mt-0.5">No referrer provided</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ROW 2: Test Details (left) + Booking Details / Payment / Actions (right) */}
          {/* SECTION 3: Test Details */}
          <div className="bg-white p-4 rounded-[5px] border border-slate-200 shadow-sm space-y-4 lg:row-span-2 transition-all hover:border-[#1E2A5A]/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-4 bg-[#1E2A5A] rounded-full"></div>
              <h3 className="text-[14px] font-bold text-[#1F2937]">Test Details</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-grow relative group">
                  <input 
                    type="text" 
                    placeholder="Search tests..."
                    className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-300 rounded-[5px] text-[12px] font-bold text-[#1F2937] outline-none focus:ring-4 focus:ring-[#1E2A5A]/5 focus:border-[#1E2A5A] transition-all placeholder:text-slate-300 shadow-sm"
                    value={testSearch}
                    onChange={(e) => setTestSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filteredTests.length > 0) {
                        e.preventDefault();
                        const firstTest = filteredTests[0];
                        if (!newBooking.testIds.includes(firstTest.id)) {
                          const ids = [...newBooking.testIds, firstTest.id];
                          calculateTotal(ids);
                          setTestSearch('');
                          toast.success(`${firstTest.testName} added`);
                        } else {
                          toast.info("Test already added");
                          setTestSearch('');
                        }
                      }
                    }}
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#98A2B3] group-focus-within:text-[#1E2A5A] transition-colors cursor-pointer" />
                  {testSearch && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-100 rounded-[5px] shadow-xl z-50 overflow-hidden divide-y divide-slate-50">
                       {filteredTests.map(t => (
                         <button 
                          key={t.id}
                          onClick={() => {
                            const ids = [...new Set([...newBooking.testIds, t.id])];
                            calculateTotal(ids);
                            setTestSearch('');
                          }}
                          className="w-full text-left px-2 py-1.5 hover:bg-slate-50 flex items-center justify-between group"
                         >
                           <div>
                             <p className="text-[11px] font-semibold text-[#1b2b4d] leading-none capitalize">{t.testName}</p>
                             <p className="text-[9px] font-medium text-slate-400 uppercase mt-0.5">{t.methodology || '---'}</p>
                           </div>
                           <p className="text-[11px] font-semibold text-[#1b2b4d] tabular-nums tracking-tight">₹{t.price}</p>
                         </button>
                       ))}
                    </div>
                  )}
                </div>
                <button className="px-4 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-[5px] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-emerald-100 transition-all active:scale-95 shrink-0 shadow-sm">
                  <Plus className="w-3.5 h-3.5" />
                  ADD TEST
                </button>
              </div>

              <div className="overflow-hidden border border-slate-100 rounded-[5px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fb] border-b border-slate-100">
                      <th className="px-3 py-2 text-[9px] font-bold text-[#98A2B3] uppercase tracking-wider">Test Name</th>
                      <th className="px-2 py-2 text-[9px] font-bold text-[#98A2B3] uppercase tracking-wider">Method</th>
                      <th className="px-2 py-2 text-[9px] font-bold text-[#98A2B3] uppercase tracking-wider text-center">Price (₹)</th>
                      <th className="px-3 py-2 text-[9px] font-bold text-[#98A2B3] uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {selectedTestsData.map((t, idx) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked 
                              onChange={() => {
                                const ids = newBooking.testIds.filter(id => id !== t.id);
                                calculateTotal(ids);
                              }}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-[#1E2A5A] focus:ring-[#1E2A5A] cursor-pointer shrink-0" 
                            />
                            <span className="text-[12px] font-bold text-[#1F2937]">{t.testName}</span>
                          </label>
                        </td>
                        <td className="px-2 py-2 text-[11px] font-medium text-[#7B8794]">{t.methodology || '---'}</td>
                        <td className="px-2 py-2 text-[12px] font-bold text-[#1F2937] text-center tabular-nums">₹{t.price}</td>
                        <td className="px-3 py-1.5 text-right">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const ids = newBooking.testIds.filter(id => id !== t.id);
                              calculateTotal(ids);
                            }}
                            className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {selectedTestsData.length === 0 && (
                      <tr className="">
                         <td className="px-5 py-5 text-center bg-slate-50/30" colSpan="4">
                             <div className="flex flex-col items-center gap-2 py-4">
                               <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-300 shadow-sm border border-slate-100">
                                 <Plus className="w-5 h-5" />
                               </div>
                               <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No tests selected yet</p>
                             </div>
                         </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center px-1 mt-1">
                <div className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-[5px] text-[11px] font-bold text-[#1F2937]">
                  {newBooking.testIds.length} Tests Selected
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-semibold text-[#7B8794] uppercase tracking-wider">Total</span>
                  <span className="text-[15px] font-bold text-[#10B981] tabular-nums leading-none tracking-tight">₹{newBooking.totalAmount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Booking Details */}
          <div className="bg-white p-4 rounded-[5px] border border-slate-200 shadow-sm space-y-4 transition-all hover:border-[#1E2A5A]/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-4 bg-[#1E2A5A] rounded-full"></div>
              <h3 className="text-[14px] font-bold text-[#1F2937]">Booking Details</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                  <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Collection Date</label>
                  <div className="relative">
                    <input 
                     type="date"
                     className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-[5px] text-[12px] font-bold text-[#1F2937] outline-none focus:border-[#1E2A5A] transition-all shadow-sm"
                     defaultValue={new Date().toISOString().split('T')[0]}
                    />
                    <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#98A2B3] pointer-events-none" />
                  </div>
               </div>
              <div className="space-y-0.5">
                  <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Sample Type</label>
                  <div className="relative">
                    <select className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-[5px] text-[12px] font-bold text-[#1F2937] outline-none focus:border-[#1E2A5A] transition-all appearance-none cursor-pointer shadow-sm">
                     <option>Blood</option>
                     <option>Urine</option>
                     <option>Swab</option>
                     <option>Stool</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#98A2B3] pointer-events-none" />
                  </div>
               </div>
              <div className="space-y-0.5">
                  <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Priority</label>
                  <div className="relative">
                    <select 
                     className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-[5px] text-[12px] font-bold text-[#1F2937] outline-none focus:border-[#1E2A5A] transition-all appearance-none cursor-pointer shadow-sm"
                     value={newBooking.urgency}
                     onChange={(e) => setNewBooking(prev => ({ ...prev, urgency: e.target.value }))}
                    >
                     <option>Normal</option>
                     <option>Urgent</option>
                     <option>STAT</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#98A2B3] pointer-events-none" />
                  </div>
               </div>
            </div>

            <div className="space-y-0.5">
              <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Notes (Optional)</label>
              <textarea 
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-[5px] text-[12px] font-bold text-[#1F2937] outline-none focus:border-[#1E2A5A] h-10 resize-none transition-all placeholder:text-slate-300 shadow-sm"
                placeholder="Enter notes..."
                value={newBooking.notes}
                onChange={(e) => setNewBooking(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          {/* SECTION 5: Payment Information */}
          <div className="bg-white p-4 rounded-[5px] border border-slate-200 shadow-sm space-y-4 transition-all hover:border-[#1E2A5A]/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-4 bg-[#1E2A5A] rounded-full"></div>
              <h3 className="text-[14px] font-bold text-[#1F2937]">Payment Information</h3>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-0.5">
                <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Mode</label>
                <div className="relative">
                  <select 
                    className="bg-[#F8FAFC] border border-[#E5E7EB] px-3 py-1.5 rounded-[5px] text-[11px] font-bold text-[#1F2937] outline-none cursor-pointer hover:bg-white transition-all uppercase tracking-wider w-full appearance-none"
                    value={newBooking.paymentMode || 'Cash'}
                    onChange={(e) => setNewBooking(prev => ({ ...prev, paymentMode: e.target.value }))}
                  >
                    <option>Cash</option>
                    <option>UPI / QR</option>
                    <option>Card</option>
                    <option>Bank Transfer</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#98A2B3] pointer-events-none" />
                </div>
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Discount (₹)</label>
                <input 
                  type="number"
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-[5px] text-[12px] font-bold text-[#1F2937] outline-none focus:border-[#1E2A5A] tabular-nums shadow-sm"
                  value={newBooking.discount}
                  onChange={(e) => handleDiscountChange(e.target.value)}
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Paid (₹)</label>
                <input 
                  type="number"
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-[5px] text-[12px] font-bold text-[#1F2937] outline-none focus:border-[#1E2A5A] tabular-nums shadow-sm"
                  value={newBooking.paidAmount}
                  onChange={(e) => handlePaidAmountChange(e.target.value)}
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Status</label>
                <div className="relative">
                  <select 
                    className={`w-full px-2.5 py-1.5 border ${newBooking.paymentStatus === 'Paid' ? 'border-[#10B981]/40 bg-[#F0FDF4] text-[#10B981]' : 'bg-slate-50 border-slate-200 text-[#1F2937]'} rounded-[5px] text-[12px] font-bold outline-none appearance-none cursor-pointer transition-all`}
                    value={newBooking.paymentStatus}
                    onChange={(e) => setNewBooking(prev => ({ ...prev, paymentStatus: e.target.value }))}
                  >
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Unpaid">Unpaid</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#98A2B3] pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Inline Summary Strip */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-[5px] shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-0">
                  <span className="text-[9px] font-bold text-[#98A2B3] uppercase tracking-wider">Subtotal</span>
                  <span className="text-[13px] font-bold text-[#1F2937] tabular-nums">₹{newBooking.subtotal}</span>
                </div>
                <div className="w-px h-5 bg-slate-200" />
                <div className="flex flex-col gap-0">
                  <span className="text-[9px] font-bold text-[#98A2B3] uppercase tracking-wider">Discount</span>
                  <span className="text-[13px] font-bold text-[#EF4444] tabular-nums">-₹{newBooking.discount}</span>
                </div>
                <div className="w-px h-5 bg-slate-200" />
                <div className="flex flex-col gap-0">
                  <span className="text-[9px] font-bold text-[#98A2B3] uppercase tracking-wider">Paid</span>
                  <span className="text-[13px] font-bold text-[#1F2937] tabular-nums">₹{newBooking.paidAmount}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
                <span className="text-[11px] font-bold text-[#1F2937] uppercase tracking-wider">Balance</span>
                <span className={`text-[15px] font-bold tabular-nums leading-none tracking-tight ${newBooking.balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>₹{newBooking.balance}</span>
              </div>
            </div>
          </div>


        </div>
      </div>

      {/* FOOTER INFO BAR */}
      <div className="py-1.5 px-3 mt-0.5 flex items-center gap-2 shrink-0 rounded-[5px] bg-blue-50/50 border border-blue-100 mx-3 mb-2 shadow-sm">
         <div className="flex shrink-0 items-center justify-center w-3.5 h-3.5 rounded-full border border-blue-300 text-blue-500">
           <span className="text-[7px] font-bold">i</span>
         </div>
         <p className="text-[9px] font-bold text-blue-600">After saving, a unique Booking ID will be generated. You can view & download the report once tests are completed.</p>
      </div>
      
      {/* QUICK PATIENT MODAL */}
      {showQuickPatient && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-3xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-[0_32px_128px_rgba(0,0,0,0.3)] max-w-2xl w-full border border-white/20 animate-in zoom-in-95 duration-500 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-5 py-3 bg-[#1E2A5A] text-white flex justify-between items-center shrink-0 border-b border-white/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[80px] -mr-20 -mt-20"></div>
               <div className="relative z-10 flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-[5px] transition-transform rotate-3">
                     <Users className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                     <h2 className="text-lg font-bold tracking-tight leading-none">Add New Patient</h2>
                     <p className="text-[9px] font-medium text-white/60 uppercase tracking-widest mt-0.5">Record Configuration</p>
                  </div>
               </div>
               <button onClick={() => setShowQuickPatient(false)} className="relative z-10 w-9 h-9 flex justify-center items-center bg-white/5 hover:bg-white/10 rounded-[5px] transition-all text-white/50 border border-white/5">
                  <X className="w-4.5 h-4.5" />
               </button>
            </div>
            
            <form onSubmit={handleSaveQuickPatient} className="flex-grow flex flex-col overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar">
                
                <div className="space-y-0.5">
                  <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Full Name *</label>
                  <div className="flex gap-2">
                    <div className="relative w-[110px] shrink-0">
                      <select 
                        className={`w-full px-2.5 py-1.5 border border-slate-300 rounded-[5px] transition-all font-bold text-[12px] outline-none cursor-pointer appearance-none shadow-sm ${
                          quickPatient.isAuto ? 'bg-blue-50/50 border-blue-200 text-blue-600' : 'bg-white text-[#1F2937] focus:border-[#1E2A5A] focus:bg-white'
                        }`}
                        value={quickPatient.isAuto ? 'Auto' : quickPatient.honorific}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'Auto') {
                            setQuickPatient({...quickPatient, isAuto: true});
                          } else {
                            setQuickPatient({...quickPatient, honorific: val, isAuto: false});
                          }
                        }}
                      >
                        <option value="Auto">✨ Auto ({quickPatient.honorific})</option>
                        <option value="None">None</option>
                        <option value="Mr.">Mr.</option>
                        <option value="Ms.">Ms.</option>
                        <option value="Mrs.">Mrs.</option>
                        <option value="Baby">Baby</option>
                        <option value="Miss">Miss</option>
                        <option value="Dr.">Dr.</option>
                        <option value="Prof.">Prof.</option>
                        <option value="Shri">Shri</option>
                        <option value="Smt.">Smt.</option>
                      </select>
                    </div>
                    <input 
                      required 
                      type="text" 
                      placeholder="Enter patient's name"
                      className="flex-grow px-3 py-1.5 bg-white border border-slate-300 focus:border-[#1E2A5A] focus:bg-white rounded-[5px] transition-all font-bold text-[#1F2937] outline-none placeholder:text-slate-300 shadow-sm" 
                      value={quickPatient.name} 
                      onChange={e => setQuickPatient({...quickPatient, name: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Age *</label>
                    <div className="flex gap-2">
                      <input 
                        required 
                        type="number" 
                        placeholder="00"
                        className="w-2/3 px-3 py-1.5 bg-white border border-slate-300 focus:border-[#1E2A5A] focus:bg-white rounded-[5px] transition-all font-bold text-[#1F2937] outline-none placeholder:text-slate-300 shadow-sm"
                        value={quickPatient.age} 
                        onChange={e => setQuickPatient({...quickPatient, age: e.target.value})}
                      />
                      <select 
                        className="w-1/3 px-2 py-1.5 bg-white border border-slate-300 focus:bg-white rounded-[5px] transition-all font-bold text-[#1F2937] outline-none cursor-pointer text-[12px] shadow-sm"
                        value={quickPatient.ageUnit} 
                        onChange={e => setQuickPatient({...quickPatient, ageUnit: e.target.value})}
                      >
                        <option>Years</option><option>Months</option><option>Days</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Gender *</label>
                    <select 
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 focus:bg-white rounded-[5px] transition-all font-bold text-[#1F2937] outline-none cursor-pointer text-[12px] shadow-sm"
                      value={quickPatient.gender} 
                      onChange={e => setQuickPatient({...quickPatient, gender: e.target.value})}
                    >
                      <option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="10-digit mobile number"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#1E2A5A]/30 focus:bg-white rounded-xl transition-all font-bold text-[#1F2937] outline-none placeholder:text-slate-300" 
                      value={quickPatient.phone} 
                      onChange={e => setQuickPatient({...quickPatient, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Email</label>
                    <input 
                      type="email" 
                      placeholder="patient@email.com"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#1E2A5A]/30 focus:bg-white rounded-xl transition-all font-bold text-[#1F2937] outline-none placeholder:text-slate-300" 
                      value={quickPatient.email} 
                      onChange={e => setQuickPatient({...quickPatient, email: e.target.value})} 
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Address</label>
                  <textarea 
                    rows="2"
                    placeholder="Enter full address"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#1E2A5A]/30 focus:bg-white rounded-xl transition-all font-bold text-[#1F2937] outline-none placeholder:text-slate-300 resize-none" 
                    value={quickPatient.address} 
                    onChange={e => setQuickPatient({...quickPatient, address: e.target.value})} 
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-[#f8f9fb] flex justify-end gap-2.5 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setShowQuickPatient(false)} 
                  className="px-4 py-1.5 bg-white border border-slate-200 rounded-[5px] text-[11px] font-bold text-[#1F2937] hover:bg-slate-50 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingQuick}
                  className="px-5 py-1.5 bg-[#1E2A5A] text-white rounded-[5px] text-[11px] font-bold hover:bg-[#2a3a7a] transition-all shadow-md shadow-blue-900/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {isSavingQuick ? <Loader className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK DOCTOR MODAL */}
      {showQuickDoctor && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-3xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-[0_32px_128px_rgba(0,0,0,0.3)] max-w-2xl w-full border border-white/20 animate-in zoom-in-95 duration-500 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-5 py-3 bg-[#1E2A5A] text-white flex justify-between items-center shrink-0 border-b border-white/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[80px] -mr-20 -mt-20"></div>
               <div className="relative z-10 flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-[5px] transition-transform rotate-3">
                     <Stethoscope className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                     <h2 className="text-lg font-bold tracking-tight leading-none">Add Doctor</h2>
                     <p className="text-[9px] font-medium text-white/60 uppercase tracking-widest mt-0.5">Doctor Registry Setup</p>
                  </div>
               </div>
               <button onClick={() => setShowQuickDoctor(false)} className="relative z-10 w-9 h-9 flex justify-center items-center bg-white/5 hover:bg-white/10 rounded-[5px] transition-all text-white/50 border border-white/5">
                  <X className="w-4.5 h-4.5" />
               </button>
            </div>
            
            <form onSubmit={handleSaveQuickDoctor} className="flex-grow flex flex-col overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar">
                
                <div className="space-y-0.5">
                  <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Doctor Name *</label>
                  <div className="flex gap-2">
                    <div className="relative w-[110px] shrink-0">
                      <select 
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-[5px] transition-all font-bold text-[12px] text-[#1F2937] outline-none cursor-pointer appearance-none shadow-sm"
                        value={quickDoctor.honorific}
                        onChange={e => setQuickDoctor({...quickDoctor, honorific: e.target.value})}
                      >
                        <option value="Dr.">Dr.</option>
                        <option value="Prof.">Prof.</option>
                        <option value="None">None</option>
                      </select>
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <ChevronDown className="w-3.5 h-3.5 text-[#98A2B3]" />
                      </div>
                    </div>
                    <input 
                      required 
                      type="text" 
                      placeholder="Enter doctor's name"
                      className="flex-grow px-3 py-1.5 bg-white border border-slate-300 focus:border-[#1E2A5A] focus:bg-white rounded-[5px] transition-all font-bold text-[#1F2937] outline-none placeholder:text-slate-300 shadow-sm" 
                      value={quickDoctor.name} 
                      onChange={e => setQuickDoctor({...quickDoctor, name: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="10-digit mobile number"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 focus:border-[#1E2A5A] focus:bg-white rounded-[5px] transition-all font-bold text-[#1F2937] outline-none placeholder:text-slate-300 shadow-sm" 
                      value={quickDoctor.phone} 
                      onChange={e => setQuickDoctor({...quickDoctor, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} 
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Email</label>
                    <input 
                      type="email" 
                      placeholder="doctor@email.com"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 focus:border-[#1E2A5A] focus:bg-white rounded-[5px] transition-all font-bold text-[#1F2937] outline-none placeholder:text-slate-300 shadow-sm" 
                      value={quickDoctor.email} 
                      onChange={e => setQuickDoctor({...quickDoctor, email: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Specialization</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Cardiologist"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 focus:border-[#1E2A5A] focus:bg-white rounded-[5px] transition-all font-bold text-[#1F2937] outline-none placeholder:text-slate-300 shadow-sm" 
                      value={quickDoctor.specialization} 
                      onChange={e => setQuickDoctor({...quickDoctor, specialization: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Clinic / Hospital</label>
                    <input 
                      type="text" 
                      placeholder="Enter base location"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 focus:border-[#1E2A5A] focus:bg-white rounded-[5px] transition-all font-bold text-[#1F2937] outline-none placeholder:text-slate-300 shadow-sm" 
                      value={quickDoctor.clinic} 
                      onChange={e => setQuickDoctor({...quickDoctor, clinic: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Commission Structure *</label>
                    <div className="flex gap-2.5">
                      <div className="relative w-[130px] shrink-0">
                        <select 
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl transition-all font-bold text-[13px] text-[#1F2937] outline-none cursor-pointer appearance-none"
                          value={quickDoctor.commissionType}
                          onChange={e => setQuickDoctor({...quickDoctor, commissionType: e.target.value})}
                        >
                          <option value="Percentage">Percentage (%)</option>
                          <option value="Fixed Amount">Fixed (₹)</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <ChevronDown className="w-4 h-4 text-[#98A2B3]" />
                        </div>
                      </div>
                      <input 
                        required
                        type="number" 
                        min="0"
                        placeholder="0"
                        className="flex-grow px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#1E2A5A]/30 focus:bg-white rounded-xl transition-all font-bold text-[#1F2937] outline-none placeholder:text-slate-300" 
                        value={quickDoctor.commissionValue} 
                        onChange={e => setQuickDoctor({...quickDoctor, commissionValue: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#98A2B3] uppercase tracking-wider ml-1">Account Status</label>
                    <div className="relative w-full">
                      <select 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl transition-all font-bold text-[13px] text-[#1F2937] outline-none cursor-pointer appearance-none"
                        value={quickDoctor.status}
                        onChange={e => setQuickDoctor({...quickDoctor, status: e.target.value})}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-[#f8f9fb] flex justify-end gap-2.5 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setShowQuickDoctor(false)} 
                  className="px-4 py-1.5 bg-white border border-slate-200 rounded-[5px] text-[11px] font-bold text-[#1F2937] hover:bg-slate-50 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingQuick}
                  className="px-5 py-1.5 bg-[#1E2A5A] text-white rounded-[5px] text-[11px] font-bold hover:bg-[#2a3a7a] transition-all shadow-md shadow-blue-900/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {isSavingQuick ? <Loader className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingForm;
