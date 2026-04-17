import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, Loader, Users, FileText, Edit, Trash2, X } from 'lucide-react';
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
  
  // Modal & Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // holds patient id to delete
  const [newPatient, setNewPatient] = useState({
    name: '', age: '', ageUnit: 'Years', gender: 'Male', phone: '', email: '', address: '', labId: ''
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
      labId: pt.labId || activeLabId || ''
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
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
        name: newPatient.name,
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
    setNewPatient({ name: '', age: '', ageUnit: 'Years', gender: 'Male', phone: '', email: '', address: '', labId: '' });
  };

  const filteredPatients = patients.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm) ||
    p.patientId?.includes(searchTerm)
  );

  return (
    <>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow text-slate-800 animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-brand-dark tracking-tighter flex items-center text-left leading-none">
            <div className="p-2 sm:p-2.5 bg-brand-light rounded-2xl mr-4 shadow-sm border border-brand-primary/10 transition-transform hover:scale-110">
              <Users className="w-7 h-7 sm:w-8 sm:h-8 text-brand-primary" />
            </div>
            Patients
          </h1>
          <p className="text-slate-500 mt-2 sm:mt-3 font-medium text-sm sm:text-base italic">Comprehensive medical record directory.</p>
        </div>
        
        <button
          onClick={() => { setEditingId(null); setNewPatient({ name: '', age: '', ageUnit: 'Years', gender: 'Male', phone: '', email: '', address: '', labId: '' }); setShowAddModal(true); }}
          className="w-full md:w-auto flex items-center justify-center px-8 py-4 bg-brand-dark text-white rounded-2xl font-black hover:shadow-2xl hover:shadow-brand-dark/20 hover:-translate-y-1 transition-all duration-300 group active:scale-95 shadow-lg tracking-widest text-[11px] uppercase whitespace-nowrap"
        >
          <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300 text-brand-primary" />
          Add Patient
        </button>
      </div>

      {/* Sticky Filters Header */}
      <div className="sticky top-0 z-[20] -mx-4 sm:-mx-8 px-4 sm:px-8 py-4 bg-[#F8FAFC]/80 backdrop-blur-xl border-b border-slate-100 mb-8 transition-all">
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6 items-start lg:items-center">
          
          {/* Left Side: Search Bar */}
          <div className="relative flex-grow w-full lg:max-w-2xl group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
            </div>
            <input type="text"
              className="block w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-[22px] focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 text-sm font-bold text-brand-dark outline-none transition-all placeholder:text-slate-300 shadow-sm"
              placeholder="Search by name, phone or patient ID..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          {/* Right Side: Total Stats */}
          <div className="flex items-center gap-3 p-1.5 bg-white border border-slate-200 rounded-[24px] shadow-sm w-full lg:w-auto">
             <div className="px-6 py-2.5 bg-slate-50 border border-slate-100 rounded-[18px] flex items-center gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Registry</span>
                <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-black text-brand-dark tabular-nums shadow-sm">{patients.length}</span>
             </div>
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto pr-2 -mr-2 custom-scrollbar min-h-0 bg-white rounded-[32px] shadow-sm border border-slate-100" style={{ maxHeight: 'calc(100vh - 360px)' }}>
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-[#f1f5f9] sticky top-0 z-[10] border-b border-slate-200">
            <tr>
              <th scope="col" className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Patient Profile</th>
              <th scope="col" className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Demographics</th>
              <th scope="col" className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Contact Registry</th>
              {isSuperAdmin && !activeLabId && (
                <th scope="col" className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Hosting Lab</th>
              )}
              <th scope="col" className="px-8 py-5 text-right text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Control Panel</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={isSuperAdmin && !activeLabId ? 5 : 4} className="px-8 py-20 text-center">
                    <Loader className="h-10 w-10 animate-spin text-brand-primary mx-auto mb-4" />
                    <p className="text-slate-400 font-black uppercase text-[12px] tracking-widest">Loading...</p>
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin && !activeLabId ? 5 : 4} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                      <Users className="w-8 h-8" />
                    </div>
                    <p className="text-slate-500 font-bold">No patients found.</p>
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-brand-light/10 transition-colors group">
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 bg-brand-light rounded-xl flex items-center justify-center text-brand-dark font-black shadow-sm border border-brand-primary/10 group-hover:scale-110 transition-transform">
                          {patient.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-black text-brand-dark tracking-tight">{patient.name}</div>
                          <div className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">#{patient.patientId || patient.id.slice(-8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-700 tracking-tight">{patient.age} {patient.ageUnit}</span>
                        <span className={`inline-flex items-center mt-1 text-[12px] font-black uppercase tracking-widest ${
                          patient.gender === 'Male' ? 'text-brand-secondary' : 'text-fuchsia-500'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${patient.gender === 'Male' ? 'bg-brand-secondary' : 'bg-fuchsia-500'}`}></div>
                          {patient.gender}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-600 tracking-tight">{patient.phone}</div>
                      <div className="text-[12px] text-slate-400 font-medium mt-0.5 max-w-xs truncate">{patient.address || 'No address provided'}</div>
                    </td>
                    {isSuperAdmin && !activeLabId && (
                      <td className="px-8 py-6 whitespace-nowrap">
                        <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[12px] font-black uppercase tracking-widest border border-slate-200 shadow-sm">
                          {labs.find(l => l.labId === patient.labId)?.labName || patient.labId}
                        </span>
                      </td>
                    )}
                    <td className="px-8 py-6 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-3">
                        <button 
                          onClick={() => handleEdit(patient)}
                          className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-light/50 rounded-xl transition-all duration-300"
                          title="Edit Patient"
                        >
                          <Edit className="w-5 h-5 text-brand-secondary" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm(patient.id)}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all duration-300"
                          title="Delete Patient"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
        </table>
      </div>
    </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-3xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-[0_32px_128px_rgba(0,0,0,0.3)] max-w-2xl w-full border border-white/20 animate-in zoom-in-95 duration-500 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-6 sm:px-10 py-6 sm:py-8 bg-brand-dark text-white flex justify-between items-center shrink-0 border-b border-white/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-[80px] -mr-20 -mt-20"></div>
               <div className="relative z-10 flex items-center gap-4 sm:gap-5">
                  <div className="p-2 sm:p-3 bg-brand-primary rounded-[14px] sm:rounded-[18px] transition-transform rotate-3 hover:rotate-6">
                     <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                     <h2 className="text-lg sm:text-2xl font-black tracking-tighter uppercase leading-none">{editingId ? 'Edit Patient' : 'Add New Patient'}</h2>
                     <p className="text-[8px] sm:text-[9px] font-black text-brand-primary uppercase tracking-[0.4em] mt-1.5 leading-none">Record Configuration</p>
                  </div>
               </div>
               <button onClick={closeModal} className="relative z-10 w-10 h-10 sm:w-12 sm:h-12 flex justify-center items-center bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-white/50 border border-white/5">
                  <X className="w-5 h-5" />
               </button>
            </div>
            
            <form onSubmit={handleAddPatient} className="flex-grow flex flex-col overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar">
                
                {isSuperAdmin && !activeLabId && !editingId && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Select Laboratory *</label>
                    <select 
                      required 
                      className="w-full px-4 py-3 bg-slate-50 border border-brand-primary/20 rounded-xl text-sm font-bold text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 transition-all cursor-pointer"
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

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Full Name *</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="Enter patient's name"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-slate-300 placeholder:font-medium" 
                    value={newPatient.name} 
                    onChange={e => setNewPatient({...newPatient, name: e.target.value})} 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Age *</label>
                    <div className="flex gap-2">
                      <input 
                        required 
                        type="number" 
                        placeholder="00"
                        className="w-2/3 px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-slate-300"
                        value={newPatient.age} 
                        onChange={e => setNewPatient({...newPatient, age: e.target.value})}
                      />
                      <select 
                        className="w-1/3 px-3 py-3 bg-slate-50 border border-slate-100 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none cursor-pointer text-sm"
                        value={newPatient.ageUnit} 
                        onChange={e => setNewPatient({...newPatient, ageUnit: e.target.value})}
                      >
                        <option>Years</option><option>Months</option><option>Days</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Gender *</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none cursor-pointer text-sm"
                      value={newPatient.gender} 
                      onChange={e => setNewPatient({...newPatient, gender: e.target.value})}
                    >
                      <option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="10-digit mobile number"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-slate-300 placeholder:font-medium" 
                      value={newPatient.phone} 
                      onChange={e => setNewPatient({...newPatient, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email <span className="text-brand-primary lowercase tracking-normal font-bold opacity-80">(Needed for reports)</span></label>
                    <input 
                      type="email" 
                      placeholder="patient@email.com"
                      className="w-full px-4 py-3 bg-amber-50/50 border border-amber-500/30 focus:border-amber-500 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-amber-500/50 placeholder:font-medium" 
                      value={newPatient.email} 
                      onChange={e => setNewPatient({...newPatient, email: e.target.value})} 
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Address</label>
                  <textarea 
                    rows="2"
                    placeholder="Enter full address"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-slate-300 placeholder:font-medium resize-none" 
                    value={newPatient.address} 
                    onChange={e => setNewPatient({...newPatient, address: e.target.value})} 
                  />
                </div>
              </div>

              <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-brand-dark hover:border-slate-300 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  disabled={isSaving}
                  onClick={(e) => handleAddPatient(e, true)}
                  className="px-6 py-3 bg-brand-dark text-white rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-brand-dark/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : null}
                  Save & Create Booking
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="px-6 py-3 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : null}
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
            <h3 className="text-xl font-black text-center text-brand-dark tracking-tight mb-2">Delete Patient?</h3>
            <p className="text-sm text-slate-500 font-medium text-center mb-7">This action cannot be undone. The patient record will be permanently removed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-3 bg-rose-500 text-white font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/30 active:scale-95"
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
