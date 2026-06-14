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
    // 1. Initial Seeding Logic (ensures all hardcoded plans exist)
    const seedPlansIfNotExists = async () => {
      const initialPlans = [
        {
          id: 'basic',
          name: 'Basic',
          price: '₹499',
          period: '/ month',
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
            { text: 'Doctor Ledger Management', available: false },
          ],
          cta: 'Plan Details',
          popular: false,
          order: 1,
          maxUsers: 2
        },
        {
          id: 'pro',
          name: 'Pro',
          price: '₹1499',
          period: '/ month',
          description: 'Advanced features for full-scale pathology laboratories.',
          color: 'from-brand-dark to-brand-secondary',
          iconName: 'Crown',
          features: [
            { text: 'Advanced Lab Management', available: true },
            { text: 'Multiple Staff Accounts', available: true },
            { text: 'Full Premium Branding', available: true },
            { text: 'Custom Watermarks & Logos', available: true },
            { text: 'Global Parameter Library', available: true },
            { text: 'Business Analytics Dashboard', available: true },
            { text: 'Automatic Sync Backups', available: true },
            { text: 'Patient Portal Access (Live)', available: true },
            { text: 'WhatsApp & Call Support (Upcoming)', available: false },
            { text: 'Customized Letterheads', available: true },
            { text: 'Doctor Ledger Management', available: true },
          ],
          cta: 'Recently Launched',
          popular: true,
          order: 2,
          maxUsers: 10
        },
        {
          id: 'pay_as_you_go',
          name: 'Pay As You Go',
          price: '₹10',
          period: '/ token',
          description: 'Zero monthly fee. Pay only for what you use. Perfect for startup labs.',
          color: 'from-amber-400 to-orange-600',
          iconName: 'Zap',
          features: [
            { text: '1 Token per Finalized Report', available: true },
            { text: '1 Token per Daily Report Email', available: true },
            { text: '1 Token per Doctor Ledger Print & Email', available: true },
            { text: 'Advanced Lab Management', available: true },
            { text: 'Multiple Staff Accounts', available: true },
            { text: 'Full Premium Branding', available: true },
            { text: 'Custom Watermarks & Logos', available: true },
            { text: 'Global Parameter Library', available: true },
            { text: 'Business Analytics Dashboard', available: true },
            { text: 'Automatic Sync Backups', available: true },
            { text: 'Patient Portal Access (Live)', available: true },
            { text: 'Customized Letterheads', available: true },
            { text: 'Doctor Ledger Management', available: true },
          ],
          tokenConfig: {
            reportFinalization: 1,
            staffCreation: 20,
            dailyReport: 1,
            ledgerAction: 1
          },
          cta: 'Prepaid Tokens',
          popular: false,
          order: 3,
          maxUsers: 10
        }
      ];

      try {
        const querySnapshot = await getDocs(collection(db, 'plans'));
        const existingPlanIds = querySnapshot.docs.map(doc => doc.id);
        
        const batch = writeBatch(db);
        let needsSync = false;

        initialPlans.forEach(plan => {
          const docRef = doc(db, 'plans', plan.id);
          const existingPlan = querySnapshot.docs.find(d => d.id === plan.id);
          
          if (!existingPlan) {
            console.log(`Seeding missing plan: ${plan.id}`);
            batch.set(docRef, plan);
            needsSync = true;
          } else {
            // Check if features or basic info changed (simple string comparison for speed)
            const existingData = existingPlan.data();
            const hardcodedFeatures = JSON.stringify(plan.features);
            const savedFeatures = JSON.stringify(existingData.features);
            
            if (
              hardcodedFeatures !== savedFeatures || 
              plan.maxUsers !== (existingData.maxUsers || 0) ||
              JSON.stringify(plan.tokenConfig) !== JSON.stringify(existingData.tokenConfig)
            ) {
              console.log(`Syncing critical updates for plan: ${plan.id}`);
              batch.update(docRef, {
                features: plan.features,
                maxUsers: plan.maxUsers,
                tokenConfig: plan.tokenConfig || null,
                updatedAt: new Date()
              });
              needsSync = true;
            }
          }
        });

        if (needsSync) {
          await batch.commit();
          console.log("Plans synced successfully.");
        }
      } catch (err) {
        console.error("Error seeding plans:", err);
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
    
    // Ensure "Doctor Ledger Management" exists in the features list for editing
    const features = plan.features || [];
    const hasLedger = features.find(f => f.text === 'Doctor Ledger Management');
    
    if (!hasLedger) {
      features.push({ text: 'Doctor Ledger Management', available: false });
    }
    
    setEditData({ ...plan, features: [...features] });
  };

  const handleSave = async () => {
    if (!editData) return;
    setIsSaving(true);
    try {
      const planRef = doc(db, 'plans', editData.id);
      await updateDoc(planRef, {
        price: editData.price,
        period: editData.period || '/ month',
        description: editData.description,
        features: editData.features,
        popular: editData.popular,
        cta: editData.cta,
        maxUsers: parseInt(editData.maxUsers) || 0,
        tokenConfig: editData.tokenConfig || null
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

  const addFeature = () => {
    setEditData({
      ...editData,
      features: [...editData.features, { text: 'New Feature', available: true }]
    });
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
    <div className="space-y-4 p-4 pb-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl shadow-[0_20px_50px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-3">
        <div>
          <h1 className="text-lg font-black text-brand-dark tracking-tighter uppercase">
            Service <span className="text-brand-primary/80">Plans</span>
          </h1>
          <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-[0.4em] mt-0.5">Manage subscription tiers and feature availability.</p>
        </div>
        <div className="flex items-center gap-2 text-slate-400 font-bold text-[9px] uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 shadow-inner">
           <Zap className="w-3.5 h-3.5 text-brand-primary animate-pulse" />
           Live Firestore Management
        </div>
      </div>

      {/* Plans Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {plans.map((plan) => {
          const Icon = ICON_MAP[plan.iconName] || Shield;
          
          return (
            <div 
              key={plan.id} 
              className={`relative flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden border transition-all duration-500 hover:translate-y-[-5px] ${plan.popular ? 'border-brand-primary/30 ring-8 ring-brand-primary/5 shadow-brand-primary/10' : 'border-slate-100'}`}
            >
              {plan.popular && (
                <div className="absolute top-4 right-4 bg-brand-primary text-brand-dark text-[8px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full shadow-lg z-10">
                  Most Popular
                </div>
              )}
 
              {/* Edit Trigger */}
              <button 
                onClick={() => handleEdit(plan)}
                className="absolute top-4 left-4 p-1.5 bg-white/20 backdrop-blur-md rounded-xl border border-white/20 text-white hover:bg-white hover:text-brand-dark transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-20"
                style={{ opacity: 1 }} // Force visible for SuperAdmin
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
 
              {/* Plan Header */}
              <div className={`p-5 bg-gradient-to-br ${plan.color} text-white`}>
                <div className="flex items-center gap-3 mb-4 pt-3 lg:pt-0">
                  <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 ring-1 ring-white/20">
                    <Icon className={`w-5 h-5 ${plan.popular ? 'text-brand-primary' : 'text-slate-300'}`} />
                  </div>
                  <div>
                    <h2 className="text-base font-black uppercase tracking-tighter">{plan.name}</h2>
                    <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest">{plan.popular ? 'Maximum Power' : 'Essential Features'}</p>
                  </div>
                </div>
 
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black tracking-tighter">
                    {plan.price?.startsWith('₹') ? plan.price : `₹${plan.price}`}
                  </span>
                  <span className="text-xs font-bold text-white/40 uppercase tracking-widest">{plan.period}</span>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5 bg-white/10 w-fit px-2.5 py-0.5 rounded-md border border-white/10">
                   <Users className="w-2.5 h-2.5 text-white/70" />
                   <span className="text-[8.5px] font-black uppercase tracking-widest text-white/90">User Limit: {plan.maxUsers || 'N/A'} Users</span>
                </div>
                <p className="mt-2 text-white/60 font-medium leading-relaxed text-[10px] max-w-xs">{plan.description}</p>
              </div>
 
              {/* Features List */}
              <div className="p-4 flex-grow bg-white">
                <div className="space-y-3">
                  {plan.features.map((feature, fIdx) => (
                    <div key={fIdx} className={`flex items-center gap-2 ${feature.available ? 'opacity-100' : 'opacity-30'}`}>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${feature.available ? 'bg-brand-primary/10 text-brand-primary' : 'bg-slate-100 text-slate-400'}`}>
                        {feature.available ? <Check className="w-2.5 h-2.5" /> : <ArrowRight className="w-2.5 h-2.5 rotate-45" />}
                      </div>
                      <span className={`text-xs font-bold ${feature.available ? 'text-brand-dark' : 'text-slate-400 line-through'}`}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
 
              {/* Footer / CTA */}
              <div className="p-4 pt-0">
                 <div className={`w-full py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${plan.popular ? 'bg-brand-dark text-white border-brand-dark' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                    {plan.cta || 'Plan Details'}
                 </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {isEditing && editData && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-xl bg-gradient-to-br ${editData.color} text-white`}>
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-brand-dark uppercase tracking-tighter">Edit {editData.name} Plan</h3>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Updates will reflect for all users instantly.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditing(null)}
                className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all shadow-inner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Plan Price</label>
                  <div className="relative group/input">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-brand-primary pointer-events-none group-focus-within/input:scale-110 transition-transform">₹</span>
                    <input 
                      type="text" 
                      value={editData.price?.replace('₹', '')}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        setEditData({ ...editData, price: `₹${val}` });
                      }}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-brand-dark font-black focus:ring-4 focus:ring-brand-primary/10 accent-brand-primary outline-none transition-all text-xs"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Secondary Price Label (CTA)</label>
                  <input 
                    type="text" 
                    value={editData.cta}
                    onChange={(e) => setEditData({ ...editData, cta: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-brand-dark font-black focus:ring-4 focus:ring-brand-primary/10 accent-brand-primary outline-none text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Max Users Allowed</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-3.5 h-3.5 pointer-events-none" />
                    <input 
                      type="number" 
                      value={editData.maxUsers}
                      onChange={(e) => setEditData({ ...editData, maxUsers: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-brand-dark font-black focus:ring-4 focus:ring-brand-primary/10 accent-brand-primary outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Short Description</label>
                <textarea 
                  rows="2"
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-brand-dark font-bold focus:ring-4 focus:ring-brand-primary/10 accent-brand-primary outline-none text-xs"
                />
              </div>

              {/* Token Deduction Config (Only for Pay As You Go) */}
              {editData.id === 'pay_as_you_go' && editData.tokenConfig && (
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-100/50 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1 bg-amber-400 rounded text-white">
                      <Zap className="w-3 h-3" />
                    </div>
                    <label className="text-[9px] font-black text-brand-dark uppercase tracking-widest">Token Deduction Config</label>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(editData.tokenConfig).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </label>
                        <div className="relative">
                           <input 
                            type="number" 
                            value={value}
                            onChange={(e) => setEditData({
                              ...editData,
                              tokenConfig: {
                                ...editData.tokenConfig,
                                [key]: parseInt(e.target.value) || 0
                              }
                            })}
                            className="w-full px-3 py-1.5 bg-white border border-amber-100 rounded-lg text-brand-dark font-black focus:ring-4 focus:ring-amber-400/10 outline-none text-xs"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-amber-500 uppercase">Tokens</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plan Features (Active Toggles)</label>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={addFeature}
                      className="flex items-center gap-1.5 px-2 py-1 bg-brand-primary/10 text-brand-primary rounded-md text-[8.5px] font-black uppercase tracking-widest hover:bg-brand-primary hover:text-white transition-all border border-brand-primary/20"
                    >
                      <Plus className="w-2.5 h-2.5" /> Add Feature
                    </button>
                    <div className="flex items-center gap-2">
                      <input 
                         type="checkbox" 
                         checked={editData.popular}
                         onChange={(e) => setEditData({ ...editData, popular: e.target.checked })}
                         className="w-4 h-4 accent-brand-primary"
                      />
                      <span className="text-[8.5px] font-black text-brand-dark uppercase tracking-widest">Mark as Popular</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {editData.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 bg-slate-50 p-2 rounded-lg border border-slate-100 transition-all hover:border-brand-primary/20">
                      <button 
                        onClick={() => toggleFeature(idx)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${feature.available ? 'bg-brand-primary text-brand-dark shadow-md shadow-brand-primary/10' : 'bg-slate-200 text-slate-400'}`}
                      >
                        {feature.available ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      </button>
                      <input 
                        type="text" 
                        value={feature.text}
                        onChange={(e) => updateFeatureText(idx, e.target.value)}
                        className={`flex-grow bg-transparent border-none outline-none font-bold text-xs ${feature.available ? 'text-brand-dark' : 'text-slate-400 line-through'}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3.5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button 
                onClick={() => setIsEditing(null)}
                className="px-4 py-2 text-slate-400 text-[9px] font-black uppercase tracking-widest hover:text-brand-dark transition-all"
              >
                Discard Changes
              </button>
              <button 
                disabled={isSaving}
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-white rounded-lg text-[9px] font-black uppercase tracking-[0.3em] transition-all shadow-md shadow-brand-dark/10 hover:bg-brand-secondary active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
              >
                {isSaving ? <Zap className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-brand-primary" />}
                {isSaving ? 'Synchronizing...' : 'Save & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Future Roadmap / Notice */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white overflow-hidden relative group">
         <div className="absolute top-0 right-0 w-[250px] h-[250px] bg-brand-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-primary/20 transition-all"></div>
         
         <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="md:col-span-2">
               <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-brand-primary rounded-lg flex items-center justify-center shadow-md">
                     <Zap className="w-3.5 h-3.5 text-brand-dark" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-tighter">Enterprise & Hospital Custom Plans</h3>
               </div>
               <p className="text-white/50 font-medium leading-relaxed text-[10px]">
                  Large hospitals and diagnostic chains require bespoke configurations including HL7 integration, PACS connectivity, and white-label mobile apps. These are handled exclusively via direct consultation.
               </p>
            </div>
            <div className="flex justify-start md:justify-end">
               <button className="px-4 py-2 bg-white text-brand-dark rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-brand-primary hover:scale-105 transition-all shadow-xl">
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
