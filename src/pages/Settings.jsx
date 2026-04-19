import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import { 
  Settings as SettingsIcon, 
  User, 
  FileText, 
  Shield, 
  Image as ImageIcon, 
  Type, 
  Trash2, 
  Save, 
  Loader, 
  CheckCircle,
  Globe,
  Smartphone,
  Mail,
  MapPin,
  Clock,
  Printer,
  Bell,
  MessageSquare,
  Users,
  X,
  CreditCard,
  Zap,
  ArrowRight,
  Crown,
  Check,
  Send,
  Info,
  Pencil
} from 'lucide-react';
import { toast } from 'react-toastify';

const Settings = () => {
  const { userData, activeLabId, checkFeature, allPlans } = useAuth();
  const targetLabId = activeLabId || userData?.labId;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [labData, setLabData] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  
  // Staff Management States
  const [staffUsers, setStaffUsers] = useState([]);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Subscription States
  const [subData, setSubData] = useState(null);
  const [subLoading, setSubLoading] = useState(true);
  const [sendingReport, setSendingReport] = useState(false);

  useEffect(() => {
    if (targetLabId) {
      fetchLabData();
    }
    if (targetLabId && activeTab === 'staff') {
      fetchStaff();
    }
    if (targetLabId && activeTab === 'subscription') {
      fetchSubscriptionInfo();
    }
  }, [targetLabId, activeTab]);

  const fetchSubscriptionInfo = async () => {
    setSubLoading(true);
    try {
      const { collection, getDocs, doc, getDoc } = await import('firebase/firestore');
      
      // 1. Fetch current sub
      const subSnap = await getDoc(doc(db, 'subscriptions', targetLabId));
      if (subSnap.exists()) {
        setSubData(subSnap.data());
      }
    } catch (error) {
      console.error("Error fetching sub info:", error);
    } finally {
      setSubLoading(false);
    }
  };

  const fetchStaff = async () => {
    setStaffLoading(true);
    try {
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      const q = query(collection(db, 'users'), where('labId', '==', targetLabId));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStaffUsers(list.filter(u => u.role !== 'SuperAdmin'));
    } catch (error) {
      console.error("Error fetching staff:", error);
      toast.error("Failed to load team directory.");
    } finally {
      setStaffLoading(false);
    }
  };

  const fetchLabData = async () => {
    setLoading(true);
    try {
      const docSnap = await getDoc(doc(db, 'labs', targetLabId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Initialize reportSettings if missing
        if (!data.reportSettings) {
          data.reportSettings = {
            showEmail: true,
            showAddress: true,
            showPhone: true,
            autoEmailNotify: false,
            useCustomHeader: false,
            useCustomFooter: false,
            watermark: {
              enabled: false,
              type: 'text', // 'text' or 'image'
              text: data.labName || 'LAB MITRA',
              image: '',
              opacity: 0.05,
              rotation: -45
            }
          };
        } else if (data.reportSettings.autoEmailNotify === undefined) {
          data.reportSettings.autoEmailNotify = false;
        }

        // Initialize Daily Report Settings
        if (!data.reportSettings.dailyReport) {
          data.reportSettings.dailyReport = {
            enabled: false,
            time: '20:00',
            notificationEmail: data.email || ''
          };
        }

        setLabData(data);
      }
    } catch (error) {
      console.error("Error fetching lab data:", error);
      toast.error("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Update primary lab profile
      await updateDoc(doc(db, 'labs', targetLabId), {
        ...labData,
        updatedAt: serverTimestamp()
      });

      // 2. Sync with subscriptions collection (for Super Admin Dashboard visibility)
      if (labData.labName) {
        await updateDoc(doc(db, 'subscriptions', targetLabId), {
          labName: labData.labName,
          updatedAt: serverTimestamp()
        }).catch(err => console.warn("Sync with subscriptions failed:", err));
      }

      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteUser = async (password) => {
    setIsDeleting(true);
    try {
      const { auth } = await import('../firebase');
      const { EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
      
      // Verify Admin's Password
      try {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
        await reauthenticateWithCredential(auth.currentUser, credential);
      } catch (authError) {
        toast.error("Incorrect password. Deletion cancelled.");
        setIsDeleting(false);
        return;
      }

      const token = await auth.currentUser.getIdToken();
      const apiUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      
      const response = await fetch(`${apiUrl}/api/auth/staff/${deleteConfirmUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (!response.ok) {
         throw new Error(data.error || 'Failed to delete staff user');
      }
      
      toast.success("User deleted successfully!");
      setDeleteConfirmUser(null);
      fetchStaff();
    } catch (err) {
       console.error(err);
       toast.error(err.message || "Failed to delete user");
    } finally {
       setIsDeleting(false);
    }
  };

  const handleImageUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    setSaving(true);
    try {
      const storageRef = ref(storage, `labs/${targetLabId}/branding/${field}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      setLabData(prev => ({
        ...prev,
        reportSettings: {
          ...prev.reportSettings,
          [field]: url,
          ...(field === 'headerImage' ? { useCustomHeader: true } : 
              field === 'footerImage' ? { useCustomFooter: true } : 
              field === 'watermarkImage' ? { watermark: { ...prev.reportSettings.watermark, image: url, type: 'image' }} : {})
        }
      }));
      toast.success(`${field.replace('Image', '')} uploaded!`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Image upload failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendDailyReport = async () => {
    if (!targetLabId) return toast.error('No lab selected.');
    setSendingReport(true);
    const toastId = toast.loading('Sending Daily Report...');
    try {
      const { auth } = await import('../firebase');
      const token = await auth.currentUser.getIdToken();
      const apiUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/send-daily-report/${targetLabId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send report');
      toast.update(toastId, { render: `✅ ${data.message}`, type: 'success', isLoading: false, autoClose: 4000 });
      // Refresh lab data to get updated lastSent
      fetchLabData();
    } catch (err) {
      toast.update(toastId, { render: `❌ ${err.message}`, type: 'error', isLoading: false, autoClose: 5000 });
    } finally {
      setSendingReport(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader className="w-12 h-12 text-brand-primary animate-spin mb-4" />
      <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Loading Lab Configuration...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 animate-in fade-in duration-700">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-brand-light rounded-[28px] border border-brand-primary/10 shadow-sm rotate-3">
            <SettingsIcon className="w-10 h-10 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-brand-dark tracking-tighter uppercase whitespace-nowrap">Lab <span className="text-brand-primary/80">Settings</span></h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Personalize your laboratory experience.</p>
          </div>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-3 px-10 py-5 bg-brand-dark text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-2xl hover:bg-brand-secondary active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save Changes</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          {[
            { id: 'profile', label: 'Lab Profile', icon: User, color: 'text-blue-500' },
            { id: 'branding', label: 'Report Branding', icon: ImageIcon, color: 'text-brand-primary' },
            { id: 'staff', label: 'Staff Management', icon: Users, color: 'text-indigo-500' },
            { id: 'subscription', label: 'Subscription & Plans', icon: CreditCard, color: 'text-rose-500' },
            { id: 'system', label: 'System Settings', icon: Globe, color: 'text-amber-500' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 px-6 py-5 rounded-[22px] font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-brand-dark text-white shadow-xl translate-x-2' : 'hover:bg-slate-100 text-slate-400'}`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : tab.color}`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 bg-white rounded-[40px] border border-slate-100 shadow-[0_20px_50px_rgb(0,0,0,0.02)] overflow-hidden min-h-[600px] flex flex-col">
          
          <div className="p-10 flex-grow">
            {activeTab === 'profile' && (
              <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-3 mb-2">
                   <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                   <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">Basic Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lab Name (Short)</label>
                    <input 
                      type="text" 
                      value={labData?.labName || ''} 
                      onChange={e => setLabData({...labData, labName: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Organization Name</label>
                    <input 
                      type="text" 
                      value={labData?.labFullName || ''} 
                      onChange={e => setLabData({...labData, labFullName: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Owner / Director Name</label>
                    <input 
                      type="text" 
                      value={labData?.ownerName || ''} 
                      onChange={e => setLabData({...labData, ownerName: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Contact No.</label>
                    <input 
                      type="text" 
                      value={labData?.phone || ''} 
                      onChange={e => setLabData({...labData, phone: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div className="pt-8 flex items-center gap-3 mb-2">
                   <div className="w-1.5 h-6 bg-slate-300 rounded-full"></div>
                   <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">Location Details</h3>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Official Address</label>
                    <textarea 
                      rows={2}
                      value={labData?.address || ''} 
                      onChange={e => setLabData({...labData, address: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">City</label>
                      <input 
                        type="text" value={labData?.city || ''} 
                        onChange={e => setLabData({...labData, city: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-inner"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">State</label>
                      <input 
                        type="text" value={labData?.state || ''} 
                        onChange={e => setLabData({...labData, state: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-inner"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pincode</label>
                      <input 
                        type="text" value={labData?.pincode || ''} 
                        onChange={e => setLabData({...labData, pincode: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-inner"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'branding' && (
              <div className="space-y-12 animate-in slide-in-from-right-4 duration-500">
                
                {/* Header/Footer Asset Management */}
                <div>
                  <div className="flex items-center gap-3 mb-8">
                     <div className="w-1.5 h-6 bg-brand-primary rounded-full"></div>
                     <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">Report Assets</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 group relative">
                       <div className="flex justify-between items-start mb-6">
                         <div className="flex items-center gap-3">
                            <div className="p-3 bg-white rounded-2xl shadow-sm text-brand-primary">
                               <FileText className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-black text-brand-dark uppercase tracking-widest">Custom Header</span>
                         </div>
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={labData.reportSettings.useCustomHeader} onChange={e => setLabData({ ...labData, reportSettings: { ...labData.reportSettings, useCustomHeader: e.target.checked }})} />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary shadow-inner"></div>
                         </label>
                       </div>
                       
                       <div className="aspect-[4/1] bg-white rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden relative group-hover:border-brand-primary/30 transition-all">
                          {labData.reportSettings.headerImage ? (
                            <img src={labData.reportSettings.headerImage} alt="Header" className="w-full h-full object-contain" />
                          ) : (
                            <>
                              <ImageIcon className="w-8 h-8 text-slate-200 mb-2" />
                              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No Header Uploaded</span>
                            </>
                          )}
                          <label className="absolute inset-0 bg-brand-dark/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm">
                             <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'headerImage')} />
                             <span className="bg-white px-5 py-2 rounded-xl text-[10px] font-black uppercase text-brand-dark tracking-widest shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform">Update Header</span>
                          </label>
                       </div>
                       <p className="text-[10px] text-slate-400 mt-4 font-bold uppercase tracking-widest">Recommended: 1200 x 300px (PNG)</p>
                    </div>

                    <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 group relative">
                       <div className="flex justify-between items-start mb-6">
                         <div className="flex items-center gap-3">
                            <div className="p-3 bg-white rounded-2xl shadow-sm text-brand-primary">
                               <MapPin className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-black text-brand-dark uppercase tracking-widest">Custom Footer</span>
                         </div>
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={labData.reportSettings.useCustomFooter} onChange={e => setLabData({ ...labData, reportSettings: { ...labData.reportSettings, useCustomFooter: e.target.checked }})} />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary shadow-inner"></div>
                         </label>
                       </div>
                       
                       <div className="aspect-[4/1] bg-white rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden relative group-hover:border-brand-primary/30 transition-all">
                          {labData.reportSettings.footerImage ? (
                            <img src={labData.reportSettings.footerImage} alt="Footer" className="w-full h-full object-contain" />
                          ) : (
                            <>
                              <ImageIcon className="w-8 h-8 text-slate-200 mb-2" />
                              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No Footer Uploaded</span>
                            </>
                          )}
                          <label className="absolute inset-0 bg-brand-dark/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm">
                             <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'footerImage')} />
                             <span className="bg-white px-5 py-2 rounded-xl text-[10px] font-black uppercase text-brand-dark tracking-widest shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform">Update Footer</span>
                          </label>
                       </div>
                       <p className="text-[10px] text-slate-400 mt-4 font-bold uppercase tracking-widest">Recommended: 1200 x 150px (PNG)</p>
                    </div>
                  </div>
                </div>

                {/* Contact Toggles */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                   {[
                     { field: 'showEmail', label: 'Show Email', icon: Mail },
                     { field: 'showPhone', label: 'Show Phone', icon: Smartphone },
                     { field: 'showAddress', label: 'Show Address', icon: MapPin },
                   ].map(item => (
                     <div key={item.field} className="flex items-center justify-between p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3">
                           <item.icon className="w-4 h-4 text-brand-secondary" />
                           <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">{item.label}</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={labData.reportSettings[item.field]} onChange={e => setLabData({ ...labData, reportSettings: { ...labData.reportSettings, [item.field]: e.target.checked }})} />
                            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary shadow-inner"></div>
                         </label>
                     </div>
                   ))}
                </div>

                {/* Watermark Section */}
                <div className="bg-slate-900 rounded-[32px] p-10 text-white relative flex flex-col md:flex-row gap-12 overflow-hidden shadow-2xl">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                   <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-secondary/5 rounded-full blur-3xl -ml-24 -mb-24"></div>
                   
                   <div className="flex-1 space-y-6 relative z-10">
                      <div className="flex items-center justify-between mb-8">
                         <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-2xl border border-white/10">
                               <Shield className="w-6 h-6 text-brand-primary" />
                            </div>
                            <h3 className="text-xl font-black uppercase tracking-tight">Report Watermark</h3>
                         </div>
                         <label className="relative inline-flex items-center cursor-pointer scale-110">
                            <input type="checkbox" className="sr-only peer" checked={labData.reportSettings.watermark.enabled} onChange={e => setLabData({ ...labData, reportSettings: { ...labData.reportSettings, watermark: { ...labData.reportSettings.watermark, enabled: e.target.checked }}})} />
                            <div className="w-12 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-brand-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-white/20"></div>
                         </label>
                      </div>

                      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 mb-6">
                         <button 
                           onClick={() => setLabData({ ...labData, reportSettings: { ...labData.reportSettings, watermark: { ...labData.reportSettings.watermark, type: 'text' }}})}
                           className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${labData.reportSettings.watermark.type === 'text' ? 'bg-white text-brand-dark shadow-xl' : 'text-white/40 hover:text-white/60'}`}
                         >
                            <Type className="w-4 h-4" /> Text
                         </button>
                         <button 
                           onClick={() => setLabData({ ...labData, reportSettings: { ...labData.reportSettings, watermark: { ...labData.reportSettings.watermark, type: 'image' }}})}
                           className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${labData.reportSettings.watermark.type === 'image' ? 'bg-white text-brand-dark shadow-xl' : 'text-white/40 hover:text-white/60'}`}
                         >
                            <ImageIcon className="w-4 h-4" /> Image
                         </button>
                      </div>

                      {labData.reportSettings.watermark.type === 'text' ? (
                        <div className="space-y-4 opacity-100 group animate-in slide-in-from-top-2 duration-300">
                           <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-1">Watermark Text Content</label>
                           <input 
                             type="text" 
                             value={labData.reportSettings.watermark.text} 
                             onChange={e => setLabData({ ...labData, reportSettings: { ...labData.reportSettings, watermark: { ...labData.reportSettings.watermark, text: e.target.value }}})}
                             className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-white outline-none focus:border-brand-primary focus:bg-white/10 transition-all placeholder:text-white/20"
                             placeholder="Ex: CONFIDENTIAL or LAB NAME"
                           />
                        </div>
                      ) : (
                        <div className="space-y-4 opacity-100 group animate-in slide-in-from-top-2 duration-300">
                           <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-1">Watermark Image Asset</label>
                           <div className="relative aspect-[3/1] bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center overflow-hidden">
                              {labData.reportSettings.watermark.image ? (
                                <img src={labData.reportSettings.watermark.image} alt="Watermark" className="w-full h-full object-contain p-4" />
                              ) : (
                                <ImageIcon className="w-8 h-8 text-white/10" />
                              )}
                              <label className="absolute inset-0 bg-brand-dark/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm">
                                <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'watermarkImage')} />
                                <span className="bg-white px-5 py-2 rounded-xl text-[10px] font-black uppercase text-brand-dark tracking-widest shadow-xl">Upload Watermark</span>
                              </label>
                           </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-8 pt-4">
                         <div className="space-y-4">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-1 flex justify-between">
                              Opacity <span>{Math.round(labData.reportSettings.watermark.opacity * 100)}%</span>
                            </label>
                            <input 
                              type="range" min="0" max="0.3" step="0.01" 
                              value={labData.reportSettings.watermark.opacity} 
                              onChange={e => setLabData({ ...labData, reportSettings: { ...labData.reportSettings, watermark: { ...labData.reportSettings.watermark, opacity: parseFloat(e.target.value) }}})}
                              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                            />
                         </div>
                         <div className="space-y-4">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-1">Rotation Angle</label>
                            <div className="flex gap-2">
                               {[-45, -30, 0, 30, 45].map(deg => (
                                 <button 
                                   key={deg}
                                   onClick={() => setLabData({ ...labData, reportSettings: { ...labData.reportSettings, watermark: { ...labData.reportSettings.watermark, rotation: deg }}})}
                                   className={`flex-1 py-2 rounded-xl text-[10px] font-black border transition-all ${labData.reportSettings.watermark.rotation === deg ? 'bg-brand-primary border-brand-primary text-white shadow-lg' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                                 >
                                    {deg}°
                                 </button>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="w-full md:w-64 aspect-square bg-white/5 rounded-[40px] border border-white/5 flex items-center justify-center relative overflow-hidden shrink-0">
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-10">
                         {labData.reportSettings.watermark.enabled ? (
                           labData.reportSettings.watermark.type === 'image' && labData.reportSettings.watermark.image ? (
                             <img 
                               src={labData.reportSettings.watermark.image} 
                               alt="Watermark Preview" 
                               style={{ 
                                 opacity: labData.reportSettings.watermark.opacity * 4, 
                                 transform: `rotate(${labData.reportSettings.watermark.rotation}deg)`,
                                 width: '80%' 
                               }} 
                               className="object-contain" 
                             />
                           ) : (
                             <div 
                               style={{ 
                                 transform: `rotate(${labData.reportSettings.watermark.rotation}deg)`, 
                                 opacity: labData.reportSettings.watermark.opacity * 3, // slightly more visible for preview
                                 fontSize: '24px',
                               }}
                               className="font-black text-white text-center leading-none tracking-tight break-all uppercase"
                             >
                               {labData.reportSettings.watermark.text || 'PREVIEW'}
                             </div>
                           )
                         ) : (
                           <Shield className="w-20 h-20 text-white/5" />
                         )}
                      </div>
                      <span className="absolute bottom-6 text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Live Preview</span>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'staff' && (
              <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                       <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                       <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">Team Management</h3>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Manage accounts and granular permissions for your staff.</p>
                  </div>
                  <button 
                    onClick={() => { setSelectedStaff(null); setIsStaffModalOpen(true); }}
                    className="px-6 py-3 bg-brand-dark text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-brand-secondary transition-all active:scale-95"
                  >
                    + Add New Staff
                  </button>
                </div>

                {staffLoading ? (
                  <div className="py-20 text-center">
                    <Loader className="w-10 h-10 text-brand-primary animate-spin mx-auto mb-4" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning Directory...</p>
                  </div>
                ) : staffUsers.length === 0 ? (
                  <div className="bg-slate-50/50 rounded-[32px] border border-slate-100 p-10 text-center">
                     <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                     <h4 className="text-sm font-black text-slate-400 uppercase tracking-tighter">No Staff Accounts Found</h4>
                     <p className="text-[10px] text-slate-400 mt-2 font-bold max-w-xs mx-auto">Create an account to give your team access to specific laboratory modules.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                          <th className="px-6 py-4">Name / ID</th>
                          <th className="px-6 py-4">Role</th>
                          <th className="px-6 py-4">Permissions Summary</th>
                          <th className="px-4 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {staffUsers.map((user) => (
                          <tr key={user.id} className="group hover:bg-slate-50 transition-all">
                            <td className="px-6 py-5">
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-brand-dark">{user.name || 'Anonymous User'}</span>
                                <span className="text-[10px] font-bold text-slate-400">{user.email}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${user.role === 'LabAdmin' ? 'bg-indigo-50 text-indigo-500 border-indigo-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-wrap gap-1.5 max-w-sm">
                                {Object.entries(user.permissions || {}).map(([key, val]) => val && (
                                  <span key={key} className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100/50">
                                    {key.replace('can_', '').replace(/_/g, ' ')}
                                  </span>
                                ))}
                                {!user.permissions && <span className="text-[8px] font-black text-slate-300 italic">No direct permissions set</span>}
                              </div>
                            </td>
                            <td className="px-4 py-5 text-right flex justify-end items-center gap-2">
                               <button 
                                 onClick={() => { setSelectedStaff(user); setIsStaffModalOpen(true); }}
                                 className="p-2 text-slate-300 hover:text-brand-primary hover:bg-white rounded-xl transition-all shadow-none hover:shadow-sm"
                                 title="Edit"
                               >
                                 <Pencil className="w-5 h-5" />
                               </button>
                               {user.role === 'Staff' && (
                                 <button 
                                   onClick={() => setDeleteConfirmUser(user)}
                                   className="p-2 text-slate-300 hover:text-rose-500 hover:bg-white rounded-xl transition-all shadow-none hover:shadow-sm"
                                   title="Delete Staff"
                                 >
                                   <Trash2 className="w-5 h-5" />
                                 </button>
                               )}
                             </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'system' && (
              <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-3 mb-8">
                   <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
                   <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">Preferences (Beta)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className={`p-8 bg-white border rounded-[32px] flex items-start gap-6 group transition-all hover:shadow-xl hover:shadow-slate-200/50 ${labData?.reportSettings?.autoEmailNotify ? 'border-brand-primary/40 bg-brand-primary/5' : 'border-slate-100 bg-slate-50'}`}>
                      <div className={`p-4 bg-white rounded-2xl shadow-sm transition-colors ${labData?.reportSettings?.autoEmailNotify ? 'text-brand-primary' : 'text-slate-300'}`}>
                         <Bell className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                         <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2">
                               <p className="text-sm font-black text-brand-dark uppercase tracking-widest">Auto Email Notify</p>
                               {!checkFeature('Email Support') && (
                                 <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-widest">Upgrade Req.</span>
                               )}
                            </div>
                            <button 
                               disabled={!checkFeature('Email Support')}
                               onClick={() => setLabData({
                                  ...labData,
                                  reportSettings: { ...labData.reportSettings, autoEmailNotify: !labData.reportSettings.autoEmailNotify }
                               })}
                               className={`w-12 h-6 rounded-full relative transition-all duration-300 ${!checkFeature('Email Support') ? 'bg-slate-100 cursor-not-allowed' : labData?.reportSettings?.autoEmailNotify ? 'bg-brand-primary' : 'bg-slate-200'}`}
                            >
                               <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${labData?.reportSettings?.autoEmailNotify ? 'left-7' : 'left-1'}`}></div>
                            </button>
                         </div>
                         <p className="text-[11px] font-bold text-slate-400">Automatically notify patient when report is finalized.</p>
                         <div className={`mt-4 inline-flex items-center px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${labData?.reportSettings?.autoEmailNotify ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-100'}`}>
                           {labData?.reportSettings?.autoEmailNotify ? 'Automation Active' : 'Automation Disabled'}
                         </div>
                      </div>
                   </div>

                   {/* Daily Report Card */}
                   <div className={`p-8 bg-white border rounded-[32px] flex flex-col gap-6 group transition-all hover:shadow-xl hover:shadow-slate-200/50 ${labData?.reportSettings?.dailyReport?.enabled ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="flex items-start gap-6">
                        <div className={`p-4 bg-white rounded-2xl shadow-sm transition-colors ${labData?.reportSettings?.dailyReport?.enabled ? 'text-amber-500' : 'text-slate-300'}`}>
                           <Clock className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                           <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center gap-2">
                                 <p className="text-sm font-black text-brand-dark uppercase tracking-widest">Daily Email Report</p>
                                 {!checkFeature('Email Support') && (
                                   <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-widest leading-none">Upgrade Req.</span>
                                 )}
                              </div>
                              <button 
                                 type="button"
                                 disabled={!checkFeature('Email Support')}
                                 onClick={() => setLabData({
                                    ...labData,
                                    reportSettings: { 
                                      ...labData.reportSettings, 
                                      dailyReport: { ...labData.reportSettings.dailyReport, enabled: !labData.reportSettings.dailyReport.enabled }
                                    }
                                 })}
                                 className={`w-12 h-6 rounded-full relative transition-all duration-300 ${!checkFeature('Email Support') ? 'bg-slate-100 cursor-not-allowed' : labData?.reportSettings?.dailyReport?.enabled ? 'bg-amber-500' : 'bg-slate-200'}`}
                              >
                                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${labData?.reportSettings?.dailyReport?.enabled ? 'left-7' : 'left-1'}`}></div>
                              </button>
                           </div>
                           <p className="text-[11px] font-bold text-slate-400">Receive performance summary every evening.</p>
                        </div>
                      </div>

                      {labData?.reportSettings?.dailyReport?.enabled && (
                        <div className="space-y-4 pt-4 border-t border-amber-500/10 animate-in slide-in-from-top-2">
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Delivery Time</label>
                                 <input 
                                   type="time" 
                                   value={labData.reportSettings.dailyReport.time || '20:00'}
                                   onChange={e => setLabData({
                                      ...labData,
                                      reportSettings: {
                                        ...labData.reportSettings,
                                        dailyReport: { ...labData.reportSettings.dailyReport, time: e.target.value }
                                      }
                                   })}
                                   className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-brand-dark outline-none focus:border-amber-500 shadow-sm"
                                 />
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Recipient Email</label>
                                 <input 
                                   type="email" 
                                   placeholder="Enter email address"
                                   value={labData.reportSettings.dailyReport.notificationEmail || ''}
                                   onChange={e => setLabData({
                                      ...labData,
                                      reportSettings: {
                                        ...labData.reportSettings,
                                        dailyReport: { ...labData.reportSettings.dailyReport, notificationEmail: e.target.value }
                                      }
                                   })}
                                   className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-brand-dark outline-none focus:border-amber-500 shadow-sm"
                                 />
                              </div>
                           </div>

                           {labData.reportSettings.dailyReport.lastSent && (
                             <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 animate-in fade-in zoom-in duration-500">
                                <Check className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">
                                   Last Sent: {new Date(labData.reportSettings.dailyReport.lastSent.seconds * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                             </div>
                           )}

                           {/* Manual Send Now Button */}
                           <button
                             type="button"
                             onClick={handleSendDailyReport}
                             disabled={sendingReport}
                             className={`w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${
                               sendingReport
                                 ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                 : 'bg-brand-dark text-white border-brand-dark hover:bg-brand-secondary hover:border-brand-secondary shadow-lg shadow-brand-dark/10'
                             }`}
                           >
                             {sendingReport ? (
                               <><Loader className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                             ) : (
                               <><Send className="w-3.5 h-3.5" /> Send Now</>
                             )}
                           </button>
                        </div>
                      )}
                   </div>

                   {[
                     { label: 'Auto-Print Invoices', icon: Printer, desc: 'Always open print dialog after booking.', status: 'Upcoming' },
                     { label: 'WhatsApp Updates', icon: MessageSquare, desc: 'Real-time billing updates on phone.', status: 'Upcoming' },
                   ].map(card => (
                     <div key={card.label} className="p-8 bg-slate-50 border border-slate-100 rounded-[32px] flex items-start gap-6 group transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50">
                        <div className={`p-4 bg-white rounded-2xl shadow-sm transition-colors text-slate-300 group-hover:text-amber-500`}>
                           <card.icon className="w-6 h-6" />
                        </div>
                        <div>
                           <p className="text-sm font-black text-brand-dark uppercase tracking-widest">{card.label}</p>
                           <p className="text-[11px] font-bold text-slate-400 mt-1">{card.desc}</p>
                           <div className={`mt-4 inline-flex items-center px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-slate-100 text-slate-400 border-slate-100`}>
                             Upcoming
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            )}

            {activeTab === 'subscription' && (
              <div className="space-y-12 animate-in slide-in-from-right-4 duration-500">
                {subLoading ? (
                  <div className="py-20 text-center">
                    <Zap className="w-10 h-10 text-brand-primary animate-spin mx-auto mb-4" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetching Plan Details...</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-1.5 h-6 bg-rose-500 rounded-full"></div>
                          <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">Active Subscription</h3>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current plan and resource consumption.</p>
                      </div>
                      
                      {subData && (
                        <div className="flex items-center gap-4 bg-slate-50 px-6 py-4 rounded-[24px] border border-slate-100">
                          <div className="text-right">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Subscription expires in</p>
                             <p className="text-sm font-black text-brand-dark">
                                {subData.expiryDate ? (
                                  `${Math.ceil((new Date(subData.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))} Days Remaining`
                                ) : 'N/A'}
                             </p>
                          </div>
                          <div className="p-3 bg-rose-50 rounded-2xl text-rose-500">
                             <Clock className="w-5 h-5" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Active Plan Card Details */}
                    {subData && (
                      <div className="bg-slate-900 rounded-[40px] p-10 text-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                        
                        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                           <div className="space-y-6">
                              <div className="flex items-center gap-4">
                                 <div className="p-4 bg-brand-primary rounded-[24px] shadow-lg shadow-brand-primary/20">
                                    <Crown className="w-8 h-8 text-brand-dark" />
                                 </div>
                                 <div>
                                    <h4 className="text-3xl font-black uppercase tracking-tighter">Plan: {subData.plan?.replace(/_/g, ' ') || 'BASIC'}</h4>
                                    <p className="text-brand-primary text-[10px] font-black uppercase tracking-[0.3em]">Status: {subData.status || 'Active'}</p>
                                 </div>
                              </div>
                              <p className="text-white/50 text-sm font-medium leading-relaxed">Your lab is currently using the professional pathology management suite. All global test parameters and standard report formats are enabled.</p>
                           </div>

                           <div className="bg-white/5 border border-white/10 p-8 rounded-[32px] backdrop-blur-sm">
                              <div className="flex justify-between items-center mb-6">
                                 <span className="text-xs font-black text-brand-primary uppercase">Staff Usage Status</span>
                                 <span className="text-xs font-black text-brand-primary uppercase">{staffUsers.length} / {allPlans.find(p => p.id === (subData.plan || 'basic'))?.maxUsers || '∞'} Seats</span>
                              </div>
                              
                              <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                                 <div 
                                    className="h-full bg-brand-primary rounded-full transition-all duration-1000" 
                                    style={{ width: `${Math.min((staffUsers.length / (allPlans.find(p => p.id === (subData.plan || 'basic'))?.maxUsers || 10)) * 100, 100)}%` }}
                                 ></div>
                              </div>
                              <p className="text-[9px] text-white/30 mt-4 uppercase font-black tracking-widest leading-loose italic">* Limits are enforced strictly at the point of staff creation.</p>
                           </div>
                        </div>
                      </div>
                    )}

                    {/* Comparison UI */}
                    <div className="pt-8">
                       <div className="flex items-center gap-3 mb-10">
                          <div className="w-1.5 h-6 bg-brand-primary rounded-full"></div>
                          <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">Available Plans & Comparison</h3>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {allPlans.map(plan => (
                            <div key={plan.id} className={`p-8 bg-white border rounded-[36px] transition-all relative ${subData?.plan === plan.id ? 'border-brand-primary/40 ring-4 ring-brand-primary/5 bg-brand-primary/5' : 'border-slate-100'}`}>
                               {subData?.plan === plan.id && (
                                 <div className="absolute top-6 right-8 bg-brand-primary text-brand-dark text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-lg">Current Active</div>
                               )}
                               
                               <div className="flex items-center gap-4 mb-6">
                                  <div className={`p-3 rounded-2xl bg-gradient-to-br ${plan.color} text-white`}>
                                     {plan.iconName === 'Shield' ? <Shield className="w-5 h-5" /> : <Crown className="w-5 h-5" />}
                                  </div>
                                  <h5 className="text-lg font-black uppercase tracking-tight">{plan.name}</h5>
                               </div>

                               <div className="flex items-baseline gap-1 mb-6">
                                  <span className="text-3xl font-black text-brand-dark">{plan.price}</span>
                                  <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{plan.period}</span>
                               </div>

                               <div className="space-y-4 mb-8">
                                  {plan.features.slice(0, 6).map((f, i) => (
                                    <div key={i} className={`flex items-center gap-3 ${f.available ? 'opacity-100' : 'opacity-30'}`}>
                                       <div className={`w-5 h-5 rounded-full flex items-center justify-center ${f.available ? 'bg-brand-primary/10 text-brand-primary' : 'bg-slate-100'}`}>
                                          {f.available ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                       </div>
                                       <span className="text-[11px] font-bold text-slate-600 truncate">{f.text}</span>
                                    </div>
                                  ))}
                               </div>

                               <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                                  <div className="flex-1 flex items-center gap-2">
                                     <Users className="w-4 h-4 text-slate-400" />
                                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{plan.maxUsers} Staff Seats</span>
                                  </div>
                                  {subData?.plan !== plan.id && (
                                    <button className="px-5 py-2.5 bg-brand-dark text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all">Request Upgrade</button>
                                  )}
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                  </>
                )}

          </div>
            )}

          </div>

          {/* Staff Management Modal */}
      {isStaffModalOpen && (
        <StaffModal 
          isOpen={isStaffModalOpen} 
          onClose={() => { setIsStaffModalOpen(false); setSelectedStaff(null); }}
          staff={selectedStaff}
          labId={targetLabId}
          labData={labData}
          onSave={() => { fetchStaff(); setIsStaffModalOpen(false); }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal 
         isOpen={!!deleteConfirmUser} 
         onClose={() => setDeleteConfirmUser(null)} 
         onConfirm={confirmDeleteUser} 
         deletingUser={deleteConfirmUser} 
         isDeleting={isDeleting}
      />

      {/* Footer Info */}
          <div className="px-10 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
             <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-brand-primary" /> Last Settings Synced: {new Date().toLocaleTimeString()}
             </div>
             <p>Lab Mitra Engine v2.4.0</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ROLE_PERMISSIONS = {
  LabAdmin: {
    can_add_patients: true,
    can_manage_doctors: true,
    can_book_tests: true,
    can_view_billing: true,
    can_collect_payment: true,
    can_enter_results: true,
    can_approve_reports: true,
    can_manage_masters: true,
    can_access_settings: true,
    can_view_analytics: true,
    can_delete_records: true,
    can_apply_discounts: true,
    can_edit_final_reports: true
  },
  Pathologist: {
    can_add_patients: false,
    can_manage_doctors: false,
    can_book_tests: true,
    can_view_billing: false,
    can_collect_payment: false,
    can_enter_results: true,
    can_approve_reports: true,
    can_manage_masters: false,
    can_access_settings: false,
    can_view_analytics: false,
    can_delete_records: false,
    can_apply_discounts: false,
    can_edit_final_reports: true
  },
  Technician: {
    can_add_patients: false,
    can_manage_doctors: false,
    can_book_tests: false,
    can_view_billing: false,
    can_collect_payment: false,
    can_enter_results: true,
    can_approve_reports: false,
    can_manage_masters: false,
    can_access_settings: false,
    can_view_analytics: false,
    can_delete_records: false,
    can_apply_discounts: false,
    can_edit_final_reports: false
  },
  Receptionist: {
    can_add_patients: true,
    can_manage_doctors: true,
    can_book_tests: true,
    can_view_billing: true,
    can_collect_payment: true,
    can_enter_results: false,
    can_approve_reports: false,
    can_manage_masters: false,
    can_access_settings: false,
    can_view_analytics: false,
    can_delete_records: false,
    can_apply_discounts: true,
    can_edit_final_reports: false
  },
  Staff: {
    can_add_patients: true,
    can_manage_doctors: false,
    can_book_tests: true,
    can_view_billing: false,
    can_collect_payment: true,
    can_enter_results: true,
    can_approve_reports: false,
    can_manage_masters: false,
    can_access_settings: false,
    can_view_analytics: false,
    can_delete_records: false,
    can_apply_discounts: false,
    can_edit_final_reports: false
  }
};

const StaffModal = ({ isOpen, onClose, staff, labId, onSave, labData }) => {
  const [formData, setFormData] = useState({
    name: staff?.name || '',
    email: staff?.email || '',
    password: '',
    role: staff?.role || 'Receptionist',
    permissions: staff?.permissions || ROLE_PERMISSIONS[staff?.role || 'Receptionist']
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (formData.role === 'LabAdmin') {
        const existingAdminUid = labData?.adminUid;
        if (existingAdminUid && existingAdminUid !== staff?.id) {
          toast.error("❌ Only one Lab Admin is allowed per laboratory.");
          setSaving(false);
          return;
        }
      }

      const { auth } = await import('../firebase');
      const token = await auth.currentUser.getIdToken();
      const apiUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      
      let url = `${apiUrl}/api/auth/staff`;
      let method = 'POST';
      
      if (staff) {
        url = `${apiUrl}/api/auth/staff/${staff.id}`;
        method = 'PUT';
      }
      
      const payload = {
        ...formData,
        labId
      };
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (!response.ok) {
         throw new Error(data.error || 'Failed to save staff user');
      }

      toast.success(staff ? "Staff profile updated!" : "Staff profile created successfully!");
      onSave();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (key) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key]
      }
    }));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
        <div className="px-10 py-8 bg-brand-dark text-white flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tighter">{staff ? 'Edit Staff Permissions' : 'Add New Staff Member'}</h3>
            <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mt-1">Configure access for {staff?.email || 'new team member'}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <input 
                type="text" required value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-brand-primary transition-all shadow-inner"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Role</label>
                <select 
                  value={formData.role} 
                  onChange={e => {
                    const newRole = e.target.value;
                    setFormData({ 
                      ...formData, 
                      role: newRole,
                      permissions: ROLE_PERMISSIONS[newRole] || formData.permissions
                    });
                  }}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-brand-primary transition-all shadow-inner"
                >
                  <option value="Receptionist">Receptionist</option>
                  <option value="Technician">Lab Technician</option>
                  <option value="Pathologist">Pathologist (Doctor)</option>
                </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email ID</label>
                <input 
                  type="email" required value={formData.email} disabled={!!staff}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-brand-primary transition-all disabled:opacity-50 shadow-inner"
                />
            </div>
            <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password {staff && <span className="text-[8px] font-black tracking-wider text-brand-primary/60 normal-case ml-1">(Leave blank to keep unchanged)</span>}</label>
                <input 
                  type="text" required={!staff} minLength={6} value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-brand-primary transition-all shadow-inner placeholder:text-slate-300"
                  placeholder={staff ? "••••••••" : "Set login password"}
                />
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                   <Shield className="w-5 h-5 text-indigo-500" />
                   <h4 className="text-sm font-black text-brand-dark uppercase tracking-tight">Permissions Matrix</h4>
                </div>
                {formData.role === 'LabAdmin' && (
                  <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-100">Full Access Mode</span>
                )}
             </div>
             
             <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${formData.role === 'LabAdmin' ? 'opacity-60 pointer-events-none' : ''}`}>
                 {[
                   { key: 'can_add_patients', label: 'Patient Registration', desc: 'Add or Edit patient profiles', longDesc: 'Allows staff to register new patients, edit existing profiles, and view patient history.' },
                   { key: 'can_manage_doctors', label: 'Doctor Directory', desc: 'Add or Edit referring doctors', longDesc: 'Grants access to manage referring doctors and their respective commissions/ledgers.' },
                   { key: 'can_book_tests', label: 'Test Bookings', desc: 'Create new lab test bookings', longDesc: 'Facilitates creating new test bookings, selecting test categories, and assigning doctors.' },
                   { key: 'can_view_billing', label: 'Billing & Invoicing', desc: 'Generate bills and invoices', longDesc: 'Allows viewing existing bills, downloading invoices, and tracking financial history.' },
                   { key: 'can_collect_payment', label: 'Point of Sale', desc: 'Mark invoices as paid and settle dues', longDesc: 'Enables recording payments, settling outstanding dues, and updating payment statuses.' },
                   { key: 'can_enter_results', label: 'Result Entry', desc: 'Input test values in clinical reports', longDesc: 'Key permission for technicians to enter clinical data and findings into report templates.' },
                   { key: 'can_approve_reports', label: 'Report Approval', desc: 'Finalize and sign-off medical reports', longDesc: 'Highest clinical permission. Allows doctors to finalize reports for patient delivery.' },
                   { key: 'can_manage_masters', label: 'Catalog Management', desc: 'Edit test rates and parameter definitions', longDesc: 'Administrative access to edit the Test Masters, pricing, and reference ranges.' },
                   { key: 'can_access_settings', label: 'System Admin', desc: 'Change lab profile and branding', longDesc: 'Full administrative control over lab name, address, branding, and system setups.' },
                   { key: 'can_view_analytics', label: 'View Analytics', desc: 'Access business metrics and trends', longDesc: 'Grants access to the Business Analytics dashboard for tracking revenue and performance.' },
                   { key: 'can_delete_records', label: 'Delete Records', desc: 'Remove patients or bookings', longDesc: 'Critical permission. Allows deleting sensitive data from the system (Patients, Bookings, etc.).' },
                   { key: 'can_apply_discounts', label: 'Apply Discounts', desc: 'Give discounts during billing', longDesc: 'Allows staff to modify test totals and apply discounts during the booking/billing process.' },
                   { key: 'can_edit_final_reports', label: 'Edit Signed Reports', desc: 'Modify results after sign-off', longDesc: 'Allows editing clinical results even after a report has been marked as Final/Approved.' },
                 ].map(item => (
                   <label key={item.key} className="flex items-start gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/30 cursor-pointer hover:bg-white hover:border-brand-primary/20 transition-all group relative">
                     <div className="relative inline-flex items-center mt-1">
                       <input 
                         type="checkbox" className="sr-only peer" 
                         checked={formData.permissions?.[item.key]} 
                         onChange={() => togglePermission(item.key)} 
                       />
                       <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary shadow-inner"></div>
                     </div>
                     <div className="flex-grow">
                       <div className="flex items-center justify-between mb-1">
                          <p className="text-[11px] font-black text-brand-dark uppercase tracking-widest leading-none group-hover:text-brand-primary transition-colors">{item.label}</p>
                          <div className="relative group/info">
                            <Info className="w-3.5 h-3.5 text-slate-300 hover:text-brand-primary cursor-help transition-colors" />
                            {/* Detailed Tooltip */}
                            <div className="absolute bottom-full right-0 mb-3 w-48 p-4 bg-brand-dark text-[10px] font-bold text-white leading-relaxed rounded-2xl shadow-2xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-[300] border border-white/10 backdrop-blur-md">
                              <p className="normal-case tracking-normal">{item.longDesc}</p>
                              <div className="absolute top-full right-2 w-3 h-3 bg-brand-dark rotate-45 -mt-1.5 border-r border-b border-white/10" />
                            </div>
                          </div>
                       </div>
                       <p className="text-[9px] font-bold text-slate-400 leading-tight">{item.desc}</p>
                     </div>
                   </label>
                 ))}
             </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="button" onClick={onClose}
              className="flex-1 py-5 bg-slate-50 text-slate-400 rounded-3xl text-[11px] font-black uppercase tracking-widest border border-slate-100 hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" disabled={saving}
              className="flex-[2] py-5 bg-brand-dark text-white rounded-3xl text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-brand-secondary transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : staff ? 'Commit Changes' : 'Invite Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, deletingUser, isDeleting }) => {
  const [password, setPassword] = useState('');
  
  // reset on unmount or when hidden
  useEffect(() => {
    if (!isOpen) setPassword('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(password);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300 text-center p-8 relative">
        {isDeleting && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
             <Loader className="w-8 h-8 text-rose-500 animate-spin" />
          </div>
        )}
        <div className="w-16 h-16 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
           <Trash2 className="w-8 h-8 text-rose-500" />
        </div>
        <h3 className="text-xl font-black uppercase text-brand-dark tracking-tighter mb-2">Confirm Delete</h3>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose mb-6">
          To completely delete <span className="text-brand-primary">{deletingUser?.name || 'this user'}</span>, please verify your Admin password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
           <input 
             type="password" required autoFocus
             value={password} onChange={(e) => setPassword(e.target.value)}
             className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-center text-slate-700 outline-none focus:border-rose-500 transition-all shadow-inner placeholder:text-slate-300"
             placeholder="••••••••"
             disabled={isDeleting}
           />
           <div className="flex gap-4">
             <button type="button" onClick={onClose} disabled={isDeleting} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all disabled:opacity-50">Cancel</button>
             <button type="submit" disabled={isDeleting} className="flex-1 py-4 bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-rose-600 transition-all disabled:opacity-50">Delete</button>
           </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
