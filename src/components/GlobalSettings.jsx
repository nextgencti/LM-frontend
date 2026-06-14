import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Settings, Save, Loader, Globe, CheckCircle, Image as ImageIcon, MapPin, Phone, Building, Mail, Clock } from 'lucide-react';

const GlobalSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const [settings, setSettings] = useState({
    labName: '',
    labFullName: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    licenseNo: '',
    watermarkText: 'CONFIDENTIAL',
    footerText: 'This is a system-generated report. Ensure clinical correlation before starting treatment.',
    emailProvider: 'gas',
    gasUrl: '',
    resendApiKey: '',
    demoDays: 30
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'settings', 'global');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSettings(prev => ({ ...prev, ...docSnap.data() }));
      }
    } catch (error) {
      console.error('Error fetching global settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        ...settings,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setSuccessMsg('Settings saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error('Error saving global settings:', error);
      alert('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-20 flex justify-center items-center">
        <Loader className="w-10 h-10 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 pb-8 space-y-4">
      <div className="mb-4">
        <h1 className="text-lg font-black text-gray-900 flex items-center">
          <Settings className="w-5 h-5 mr-2 text-red-600" />
          Global System Settings
        </h1>
        <p className="text-gray-500 text-[10px] mt-1">
          Configure default headers, footers, and system-wide formatting used as fallbacks for labs without custom profiles.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Lab Identity Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center mb-3">
            <div className="p-1.5 bg-red-50 rounded-xl mr-2">
              <Building className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h2 className="text-xs font-black text-gray-900">Default Identity</h2>
              <p className="text-[8px] font-black text-slate-400 tracking-widest">PRIMARY BRANDING</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Default Lab Short Name *</label>
              <input 
                type="text" required
                value={settings.labName}
                onChange={(e) => setSettings({...settings, labName: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-bold text-brand-dark outline-none focus:border-brand-primary/40 focus:bg-white transition-all shadow-inner"
                placeholder="e.g. NG"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Default Lab Full Name *</label>
              <input 
                type="text" required
                value={settings.labFullName}
                onChange={(e) => setSettings({...settings, labFullName: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-bold text-brand-dark outline-none focus:border-brand-primary/40 focus:bg-white transition-all shadow-inner"
                placeholder="e.g. NextGen Diagnostic & Research Centre"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Registration / License No.</label>
              <input 
                type="text"
                value={settings.licenseNo}
                onChange={(e) => setSettings({...settings, licenseNo: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-bold text-brand-dark outline-none focus:border-brand-primary/40 focus:bg-white transition-all shadow-inner"
                placeholder="System default license"
              />
            </div>
          </div>
        </div>

        {/* Contact & Location Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center mb-3">
            <div className="p-1.5 bg-blue-50 rounded-xl mr-2">
              <MapPin className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xs font-black text-gray-900">Contact & Address</h2>
              <p className="text-[8px] font-black text-slate-400 tracking-widest">DEFAULT LOCATION DETAILS</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Full Address</label>
              <textarea 
                rows={2}
                value={settings.address}
                onChange={(e) => setSettings({...settings, address: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-bold text-brand-dark outline-none focus:border-brand-primary/40 focus:bg-white transition-all shadow-inner resize-none"
                placeholder="Headquarters address..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Phone Number</label>
                <input 
                  type="text"
                  value={settings.phone}
                  onChange={(e) => setSettings({...settings, phone: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-bold text-brand-dark outline-none focus:border-brand-primary/40 focus:bg-white transition-all shadow-inner"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Email Support</label>
                <input 
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({...settings, email: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-bold text-brand-dark outline-none focus:border-brand-primary/40 focus:bg-white transition-all shadow-inner"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Website URL</label>
                <input 
                  type="text"
                  value={settings.website}
                  onChange={(e) => setSettings({...settings, website: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-bold text-brand-dark outline-none focus:border-brand-primary/40 focus:bg-white transition-all shadow-inner"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Report Elements Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center mb-3">
            <div className="p-1.5 bg-purple-50 rounded-xl mr-2">
              <Globe className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xs font-black text-gray-900">Report Elements</h2>
              <p className="text-[8px] font-black text-slate-400 tracking-widest">STANDARD REPORT CONFIGURATION</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Default Watermark Text</label>
              <input 
                type="text"
                value={settings.watermarkText}
                onChange={(e) => setSettings({...settings, watermarkText: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-bold text-brand-dark outline-none focus:border-brand-primary/40 focus:bg-white transition-all shadow-inner"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Disclaimer / Footer Text</label>
              <textarea 
                rows={2}
                value={settings.footerText}
                onChange={(e) => setSettings({...settings, footerText: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-bold text-brand-dark outline-none focus:border-brand-primary/40 focus:bg-white transition-all shadow-inner resize-none"
              />
            </div>
          </div>
        </div>

        {/* Email Notification Configuration Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center mb-3">
            <div className="p-1.5 bg-amber-50 rounded-xl mr-2">
              <Mail className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xs font-black text-gray-900">Email Notifications</h2>
              <p className="text-[8px] font-black text-slate-400 tracking-widest">SYSTEM PROVIDER SETTINGS</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 max-w-xs">
              <button
                type="button"
                onClick={() => setSettings({...settings, emailProvider: 'gas'})}
                className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${settings.emailProvider === 'gas' ? 'bg-amber-500 text-white shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                Google Apps Script
              </button>
              <button
                type="button"
                onClick={() => setSettings({...settings, emailProvider: 'resend'})}
                className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${settings.emailProvider === 'resend' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                Resend API
              </button>
            </div>

            {settings.emailProvider === 'gas' && (
              <div className="space-y-1 animate-in fade-in duration-300">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Google Apps Script Web App URL</label>
                <input 
                  type="text"
                  value={settings.gasUrl}
                  onChange={(e) => setSettings({...settings, gasUrl: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-bold text-brand-dark outline-none focus:border-brand-primary/40 focus:bg-white transition-all shadow-inner"
                  placeholder="https://script.google.com/macros/s/..."
                />
                <p className="text-[8.5px] text-gray-400 font-bold ml-1 mt-1">Leave blank to fallback to backend default.</p>
              </div>
            )}

            {settings.emailProvider === 'resend' && (
              <div className="space-y-1 animate-in fade-in duration-300">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Resend API Key</label>
                <input 
                  type="password"
                  value={settings.resendApiKey}
                  onChange={(e) => setSettings({...settings, resendApiKey: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-bold text-brand-dark outline-none focus:border-brand-primary/40 focus:bg-white transition-all shadow-inner"
                  placeholder="re_..."
                />
                <p className="text-[8.5px] text-gray-400 font-bold ml-1 mt-1">Leave blank to fallback to backend default.</p>
              </div>
            )}
          </div>
        </div>

        {/* Demo Trial Configuration Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center mb-3">
            <div className="p-1.5 bg-violet-50 rounded-xl mr-2">
              <Clock className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h2 className="text-xs font-black text-gray-900">Demo Trial Configuration</h2>
              <p className="text-[8px] font-black text-slate-400 tracking-widest">FREE TRIAL SETTINGS FOR NEW SIGNUPS</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="space-y-1 flex-1">
                <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Demo Duration (Days)</label>
                <input 
                  type="number"
                  min="1"
                  max="365"
                  value={settings.demoDays}
                  onChange={(e) => setSettings({...settings, demoDays: parseInt(e.target.value) || 30})}
                  className="w-full px-3 py-1.5 bg-slate-50/50 border border-slate-100 rounded-lg text-sm font-black text-violet-600 outline-none focus:border-brand-primary/40 focus:bg-white transition-all shadow-inner"
                />
              </div>
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 flex-1 text-xs">
                <p className="text-[8.5px] font-black text-violet-600 uppercase tracking-widest mb-0.5">How it works</p>
                <p className="text-[10px] text-violet-800 font-bold leading-normal">
                  New labs that register via the signup page will automatically receive a <strong>{settings.demoDays}-day</strong> free demo with full PRO features. After expiry, they must purchase a subscription.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Save Footer */}
        <div className="flex items-center justify-between bg-brand-dark p-3.5 rounded-xl shadow-lg">
          <div>
            {successMsg ? (
               <div className="flex items-center text-green-400 font-bold bg-green-950/40 px-2.5 py-1 rounded-lg text-[9.5px]">
                 <CheckCircle className="w-3.5 h-3.5 mr-1" />
                 {successMsg}
               </div>
            ) : (
               <p className="text-slate-400 text-[9.5px] font-medium max-w-sm">Changes will apply instantly to all new reports without a custom lab profile.</p>
            )}
          </div>
          <button 
            type="submit" 
            disabled={saving}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-700 shadow-md shadow-red-950/20 transition-all flex items-center disabled:opacity-50"
          >
            {saving ? <Loader className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
};

export default GlobalSettings;
