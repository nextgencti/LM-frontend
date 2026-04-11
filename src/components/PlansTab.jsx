import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, setDoc, getDocs, writeBatch } from 'firebase/firestore';
import { Check, Shield, Zap, Crown, Users, FileText, BarChart3, Headphones, Globe, ArrowRight, Edit3, X, Save, Plus, Trash2 } from 'lucide-react';

const ICON_MAP = {
  Shield: Shield,
  Crown: Crown,
  Zap: Zap,
  Users: Users
};

const PlansTab = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(null);
  const [editData, setEditData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // 1. Initial Seeding Logic (if collection is empty)
    const seedPlansIfNotExists = async () => {
      const querySnapshot = await getDocs(collection(db, 'plans'));
      if (querySnapshot.empty) {
        console.log("Seeding initial plans to Firestore...");
        const batch = writeBatch(db);
        
        const initialPlans = [
          {
            id: 'basic',
            name: 'Basic',
            price: '₹5,000',
            period: '/ year',
            description: 'Perfect for small diagnostic collection centers.',
            color: 'from-slate-700 to-slate-900',
            iconName: 'Shield',
            features: [
              { text: 'Standard Lab Management', available: true },
              { text: 'Single Admin User Account', available: true },
              { text: 'Basic Report Header/Footer', available: true },
              { text: 'Global Test Catalog Access', available: true },
              { text: 'Standard Result Templates', available: true },
              { text: 'Email Support', available: true },
              { text: 'Premium Watermarking', available: false },
              { text: 'Multi-Staff Accounts', available: false },
              { text: 'Business Analytics', available: false },
              { text: 'Priority WhatsApp Support (Upcoming)', available: false },
            ],
            cta: 'Plan Details',
            popular: false,
            order: 1,
            maxUsers: 2
          },
          {
            id: 'pro',
            name: 'Pro',
            price: '₹12,000',
            period: '/ year',
            description: 'Advanced features for full-scale pathology laboratories.',
            color: 'from-brand-dark to-brand-secondary',
            iconName: 'Crown',
            features: [
              { text: 'Advanced Lab Management', available: true },
              { text: 'Unlimited Staff Accounts', available: true },
              { text: 'Full Premium Branding', available: true },
              { text: 'Custom Watermarks & Logos', available: true },
              { text: 'Global Parameter Library', available: true },
              { text: 'Business Analytics Dashboard', available: true },
              { text: 'Automatic Sync Backups', available: true },
              { text: 'Patient Portal Access (Live)', available: true },
              { text: 'WhatsApp & Call Support (Upcoming)', available: false },
              { text: 'Customized Letterheads', available: true },
            ],
            cta: 'Recently Launched',
            popular: true,
            order: 2,
            maxUsers: 10
          }
        ];

        initialPlans.forEach(plan => {
          const docRef = doc(db, 'plans', plan.id);
          batch.set(docRef, plan);
        });

        await batch.commit();
      }
    };

    seedPlansIfNotExists();

    // 2. Real-time Subscription
    const unsubscribe = onSnapshot(collection(db, 'plans'), (snapshot) => {
      const plansList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => (a.order || 0) - (b.order || 0));
      
      setPlans(plansList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleEdit = (plan) => {
    setIsEditing(plan.id);
    setEditData({ ...plan });
  };

  const handleSave = async () => {
    if (!editData) return;
    setIsSaving(true);
    try {
      const planRef = doc(db, 'plans', editData.id);
      await updateDoc(planRef, {
        price: editData.price,
        description: editData.description,
        features: editData.features,
        popular: editData.popular,
        cta: editData.cta,
        maxUsers: parseInt(editData.maxUsers) || 0
      });
      setIsEditing(null);
      setEditData(null);
    } catch (error) {
      console.error("Error updating plan:", error);
      alert("Failed to save plan updates.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleFeature = (index) => {
    const updatedFeatures = [...editData.features];
    updatedFeatures[index].available = !updatedFeatures[index].available;
    setEditData({ ...editData, features: updatedFeatures });
  };

  const updateFeatureText = (index, text) => {
    const updatedFeatures = [...editData.features];
    updatedFeatures[index].text = text;
    setEditData({ ...editData, features: updatedFeatures });
  };

  if (loading) {
    return (
      <div className="p-24 flex flex-col items-center justify-center">
        <Zap className="w-12 h-12 animate-spin text-brand-primary mb-4" />
        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Synchronizing Pricing Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
      {/* Header */}
      <div className="bg-white p-10 rounded-[32px] shadow-[0_20px_50px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-8">
        <div>
          <h1 className="text-4xl font-black text-brand-dark tracking-tighter uppercase">
            Service <span className="text-brand-primary/80">Plans</span>
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-1.5">Manage subscription tiers and feature availability.</p>
        </div>
        <div className="flex items-center gap-4 text-slate-400 font-bold text-xs uppercase tracking-widest bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 shadow-inner">
           <Zap className="w-4 h-4 text-brand-primary animate-pulse" />
           Live Firestore Management
        </div>
      </div>

      {/* Plans Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {plans.map((plan) => {
          const Icon = ICON_MAP[plan.iconName] || Shield;
          
          return (
            <div 
              key={plan.id} 
              className={`relative flex flex-col bg-white rounded-[48px] shadow-2xl overflow-hidden border transition-all duration-500 hover:translate-y-[-5px] ${plan.popular ? 'border-brand-primary/30 ring-8 ring-brand-primary/5 shadow-brand-primary/10' : 'border-slate-100'}`}
            >
              {plan.popular && (
                <div className="absolute top-8 right-8 bg-brand-primary text-brand-dark text-[10px] font-black uppercase tracking-[0.3em] px-5 py-2 rounded-full shadow-lg z-10">
                  Most Popular
                </div>
              )}

              {/* Edit Trigger */}
              <button 
                onClick={() => handleEdit(plan)}
                className="absolute top-8 left-8 p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-white hover:bg-white hover:text-brand-dark transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-20"
                style={{ opacity: 1 }} // Force visible for SuperAdmin
              >
                <Edit3 className="w-4 h-4" />
              </button>

              {/* Plan Header */}
              <div className={`p-10 bg-gradient-to-br ${plan.color} text-white`}>
                <div className="flex items-center gap-6 mb-8 pt-6 lg:pt-0">
                  <div className="p-4 bg-white/10 backdrop-blur-md rounded-3xl border border-white/10 ring-1 ring-white/20">
                    <Icon className={`w-8 h-8 ${plan.popular ? 'text-brand-primary' : 'text-slate-300'}`} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter">{plan.name}</h2>
                    <p className="text-xs font-bold text-white/50 uppercase tracking-widest">{plan.popular ? 'Maximum Power' : 'Essential Features'}</p>
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black tracking-tighter">{plan.price}</span>
                  <span className="text-lg font-bold text-white/40 uppercase tracking-widest">{plan.period}</span>
                </div>
                <div className="mt-4 flex items-center gap-2 bg-white/10 w-fit px-4 py-1.5 rounded-full border border-white/10">
                   <Users className="w-3 h-3 text-white/70" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-white/90">User Limit: {plan.maxUsers || 'N/A'} Users</span>
                </div>
                <p className="mt-6 text-white/60 font-medium leading-relaxed max-w-xs">{plan.description}</p>
              </div>

              {/* Features List */}
              <div className="p-10 flex-grow bg-white">
                <div className="space-y-6">
                  {plan.features.map((feature, fIdx) => (
                    <div key={fIdx} className={`flex items-center gap-4 ${feature.available ? 'opacity-100' : 'opacity-30'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${feature.available ? 'bg-brand-primary/10 text-brand-primary' : 'bg-slate-100 text-slate-400'}`}>
                        {feature.available ? <Check className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5 rotate-45" />}
                      </div>
                      <span className={`text-[13px] font-bold ${feature.available ? 'text-brand-dark' : 'text-slate-400 line-through'}`}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer / CTA */}
              <div className="p-10 pt-0">
                 <div className={`w-full py-5 rounded-[24px] text-[11px] font-black uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-3 border ${plan.popular ? 'bg-brand-dark text-white border-brand-dark' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                    {plan.cta || 'Plan Details'}
                 </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {isEditing && editData && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
          <div className="bg-white rounded-[40px] w-full max-w-3xl shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl bg-gradient-to-br ${editData.color} text-white`}>
                  <Edit3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-brand-dark uppercase tracking-tighter">Edit {editData.name} Plan</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Updates will reflect for all users instantly.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditing(null)}
                className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all shadow-inner"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Plan Price</label>
                  <input 
                    type="text" 
                    value={editData.price}
                    onChange={(e) => setEditData({ ...editData, price: e.target.value })}
                    className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[20px] text-brand-dark font-black focus:ring-4 focus:ring-brand-primary/10 accent-brand-primary outline-none"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secondary Price Label (CTA)</label>
                  <input 
                    type="text" 
                    value={editData.cta}
                    onChange={(e) => setEditData({ ...editData, cta: e.target.value })}
                    className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[20px] text-brand-dark font-black focus:ring-4 focus:ring-brand-primary/10 accent-brand-primary outline-none"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Max Users Allowed</label>
                  <div className="relative">
                    <Users className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 pointer-events-none" />
                    <input 
                      type="number" 
                      value={editData.maxUsers}
                      onChange={(e) => setEditData({ ...editData, maxUsers: e.target.value })}
                      className="w-full pl-16 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-[20px] text-brand-dark font-black focus:ring-4 focus:ring-brand-primary/10 accent-brand-primary outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Short Description</label>
                <textarea 
                  rows="2"
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[24px] text-brand-dark font-bold focus:ring-4 focus:ring-brand-primary/10 accent-brand-primary outline-none"
                />
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan Features (Active Toggles)</label>
                  <div className="flex items-center gap-3">
                    <input 
                       type="checkbox" 
                       checked={editData.popular}
                       onChange={(e) => setEditData({ ...editData, popular: e.target.checked })}
                       className="w-5 h-5 accent-brand-primary"
                    />
                    <span className="text-[10px] font-black text-brand-dark uppercase tracking-widest">Mark as Popular</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {editData.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-all hover:border-brand-primary/20">
                      <button 
                        onClick={() => toggleFeature(idx)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${feature.available ? 'bg-brand-primary text-brand-dark shadow-lg shadow-brand-primary/20' : 'bg-slate-200 text-slate-400'}`}
                      >
                        {feature.available ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                      </button>
                      <input 
                        type="text" 
                        value={feature.text}
                        onChange={(e) => updateFeatureText(idx, e.target.value)}
                        className={`flex-grow bg-transparent border-none outline-none font-bold text-sm ${feature.available ? 'text-brand-dark' : 'text-slate-400 line-through'}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-10 border-t border-slate-100 flex justify-end gap-6 bg-slate-50/50 rounded-b-[40px]">
              <button 
                onClick={() => setIsEditing(null)}
                className="px-10 py-5 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-brand-dark transition-all"
              >
                Discard Changes
              </button>
              <button 
                disabled={isSaving}
                onClick={handleSave}
                className="flex items-center gap-3 px-10 py-5 bg-brand-dark text-white rounded-[24px] text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-brand-dark/20 hover:bg-brand-secondary active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
              >
                {isSaving ? <Zap className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-brand-primary" />}
                {isSaving ? 'Synchronizing...' : 'Save & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Future Roadmap / Notice */}
      <div className="bg-slate-900 rounded-[40px] p-12 text-white overflow-hidden relative group">
         <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-primary/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-primary/20 transition-all"></div>
         
         <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12 items-center">
            <div className="md:col-span-2">
               <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-brand-primary rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(163,230,53,0.3)]">
                     <Zap className="w-5 h-5 text-brand-dark" />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Enterprise & Hospital Custom Plans</h3>
               </div>
               <p className="text-white/50 font-medium leading-[1.8] text-sm">
                  Large hospitals and diagnostic chains require bespoke configurations including HL7 integration, PACS connectivity, and white-label mobile apps. These are handled exclusively via direct consultation.
               </p>
            </div>
            <div className="flex justify-start md:justify-end">
               <button className="px-10 py-5 bg-white text-brand-dark rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-primary hover:scale-105 transition-all shadow-2xl">
                  Contact Support
               </button>
            </div>
         </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}} />
    </div>
  );
};

export default PlansTab;
