import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Shield, Plus, Loader, Activity, CheckCircle, AlertTriangle, Users, ExternalLink, Search, Filter, Lock, X, Globe, FileText, CreditCard, FlaskConical, Settings, BookOpen, User, Trash2, ChevronRight, Zap } from 'lucide-react';
import GlobalTestCatalog from '../components/GlobalTestCatalog';
import GlobalSettings from '../components/GlobalSettings';
import MasterParameters from './MasterParameters';
import PlansTab from '../components/PlansTab';

const SuperAdminDashboard = () => {
  const { currentUser, userData, setActiveLabId, activeLabId, allPlans } = useAuth();
  const [labs, setLabs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('Active');
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, pro: 0 });
  const [activeView, setActiveView] = useState('labs'); // 'labs', 'tests', 'requests', 'token_requests'
  const [tokenRequests, setTokenRequests] = useState([]);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tokenForm, setTokenForm] = useState({ labId: '', amount: '100', labName: '' });

  const [isPinVerified, setIsPinVerified] = useState(
    sessionStorage.getItem('superadmin_pin_verified') === 'true'
  );
  const [pinInputs, setPinInputs] = useState(Array(8).fill(''));
  const inputRefs = React.useRef([]);
  const [pinError, setPinError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [newLabData, setNewLabData] = useState({ 
    labName: '', 
    labFullName: '',
    email: '', 
    plan: 'basic', 
    months: 12,
    labType: 'Standalone',
    ownerName: '',
    phone: '',
    licenseNo: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    watermarkText: '',
    footerText: ''
  });
  const [registrationSuccess, setRegistrationSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLab, setEditingLab] = useState(null);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendingMonths, setExtendingMonths] = useState(12);
  const [trFilter, setTrFilter] = useState('pending');
  const [processingRequestId, setProcessingRequestId] = useState(null);

  const trCounts = {
    all: tokenRequests.length,
    pending: tokenRequests.filter(r => r.status === 'pending').length,
    approved: tokenRequests.filter(r => r.status === 'approved').length,
    rejected: tokenRequests.filter(r => r.status === 'rejected').length
  };

  const filteredTokenRequests = trFilter === 'all' 
    ? tokenRequests 
    : tokenRequests.filter(r => r.status === trFilter);

  const isExpired = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return true;
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today;
  };

  const getRemainingDays = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return 0;
    const today = new Date();
    today.setHours(0,0,0,0);
    const exp = new Date(dateStr);
    exp.setHours(0,0,0,0);
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    try {
      const [y, m, d] = dateStr.split('-');
      if (!y || !m || !d) return dateStr;
      return `${d}/${m}/${y}`;
    } catch {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return `${date.getDate().toString().padStart(2,'0')}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getFullYear()}`;
    }
  };

  // Real-time validation for Lab Creation
  useEffect(() => {
    const newErrors = {};
    
    // Email Validation
    if (newLabData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLabData.email)) {
        newErrors.email = 'Please enter a valid business email';
    }

    // Phone Validation (10 digits)
    if (newLabData.phone && !/^\d{10}$/.test(newLabData.phone.replace(/[^0-9]/g, ''))) {
        newErrors.phone = 'Please enter a valid 10-digit mobile number';
    }

    // Required fields check for current tab
    if (activeTab === 'basic') {
        if (!newLabData.labName) newErrors.labName = 'Short name is required';
        if (!newLabData.labFullName) newErrors.labFullName = 'Full laboratory name is required';
        if (!newLabData.email) newErrors.email = 'Admin email is required';
        if (!newLabData.phone) newErrors.phone = 'Mobile number is required';
    }

    setErrors(newErrors);
  }, [newLabData, activeTab]);

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  useEffect(() => {
    if (isPinVerified) {
      fetchLabs();
      fetchRequests();
      fetchTokenRequests();
    }
  }, [isPinVerified]);

  const fetchTokenRequests = async () => {
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const token = await currentUser.getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/superadmin/token-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setTokenRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching token requests:", error);
      toast.error("Failed to sync token requests");
    }
  };

  const handleApproveTokenRequest = async (req) => {
    setProcessingRequestId(req.id);
    console.log("[TokenApprove] Starting approval for:", req.id);
    
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const token = await currentUser.getIdToken();
      console.log("[TokenApprove] Token fetched, sending request...");
      
      const res = await fetch(`${BACKEND_URL}/api/superadmin/add-tokens`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          labId: req.labId, 
          amount: req.requestedAmount, 
          requestId: req.id 
        })
      });
      
      console.log("[TokenApprove] Response status:", res.status);
      
      if (res.ok) {
        toast.success("Tokens added and request approved!");
        await fetchTokenRequests();
        await fetchLabs();
      } else {
        const data = await res.json();
        console.error("[TokenApprove] Backend error:", data);
        toast.error(data.error || "Failed to approve request");
      }
    } catch (error) {
      console.error("[TokenApprove] Network/Logic error:", error);
      toast.error("Network error: " + error.message);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectTokenRequest = async (reqId) => {
    setProcessingRequestId(reqId);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const token = await currentUser.getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/superadmin/reject-token-request`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ requestId: reqId })
      });
      
      if (res.ok) {
        toast.success("Request rejected successfully");
        await fetchTokenRequests();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to reject request");
      }
    } catch (error) {
      toast.error("Network error: " + error.message);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleManualAddTokens = async (e) => {
    e.preventDefault();
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const token = await currentUser.getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/superadmin/add-tokens`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          labId: tokenForm.labId, 
          amount: tokenForm.amount 
        })
      });
      
      if (res.ok) {
        toast.success(`Added ${tokenForm.amount} tokens to ${tokenForm.labName}`);
        setIsTokenModalOpen(false);
        fetchLabs();
      } else {
        toast.error("Failed to add tokens");
      }
    } catch (error) {
      toast.error("Network error");
    }
  };

  const fetchRequests = async () => {
    try {
      const q = query(collection(db, 'signupRequests'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching requests:", error);
    }
  };
  const handleDeleteRequest = async (id) => {
    console.log("Starting deletion process for ID:", id);
    setProcessingRequestId(id);
    try {
      const docRef = doc(db, 'signupRequests', id);
      await deleteDoc(docRef);
      console.log("Delete successful for:", id);
      await fetchRequests();
      toast.success("Request deleted successfully");
    } catch (error) {
      console.error("Error deleting request:", error);
      toast.error(`Delete failed: ${error.message || 'Permission denied'}`);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const confirmDelete = (req) => {
    toast(
      ({ closeToast }) => (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 py-2">
          <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto">
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-rose-500 border border-brand-primary/20 shadow-sm shrink-0">
                <Trash2 className="w-6 h-6" />
             </div>
             <div className="min-w-0 flex-grow">
                <p className="text-[13px] font-black text-brand-dark uppercase tracking-tight truncate">Delete Request: {req.labFullName || req.labName}</p>
                <p className="text-[10px] text-brand-primary font-black uppercase tracking-widest mt-0.5 truncate">Admin: {req.ownerName}</p>
             </div>
          </div>
          <div className="flex gap-3 w-full sm:w-auto sm:ml-auto">
            <button 
              onClick={() => { handleDeleteRequest(req.id); closeToast(); }}
              className="flex-1 sm:flex-none px-8 py-3.5 bg-brand-dark text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-xl shadow-brand-dark/20 transition-all border border-white/5 active:scale-95 whitespace-nowrap"
            >
              Confirm
            </button>
            <button 
              onClick={closeToast}
              className="flex-1 sm:flex-none px-8 py-3.5 bg-white text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 border border-slate-100 transition-all active:scale-95 whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </div>
      ),
      { 
        position: "top-center",
        autoClose: false, 
        closeOnClick: false,
        draggable: false,
        className: 'rounded-[32px] shadow-[0_32px_128px_rgba(0,0,0,0.1)] border-2 border-brand-primary/10 p-6 bg-brand-light ring-4 ring-brand-primary/5 w-[calc(100vw-32px)] sm:w-auto sm:max-w-3xl sm:min-w-[550px]'
      }
    );
  };

  const handleRejectRequest = async (id) => {
    console.log("Attempting to reject request ID:", id);
    setProcessingRequestId(id);
    try {
      const docRef = doc(db, 'signupRequests', id);
      await updateDoc(docRef, { 
        status: 'rejected', 
        updatedAt: serverTimestamp() 
      });
      console.log("Reject successful for:", id);
      await fetchRequests();
      toast.warn("Registration request rejected");
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error(`Reject failed: ${error.message}`);
    } finally {
      setProcessingRequestId(null);
    }
  };
  // Redundant PIN logic removed (submitPin handles it now)

  const fetchLabs = async () => {
    setLoading(true);
    try {
      const labsSnap = await getDocs(collection(db, 'labs'));
      const subsSnap = await getDocs(collection(db, 'subscriptions'));
      
      const subsMap = {};
      subsSnap.forEach(doc => subsMap[doc.id] = doc.data());
      
      const labsList = labsSnap.docs.map(doc => {
        const data = doc.data();
        const sub = subsMap[doc.id] || {};
        return {
          id: doc.id,
          ...sub,     // subscriptions data first
          ...data,    // labs profile data second (wins on duplicates like labName)
          expiryDate: sub.expiryDate || 'N/A',
          plan: sub.plan || 'basic',
          status: sub.status || 'inactive'
        };
      });
      
      setLabs(labsList);
      
      const active = labsList.filter(l => l.status === 'active' && !isExpired(l.expiryDate)).length;
      const expiredCount = labsList.filter(l => isExpired(l.expiryDate)).length;
      const pro = labsList.filter(l => l.plan === 'pro').length;
      
      setStats({
        total: labsList.length,
        active,
        expired: expiredCount,
        pro
      });
    } catch (error) {
      console.error('Error fetching labs data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterLab = async (e) => {
    e.preventDefault();
    setRegistering(true);
    try {
      const token = localStorage.getItem('jwt_token');
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      
      const res = await fetch(`${BACKEND_URL}/api/superadmin/register-lab`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newLabData)
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to register lab');
      }
      
      const data = await res.json();
      setRegistrationSuccess(data);
      
      // If this was from a request, update the request status
      if (newLabData.requestId) {
        await updateDoc(doc(db, 'signupRequests', newLabData.requestId), {
          status: 'approved',
          updatedAt: serverTimestamp()
        });
        toast.success("Registration request approved! Welcome email sent.");
        fetchRequests();
      } else {
        toast.success("New laboratory registered successfully! Welcome email sent.");
      }

      setShowRegisterModal(false);
      setNewLabData({ 
        labName: '', email: '', plan: 'basic', months: 12,
        labType: 'Standalone', ownerName: '', phone: '', licenseNo: '',
        address: '', city: '', state: '', pincode: '',
        watermarkText: '', footerText: ''
      });
      setActiveTab('basic');
      fetchLabs();
    } catch (err) {
      console.error("Registration Error:", err);
      toast.error(err.message);
    } finally {
      setRegistering(false);
    }
  };

  const handleUpdateLab = async (e) => {
    e.preventDefault();
    if (!editingLab) return;
    setRegistering(true);
    try {
      // Update labs collection (profile info)
      await updateDoc(doc(db, 'labs', editingLab.id), {
        labName: editingLab.labName,
        labFullName: editingLab.labFullName || '',
        ownerName: editingLab.ownerName || '',
        phone: editingLab.phone || '',
        licenseNo: editingLab.licenseNo || '',
        address: editingLab.address || '',
        city: editingLab.city || '',
        state: editingLab.state || '',
        pincode: editingLab.pincode || '',
        watermarkText: editingLab.watermarkText || '',
        footerText: editingLab.footerText || '',
        updatedAt: serverTimestamp()
      });

      // Update subscriptions collection (consistency for labName and plan)
      await updateDoc(doc(db, 'subscriptions', editingLab.id), {
        labName: editingLab.labName, // Update here too to prevent stale data in combined view
        plan: editingLab.plan || 'basic',
        updatedAt: serverTimestamp()
      });

      setShowEditModal(false);
      setEditingLab(null);
      fetchLabs();
      toast.success("Lab details updated successfully!");
    } catch (err) {
      console.error("Update Error:", err);
      toast.error("Update failed: " + err.message);
    } finally {
      setRegistering(false);
    }
  };

  const handleExtendSubscription = async () => {
    if (!editingLab) return;
    setRegistering(true);
    try {
      const today = new Date();
      let startDate = new Date();
      
      const currentExpiry = editingLab.expiryDate !== 'N/A' ? new Date(editingLab.expiryDate) : null;
      
      // If lab is not expired yet, start from the existing expiry date. 
      // If expired, start from today.
      if (currentExpiry && currentExpiry > today) {
        startDate = currentExpiry;
      }
      
      const newExpiry = new Date(startDate);
      newExpiry.setMonth(newExpiry.getMonth() + extendingMonths);
      const newExpiryStr = newExpiry.toISOString().split('T')[0];

      await updateDoc(doc(db, 'subscriptions', editingLab.id), {
        expiryDate: newExpiryStr,
        status: 'active',
        updatedAt: serverTimestamp()
      });

      setShowExtendModal(false);
      fetchLabs();
      toast.success(`Subscription extended until ${newExpiryStr}`);
    } catch (err) {
      toast.error("Extension failed: " + err.message);
    } finally {
      setRegistering(false);
    }
  };

  const handleToggleStatus = async (labId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, 'subscriptions', labId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      fetchLabs();
      toast.success(`Lab ${newStatus === 'active' ? 'activated' : 'suspended'} successfully!`);
    } catch (error) {
      toast.error("Error updating lab status: " + error.message);
    }
  };

  const filteredLabs = labs.filter(l => {
    const matchesSearch = l.labName?.toLowerCase().includes(searchTerm.toLowerCase()) || l.labId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'All' || 
                         (filter === 'Active' && l.status === 'active') || 
                         (filter === 'Expired' && l.status === 'expired') ||
                         (filter === 'Pro' && l.plan === 'pro');
    return matchesSearch && matchesFilter;
  });

  const handlePinChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // numbers only
    const newPin = [...pinInputs];
    newPin[index] = value.slice(-1);
    setPinInputs(newPin);
    
    // Auto-focus move forward
    if (value && index < 7) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pinInputs[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const submitPin = async (e) => {
    if (e) e.preventDefault();
    const pinString = pinInputs.join('');
    if (pinString.length < 8) return;

    setPinError('');
    setVerifying(true);
    
    try {
      const token = localStorage.getItem('jwt_token');
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      
      const res = await fetch(`${BACKEND_URL}/api/verify-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pin: pinString })
      });
      
      if (!res.ok) throw new Error('Incorrect Security PIN');
      
      sessionStorage.setItem('superadmin_pin_verified', 'true');
      setIsPinVerified(true);
    } catch (err) {
      setPinError(err.message);
      setPinInputs(Array(8).fill(''));
      inputRefs.current[0].focus();
    } finally {
      setVerifying(false);
    }
  };

  // Trigger submit automatically when 8th digit is entered
  useEffect(() => {
    if (pinInputs.every(val => val !== '') && pinInputs.length === 8) {
      submitPin();
    }
  }, [pinInputs]);

  const handlePinLogout = async () => {
    sessionStorage.removeItem('superadmin_pin_verified');
    const { signOut } = await import('firebase/auth');
    const { auth } = await import('../firebase');
    await signOut(auth);
  };

  if (!isPinVerified) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark p-4 font-sans overflow-hidden select-none">
        {/* Advanced Brand Mesh Gradient Background */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-brand-primary/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-brand-secondary/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>
        
        {/* Subtle Texture Overlay */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-slate-900/10"></div>

        <div className="max-w-2xl w-full relative z-10 p-6">
          <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[3rem] md:rounded-[4rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.6)] p-8 md:p-16 text-center ring-1 ring-inset ring-white/10 overflow-hidden group animate-in fade-in zoom-in duration-700">
            
            {/* Glossy Header */}
            <div className="relative mb-8 md:mb-12">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-white rounded-[24px] md:rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-xl border border-slate-100 transition-transform duration-500 rotate-6 group-hover:rotate-0 p-2 md:p-3">
                <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-2xl md:text-5xl font-black text-white tracking-tighter leading-tight uppercase">
                Admin <span className="text-brand-primary">Login</span>
              </h2>
              <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.4em] mt-3 animate-pulse">Security Verification</p>
            </div>

            {/* PIN Input Grid */}
            <div className="flex justify-between gap-2 md:gap-4 mb-12 max-w-md mx-auto">
              {pinInputs.map((digit, i) => (
                <div key={i} className="relative group/input flex-1">
                  <input
                    ref={el => inputRefs.current[i] = el}
                    type="password"
                    value={digit}
                    onChange={(e) => handlePinChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    maxLength={1}
                    autoComplete="off"
                    className={`w-full h-12 md:h-20 text-center text-xl md:text-3xl font-black rounded-xl md:rounded-[22px] border-2 transition-all duration-300 outline-none
                      ${digit 
                        ? 'border-brand-primary bg-brand-primary/10 text-white shadow-[0_0_30px_rgba(163,230,53,0.3)] ring-2 ring-brand-primary/10' 
                        : 'border-white/5 bg-white/5 text-transparent focus:border-brand-primary focus:bg-white/10 focus:shadow-[0_0_20px_rgba(163,230,53,0.2)]'}`}
                    autoFocus={i === 0}
                  />
                  {!digit && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 group-focus-within/input:opacity-50 transition-opacity">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/50 group-focus-within/input:bg-brand-primary"></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Status Indicators */}
            <div className="h-10 mb-12 flex items-center justify-center">
              {pinError ? (
                <div className="flex items-center text-rose-50 px-8 py-3 rounded-2xl bg-rose-600/40 border border-rose-500/50 animate-shake shadow-[0_15px_40px_rgba(244,63,94,0.3)] font-black text-[10px] uppercase tracking-widest">
                  <AlertTriangle className="w-5 h-5 mr-3" />
                  Terminal Restricted
                </div>
              ) : verifying ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-2">
                    {[0,1,2].map(n => <div key={n} className="w-2.5 h-2.5 rounded-full bg-brand-primary animate-bounce shadow-[0_0_10px_rgba(163,230,53,0.5)]" style={{ animationDelay: `${n * 0.1}s` }}></div>)}
                  </div>
                  <span className="text-brand-primary/80 text-[9px] font-black uppercase tracking-[0.4em]">Validation Active</span>
                </div>
              ) : (
                <div className="flex items-center gap-4 text-white/20 font-black text-[10px] uppercase tracking-[0.4em]">
                   <Loader className="w-3 h-3 animate-spin" />
                   Security Protocol Ready
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-10 border-t border-white/5 space-y-6">
              <button 
                onClick={handlePinLogout}
                className="group/btn w-full py-5 rounded-[22px] bg-white/5 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/30 transition-all duration-300 flex items-center justify-center text-white/50 hover:text-rose-500 font-black uppercase tracking-[0.3em] text-[10px]"
              >
                <Lock className="w-4 h-4 mr-3 group-hover/btn:scale-110 transition-transform" />
                Logout
              </button>
            </div>
          </div>
          
          <div className="mt-12 text-center space-y-3 opacity-20 font-black uppercase tracking-[0.5em] text-[9px] text-white">
             <div className="flex items-center justify-center gap-6">
               <div className="w-16 h-px bg-white/20"></div>
               <span>Admin Access</span>
               <div className="w-16 h-px bg-white/20"></div>
             </div>
             <div>Lab Mitra // Admin Panel v4.2</div>
          </div>
        </div>
        
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-10px); }
            40% { transform: translateX(10px); }
            60% { transform: translateX(-10px); }
            80% { transform: translateX(10px); }
          }
          .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        `}} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-4 md:py-6 w-full animate-in fade-in duration-500">
      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto no-scrollbar bg-slate-50 p-1 rounded-full md:rounded-[1.5rem] w-full md:w-fit mb-4 md:mb-5 border border-slate-100 shadow-inner">
        <div className="flex gap-1 shrink-0">
          <button 
            onClick={() => setActiveView('labs')}
            className={`flex items-center gap-2 md:gap-2.5 px-4 md:px-6 py-2 md:py-2.5 rounded-full md:rounded-[1.2rem] font-black uppercase tracking-widest text-[8px] md:text-[9px] transition-all whitespace-nowrap ${activeView === 'labs' ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20' : 'text-slate-400 hover:text-brand-dark'}`}
          >
            <Users className="w-3 h-3 md:w-3.5 md:h-3.5" /> Labs
          </button>
          <button 
            onClick={() => setActiveView('tests')}
            className={`flex items-center gap-2 md:gap-2.5 px-4 md:px-6 py-2 md:py-2.5 rounded-full md:rounded-[1.2rem] font-black uppercase tracking-widest text-[8px] md:text-[9px] transition-all whitespace-nowrap ${activeView === 'tests' ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20' : 'text-slate-400 hover:text-brand-dark'}`}
          >
            <FlaskConical className="w-3 h-3 md:w-3.5 md:h-3.5" /> Global Tests
          </button>
          <button 
            onClick={() => setActiveView('settings')}
            className={`flex items-center gap-2 md:gap-2.5 px-4 md:px-6 py-2 md:py-2.5 rounded-full md:rounded-[1.2rem] font-black uppercase tracking-widest text-[8px] md:text-[9px] transition-all whitespace-nowrap ${activeView === 'settings' ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20' : 'text-slate-400 hover:text-brand-dark'}`}
          >
            <Settings className="w-3 h-3 md:w-3.5 md:h-3.5" /> Global Settings
          </button>
          <button 
            onClick={() => setActiveView('parameters')}
            className={`flex items-center gap-2 md:gap-2.5 px-4 md:px-6 py-2 md:py-2.5 rounded-full md:rounded-[1.2rem] font-black uppercase tracking-widest text-[8px] md:text-[9px] transition-all whitespace-nowrap ${activeView === 'parameters' ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20' : 'text-slate-400 hover:text-brand-dark'}`}
          >
            <BookOpen className="w-3 h-3 md:w-3.5 md:h-3.5" /> Parameters
          </button>
          <button 
            onClick={() => setActiveView('plans')}
            className={`flex items-center gap-2 md:gap-2.5 px-4 md:px-6 py-2 md:py-2.5 rounded-full md:rounded-[1.2rem] font-black uppercase tracking-widest text-[8px] md:text-[9px] transition-all whitespace-nowrap ${activeView === 'plans' ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20' : 'text-slate-400 hover:text-brand-dark'}`}
          >
            <CreditCard className="w-3 h-3 md:w-3.5 md:h-3.5" /> Pricing Plans
          </button>
          <button 
            onClick={() => setActiveView('token_requests')}
            className={`flex items-center gap-2 md:gap-2.5 px-4 md:px-6 py-2 md:py-2.5 rounded-full md:rounded-[1.2rem] font-black uppercase tracking-widest text-[8px] md:text-[9px] transition-all relative whitespace-nowrap ${activeView === 'token_requests' ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/20' : 'text-slate-400 hover:text-brand-dark'}`}
          >
            <Zap className="w-3 h-3 md:w-3.5 md:h-3.5" /> 
            Tokens
            {tokenRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 md:w-4 md:h-4 bg-amber-600 text-white text-[7px] flex items-center justify-center rounded-full animate-bounce shadow-lg ring-2 ring-white">
                {tokenRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveView('requests')}
            className={`flex items-center gap-2 md:gap-2.5 px-4 md:px-6 py-2 md:py-2.5 rounded-full md:rounded-[1.2rem] font-black uppercase tracking-widest text-[8px] md:text-[9px] transition-all relative whitespace-nowrap ${activeView === 'requests' ? 'bg-brand-dark text-white shadow-xl shadow-brand-dark/20' : 'text-slate-400 hover:text-brand-dark'}`}
          >
            <User className="w-3 h-3 md:w-3.5 md:h-3.5" /> 
            Requests
            {requests.filter(r => r.status === 'pending').length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 md:w-4 md:h-4 bg-rose-500 text-white text-[7px] flex items-center justify-center rounded-full animate-bounce shadow-lg ring-2 ring-white">
                {requests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeView === 'labs' ? (
        <>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-8 mb-4 md:mb-5 bg-white p-3 md:p-5 rounded-2xl md:rounded-[28px] shadow-[0_15px_40px_rgb(0,0,0,0.01)] border border-slate-100">
            <div className="w-full lg:w-auto">
              <div className="flex items-center gap-3">
                <div className="p-2 md:p-3 bg-brand-light rounded-xl md:rounded-[18px] border border-brand-primary/10 transition-transform rotate-3">
                  <Shield className="w-5 h-5 md:w-6 md:h-6 text-brand-primary" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-brand-dark tracking-tighter uppercase whitespace-nowrap">
                    Admin <span className="text-brand-primary/80">Dashboard</span>
                  </h1>
                  <p className="text-[8px] md:text-[9.5px] font-black text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.3em] mt-1 line-clamp-1">Manage all labs and their subscriptions here.</p>
                </div>
              </div>
              {activeLabId && (
                <div className="mt-3 md:mt-4 flex items-center gap-2.5 opacity-0 animate-in fade-in slide-in-from-left-4 duration-500 fill-mode-forwards" style={{ animationDelay: '0.2s' }}>
                   <div className="px-3.5 md:px-4 py-1.5 md:py-2 bg-brand-light/40 text-brand-dark rounded-full text-[8px] md:text-[9.5px] font-black uppercase tracking-widest border border-brand-primary/10 flex items-center gap-2.5 shadow-sm">
                      <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse"></div>
                      <span className="truncate max-w-[120px] md:max-w-none">Managing: {activeLabId}</span>
                      <button onClick={() => setActiveLabId(null)} className="ml-1 w-4 h-4 bg-white rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm">&times;</button>
                   </div>
                </div>
              )}
            </div>
            <button 
              onClick={() => setShowRegisterModal(true)}
              className="w-full lg:w-auto flex items-center justify-center gap-2.5 px-6 md:px-8 py-3 md:py-4 bg-brand-dark text-white rounded-2xl md:rounded-[20px] text-[9.5px] md:text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-brand-dark/20 hover:bg-brand-secondary active:scale-[0.98] border border-white/10 group"
            >
              <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 text-brand-primary group-hover:rotate-90 transition-transform" /> Add Lab
            </button>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 mb-5 md:mb-8">
            <StatCard icon={<Users className="text-white w-5 h-5 md:w-6 md:h-6" />} label="Total Labs" value={stats.total} color="from-brand-dark to-brand-secondary" gradient />
            <StatCard icon={<CheckCircle className="text-white w-5 h-5 md:w-6 md:h-6" />} label="Active Labs" value={stats.active} color="from-brand-primary to-lime-600" gradient />
            <StatCard icon={<AlertTriangle className="text-white w-5 h-5 md:w-6 md:h-6" />} label="Expired Labs" value={stats.expired} color="from-rose-500 to-rose-700" gradient />
            <StatCard icon={<Activity className="text-white w-5 h-5 md:w-6 md:h-6" />} label="Pro Labs" value={stats.pro} color="from-brand-secondary to-blue-700" gradient />
          </div>

          {/* Lab Management Table */}
          <div className="bg-white rounded-[32px] md:rounded-[42px] shadow-[0_32px_128px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden mb-8 flex flex-col max-h-[60vh]">
            <div className="p-3 md:p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 md:gap-4 items-center bg-slate-50 sticky top-0 z-20">
              <div className="relative flex-grow group w-full md:w-auto">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-brand-primary transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search labs..."
                  className="w-full pl-12 pr-6 py-2.5 bg-white border border-slate-200 rounded-[14px] text-[11px] font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary/30 transition-all shadow-sm placeholder:text-slate-300"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex bg-white p-1 rounded-[16px] border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                {['All', 'Active', 'Expired', 'Pro'].map(f => (
                  <button 
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4.5 py-2.5 rounded-[14px] text-[9.5px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === f ? 'bg-brand-dark text-white shadow-lg' : 'text-slate-400 hover:text-brand-dark'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-auto custom-scrollbar flex-grow relative">
              {loading ? (
                <div className="p-24 flex justify-center"><Loader className="w-12 h-12 animate-spin text-brand-primary" /></div>
              ) : filteredLabs.length === 0 ? (
              <div className="p-32 text-center">
                 <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mx-auto mb-8 border border-slate-100">
                    <Shield className="w-10 h-10 text-slate-200" />
                 </div>
                 <p className="text-xl font-black text-brand-dark/20 uppercase tracking-widest">No labs found.</p>
                 <button onClick={() => setShowRegisterModal(true)} className="mt-6 text-brand-primary font-black uppercase tracking-widest text-[10px] hover:underline underline-offset-8">Add your first lab here</button>
              </div>
            ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-brand-dark sticky top-0 z-10 shadow-sm">
                      <th className="px-5 py-3 md:px-8 md:py-4 text-[10px] md:text-[11px] font-black text-white/70 uppercase tracking-[0.15em] bg-brand-dark sticky top-0">Lab Name</th>
                      <th className="px-5 py-3 md:px-8 md:py-4 text-[10px] md:text-[11px] font-black text-white/70 uppercase tracking-[0.15em] text-center bg-brand-dark sticky top-0">Plan</th>
                      <th className="px-5 py-3 md:px-8 md:py-4 text-[10px] md:text-[11px] font-black text-white/70 uppercase tracking-[0.15em] bg-brand-dark sticky top-0">Status</th>
                      <th className="px-5 py-3 md:px-8 md:py-4 text-[10px] md:text-[11px] font-black text-white/70 uppercase tracking-[0.15em] bg-brand-dark sticky top-0">License</th>
                      <th className="px-5 py-3 md:px-8 md:py-4 text-right text-[10px] md:text-[11px] font-black text-white/70 uppercase tracking-[0.15em] bg-brand-dark sticky top-0">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {filteredLabs.map((lab) => {
                      const today = new Date().toISOString().split('T')[0];
                      const isExp = lab.expiryDate < today;
                      
                      return (
                        <tr key={lab.id} className="hover:bg-brand-light/10 transition-colors group/row border-b border-slate-50 last:border-0">
                          <td className="px-5 py-3.5 md:px-8 md:py-4.5 whitespace-nowrap">
                            <div className="font-black text-brand-dark text-[12px] md:text-sm tracking-tight uppercase leading-tight">{lab.labName}</div>
                            <div className="flex flex-col gap-0.5 mt-1">
                               <div className="text-[9px] md:text-[10px] text-slate-300 font-bold uppercase tracking-widest flex items-center gap-2">
                                  <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                                  ID: {lab.labId}
                               </div>
                               <div className="text-[9px] md:text-[10px] text-brand-primary font-black uppercase tracking-widest flex items-center gap-2">
                                  <div className="w-1 h-1 bg-brand-primary/30 rounded-full"></div>
                                  Admin: {lab.ownerName || 'Admin'}
                               </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 md:px-8 md:py-4.5 text-center">
                            <span className={`px-2.5 py-1 md:px-3.5 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest border transition-all ${
                              lab.plan === 'pro' 
                                ? 'bg-brand-dark text-white border-brand-dark shadow-lg shadow-brand-dark/10' 
                                : lab.plan === 'pay_as_you_go'
                                  ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/10'
                                  : 'bg-brand-light/50 text-brand-dark border-brand-primary/10'
                            }`}>
                              {lab.plan?.replace(/_/g, ' ') || 'basic'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 md:px-8 md:py-4.5 whitespace-nowrap">
                            <div className="flex items-center space-x-2.5">
                              <div className={`w-1.5 h-1.5 rounded-full shadow-sm ${lab.status === 'active' && !isExp ? 'bg-brand-primary animate-pulse shadow-brand-primary/50' : 'bg-rose-500 shadow-rose-500/50'}`} />
                              <span className="text-[10px] md:text-[11px] font-black text-brand-dark uppercase tracking-wide">
                                {lab.status === 'active' && !isExp ? 'Active' : isExp ? 'Expired' : 'Suspended'}
                              </span>
                            </div>
                            <div className="flex flex-col mt-1 ml-4 shadow-inner">
                              <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest scale-95 origin-left">Exp: {formatDisplayDate(lab.expiryDate)}</span>
                              <span className={`text-[7.5px] md:text-[8.5px] font-black uppercase tracking-[0.1em] mt-0.5 ${isExp ? 'text-rose-500' : getRemainingDays(lab.expiryDate) < 7 ? 'text-amber-500' : 'text-brand-primary'}`}>
                                {isExp ? 'EXPIRED' : `${getRemainingDays(lab.expiryDate)}d Left`}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 md:px-8 md:py-4.5">
                            <code className="bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg text-[9px] md:text-[11px] font-bold font-mono text-brand-secondary shadow-inner">{lab.license_key}</code>
                          </td>
                          <td className="px-5 py-3.5 md:px-8 md:py-4.5 text-right">
                            <div className="flex justify-end gap-1.5 md:gap-2.5">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setActiveLabId(lab.labId); }}
                                className={`flex items-center gap-2 px-3.5 py-2 md:px-5 md:py-2.5 rounded-lg font-black uppercase tracking-widest text-[9.5px] md:text-[10px] transition-all ${activeLabId === lab.labId ? 'bg-brand-primary text-white shadow-xl shadow-brand-primary/20 scale-105' : 'bg-white border border-slate-100 text-slate-400 hover:border-brand-primary hover:text-brand-primary shadow-sm active:scale-95'}`}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{activeLabId === lab.labId ? 'Managing' : 'Enter'}</span>
                              </button>
                              <button 
                                onClick={() => { setEditingLab({...lab}); setShowEditModal(true); setActiveTab('basic'); }}
                                className="p-2 rounded-lg transition-all border border-slate-100 text-slate-400 hover:border-brand-primary hover:text-brand-primary shadow-sm active:scale-95"
                                title="Edit Lab Details"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => { setEditingLab({...lab}); setShowExtendModal(true); }}
                                className="p-2 rounded-lg transition-all border border-slate-100 text-amber-500 hover:bg-amber-500 hover:text-white shadow-sm active:scale-95"
                                title="Extend Subscription"
                              >
                                <CreditCard className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => { 
                                  setTokenForm({ labId: lab.labId, amount: '100', labName: lab.labName });
                                  setIsTokenModalOpen(true);
                                }}
                                className="p-2 rounded-lg transition-all border border-slate-100 text-amber-500 hover:bg-amber-500 hover:text-white shadow-sm active:scale-95"
                                title="Add Tokens"
                              >
                                <Zap className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleToggleStatus(lab.id, lab.status)}
                                className={`p-2 rounded-lg transition-all border ${lab.status === 'active' ? 'text-rose-400 border-rose-50 hover:bg-rose-500 hover:text-white' : 'text-brand-primary border-brand-light hover:bg-brand-primary hover:text-white'} shadow-sm active:scale-95`}
                                title={lab.status === 'active' ? "Terminate" : "Authorize"}
                              >
                                <Shield className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : activeView === 'tests' ? (
        <GlobalTestCatalog />
      ) : activeView === 'parameters' ? (
        <MasterParameters />
      ) : activeView === 'plans' ? (
        <PlansTab />
      ) : activeView === 'settings' ? (
        <GlobalSettings />
      ) : activeView === 'token_requests' ? (
        <div className="animate-in fade-in duration-700">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-8 mb-8 md:mb-10 bg-white p-5 md:p-8 rounded-2xl md:rounded-[28px] shadow-sm border border-slate-100">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-brand-dark tracking-tighter uppercase whitespace-nowrap">
                Token <span className="text-amber-500">Requests</span>
              </h1>
              <p className="text-[8px] md:text-[9.5px] font-black text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.3em] mt-1">Manage token purchase requests from laboratories.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {[
                { id: 'all', label: 'All', count: trCounts.all, color: 'slate' },
                { id: 'pending', label: 'Pending', count: trCounts.pending, color: 'amber' },
                { id: 'approved', label: 'Approved', count: trCounts.approved, color: 'emerald' },
                { id: 'rejected', label: 'Rejected', count: trCounts.rejected, color: 'rose' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTrFilter(f.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    trFilter === f.id 
                    ? `bg-${f.color === 'emerald' ? 'emerald-500' : f.color === 'rose' ? 'rose-500' : f.color === 'amber' ? 'amber-500' : 'brand-dark'} text-white shadow-xl scale-105` 
                    : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-white active:scale-95'
                  }`}
                >
                  {f.label}
                  <span className={`px-1.5 py-0.5 rounded-lg text-[9px] ${trFilter === f.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[32px] md:rounded-[42px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-amber-500 text-white">
                  <tr>
                    <th className="px-5 py-3 md:px-8 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest">Laboratory</th>
                    <th className="px-5 py-3 md:px-8 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest">Admin Details</th>
                    <th className="px-5 py-3 md:px-8 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-center">Amount</th>
                    <th className="px-5 py-3 md:px-8 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest">Date</th>
                    <th className="px-5 py-3 md:px-8 md:py-4 text-right text-[10px] md:text-[11px] font-black uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredTokenRequests.length === 0 ? (
                    <tr><td colSpan="5" className="p-20 text-center font-black text-slate-300 uppercase tracking-widest">No {trFilter} requests found.</td></tr>
                  ) : filteredTokenRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-amber-50/30 transition-colors border-b border-slate-50 last:border-0 font-sans">
                      <td className="px-5 py-3.5 md:px-8 md:py-4.5">
                        <div className="font-black text-brand-dark text-[12px] md:text-sm tracking-tight uppercase leading-tight">{req.labName}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">ID: {req.labId}</div>
                      </td>
                      <td className="px-5 py-3.5 md:px-8 md:py-4.5">
                        <div className="font-bold text-slate-700 uppercase text-[11px] leading-tight">{req.adminName || 'Admin'}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{req.adminEmail || 'N/A'}</div>
                        {req.adminPhone && <div className="text-[10px] text-brand-primary font-bold mt-1 tracking-wider">{req.adminPhone}</div>}
                      </td>
                      <td className="px-5 py-3.5 md:px-8 md:py-4.5 text-center">
                        <span className="px-4 py-1.5 bg-amber-100 text-amber-700 rounded-lg font-black text-xs shadow-sm ring-1 ring-amber-200">
                          {req.requestedAmount} <span className="text-[9px] opacity-70">TKNS</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 md:px-8 md:py-4.5">
                        <div className="text-[11px] font-bold text-slate-600">
                          {(() => {
                            const dateObj = req.createdAt;
                            if (!dateObj) return '—';
                            const date = dateObj.toDate ? dateObj.toDate() : (dateObj._seconds ? new Date(dateObj._seconds * 1000) : new Date(dateObj));
                            return (
                              <div className="flex flex-col leading-tight">
                                <span>{date.toLocaleDateString('en-GB')}</span>
                                <span className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">{date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 md:px-8 md:py-4.5 text-right">
                        {req.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2.5">
                            <button 
                              disabled={processingRequestId === req.id}
                              onClick={() => handleRejectTokenRequest(req.id)}
                              className="px-4 py-2 bg-white text-rose-500 border border-rose-100 rounded-xl text-[9.5px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all active:scale-95 disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button 
                              disabled={processingRequestId === req.id}
                              onClick={() => handleApproveTokenRequest(req)}
                              className="px-4 py-2 bg-brand-dark text-white rounded-xl text-[9.5px] font-black uppercase tracking-widest hover:bg-black shadow-xl shadow-brand-dark/10 transition-all border border-white/5 disabled:opacity-50 active:scale-95 flex items-center gap-2"
                            >
                              {processingRequestId === req.id ? (
                                <Loader className="w-3 h-3 animate-spin" />
                              ) : 'Approve'}
                            </button>
                          </div>
                        ) : req.status === 'approved' ? (
                          <div className="flex items-center justify-end gap-2 text-emerald-500">
                            <CheckCircle className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Approved</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2 text-rose-500">
                            <X className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Rejected</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeView === 'requests' ? (
        <div className="animate-in fade-in duration-700">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-8 mb-8 md:mb-10 bg-white p-5 md:p-8 rounded-2xl md:rounded-[28px] shadow-sm border border-slate-100">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-brand-dark tracking-tighter uppercase whitespace-nowrap">
                Registration <span className="text-brand-primary">Requests</span>
              </h1>
              <p className="text-[8px] md:text-[9.5px] font-black text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.3em] mt-1">Verify and approve new laboratory signups.</p>
            </div>
          </div>

          <div className="bg-white rounded-[32px] md:rounded-[42px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-brand-dark text-white/70">
                  <tr>
                    <th className="px-5 py-3 md:px-8 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest">Lab Details</th>
                    <th className="px-5 py-3 md:px-8 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest">Admin Details</th>
                    <th className="px-5 py-3 md:px-8 md:py-4 text-[10px] md:text-[11px] font-black uppercase tracking-widest">Status</th>
                    <th className="px-5 py-3 md:px-8 md:py-4 text-right text-[10px] md:text-[11px] font-black uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {requests.length === 0 ? (
                    <tr><td colSpan="4" className="p-20 text-center font-black text-slate-300 uppercase tracking-widest">No requests yet.</td></tr>
                  ) : requests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0 font-sans">
                      <td className="px-5 py-3.5 md:px-8 md:py-4.5">
                        <div className="font-black text-brand-dark text-[12px] md:text-sm tracking-tight uppercase leading-tight">{req.labFullName || req.labName}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">{req.labType} // {req.city}, {req.state}</div>
                      </td>
                      <td className="px-6 py-4 md:px-10 md:py-6">
                        <div className="font-bold text-slate-700">{req.ownerName}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{req.email}</div>
                        <div className="text-[11px] text-slate-400">{req.phone}</div>
                      </td>
                      <td className="px-6 py-4 md:px-10 md:py-6">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          req.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          req.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                          'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 md:px-10 md:py-6 text-right">
                        <div className="flex justify-end gap-3">
                          {req.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => handleRejectRequest(req.id)}
                                disabled={processingRequestId === req.id}
                                className="px-6 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all flex items-center gap-2 min-w-[100px] justify-center"
                              >
                                {processingRequestId === req.id ? <Loader className="w-3 h-3 animate-spin" /> : 'Reject'}
                              </button>
                              <button 
                                onClick={() => {
                                  setNewLabData({
                                    ...newLabData,
                                    labName: req.labName,
                                    labFullName: req.labFullName,
                                    email: req.email,
                                    ownerName: req.ownerName,
                                    phone: req.phone,
                                    address: req.address,
                                    city: req.city,
                                    state: req.state,
                                    pincode: req.pincode,
                                    labType: req.labType || 'Standalone',
                                    plan: req.plan || 'basic',
                                    requestId: req.id // Store the request ID to update on success
                                  });
                                  setActiveTab('basic');
                                  setShowRegisterModal(true);
                                }}
                                className="px-6 py-2.5 bg-brand-primary text-brand-dark rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-dark hover:text-white transition-all shadow-lg shadow-brand-primary/10"
                              >
                                Verify & Approve
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => confirmDelete(req)}
                            disabled={processingRequestId === req.id}
                            className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95"
                            title="Delete Request"
                          >
                            {processingRequestId === req.id ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeView === 'tests' ? (
        <GlobalTestCatalog />
      ) : activeView === 'parameters' ? (
        <MasterParameters />
      ) : activeView === 'plans' ? (
        <PlansTab />
      ) : (
        <GlobalSettings />
      )}

      {/* MANUAL TOKEN ADD MODAL */}
      {isTokenModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-amber-500 p-8 text-white relative">
              <Zap className="w-12 h-12 mb-4 opacity-50" />
              <h2 className="text-2xl font-black uppercase tracking-tighter">Add Tokens</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-1 opacity-80">Manual Laboratory Recharge</p>
              <button onClick={() => setIsTokenModalOpen(false)} className="absolute top-8 right-8 p-2 hover:bg-white/10 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleManualAddTokens} className="p-10 space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Laboratory</label>
                <div className="font-black text-brand-dark text-lg uppercase">{tokenForm.labName}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {tokenForm.labId}</div>
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Token Quantity</label>
                <input 
                  type="number" 
                  value={tokenForm.amount}
                  onChange={(e) => setTokenForm({...tokenForm, amount: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-xl font-black outline-none focus:ring-8 focus:ring-amber-500/5 focus:border-amber-500/30 transition-all font-mono"
                  placeholder="Enter Amount"
                  autoFocus
                />
              </div>

              <div className="pt-6">
                <button 
                  type="submit"
                  className="w-full py-5 bg-brand-dark text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-brand-dark/20 hover:bg-black transition-all active:scale-95"
                >
                  Confirm Recharge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Lab Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[48px] shadow-[0_40px_100px_rgba(0,0,0,0.4)] max-w-6xl w-full max-h-[92vh] overflow-hidden flex border border-white/10 animate-in zoom-in-95 duration-500">
            
            {/* Left Side: Premium Branding (Mirroring Signup Sidebar) */}
            <div className="hidden lg:flex w-[380px] bg-brand-dark relative flex-col p-10 overflow-hidden shrink-0">
                {/* Background Glows */}
                <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] opacity-20 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary blur-[120px] rounded-full animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-secondary blur-[120px] rounded-full animate-pulse delay-700"></div>
                </div>

                <div className="relative z-10 flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center gap-4 mb-12">
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-2xl flex items-center justify-center p-2 group hover:rotate-12 transition-transform">
                            <img src="/favicon.png" alt="LabMitra" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white tracking-widest uppercase mb-0.5 leading-none">Lab <span className="text-brand-primary">Mitra</span></h3>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em]">Enterprise Cloud</p>
                        </div>
                    </div>

                    {/* Portrait Hero Card */}
                    <div className="relative group/photo mb-12">
                        <div className="absolute -inset-4 bg-gradient-to-tr from-brand-primary/20 to-transparent blur-2xl opacity-0 group-hover/photo:opacity-100 transition-opacity duration-700"></div>
                        <div className="relative rounded-[40px] overflow-hidden aspect-[4/5] shadow-2xl border border-white/10 glass-card-dark animate-float">
                            <img 
                                src="/signup-portrait.png" 
                                alt="Laboratory Scientist" 
                                className="w-full h-full object-cover grayscale-[0.2] group-hover/photo:grayscale-0 group-hover/photo:scale-105 transition-all duration-1000"
                            />
                            {/* Inner Glass Cards */}
                            <div className="absolute bottom-6 left-6 right-6">
                                <div className="glass-card-dark p-4 rounded-3xl border border-white/20 backdrop-blur-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-brand-primary animate-ping"></div>
                                        <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">Administrative View</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-white/90 leading-tight mt-1">Real-time oversight for pathology branch networks.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Features List */}
                    <div className="flex flex-col gap-4 mt-auto">
                        {[
                            { icon: Zap, text: "Rapid Deployment", sub: "Turnkey lab setup" },
                            { icon: Shield, text: "Centralized Governance", sub: "Policy & Audit control" }
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-5 p-4 rounded-3xl hover:bg-white/5 transition-all group/item">
                                <div className={`w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover/item:scale-110 transition-all text-brand-primary`}>
                                    <item.icon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-tight">{item.text}</h4>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.sub}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Logo/Join */}
                    <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                         <div className="flex items-center gap-4 border border-white/10 p-4 rounded-2xl bg-white/5 backdrop-blur-sm">
                            <div className="flex -space-x-3">
                                {[1,2,3].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-brand-dark bg-slate-500 flex items-center justify-center overflow-hidden italic text-[8px] font-black text-white uppercase tracking-tighter">LM</div>)}
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Joined by <br/><span className="text-white">500+ Labs</span></span>
                         </div>
                    </div>
                </div>
            </div>

            {/* Right Side: Form Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative overflow-hidden">
                {/* FIXED HEADER SECTION */}
                <div className="px-12 py-10 pb-0 relative z-20 bg-slate-50/80 backdrop-blur-md shrink-0">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-3xl font-black text-brand-dark tracking-tighter uppercase leading-none">
                                {newLabData.requestId ? 'Review & Approve Request' : 'Add New Lab'}
                            </h2>
                            <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.4em] mt-2">
                                {newLabData.requestId ? `Source: ${newLabData.email}` : 'Laboratory Onboarding workflow'}
                            </p>
                        </div>
                        <button 
                            onClick={() => setShowRegisterModal(false)}
                            className="p-4 bg-white/50 hover:bg-white rounded-[22px] transition-all text-slate-400 border border-slate-100 shadow-sm"
                        >
                            <X className="w-8 h-8" />
                        </button>
                    </div>

                    {/* Modal Tabs Tracker */}
                    <div className="flex justify-between items-center mb-6 relative">
                         {/* Progress Line */}
                         <div className="absolute top-6 left-0 right-0 h-[2px] bg-slate-100 -z-10">
                            <div className={`h-full bg-brand-primary transition-all duration-700 shadow-[0_0_15px_rgba(155,207,131,0.5)]`} style={{
                                width: activeTab === 'basic' ? '0%' : activeTab === 'location' ? '33.33%' : activeTab === 'report' ? '66.66%' : '100%'
                            }}></div>
                         </div>
                         {[
                            { id: 'basic', label: 'Details', icon: Search },
                            { id: 'location', label: 'Location', icon: Globe },
                            { id: 'report', label: 'Reports', icon: FileText },
                            { id: 'saas', label: 'Plan', icon: CreditCard }
                         ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className="flex flex-col items-center group relative z-10"
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border-2 ${
                                    activeTab === tab.id 
                                    ? 'bg-brand-dark border-brand-dark text-brand-primary scale-110 shadow-xl shadow-brand-dark/20' 
                                    : 'bg-white border-slate-100 text-slate-300 group-hover:border-brand-primary group-hover:text-brand-primary bg-white backdrop-blur-sm'
                                }`}>
                                    <tab.icon className="w-6 h-6" />
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-widest mt-2 transition-colors ${
                                    activeTab === tab.id ? 'text-brand-dark' : 'text-slate-400'
                                }`}>
                                    {tab.label}
                                </span>
                            </button>
                         ))}
                    </div>
                    {/* Visual Boundary */}
                    <div className="h-px bg-slate-200 mt-4 max-w-xl mx-auto opacity-50"></div>
                </div>

                {/* SCROLLABLE BODY SECTION */}
                <div className="flex-1 p-12 pt-8 overflow-y-auto custom-scrollbar relative z-10">
                    <div className="max-w-xl mx-auto">
                        {activeTab === 'basic' && (
                          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-500 text-left">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                              <div>
                                <Label>Lab Short Name *</Label>
                                <Input 
                                  value={newLabData.labName} 
                                  onChange={(e) => setNewLabData({...newLabData, labName: e.target.value})}
                                  onBlur={() => handleBlur('labName')}
                                  error={touched.labName && errors.labName}
                                  placeholder="e.g. NG"
                                />
                              </div>
                              <div>
                                <Label>Full Laboratory Name *</Label>
                                <Input 
                                  value={newLabData.labFullName} 
                                  onChange={(e) => setNewLabData({...newLabData, labFullName: e.target.value})}
                                  onBlur={() => handleBlur('labFullName')}
                                  error={touched.labFullName && errors.labFullName}
                                  placeholder="e.g. NextGen Diagnostic Centre"
                                />
                              </div>
                              <div>
                                <Label>Lab Type</Label>
                                <Select 
                                  value={newLabData.labType} 
                                  onChange={(e) => setNewLabData({...newLabData, labType: e.target.value})}
                                >
                                  <option>Standalone</option>
                                  <option>Hospital-Based</option>
                                  <option>Collection Center</option>
                                  <option>Reference Lab</option>
                                </Select>
                              </div>
                              <div>
                                <Label>Owner Name</Label>
                                <Input 
                                  value={newLabData.ownerName} 
                                  onChange={(e) => setNewLabData({...newLabData, ownerName: e.target.value})}
                                  placeholder="Lab owner / admin"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <Label>Reg / License No.</Label>
                                <Input 
                                  value={newLabData.licenseNo} 
                                  onChange={(e) => setNewLabData({...newLabData, licenseNo: e.target.value})}
                                  placeholder="License number"
                                />
                              </div>

                              <div>
                                <Label>Admin Email *</Label>
                                <Input 
                                  type="email" required
                                  value={newLabData.email} 
                                  onChange={(e) => setNewLabData({...newLabData, email: e.target.value})}
                                  onBlur={() => handleBlur('email')}
                                  error={touched.email && errors.email}
                                  placeholder="admin@lab.com"
                                />
                              </div>
                              <div>
                                <Label>Contact Phone *</Label>
                                <Input 
                                  type="tel"
                                  value={newLabData.phone} 
                                  onChange={(e) => setNewLabData({...newLabData, phone: e.target.value})}
                                  onBlur={() => handleBlur('phone')}
                                  error={touched.phone && errors.phone}
                                  placeholder="+91 99999 99999"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {activeTab === 'location' && (
                          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-500 text-left">
                            <div className="space-y-4">
                              <Label>Full Address</Label>
                              <textarea 
                                rows={3}
                                value={newLabData.address} 
                                onChange={(e) => setNewLabData({...newLabData, address: e.target.value})}
                                className="w-full px-6 py-4 bg-white border border-slate-200 focus:border-brand-primary rounded-[24px] transition-all font-bold outline-none shadow-sm focus:ring-4 focus:ring-brand-primary/10 text-xs"
                                placeholder="Street, Landmark..."
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                              <div>
                                <Label>City</Label>
                                <Input 
                                  value={newLabData.city} 
                                  onChange={(e) => setNewLabData({...newLabData, city: e.target.value})}
                                  placeholder="City"
                                />
                              </div>
                              <div>
                                <Label>State</Label>
                                <Input 
                                  value={newLabData.state} 
                                  onChange={(e) => setNewLabData({...newLabData, state: e.target.value})}
                                  placeholder="State"
                                />
                              </div>
                              <div>
                                <Label>Pincode</Label>
                                <Input 
                                  value={newLabData.pincode} 
                                  onChange={(e) => setNewLabData({...newLabData, pincode: e.target.value})}
                                  placeholder="110001"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {activeTab === 'report' && (
                          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-500 text-left">
                            <div>
                              <Label>Watermark Text</Label>
                              <Input 
                                value={newLabData.watermarkText} 
                                onChange={(e) => setNewLabData({...newLabData, watermarkText: e.target.value})}
                                placeholder="e.g. DRAFT"
                              />
                            </div>
                            <div>
                              <Label>Report Footer Text</Label>
                              <textarea 
                                rows={4}
                                value={newLabData.footerText} 
                                onChange={(e) => setNewLabData({...newLabData, footerText: e.target.value})}
                                className="w-full px-6 py-4 bg-white border border-slate-200 focus:border-brand-primary rounded-[24px] transition-all font-bold outline-none shadow-sm focus:ring-4 focus:ring-brand-primary/10 text-xs"
                                placeholder="Default footer note for reports"
                              />
                            </div>
                          </div>
                        )}

                        {activeTab === 'saas' && (
                          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-500 text-left">
                            <div>
                                <Label>SaaS Plan</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {(allPlans?.length > 0 ? allPlans : [
                                    { id: 'basic', name: 'Basic' },
                                    { id: 'pro', name: 'Pro' },
                                    { id: 'pay_as_you_go', name: 'Pay As You Go' }
                                  ]).sort((a,b) => (a.order || 0) - (b.order || 0)).map((p) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => setNewLabData({...newLabData, plan: p.id})}
                                      className={`p-6 rounded-3xl font-black uppercase text-left transition-all border-2 flex flex-col gap-1 ${
                                        newLabData.plan === p.id 
                                          ? 'bg-brand-dark border-brand-dark text-white shadow-xl' 
                                          : 'bg-white border-slate-100 text-slate-400 grayscale hover:grayscale-0'
                                      }`}
                                    >
                                      <span className="text-[12px] tracking-tight">{p.name || p.id}</span>
                                      <span className="text-[10px] opacity-40">Full Enterprise Features</span>
                                    </button>
                                  ))}
                                </div>
                            </div>
                            {newLabData.plan !== 'pay_as_you_go' && (
                              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <Label>Subscription Period (Months)</Label>
                                <Input 
                                  type="number" min="1" max="60"
                                  value={newLabData.months} 
                                  onChange={(e) => setNewLabData({...newLabData, months: parseInt(e.target.value)})}
                                />
                              </div>
                            )}
                          </div>
                        )}
                        

                    </div>
                </div>

                {/* MODAL FOOTER */}
                <div className="px-12 py-10 bg-white border-t border-slate-100 flex gap-6 shrink-0 relative z-20">
                  <button 
                    type="button"
                    onClick={() => {
                      const tabs = ['basic', 'location', 'report', 'saas'];
                      const nextI = tabs.indexOf(activeTab) + 1;
                      if (activeTab === 'saas') {
                        if (Object.keys(errors).length > 0) {
                            toast.error("Please fix the validation errors first");
                            return;
                        }
                        handleRegisterLab({ preventDefault: () => {} });
                      } else {
                        // Mark current fields as touched on 'Next'
                        const currentFields = activeTab === 'basic' ? ['labName', 'labFullName', 'email', 'phone'] : [];
                        const newTouched = {...touched};
                        currentFields.forEach(f => newTouched[f] = true);
                        setTouched(newTouched);

                        if (Object.keys(errors).filter(k => currentFields.includes(k)).length > 0) {
                            return;
                        }

                        setActiveTab(tabs[nextI]);
                      }
                    }}
                    disabled={registering}
                    className={`flex-grow py-6 rounded-[32px] text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-2xl flex items-center justify-center gap-4 disabled:opacity-50 active:scale-[0.98] border border-white/5 ${
                      activeTab === 'saas' 
                      ? 'bg-brand-primary text-brand-dark shadow-brand-primary/20 hover:scale-[1.02]' 
                      : 'bg-brand-dark text-white shadow-brand-dark/20 hover:bg-black'
                    }`}
                  >
                    {registering ? (
                      <Loader className="w-6 h-6 animate-spin" />
                    ) : activeTab === 'saas' ? (
                      <>
                        <Shield className="w-6 h-6" />
                        Save & Activate Laboratory
                      </>
                    ) : (
                      <>Next Step <ChevronRight className="w-5 h-5 text-brand-primary" /></>
                    )}
                  </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lab Modal */}
      {showEditModal && editingLab && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-brand-dark/80 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[48px] shadow-[0_32px_128px_rgba(0,0,0,0.3)] max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/20 animate-in zoom-in duration-500">
            <div className="px-12 py-10 bg-brand-dark text-white flex justify-between items-center shrink-0 border-b border-white/5">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-brand-primary rounded-[22px] transition-transform rotate-6 hover:rotate-0">
                   <Settings className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">Edit Lab</h2>
                  <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.4em] mt-2">Modify laboratory details</p>
                </div>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-4 bg-white/5 hover:bg-white/10 rounded-[22px] transition-all text-white/40 border border-white/5">
                <X className="w-8 h-8" />
              </button>
            </div>

            <div className="flex bg-slate-50 border-b border-slate-100 px-10 shrink-0 overflow-x-auto no-scrollbar scroll-smooth">
              {[
                { id: 'basic', label: 'Details', icon: Search },
                { id: 'location', label: 'Location', icon: Globe },
                { id: 'report', label: 'Reports', icon: FileText },
                { id: 'saas', label: 'Plan', icon: CreditCard }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-8 py-6 font-black text-[10px] uppercase tracking-[0.2em] transition-all relative whitespace-nowrap ${
                    activeTab === tab.id ? 'text-brand-dark' : 'text-slate-400 hover:text-brand-dark'
                  }`}
                >
                  <tab.icon className={`w-4 h-4 transition-colors ${activeTab === tab.id ? 'text-brand-primary' : 'text-slate-300'}`} />
                  {tab.label}
                  {activeTab === tab.id && <div className="absolute bottom-0 left-8 right-8 h-1 bg-brand-primary rounded-t-full" />}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto p-12 flex-grow custom-scrollbar bg-white">
              {activeTab === 'basic' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-left">
                  <div><Label>Lab Short Name</Label><Input value={editingLab.labName} onChange={(e) => setEditingLab({...editingLab, labName: e.target.value})} /></div>
                  <div><Label>Full Lab Name</Label><Input value={editingLab.labFullName} onChange={(e) => setEditingLab({...editingLab, labFullName: e.target.value})} /></div>
                  <div><Label>Owner Name</Label><Input value={editingLab.ownerName} onChange={(e) => setEditingLab({...editingLab, ownerName: e.target.value})} /></div>
                  <div><Label>License No.</Label><Input value={editingLab.licenseNo} onChange={(e) => setEditingLab({...editingLab, licenseNo: e.target.value})} /></div>
                </div>
              )}
              {activeTab === 'location' && (
                <div className="space-y-8 text-left">
                  <div><Label>Full Address</Label><textarea value={editingLab.address} rows={2} onChange={(e)=>setEditingLab({...editingLab, address: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-brand-primary focus:bg-white rounded-3xl transition-all font-bold outline-none" /></div>
                  <div className="grid grid-cols-3 gap-8">
                    <div><Label>City</Label><Input value={editingLab.city} onChange={(e)=>setEditingLab({...editingLab, city: e.target.value})} /></div>
                    <div><Label>State</Label><Input value={editingLab.state} onChange={(e)=>setEditingLab({...editingLab, state: e.target.value})} /></div>
                    <div><Label>Pincode</Label><Input value={editingLab.pincode} onChange={(e)=>setEditingLab({...editingLab, pincode: e.target.value})} /></div>
                  </div>
                  <div><Label>Phone</Label><Input value={editingLab.phone} onChange={(e)=>setEditingLab({...editingLab, phone: e.target.value})} /></div>
                </div>
              )}
              {activeTab === 'report' && (
                <div className="space-y-8 text-left">
                  <div><Label>Watermark</Label><Input value={editingLab.watermarkText} onChange={(e)=>setEditingLab({...editingLab, watermarkText: e.target.value})} /></div>
                  <div><Label>Footer</Label><textarea value={editingLab.footerText} rows={3} onChange={(e)=>setEditingLab({...editingLab, footerText: e.target.value})} className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-brand-primary focus:bg-white rounded-3xl transition-all font-bold outline-none" /></div>
                </div>
              )}
              {activeTab === 'saas' && (
                <div className="grid grid-cols-2 gap-8 text-left">
                  <div>
                    <Label>SaaS Plan</Label>
                    <div className="flex flex-wrap gap-4">
                      {(allPlans?.length > 0 ? allPlans : [
                        { id: 'basic', name: 'Basic' },
                        { id: 'pro', name: 'Pro' },
                        { id: 'pay_as_you_go', name: 'Pay As You Go' }
                      ]).sort((a,b) => (a.order || 0) - (b.order || 0)).map(p => (
                        <button 
                          key={p.id} 
                          onClick={() => setEditingLab({...editingLab, plan: p.id})} 
                          className={`px-6 py-4 rounded-3xl font-black uppercase tracking-wider transition-all border-2 ${
                            editingLab.plan === p.id 
                              ? 'bg-brand-primary border-brand-primary text-white shadow-lg' 
                              : 'bg-gray-50 border-transparent text-gray-400'
                          }`}
                        >
                          {p.name || p.id}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-6 shrink-0">
               <button onClick={handleUpdateLab} disabled={registering} className="flex-grow py-6 rounded-[24px] bg-brand-primary text-white text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-2xl flex items-center justify-center gap-4 disabled:opacity-50">
                  {registering ? <Loader className="w-6 h-6 animate-spin" /> : <><Settings className="w-6 h-6" /> Save Changes</>}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Extension Modal */}
      {showExtendModal && editingLab && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-brand-dark/80 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[4rem] shadow-2xl max-w-lg w-full p-12 text-center animate-in zoom-in duration-500 border border-white/20">
            <div className="w-20 h-20 bg-brand-light rounded-3xl flex items-center justify-center mx-auto mb-8 text-brand-primary rotate-6">
              <CreditCard className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-brand-dark tracking-tighter uppercase mb-2">Extend Subscription</h2>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-10">Lab: {editingLab.labName}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-10">
              {[1, 3, 6, 12].map(m => (
                <button key={m} onClick={() => setExtendingMonths(m)} className={`py-6 rounded-3xl font-black transition-all border-2 ${extendingMonths === m ? 'bg-brand-dark border-brand-dark text-white shadow-xl scale-105' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'}`}>
                  {m === 12 ? '1 YEAR' : `${m} MONTHS`}
                </button>
              ))}
            </div>

            <div className="bg-slate-50 rounded-3xl p-6 mb-10 text-left">
               <div className="flex justify-between items-center mb-2">
                 <span className="text-[10px] font-black text-slate-400 uppercase">Current Expiry</span>
                 <span className="text-[12px] font-black text-slate-600">{formatDisplayDate(editingLab.expiryDate)}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-[10px] font-black text-brand-primary uppercase">New Expiry</span>
                 <span className="text-[12px] font-black text-brand-primary">
                    {(() => {
                      const today = new Date();
                      let start = new Date();
                      if (editingLab.expiryDate !== 'N/A') {
                        const cur = new Date(editingLab.expiryDate);
                        if (cur > today) start = cur;
                      }
                      start.setMonth(start.getMonth() + extendingMonths);
                      const resYMD = start.toISOString().split('T')[0];
                      return formatDisplayDate(resYMD);
                    })()}
                 </span>
               </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setShowExtendModal(false)} className="flex-1 py-5 rounded-[22px] bg-slate-100 text-slate-400 font-black uppercase text-[11px] tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={handleExtendSubscription} disabled={registering} className="flex-[2] py-5 rounded-[22px] bg-brand-primary text-white font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-brand-primary/20 hover:bg-lime-500 active:scale-95 transition-all">
                 {registering ? <Loader className="w-5 h-5 animate-spin mx-auto" /> : 'Confirm Extension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registration Success Modal */}
      {registrationSuccess && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] shadow-2xl max-w-lg w-full p-12 text-center animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-green-600">
              <CheckCircle className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-black text-gray-900 mb-2">Lab Added!</h2>
            <p className="text-gray-500 mb-8 font-medium">The lab has been added successfully.</p>
            
            <div className="bg-gray-50 rounded-3xl p-6 text-left space-y-4 mb-8 border border-gray-100">
              <div className="flex justify-between items-center pb-2 border-b border-gray-200/50">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Lab ID</span>
                <span className="font-mono font-bold text-gray-900">{registrationSuccess.labId}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-200/50">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Admin Email</span>
                <span className="font-bold text-gray-900">{registrationSuccess.email}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-200/50">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Password</span>
                <span className="font-mono font-black text-red-600 bg-red-50 px-2 py-0.5 rounded">{registrationSuccess.tempPassword}</span>
              </div>
              <div className="pt-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">License Key</label>
                <code className="block w-full text-center bg-white border border-gray-200 py-3 rounded-xl font-mono text-sm font-bold text-blue-600 shadow-inner">
                  {registrationSuccess.licenseKey}
                </code>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`Email: ${registrationSuccess.email}\nPassword: ${registrationSuccess.tempPassword}\nLab ID: ${registrationSuccess.labId}`);
                  toast.info("Credentials copied to clipboard!");
                }}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black transition shadow-lg"
              >
                Copy Credentials
              </button>
              <button 
                onClick={() => setRegistrationSuccess(null)}
                className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition"
              >
                Dismiss
              </button>
            </div>
            
            <p className="mt-6 text-[10px] font-bold text-red-500 uppercase tracking-widest leading-relaxed">
              Kindly share these credentials securely with the Lab Owner.<br/>They will be asked to change the password upon first login.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Tiny Reusable Stat Cards ───────────────────────────────────────────── */
const StatCard = ({ icon, label, value, color, gradient }) => (
  <div className={`p-4 md:p-5 rounded-[24px] border border-slate-100 transition-all hover:scale-[1.02] shadow-[0_10px_30px_rgb(0,0,0,0.01)] flex items-center gap-4 ${gradient ? `bg-gradient-to-br ${color} text-white border-transparent` : 'bg-white'}`}>
    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-[16px] flex items-center justify-center shadow-sm border ${gradient ? 'bg-white/20 border-white/20' : `${color} border-transparent`}`}>
      {React.cloneElement(icon, { className: 'w-5 h-5 md:w-6 md:h-6' })}
    </div>
    <div>
      <div className={`text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] mb-0.5 ${gradient ? 'text-white/60' : 'text-slate-400'}`}>{label}</div>
      <div className="text-xl md:text-2xl font-black tracking-tighter tabular-nums">{value}</div>
    </div>
  </div>
);

/* ─── Primitives for SuperAdmin ──────────────────────────────────────────── */
const Label = ({ children }) => (
  <label className="block text-[10px] font-black text-slate-400 mb-2.5 uppercase tracking-[0.2em] ml-2">{children}</label>
);
const Input = ({ className = '', error, icon, ...props }) => (
  <div className="space-y-1.5 w-full">
    <div className="relative group">
      {icon && <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-primary transition-colors">{icon}</div>}
      <input
        className={`w-full ${icon ? 'pl-14' : 'px-6'} py-3.5 bg-slate-50 border border-slate-200 rounded-[22px] text-xs font-black text-brand-dark outline-none transition-all shadow-sm ${
          error ? 'border-rose-300 ring-4 ring-rose-300/10' : 'focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 focus:bg-white placeholder:text-slate-400'
        } ${className}`}
        {...props}
      />
    </div>
    {error && <div className="flex items-center gap-1.5 ml-4 text-rose-500">
        <Activity className="w-3 h-3" />
        <span className="text-[8px] font-black underline decoration-rose-300/30 uppercase tracking-widest">{error}</span>
    </div>}
  </div>
);
const Select = ({ className = '', children, ...props }) => (
  <select
    className={`w-full px-6 py-3.5 bg-slate-50 border border-slate-200 rounded-[22px] text-xs font-black text-brand-dark outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 focus:bg-white transition-all appearance-none cursor-pointer shadow-sm ${className}`}
    {...props}
  >
    {children}
  </select>
);



export default SuperAdminDashboard;
