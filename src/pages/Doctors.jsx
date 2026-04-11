import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, Loader, UserPlus, Stethoscope, Phone, Mail, Trash2, X } from 'lucide-react';

const Doctors = () => {
  const { userData, activeLabId } = useAuth();
  const isSuperAdmin = userData?.role === 'SuperAdmin';
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDoctor, setNewDoctor] = useState({
    name: '', phone: '', email: '', clinic: '', commissionType: 'Percentage', commissionValue: '0', status: 'Active'
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchDoctors();
  }, [userData, activeLabId]);

  const fetchDoctors = async () => {
    if (!activeLabId && userData?.role !== 'SuperAdmin') return;
    setLoading(true);
    try {
      let q;
      if (activeLabId) {
        q = query(collection(db, 'doctors'), where('labId', '==', activeLabId));
      } else {
        q = query(collection(db, 'doctors'));
      }
      const querySnapshot = await getDocs(q);
      const docs = [];
      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setDoctors(docs);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    if (!activeLabId) {
      alert("Please select a laboratory first.");
      return;
    }

    if (newDoctor.phone) {
      const cleanedPhone = newDoctor.phone.replace(/[\s\-\+]/g, '');
      if (cleanedPhone.length < 10) {
        alert("Please enter a valid phone number (at least 10 digits).");
        return;
      }
    }

    if (newDoctor.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newDoctor.email)) {
        alert("Please enter a valid email address.");
        return;
      }
    }
    try {
      await addDoc(collection(db, 'doctors'), {
        ...newDoctor,
        doctorId: `DOC-${Date.now()}`,
        labId: activeLabId,
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setNewDoctor({ name: '', phone: '', email: '', clinic: '', commissionType: 'Percentage', commissionValue: '0', status: 'Active' });
      fetchDoctors();
    } catch (error) {
      console.error("Error adding doctor:", error);
      alert("Failed to add doctor.");
    }
  }

  const handleDeleteDoctor = async (id) => {
    try {
      await deleteDoc(doc(db, 'doctors', id));
      setDoctors(prev => prev.filter(d => d.id !== id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting doctor:", error);
      alert('Failed to delete doctor: ' + error.message);
      setDeleteConfirm(null);
    }
  };

  const filteredDoctors = doctors.filter(d => 
    d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.phone?.includes(searchTerm)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-brand-dark tracking-tighter flex items-center">
            <div className="p-2 bg-brand-light rounded-xl mr-4 shadow-sm border border-brand-primary/10">
              <Stethoscope className="w-8 h-8 text-brand-primary" />
            </div>
            Doctors
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Manage your referring doctors here.</p>
        </div>
        
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-6 py-3 bg-brand-dark text-white rounded-2xl font-black hover:shadow-2xl hover:shadow-brand-dark/20 hover:-translate-y-1 transition-all duration-300 group active:scale-95 shadow-lg tracking-widest text-[11px] uppercase"
        >
          <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300 text-brand-primary" />
          Add Doctor
        </button>
      </div>

      {/* Search & Statistics */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-grow group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[22px] focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 transition-all text-sm font-bold placeholder:text-slate-400 placeholder:font-medium shadow-sm hover:border-slate-300"
            placeholder="Search by doctor name or clinic..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center px-6 bg-white rounded-[22px] border border-slate-100 shadow-sm whitespace-nowrap">
          <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest mr-3">Total Doctors:</span>
          <span className="text-lg font-black text-brand-dark tabular-nums">{doctors.length}</span>
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-[0_20px_50px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-brand-light/30">
              <tr>
                <th scope="col" className="px-8 py-5 text-left text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Doctor Name</th>
                <th scope="col" className="px-8 py-5 text-left text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Clinic / Hospital</th>
                <th scope="col" className="px-8 py-5 text-left text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Commission</th>
                <th scope="col" className="px-8 py-5 text-left text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Status</th>
                <th scope="col" className="px-8 py-5 text-right text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center">
                    <Loader className="h-10 w-10 animate-spin text-brand-primary mx-auto mb-4" />
                    <p className="text-slate-400 font-black uppercase text-[12px] tracking-widest">Loading...</p>
                  </td>
                </tr>
              ) : filteredDoctors.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                      <Stethoscope className="w-8 h-8" />
                    </div>
                    <p className="text-slate-500 font-bold">No doctors found.</p>
                  </td>
                </tr>
              ) : (
                filteredDoctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-brand-light/10 transition-colors group">
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 bg-brand-light rounded-xl flex items-center justify-center text-brand-dark font-black shadow-sm border border-brand-primary/10 group-hover:scale-110 transition-transform">
                          {doc.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-black text-brand-dark tracking-tight">{doc.name}</div>
                          <div className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {doc.doctorId || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700 tracking-tight">{doc.clinic || 'Independent Practice'}</span>
                        {doc.phone && (
                          <div className="flex items-center mt-1 text-slate-400">
                             <Phone className="w-3 h-3 mr-1.5" />
                             <span className="text-sm font-medium">{doc.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="inline-flex items-center px-3 py-1 bg-brand-light rounded-lg text-[12px] font-black text-brand-dark uppercase tracking-widest border border-brand-primary/10">
                        {doc.commissionValue}{doc.commissionType === 'Percentage' ? '%' : ' Fixed'}
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-black uppercase tracking-widest ${
                        doc.status === 'Active' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-2 ${doc.status === 'Active' ? 'bg-brand-primary animate-pulse' : 'bg-slate-300'}`}></div>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {doc.phone && (
                          <a href={`tel:${doc.phone}`} className="p-2 text-brand-primary hover:bg-brand-primary/10 rounded-xl transition-all" title="Call Doctor">
                            <Phone className="w-5 h-5" />
                          </a>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={() => setDeleteConfirm(doc.id)}
                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                            title="Remove from Registry"
                          >
                            <Trash2 className="w-5 h-5" />
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
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-3xl flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-[0_32px_128px_rgba(0,0,0,0.3)] max-w-2xl w-full border border-white/20 animate-in zoom-in-95 duration-500 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-10 py-8 bg-brand-dark text-white flex justify-between items-center shrink-0 border-b border-white/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-[80px] -mr-20 -mt-20"></div>
               <div className="relative z-10 flex items-center gap-5">
                  <div className="p-3 bg-brand-primary rounded-[18px] transition-transform rotate-3 hover:rotate-6">
                     <Stethoscope className="w-6 h-6 text-white" />
                  </div>
                  <div>
                     <h2 className="text-2xl font-black tracking-tighter uppercase leading-none">Add Doctor</h2>
                     <p className="text-[9px] font-black text-brand-primary uppercase tracking-[0.4em] mt-1.5">Doctor Registry Setup</p>
                  </div>
               </div>
               <button onClick={() => setShowAddModal(false)} className="relative z-10 w-12 h-12 flex justify-center items-center bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-white/50 border border-white/5">
                  <span className="text-xl">&times;</span>
               </button>
            </div>
            
            <form onSubmit={handleAddDoctor} className="flex-grow flex flex-col overflow-hidden">
              <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Doctor Name *</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="Enter doctor's name"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-slate-300 placeholder:font-medium" 
                    value={newDoctor.name} 
                    onChange={e => setNewDoctor({...newDoctor, name: e.target.value})} 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="10-digit mobile number"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-slate-300 placeholder:font-medium" 
                      value={newDoctor.phone} 
                      onChange={e => setNewDoctor({...newDoctor, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email <span className="text-brand-primary lowercase tracking-normal font-bold opacity-80">(Needed for reports)</span></label>
                    <input 
                      type="email" 
                      placeholder="doctor@email.com"
                      className="w-full px-4 py-3 bg-amber-50/50 border border-amber-500/30 focus:border-amber-500 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-amber-500/50 placeholder:font-medium" 
                      value={newDoctor.email} 
                      onChange={e => setNewDoctor({...newDoctor, email: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Specialization</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Cardiologist"
                      list="specializationList"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-slate-300 placeholder:font-medium" 
                      value={newDoctor.specialization} 
                      onChange={e => setNewDoctor({...newDoctor, specialization: e.target.value})} 
                    />
                    <datalist id="specializationList">
                      <option value="General Physician" />
                      <option value="Cardiologist" />
                      <option value="Neurologist" />
                      <option value="Orthopedic" />
                      <option value="Pediatrician" />
                      <option value="Gynecologist" />
                      <option value="Dermatologist" />
                      <option value="Oncologist" />
                      <option value="Endocrinologist" />
                      <option value="Gastroenterologist" />
                      <option value="Psychiatrist" />
                      <option value="ENT Specialist" />
                      <option value="Dentist" />
                      <option value="Pulmonologist" />
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Clinic / Hospital</label>
                    <input 
                      type="text" 
                      placeholder="Enter base location"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-slate-300 placeholder:font-medium" 
                      value={newDoctor.clinic} 
                      onChange={e => setNewDoctor({...newDoctor, clinic: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Commission Structure</label>
                    <div className="flex gap-2">
                      <select 
                        className="w-1/2 px-4 py-3 bg-slate-50 border border-slate-100 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none cursor-pointer text-sm"
                        value={newDoctor.commissionType} 
                        onChange={e => setNewDoctor({...newDoctor, commissionType: e.target.value})}
                      >
                        <option>Percentage</option>
                        <option>Fixed</option>
                      </select>
                      <input 
                        type="number" 
                        placeholder="0"
                        className="w-1/2 px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-slate-300"
                        value={newDoctor.commissionValue} 
                        onChange={e => setNewDoctor({...newDoctor, commissionValue: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Account Status</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none cursor-pointer text-sm"
                      value={newDoctor.status} 
                      onChange={e => setNewDoctor({...newDoctor, status: e.target.value})}
                    >
                      <option>Active</option>
                      <option>Inactive</option>
                    </select>
                  </div>
                </div>

              </div>

              <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-brand-dark hover:border-slate-300 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-3 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Save Doctor
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
            <h3 className="text-xl font-black text-center text-brand-dark tracking-tight mb-2">Delete Doctor?</h3>
            <p className="text-sm text-slate-500 font-medium text-center mb-7">This action cannot be undone. The doctor record will be permanently removed from the registry.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteDoctor(deleteConfirm)}
                className="flex-1 px-4 py-3 bg-rose-500 text-white font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/30 active:scale-95"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Doctors;
