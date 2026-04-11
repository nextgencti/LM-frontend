import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Settings, Save, Loader, Globe, CheckCircle, Image as ImageIcon, MapPin, Phone, Building, Mail } from 'lucide-react';

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
    resendApiKey: ''
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
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 flex items-center">
          <Settings className="w-8 h-8 mr-3 text-red-600" />
          Global System Settings
        </h1>
        <p className="text-gray-500 mt-2">
          Configure default headers, footers, and system-wide formatting used as fallbacks for labs without custom profiles.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Lab Identity Section */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-8">
          <div className="flex items-center mb-6">
            <div className="p-3 bg-red-50 rounded-2xl mr-4">
              <Building className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Default Identity</h2>
              <p className="text-xs font-bold text-gray-400 tracking-wider">PRIMARY BRANDING</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Default Lab Short Name *</label>
              <input 
                type="text" required
                value={settings.labName}
                onChange={(e) => setSettings({...settings, labName: e.target.value})}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-red-600 focus:bg-white rounded-2xl transition-all font-bold outline-none"
                placeholder="e.g. NG"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Default Lab Full Name *</label>
              <input 
                type="text" required
                value={settings.labFullName}
                onChange={(e) => setSettings({...settings, labFullName: e.target.value})}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-red-600 focus:bg-white rounded-2xl transition-all font-bold outline-none"
                placeholder="e.g. NextGen Diagnostic & Research Centre"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Registration / License No.</label>
              <input 
                type="text"
                value={settings.licenseNo}
                onChange={(e) => setSettings({...settings, licenseNo: e.target.value})}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-red-600 focus:bg-white rounded-2xl transition-all font-bold outline-none"
                placeholder="System default license"
              />
            </div>
          </div>
        </div>

        {/* Contact & Location Section */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-8">
          <div className="flex items-center mb-6">
            <div className="p-3 bg-blue-50 rounded-2xl mr-4">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Contact & Address</h2>
              <p className="text-xs font-bold text-gray-400 tracking-wider">DEFAULT LOCATION DETAILS</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Full Address</label>
              <textarea 
                rows={2}
                value={settings.address}
                onChange={(e) => setSettings({...settings, address: e.target.value})}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl transition-all font-bold outline-none resize-none"
                placeholder="Headquarters address..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Phone Number</label>
                <input 
                  type="text"
                  value={settings.phone}
                  onChange={(e) => setSettings({...settings, phone: e.target.value})}
                  className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl transition-all font-bold outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Email Support</label>
                <input 
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({...settings, email: e.target.value})}
                  className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl transition-all font-bold outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Website URL</label>
                <input 
                  type="text"
                  value={settings.website}
                  onChange={(e) => setSettings({...settings, website: e.target.value})}
                  className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl transition-all font-bold outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Report Elements Section */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-8">
          <div className="flex items-center mb-6">
            <div className="p-3 bg-purple-50 rounded-2xl mr-4">
              <Globe className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Report Elements</h2>
              <p className="text-xs font-bold text-gray-400 tracking-wider">STANDARD REPORT CONFIGURATION</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Default Watermark Text</label>
              <input 
                type="text"
                value={settings.watermarkText}
                onChange={(e) => setSettings({...settings, watermarkText: e.target.value})}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-purple-600 focus:bg-white rounded-2xl transition-all font-bold outline-none text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">End of Report Disclaimer / Footer Text</label>
              <textarea 
                rows={3}
                value={settings.footerText}
                onChange={(e) => setSettings({...settings, footerText: e.target.value})}
                className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-purple-600 focus:bg-white rounded-2xl transition-all font-bold outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Email Notification Configuration Section */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-8">
          <div className="flex items-center mb-6">
            <div className="p-3 bg-amber-50 rounded-2xl mr-4">
              <Mail className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Email Notifications</h2>
              <p className="text-xs font-bold text-gray-400 tracking-wider">SYSTEM PROVIDER SETTINGS</p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex bg-gray-50 p-2 rounded-2xl border border-gray-100 max-w-sm">
              <button
                type="button"
                onClick={() => setSettings({...settings, emailProvider: 'gas'})}
                className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-xl transition-all ${settings.emailProvider === 'gas' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                Google Apps Script
              </button>
              <button
                type="button"
                onClick={() => setSettings({...settings, emailProvider: 'resend'})}
                className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-xl transition-all ${settings.emailProvider === 'resend' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                Resend API
              </button>
            </div>

            {settings.emailProvider === 'gas' && (
              <div className="space-y-2 animate-in fade-in duration-300">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Google Apps Script Web App URL</label>
                <input 
                  type="text"
                  value={settings.gasUrl}
                  onChange={(e) => setSettings({...settings, gasUrl: e.target.value})}
                  className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-amber-500 focus:bg-white rounded-2xl transition-all font-bold outline-none text-gray-600"
                  placeholder="https://script.google.com/macros/s/..."
                />
                <p className="text-[10px] text-gray-400 font-bold ml-2 mt-2">Leave blank to fallback to backend .env file default.</p>
              </div>
            )}

            {settings.emailProvider === 'resend' && (
              <div className="space-y-2 animate-in fade-in duration-300">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Resend API Key</label>
                <input 
                  type="password"
                  value={settings.resendApiKey}
                  onChange={(e) => setSettings({...settings, resendApiKey: e.target.value})}
                  className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl transition-all font-bold outline-none text-gray-600"
                  placeholder="re_..."
                />
                <p className="text-[10px] text-gray-400 font-bold ml-2 mt-2">Leave blank to fallback to backend .env file default.</p>
              </div>
            )}
          </div>
        </div>

        {/* Save Footer */}
        <div className="flex items-center justify-between bg-gray-900 p-6 rounded-[24px] shadow-lg">
          <div>
            {successMsg ? (
               <div className="flex items-center text-green-400 font-bold bg-green-900/40 px-4 py-2 rounded-xl">
                 <CheckCircle className="w-5 h-5 mr-2" />
                 {successMsg}
               </div>
            ) : (
               <p className="text-gray-400 text-sm font-medium">Changes will apply instantly to all new reports without a custom lab profile.</p>
            )}
          </div>
          <button 
            type="submit" 
            disabled={saving}
            className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-red-500 transition-all flex items-center shadow-lg shadow-red-900/20 disabled:opacity-50"
          >
            {saving ? <Loader className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
};

export default GlobalSettings;
