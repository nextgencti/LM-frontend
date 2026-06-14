import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, where, setDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Search, Plus, Loader, Database, FileText, Settings, Trash2, Edit3, ChevronRight, FlaskConical, Beaker, Activity, Save, X, Globe, User, Clock, IndianRupee, CheckCircle, ChevronDown, Download, Upload, Layers, FolderPlus, Folder, Zap } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';


/* ─── Tiny reusable primitives ───────────────────────────────────────────── */
const Label = ({ children }) => (
  <label className="block text-[10px] font-bold text-gray-500 mb-0.5 uppercase tracking-wide">{children}</label>
);
const Input = ({ className = '', ...props }) => (
  <input
    className={`w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-800 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-50 transition-all placeholder:text-gray-300 ${className}`}
    {...props}
  />
);
const Select = ({ className = '', children, ...props }) => (
  <select
    className={`w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-800 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-50 transition-all appearance-none cursor-pointer ${className}`}
    {...props}
  >
    {children}
  </select>
);
const SectionTag = ({ color = 'red', children }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  };
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className={`text-[10px] font-bold px-3 py-1 rounded-lg uppercase tracking-widest border ${colors[color]}`}>{children}</span>
      <div className="h-px bg-gray-100 flex-grow" />
    </div>
  );
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const GlobalTestCatalog = () => {
  const { currentUser } = useAuth();
  const [tests, setTests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [syncToLabs, setSyncToLabs] = useState(false);

  
  // Library State
  const [masterParams, setMasterParams] = useState([]);
  const [fetchingParams, setFetchingParams] = useState(false);
  const [paramSearch, setParamSearch] = useState('');
  const [showParamLibraryMenu, setShowParamLibraryMenu] = useState(false);
  const paramSearchInputRef = React.useRef(null);
  
  // Test Form State (Aligned with Lab Project)
  const [testForm, setTestForm] = useState({
    testCode: '', testName: '', category: 'Hematology',
    sampleType: 'Whole Blood (EDTA)', methodology: '',
    tatHours: '24 hrs', price: 0, groups: [],
    reportLayout: 'Standard',
  });

  const [isOtherMethodology, setIsOtherMethodology] = useState(false);

  const [groupNameInput, setGroupNameInput] = useState('');
  const [paramInput, setParamInput] = useState({ code: '', name: '', unit: '', dataType: 'Quantitative', decimals: 2 });
  const [ruleInput,  setRuleInput]  = useState({ gender: 'Any', ageMin: 0, ageMax: 120, ageUnit: 'Years', normalRange: '', criticalLow: '', criticalHigh: '' });
  
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(-1);
  const [selectedParamIndex, setSelectedParamIndex] = useState(-1);
  const [selectedRuleIndex,  setSelectedRuleIndex]  = useState(-1);
  
  const [originalParamData, setOriginalParamData] = useState(null);
  const [originalRuleData, setOriginalRuleData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTests();
    fetchMasterParams();
  }, []);

  const fetchMasterParams = async () => {
    setFetchingParams(true);
    try {
      const q = query(collection(db, 'masterParameters'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      setMasterParams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error("Error fetching master params:", err); }
    finally { setFetchingParams(false); }
  };

  const fetchTests = async () => {
    setLoading(true);
    try {
      // Removed orderBy to avoid indexing requirement. Sorting in memory instead.
      const q = query(collection(db, 'tests'), where('labId', '==', 'GLOBAL'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTests(data.sort((a, b) => (a.testName || '').localeCompare(b.testName || '')));
    } catch (err) {
      console.error("[DEBUG] Fetch tests via Firestore failed:", err);
      alert("Error loading tests: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getParamCount = (test) =>
    test.groups?.length
      ? test.groups.reduce((s, g) => s + (g.parameters?.length || 0), 0)
      : test.parameters?.length || 0;

  // ── Handlers (Groups, Parameters, Rules) ──────────────────────────────────
  const resetForm = () => {
    setTestForm({ testCode:'',testName:'',category:'Hematology',sampleType:'Whole Blood (EDTA)',methodology:'',tatHours:'24 hrs',price:0,groups:[], reportLayout: 'Standard' });
    setIsOtherMethodology(false);
    setGroupNameInput(''); 
    setSelectedGroupIndex(-1); 
    setSelectedParamIndex(-1); 
    setSelectedRuleIndex(-1);
    setOriginalParamData(null);
    setOriginalRuleData(null);
    setSyncToLabs(false);
  };


  const handleAddGroup = () => {
    if (!groupNameInput.trim()) return alert('Group name required');
    setTestForm(p => ({ ...p, groups: [...p.groups, { name: groupNameInput.trim(), parameters: [] }] }));
    setSelectedGroupIndex(testForm.groups.length);
    setSelectedParamIndex(-1); 
    setSelectedRuleIndex(-1); 
    setGroupNameInput('');
  };

  const handleDeleteGroup = (gi) => {
    if (!window.confirm(`Delete group "${testForm.groups[gi].name}"?`)) return;
    setTestForm(p => ({ ...p, groups: p.groups.filter((_,i)=>i!==gi) }));
    if (selectedGroupIndex===gi){ setSelectedGroupIndex(-1); setSelectedParamIndex(-1); setSelectedRuleIndex(-1); }
    else if (selectedGroupIndex>gi) setSelectedGroupIndex(p=>p-1);
  };

  const handleAddParameter = () => {
    if (selectedGroupIndex === -1) return alert('Select a group first');
    if (!paramInput.name) return alert('Parameter name required');
    const newParam = { ...paramInput, rules: [] };
    setTestForm(p => ({
      ...p,
      groups: p.groups.map((g, i) => i === selectedGroupIndex ? { ...g, parameters: [...g.parameters, newParam] } : g)
    }));
    setParamInput({ code: '', name: '', unit: '', dataType: 'Quantitative', decimals: 2 });
    setParamSearch('');
  };

  const handleSelectMasterParam = (p) => {
    if (selectedGroupIndex === -1) return alert('Please select a parameter group first.');
    
    // Check for duplicates in the current group
    if (testForm.groups[selectedGroupIndex].parameters.some(param => param.code === p.code)) {
      return alert(`"${p.name}" is already present in this group.`);
    }

    const newParam = {
      code: p.code || '',
      name: p.name || '',
      unit: p.unit || '',
      dataType: p.dataType || 'Quantitative',
      decimals: p.decimals || 0,
      allowedOptions: p.allowedOptions || '',
      rules: p.rules || [] // Copy all master rules immediately
    };

    setTestForm(prev => ({
      ...prev,
      groups: prev.groups.map((g, i) => i === selectedGroupIndex ? { ...g, parameters: [...g.parameters, newParam] } : g)
    }));

    setParamSearch('');
    // Keep menu open for rapid adding
    setShowParamLibraryMenu(true);
    // Restore focus to input for next search
    setTimeout(() => paramSearchInputRef.current?.focus(), 10);
    
    setParamInput({ code: '', name: '', unit: '', dataType: 'Quantitative', decimals: 2 });
  };

  const handleUpdateParameter = () => {
    if (selectedGroupIndex === -1 || selectedParamIndex === -1) return;
    setTestForm(p => ({
      ...p,
      groups: p.groups.map((g, gi) => gi !== selectedGroupIndex ? g : {
        ...g,
        parameters: g.parameters.map((pm, pi) => pi !== selectedParamIndex ? pm : { ...pm, ...paramInput })
      })
    }));
    setOriginalParamData({ ...paramInput });
  };

  const handleClearParameter = () => {
    setSelectedParamIndex(-1);
    setSelectedRuleIndex(-1);
    setParamInput({ code: '', name: '', unit: '', dataType: 'Quantitative', decimals: 2 });
    setOriginalParamData(null);
  };

  const handleDeleteParameter = (pi) => {
    if (selectedGroupIndex===-1) return;
    setTestForm(p => ({
      ...p,
      groups: p.groups.map((g, gi) => gi !== selectedGroupIndex ? g : { ...g, parameters: g.parameters.filter((_, idx) => idx !== pi) })
    }));
    handleClearParameter();
  };

  const handleAddRule = () => {
    if (selectedGroupIndex === -1 || selectedParamIndex === -1) return alert('Select a parameter first');
    if (!ruleInput.normalRange) return alert('Normal range required');
    setTestForm(p => ({
      ...p,
      groups: p.groups.map((g, gi) => gi !== selectedGroupIndex ? g : {
        ...g,
        parameters: g.parameters.map((pm, pi) => pi !== selectedParamIndex ? pm : { ...pm, rules: [...pm.rules, ruleInput] })
      })
    }));
    setRuleInput({ gender: 'Any', ageMin: 0, ageMax: 120, ageUnit: 'Years', normalRange: '', criticalLow: '', criticalHigh: '' });
  };

  const handleUpdateRule = () => {
    if (selectedGroupIndex === -1 || selectedParamIndex === -1 || selectedRuleIndex === -1) return;
    setTestForm(p => ({
      ...p,
      groups: p.groups.map((g, gi) => gi !== selectedGroupIndex ? g : {
        ...g,
        parameters: g.parameters.map((pm, pi) => pi !== selectedParamIndex ? pm : {
          ...pm,
          rules: pm.rules.map((r, ri) => ri !== selectedRuleIndex ? r : { ...ruleInput })
        })
      })
    }));
    setOriginalRuleData({ ...ruleInput });
  };

  const handleClearRule = () => {
    setSelectedRuleIndex(-1);
    setRuleInput({ gender: 'Any', ageMin: 0, ageMax: 120, ageUnit: 'Years', normalRange: '', criticalLow: '', criticalHigh: '' });
    setOriginalRuleData(null);
  };

  const handleDeleteRule = (ri) => {
    if (selectedGroupIndex === -1 || selectedParamIndex === -1) return;
    setTestForm(p => ({
      ...p,
      groups: p.groups.map((g, gi) => gi !== selectedGroupIndex ? g : {
        ...g,
        parameters: g.parameters.map((pm, pi) => pi !== selectedParamIndex ? pm : { ...pm, rules: pm.rules.filter((_, idx) => idx !== ri) })
      })
    }));
    handleClearRule();
  };

  const hasParamChanged = () => originalParamData && JSON.stringify(paramInput) !== JSON.stringify(originalParamData);
  const hasRuleChanged = () => originalRuleData && JSON.stringify(ruleInput) !== JSON.stringify(originalRuleData);

  const handleDeleteTest = async (testId) => {
    if (!testId) return;
    
    setDeletingId(testId);
    try {
      await deleteDoc(doc(db, 'tests', testId));
      setConfirmDeleteId(null);
      fetchTests();
    } catch (err) { 
      toast.error("Delete failed: " + err.message); 
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveAll = async () => {
    if (!testForm.testName || !testForm.testCode) return alert("Required fields missing");
    setSaving(true);
    try {
      const payload = {
        ...testForm,
        labId: 'GLOBAL',
        isGlobal: true,
        syncToLabs: syncToLabs,
        groups: testForm.groups.map((g, gi) => ({
          ...g,
          parameters: g.parameters.map((p, pi) => ({ ...p }))
        }))
      };

      const token = await currentUser.getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/tests/global`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save global test");
      }

      toast.success(testForm.id ? "Master test updated" : "Master test published");
      if (syncToLabs) toast.info("Sync initiated for all labs");

      setShowAddModal(false); 
      fetchTests(); 
      resetForm();
    } catch (err) { 
      console.error("Save failed:", err);
      toast.error("Save failed: " + err.message); 
    } finally { 
      setSaving(false); 
    }
  };



  return (
    <div className="p-3 md:p-5 max-w-7xl mx-auto space-y-4 animate-in fade-in duration-500">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="p-1.5 bg-red-600 rounded-xl shadow-md shadow-red-200">
              <Database className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-black text-gray-900 tracking-tight">Master Catalog</h1>
          </div>
          <p className="text-gray-400 font-medium text-[10px] flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-red-400" /> Standardized Global Diagnostic Definitions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-red-500 transition-colors" />
            <input 
              type="text"
              placeholder="Search tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold uppercase tracking-widest outline-none focus:bg-white focus:border-red-400 focus:ring-4 focus:ring-red-50 transition-all w-48"
            />
          </div>
          <button onClick={() => { resetForm(); setShowAddModal(true); }} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-md shadow-red-100">
            <Plus className="w-3 h-3" /> New Master Test
          </button>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-2">
            <Loader className="w-6 h-6 animate-spin text-red-500" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Warming up catalog…</p>
          </div>
        ) : tests.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Beaker className="w-12 h-12 text-gray-100 mx-auto" />
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">No master tests defined</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-3 py-2 md:px-5 md:py-2.5">Diagnostic Test</th>
                  <th className="px-3 py-2 md:px-5 md:py-2.5">Code / Sample</th>
                  <th className="px-3 py-2 md:px-5 md:py-2.5">Configuration</th>
                  <th className="px-3 py-2 md:px-5 md:py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {tests
                  .filter(t => 
                    !searchQuery || 
                    (t.testName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (t.testCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (t.category || '').toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(test => (
                    <tr key={test.id} className="group hover:bg-gray-50/50 transition-colors">
                    <td className="px-3 py-2 md:px-5 md:py-2.5">
                      <div className="font-bold text-gray-900 text-xs">{test.testName}</div>
                      <div className="text-[10px] text-gray-400 font-medium mt-0.5">{test.category} · {test.methodology || 'No Method'}</div>
                    </td>
                    <td className="px-3 py-2 md:px-5 md:py-2.5">
                      <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded-md text-[8.5px] font-black border border-red-100 uppercase tracking-wider">{test.testCode}</span>
                      <div className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-tighter">{test.sampleType}</div>
                    </td>
                    <td className="px-3 py-2 md:px-5 md:py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100">
                          <span className="text-xs font-black text-gray-700">{getParamCount(test)}</span>
                        </div>
                        <div>
                          <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Parameters</div>
                          <div className="text-[10px] font-bold text-gray-900 mt-0.5">{test.groups?.length || 0} Groups</div>
                        </div>
                      </div>
                      <span className={`mt-1 inline-flex items-center px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${test.reportLayout === 'Tabular table' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                        {test.reportLayout === 'Tabular table' ? 'Tabular' : 'Standard'}
                      </span>
                    </td>
                    <td className="px-3 py-2 md:px-5 md:py-2.5 text-right">
                        {confirmDeleteId === test.id ? (
                          <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-100 justify-end animate-in fade-in slide-in-from-right-2 duration-200">
                            <button 
                              onClick={() => handleDeleteTest(test.id)} 
                              disabled={deletingId === test.id}
                              className="px-2 py-1 bg-red-600 text-white text-[8.5px] font-black uppercase rounded hover:bg-red-700 transition-colors shadow-sm"
                            >
                              {deletingId === test.id ? <Loader className="w-2.5 h-2.5 animate-spin mx-1" /> : "Confirm Delete"}
                            </button>
                            <button 
                              onClick={() => setConfirmDeleteId(null)} 
                              className="p-1 text-gray-400 hover:text-gray-600 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5 transition-all">
                            <button 
                              onClick={() => { setTestForm({...test, groups: test.groups || []}); setShowAddModal(true); }} 
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Test"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => setConfirmDeleteId(test.id)} 
                              disabled={deletingId === test.id}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Delete Test"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-5xl my-4 flex flex-col overflow-hidden text-left animate-in zoom-in-95 duration-200">

            {/* Modal Header */}
            <div className="flex justify-between items-center px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-red-50 rounded-xl border border-red-100">
                  <Database className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-900">{testForm.id ? 'Edit Master Definition' : 'Define Master Test'}</h2>
                  <p className="text-[8.5px] text-gray-400 font-bold uppercase tracking-[0.2em]">{testForm.testName || 'New Configuration'}</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 overflow-y-auto flex-grow max-h-[80vh] custom-scrollbar">

              {/* ── 1. Details ── */}
              <section>
                <SectionTag color="red">1. Test Details</SectionTag>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label>Test Code *</Label>
                    <Input placeholder="CBC001" value={testForm.testCode} onChange={e => setTestForm({...testForm, testCode: e.target.value.toUpperCase()})} className="font-mono text-red-700 font-bold"/>
                  </div>
                  <div className="col-span-2">
                    <Label>Test Name *</Label>
                    <Input placeholder="Full Diagnostic Name" value={testForm.testName} onChange={e => setTestForm({...testForm, testName: e.target.value})}/>
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={testForm.category} onChange={e => setTestForm({...testForm, category: e.target.value})}>
                      {['Hematology','Biochemistry','Immunology','Microbiology','Serology','Histopathology','Cytology'].map(c=><option key={c}>{c}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>Sample</Label>
                    <Select value={testForm.sampleType} onChange={e => setTestForm({...testForm, sampleType: e.target.value})}>
                      {['Whole Blood (EDTA)','Serum','Plasma','Urine','Stool','Sputum','CSF','Swab','Biopsy'].map(s=><option key={s}>{s}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>Methodology</Label>
                    {(isOtherMethodology || (testForm.methodology && !['Automated', 'Semi-Automated', 'Manual', 'Slide Agglutination', 'ELISA', 'HPLC', 'CLIA', 'Nephelometry', 'PCR', 'Microscopy', 'Culture', 'Rapid Test', ''].includes(testForm.methodology))) ? (
                      <div className="relative group">
                        <Input 
                          placeholder="Type Custom Methodology..." 
                          value={testForm.methodology} 
                          onChange={e => setTestForm({...testForm, methodology: e.target.value})}
                          className="pr-8"
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            setIsOtherMethodology(false);
                            setTestForm({...testForm, methodology: ''});
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <Select value={testForm.methodology} onChange={e => {
                        if (e.target.value === 'Other') {
                          setIsOtherMethodology(true);
                          setTestForm({...testForm, methodology: ''});
                        } else {
                          setTestForm({...testForm, methodology: e.target.value});
                        }
                      }}>
                        <option value="">Select Method</option>
                        {['Automated', 'Semi-Automated', 'Manual', 'Slide Agglutination', 'ELISA', 'HPLC', 'CLIA', 'Nephelometry', 'PCR', 'Microscopy', 'Culture', 'Rapid Test'].map(m=><option key={m}>{m}</option>)}
                        <option value="Other">Other / Add New</option>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label>TAT</Label>
                    <Input placeholder="24 Hrs" value={testForm.tatHours} onChange={e => setTestForm({...testForm, tatHours: e.target.value})}/>
                  </div>
                  <div>
                    <Label>Price (₹) *</Label>
                    <Input type="number" value={testForm.price} onChange={e => setTestForm({...testForm, price: parseFloat(e.target.value)})} className="text-red-700 font-black"/>
                  </div>
                  <div>
                    <Label>Report Layout</Label>
                    <Select value={testForm.reportLayout || 'Standard'} onChange={e => setTestForm({...testForm, reportLayout: e.target.value})}>
                      <option value="Standard">Standard (List)</option>
                      <option value="Tabular table">Tabular table (Grid)</option>
                    </Select>
                  </div>
                </div>
              </section>

              {/* ── 2. Groups ── */}
              <section>
                <SectionTag color="blue">2. Parameter Groups</SectionTag>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input placeholder="Add logical group (e.g. Red Cell Indices, Liver Profile)" value={groupNameInput} onChange={e => setGroupNameInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddGroup()}/>
                    <button onClick={handleAddGroup} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 hover:bg-blue-700 transition-all shadow-md shadow-blue-50">
                      <FolderPlus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {testForm.groups.map((group, idx) => (
                      <div key={idx} onClick={() => { setSelectedGroupIndex(idx); setSelectedParamIndex(-1); }}
                        className={`px-3 py-1.5 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs transition-all ${selectedGroupIndex === idx ? 'bg-blue-600 border-blue-600 text-white shadow-lg translate-y-[-1px]' : 'bg-white border-gray-100 text-gray-500 hover:border-blue-200'}`}>
                        <div className="flex items-center gap-2">
                          <Folder className={`w-3.5 h-3.5 ${selectedGroupIndex === idx ? 'text-blue-100' : 'text-blue-400'}`} />
                          <span className="text-xs font-bold tracking-tight">{group.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${selectedGroupIndex === idx ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{group.parameters.length}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(idx); }} className={`p-0.5 rounded transition-colors ${selectedGroupIndex === idx ? 'hover:bg-blue-500 text-blue-100' : 'hover:bg-red-100 text-gray-300 hover:text-red-600'}`}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── Parameters & Rules Grid ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ── 3. Params ── */}
                <section>
                  <SectionTag color="purple">3. Parameters {selectedGroupIndex >= 0 && `(${testForm.groups[selectedGroupIndex].name})`}</SectionTag>
                  {selectedGroupIndex === -1 ? (
                    <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                      <Layers className="w-6 h-6 text-gray-100 mx-auto mb-2" />
                      <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Select group to manage parameters</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Searchable Library Selection */}
                      <div className="relative">
                        <Label>Search & Select from Parameter Library</Label>
                        <div className="relative group">
                          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-300 group-focus-within:text-red-400 transition-colors" />
                          <Input 
                            ref={paramSearchInputRef}
                            placeholder="Type to search or click to view all..." 
                            value={paramSearch} 
                            onChange={e => setParamSearch(e.target.value)}
                            onFocus={() => setShowParamLibraryMenu(true)}
                            className="pl-8"
                          />
                        </div>
                        {showParamLibraryMenu && (
                          <div className="absolute z-[300] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto overflow-x-hidden custom-scrollbar divide-y divide-gray-50 border-t-0 p-1">
                            {/* Option to close the menu if clicked outside or no selection made */}
                            <div className="absolute top-0 right-0 p-1 z-[310]">
                               <button onClick={() => setShowParamLibraryMenu(false)} className="p-0.5 hover:bg-gray-100 rounded text-gray-400">
                                 <X className="w-3 h-3" />
                               </button>
                            </div>

                            {masterParams
                              .filter(p => {
                                if (!paramSearch) return true; // Show all if no search string
                                return p.name?.toLowerCase().includes(paramSearch.toLowerCase()) || 
                                       p.code?.toLowerCase().includes(paramSearch.toLowerCase());
                               })
                              .slice(0, 50).map(p => (
                                <button key={p.id} 
                                  onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent onBlur from hiding list before click
                                    handleSelectMasterParam(p);
                                  }} 
                                  className="w-full text-left px-3 py-1.5 hover:bg-red-50 transition-colors flex items-center justify-between group">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-gray-800 group-hover:text-red-700">{p.name}</span>
                                    <span className="text-[8.5px] text-gray-400 font-bold uppercase tracking-widest">{p.code} · {p.unit || 'No unit'}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[8px] font-black text-gray-300 uppercase px-1.5 py-0.5 border border-gray-100 rounded-md">{p.dataType}</span>
                                    <Plus className="w-3 h-3 text-gray-200 group-hover:text-red-400" />
                                  </div>
                                </button>
                              ))}
                            {masterParams.length > 0 && masterParams.filter(p => 
                                !paramSearch || p.name?.toLowerCase().includes(paramSearch.toLowerCase()) || 
                                p.code?.toLowerCase().includes(paramSearch.toLowerCase())
                              ).length === 0 && (
                              <div className="p-3 text-center text-xs font-bold text-gray-300 uppercase tracking-widest">No match found in library</div>
                            )}
                            {masterParams.length === 0 && (
                              <div className="p-3 text-center text-xs font-bold text-gray-300 uppercase tracking-widest">Library is empty</div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="h-px bg-gray-50 mx-[-16px]" />

                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <Label>Parameter Name *</Label>
                          <Input placeholder="e.g. Hemoglobin" value={paramInput.name} onChange={e => setParamInput({...paramInput, name: e.target.value})}/>
                        </div>
                        <div>
                          <Label>Code</Label>
                          <Input placeholder="HGB" value={paramInput.code} onChange={e => setParamInput({...paramInput, code: e.target.value.toUpperCase()})} className="font-mono text-xs uppercase"/>
                        </div>
                        <div>
                          <Label>Unit</Label>
                          <Input placeholder="g/dL" value={paramInput.unit} onChange={e => setParamInput({...paramInput, unit: e.target.value})}/>
                        </div>
                        <div>
                          <Label>Type</Label>
                          <Select value={paramInput.dataType} onChange={e => setParamInput({...paramInput, dataType: e.target.value})}>
                            <option value="Quantitative">Quantitative</option>
                            <option value="Qualitative">Qualitative</option>
                            <option value="Semi-Quantitative">Semi-Quantitative</option>
                            <option value="Titer">Titer</option>
                            <option value="Calculated">Calculated</option>
                          </Select>
                        </div>
                        <div>
                          <Label>Decimals</Label>
                          <Input type="number" value={paramInput.decimals} onChange={e => setParamInput({...paramInput, decimals: parseInt(e.target.value)})}/>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {selectedParamIndex === -1 ? (
                          <button onClick={handleAddParameter} className="flex-grow py-1.5 bg-purple-600 text-white rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 hover:bg-purple-700 shadow-md shadow-purple-50">
                            <Plus className="w-3.5 h-3.5" /> Add Parameter
                          </button>
                        ) : (
                          <>
                            <button onClick={handleUpdateParameter} disabled={!hasParamChanged()} className="flex-grow py-1.5 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 hover:bg-blue-700 disabled:opacity-30 shadow-md shadow-blue-50">
                              <Save className="w-3.5 h-3.5" /> Update
                            </button>
                            <button onClick={handleClearParameter} className="px-3.5 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-[9px] font-black uppercase hover:bg-gray-200">Clear</button>
                          </>
                        )}
                      </div>
                      <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50 bg-white shadow-inner custom-scrollbar">
                        {testForm.groups[selectedGroupIndex].parameters.map((p, idx) => (
                          <div key={idx} onClick={() => { setSelectedParamIndex(idx); setSelectedRuleIndex(-1); setParamInput({...p}); setOriginalParamData({...p}); setOriginalRuleData(null); }}
                            className={`px-3 py-2 flex items-center justify-between cursor-pointer group text-xs transition-all ${selectedParamIndex === idx ? 'bg-purple-50 border-l-4 border-purple-500' : 'hover:bg-gray-50/50'}`}>
                            <div>
                              <div className="font-bold text-gray-900 leading-tight">{p.name}</div>
                              <div className="text-[8.5px] font-bold text-gray-400 uppercase flex items-center gap-1.5 mt-0.5">
                                <span>{p.code || 'NO-CODE'}</span> <span className="text-gray-200">|</span> <span>{p.unit || 'NO-UNIT'}</span>
                              </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteParameter(idx); }} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                {/* ── 4. Rules ── */}
                <section>
                  <SectionTag color="green">4. Ref Range Rules {selectedParamIndex >= 0 && `(${testForm.groups[selectedGroupIndex].parameters[selectedParamIndex].name})`}</SectionTag>
                  {selectedParamIndex === -1 ? (
                    <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                      <Zap className="w-6 h-6 text-gray-100 mx-auto mb-2" />
                      <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Select parameter to manage rules</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <Label>Gender</Label>
                          <Select value={ruleInput.gender} onChange={e => setRuleInput({...ruleInput, gender: e.target.value})}>
                            <option>Any</option><option>Male</option><option>Female</option>
                          </Select>
                        </div>
                        <div>
                          <Label>Age Min</Label>
                          <Input type="number" value={ruleInput.ageMin} onChange={e => setRuleInput({...ruleInput, ageMin: parseInt(e.target.value)})}/>
                        </div>
                        <div>
                          <Label>Age Max</Label>
                          <Input type="number" value={ruleInput.ageMax} onChange={e => setRuleInput({...ruleInput, ageMax: parseInt(e.target.value)})}/>
                        </div>
                        <div>
                          <Label>Unit</Label>
                          <Select value={ruleInput.ageUnit} onChange={e => setRuleInput({...ruleInput, ageUnit: e.target.value})}>
                            <option>Years</option><option>Months</option><option>Days</option>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Label>Normal Range *</Label>
                          <Input placeholder="e.g. 13.5 - 17.5" value={ruleInput.normalRange} onChange={e => setRuleInput({...ruleInput, normalRange: e.target.value})} className="font-black text-emerald-600"/>
                        </div>
                        <div>
                          <Label>Crit Low</Label>
                          <Input placeholder="L" value={ruleInput.criticalLow} onChange={e => setRuleInput({...ruleInput, criticalLow: e.target.value})} className="text-red-400 font-bold"/>
                        </div>
                        <div>
                          <Label>Crit High</Label>
                          <Input placeholder="H" value={ruleInput.criticalHigh} onChange={e => setRuleInput({...ruleInput, criticalHigh: e.target.value})} className="text-red-500 font-bold"/>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {selectedRuleIndex === -1 ? (
                          <button onClick={handleAddRule} className="flex-grow py-1.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 hover:bg-emerald-700 shadow-md shadow-emerald-50">
                            <Plus className="w-3.5 h-3.5" /> Add Rule
                          </button>
                        ) : (
                          <>
                            <button onClick={handleUpdateRule} disabled={!hasRuleChanged()} className="flex-grow py-1.5 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 hover:bg-blue-700 disabled:opacity-30 shadow-md shadow-blue-50">
                              <Save className="w-3.5 h-3.5" /> Update
                            </button>
                            <button onClick={handleClearRule} className="px-3.5 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-[9px] font-black uppercase hover:bg-gray-200">Clear</button>
                          </>
                        )}
                      </div>
                      <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl bg-white shadow-inner custom-scrollbar overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50/50 border-b border-gray-100 sticky top-0">
                            <tr>
                              <th className="p-2 text-[9px] font-black text-gray-400 uppercase tracking-tighter">Gen</th>
                              <th className="p-2 text-[9px] font-black text-gray-400 uppercase tracking-tighter">Age</th>
                              <th className="p-2 text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Normal Range</th>
                              <th className="p-2 text-[9px] text-right"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 font-bold text-[8.5px] uppercase">
                            {testForm.groups[selectedGroupIndex].parameters[selectedParamIndex].rules.map((rule, idx) => (
                              <tr key={idx} onClick={() => { setSelectedRuleIndex(idx); setRuleInput({...rule}); setOriginalRuleData({...rule}); }}
                                className={`cursor-pointer transition-all ${selectedRuleIndex === idx ? 'bg-emerald-50 border-l-2 border-emerald-500 text-gray-900' : 'hover:bg-gray-50/50 text-gray-500'}`}>
                                <td className="p-2">{rule.gender.charAt(0)}</td>
                                <td className="p-2 whitespace-nowrap font-mono">{rule.ageMin}-{rule.ageMax}{rule.ageUnit.charAt(0)}</td>
                                <td className="p-2 text-emerald-600 font-black">{rule.normalRange}</td>
                                <td className="p-2 text-right">
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteRule(idx); }} className="p-1 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 text-[9px] text-gray-400 font-black uppercase tracking-widest">
                <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {testForm.groups.length} Groups</div>
                <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-purple-500" /> {getParamCount(testForm)} Parameters</div>
              </div>
              <div className="flex items-center gap-3">
                {testForm.id && (
                  <label className="flex items-center gap-2 cursor-pointer group pr-3 border-r border-gray-100 mr-1.5">
                    <input 
                      type="checkbox" 
                      checked={syncToLabs} 
                      onChange={(e) => setSyncToLabs(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500 transition-all cursor-pointer"
                    />
                    <span className="text-[8.5px] font-black text-gray-400 uppercase tracking-widest group-hover:text-red-600 transition-colors">Sync with all Labs</span>
                  </label>
                )}
                <button onClick={() => setShowAddModal(false)} className="px-3 py-1.5 text-[9px] font-bold text-gray-500 uppercase hover:text-gray-900 transition-colors">Cancel</button>

                <button onClick={handleSaveAll} disabled={saving} className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-md shadow-emerald-50 disabled:opacity-50">
                  {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  {testForm.id ? 'Save Master Definition' : 'Publish to Catalog'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalTestCatalog;
