import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, Loader, Users, FileText, Edit, Trash2, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { generateLabId } from '../utils/idGenerator';

const Patients = () => {
  const { userData, activeLabId } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Labs fetching for Super Admin
  const [labs, setLabs] = useState([]);
  const isSuperAdmin = userData?.role === 'SuperAdmin';
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  
  // Filters State
  const [genderFilter, setGenderFilter] = useState('All');

  // Modal & Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // holds patient id to delete
  const [newPatient, setNewPatient] = useState({
    name: '', age: '', ageUnit: 'Years', gender: 'Male', phone: '', email: '', address: '', labId: '', honorific: 'Mr.', isAuto: true
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!activeLabId && userData?.role !== 'SuperAdmin') return;
    
    setLoading(true);
    let q;
    if (activeLabId) {
      q = query(collection(db, 'patients'), where('labId', '==', activeLabId));
    } else {
      q = query(collection(db, 'patients'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pts = [];
      snapshot.forEach((doc) => {
        pts.push({ id: doc.id, ...doc.data() });
      });
      pts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPatients(pts);
      setLoading(false);
    }, (error) => {
      console.error('Error in patients listener:', error);
      setLoading(false);
    });

    if (isSuperAdmin && !activeLabId) {
      fetchLabs();
    }

    return () => unsubscribe();
  }, [userData, activeLabId]);

  // Real-time Honorific logic
  useEffect(() => {
    if (newPatient.isAuto) {
      const ageVal = parseInt(newPatient.age) || 0;
      const isUnder5 = newPatient.ageUnit === 'Years' ? ageVal < 5 : true;
      const isAdult = newPatient.ageUnit === 'Years' ? ageVal >= 15 : false;
      let calculatedPrefix = '';
      
      if (isUnder5) {
        calculatedPrefix = 'Baby';
      } else {
        if (newPatient.gender === 'Male') {
          calculatedPrefix = 'Mr.';
        } else if (newPatient.gender === 'Female') {
          calculatedPrefix = isAdult ? 'Ms.' : 'Miss';
        }
      }
      
      if (calculatedPrefix && newPatient.honorific !== calculatedPrefix) {
        setNewPatient(prev => ({ ...prev, honorific: calculatedPrefix }));
      }
    }
  }, [newPatient.age, newPatient.ageUnit, newPatient.gender, newPatient.isAuto]);

  const fetchLabs = async () => {
    try {
      const q = query(collection(db, 'labs'));
      const snap = await getDocs(q);
      setLabs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching labs for superadmin:", err);
    }
  };

  const handleEdit = (pt) => {
    setEditingId(pt.id);
    setNewPatient({
      name: pt.name || '',
      age: pt.age || '',
      ageUnit: pt.ageUnit || 'Years',
      gender: pt.gender || 'Male',
      phone: pt.phone || '',
      email: pt.email || '',
      address: pt.address || '',
      labId: pt.labId || activeLabId || '',
      honorific: 'Auto', // We can set to Auto on edit to re-trigger if needed, or stick to what was there.
      isAuto: true
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    // GUARD: check for delete_records permission
    if (!userData?.permissions?.can_delete_records && userData?.role !== 'LabAdmin' && userData?.role !== 'SuperAdmin') {
      toast.error("Unauthorized: You do not have permission to delete records.");
      setDeleteConfirm(null);
      return;
    }

    try {
      await deleteDoc(doc(db, 'patients', id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Error deleting patient:", err?.message || err);
      alert("Delete Failed: " + (err?.message || "Permission denied. Check Firestore rules."));
      setDeleteConfirm(null);
    }
  };

  const handleAddPatient = async (e, shouldRedirect = false) => {
    if (e && e.preventDefault) e.preventDefault();
    const targetLabId = activeLabId || newPatient.labId;
    if (!targetLabId) {
      alert("Please select a laboratory first.");
      return;
    }

    if (newPatient.phone) {
      const cleanedPhone = newPatient.phone.replace(/[\s\-\+]/g, '');
      if (cleanedPhone.length < 10) {
        alert("Please enter a valid phone number (at least 10 digits).");
        return;
      }
    }

    if (newPatient.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newPatient.email)) {
        alert("Please enter a valid email address.");
        return;
      }
    }

    let honorificPrefix = '';
    if (newPatient.honorific && newPatient.honorific !== 'None' && newPatient.honorific !== 'Auto') {
      honorificPrefix = newPatient.honorific + ' ';
    }

    let finalName = newPatient.name.trim();

    // Clean existing honorifics from name to prevent duplication (e.g. "Ms. Mr. Sanjay")
    const allHonorifics = ['Mr.', 'Ms.', 'Mrs.', 'Master', 'Baby', 'Miss', 'Dr.', 'Prof.', 'Shri', 'Smt.'];
    allHonorifics.forEach(h => {
      const regex = new RegExp(`^${h.replace('.', '\\.')}\\s+`, 'i');
      finalName = finalName.replace(regex, '');
    });

    if (honorificPrefix) {
      finalName = honorificPrefix + finalName.trim();
    }

    try {
      setIsSaving(true);
      let docId;
      let finalPid;
      
      if (editingId) {
        docId = editingId;
        // Keep existing patientId from the item we're editing
        const existing = patients.find(p => p.id === editingId);
        finalPid = existing?.patientId;
      } else {
        finalPid = await generateLabId('PAT', targetLabId);
        docId = `${targetLabId}_${finalPid}`;
      }
      const saveData = {
        name: finalName,
        age: newPatient.age,
        ageUnit: newPatient.ageUnit,
        gender: newPatient.gender,
        phone: newPatient.phone,
        email: newPatient.email,
        address: newPatient.address,
        patientId: finalPid,
        labId: targetLabId,
        updatedAt: serverTimestamp()
      };

      if (!editingId) {
        saveData.registered_at = serverTimestamp();
        saveData.createdAt = serverTimestamp();
      }

      await setDoc(doc(db, 'patients', docId), saveData, { merge: true });
      
      closeModal();
      
      if (shouldRedirect) {
        navigate(`/bookings?autoOpen=true&patientId=${docId}`);
      }
    } catch (error) {
      console.error("Error saving patient:", error);
      alert("Failed to save patient.");
    } finally {
      setIsSaving(false);
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingId(null);
    setNewPatient({ name: '', age: '', ageUnit: 'Years', gender: 'Male', phone: '', email: '', address: '', labId: '', honorific: 'Mr.', isAuto: true });
  };

  const maleCount = patients.filter(p => p.gender === 'Male').length;
  const femaleCount = patients.filter(p => p.gender === 'Female').length;

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.phone?.includes(searchTerm) ||
                          p.patientId?.includes(searchTerm);
    const matchesGender = genderFilter === 'All' || p.gender === genderFilter;
    return matchesSearch && matchesGender;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, genderFilter, rowsPerPage]);

  const paginatedPatients = React.useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredPatients.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredPatients, currentPage, rowsPerPage]);

  return (
    <>
    <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-3 w-full flex-grow text-slate-800 animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-brand-dark leading-tight flex items-center">
            <div className="p-2 bg-brand-light rounded-xl mr-3 shadow-sm border border-brand-primary/10 transition-transform hover:scale-110">
              <Users className="w-5 h-5 text-brand-primary" />
            </div>
            Patients
          </h1>
          <p className="text-[11px] font-medium text-slate-500 mt-1.5">Comprehensive medical record directory.</p>
        </div>
        
        <button
          onClick={() => { setEditingId(null); setNewPatient({ name: '', age: '', ageUnit: 'Years', gender: 'Male', phone: '', email: '', address: '', labId: '', honorific: 'Mr.', isAuto: true }); setShowAddModal(true); }}
          className="w-full md:w-auto bg-brand-primary text-white px-5 py-2.5 rounded-xl font-bold tracking-wider text-[12px] shadow-lg hover:shadow-brand-primary/20 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2 group border border-white/10"
        >
          <Plus className="w-3.5 h-3.5 text-white group-hover:rotate-90 transition-transform duration-500" />
          Add Patient
        </button>
      </div>

      {/* Search and Filters Header */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        {/* Left Side: Search Bar */}
        <div className="flex-[2] relative group shadow-sm transition-all focus-within:shadow-md rounded-xl max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
          <input type="text"
            className="w-full pl-11 pr-6 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary/30 transition-all font-bold text-[13px] text-brand-dark outline-none placeholder:text-slate-400"
            placeholder="Search name, phone or ID..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {/* Right Side: Total Stats & Gender Filters */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 -mb-1">
          {/* Total Stats */}
          <button 
            onClick={() => setGenderFilter('All')}
            className={`lg:w-[220px] shrink-0 flex items-center gap-2 px-4 py-2 border rounded-xl shadow-sm h-[42px] transition-all cursor-pointer ${
              genderFilter === 'All' 
                ? 'bg-brand-dark border-brand-dark shadow-md' 
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
             <Users className={`w-3.5 h-3.5 shrink-0 ${genderFilter === 'All' ? 'text-white' : 'text-slate-400'}`} />
             <div className="flex items-center justify-between w-full">
               <span className={`text-[10px] font-black uppercase tracking-wider ${genderFilter === 'All' ? 'text-white' : 'text-slate-500'}`}>Total Registry</span>
               <span className={`px-2 py-0.5 rounded-md text-[9px] font-black tabular-nums ${
                 genderFilter === 'All' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
               }`}>{patients.length}</span>
             </div>
          </button>
          
          {/* Male Filter */}
          <button 
            onClick={() => setGenderFilter(prev => prev === 'Male' ? 'All' : 'Male')}
            className={`shrink-0 flex items-center justify-between gap-3 px-4 py-2 border rounded-xl shadow-sm h-[42px] transition-all min-w-[120px] ${
              genderFilter === 'Male' 
                ? 'bg-brand-primary border-brand-primary text-white shadow-md' 
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${genderFilter === 'Male' ? 'bg-white' : 'bg-brand-primary'}`}></div>
              <span className={`text-[10px] font-black uppercase tracking-wider ${genderFilter === 'Male' ? 'text-white' : 'text-slate-500'}`}>Male</span>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black tabular-nums ${
              genderFilter === 'Male' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
            }`}>{maleCount}</span>
          </button>

          {/* Female Filter */}
          <button 
            onClick={() => setGenderFilter(prev => prev === 'Female' ? 'All' : 'Female')}
            className={`shrink-0 flex items-center justify-between gap-3 px-4 py-2 border rounded-xl shadow-sm h-[42px] transition-all min-w-[120px] ${
              genderFilter === 'Female' 
                ? 'bg-purple-500 border-purple-500 text-white shadow-md' 
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${genderFilter === 'Female' ? 'bg-white' : 'bg-purple-500'}`}></div>
              <span className={`text-[10px] font-black uppercase tracking-wider ${genderFilter === 'Female' ? 'text-white' : 'text-slate-500'}`}>Female</span>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black tabular-nums ${
              genderFilter === 'Female' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
            }`}>{femaleCount}</span>
          </button>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto pr-2 -mr-2 custom-scrollbar min-h-0 bg-white rounded-[24px] shadow-sm border border-slate-100 relative" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="sticky top-0 z-20 bg-slate-50 px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider shadow-sm">Patient Name</th>
              <th className="sticky top-0 z-20 bg-slate-50 px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider shadow-sm">Age & Gender</th>
              <th className="sticky top-0 z-20 bg-slate-50 px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider shadow-sm">Phone No.</th>
              <th className="sticky top-0 z-20 bg-slate-50 px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider shadow-sm">Email</th>
              <th className="sticky top-0 z-20 bg-slate-50 px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider shadow-sm">Address</th>
              {isSuperAdmin && !activeLabId && (
                <th className="sticky top-0 z-20 bg-slate-50 px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider shadow-sm">Hosting Lab</th>
              )}
              <th className="sticky top-0 z-20 bg-slate-50 px-4 py-3 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider shadow-sm">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={isSuperAdmin && !activeLabId ? 7 : 6} className="py-24 text-center">
                    <Loader className="w-10 h-10 animate-spin text-brand-primary mx-auto mb-5" />
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Synchronizing Records...</p>
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin && !activeLabId ? 7 : 6} className="py-32 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-[40px] flex items-center justify-center mx-auto mb-6 transition-transform hover:rotate-12">
                      <Users className="w-8 h-8 text-slate-200" />
                    </div>
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Zero Matching Records Found</p>
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50/40 transition-all group relative">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-brand-primary font-black text-xs border border-slate-200 shadow-sm group-hover:scale-110 transition-transform">
                          {patient.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[14px] font-semibold text-brand-dark leading-tight group-hover:text-brand-primary transition-colors">{patient.name}</div>
                          <div className="text-[11px] font-medium text-slate-500 mt-0.5">#{patient.patientId || patient.id.slice(-8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-semibold text-slate-700 tabular-nums">{patient.age} {patient.ageUnit}</span>
                        <div className="flex mt-0.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                            patient.gender === 'Male' ? 'bg-brand-primary/10 text-brand-primary' : 'bg-purple-500/10 text-purple-600'
                          }`}>
                            {patient.gender}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-[11px] font-semibold text-slate-700 tabular-nums">{patient.phone || <span className="text-slate-400">--</span>}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-[11px] font-medium text-slate-500">{patient.email ? <a href={`mailto:${patient.email}`} className="hover:text-brand-primary transition-colors">{patient.email}</a> : <span className="text-slate-400">--</span>}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-[11px] text-slate-500 font-medium truncate max-w-[150px]" title={patient.address || 'No address provided'}>{patient.address || '--'}</div>
                    </td>
                    {isSuperAdmin && !activeLabId && (
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[9px] font-bold uppercase tracking-wider border border-slate-200">
                          {labs.find(l => l.labId === patient.labId)?.labName || patient.labId}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1 isolate">
                        <button 
                          onClick={() => handleEdit(patient)}
                          className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/5 rounded-xl transition-all"
                          title="Edit Patient"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {(userData?.role === 'LabAdmin' || userData?.role === 'SuperAdmin' || userData?.permissions?.can_delete_records) && (
                          <button 
                            onClick={() => setDeleteConfirm(patient.id)}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                            title="Delete Patient"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Pagination Footer */}
      <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-4 px-6 pb-6">
        <div className="flex items-center gap-4">
          <p className="text-[13px] font-medium text-slate-500">
            Showing <span className="text-brand-dark font-semibold">{(currentPage - 1) * rowsPerPage + 1}-{Math.min(currentPage * rowsPerPage, filteredPatients.length)}</span> of <span className="text-brand-dark font-semibold">{filteredPatients.length}</span> reports
          </p>
          <div className="h-3 w-[1px] bg-slate-200 hidden md:block" />
          <div className="flex items-center gap-1">
            <select 
               className="bg-transparent text-[13px] font-semibold text-slate-500 outline-none cursor-pointer hover:text-brand-dark transition-all appearance-none"
               value={rowsPerPage}
               onChange={e => setRowsPerPage(parseInt(e.target.value))}
             >
               <option value={5}>5 per page</option>
               <option value={10}>10 per page</option>
               <option value={20}>20 per page</option>
               <option value={50}>50 per page</option>
             </select>
             <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-2">
             <button 
               onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
               disabled={currentPage === 1}
               className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-brand-primary hover:border-brand-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-90"
              >
               <ChevronLeft className="w-4 h-4" />
             </button>
             
             <div className="flex items-center gap-2">
               {[...Array(Math.ceil(filteredPatients.length / rowsPerPage))].map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-9 h-9 rounded-xl text-[11px] font-black transition-all duration-300 ${
                      currentPage === i + 1 
                        ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-105' 
                        : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-100'
                    }`}
                  >
                    {i + 1}
                  </button>
               ))}
             </div>

             <button 
               onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredPatients.length / rowsPerPage), p + 1))}
               disabled={currentPage === Math.ceil(filteredPatients.length / rowsPerPage) || Math.ceil(filteredPatients.length / rowsPerPage) === 0}
               className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-brand-primary hover:border-brand-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-90"
              >
               <ChevronRight className="w-4 h-4" />
             </button>
        </div>
      </div>
    </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-2xl w-full border border-white/20 animate-in zoom-in-95 duration-500 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-5 bg-brand-dark text-white flex justify-between items-center shrink-0 border-b border-white/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[80px] -mr-20 -mt-20"></div>
               <div className="relative z-10 flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 text-emerald-400">
                     <Users className="w-5 h-5" />
                  </div>
                  <div>
                     <h2 className="text-xl font-bold tracking-tight">{editingId ? 'Edit Patient' : 'Add New Patient'}</h2>
                     <p className="text-[9px] font-bold text-white/50 uppercase tracking-[0.15em] mt-0.5">Patient Management System</p>
                  </div>
               </div>
               <button onClick={closeModal} className="relative z-10 w-10 h-10 flex justify-center items-center bg-white/5 hover:bg-white/10 rounded-xl transition-all text-white border border-white/10">
                  <X className="w-4 h-4" />
               </button>
            </div>
            
            <form onSubmit={handleAddPatient} className="flex-grow flex flex-col overflow-hidden bg-white">
              <div className="p-6 md:p-8 space-y-5 overflow-y-auto custom-scrollbar">
                
                {isSuperAdmin && !activeLabId && !editingId && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1.5">Select Laboratory *</label>
                    <select 
                      required 
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-brand-dark outline-none focus:border-brand-primary/50 focus:bg-white transition-all cursor-pointer"
                      value={newPatient.labId}
                      onChange={e => setNewPatient({...newPatient, labId: e.target.value})}
                    >
                      <option value="">Choose a lab...</option>
                      {labs.map(lab => (
                        <option key={lab.id} value={lab.labId || lab.id}>{lab.labName || lab.name} ({lab.labId || lab.id})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1.5">Full Name *</label>
                  <div className="flex gap-2">
                    <div className="relative w-[120px] shrink-0">
                      <select 
                        className={`w-full px-3 py-2.5 border rounded-xl transition-all font-bold text-[12px] outline-none cursor-pointer appearance-none ${
                          newPatient.isAuto ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-brand-dark focus:border-brand-primary/50 focus:bg-white'
                        }`}
                        value={newPatient.isAuto ? 'Auto' : newPatient.honorific}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'Auto') {
                            setNewPatient({...newPatient, isAuto: true});
                          } else {
                            setNewPatient({...newPatient, honorific: val, isAuto: false});
                          }
                        }}
                      >
                        <option value="Auto">✨ Auto ({newPatient.honorific})</option>
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
                      className="flex-grow px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-[13px] text-brand-dark outline-none placeholder:text-slate-400 placeholder:font-medium" 
                      value={newPatient.name} 
                      onChange={e => setNewPatient({...newPatient, name: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1.5">Age *</label>
                    <div className="flex gap-2">
                      <input 
                        required 
                        type="number" 
                        placeholder="00"
                        className="w-[120px] px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-[13px] text-brand-dark outline-none placeholder:text-slate-400"
                        value={newPatient.age} 
                        onChange={e => {
                          const val = e.target.value.toString().slice(0, 3);
                          setNewPatient({...newPatient, age: val});
                        }}
                        onInput={(e) => {
                          if (e.target.value.length > 3) e.target.value = e.target.value.slice(0, 3);
                        }}
                      />
                      <select 
                        className="flex-grow px-3 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none cursor-pointer text-[13px]"
                        value={newPatient.ageUnit} 
                        onChange={e => setNewPatient({...newPatient, ageUnit: e.target.value})}
                      >
                        <option>Years</option><option>Months</option><option>Days</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1.5">Gender *</label>
                    <select 
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none cursor-pointer text-[13px]"
                      value={newPatient.gender} 
                      onChange={e => setNewPatient({...newPatient, gender: e.target.value})}
                    >
                      <option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1.5">Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="10-digit mobile number"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-[13px] text-brand-dark outline-none placeholder:text-slate-400 placeholder:font-medium" 
                      value={newPatient.phone} 
                      onChange={e => setNewPatient({...newPatient, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1.5">Email <span className="text-brand-primary lowercase tracking-normal font-bold opacity-80">(Needed for reports)</span></label>
                    <input 
                      type="email" 
                      placeholder="patient@email.com"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-[13px] text-brand-dark outline-none placeholder:text-slate-400 placeholder:font-medium" 
                      value={newPatient.email} 
                      onChange={e => setNewPatient({...newPatient, email: e.target.value})} 
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Address</label>
                    <div className="h-[1px] bg-slate-200 flex-grow max-w-[100px]"></div>
                  </div>
                  <textarea 
                    rows="2"
                    placeholder="Enter full address"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-[13px] text-brand-dark outline-none placeholder:text-slate-400 placeholder:font-medium resize-none" 
                    value={newPatient.address} 
                    onChange={e => setNewPatient({...newPatient, address: e.target.value})} 
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-500 hover:text-brand-dark transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  disabled={isSaving}
                  onClick={(e) => handleAddPatient(e, true)}
                  className="px-5 py-2.5 bg-brand-dark text-white rounded-xl text-[11px] font-bold transition-all hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save & Create Booking
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-[#96D17C] text-white rounded-xl text-[11px] font-bold transition-all hover:bg-[#86c06c] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : null}
                  {editingId ? 'Update Record' : 'Save Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[28px] shadow-2xl max-w-sm w-full p-8 animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Trash2 className="w-7 h-7 text-rose-500" />
            </div>
            <h3 className="text-xl font-bold text-center text-[#1F2937] tracking-tight mb-2">Delete Patient?</h3>
            <p className="text-[13px] text-[#7B8794] font-medium text-center mb-7">This action cannot be undone. The patient record will be permanently removed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-3 bg-rose-600 text-white font-bold text-[13px] uppercase tracking-wider rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20 active:scale-95"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Patients;
