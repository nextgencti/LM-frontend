import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, doc, getDoc, setDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Settings, Plus, ArrowLeft, Trash2, Save, AlertCircle } from 'lucide-react';

const ParameterSettings = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [test, setTest] = useState(null);
  const [parameters, setParameters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeParam, setActiveParam] = useState(null);
  const [rules, setRules] = useState([]);

  useEffect(() => {
    if (testId) {
      fetchTestData();
      fetchParameters();
    }
  }, [testId]);

  const fetchTestData = async () => {
    const docRef = doc(db, 'tests', testId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      setTest({ id: docSnap.id, ...docSnap.data() });
    }
  };

  const fetchParameters = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'testParameters'), 
        where('testId', '==', testId),
        orderBy('order', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const items = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setParameters(items);
      if (items.length > 0 && !activeParam) {
        setActiveParam(items[0]);
      }
    } catch (error) {
      console.error('Error fetching parameters:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeParam) {
      fetchRules(activeParam.id);
    } else {
      setRules([]);
    }
  }, [activeParam]);

  const fetchRules = async (paramId) => {
    try {
      const q = query(collection(db, 'parameterRules'), where('parameterId', '==', paramId));
      const querySnapshot = await getDocs(q);
      const items = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setRules(items);
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  };

  const handleUpdateParam = (field, value) => {
    const updated = { ...activeParam, [field]: value };
    setActiveParam(updated);
    setParameters(parameters.map(p => p.id === updated.id ? updated : p));
  };

  const handleUpdateRule = (ruleId, field, value) => {
    setRules(rules.map(r => r.id === ruleId ? { ...r, [field]: value } : r));
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Delete this rule?')) return;
    try {
      setRules(rules.filter(r => r.id !== ruleId));
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const handleSave = async () => {
    if (!activeParam) return;
    setLoading(true);
    try {
      // 1. Update Parameter
      const paramRef = doc(db, 'testParameters', activeParam.id);
      const { id, ...paramData } = activeParam;
      await setDoc(paramRef, { ...paramData, updatedAt: serverTimestamp() }, { merge: true });

      // 2. Update/Add Rules
      for (const rule of rules) {
        const ruleRef = rule.id.toString().startsWith('new-') 
          ? doc(collection(db, 'parameterRules')) 
          : doc(db, 'parameterRules', rule.id);
        const { id: rid, ...ruleData } = rule;
        await setDoc(ruleRef, { ...ruleData, updatedAt: serverTimestamp() }, { merge: true });
      }
      
      alert('Settings saved successfully!');
      fetchParameters();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddParameter = async () => {
    if (!userData?.labId || !testId) return;
    const newParam = {
      testId,
      labId: userData.labId,
      name: 'New Parameter',
      unit: '',
      defaultRange: '',
      order: parameters.length + 1,
      createdAt: serverTimestamp()
    };
    try {
      const docRef = await addDoc(collection(db, 'testParameters'), newParam);
      const added = { id: docRef.id, ...newParam };
      setParameters([...parameters, added]);
      setActiveParam(added);
    } catch (error) {
      console.error('Error adding parameter:', error);
    }
  };

  const handleAddRule = () => {
    if (!activeParam) return;
    const newRule = {
      id: `new-${Date.now()}`,
      parameterId: activeParam.id,
      labId: userData.labId,
      gender: 'Both',
      ageMin: 0,
      ageMax: 100,
      ageUnit: 'Years',
      normalRange: '',
      criticalLow: '',
      criticalHigh: '',
    };
    setRules([...rules, newRule]);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 w-full animate-in fade-in duration-500">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] shadow-[0_20px_50px_rgb(0,0,0,0.02)] border border-slate-100">
        <div className="flex items-center gap-5">
          <button onClick={() => navigate('/tests')} className="p-4 bg-slate-50 hover:bg-brand-light text-slate-400 hover:text-brand-primary rounded-[22px] transition-all border border-slate-100 hover:border-brand-primary/20 shadow-sm active:scale-95">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-brand-dark tracking-tighter uppercase">{test?.testName || 'Test Configuration'}</h1>
            <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Configure parameters and dynamic reference ranges</p>
          </div>
        </div>
        <button onClick={handleAddParameter} className="flex items-center gap-2.5 px-8 py-4 bg-brand-dark text-white rounded-[20px] text-[13px] font-black uppercase tracking-[0.2em] hover:bg-brand-secondary transition-all shadow-xl shadow-brand-dark/10 active:scale-95 border border-white/10 group">
          <Plus className="w-4 h-4 text-brand-primary group-hover:rotate-90 transition-transform" />
          Add Parameter
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Parameters List */}
        <div className="bg-white rounded-[32px] shadow-[0_20px_60px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden h-fit">
          <div className="p-6 bg-brand-dark text-[12px] font-black text-white/70 uppercase tracking-[0.2em] border-b border-white/5">
            Test Parameters
          </div>
          <div className="divide-y divide-slate-50">
            {parameters.map(param => (
              <button
                key={param.id}
                onClick={() => setActiveParam(param)}
                className={`w-full text-left p-6 hover:bg-brand-light/30 transition-all flex justify-between items-center group ${activeParam?.id === param.id ? 'bg-brand-light/50 relative after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1 after:bg-brand-primary' : ''}`}
              >
                <div>
                  <div className={`text-sm font-black uppercase tracking-tight transition-colors ${activeParam?.id === param.id ? 'text-brand-dark' : 'text-slate-600 group-hover:text-brand-dark'}`}>{param.name}</div>
                  <div className={`text-[12px] font-black uppercase tracking-widest mt-1 ${activeParam?.id === param.id ? 'text-brand-primary' : 'text-slate-300'}`}>{param.unit || 'NULL_UNIT'}</div>
                </div>
                {activeParam?.id === param.id && (
                  <div className="w-2 h-2 bg-brand-primary rounded-full animate-pulse shadow-sm shadow-brand-primary/30"></div>
                )}
              </button>
            ))}
            {parameters.length === 0 && !loading && (
              <div className="p-12 text-center">
                <Settings className="w-10 h-10 text-slate-100 mx-auto mb-4" />
                <p className="text-[12px] font-black text-slate-300 uppercase tracking-widest">No nodes defined</p>
              </div>
            )}
          </div>
        </div>

        {/* Parameter Rules Configuration */}
        <div className="md:col-span-2 space-y-6">
          {activeParam ? (
            <>
              {/* Parameter Basic Settings */}
              <div className="bg-white rounded-[32px] shadow-[0_20px_60px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
                <div className="flex items-center gap-4 mb-8">
                   <div className="p-3 bg-brand-light rounded-2xl border border-brand-primary/10">
                      <Settings className="w-5 h-5 text-brand-primary" />
                   </div>
                   <div>
                      <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight">Parameter Settings</h3>
                      <p className="text-[12px] font-black text-slate-300 uppercase tracking-widest mt-0.5">{activeParam.name}</p>
                   </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <Label>Display Name</Label>
                    <Input 
                      type="text" 
                      value={activeParam.name} 
                      onChange={(e) => handleUpdateParam('name', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Input 
                      type="text" 
                      value={activeParam.unit || ''} 
                      onChange={(e) => handleUpdateParam('unit', e.target.value)}
                      placeholder="e.g. mg/dL" 
                    />
                  </div>
                  <div>
                    <Label>Default Range</Label>
                    <Input 
                      type="text" 
                      value={activeParam.defaultRange || ''} 
                      onChange={(e) => handleUpdateParam('defaultRange', e.target.value)}
                      placeholder="e.g. 70 - 110" 
                    />
                  </div>
                </div>
              </div>

              {/* Reference Range Rules */}
              <div className="bg-white rounded-[32px] shadow-[0_20px_60px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden">
                <div className="px-8 py-6 bg-slate-50 flex justify-between items-center border-b border-slate-100">
                  <div className="flex flex-col">
                     <span className="text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Reference Ranges</span>
                     <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Define ranges based on age and gender</span>
                  </div>
                  <button onClick={handleAddRule} className="px-5 py-2.5 bg-brand-light text-brand-dark rounded-xl text-[12px] font-black uppercase tracking-widest hover:bg-brand-primary hover:text-white transition-all shadow-sm border border-brand-primary/10 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add Rule
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-brand-dark">
                      <tr>
                        <th className="px-8 py-5 text-[12px] font-black text-white/70 uppercase tracking-widest">Gender</th>
                        <th className="px-8 py-5 text-[12px] font-black text-white/70 uppercase tracking-widest">Age Range</th>
                        <th className="px-8 py-5 text-[12px] font-black text-white/70 uppercase tracking-widest text-center">Normal Range</th>
                        <th className="px-8 py-5 text-[12px] font-black text-white/70 uppercase tracking-widest text-center">Critical Range</th>
                        <th className="px-8 py-5 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                      {rules.map(rule => (
                        <tr key={rule.id} className="group hover:bg-brand-light/10 transition-colors">
                          <td className="px-8 py-5">
                            <Select 
                              value={rule.gender} 
                              onChange={(e) => handleUpdateRule(rule.id, 'gender', e.target.value)}
                              className="px-3 py-1.5 rounded-xl border border-slate-100 text-[12px] font-black bg-white"
                            >
                              <option>Both</option>
                              <option>Male</option>
                              <option>Female</option>
                            </Select>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                value={rule.ageMin} 
                                onChange={(e) => handleUpdateRule(rule.id, 'ageMin', parseInt(e.target.value))}
                                className="w-14 px-2 py-1.5 bg-white border border-slate-100 rounded-lg text-xs font-black text-brand-dark text-center shadow-inner" 
                              />
                              <span className="text-slate-300 font-bold">-</span>
                              <input 
                                type="number" 
                                value={rule.ageMax} 
                                onChange={(e) => handleUpdateRule(rule.id, 'ageMax', parseInt(e.target.value))}
                                className="w-14 px-2 py-1.5 bg-white border border-slate-100 rounded-lg text-xs font-black text-brand-dark text-center shadow-inner" 
                              />
                              <Select 
                                value={rule.ageUnit} 
                                onChange={(e) => handleUpdateRule(rule.id, 'ageUnit', e.target.value)}
                                className="px-2 py-1.5 rounded-lg border border-slate-100 text-[12px] font-black w-fit bg-white"
                              >
                                <option>Years</option>
                                <option>Months</option>
                                <option>Days</option>
                              </Select>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <input 
                              type="text" 
                              value={rule.normalRange || ''} 
                              onChange={(e) => handleUpdateRule(rule.id, 'normalRange', e.target.value)}
                              placeholder="0 - 10" 
                              className="w-full max-w-[120px] mx-auto px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs font-black text-brand-primary shadow-inner text-center block" 
                            />
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center justify-center gap-3">
                              <input 
                                type="text" 
                                value={rule.criticalLow || ''} 
                                onChange={(e) => handleUpdateRule(rule.id, 'criticalLow', e.target.value)}
                                placeholder="Low" 
                                className="w-16 px-3 py-2 bg-white border border-rose-100 rounded-xl text-xs font-black text-rose-500 shadow-inner text-center" 
                              />
                              <div className="w-1.5 h-px bg-slate-200"></div>
                              <input 
                                type="text" 
                                value={rule.criticalHigh || ''} 
                                onChange={(e) => handleUpdateRule(rule.id, 'criticalHigh', e.target.value)}
                                placeholder="High" 
                                className="w-16 px-3 py-2 bg-white border border-rose-200 rounded-xl text-xs font-black text-rose-700 shadow-inner text-center" 
                              />
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <button onClick={() => handleDeleteRule(rule.id)} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {rules.length === 0 && (
                        <tr>
                          <td colSpan="5" className="p-16 text-center">
                            <div className="text-[12px] font-black text-slate-300 uppercase tracking-[0.3em]">No custom rule schemas defined</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end items-center gap-6">
                   <button 
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-3 px-12 py-4 bg-brand-primary text-white rounded-[20px] text-[13px] font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-brand-primary/20 disabled:opacity-50 active:scale-95 border border-white/10 group"
                   >
                     {loading ? <Loader className="w-4 h-4 animate-spin"/> : <><Save className="w-4 h-4 group-hover:scale-125 transition-transform" /> Save All Settings</>}
                   </button>
                </div>
              </div>

              <div className="bg-brand-light/30 border border-brand-primary/20 rounded-[28px] p-8 flex items-start shadow-sm shadow-brand-primary/5">
                <AlertCircle className="w-8 h-8 text-brand-primary mr-5 shrink-0" />
                <div className="text-brand-dark">
                  <p className="text-sm font-black uppercase tracking-[0.2em]">Automatic Validation</p>
                  <p className="text-[12px] mt-2 font-black text-slate-400 uppercase tracking-widest leading-loose">The system will automatically highlight values based on these rules during result entry.</p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-[40px] shadow-[0_32px_128px_rgba(0,0,0,0.02)] border border-slate-100 p-24 text-center">
              <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mx-auto mb-10 shadow-inner border border-slate-100">
                <Settings className="w-10 h-10 text-slate-200 animate-spin-slow" />
              </div>
              <p className="text-2xl font-black text-brand-dark/30 tracking-widest uppercase">No Parameter Selected</p>
              <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] mt-6">Select a parameter from the list to start configuration.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Primitives for Parameter Settings ───────────────────────────────────────────── */
const Label = ({ children }) => (
  <label className="block text-[12px] font-black text-slate-400 mb-2.5 uppercase tracking-[0.2em] ml-2">{children}</label>
);
const Input = ({ className = '', ...props }) => (
  <input
    className={`w-full px-5 py-3.5 bg-slate-50/50 border border-slate-100 rounded-[22px] text-sm font-black text-brand-dark outline-none focus:border-brand-primary/30 focus:ring-4 focus:ring-brand-primary/10 transition-all placeholder:text-slate-300 shadow-inner ${className}`}
    {...props}
  />
);
const Select = ({ className = '', children, ...props }) => (
  <select
    className={`w-full px-4 py-2 bg-white border border-slate-100 rounded-xl text-[12px] font-black text-brand-dark outline-none focus:border-brand-primary/30 focus:ring-2 focus:ring-brand-primary/10 transition-all appearance-none cursor-pointer shadow-sm ${className}`}
    {...props}
  >
    {children}
  </select>
);
const SectionTag = ({ color = 'blue', children }) => {
  const colors = {
    blue: 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20 shadow-brand-secondary/5',
    purple: 'bg-brand-dark text-white border-brand-dark shadow-brand-dark/10',
    green: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20 shadow-brand-primary/5',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 shadow-amber-500/5',
  };
  return (
    <div className="flex items-center gap-5 mb-10">
      <span className={`text-[12px] font-black px-6 py-2 rounded-full uppercase tracking-[0.2em] border shadow-sm ${colors[color]}`}>{children}</span>
      <div className="h-px bg-slate-100 flex-grow" />
    </div>
  );
};

export default ParameterSettings;
